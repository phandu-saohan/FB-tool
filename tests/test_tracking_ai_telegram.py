import unittest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.database import get_db, Base
from app.database.models import EmailCampaign, EmailCampaignRecipient, EmailProviderSetting
from app.services.email.tracking_service import EmailTrackingService
from app.services.telegram_service import TelegramService

# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

class TestTrackingAITelegram(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_db] = override_get_db
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()
        self.client = TestClient(app)

        # Setup initial setting
        self.setting = EmailProviderSetting(
            name="Test Account",
            from_email="outreach@test.com",
            daily_limit=300,
            telegram_alerts_enabled=False
        )
        self.db.add(self.setting)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.clear()

    def test_tracking_service_pixel_and_links(self):
        html = '<p>Xin chào <a href="https://example.com/register">Đăng ký</a></p>'
        tracked_html = EmailTrackingService.inject_tracking(
            html, recipient_id=123, base_url="http://test.com"
        )
        self.assertIn("/api/email/track/open/123.png", tracked_html)
        self.assertIn("/api/email/track/click/123?url=https%3A%2F%2Fexample.com%2Fregister", tracked_html)

    def test_track_open_endpoint(self):
        # Create campaign and recipient
        c = EmailCampaign(name="Promo", subject="Sub", from_name="N", from_email="e@e.com")
        self.db.add(c)
        self.db.commit()

        r = EmailCampaignRecipient(campaign_id=c.id, email="doc@clinic.com", name="Dr. A")
        self.db.add(r)
        self.db.commit()

        res = self.client.get(f"/api/email/track/open/{r.id}.png", headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "image/png")
        self.assertEqual(res.content, EmailTrackingService.get_1px_png())

        # Verify recipient stats updated in DB
        self.db.refresh(r)
        self.assertEqual(r.open_count, 1)
        self.assertIsNotNone(r.opened_at)
        self.assertEqual(r.device_type, "Mobile")

    def test_track_click_endpoint(self):
        c = EmailCampaign(name="Promo 2", subject="Sub", from_name="N", from_email="e@e.com")
        self.db.add(c)
        self.db.commit()

        r = EmailCampaignRecipient(campaign_id=c.id, email="doc2@clinic.com", name="Dr. B")
        self.db.add(r)
        self.db.commit()

        target = "https://example.com/webinar"
        res = self.client.get(f"/api/email/track/click/{r.id}?url={target}", follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res.headers["location"], target)

        self.db.refresh(r)
        self.assertEqual(r.click_count, 1)
        self.assertEqual(r.open_count, 1) # Click implies opened

    def test_ai_generate_endpoint(self):
        payload = {
            "topic": "Hội Thảo Trẻ Hóa Da 2026",
            "audience": "Bác sĩ Da Liễu",
            "tone": "Chuyên nghiệp, sang trọng",
            "cta_text": "Đăng ký nhận vé VIP",
            "cta_url": "https://aesthetichub.vn/vip"
        }
        res = self.client.post("/api/email/ai/generate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("subject_variants", data)
        self.assertGreater(len(data["subject_variants"]), 0)
        self.assertIn("content_html", data)
        self.assertIn("content_plain", data)

    def test_telegram_settings_update(self):
        payload = {
            "telegram_bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            "telegram_chat_id": "-1001234567890",
            "telegram_alerts_enabled": True,
            "telegram_notify_on_complete": True,
            "telegram_notify_on_error": True
        }
        res = self.client.put("/api/email/telegram/settings", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["telegram_chat_id"], "-1001234567890")
        self.assertTrue(data["telegram_alerts_enabled"])

    def test_campaign_response_open_and_click_rate(self):
        c = EmailCampaign(name="Test Rates", subject="Sub", from_name="N", from_email="e@e.com", sent_count=2)
        self.db.add(c)
        self.db.commit()

        # Recipient 1: opened and clicked
        r1 = EmailCampaignRecipient(campaign_id=c.id, email="r1@test.com", open_count=2, click_count=1, status="SENT")
        # Recipient 2: only opened
        r2 = EmailCampaignRecipient(campaign_id=c.id, email="r2@test.com", open_count=1, click_count=0, status="SENT")
        self.db.add_all([r1, r2])
        self.db.commit()

        res = self.client.get(f"/api/email/campaigns/{c.id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["opened_count"], 2)
        self.assertEqual(data["clicked_count"], 1)
        self.assertEqual(data["open_rate"], 100.0)
        self.assertEqual(data["click_rate"], 50.0)

if __name__ == "__main__":
    unittest.main()
