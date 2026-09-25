import httpx
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import ZaloGroup, ChatConversation, ChatMessage, ChatContact
from app.utils.logger import log_info, log_warning, log_error
from datetime import datetime

logger = logging.getLogger(__name__)

class ZaloBotService:
    """
    Service for interacting with official Zalo Bot Platform (https://bot.zaloplatforms.com).
    Uses Telegram-compatible Bot API endpoints at https://bot-api.zaloplatforms.com.
    """

    BASE_URL = "https://bot-api.zaloplatforms.com"

    @classmethod
    def clean_token(cls, token: str) -> str:
        token = token.strip()
        if token.startswith("bot"):
            token = token[3:]
        return token

    @classmethod
    async def get_me(cls, bot_token: str) -> Dict[str, Any]:
        """
        Verify bot token and fetch bot profile details.
        """
        clean_tok = cls.clean_token(bot_token)
        url = f"{cls.BASE_URL}/bot{clean_tok}/getMe"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url)
                data = res.json()
                if res.status_code == 200 and data.get("ok", True):
                    bot_info = data.get("result", {})
                    log_info("ZALO_BOT", f"Bot verified successfully: {bot_info}")
                    return {
                        "success": True,
                        "bot_info": bot_info,
                        "bot_name": bot_info.get("first_name") or bot_info.get("name") or "Zalo Bot",
                        "bot_username": bot_info.get("username") or str(bot_info.get("id", "")),
                        "message": "Kết nối Zalo Bot thành công!"
                    }
                else:
                    err_msg = data.get("description") or data.get("message") or f"HTTP {res.status_code}"
                    log_warning("ZALO_BOT", f"Zalo Bot getMe failed: {err_msg}")
                    return {
                        "success": False,
                        "bot_info": None,
                        "message": f"Xác thực thất bại: {err_msg}"
                    }
        except Exception as e:
            log_error("ZALO_BOT", f"Error connecting to Zalo Bot API: {e}")
            return {
                "success": False,
                "bot_info": None,
                "message": f"Không thể kết nối đến máy chủ Zalo Bot: {str(e)}"
            }

    @classmethod
    async def send_message(cls, bot_token: str, chat_id: str, text: str) -> Dict[str, Any]:
        """
        Send text message to a user or group via Zalo Bot API.
        """
        clean_tok = cls.clean_token(bot_token)
        url = f"{cls.BASE_URL}/bot{clean_tok}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, json=payload)
                data = res.json()
                if res.status_code == 200 and data.get("ok", True):
                    log_info("ZALO_BOT", f"Message sent to chat {chat_id} successfully.")
                    return {
                        "success": True,
                        "result": data.get("result", {}),
                        "message": "Đã gửi tin nhắn thành công qua Zalo Bot!"
                    }
                else:
                    err_msg = data.get("description") or data.get("message") or f"HTTP {res.status_code}"
                    log_warning("ZALO_BOT", f"Send message failed for chat {chat_id}: {err_msg}")
                    return {
                        "success": False,
                        "result": None,
                        "message": f"Gửi tin thất bại: {err_msg}"
                    }
        except Exception as e:
            log_error("ZALO_BOT", f"Error sending message via Zalo Bot API: {e}")
            return {
                "success": False,
                "result": None,
                "message": f"Lỗi kết nối Zalo Bot: {str(e)}"
            }

    @classmethod
    async def set_webhook(cls, bot_token: str, webhook_url: str) -> Dict[str, Any]:
        """
        Register a public webhook URL with Zalo Bot Platform.
        """
        clean_tok = cls.clean_token(bot_token)
        url = f"{cls.BASE_URL}/bot{clean_tok}/setWebhook"
        payload = {"url": webhook_url}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                data = res.json()
                if res.status_code == 200 and data.get("ok", True):
                    log_info("ZALO_BOT", f"Webhook registered: {webhook_url}")
                    return {
                        "success": True,
                        "message": f"Đăng ký Webhook thành công: {webhook_url}"
                    }
                else:
                    err_msg = data.get("description") or data.get("message") or f"HTTP {res.status_code}"
                    return {
                        "success": False,
                        "message": f"Không thể đăng ký Webhook: {err_msg}"
                    }
        except Exception as e:
            log_error("ZALO_BOT", f"Error setting webhook: {e}")
            return {
                "success": False,
                "message": f"Lỗi thiết lập webhook: {str(e)}"
            }

    @classmethod
    def handle_webhook_update(cls, db: Session, update: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes incoming update from Zalo Bot webhook.
        Automatically discovers and registers groups where the bot is added,
        and synchronizes messages into Omnichannel Chat.
        """
        try:
            msg = update.get("message") or update.get("channel_post") or update.get("edited_message")
            chat_member = update.get("my_chat_member")

            chat = None
            text_content = ""
            sender = {}

            if msg:
                chat = msg.get("chat")
                text_content = msg.get("text", "")
                sender = msg.get("from", {})
            elif chat_member:
                chat = chat_member.get("chat")
                sender = chat_member.get("from", {})

            if not chat or "id" not in chat:
                return {"status": "ignored", "reason": "No chat in update"}

            chat_id = str(chat["id"])
            chat_title = chat.get("title") or chat.get("name") or sender.get("first_name") or f"Nhóm Zalo ({chat_id})"
            chat_type = chat.get("type", "group")

            # 1. AUTO-REGISTER ZALO GROUP (For marketing broadcasting)
            group_link = f"https://zalo.me/chat/{chat_id}"
            existing_group = db.query(ZaloGroup).filter(
                (ZaloGroup.group_id_external == chat_id) | (ZaloGroup.group_link == group_link)
            ).first()

            if not existing_group:
                new_group = ZaloGroup(
                    name=chat_title,
                    group_link=group_link,
                    group_id_external=chat_id,
                    category="Zalo Bot Groups",
                    description=f"Nhóm Zalo kết nối qua Zalo Bot (chat_id: {chat_id})",
                    members_count=chat.get("all_members_are_administrators", 0) and 5 or 1,
                    is_joined=True,
                    can_post=True,
                    status="ACTIVE"
                )
                db.add(new_group)
                db.commit()
                log_info("ZALO_BOT", f"Auto-discovered and registered new Zalo Group '{chat_title}' (chat_id: {chat_id})")
            elif existing_group.name != chat_title and chat.get("title"):
                existing_group.name = chat_title
                db.commit()

            # 2. AUTO-SYNC TO OMNICHANNEL CHAT (If there is text message)
            if text_content:
                # Find or create contact
                contact_ext_id = str(sender.get("id") or chat_id)
                contact_name = sender.get("first_name") or sender.get("username") or chat_title
                contact = db.query(ChatContact).filter(
                    ChatContact.platform == "ZALO",
                    ChatContact.external_id == contact_ext_id
                ).first()

                if not contact:
                    contact = ChatContact(
                        platform="ZALO",
                        external_id=contact_ext_id,
                        name=contact_name
                    )
                    db.add(contact)
                    db.commit()
                    db.refresh(contact)

                # Find or create conversation
                conv = db.query(ChatConversation).filter(
                    ChatConversation.channel_type == "ZALO",
                    ChatConversation.external_thread_id == chat_id
                ).first()

                if not conv:
                    conv = ChatConversation(
                        channel_type="ZALO",
                        external_thread_id=chat_id,
                        contact_id=contact.id,
                        unread_count=1,
                        snippet=text_content[:150],
                        last_message_at=datetime.utcnow()
                    )
                    db.add(conv)
                    db.commit()
                    db.refresh(conv)
                else:
                    conv.unread_count = (conv.unread_count or 0) + 1
                    conv.snippet = text_content[:150]
                    conv.last_message_at = datetime.utcnow()
                    db.commit()

                # Add incoming ChatMessage
                chat_msg = ChatMessage(
                    conversation_id=conv.id,
                    sender_type="CONTACT",
                    content=text_content,
                    created_at=datetime.utcnow()
                )
                db.add(chat_msg)
                db.commit()
                log_info("ZALO_BOT", f"Synced incoming Zalo message from {contact_name}: {text_content[:40]}...")

            return {"status": "success", "chat_id": chat_id, "chat_title": chat_title}

        except Exception as e:
            log_error("ZALO_BOT", f"Error processing webhook update: {e}")
            return {"status": "error", "detail": str(e)}
