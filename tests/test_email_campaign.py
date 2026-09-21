import unittest
import asyncio
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import init_db, SessionLocal
from app.database.models import (
    EmailCampaign,
    EmailCampaignRecipient,
    EmailJob,
    EmailQuota,
    EmailSuppression,
    EmailProviderSetting,
    EmailAuditLog
)
from app.services.email.quota_manager import EmailQuotaManager
from app.services.email.rate_limiter import EmailRateLimiter
from app.services.email.circuit_breaker import EmailCircuitBreaker
from app.services.email.suppression_service import EmailSuppressionService
from app.services.email.providers.mock_email_provider import MockEmailProvider
from app.services.email.providers.base_provider import EmailSendResult
from app.services.email.worker import EmailWorker

class TestEmailCampaign(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        # Clear email test tables before each test
        with SessionLocal() as db:
            db.query(EmailJob).delete()
            db.query(EmailCampaignRecipient).delete()
            db.query(EmailCampaign).delete()
            db.query(EmailQuota).delete()
            db.query(EmailSuppression).delete()
            db.query(EmailAuditLog).delete()
            
            # Reset or create default provider setting
            setting = db.query(EmailProviderSetting).first()
            if not setting:
                setting = EmailProviderSetting(
                    provider_name="MockEmailProvider",
                    daily_limit=300,
                    safety_margin_pct=10.0,
                    hourly_limit=30,
                    min_delay_seconds=0,
                    max_delay_seconds=0,
                    is_paused=False,
                    consecutive_failures=0
                )
                db.add(setting)
            else:
                setting.provider_name = "MockEmailProvider"
                setting.daily_limit = 300
                setting.safety_margin_pct = 10.0
                setting.hourly_limit = 30
                setting.min_delay_seconds = 0
                setting.max_delay_seconds = 0
                setting.is_paused = False
                setting.consecutive_failures = 0
                setting.pause_reason = None
                setting.cooldown_until = None
            db.commit()

    def test_01_quota_calculation_and_safety_margin(self):
        """Test daily limit safety margin calculation: 500 limit with 10% margin -> 450 effective limit"""
        effective = EmailQuotaManager.get_effective_limit(500, 10.0)
        self.assertEqual(effective, 450)

        effective_20 = EmailQuotaManager.get_effective_limit(200, 20.0)
        self.assertEqual(effective_20, 160)

    def test_02_atomic_quota_reservation(self):
        """Test atomic reservation blocks sends once effective limit is reached"""
        with SessionLocal() as db:
            setting = db.query(EmailProviderSetting).first()
            setting.daily_limit = 50
            setting.safety_margin_pct = 10.0 # Effective limit is 45
            db.commit()

            # Reserve 40 emails
            reserved_40 = EmailQuotaManager.reserve_quota(db, "MockEmailProvider", count=40)
            self.assertTrue(reserved_40)

            # Reserve 5 emails (total 45 == effective limit)
            reserved_5 = EmailQuotaManager.reserve_quota(db, "MockEmailProvider", count=5)
            self.assertTrue(reserved_5)

            # Reserve 1 more email (total 46 > 45) -> Must fail!
            reserved_over = EmailQuotaManager.reserve_quota(db, "MockEmailProvider", count=1)
            self.assertFalse(reserved_over)

    def test_03_rate_limiter_window_and_jitter(self):
        """Test sending window check and jitter delay calculations"""
        # Delay must be between min and max
        jitter = EmailRateLimiter.get_jitter_delay(15, 45)
        self.assertGreaterEqual(jitter, 15.0)
        self.assertLessEqual(jitter, 45.0)

        # Sending window check (always true when 00:00 to 23:59)
        in_win, reason = EmailRateLimiter.is_in_sending_window("00:00", "23:59")
        self.assertTrue(in_win)

    def test_04_suppression_and_fatigue_limits(self):
        """Test suppression list filtering and 7-day fatigue control"""
        with SessionLocal() as db:
            # 1. Invalid email format
            ok, reason = EmailSuppressionService.check_recipient_eligibility(db, "not-an-email")
            self.assertFalse(ok)
            self.assertIn("INVALID_FORMAT", reason)

            # 2. Suppression list
            EmailSuppressionService.add_to_suppression(db, "unsub@domain.vn", reason="UNSUBSCRIBED")
            ok_supp, reason_supp = EmailSuppressionService.check_recipient_eligibility(db, "unsub@domain.vn")
            self.assertFalse(ok_supp)
            self.assertIn("SUPPRESSED", reason_supp)

            # 3. Eligible email
            ok_valid, _ = EmailSuppressionService.check_recipient_eligibility(db, "doctor.valid@domain.vn")
            self.assertTrue(ok_valid)

    def test_05_circuit_breaker_trip_and_reset(self):
        """Test circuit breaker trips after consecutive failures threshold and can be reset"""
        with SessionLocal() as db:
            setting = db.query(EmailProviderSetting).first()
            setting.circuit_breaker_failures = 3 # Small threshold for fast test
            db.commit()

            # Record 2 failures -> not tripped
            EmailCircuitBreaker.record_failure(db, "MockEmailProvider", "Error 1")
            EmailCircuitBreaker.record_failure(db, "MockEmailProvider", "Error 2")
            tripped, _ = EmailCircuitBreaker.is_tripped(db, "MockEmailProvider")
            self.assertFalse(tripped)

            # Record 3rd failure -> trips!
            EmailCircuitBreaker.record_failure(db, "MockEmailProvider", "Error 3")
            tripped_now, reason = EmailCircuitBreaker.is_tripped(db, "MockEmailProvider")
            self.assertTrue(tripped_now)
            self.assertIn("TRIPPED", reason)

            # Reset circuit breaker
            EmailCircuitBreaker.reset(db, "MockEmailProvider")
            tripped_reset, _ = EmailCircuitBreaker.is_tripped(db, "MockEmailProvider")
            self.assertFalse(tripped_reset)

    def test_06_campaign_creation_and_contact_import_api(self):
        """Test creating campaign and importing contacts via API"""
        payload = {
            "name": "Thư Mời VIP Hội Nghị 2026",
            "subject": "Kính mời Bác sĩ tham dự",
            "from_name": "Aesthetic Conference",
            "from_email": "outreach@aesthetichub.vn",
            "content_html": "<p>Kính gửi {{name}}, tham gia ngay!</p>",
            "cta_url": "https://aesthetichub.vn/register"
        }
        res = self.client.post("/api/email/campaigns", json=payload)
        self.assertEqual(res.status_code, 200)
        camp_id = res.json()["id"]

        # Import 3 contacts
        import_payload = {
            "recipients": [
                {"email": "bacsi1@clinic.vn", "name": "Bác sĩ Một"},
                {"email": "bacsi2@clinic.vn", "name": "Bác sĩ Hai"},
                {"email": "bacsi1@clinic.vn", "name": "Bác sĩ Một Trùng Lặp"} # Duplicate in same campaign
            ]
        }
        import_res = self.client.post(f"/api/email/campaigns/{camp_id}/recipients", json=import_payload)
        self.assertEqual(import_res.status_code, 200)
        data = import_res.json()
        self.assertEqual(data["added_count"], 2)
        self.assertEqual(data["skipped_duplicates"], 1)

    def test_07_worker_successful_send_and_quota_commit(self):
        """Test email worker successfully sends an email, commits quota, and updates campaign stats"""
        # Create campaign and 1 recipient
        with SessionLocal() as db:
            camp = EmailCampaign(
                name="Success Campaign",
                subject="Chào {{name}}",
                from_email="outreach@aesthetichub.vn",
                content_html="<p>Xin chào {{name}}</p>",
                status="RUNNING",
                total_recipients=1,
                remaining_count=1
            )
            db.add(camp)
            db.flush()

            recip = EmailCampaignRecipient(
                campaign_id=camp.id,
                email="doctor.success@hospital.vn",
                name="Dr. Success",
                status="QUEUED"
            )
            db.add(recip)
            db.flush()

            job = EmailJob(
                campaign_id=camp.id,
                recipient_id=recip.id,
                status="PENDING",
                available_at=datetime.utcnow()
            )
            db.add(job)
            db.commit()
            camp_id = camp.id

        mock_provider = MockEmailProvider()
        worker = EmailWorker(provider=mock_provider, provider_name="MockEmailProvider", enable_delay=False)
        
        results = asyncio.run(worker.run_batch(max_batch_size=10, campaign_id=camp_id))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "SENT")

        with SessionLocal() as db:
            updated_camp = db.query(EmailCampaign).filter_by(id=camp_id).first()
            self.assertEqual(updated_camp.sent_count, 1)
            self.assertEqual(updated_camp.remaining_count, 0)
            self.assertEqual(updated_camp.status, "COMPLETED")

            updated_recip = db.query(EmailCampaignRecipient).filter_by(email="doctor.success@hospital.vn").first()
            self.assertEqual(updated_recip.status, "SENT")
            self.assertIsNotNone(updated_recip.sent_at)

    def test_08_permanent_error_bounces_and_adds_to_suppression(self):
        """Test permanent SMTP 550 error marks recipient BOUNCED and adds to suppression list"""
        with SessionLocal() as db:
            camp = EmailCampaign(
                name="Bounce Campaign",
                subject="Test Bounce",
                from_email="outreach@aesthetichub.vn",
                status="RUNNING",
                total_recipients=1,
                remaining_count=1
            )
            db.add(camp)
            db.flush()

            recip = EmailCampaignRecipient(
                campaign_id=camp.id,
                email="invalid_user_bounce@clinic.vn",
                name="Ghost User",
                status="QUEUED"
            )
            db.add(recip)
            db.flush()

            job = EmailJob(
                campaign_id=camp.id,
                recipient_id=recip.id,
                status="PENDING",
                available_at=datetime.utcnow()
            )
            db.add(job)
            db.commit()
            camp_id = camp.id

        mock_provider = MockEmailProvider(fail_mode="perm_error_550")
        worker = EmailWorker(provider=mock_provider, provider_name="MockEmailProvider", enable_delay=False)

        results = asyncio.run(worker.run_batch(max_batch_size=10, campaign_id=camp_id))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "BOUNCED_PERMANENT")

        with SessionLocal() as db:
            updated_recip = db.query(EmailCampaignRecipient).filter_by(email="invalid_user_bounce@clinic.vn").first()
            self.assertEqual(updated_recip.status, "BOUNCED")

            # Check it was auto-added to suppression table
            supp = db.query(EmailSuppression).filter_by(email="invalid_user_bounce@clinic.vn").first()
            self.assertIsNotNone(supp)
            self.assertEqual(supp.reason, "HARD_BOUNCE")

    def test_09_temporary_error_schedules_exponential_retry(self):
        """Test temporary SMTP 421 error schedules job for RETRY with backoff"""
        with SessionLocal() as db:
            camp = EmailCampaign(
                name="Retry Campaign",
                subject="Test Retry",
                from_email="outreach@aesthetichub.vn",
                status="RUNNING",
                total_recipients=1,
                remaining_count=1
            )
            db.add(camp)
            db.flush()

            recip = EmailCampaignRecipient(
                campaign_id=camp.id,
                email="busy_temp@clinic.vn",
                name="Busy Doctor",
                status="QUEUED"
            )
            db.add(recip)
            db.flush()

            job = EmailJob(
                campaign_id=camp.id,
                recipient_id=recip.id,
                status="PENDING",
                available_at=datetime.utcnow()
            )
            db.add(job)
            db.commit()
            camp_id = camp.id

        mock_provider = MockEmailProvider(fail_mode="temp_error_421")
        worker = EmailWorker(provider=mock_provider, provider_name="MockEmailProvider", enable_delay=False)

        results = asyncio.run(worker.run_batch(max_batch_size=10, campaign_id=camp_id))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "RETRY_SCHEDULED")
        self.assertEqual(results[0]["retry_in_minutes"], 5)

        with SessionLocal() as db:
            updated_job = db.query(EmailJob).filter_by(campaign_id=camp_id).first()
            self.assertEqual(updated_job.status, "RETRY")
            self.assertEqual(updated_job.attempts, 1)
            self.assertGreater(updated_job.available_at, datetime.utcnow())

    def test_10_idempotency_prevents_duplicate_sending(self):
        """Test re-processing an already SENT recipient is safely skipped"""
        with SessionLocal() as db:
            camp = EmailCampaign(
                name="Idempotency Test",
                subject="Idempotency",
                from_email="outreach@aesthetichub.vn",
                status="RUNNING"
            )
            db.add(camp)
            db.flush()

            recip = EmailCampaignRecipient(
                campaign_id=camp.id,
                email="already.sent@clinic.vn",
                status="SENT",
                sent_at=datetime.utcnow()
            )
            db.add(recip)
            db.flush()

            job = EmailJob(
                campaign_id=camp.id,
                recipient_id=recip.id,
                status="PENDING",
                available_at=datetime.utcnow()
            )
            db.add(job)
            db.commit()
            camp_id = camp.id

        mock_provider = MockEmailProvider()
        worker = EmailWorker(provider=mock_provider, provider_name="MockEmailProvider", enable_delay=False)

        results = asyncio.run(worker.run_batch(max_batch_size=10, campaign_id=camp_id))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "SKIPPED_ALREADY_SENT")
        # Ensure mock provider did NOT send an email
        self.assertEqual(len(mock_provider.sent_emails), 0)

    def test_11_watchdog_recovers_stale_jobs_after_crash(self):
        """Test watchdog recovers jobs locked > 10 minutes ago by a crashed process"""
        with SessionLocal() as db:
            camp = EmailCampaign(name="Crash Test", subject="Crash", from_email="a@b.c", status="RUNNING")
            db.add(camp)
            db.flush()

            recip = EmailCampaignRecipient(campaign_id=camp.id, email="crash.recip@c.vn", status="QUEUED")
            db.add(recip)
            db.flush()

            eleven_minutes_ago = datetime.utcnow() - timedelta(minutes=11)
            stale_job = EmailJob(
                campaign_id=camp.id,
                recipient_id=recip.id,
                status="PROCESSING",
                locked_at=eleven_minutes_ago,
                locked_by="crashed_worker_999"
            )
            db.add(stale_job)
            db.commit()

            recovered = EmailWorker.recover_stale_jobs(db, stale_minutes=10)
            self.assertEqual(recovered, 1)

            db.refresh(stale_job)
            self.assertEqual(stale_job.status, "RETRY")
            self.assertIsNone(stale_job.locked_at)

    def test_12_emergency_stop_all_email(self):
        """Test Emergency Stop immediately pauses all running campaigns and locks provider sending"""
        with SessionLocal() as db:
            c1 = EmailCampaign(name="Camp 1", subject="S1", from_email="a@b.c", status="RUNNING")
            c2 = EmailCampaign(name="Camp 2", subject="S2", from_email="a@b.c", status="RUNNING")
            db.add_all([c1, c2])
            db.commit()

        res = self.client.post("/api/email/emergency-stop")
        self.assertEqual(res.status_code, 200)

        with SessionLocal() as db:
            camps = db.query(EmailCampaign).all()
            for c in camps:
                self.assertEqual(c.status, "PAUSED")
            
            setting = db.query(EmailProviderSetting).first()
            self.assertTrue(setting.is_paused)
            self.assertIn("Emergency stop", setting.pause_reason)


    def test_13_create_multiple_email_accounts_max_10(self):
        """Test creating multiple email sending accounts up to 10 max, and blocking 11th"""
        with SessionLocal() as db:
            db.query(EmailProviderSetting).delete()
            db.commit()

        # Create 10 accounts
        for i in range(1, 11):
            res = self.client.post("/api/email/accounts", json={
                "name": f"Account {i}",
                "priority": i,
                "is_active": True,
                "provider_name": "MockEmailProvider",
                "smtp_host": f"smtp{i}.hostinger.com",
                "smtp_port": 465,
                "smtp_username": f"user{i}@aesthetichub.vn",
                "from_email": f"sender{i}@aesthetichub.vn",
                "from_name": f"Sender {i}",
                "daily_limit": 100 * i
            })
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["name"], f"Account {i}")

        # Try to create 11th account -> should fail with 400
        res11 = self.client.post("/api/email/accounts", json={
            "name": "Account 11",
            "priority": 11,
            "smtp_username": "user11@aesthetichub.vn",
            "from_email": "sender11@aesthetichub.vn"
        })
        self.assertEqual(res11.status_code, 400)
        self.assertIn("10", res11.json()["detail"])

    def test_14_auto_rotation_when_first_account_quota_exhausted(self):
        """Test auto-rotation: when Account #1 exhausts its daily quota, worker automatically routes to Account #2"""
        with SessionLocal() as db:
            db.query(EmailProviderSetting).delete()
            
            # Account 1: daily_limit = 1 (effective limit = 1 with 0% margin)
            acc1 = EmailProviderSetting(
                name="Account 1 (Small Quota)",
                priority=1,
                is_active=True,
                provider_name="MockEmailProvider",
                from_email="outreach1@aesthetichub.vn",
                from_name="Outreach 1",
                daily_limit=1,
                safety_margin_pct=0.0
            )
            # Account 2: daily_limit = 100
            acc2 = EmailProviderSetting(
                name="Account 2 (Backup)",
                priority=2,
                is_active=True,
                provider_name="MockEmailProvider",
                from_email="outreach2@aesthetichub.vn",
                from_name="Outreach 2",
                daily_limit=100,
                safety_margin_pct=0.0
            )
            db.add_all([acc1, acc2])
            
            # Create a running campaign with 2 recipients
            camp = EmailCampaign(name="Rotation Test Campaign", subject="Welcome {{name}}", from_email="outreach@aesthetichub.vn", status="RUNNING", total_recipients=2, remaining_count=2)
            db.add(camp)
            db.commit()
            db.refresh(camp)
            db.refresh(acc1)
            db.refresh(acc2)

            r1 = EmailCampaignRecipient(campaign_id=camp.id, email="doc1@hospital.vn", name="Doc 1", status="QUEUED")
            r2 = EmailCampaignRecipient(campaign_id=camp.id, email="doc2@hospital.vn", name="Doc 2", status="QUEUED")
            db.add_all([r1, r2])
            db.commit()
            db.refresh(r1)
            db.refresh(r2)

            j1 = EmailJob(campaign_id=camp.id, recipient_id=r1.id, status="PENDING", available_at=datetime.utcnow())
            j2 = EmailJob(campaign_id=camp.id, recipient_id=r2.id, status="PENDING", available_at=datetime.utcnow())
            db.add_all([j1, j2])
            db.commit()

        worker = EmailWorker(provider=MockEmailProvider(), enable_delay=False)

        # Send First Job: should be processed by Account 1
        with SessionLocal() as db:
            job1 = worker.acquire_next_job(db, "w1")
            res1 = asyncio.run(worker.process_job(db, job1))
            self.assertEqual(res1["status"], "SENT")
            self.assertEqual(res1["sender_account"], "Account 1 (Small Quota)")

        # Send Second Job: Account 1 is now exhausted (1/1), so worker must AUTO-ROTATE to Account 2!
        with SessionLocal() as db:
            job2 = worker.acquire_next_job(db, "w1")
            res2 = asyncio.run(worker.process_job(db, job2))
            self.assertEqual(res2["status"], "SENT")
            self.assertEqual(res2["sender_account"], "Account 2 (Backup)")

    def test_15_all_accounts_exhausted_pauses_safely(self):
        """Test when all active accounts exhaust quota, job pauses safely as PENDING without error"""
        with SessionLocal() as db:
            db.query(EmailProviderSetting).delete()
            
            # Account 1: limit 1, exhausted
            acc1 = EmailProviderSetting(
                name="Acc 1",
                priority=1,
                is_active=True,
                provider_name="MockEmailProvider",
                daily_limit=1,
                safety_margin_pct=0.0
            )
            db.add(acc1)
            db.commit()
            db.refresh(acc1)

            # Consume the quota on Account 1
            EmailQuotaManager.reserve_quota(db, provider=f"account_{acc1.id}", count=1)
            EmailQuotaManager.commit_quota(db, provider=f"account_{acc1.id}", count=1)

            camp = EmailCampaign(name="Exhausted Test", subject="Hello", from_email="outreach@aesthetichub.vn", status="RUNNING")
            db.add(camp)
            db.commit()
            db.refresh(camp)

            r = EmailCampaignRecipient(campaign_id=camp.id, email="dr@test.vn", status="QUEUED")
            db.add(r)
            db.commit()
            db.refresh(r)

            j = EmailJob(campaign_id=camp.id, recipient_id=r.id, status="PENDING", available_at=datetime.utcnow())
            db.add(j)
            db.commit()

        worker = EmailWorker(provider=MockEmailProvider(), enable_delay=False)
        with SessionLocal() as db:
            job = worker.acquire_next_job(db, "w1")
            res = asyncio.run(worker.process_job(db, job))
            self.assertEqual(res["status"], "ALL_ACCOUNTS_QUOTA_EXHAUSTED")
            
            db.refresh(job)
            self.assertEqual(job.status, "PENDING")
            self.assertIsNone(job.locked_at)

    def test_hostinger_rate_limit_backoff(self):
        """Tests that 451 Hostinger Ratelimit puts the account into cooldown and reschedules the job without consuming attempts."""
        class RateLimitedMockProvider(MockEmailProvider):
            async def send(self, *args, **kwargs):
                return EmailSendResult(
                    success=False,
                    error_code="451",
                    error_message='4.7.1 Ratelimit "hostinger_out_ratelimit" exceeded for key "RLgocsyba5e7d659',
                    is_temporary=True,
                    is_rate_limited=True
                )
            async def verify_connection(self):
                return True
            def get_limits(self):
                return {}
            def get_health(self):
                return {}

        with SessionLocal() as db:
            camp = EmailCampaign(
                name="RateLimit Test Camp",
                subject="Test Rate Limit",
                from_email="outreach@aesthetichub.vn",
                from_name="Test Sender",
                status="RUNNING"
            )
            db.add(camp)
            db.commit()
            db.refresh(camp)

            r = EmailCampaignRecipient(campaign_id=camp.id, email="rl_test@clinic.vn", name="Doctor Test", status="QUEUED")
            db.add(r)
            db.commit()
            db.refresh(r)
            recip_id = r.id

            j = EmailJob(campaign_id=camp.id, recipient_id=r.id, status="PENDING", available_at=datetime.utcnow())
            db.add(j)
            db.commit()
            db.refresh(j)

            # Ensure setting has cooldown cleared
            acc = db.query(EmailProviderSetting).first()
            if acc:
                acc.cooldown_until = None
                acc.is_paused = False
                db.commit()

        mock_prov = RateLimitedMockProvider()
        worker = EmailWorker(provider=mock_prov, enable_delay=False)

        with SessionLocal() as db:
            job = worker.acquire_next_job(db, "w_test")
            self.assertIsNotNone(job)

            res = asyncio.run(worker.process_job(db, job))
            self.assertEqual(res["status"], "RATE_LIMIT_COOLDOWN")
            self.assertEqual(res["cooldown_minutes"], 15)

            db.refresh(job)
            self.assertEqual(job.status, "RETRY")
            self.assertEqual(job.attempts, 0) # Attempts should NOT be burned for SMTP rate limit
            self.assertGreater(job.available_at, datetime.utcnow())

            r_updated = db.query(EmailCampaignRecipient).filter_by(id=recip_id).first()
            self.assertEqual(r_updated.status, "RETRY")
            self.assertGreater(r_updated.next_retry_at, datetime.utcnow())

            # Check account cooldown was set
            acc = db.query(EmailProviderSetting).first()
            self.assertIsNotNone(acc.cooldown_until)
            self.assertGreater(acc.cooldown_until, datetime.utcnow())


if __name__ == '__main__':
    unittest.main()
