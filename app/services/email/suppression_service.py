import re
from datetime import datetime, timedelta
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from app.database.models import EmailSuppression, EmailCampaignRecipient, EmailProviderSetting

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class EmailSuppressionService:
    """
    Validates recipient eligibility, checks suppression lists (unsubscribed, bounces),
    and enforces contact fatigue limits (e.g. max 1 email/7d, max 3 emails/30d).
    """

    @staticmethod
    def is_valid_email_format(email: str) -> bool:
        if not email or not isinstance(email, str):
            return False
        return bool(EMAIL_REGEX.match(email.strip()))

    @classmethod
    def is_in_suppression_list(cls, session: Session, email: str) -> Tuple[bool, Optional[str]]:
        supp = session.query(EmailSuppression).filter_by(email=email.strip().lower()).first()
        if supp:
            return True, f"In suppression list: {supp.reason}"
        return False, None

    @classmethod
    def add_to_suppression(cls, session: Session, email: str, reason: str = "HARD_BOUNCE", source: str = "System"):
        clean_email = email.strip().lower()
        existing = session.query(EmailSuppression).filter_by(email=clean_email).first()
        if not existing:
            supp = EmailSuppression(email=clean_email, reason=reason, source=source)
            session.add(supp)
            session.commit()

    @classmethod
    def check_fatigue_limit(
        cls,
        session: Session,
        email: str,
        max_7d: int = 1,
        max_30d: int = 3
    ) -> Tuple[bool, Optional[str]]:
        """Checks if recipient has exceeded frequency fatigue thresholds."""
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        # Count emails sent to this recipient in last 7 days
        count_7d = session.query(EmailCampaignRecipient).filter(
            EmailCampaignRecipient.email == email.strip().lower(),
            EmailCampaignRecipient.status == 'SENT',
            EmailCampaignRecipient.sent_at >= seven_days_ago
        ).count()

        if count_7d >= max_7d:
            return True, f"Frequency fatigue: Already sent {count_7d} email(s) in last 7 days (limit {max_7d})"

        # Count emails sent to this recipient in last 30 days
        count_30d = session.query(EmailCampaignRecipient).filter(
            EmailCampaignRecipient.email == email.strip().lower(),
            EmailCampaignRecipient.status == 'SENT',
            EmailCampaignRecipient.sent_at >= thirty_days_ago
        ).count()

        if count_30d >= max_30d:
            return True, f"Frequency fatigue: Already sent {count_30d} emails in last 30 days (limit {max_30d})"

        return False, None

    @classmethod
    def check_recipient_eligibility(
        cls,
        session: Session,
        email: str,
        provider: str = "Hostinger"
    ) -> Tuple[bool, str]:
        """
        Comprehensive check before queuing or sending:
        1. Syntax check
        2. Suppression list check
        3. Fatigue frequency check
        Returns (is_eligible, reason_or_status).
        """
        clean_email = (email or "").strip().lower()

        if not cls.is_valid_email_format(clean_email):
            return False, "INVALID_FORMAT: Malformed email address"

        in_supp, reason = cls.is_in_suppression_list(session, clean_email)
        if in_supp:
            return False, f"SUPPRESSED: {reason}"

        setting = session.query(EmailProviderSetting).filter_by(provider_name=provider).first()
        max_7d = setting.max_emails_per_contact_7d if setting else 1
        max_30d = setting.max_emails_per_contact_30d if setting else 3

        is_fatigued, fatigue_reason = cls.check_fatigue_limit(session, clean_email, max_7d, max_30d)
        if is_fatigued:
            return False, f"SKIPPED_FATIGUE: {fatigue_reason}"

        return True, "ELIGIBLE"
