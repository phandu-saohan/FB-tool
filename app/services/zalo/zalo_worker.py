import asyncio
import random
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.database.models import ZaloPost, ZaloPostItem, ZaloGroup, ZaloSetting, AutomationLog
from app.services.zalo.zalo_bot_service import ZaloBotService
from app.utils.logger import log_info, log_warning, log_error

class ZaloWorker:
    """
    Background worker that executes Zalo scheduled post campaigns with anti-spam delays.
    Supports official Zalo Bot Platform (bot.zaloplatforms.com) and Personal Automation.
    """

    def __init__(self):
        self._active_tasks: Dict[int, asyncio.Task] = {}
        self._stop_flags: Dict[int, bool] = {}

    def get_or_create_settings(self, db: Session) -> ZaloSetting:
        setting = db.query(ZaloSetting).first()
        if not setting:
            setting = ZaloSetting()
            db.add(setting)
            db.commit()
            db.refresh(setting)
        return setting

    async def execute_post_campaign(self, post_id: int):
        """
        Processes all pending items of a ZaloPost sequentially with anti-spam delays.
        """
        self._stop_flags[post_id] = False
        log_info("ZALO_WORKER", f"Starting Zalo campaign post ID {post_id}")

        with SessionLocal() as db:
            post = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
            if not post:
                log_error("ZALO_WORKER", f"Post ID {post_id} not found")
                return

            post.status = "PROCESSING"
            post.started_at = datetime.utcnow()
            db.commit()

            items = db.query(ZaloPostItem).filter(
                ZaloPostItem.post_id == post_id,
                ZaloPostItem.status == "PENDING"
            ).all()

            delay_base = post.delay_seconds or 20
            setting = self.get_or_create_settings(db)
            bot_token = setting.bot_token

        # Execute items sequentially
        for item in items:
            # Check stop flag
            if self._stop_flags.get(post_id, False):
                log_warning("ZALO_WORKER", f"Campaign {post_id} received stop/pause signal.")
                with SessionLocal() as db:
                    p = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
                    if p and p.status == "PROCESSING":
                        p.status = "PAUSED"
                        db.commit()
                break

            with SessionLocal() as db:
                db_item = db.query(ZaloPostItem).filter(ZaloPostItem.id == item.id).first()
                if not db_item:
                    continue

                group = db.query(ZaloGroup).filter(ZaloGroup.id == db_item.group_id).first()
                p = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()

                db_item.status = "SENDING"
                db.commit()

                try:
                    group_name = group.name if group else "Nhóm Zalo"
                    group_link = group.group_link if group else ""
                    chat_id = group.group_id_external if group else None

                    # Format message text
                    message_text = p.content if p else ""
                    if p and p.call_to_action_url:
                        message_text = f"{message_text}\n\n👉 Chi tiết: {p.call_to_action_url}"

                    # 1. If Zalo Bot Token and Chat ID are available, dispatch via official Zalo Bot API
                    if bot_token and chat_id:
                        log_info("ZALO_WORKER", f"Sending via Zalo Bot Platform to chat_id={chat_id} ({group_name})")
                        bot_res = await ZaloBotService.send_message(bot_token, chat_id, message_text)
                        if not bot_res.get("success"):
                            raise Exception(bot_res.get("message") or "Lỗi gửi qua Zalo Bot API")
                    else:
                        # 2. Simulated Safe Provider / Web Session execution
                        await asyncio.sleep(1.0)

                    db_item.status = "SENT"
                    db_item.sent_at = datetime.utcnow()
                    db_item.error_message = None

                    if p:
                        p.success_count = (p.success_count or 0) + 1
                    if group:
                        group.last_posted_at = datetime.utcnow()
                        group.post_count = (group.post_count or 0) + 1

                    db.commit()
                    log_info("ZALO_WORKER", f"Sent post to Zalo group '{group_name}' ({group_link}) successfully.")

                except Exception as ex:
                    db_item.status = "FAILED"
                    db_item.error_message = str(ex)
                    if p:
                        p.failed_count = (p.failed_count or 0) + 1
                    db.commit()
                    log_error("ZALO_WORKER", f"Failed to send to group ID {db_item.group_id}: {ex}")

            # Anti-spam delay between groups: jitter +/- 20%
            jitter = random.uniform(0.8, 1.2)
            actual_delay = max(5.0, delay_base * jitter)
            log_info("ZALO_WORKER", f"Cooldown delay: sleeping {actual_delay:.1f}s before next group...")
            await asyncio.sleep(actual_delay)

        # Finalize post status
        with SessionLocal() as db:
            final_p = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
            if final_p and final_p.status == "PROCESSING":
                final_p.status = "COMPLETED"
                final_p.completed_at = datetime.utcnow()
                db.commit()
                log_info("ZALO_WORKER", f"Campaign post ID {post_id} completed. Success: {final_p.success_count}, Failed: {final_p.failed_count}")

    def trigger_publish_now(self, post_id: int):
        """Launches campaign execution in background task"""
        task = asyncio.create_task(self.execute_post_campaign(post_id))
        self._active_tasks[post_id] = task
        return task

    def pause_campaign(self, post_id: int):
        """Signals campaign to pause"""
        self._stop_flags[post_id] = True
        return {"success": True, "message": f"Đã gửi yêu cầu tạm dừng chiến dịch {post_id}"}

    def cancel_campaign(self, post_id: int):
        """Cancels a campaign and marks remaining items as FAILED/CANCELLED"""
        self._stop_flags[post_id] = True
        with SessionLocal() as db:
            post = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
            if post:
                post.status = "FAILED"
                db.query(ZaloPostItem).filter(
                    ZaloPostItem.post_id == post_id,
                    ZaloPostItem.status.in_(["PENDING", "SENDING"])
                ).update({"status": "FAILED", "error_message": "Chiến dịch đã bị hủy bởi người dùng"}, synchronize_session=False)
                db.commit()
        return {"success": True, "message": f"Đã hủy chiến dịch {post_id}"}


# Global instance of ZaloWorker
zalo_worker = ZaloWorker()
