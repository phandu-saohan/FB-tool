from typing import Tuple
from sqlalchemy.orm import Session
from app.database.models import EmailProviderSetting, EmailAuditLog

class EmailCircuitBreaker:
    """
    Protects SMTP reputation by halting sending if consecutive errors or high error rates occur.
    """

    @classmethod
    def get_or_create_setting(cls, session: Session, provider: str = "Hostinger") -> EmailProviderSetting:
        setting = session.query(EmailProviderSetting).filter_by(provider_name=provider).first()
        if not setting:
            setting = EmailProviderSetting(provider_name=provider)
            session.add(setting)
            session.commit()
            session.refresh(setting)
        return setting

    @classmethod
    def is_tripped(cls, session: Session, provider: str = "Hostinger") -> Tuple[bool, str]:
        setting = cls.get_or_create_setting(session, provider)
        if setting.is_paused:
            return True, setting.pause_reason or "Provider is paused by Circuit Breaker / Admin"
        return False, "Circuit closed (Healthy)"

    @classmethod
    def record_success(cls, session: Session, provider: str = "Hostinger"):
        setting = cls.get_or_create_setting(session, provider)
        if setting.consecutive_failures > 0:
            setting.consecutive_failures = 0
            session.commit()

    @classmethod
    def record_failure(cls, session: Session, provider: str = "Hostinger", error_msg: str = ""):
        setting = cls.get_or_create_setting(session, provider)
        setting.consecutive_failures += 1
        
        # Check threshold
        threshold = setting.circuit_breaker_failures or 20
        if setting.consecutive_failures >= threshold:
            setting.is_paused = True
            reason = f"Circuit Breaker TRIPPED: {setting.consecutive_failures} consecutive failures. Last error: {error_msg[:200]}"
            setting.pause_reason = reason

            # Audit log
            log = EmailAuditLog(
                actor="CircuitBreaker",
                action="CIRCUIT_BREAKER_TRIPPED",
                metadata_json=reason
            )
            session.add(log)

        session.commit()

    @classmethod
    def reset(cls, session: Session, provider: str = "Hostinger"):
        setting = cls.get_or_create_setting(session, provider)
        setting.consecutive_failures = 0
        setting.is_paused = False
        setting.pause_reason = None
        session.commit()
