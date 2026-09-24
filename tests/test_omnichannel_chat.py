import unittest
import json
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base, get_db
from app.main import app
from app.database.models import ChatChannel, ChatContact, ChatConversation, ChatMessage, ChatQuickReply, ChatSetting

# Set up in-memory SQLite database for test isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

class TestOmnichannelChat(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)

    def setUp(self):
        # Clean up database between tests
        db = TestingSessionLocal()
        db.query(ChatMessage).delete()
        db.query(ChatConversation).delete()
        db.query(ChatContact).delete()
        db.query(ChatQuickReply).delete()
        db.query(ChatChannel).delete()
        db.query(ChatSetting).delete()
        db.commit()
        db.close()

    def test_01_channels_management(self):
        # 1. Get channels (triggers seed)
        res = self.client.get("/api/chat/channels")
        self.assertEqual(res.status_code, 200)
        channels = res.json()
        self.assertGreaterEqual(len(channels), 4)

        # 2. Create custom channel
        payload = {
            "channel_type": "FB_PAGE",
            "name": "Fanpage Chi Nhánh 2",
            "account_identifier": "page_id_branch_2",
            "access_token": "demo_token_branch_2"
        }
        create_res = self.client.post("/api/chat/channels", json=payload)
        self.assertEqual(create_res.status_code, 200)
        new_ch = create_res.json()
        self.assertEqual(new_ch["name"], "Fanpage Chi Nhánh 2")

        # 3. Update channel
        ch_id = new_ch["id"]
        update_res = self.client.put(f"/api/chat/channels/{ch_id}", json={"name": "Fanpage Chi Nhánh 2 (Updated)"})
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["name"], "Fanpage Chi Nhánh 2 (Updated)")

        # 4. Delete channel
        del_res = self.client.delete(f"/api/chat/channels/{ch_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_02_conversations_and_filter(self):
        # Ensure seed
        res = self.client.get("/api/chat/conversations")
        self.assertEqual(res.status_code, 200)
        convs = res.json()
        self.assertGreaterEqual(len(convs), 3)

        # Filter by ZALO
        zalo_res = self.client.get("/api/chat/conversations?channel_type=ZALO")
        self.assertEqual(zalo_res.status_code, 200)
        for c in zalo_res.json():
            self.assertEqual(c["channel_type"], "ZALO")

        # Search by contact name
        search_res = self.client.get("/api/chat/conversations?search=Linh")
        self.assertEqual(search_res.status_code, 200)
        self.assertTrue(any("Linh" in c["contact_name"] for c in search_res.json()))

    def test_03_send_outbound_message(self):
        # Get first conversation
        convs = self.client.get("/api/chat/conversations").json()
        first_conv = convs[0]
        conv_id = first_conv["id"]

        # Send outbound reply
        send_payload = {
            "content": "Dạ em gửi anh/chị phác đồ điều trị chi tiết ạ.",
            "message_type": "TEXT",
            "sender_name": "Bác sĩ Chuyên Khoa"
        }
        res = self.client.post(f"/api/chat/conversations/{conv_id}/messages", json=send_payload)
        self.assertEqual(res.status_code, 200)
        msg = res.json()
        self.assertEqual(msg["sender_type"], "AGENT")
        self.assertEqual(msg["delivery_status"], "SENT")
        self.assertFalse(msg["is_inbound"])

        # Check conversation detail has new message
        detail_res = self.client.get(f"/api/chat/conversations/{conv_id}")
        self.assertEqual(detail_res.status_code, 200)
        detail = detail_res.json()
        self.assertEqual(detail["last_message_sender"], "AGENT")
        self.assertEqual(detail["unread_count"], 0)

    def test_03b_send_fb_personal_outbound_message(self):
        # 1. Simulate incoming message to create FB_PERSONAL conversation
        sim_payload = {
            "channel_type": "FB_PERSONAL",
            "sender_name": "Nguyễn Hoàng Nam (Bạn bè)",
            "message_text": "Bác sĩ ơi cho em hỏi lịch khám"
        }
        sim_res = self.client.post("/api/chat/simulate-incoming", json=sim_payload)
        self.assertEqual(sim_res.status_code, 200)
        sim_data = sim_res.json()
        conv_id = sim_data["conversation_id"]

        # 2. Send outbound reply via FB_PERSONAL channel
        send_payload = {
            "content": "Chào bạn, chiều nay phòng khám mở cửa từ 14h nhé!",
            "message_type": "TEXT",
            "sender_name": "Bác sĩ Tuấn Anh"
        }
        res = self.client.post(f"/api/chat/conversations/{conv_id}/messages", json=send_payload)
        self.assertEqual(res.status_code, 200)
        msg = res.json()
        self.assertEqual(msg["sender_type"], "AGENT")
        self.assertEqual(msg["delivery_status"], "SENT")
        self.assertIn("fb_pers_", msg["external_message_id"])

        # 3. Check conversation updated
        detail = self.client.get(f"/api/chat/conversations/{conv_id}").json()
        self.assertEqual(detail["last_message_text"], send_payload["content"])
        self.assertEqual(detail["last_message_sender"], "AGENT")

    def test_04_simulate_incoming_messages_across_channels(self):
        # Test simulation for each platform
        platforms = ["FB_PAGE", "FB_PERSONAL", "ZALO", "WHATSAPP"]
        for p in platforms:
            sim_payload = {
                "channel_type": p,
                "sender_name": f"Khách Hàng {p}",
                "sender_phone": "0911223344",
                "message_text": f"Tin nhắn test thử nghiệm từ nền tảng {p}"
            }
            res = self.client.post("/api/chat/simulate-incoming", json=sim_payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["sender_type"], "CONTACT")
            self.assertTrue(data["is_inbound"])

    def test_05_ai_copilot_suggestions(self):
        convs = self.client.get("/api/chat/conversations").json()
        conv_id = convs[0]["id"]

        res = self.client.post(f"/api/chat/conversations/{conv_id}/ai-suggest")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("suggestions", data)
        self.assertEqual(len(data["suggestions"]), 3)
        self.assertIn("detected_intent", data)

    def test_06_quick_replies_and_stats(self):
        # 1. Quick replies list
        qr_res = self.client.get("/api/chat/quick-replies")
        self.assertEqual(qr_res.status_code, 200)
        qrs = qr_res.json()
        self.assertGreaterEqual(len(qrs), 4)

        # 2. Create new quick reply
        new_qr = {
            "shortcut": "/bh",
            "title": "Chính sách bảo hành",
            "content": "Dạ dịch vụ được bảo hành chính hãng 10 năm tại tất cả hệ thống phòng khám trên toàn quốc ạ."
        }
        create_res = self.client.post("/api/chat/quick-replies", json=new_qr)
        self.assertEqual(create_res.status_code, 200)

        # 3. Stats endpoint
        stats_res = self.client.get("/api/chat/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats = stats_res.json()
        self.assertGreaterEqual(stats["total_conversations"], 3)
        self.assertIn("FB_PAGE", stats["by_channel"])
        self.assertIn("ZALO", stats["by_channel"])
        self.assertIn("WHATSAPP", stats["by_channel"])

    def test_07_settings_management(self):
        res = self.client.get("/api/chat/settings")
        self.assertEqual(res.status_code, 200)
        st = res.json()
        self.assertTrue(st["ai_auto_suggest"])

        update_res = self.client.put("/api/chat/settings", json={"sound_notifications": False})
        self.assertEqual(update_res.status_code, 200)
        self.assertFalse(update_res.json()["sound_notifications"])


if __name__ == "__main__":
    unittest.main()
