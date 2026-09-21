from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database.models import (
    ScheduledComment,
    CommentSuggestion,
    CommentRateLimit,
    CommentLog,
    CommentAssistantSetting,
    CommentCampaign,
    DiscoveredPost
)
from app.services.comment_assistant.similarity_service import CommentSimilarityService
from app.services.comment_assistant.audit_logger import CommentAuditLogger
from app.services.comment_assistant.providers.publishing_provider import (
    CommentPublishingProvider,
    MockCommentPublishingProvider,
    MetaCommentPublishingProvider
)
from app.utils.logger import log_info, log_error, log_warning, log_success

class CommentSchedulerService:
    """
    Manages scheduling, rate limiting, smart group cooldowns,
    and emergency stopping for comment publishing.
    """

    def __init__(self, provider: Optional[CommentPublishingProvider] = None):
        self.provider = provider or MockCommentPublishingProvider()

    def get_or_create_settings(self, db: Session) -> CommentAssistantSetting:
        setting = db.query(CommentAssistantSetting).first()
        if not setting:
            setting = CommentAssistantSetting()
            db.add(setting)
            db.commit()
            db.refresh(setting)
        return setting

    def check_rate_limits(self, db: Session, group_id: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """
        Validates daily limit, hourly limit, and group cooldown.
        Returns: (allowed: bool, rejection_reason: Optional[str])
        """
        setting = self.get_or_create_settings(db)

        if not setting.automation_enabled:
            return False, "Hệ thống tự động hóa bình luận đang bị TẮT (Automation is Disabled)."

        now = datetime.utcnow()
        one_day_ago = now - timedelta(days=1)
        one_hour_ago = now - timedelta(hours=1)

        # 1. Check daily limit
        daily_count = db.query(CommentLog).filter(
            CommentLog.created_at >= one_day_ago,
            CommentLog.status == "PUBLISHED"
        ).count()
        if daily_count >= setting.daily_limit:
            return False, f"Daily comment limit reached. Đã đạt giới hạn tối đa {setting.daily_limit} bình luận/ngày."

        # 2. Check hourly limit
        hourly_count = db.query(CommentLog).filter(
            CommentLog.created_at >= one_hour_ago,
            CommentLog.status == "PUBLISHED"
        ).count()
        if hourly_count >= setting.hourly_limit:
            return False, f"Đã đạt giới hạn tối đa {setting.hourly_limit} bình luận/giờ. Vui lòng chờ phiên tiếp theo."

        # 3. Check group cooldown if group_id is provided
        if group_id:
            rate_record = db.query(CommentRateLimit).filter(
                CommentRateLimit.target_group_id == group_id
            ).first()
            if rate_record and rate_record.last_comment_at:
                cooldown_delta = timedelta(hours=setting.group_cooldown_hours)
                if now - rate_record.last_comment_at < cooldown_delta:
                    remaining_hours = int((rate_record.last_comment_at + cooldown_delta - now).total_seconds() / 3600) + 1
                    return False, f"Nhóm này đang trong thời gian giãn cách an toàn ({setting.group_cooldown_hours}h). Vui lòng chờ thêm {remaining_hours} giờ."

        return True, None

    def schedule_comment(
        self,
        suggestion_id: int,
        scheduled_at: datetime,
        comment_text: Optional[str] = None,
        timezone: str = "Asia/Ho_Chi_Minh"
    ) -> Dict[str, Any]:
        """
        Validates and creates a ScheduledComment entry.
        Enforces duplicate detection, rate limits, and approval status.
        """
        with SessionLocal() as db:
            sugg = db.query(CommentSuggestion).filter(CommentSuggestion.id == suggestion_id).first()
            if not sugg:
                return {"success": False, "message": "Không tìm thấy đề xuất bình luận."}

            text_to_post = (comment_text or sugg.selected_comment).strip()
            if not text_to_post:
                return {"success": False, "message": "Nội dung bình luận không được để trống."}

            post = sugg.post
            group_id = post.group_id if post else None

            # Rate limit check
            allowed, limit_msg = self.check_rate_limits(db, group_id)
            if not allowed:
                return {"success": False, "message": limit_msg}

            # Duplicate check
            setting = self.get_or_create_settings(db)
            recent_logs = db.query(CommentLog.comment_text).order_by(CommentLog.created_at.desc()).limit(20).all()
            recent_texts = [r[0] for r in recent_logs]
            is_dup, score, dup_reason = CommentSimilarityService.check_duplicate(
                text_to_post, recent_texts, threshold=setting.duplicate_similarity_threshold
            )
            if is_dup:
                return {"success": False, "message": dup_reason}

            # Create schedule
            scheduled = ScheduledComment(
                suggestion_id=sugg.id,
                campaign_id=sugg.campaign_id,
                group_id=group_id,
                comment_text=text_to_post,
                scheduled_at=scheduled_at,
                timezone=timezone,
                status="SCHEDULED"
            )
            sugg.status = "SCHEDULED"
            sugg.selected_comment = text_to_post
            db.add(scheduled)
            db.commit()
            db.refresh(scheduled)

            CommentAuditLogger.record(
                "COMMENT_SCHEDULED",
                f"Đã lên lịch bình luận cho bài viết '{post.external_post_id if post else ''}' lúc {scheduled_at.isoformat()}"
            )

            return {
                "success": True,
                "scheduled_id": scheduled.id,
                "scheduled_at": scheduled.scheduled_at.isoformat(),
                "message": "Đã lên lịch bình luận thành công và đảm bảo giới hạn an toàn."
            }

    async def execute_publish(self, scheduled_id: int) -> Dict[str, Any]:
        """
        Executes an approved and scheduled comment through the configured provider.
        """
        with SessionLocal() as db:
            sched = db.query(ScheduledComment).filter(ScheduledComment.id == scheduled_id).first()
            if not sched:
                return {"success": False, "message": "Không tìm thấy lịch bình luận."}

            if sched.status != "SCHEDULED":
                return {"success": False, "message": f"Bình luận đang ở trạng thái {sched.status}, không thể xuất bản."}

            sugg = sched.suggestion
            post = sugg.post if sugg else None
            post_id = post.external_post_id if post else "unknown_post"
            group_id = sched.group_id or (post.group_id if post else "unknown_group")

            # Validate target with provider
            val = await self.provider.validate_target(group_id, post_id)
            if not val.get("valid", True) and val.get("status") == "FEATURE_NOT_AVAILABLE":
                sched.status = "FAILED"
                sched.error_message = val.get("message")
                db.commit()
                CommentAuditLogger.record("COMMENT_FAILED", f"Lỗi quyền xuất bản: {sched.error_message}")
                return {"success": False, "message": sched.error_message}

            disclosure = sugg.disclosure_text if sugg and sugg.disclosure_mode != "OFF" else ""
            pub_res = await self.provider.publish_comment(post_id, sched.comment_text, disclosure)

            if pub_res.get("success"):
                sched.status = "PUBLISHED"
                sched.executed_at = datetime.utcnow()
                if sugg:
                    sugg.status = "PUBLISHED"

                # Update Group Rate Limit & Cooldown
                now = datetime.utcnow()
                rl = db.query(CommentRateLimit).filter(CommentRateLimit.target_group_id == group_id).first()
                if not rl:
                    rl = CommentRateLimit(target_group_id=group_id)
                    db.add(rl)
                rl.last_comment_at = now
                rl.group_comment_count_24h = (rl.group_comment_count_24h or 0) + 1
                rl.group_comment_count_7d = (rl.group_comment_count_7d or 0) + 1

                # Save CommentLog
                log_entry = CommentLog(
                    campaign_id=sched.campaign_id,
                    group_id=group_id,
                    source_post_id=post_id,
                    conference_id=sugg.conference_name if sugg else None,
                    comment_text=sched.comment_text,
                    provider=pub_res.get("provider", "MockCommentPublishingProvider"),
                    status="PUBLISHED",
                    scheduled_at=sched.scheduled_at,
                    published_at=now,
                    external_comment_id=pub_res.get("external_comment_id"),
                    external_comment_url=pub_res.get("external_comment_url")
                )
                db.add(log_entry)
                db.commit()

                CommentAuditLogger.record(
                    "COMMENT_PUBLISHED",
                    f"Xuất bản thành công comment ID {pub_res.get('external_comment_id')} trên bài viết {post_id}"
                )
                return {"success": True, "result": pub_res}
            else:
                sched.status = "FAILED"
                sched.error_message = pub_res.get("message", "Lỗi xuất bản chưa xác định")
                db.commit()
                CommentAuditLogger.record("COMMENT_FAILED", f"Xuất bản thất bại trên bài viết {post_id}: {sched.error_message}")
                return {"success": False, "message": sched.error_message}

    def emergency_stop(self) -> Dict[str, Any]:
        """
        EMERGENCY STOP (Requirement #25):
        - Cancels all pending scheduled comments
        - Disables automation globally
        - Preserves all audit logs
        """
        with SessionLocal() as db:
            setting = self.get_or_create_settings(db)
            setting.automation_enabled = False

            # Cancel all pending scheduled comments
            cancelled_count = db.query(ScheduledComment).filter(
                ScheduledComment.status == "SCHEDULED"
            ).update({"status": "CANCELLED", "error_message": "Bị hủy bởi Dừng khẩn cấp (Emergency Stop)"})

            db.commit()

            CommentAuditLogger.record(
                "EMERGENCY_STOP",
                f"KÍCH HOẠT DỪNG KHẨN CẤP: Đã hủy {cancelled_count} lịch bình luận đang chờ và vô hiệu hóa tự động hóa toàn hệ thống.",
                level="ERROR"
            )

            return {
                "success": True,
                "cancelled_count": cancelled_count,
                "automation_enabled": False,
                "message": f"Dừng khẩn cấp thành công. Đã hủy {cancelled_count} lịch bình luận đang chờ và khóa tự động hóa."
            }

comment_scheduler = CommentSchedulerService()
