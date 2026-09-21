import asyncio
import uuid
import logging
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database.models import (
    EmailCampaign,
    EmailCampaignRecipient,
    EmailJob,
    EmailProviderSetting
)
from app.services.email.providers.base_provider import EmailProvider
from app.services.email.providers.hostinger_smtp_provider import HostingerSMTPProvider
from app.services.email.providers.mock_email_provider import MockEmailProvider
from app.services.email.quota_manager import EmailQuotaManager
from app.services.email.rate_limiter import EmailRateLimiter
from app.services.email.circuit_breaker import EmailCircuitBreaker
from app.services.email.suppression_service import EmailSuppressionService
from app.services.email.audit_logger import EmailAuditLogger

logger = logging.getLogger("email_queue_worker")

# Retry backoff steps in minutes
RETRY_DELAYS_MINUTES = [5, 15, 30, 120, 1440]

class EmailWorker:
    def __init__(
        self,
        worker_id: Optional[str] = None,
        provider: Optional[EmailProvider] = None,
        provider_name: str = "Hostinger",
        enable_delay: bool = True
    ):
        self.worker_id = worker_id or f"worker_{uuid.uuid4().hex[:8]}"
        self.provider = provider
        self.provider_name = provider_name
        self.enable_delay = enable_delay
        self.is_running = False

    def get_provider(self, session: Session) -> EmailProvider:
        if self.provider:
            return self.provider

        setting = session.query(EmailProviderSetting).filter_by(provider_name=self.provider_name).first()
        if setting and setting.provider_name == "MockEmailProvider":
            return MockEmailProvider(daily_limit=setting.daily_limit)

        if setting:
            return HostingerSMTPProvider(
                smtp_host=setting.smtp_host,
                smtp_port=setting.smtp_port,
                smtp_username=setting.smtp_username,
                smtp_password=setting.smtp_password,
                use_ssl=setting.use_ssl,
                use_tls=setting.use_tls,
                default_from_email=setting.from_email,
                default_from_name=setting.from_name,
                daily_limit=setting.daily_limit
            )

        # Fallback to Mock provider if nothing configured
        return MockEmailProvider()

    @classmethod
    def recover_stale_jobs(cls, session: Session, stale_minutes: int = 10) -> int:
        """
        Watchdog: Recovers jobs that were locked by a crashed/restarted process.
        Resets locked_at and returns them to RETRY or PENDING status.
        """
        stale_threshold = datetime.utcnow() - timedelta(minutes=stale_minutes)
        stale_jobs = session.query(EmailJob).filter(
            EmailJob.status == 'PROCESSING',
            EmailJob.locked_at < stale_threshold
        ).all()

        recovered_count = 0
        for job in stale_jobs:
            job.status = 'RETRY'
            job.locked_at = None
            job.locked_by = None
            job.available_at = datetime.utcnow()
            recovered_count += 1

        if recovered_count > 0:
            session.commit()
            logger.info(f"Watchdog recovered {recovered_count} stale/crashed email jobs.")
        return recovered_count

    @classmethod
    def acquire_next_job(cls, session: Session, worker_id: str, campaign_id: Optional[int] = None) -> Optional[EmailJob]:
        """
        Atomically selects and locks the next available job for processing.
        Only picks jobs for campaigns with status 'RUNNING'.
        """
        cls.recover_stale_jobs(session)

        now = datetime.utcnow()
        query = session.query(EmailJob).join(EmailCampaign).filter(
            EmailCampaign.status == 'RUNNING',
            EmailJob.status.in_(['PENDING', 'RETRY']),
            EmailJob.available_at <= now,
            EmailJob.locked_at.is_(None)
        )

        if campaign_id:
            query = query.filter(EmailJob.campaign_id == campaign_id)

        job = query.order_by(EmailJob.id.asc()).first()
        if not job:
            return None

        # Lock the job
        job.status = 'PROCESSING'
        job.locked_at = now
        job.locked_by = worker_id
        session.commit()
        session.refresh(job)
        return job

    @staticmethod
    def personalize_content(
        template_text: str,
        recipient_name: Optional[str],
        recipient_email: str,
        campaign_name: str
    ) -> str:
        if not template_text:
            return ""
        name = recipient_name or recipient_email.split("@")[0]
        text = template_text.replace("{{name}}", name)
        text = text.replace("{{email}}", recipient_email)
        text = text.replace("{{campaign}}", campaign_name)
        return text

    @staticmethod
    def build_cta_with_utm(base_url: str, campaign_name: str, recipient_id: int) -> str:
        if not base_url:
            return ""
        slug = urllib.parse.quote_plus(campaign_name.strip().lower().replace(" ", "-"))
        delimiter = "&" if "?" in base_url else "?"
        utm_params = f"utm_source=email&utm_medium=email&utm_campaign={slug}&utm_content={recipient_id}"
        return f"{base_url}{delimiter}{utm_params}"

    async def process_job(self, session: Session, job: EmailJob) -> Dict[str, Any]:
        """
        Executes a single email sending job with full idempotency, quota reservation,
        rate limiting, and error handling.
        """
        provider = self.get_provider(session)
        campaign = job.campaign
        recipient = job.recipient

        # 1. Idempotency Check: Already sent?
        if recipient.status == 'SENT':
            job.status = 'COMPLETED'
            job.locked_at = None
            job.locked_by = None
            session.commit()
            return {"status": "SKIPPED_ALREADY_SENT", "email": recipient.email}

        # 2. Circuit Breaker Check
        is_tripped, cb_reason = EmailCircuitBreaker.is_tripped(session, self.provider_name)
        if is_tripped:
            # Release lock, cannot send now
            job.status = 'PENDING'
            job.locked_at = None
            job.locked_by = None
            session.commit()
            return {"status": "PAUSED_CIRCUIT_BREAKER", "reason": cb_reason}

        # 3. Sending Window Check
        setting = session.query(EmailProviderSetting).filter_by(provider_name=self.provider_name).first()
        win_start = setting.sending_window_start if setting else "08:00"
        win_end = setting.sending_window_end if setting else "18:00"
        in_window, win_reason = EmailRateLimiter.is_in_sending_window(win_start, win_end)
        
        # Note: If forced/testing, window might be bypassed or handled
        if not in_window and self.enable_delay:
            job.status = 'PENDING'
            job.locked_at = None
            job.locked_by = None
            session.commit()
            return {"status": "OUTSIDE_WINDOW", "reason": win_reason}

        # 4. Hourly Limit Check
        hourly_limit = setting.hourly_limit if setting else 30
        has_hourly_cap, hourly_count = EmailRateLimiter.check_hourly_limit(session, hourly_limit)
        if not has_hourly_cap:
            job.status = 'PENDING'
            job.locked_at = None
            job.locked_by = None
            session.commit()
            return {"status": "HOURLY_LIMIT_REACHED", "current_count": hourly_count}

        # 5. Eligibility, Suppression & Fatigue Check
        is_eligible, elig_reason = EmailSuppressionService.check_recipient_eligibility(
            session, recipient.email, self.provider_name
        )
        if not is_eligible:
            # Mark recipient SKIPPED, job COMPLETED
            recipient.status = 'SKIPPED'
            recipient.errorMessage = elig_reason
            job.status = 'COMPLETED'
            job.locked_at = None
            job.locked_by = None

            campaign.skipped_count = (campaign.skipped_count or 0) + 1
            campaign.remaining_count = max(0, (campaign.total_recipients or 0) - (campaign.sent_count or 0) - (campaign.failed_count or 0) - campaign.skipped_count)
            session.commit()
            return {"status": "SKIPPED_INELIGIBLE", "reason": elig_reason, "email": recipient.email}

        # 6. Atomic Quota Reservation
        quota_reserved = EmailQuotaManager.reserve_quota(session, self.provider_name, count=1)
        if not quota_reserved:
            # Daily limit exhausted! Release lock and wait for tomorrow
            job.status = 'PENDING'
            job.locked_at = None
            job.locked_by = None
            session.commit()
            return {"status": "DAILY_QUOTA_EXHAUSTED", "email": recipient.email}

        # 7. Personalization & Content Preparation
        body_html = self.personalize_content(
            campaign.content_html or "",
            recipient.name,
            recipient.email,
            campaign.name
        )
        body_plain = self.personalize_content(
            campaign.content_plain or "",
            recipient.name,
            recipient.email,
            campaign.name
        )
        subject = self.personalize_content(
            campaign.subject,
            recipient.name,
            recipient.email,
            campaign.name
        )

        # Inject UTM into CTA URL if present
        if campaign.cta_url:
            utm_url = self.build_cta_with_utm(campaign.cta_url, campaign.name, recipient.id)
            body_html = body_html.replace(campaign.cta_url, utm_url)

        # 8. Send Email via Provider
        send_result = await provider.send(
            to_email=recipient.email,
            to_name=recipient.name,
            subject=subject,
            html_content=body_html,
            plain_content=body_plain,
            from_email=campaign.from_email,
            from_name=campaign.from_name,
            reply_to=campaign.reply_to
        )

        now_time = datetime.utcnow()

        # 9. Handle Result
        if send_result.success:
            # Succeeded! Commit quota permanently
            EmailQuotaManager.commit_quota(session, self.provider_name, count=1)
            EmailCircuitBreaker.record_success(session, self.provider_name)

            recipient.status = 'SENT'
            recipient.sent_at = now_time
            recipient.last_attempt_at = now_time
            recipient.provider_message_id = send_result.message_id
            recipient.idempotency_key = f"campaign_{campaign.id}_recip_{recipient.id}"

            job.status = 'COMPLETED'
            job.locked_at = None
            job.locked_by = None

            campaign.sent_count = (campaign.sent_count or 0) + 1
            campaign.last_processed_at = now_time
            campaign.remaining_count = max(0, (campaign.total_recipients or 0) - campaign.sent_count - (campaign.failed_count or 0) - (campaign.skipped_count or 0))

            if campaign.remaining_count == 0:
                campaign.status = 'COMPLETED'
                campaign.completed_at = now_time

            session.commit()

            # Jitter delay between emails
            if self.enable_delay:
                min_d = campaign.min_delay_seconds or (setting.min_delay_seconds if setting else 15)
                max_d = campaign.max_delay_seconds or (setting.max_delay_seconds if setting else 45)
                delay_sec = EmailRateLimiter.get_jitter_delay(min_d, max_d)
                logger.info(f"Email sent to {recipient.email}. Jitter delay: {delay_sec}s")
                await asyncio.sleep(delay_sec)

            return {"status": "SENT", "email": recipient.email, "message_id": send_result.message_id}

        else:
            # Failed! Release reserved quota
            EmailQuotaManager.release_quota(session, self.provider_name, count=1)
            EmailCircuitBreaker.record_failure(session, self.provider_name, send_result.error_message or "")

            job.attempts += 1
            recipient.attempt_count += 1
            recipient.last_attempt_at = now_time
            recipient.error_code = send_result.error_code
            recipient.error_message = send_result.error_message
            job.last_error = f"{send_result.error_code}: {send_result.error_message}"

            # Check if permanent error (5xx or known bounce)
            if not send_result.is_temporary:
                recipient.status = 'BOUNCED'
                job.status = 'FAILED'
                job.locked_at = None
                job.locked_by = None

                campaign.failed_count = (campaign.failed_count or 0) + 1
                campaign.remaining_count = max(0, (campaign.total_recipients or 0) - (campaign.sent_count or 0) - campaign.failed_count - (campaign.skipped_count or 0))

                # Add to suppression list
                EmailSuppressionService.add_to_suppression(
                    session, recipient.email, reason="HARD_BOUNCE", source="SMTP_550"
                )
                session.commit()
                return {"status": "BOUNCED_PERMANENT", "email": recipient.email, "error": send_result.error_message}

            else:
                # Temporary error -> Exponential Retry Policy
                if job.attempts < 5:
                    delay_idx = min(job.attempts - 1, len(RETRY_DELAYS_MINUTES) - 1)
                    retry_minutes = RETRY_DELAYS_MINUTES[delay_idx]
                    next_retry = now_time + timedelta(minutes=retry_minutes)

                    job.status = 'RETRY'
                    job.available_at = next_retry
                    job.locked_at = None
                    job.locked_by = None

                    recipient.status = 'RETRY'
                    recipient.next_retry_at = next_retry
                    session.commit()
                    return {"status": "RETRY_SCHEDULED", "email": recipient.email, "retry_in_minutes": retry_minutes}
                else:
                    # Exceeded 5 retry attempts
                    job.status = 'FAILED'
                    job.locked_at = None
                    job.locked_by = None

                    recipient.status = 'FAILED'
                    campaign.failed_count = (campaign.failed_count or 0) + 1
                    campaign.remaining_count = max(0, (campaign.total_recipients or 0) - (campaign.sent_count or 0) - campaign.failed_count - (campaign.skipped_count or 0))
                    session.commit()
                    return {"status": "FAILED_MAX_RETRIES", "email": recipient.email, "attempts": job.attempts}

    async def run_batch(self, max_batch_size: int = 50, campaign_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Processes up to max_batch_size jobs in the current iteration."""
        results = []
        with SessionLocal() as session:
            for _ in range(max_batch_size):
                job = self.acquire_next_job(session, self.worker_id, campaign_id)
                if not job:
                    break
                
                res = await self.process_job(session, job)
                results.append(res)

                # If quota exhausted or circuit breaker tripped or outside window, halt batch
                if res.get("status") in ["DAILY_QUOTA_EXHAUSTED", "PAUSED_CIRCUIT_BREAKER", "OUTSIDE_WINDOW", "HOURLY_LIMIT_REACHED"]:
                    break
        return results
