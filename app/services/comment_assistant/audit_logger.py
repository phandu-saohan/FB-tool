from datetime import datetime
from typing import Optional
from app.database.database import SessionLocal
from app.database.models import AutomationLog, CommentLog
from app.utils.logger import log_info, log_error, log_warning, log_success

class CommentAuditLogger:
    """
    Centralized audit logger for all Comment Assistant operational events.
    Records audit trails for transparency and compliance.
    """

    VALID_ACTIONS = {
        "COMMENT_SUGGESTED",
        "COMMENT_APPROVED",
        "COMMENT_REJECTED",
        "COMMENT_SCHEDULED",
        "COMMENT_PUBLISHED",
        "COMMENT_FAILED",
        "AUTOMATION_ENABLED",
        "AUTOMATION_DISABLED",
        "EMERGENCY_STOP"
    }

    @classmethod
    def record(
        cls,
        action: str,
        message: str,
        level: str = "INFO",
        user_id: str = "system"
    ):
        """Logs an event into automation_logs for system-wide tracing"""
        if action in ["COMMENT_PUBLISHED", "COMMENT_APPROVED"]:
            log_success("COMMENT_AUDIT", f"[{action}] {message}")
        elif action in ["EMERGENCY_STOP", "COMMENT_FAILED"]:
            log_error("COMMENT_AUDIT", f"[{action}] {message}")
        elif action in ["COMMENT_REJECTED", "AUTOMATION_DISABLED"]:
            log_warning("COMMENT_AUDIT", f"[{action}] {message}")
        else:
            log_info("COMMENT_AUDIT", f"[{action}] {message}")

        try:
            with SessionLocal() as db:
                log_entry = AutomationLog(
                    level=level.upper(),
                    action=action,
                    message=f"[{user_id}] {message}",
                    created_at=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
        except Exception as e:
            log_error("COMMENT_AUDIT", f"Failed to persist audit log: {e}")
