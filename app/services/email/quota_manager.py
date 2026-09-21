from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import EmailQuota, EmailProviderSetting

class EmailQuotaManager:
    """
    Manages daily email sending quotas with safety margins and atomic reservations.
    Prevents account bans by never exceeding effective daily limits.
    """

    @staticmethod
    def get_local_date_str(tz_name: str = "Asia/Ho_Chi_Minh") -> str:
        """Returns the current date string (YYYY-MM-DD) in the specified timezone (UTC+7 for Vietnam)."""
        # UTC+7 offset calculation
        utc_now = datetime.now(timezone.utc)
        vn_time = utc_now + timedelta(hours=7)
        return vn_time.strftime("%Y-%m-%d")

    @staticmethod
    def get_or_create_quota(session: Session, provider: str = "Hostinger", date_str: Optional[str] = None) -> EmailQuota:
        date_key = date_str or EmailQuotaManager.get_local_date_str()
        
        # Look up provider settings to get current daily limit
        setting = session.query(EmailProviderSetting).filter_by(provider_name=provider).first()
        configured_limit = setting.daily_limit if setting else 300

        quota = session.query(EmailQuota).filter_by(provider=provider, date=date_key).first()
        if not quota:
            quota = EmailQuota(
                provider=provider,
                date=date_key,
                daily_limit=configured_limit,
                used_count=0,
                remaining_count=configured_limit,
                reserved_count=0
            )
            session.add(quota)
            session.commit()
            session.refresh(quota)
        return quota

    @staticmethod
    def get_effective_limit(daily_limit: int, safety_margin_pct: float = 10.0) -> int:
        """Calculates effective send limit taking safety margin (5-20%) into account."""
        margin_factor = max(0.0, min(0.5, safety_margin_pct / 100.0))
        return int(daily_limit * (1.0 - margin_factor))

    @classmethod
    def reserve_quota(cls, session: Session, provider: str = "Hostinger", count: int = 1) -> bool:
        """
        Atomically checks and reserves quota for batch sending.
        Returns True if reservation succeeded, False if limit is reached.
        """
        setting = session.query(EmailProviderSetting).filter_by(provider_name=provider).first()
        safety_margin = setting.safety_margin_pct if setting else 10.0
        configured_limit = setting.daily_limit if setting else 300
        effective_limit = cls.get_effective_limit(configured_limit, safety_margin)

        quota = cls.get_or_create_quota(session, provider)

        # Check if adding count exceeds effective limit
        if quota.used_count + quota.reserved_count + count > effective_limit:
            return False

        quota.reserved_count += count
        session.commit()
        return True

    @classmethod
    def commit_quota(cls, session: Session, provider: str = "Hostinger", count: int = 1):
        """Called after an email is successfully sent to permanently consume reserved quota."""
        quota = cls.get_or_create_quota(session, provider)
        quota.reserved_count = max(0, quota.reserved_count - count)
        quota.used_count += count
        quota.remaining_count = max(0, quota.daily_limit - quota.used_count)
        session.commit()

    @classmethod
    def release_quota(cls, session: Session, provider: str = "Hostinger", count: int = 1):
        """Called if a send job is skipped or aborted without consuming quota."""
        quota = cls.get_or_create_quota(session, provider)
        quota.reserved_count = max(0, quota.reserved_count - count)
        session.commit()

    @classmethod
    def get_quota_status(cls, session: Session, provider: str = "Hostinger") -> Dict[str, Any]:
        setting = session.query(EmailProviderSetting).filter_by(provider_name=provider).first()
        safety_margin = setting.safety_margin_pct if setting else 10.0
        daily_limit = setting.daily_limit if setting else 300
        effective_limit = cls.get_effective_limit(daily_limit, safety_margin)

        date_str = cls.get_local_date_str()
        quota = cls.get_or_create_quota(session, provider, date_str)

        used = quota.used_count
        reserved = quota.reserved_count
        remaining = max(0, effective_limit - used - reserved)
        percent_used = round((used / daily_limit) * 100, 1) if daily_limit > 0 else 0.0

        return {
            "provider": provider,
            "date": date_str,
            "daily_limit": daily_limit,
            "safety_margin_pct": safety_margin,
            "effective_limit": effective_limit,
            "used_count": used,
            "reserved_count": reserved,
            "remaining_count": remaining,
            "percent_used": percent_used,
            "is_exhausted": remaining <= 0,
            "resets_at": f"{date_str} 23:59:59 (+07:00)"
        }
