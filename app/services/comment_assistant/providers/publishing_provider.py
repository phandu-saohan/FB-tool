from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import uuid
from datetime import datetime

class CommentPublishingProvider(ABC):
    """
    Abstract interface for publishing approved comments through officially permitted channels.
    Strictly ethical outreach: Zero browser automation, zero cookie scraping.
    """

    @abstractmethod
    async def validate_target(self, group_id: str, post_id: str) -> Dict[str, Any]:
        """Validates if the target post and group are active and commentable"""
        pass

    @abstractmethod
    async def publish_comment(
        self,
        post_id: str,
        comment_text: str,
        disclosure: str = ""
    ) -> Dict[str, Any]:
        """Publishes an approved comment to the designated post"""
        pass

    @abstractmethod
    async def get_comment_status(self, external_comment_id: str) -> Dict[str, Any]:
        """Checks status of an existing comment"""
        pass

    @abstractmethod
    async def delete_comment(self, external_comment_id: str) -> Dict[str, Any]:
        """Removes a previously published comment if needed"""
        pass


class MockCommentPublishingProvider(CommentPublishingProvider):
    """
    Mock Publishing Provider for Development and Demo Mode.
    Simulates successful, verifiable publishing without touching live Facebook accounts.
    """

    def __init__(self):
        self.published_store: Dict[str, Dict[str, Any]] = {}

    async def validate_target(self, group_id: str, post_id: str) -> Dict[str, Any]:
        return {
            "valid": True,
            "group_id": group_id,
            "post_id": post_id,
            "provider": "MockCommentPublishingProvider",
            "message": "Target community post validated and reachable."
        }

    async def publish_comment(
        self,
        post_id: str,
        comment_text: str,
        disclosure: str = ""
    ) -> Dict[str, Any]:
        comment_id = f"mock_comment_{uuid.uuid4().hex[:10]}"
        final_text = f"{comment_text}\n\n[{disclosure}]" if disclosure and disclosure.strip() else comment_text
        external_url = f"https://facebook.com/{post_id}?comment_id={comment_id}"

        record = {
            "comment_id": comment_id,
            "post_id": post_id,
            "text": final_text,
            "url": external_url,
            "published_at": datetime.utcnow().isoformat(),
            "status": "PUBLISHED"
        }
        self.published_store[comment_id] = record

        return {
            "success": True,
            "external_comment_id": comment_id,
            "external_comment_url": external_url,
            "provider": "MockCommentPublishingProvider",
            "published_at": record["published_at"],
            "message": "Bình luận đã được đăng thành công qua Mock Provider (Chế độ Demo)."
        }

    async def get_comment_status(self, external_comment_id: str) -> Dict[str, Any]:
        if external_comment_id in self.published_store:
            return {
                "exists": True,
                "status": "ACTIVE",
                "details": self.published_store[external_comment_id]
            }
        return {
            "exists": False,
            "status": "NOT_FOUND"
        }

    async def delete_comment(self, external_comment_id: str) -> Dict[str, Any]:
        if external_comment_id in self.published_store:
            del self.published_store[external_comment_id]
            return {
                "success": True,
                "message": "Bình luận đã được xóa khỏi hệ thống mô phỏng."
            }
        return {
            "success": False,
            "message": "Không tìm thấy bình luận cần xóa."
        }


class MetaCommentPublishingProvider(CommentPublishingProvider):
    """
    Official Meta Graph API Comment Publishing Provider.
    Only implements operations strictly authorized by Meta permissions (e.g. pages_manage_posts).
    If permissions are absent, strictly returns FEATURE_NOT_AVAILABLE.
    """

    def __init__(self, page_access_token: Optional[str] = None):
        self.page_access_token = page_access_token

    async def validate_target(self, group_id: str, post_id: str) -> Dict[str, Any]:
        if not self.page_access_token:
            return {
                "valid": False,
                "status": "FEATURE_NOT_AVAILABLE",
                "message": "Yêu cầu Meta Page/User Access Token có quyền hợp lệ để xuất bản bình luận."
            }
        return {"valid": False, "status": "FEATURE_NOT_AVAILABLE", "message": "Graph API integration configured."}

    async def publish_comment(
        self,
        post_id: str,
        comment_text: str,
        disclosure: str = ""
    ) -> Dict[str, Any]:
        if not self.page_access_token:
            return {
                "success": False,
                "error_code": "FEATURE_NOT_AVAILABLE",
                "message": "Meta Graph API chưa được cấp quyền (permissions). Hệ thống tuân thủ nghiêm ngặt chính sách của Meta và không can thiệp trái phép."
            }
        return {
            "success": False,
            "error_code": "FEATURE_NOT_AVAILABLE",
            "message": "Cần cấu hình Meta App đã được xét duyệt quyền hợp lệ."
        }

    async def get_comment_status(self, external_comment_id: str) -> Dict[str, Any]:
        return {"status": "FEATURE_NOT_AVAILABLE"}

    async def delete_comment(self, external_comment_id: str) -> Dict[str, Any]:
        return {"status": "FEATURE_NOT_AVAILABLE"}
