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
    def _find_setting_for_provider(session: Session, provider: str) -> Optional[EmailProviderSetting]:
        if provider.startswith("account_"):
            try:
                acc_id = int(provider.split("_")[1])
                return session.query(EmailProviderSetting).filter_by(id=acc_id).first()
            except (IndexError, ValueError):
                pass
        setting = session.query(EmailProviderSetting).filter_by(provider_name=provider).first()
        if not setting:
            setting = session.query(EmailProviderSetting).first()
        return setting

    @staticmethod
    def get_or_create_quota(session: Session, provider: str = "Hostinger", date_str: Optional[str] = None) -> EmailQuota:
        date_key = date_str or EmailQuotaManager.get_local_date_str()
        
        # Look up provider settings to get current daily limit
        setting = EmailQuotaManager._find_setting_for_provider(session, provider)
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
        setting = cls._find_setting_for_provider(session, provider)
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
        setting = cls._find_setting_for_provider(session, provider)
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

    @classmethod
    def get_account_quota_status(cls, session: Session, setting: EmailProviderSetting) -> Dict[str, Any]:
        """Returns today's quota status for a specific email sending configuration."""
        provider_key = f"account_{setting.id}"
        return cls.get_quota_status(session, provider=provider_key)

    @classmethod
    def get_aggregate_quota_status(cls, session: Session) -> Dict[str, Any]:
        """Aggregates quota across all active accounts for top-level dashboard and rotation monitoring."""
        date_str = cls.get_local_date_str()
        accounts = session.query(EmailProviderSetting).order_by(
            EmailProviderSetting.priority.asc(),
            EmailProviderSetting.id.asc()
        ).all()

        if not accounts:
            return cls.get_quota_status(session, "Hostinger")

        total_daily_limit = 0
        total_effective_limit = 0
        total_used = 0
        total_reserved = 0
        total_remaining = 0
        account_summaries = []

        active_count = 0
        active_sender_name = None

        for acc in accounts:
            q_status = cls.get_account_quota_status(session, acc)
            is_active_and_healthy = acc.is_active and not acc.is_paused

            if is_active_and_healthy:
                active_count += 1
                total_daily_limit += q_status["daily_limit"]
                total_effective_limit += q_status["effective_limit"]
                total_used += q_status["used_count"]
                total_reserved += q_status["reserved_count"]
                total_remaining += q_status["remaining_count"]

                if not q_status["is_exhausted"] and active_sender_name is None:
                    active_sender_name = acc.name or acc.from_email

            account_summaries.append({
                "id": acc.id,
                "name": acc.name,
                "priority": acc.priority,
                "is_active": acc.is_active,
                "is_paused": acc.is_paused,
                "from_email": acc.from_email,
                "from_name": acc.from_name,
                "daily_limit": q_status["daily_limit"],
                "effective_limit": q_status["effective_limit"],
                "used_count": q_status["used_count"],
                "reserved_count": q_status["reserved_count"],
                "remaining_count": q_status["remaining_count"],
                "percent_used": q_status["percent_used"],
                "is_exhausted": q_status["is_exhausted"]
            })

        percent_used = round((total_used / total_daily_limit) * 100, 1) if total_daily_limit > 0 else 0.0

        return {
            "date": date_str,
            "total_accounts": len(accounts),
            "active_accounts": active_count,
            "current_active_sender": active_sender_name or "Không có (Đã hết quota hoặc tạm dừng)",
            "daily_limit": total_daily_limit,
            "effective_limit": total_effective_limit,
            "used_count": total_used,
            "reserved_count": total_reserved,
            "remaining_count": total_remaining,
            "percent_used": percent_used,
            "is_exhausted": total_remaining <= 0,
            "resets_at": f"{date_str} 23:59:59 (+07:00)",
            "accounts_breakdown": account_summaries
        }
