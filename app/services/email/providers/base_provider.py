from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class EmailSendResult:
    def __init__(
        self,
        success: bool,
        message_id: Optional[str] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        is_temporary: bool = False
    ):
        self.success = success
        self.message_id = message_id
        self.error_code = error_code
        self.error_message = error_message
        self.is_temporary = is_temporary

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "message_id": self.message_id,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "is_temporary": self.is_temporary
        }


class EmailProvider(ABC):
    @abstractmethod
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
        """Sends an email and returns an EmailSendResult."""
        pass

    @abstractmethod
    async def verify_connection(self) -> bool:
        """Verifies SMTP/API connection health."""
        pass

    @abstractmethod
    def get_limits(self) -> Dict[str, Any]:
        """Returns standard limit parameters for the provider."""
        pass

    @abstractmethod
    def get_health(self) -> Dict[str, Any]:
        """Returns health status."""
        pass
