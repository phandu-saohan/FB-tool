import random
from datetime import datetime, timezone, timedelta
from typing import Tuple
from sqlalchemy.orm import Session
from app.database.models import EmailCampaignRecipient

class EmailRateLimiter:
    """
    Manages sending windows, randomized delays (jitter), and hourly throughput limits.
    Ensures natural-looking email traffic that avoids spam filters.
    """

    @staticmethod
    def get_local_time(tz_offset_hours: int = 7) -> datetime:
        utc_now = datetime.now(timezone.utc)
        return utc_now + timedelta(hours=tz_offset_hours)

    @classmethod
    def is_in_sending_window(
        cls,
        window_start: str = "08:00",
        window_end: str = "18:00",
        tz_offset_hours: int = 7
    ) -> Tuple[bool, str]:
        """
        Checks if current local time is within the allowed sending window (e.g. 08:00 - 18:00).
        Returns (is_allowed, reason).
        """
        local_now = cls.get_local_time(tz_offset_hours)
        current_time_str = local_now.strftime("%H:%M")

        if window_start <= current_time_str <= window_end:
            return True, f"In window: {current_time_str} is between {window_start} and {window_end}"
        else:
            return False, f"Outside window: {current_time_str} is outside {window_start} - {window_end}"

    @staticmethod
    def get_jitter_delay(min_delay: int = 15, max_delay: int = 45) -> float:
        """
        Returns a random jittered delay in seconds between min_delay and max_delay.
        """
        if min_delay >= max_delay:
            return float(min_delay)
        return round(random.uniform(float(min_delay), float(max_delay)), 2)

    @classmethod
    def check_hourly_limit(
        cls,
        session: Session,
        hourly_limit: int = 30
    ) -> Tuple[bool, int]:
        """
        Counts emails sent in the last 60 minutes.
        Returns (has_capacity, current_hourly_count).
        """
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        count = session.query(EmailCampaignRecipient).filter(
            EmailCampaignRecipient.status == 'SENT',
            EmailCampaignRecipient.sent_at >= one_hour_ago
        ).count()

        has_capacity = count < hourly_limit
        return has_capacity, count
