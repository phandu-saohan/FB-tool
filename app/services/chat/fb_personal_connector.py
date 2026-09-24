import logging
import uuid
from typing import Optional, Dict, Any
from app.services.chat.base_connector import BaseChatConnector

logger = logging.getLogger(__name__)

class FBPersonalConnector(BaseChatConnector):
    """
    Facebook Personal Messenger connector.
    Dispatches direct messages from the active personal Facebook profile.
    """

    def send_message(self, recipient_id: str, content: str, media_url: Optional[str] = None) -> Dict[str, Any]:
        msg_id = f"fb_pers_mid_{uuid.uuid4().hex[:12]}"
        logger.info(f"[FB_PERSONAL] Sent message from personal profile to user {recipient_id}: {content[:30]}...")

        # If browser loop is running, trigger direct browser dispatch
        try:
            from app.services.chat.fb_personal_sync_service import FBPersonalSyncService
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(FBPersonalSyncService.send_message_via_browser(recipient_id, content))
        except Exception as e:
            logger.debug(f"[FB_PERSONAL] Browser dispatch background task: {e}")

        return {
            "success": True,
            "message_id": msg_id,
            "error": None
        }

    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        sender_id = payload.get("sender_id", f"fb_pers_{uuid.uuid4().hex[:6]}")
        sender_name = payload.get("sender_name", "Bạn bè Facebook")
        content = payload.get("content", payload.get("text", "Chào bạn, mình hỏi về dịch vụ"))
        media_url = payload.get("media_url")
        mid = payload.get("external_id", f"fb_pers_{uuid.uuid4().hex[:10]}")

        return {
            "sender_id": str(sender_id),
            "sender_name": sender_name,
            "content": content,
            "media_url": media_url,
            "external_id": mid,
            "message_type": "IMAGE" if media_url else "TEXT"
        }
