import unittest
import asyncio
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import init_db, SessionLocal
from app.database.models import (
    CommentMonitoringRule,
    DiscoveredPost,
    CommentSuggestion,
    ScheduledComment,
    CommentCampaign,
    CommentRateLimit,
    CommentLog,
    CommentAssistantSetting,
    AutomationLog
)
from app.services.comment_assistant.providers.discovery_provider import (
    MockPostDiscoveryProvider,
    MetaPostDiscoveryProvider
)
from app.services.comment_assistant.providers.publishing_provider import (
    MockCommentPublishingProvider,
    MetaCommentPublishingProvider
)
from app.services.comment_assistant.relevance_engine import CommentRelevanceEngine
from app.services.comment_assistant.comment_generator import CommentGeneratorService
from app.services.comment_assistant.similarity_service import CommentSimilarityService
from app.services.comment_assistant.scheduler_service import CommentSchedulerService, comment_scheduler
from app.services.comment_assistant.audit_logger import CommentAuditLogger

class TestCommentAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        with SessionLocal() as db:
            db.query(CommentRateLimit).delete()
            db.query(ScheduledComment).delete()
            db.query(CommentSuggestion).delete()
            db.query(DiscoveredPost).delete()
            db.commit()

    def setUp(self):
        # Reset rate limit, logs, and ensure automation settings are enabled for test isolation
        with SessionLocal() as db:
            db.query(CommentRateLimit).delete()
            db.query(CommentLog).delete()
            db.query(ScheduledComment).delete()
            setting = db.query(CommentAssistantSetting).first()
            if setting:
                setting.automation_enabled = True
                setting.daily_limit = 30
            db.commit()

    def test_01_create_monitoring_rule(self):
        """Criteria 1: User creates monitoring rule"""
        payload = {
            "name": "RF & Exosome Dermatology Outreach",
            "keywords": "RF, Exosome, trẻ hóa da, hội thảo, da liễu",
            "excluded_keywords": "bán xe, bất động sản, bóc phốt",
            "topics": "Đào tạo CME, Hội thảo Thẩm mỹ",
            "locations": "Hà Nội, TP.HCM",
            "target_groups": "Cộng đồng Spa & Thẩm mỹ viện",
            "status": "ACTIVE"
        }
        res = self.client.post("/api/comments/monitoring-rules", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["name"], payload["name"])
        self.assertIsNotNone(data["id"])

    def test_02_mock_discovery_provider(self):
        """Criteria 2: Mock provider returns list of posts matching keywords"""
        provider = MockPostDiscoveryProvider()
        posts = asyncio.run(provider.search_posts(
            keywords=["RF", "Exosome"],
            excluded_keywords=["bán xe"],
            limit=5
        ))
        self.assertIsInstance(posts, list)
        self.assertGreater(len(posts), 0)
        self.assertTrue(any("rf" in p["post_text"].lower() or "exosome" in p["post_text"].lower() for p in posts))

    def test_03_relevance_engine_scoring(self):
        """Criteria 3: AI / Engine evaluates relevance score and provides reason"""
        post_text = "Chào các anh chị đồng nghiệp, em đang tìm hiểu về công nghệ RF vi điểm và Exosome. Sắp tới có hội nghị nào đào tạo không ạ?"
        eval_res = asyncio.run(CommentRelevanceEngine.evaluate_post(post_text, threshold=70))
        self.assertEqual(eval_res["action"], "COMMENT")
        self.assertGreaterEqual(eval_res["relevance_score"], 70)
        self.assertTrue(len(eval_res["reason"]) > 10)

    def test_04_skip_conditions_handling(self):
        """Criteria 4: Irrelevant, dispute, or medical diagnosis posts are strictly SKIPPED"""
        # Medical prescription request
        med_post = "Mặt em bị mụn mủ sưng phù đau quá, cứu em với em phải uống thuốc kháng sinh gì và bôi thuốc gì bây giờ?"
        eval_med = asyncio.run(CommentRelevanceEngine.evaluate_post(med_post))
        self.assertEqual(eval_med["action"], "SKIP")
        self.assertIn("BỎ QUA", eval_med["reason"])

        # Dispute drama
        dispute_post = "Bóc phốt thẩm mỹ viện X lừa đảo khách hàng tiền cọc làm liệu trình trẻ hóa da, tẩy chay gấp!"
        eval_disp = asyncio.run(CommentRelevanceEngine.evaluate_post(dispute_post))
        self.assertEqual(eval_disp["action"], "SKIP")

        # Completely unrelated
        unrelated_post = "Cần bán gấp xe Mazda 3 đời 2022 chính chủ, giá tốt."
        eval_unrelated = asyncio.run(CommentRelevanceEngine.evaluate_post(unrelated_post))
        self.assertEqual(eval_unrelated["action"], "SKIP")

    def test_05_generate_comment_variants(self):
        """Criteria 5: Relevant post generates 3-5 comment suggestions with ethical rules"""
        post_text = "Hiện nay có hội thảo nào cập nhật ứng dụng Exosome và Microneedling RF cho bác sĩ không ạ?"
        res = asyncio.run(CommentGeneratorService.generate_comment_variants(
            post_text=post_text,
            conference_name="Hội Nghị Khoa Học Thẩm Mỹ 2026",
            registration_url="https://aesthetichub.vn/hoi-nghi-2026",
            disclosure_mode="REQUIRED",
            disclosure_text="Thông tin chương trình do BTC cung cấp."
        ))
        self.assertIn("variants", res)
        self.assertGreaterEqual(len(res["variants"]), 3)
        self.assertIn("selected_comment", res)
        # Check disclosure inclusion
        self.assertTrue(any("Thông tin chương trình do BTC cung cấp" in v["text"] for v in res["variants"]))

    def test_06_edit_and_approval_flow(self):
        """Criteria 6 & 7: User edits, approves or rejects comment suggestion"""
        # Discover posts first to populate database
        disc_res = self.client.post("/api/comments/discover?limit=3")
        self.assertEqual(disc_res.status_code, 200)

        # Get pending suggestions
        suggs_res = self.client.get("/api/comments/suggestions?filter_type=all")
        self.assertEqual(suggs_res.status_code, 200)
        suggs = suggs_res.json()
        self.assertGreater(len(suggs), 0)

        target = suggs[0]
        # Edit
        edited_text = "Chào anh/chị, kính mời anh/chị tham khảo chương trình Hội Nghị Thẩm Mỹ 2026 chuẩn CME."
        edit_res = self.client.put(f"/api/comments/suggestions/{target['id']}/edit", json={
            "selected_comment": edited_text,
            "disclosure_mode": "OPTIONAL",
            "tags": "High-Priority"
        })
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.json()["selected_comment"], edited_text)

        # Approve
        app_res = self.client.post(f"/api/comments/suggestions/{target['id']}/approve", json={
            "reviewer_id": "test_doctor",
            "comment_text": edited_text
        })
        self.assertEqual(app_res.status_code, 200)
        self.assertTrue(app_res.json()["success"])

    def test_07_schedule_and_publish_flow(self):
        """Criteria 8 & 9: Schedule comment and publish through mock provider"""
        import uuid
        with SessionLocal() as db:
            sugg = db.query(CommentSuggestion).filter(CommentSuggestion.status == "APPROVED").first()
            if not sugg:
                sugg = db.query(CommentSuggestion).first()
                if sugg:
                    sugg.status = "APPROVED"
                    db.commit()
            self.assertIsNotNone(sugg, "A suggestion must exist to test scheduling")
            sugg_id = sugg.id

        unique_text = f"Kính mời quý bác sĩ tham khảo chương trình CME {uuid.uuid4().hex[:8]} cập nhật công nghệ mới."
        sched_payload = {
            "suggestion_id": sugg_id,
            "scheduled_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "comment_text": unique_text
        }
        sched_res = self.client.post("/api/comments/schedule", json=sched_payload)
        self.assertEqual(sched_res.status_code, 200, f"Error detail: {sched_res.json()}")
        data = sched_res.json()
        self.assertTrue(data["success"])
        scheduled_id = data["scheduled_id"]

        # Publish Now
        pub_res = self.client.post(f"/api/comments/publish-now/{scheduled_id}")
        self.assertEqual(pub_res.status_code, 200)
        pub_data = pub_res.json()
        self.assertTrue(pub_data["success"])
        self.assertEqual(pub_data["result"]["provider"], "MockCommentPublishingProvider")

    def test_08_duplicate_detection(self):
        """Criteria 11: Duplicate detection prevents repetitive comments"""
        prev_comment = "Chào anh/chị, anh/chị có thể tham khảo chương trình Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026 cập nhật về RF và Exosome."
        
        # Exact duplicate
        is_dup, score, reason = CommentSimilarityService.check_duplicate(
            new_comment=prev_comment,
            recent_comments=[prev_comment]
        )
        self.assertTrue(is_dup)
        self.assertEqual(score, 1.0)

        # High similarity (> 0.8)
        near_duplicate = "Chào anh/chị, anh/chị có thể tham khảo sự kiện Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026 cập nhật về RF và Exosome nhé."
        is_dup2, score2, reason2 = CommentSimilarityService.check_duplicate(
            new_comment=near_duplicate,
            recent_comments=[prev_comment],
            threshold=0.8
        )
        self.assertTrue(is_dup2)
        self.assertGreaterEqual(score2, 0.8)

        # Distinct comment
        distinct = "Kính mời quý bác sĩ đăng ký tham gia hội thảo Laser Pico chuyên đề da liễu tại TP.HCM."
        is_dup3, score3, _ = CommentSimilarityService.check_duplicate(
            new_comment=distinct,
            recent_comments=[prev_comment],
            threshold=0.8
        )
        self.assertFalse(is_dup3)

    def test_09_rate_limiting_and_cooldown(self):
        """Criteria 12: Rate limit blocks action when daily/hourly or group cooldown is exceeded"""
        service = CommentSchedulerService()
        with SessionLocal() as db:
            setting = service.get_or_create_settings(db)
            original_daily = setting.daily_limit

            # Set daily limit to 0 to simulate limit exceeded
            setting.daily_limit = 0
            db.commit()

            allowed, reason = service.check_rate_limits(db)
            self.assertFalse(allowed)
            self.assertIn("Daily comment limit reached", reason)

            # Restore daily limit
            setting.daily_limit = original_daily
            db.commit()

    def test_10_meta_provider_safe_permission_check(self):
        """Criteria: Meta Provider returns FEATURE_NOT_AVAILABLE without authorized token"""
        meta_prov = MetaCommentPublishingProvider(page_access_token=None)
        res = asyncio.run(meta_prov.publish_comment("123", "Sample text"))
        self.assertFalse(res["success"])
        self.assertEqual(res["error_code"], "FEATURE_NOT_AVAILABLE")

    def test_11_emergency_stop(self):
        """Criteria 13: Emergency stop cancels pending schedules and disables automation"""
        stop_res = self.client.post("/api/comments/emergency-stop")
        self.assertEqual(stop_res.status_code, 200)
        data = stop_res.json()
        self.assertTrue(data["success"])
        self.assertFalse(data["automation_enabled"])

        # Verify setting in DB is disabled
        with SessionLocal() as db:
            setting = db.query(CommentAssistantSetting).first()
            self.assertFalse(setting.automation_enabled)

        # Re-enable automation for subsequent tests
        self.client.put("/api/comments/settings", json={"automation_enabled": True})

    def test_12_analytics_and_audit_logs(self):
        """Criteria 10 & 14: Analytics metrics and audit logs recorded and retrieved"""
        # Analytics
        ana_res = self.client.get("/api/comments/analytics")
        self.assertEqual(ana_res.status_code, 200)
        ana_data = ana_res.json()
        self.assertIn("metrics", ana_data)
        self.assertIn("charts", ana_data)

        # Audit logs
        logs_res = self.client.get("/api/comments/logs")
        self.assertEqual(logs_res.status_code, 200)
        logs = logs_res.json()
        self.assertIsInstance(logs, list)
        self.assertTrue(any("COMMENT_" in l["action"] or "EMERGENCY_STOP" in l["action"] for l in logs))

    def test_13_campaign_creation(self):
        """Test comment campaign creation and listing"""
        payload = {
            "name": "RF Microneedling 2026 Outreach",
            "conference_name": "Hội Nghị Khoa Học Thẩm Mỹ 2026",
            "registration_url": "https://aesthetichub.vn/cme-2026",
            "monitoring_topics": "RF, Microneedling, Exosome",
            "target_groups": "Hội Bác sĩ Da Liễu",
            "daily_limit": 15
        }
        res = self.client.post("/api/comments/campaigns", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["name"], payload["name"])

        list_res = self.client.get("/api/comments/campaigns")
        self.assertEqual(list_res.status_code, 200)
        self.assertGreater(len(list_res.json()), 0)

    def test_14_custom_comment_creation(self):
        """Test user creating custom comments according to their wish (pending, approved, schedule)"""
        # 1. Create with action = 'pending'
        payload_pending = {
            "post_url": "https://facebook.com/groups/thammy/posts/9988776655",
            "group_name": "Cộng Đồng Thẩm Mỹ Trẻ Hóa",
            "author_name": "Bác sĩ Minh",
            "post_text": "Ca nâng cung chân mày kết hợp cấy mỡ tự thân sau 2 tuần.",
            "comment_text": "Kỹ thuật xử lý nếp mí và cung mày rất tự nhiên, chúc mừng bác sĩ!",
            "action": "pending"
        }
        res1 = self.client.post("/api/comments/custom", json=payload_pending)
        self.assertEqual(res1.status_code, 200)
        d1 = res1.json()
        self.assertTrue(d1["success"])
        self.assertEqual(d1["data"]["status"], "PENDING")

        # 2. Create with action = 'approve'
        payload_approve = {
            "post_url": "https://facebook.com/groups/thammy/posts/1122334455",
            "comment_text": "Kính mời bác sĩ tham dự Hội nghị Khoa học Thẩm mỹ Quốc tế 2026.",
            "action": "approve"
        }
        res2 = self.client.post("/api/comments/custom", json=payload_approve)
        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()
        self.assertTrue(d2["success"])
        self.assertEqual(d2["data"]["status"], "APPROVED")

        # 3. Create with action = 'schedule'
        payload_sched = {
            "post_url": "https://facebook.com/groups/thammy/posts/5566778899",
            "comment_text": "Thông tin chi tiết chương trình CME anh/chị xem thêm tại: https://aesthetichub.vn",
            "action": "schedule",
            "scheduled_at": (datetime.utcnow() + timedelta(hours=2)).isoformat()
        }
        res3 = self.client.post("/api/comments/custom", json=payload_sched)
        self.assertEqual(res3.status_code, 200)
        d3 = res3.json()
        self.assertTrue(d3["success"])
        self.assertEqual(d3["data"]["status"], "SCHEDULED")
        self.assertIn("schedule", d3["data"])

    def test_15_generate_custom_comment_ai(self):
        """Test AI generator responding to custom prompt"""
        payload = {
            "prompt": "Khen ca căng chỉ đẹp và giới thiệu hội nghị 108",
            "post_text": "Hình ảnh khách hàng sau căng chỉ collagen 3 ngày",
            "tone": "Professional"
        }
        res = self.client.post("/api/comments/generate-custom", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertTrue(len(data["comment_text"]) > 10)

if __name__ == '__main__':
    unittest.main()

