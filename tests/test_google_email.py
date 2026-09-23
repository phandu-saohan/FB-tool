import unittest
from unittest.mock import patch, MagicMock
import smtplib
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import init_db, SessionLocal
from app.database.models import EmailProviderSetting
from app.services.email.providers.hostinger_smtp_provider import HostingerSMTPProvider
from app.services.email.worker import EmailWorker

class TestGoogleEmailIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        with SessionLocal() as db:
            db.query(EmailProviderSetting).delete()
            db.commit()

    def test_gmail_app_password_cleaning(self):
        """Tests that spaces in 16-character Google App Passwords are automatically stripped."""
        provider = HostingerSMTPProvider(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_username="doctor.outreach@gmail.com",
            smtp_password="abcd efgh ijkl mnop",
            use_ssl=False,
            use_tls=True
        )
        self.assertEqual(provider._get_clean_password(), "abcdefghijklmnop")

    def test_gmail_detailed_verification_auth_error(self):
        """Tests that 535 SMTP auth error on Gmail returns friendly App Password instructions."""
        provider = HostingerSMTPProvider(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_username="test@gmail.com",
            smtp_password="wrongpassword",
            use_ssl=False,
            use_tls=True
        )
        with patch.object(provider, '_create_connection') as mock_conn:
            mock_conn.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
            ok, msg = provider._verify_sync_detailed()
            self.assertFalse(ok)
            self.assertIn("Google từ chối xác thực", msg)
            self.assertIn("Mật khẩu ứng dụng", msg)
            self.assertIn("myaccount.google.com/apppasswords", msg)

    def test_create_and_manage_gmail_account(self):
        """Tests creating a personal Gmail sender account through API."""
        payload = {
            "name": "Bác Sĩ Nam - Gmail Cá Nhân",
            "priority": 1,
            "is_active": True,
            "provider_name": "Gmail",
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 587,
            "smtp_username": "dr.nam.aesthetic@gmail.com",
            "smtp_password": "abcd efgh ijkl mnop",
            "use_ssl": False,
            "use_tls": True,
            "from_email": "dr.nam.aesthetic@gmail.com",
            "from_name": "Dr. Nam Aesthetic",
            "daily_limit": 300,
            "safety_margin_pct": 10.0,
            "hourly_limit": 30,
            "min_delay_seconds": 20,
            "max_delay_seconds": 45
        }
        res = self.client.post("/api/email/accounts", json=payload)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["name"], "Bác Sĩ Nam - Gmail Cá Nhân")
        self.assertEqual(data["provider_name"], "Gmail")
        self.assertEqual(data["smtp_host"], "smtp.gmail.com")
        self.assertEqual(data["daily_limit"], 300)

        # Worker gets provider for this setting
        with SessionLocal() as db:
            setting = db.query(EmailProviderSetting).first()
            worker = EmailWorker()
            p = worker.get_provider_for_setting(setting)
            self.assertIsInstance(p, HostingerSMTPProvider)
            self.assertEqual(p.smtp_host, "smtp.gmail.com")
            self.assertEqual(p._get_clean_password(), "abcd efgh ijkl mnop".replace(" ", ""))

    def test_draft_connection_endpoint(self):
        """Tests testing connection draft directly from modal before saving."""
        draft_payload = {
            "name": "Test Mock Draft",
            "priority": 1,
            "is_active": True,
            "provider_name": "MockEmailProvider",
            "smtp_host": "mock.local",
            "smtp_port": 25,
            "smtp_username": "test@mock.local",
            "smtp_password": "pass",
            "use_ssl": False,
            "use_tls": False,
            "from_email": "test@mock.local",
            "from_name": "Test Mock",
            "daily_limit": 100
        }
        res = self.client.post("/api/email/accounts/test-draft", json=draft_payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("Mock", data["message"])

if __name__ == "__main__":
    unittest.main()
