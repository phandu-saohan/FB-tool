import unittest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import init_db, SessionLocal
from app.database.models import ZaloGroup, ZaloPost, ZaloPostItem, ZaloSetting
from app.services.zalo.group_search_service import ZaloGroupSearchService
from app.services.zalo.zalo_worker import zalo_worker

class TestZaloMarketing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        # Clear Zalo test data
        with SessionLocal() as db:
            db.query(ZaloPostItem).delete()
            db.query(ZaloPost).delete()
            db.query(ZaloGroup).delete()
            db.commit()

    def test_01_search_groups(self):
        """Test searching Zalo community groups by keyword"""
        payload = {"keyword": "thẩm mỹ", "limit": 10}
        res = self.client.post("/api/zalo/groups/search", json=payload)
        self.assertEqual(res.status_code, 200)
        items = res.json()
        self.assertIsInstance(items, list)
        self.assertGreater(len(items), 0)
        self.assertTrue(any("zalo.me/g" in g["group_link"] for g in items))

    def test_02_create_and_import_groups(self):
        """Test single group creation and multiline batch import"""
        # 1. Single group
        single_payload = {
            "name": "CLB Bác Sĩ Da Liễu Thẩm Mỹ",
            "group_link": "https://zalo.me/g/dalieuvn99",
            "category": "Da liễu",
            "members_count": 850
        }
        res1 = self.client.post("/api/zalo/groups", json=single_payload)
        self.assertEqual(res1.status_code, 200)
        g1 = res1.json()
        self.assertEqual(g1["name"], single_payload["name"])
        self.assertEqual(g1["group_link"], single_payload["group_link"])

        # 2. Batch import from text
        batch_text = """
        https://zalo.me/g/spahanoi2026
        Hội Clinic Sài Gòn - https://zalo.me/g/clinicsaigon2026
        https://zalo.me/g/dalieuvn99
        """
        res2 = self.client.post("/api/zalo/groups/batch-import", json={
            "links_text": batch_text,
            "category": "Spa & Clinic"
        })
        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()
        self.assertTrue(d2["success"])
        self.assertEqual(d2["added_count"], 2)  # 2 new, 1 duplicate skipped
        self.assertEqual(d2["skipped_count"], 1)

        # 3. List groups
        list_res = self.client.get("/api/zalo/groups")
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.json()), 3)

    def test_03_create_zalo_post_and_queue(self):
        """Test creating a post and verifying post items queue"""
        # Create 2 groups first
        with SessionLocal() as db:
            g1 = ZaloGroup(name="Nhóm A", group_link="https://zalo.me/g/test_a")
            g2 = ZaloGroup(name="Nhóm B", group_link="https://zalo.me/g/test_b")
            db.add_all([g1, g2])
            db.commit()
            db.refresh(g1)
            db.refresh(g2)
            g1_id, g2_id = g1.id, g2.id

        post_payload = {
            "title": "Kính Mời Tham Dự Hội Nghị Thẩm Mỹ 2026",
            "content": "Kính gửi Quý Bác sĩ, sự kiện thẩm mỹ lớn nhất 2026 sẽ diễn ra vào tháng 10.",
            "call_to_action_url": "https://kbit2026.vercel.app",
            "group_ids": [g1_id, g2_id],
            "delay_seconds": 15,
            "action": "draft"
        }
        res = self.client.post("/api/zalo/posts", json=post_payload)
        self.assertEqual(res.status_code, 200)
        post = res.json()
        self.assertEqual(post["title"], post_payload["title"])
        self.assertEqual(post["status"], "DRAFT")
        self.assertEqual(post["target_groups_count"], 2)

    def test_04_schedule_zalo_post(self):
        """Test scheduling a post with specific time and delay"""
        with SessionLocal() as db:
            g = ZaloGroup(name="Nhóm C", group_link="https://zalo.me/g/test_c")
            p = ZaloPost(title="Bài test schedule", content="Nội dung test", status="DRAFT")
            db.add_all([g, p])
            db.commit()
            db.refresh(g)
            db.refresh(p)
            p_id, g_id = p.id, g.id

        target_time = (datetime.utcnow() + timedelta(hours=3)).isoformat()
        sched_res = self.client.post(f"/api/zalo/posts/{p_id}/schedule", json={
            "scheduled_at": target_time,
            "group_ids": [g_id],
            "delay_seconds": 25
        })
        self.assertEqual(sched_res.status_code, 200)

        # Verify post is now SCHEDULED
        get_res = self.client.get(f"/api/zalo/posts/{p_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["status"], "SCHEDULED")
        self.assertEqual(get_res.json()["delay_seconds"], 25)

    def test_05_ai_generate_post(self):
        """Test AI generator for Zalo posts"""
        payload = {
            "topic": "Hội thảo nâng cung mày và trẻ hóa da mắt",
            "conference_name": "Hội Nghị Thẩm Mỹ 108",
            "cta_url": "https://kbit2026.vercel.app"
        }
        res = self.client.post("/api/zalo/ai/generate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(len(data["title"]) > 5)
        self.assertTrue(len(data["content"]) > 20)
        self.assertIn("https://kbit2026.vercel.app", data["full_message"])

    def test_06_dashboard_and_settings(self):
        """Test Zalo dashboard metrics and settings update"""
        dash_res = self.client.get("/api/zalo/dashboard")
        self.assertEqual(dash_res.status_code, 200)
        dash = dash_res.json()
        self.assertIn("total_groups", dash)
        self.assertIn("total_posts", dash)
        self.assertIn("daily_limit", dash)

        # Update settings
        set_res = self.client.put("/api/zalo/settings", json={
            "daily_limit": 80,
            "min_delay_seconds": 20,
            "max_delay_seconds": 50
        })
        self.assertEqual(set_res.status_code, 200)
        setting = set_res.json()
        self.assertEqual(setting["daily_limit"], 80)
        self.assertEqual(setting["min_delay_seconds"], 20)

if __name__ == '__main__':
    unittest.main()
