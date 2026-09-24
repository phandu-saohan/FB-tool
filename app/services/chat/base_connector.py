from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class BaseChatConnector(ABC):
    """
    Abstract connector interface for messaging platforms.
    """
    def __init__(self, channel_config: Optional[Dict[str, Any]] = None):
        self.config = channel_config or {}

    @abstractmethod
    def send_message(self, recipient_id: str, content: str, media_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Sends an outbound message to a recipient.
        Returns:
            {"success": bool, "message_id": str, "error": Optional[str]}
        """
        pass

    @abstractmethod
    def parse_inbound_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts sender_id, sender_name, text, media_url, external_id from incoming webhook.
        Returns:
            {
                "sender_id": str,
                "sender_name": str,
                "content": str,
                "media_url": Optional[str],
                "external_id": str,
                "message_type": str
            }
        """
        pass
