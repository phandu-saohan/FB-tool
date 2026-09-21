import os
import sys
import unittest
import asyncio
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import init_db, SessionLocal
from app.database.models import FacebookGroup, FacebookPage, FacebookPost, FacebookPostTarget, AutomationLog
from app.ai.content_generator import generate_facebook_post
from app.automation.checkpoint_detector import CHECKPOINT_URL_PATTERNS
from app.automation.browser_manager import browser_manager
from app.utils.rate_limiter import SafeRateLimiter
from app.services.queue_service import queue_service

class TestFacebookAutomation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_01_database_models(self):
        """Test database connectivity and model CRUD operations"""
        test_uid = uuid.uuid4().hex[:8]
        with SessionLocal() as db:
            grp = FacebookGroup(
                name=f"Thẩm Mỹ Viện Test {test_uid}",
                url=f"https://www.facebook.com/groups/test_{test_uid}/",
                members="25K",
                privacy="Public",
                keyword="thẩm mỹ",
                selected=True
            )
            db.add(grp)
            db.commit()
            self.assertIsNotNone(grp.id)

            found = db.query(FacebookGroup).filter(FacebookGroup.id == grp.id).first()
            self.assertEqual(found.name, f"Thẩm Mỹ Viện Test {test_uid}")
            self.assertTrue(found.selected)

            pg = FacebookPage(
                name=f"Bác Sĩ Da Liễu Test {test_uid}",
                url=f"https://www.facebook.com/page_test_{test_uid}/",
                followers="50K",
                keyword="da liễu"
            )
            db.add(pg)
            db.commit()
            self.assertIsNotNone(pg.id)

    def test_02_api_endpoints(self):
        """Test FastAPI endpoints for groups, pages, posts, settings, logs"""
        res_groups = self.client.get("/api/groups")
        self.assertEqual(res_groups.status_code, 200)
        self.assertIsInstance(res_groups.json(), list)

        res_pages = self.client.get("/api/pages")
        self.assertEqual(res_pages.status_code, 200)
        self.assertIsInstance(res_pages.json(), list)

        res_settings = self.client.get("/api/settings")
        self.assertEqual(res_settings.status_code, 200)
        self.assertIn("AI_PROVIDER", res_settings.json())

        res_logs = self.client.get("/api/logs")
        self.assertEqual(res_logs.status_code, 200)
        self.assertIsInstance(res_logs.json(), list)

        res_auto = self.client.get("/api/automation/status")
        self.assertEqual(res_auto.status_code, 200)
        self.assertIn("status", res_auto.json())

        res_browser = self.client.get("/api/browser/status")
        self.assertEqual(res_browser.status_code, 200)
        self.assertIn("is_running", res_browser.json())

    def test_03_create_post_and_target_flow(self):
        """Test post creation and target association"""
        payload = {
            "title": "Hội Thảo Da Liễu 2026",
            "content": "Kính mời quý bác sĩ tham dự hội thảo chuyên sâu...",
            "target_group_ids": [],
            "target_page_ids": []
        }
        res = self.client.post("/api/posts", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["title"], "Hội Thảo Da Liễu 2026")
        self.assertEqual(data["status"], "DRAFT")

    def test_04_ai_content_generator(self):
        """Test AI post generation and schema format"""
        result = asyncio.run(generate_facebook_post(
            topic="Công nghệ nâng cơ trẻ hóa Ultherapy",
            audience="Phụ nữ 30-50 tuổi",
            tone="Sang trọng, chuyên nghiệp",
            call_to_action="Nhắn tin đặt lịch tư vấn miễn phí ngay hôm nay"
        ))
        self.assertIn("headline", result)
        self.assertIn("content", result)
        self.assertIn("call_to_action", result)
        self.assertIn("hashtags", result)
        self.assertIn("full_text", result)
        self.assertTrue(len(result["headline"]) > 5)

    def test_05_checkpoint_detector_patterns(self):
        """Test checkpoint detection regex patterns"""
        import re
        test_checkpoint_url = "https://www.facebook.com/checkpoint/150005085/?next=https%3A%2F%2Fwww.facebook.com%2F"
        matched = any(re.search(pat, test_checkpoint_url, re.IGNORECASE) for pat in CHECKPOINT_URL_PATTERNS)
        self.assertTrue(matched)

        normal_url = "https://www.facebook.com/groups/thammyvietnam/"
        not_matched = any(re.search(pat, normal_url, re.IGNORECASE) for pat in CHECKPOINT_URL_PATTERNS)
        self.assertFalse(not_matched)

    def test_06_rate_limiter_logic(self):
        """Test rate limiter bounds and counter safety"""
        limiter = SafeRateLimiter(min_delay=60, max_delay=180, max_posts_per_run=10)
        self.assertTrue(limiter.can_post_more())
        for _ in range(10):
            limiter.increment_post()
        self.assertFalse(limiter.can_post_more())
        limiter.reset_counter()
        self.assertTrue(limiter.can_post_more())

    def test_07_queue_controls(self):
        """Test pause, resume, and cancel on queue service"""
        queue_service.status = 'RUNNING'
        queue_service.pause()
        self.assertEqual(queue_service.status, "PAUSED")
        queue_service.resume()
        self.assertEqual(queue_service.status, "RUNNING")
        queue_service.cancel()
        self.assertEqual(queue_service.status, "CANCELLED")

    def test_08_group_join_and_sync_helpers(self):
        """Test group join metadata parsing and endpoints"""
        from app.automation.facebook_group import clean_facebook_url, parse_group_metadata
        url = "https://www.facebook.com/groups/12345678/?ref=share&mibextid=wwXIfr"
        clean = clean_facebook_url(url)
        self.assertEqual(clean, "https://www.facebook.com/groups/12345678")

        meta = parse_group_metadata("Nhóm Riêng tư · 52K thành viên · 10 bài viết/ngày")
        self.assertEqual(meta["privacy"], "Private")
        self.assertEqual(meta["members"], "52K")

    def test_09_sync_joined_route_available(self):
        """Ensure /api/groups/sync-joined is accessible and not 405 Method Not Allowed"""
        from unittest.mock import patch, AsyncMock
        with patch("app.api.groups.fetch_joined_facebook_groups", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = [{"name": "Mock Group", "url": "https://facebook.com/groups/123", "members": "10K"}]
            res = self.client.post("/api/groups/sync-joined?max_results=50")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["count"], 1)

            # Also check GET works
            res_get = self.client.get("/api/groups/sync-joined?max_results=50")
            self.assertEqual(res_get.status_code, 200)

if __name__ == '__main__':
    unittest.main()
