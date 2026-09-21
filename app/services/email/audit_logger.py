import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.database.models import EmailAuditLog

class EmailAuditLogger:
    @staticmethod
    def log(
        session: Session,
        action: str,
        actor: str = "System",
        campaign_id: Optional[int] = None,
        recipient_id: Optional[int] = None,
        metadata: Optional[Any] = None
    ) -> EmailAuditLog:
        meta_str = None
        if metadata is not None:
            if isinstance(metadata, str):
                meta_str = metadata
            else:
                try:
                    meta_str = json.dumps(metadata)
                except Exception:
                    meta_str = str(metadata)

        entry = EmailAuditLog(
            actor=actor,
            action=action,
            campaign_id=campaign_id,
            recipient_id=recipient_id,
            metadata_json=meta_str
        )
        session.add(entry)
        session.commit()
        return entry
