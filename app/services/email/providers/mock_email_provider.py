import uuid
import asyncio
from typing import Dict, Any, Optional, List
from app.services.email.providers.base_provider import EmailProvider, EmailSendResult

class MockEmailProvider(EmailProvider):
    def __init__(
        self,
        daily_limit: int = 300,
        fail_mode: Optional[str] = None, # None, "temp_error_421", "perm_error_550", "timeout"
        fail_probability: float = 0.0
    ):
        self.daily_limit = daily_limit
        self.fail_mode = fail_mode
        self.fail_probability = fail_probability
        self.sent_emails: List[Dict[str, Any]] = []
        self.should_verify_succeed = True

    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> EmailSendResult:
        await asyncio.sleep(0.01) # Non-blocking mock async latency

        # Check explicit fail_mode
        if self.fail_mode == "temp_error_421":
            return EmailSendResult(
                success=False,
                error_code="421",
                error_message="4.4.2 Service not available, closing transmission channel",
                is_temporary=True
            )
        elif self.fail_mode == "perm_error_550":
            return EmailSendResult(
                success=False,
                error_code="550",
                error_message="5.1.1 User unknown / mailbox unavailable",
                is_temporary=False
            )
        elif self.fail_mode == "timeout":
            return EmailSendResult(
                success=False,
                error_code="CONNECTION_TIMEOUT",
                error_message="Connection timed out after 30s",
                is_temporary=True
            )

        # Check email address specific triggers for testing
        if "bounce" in to_email.lower() or "550" in to_email.lower():
            return EmailSendResult(
                success=False,
                error_code="550",
                error_message="5.1.1 Hard bounce simulated for " + to_email,
                is_temporary=False
            )
        if "temp" in to_email.lower() or "421" in to_email.lower():
            return EmailSendResult(
                success=False,
                error_code="421",
                error_message="4.2.1 Mailbox busy / temporary throttle simulated",
                is_temporary=True
            )

        message_id = f"mock_{uuid.uuid4().hex[:12]}@aesthetichub.vn"
        record = {
            "message_id": message_id,
            "to_email": to_email,
            "to_name": to_name,
            "subject": subject,
            "html_content": html_content,
            "from_email": from_email,
            "custom_headers": custom_headers or {}
        }
        self.sent_emails.append(record)

        return EmailSendResult(
            success=True,
            message_id=message_id
        )

    async def verify_connection(self) -> bool:
        return self.should_verify_succeed

    async def verify_connection_detailed(self) -> tuple[bool, str]:
        if self.should_verify_succeed:
            return True, "Kết nối Mock Email Provider (chế độ mô phỏng) thành công!"
        return False, "Mock Email Provider đang giả lập trạng thái lỗi kết nối."


    def get_limits(self) -> Dict[str, Any]:
        return {
            "provider": "MockEmailProvider",
            "daily_limit": self.daily_limit,
            "sent_count": len(self.sent_emails)
        }

    def get_health(self) -> Dict[str, Any]:
        return {
            "provider": "MockEmailProvider",
            "status": "HEALTHY" if self.should_verify_succeed else "DEGRADED",
            "total_sent_in_session": len(self.sent_emails)
        }
