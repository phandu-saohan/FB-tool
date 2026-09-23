import re
import urllib.parse
from typing import Optional

# 1x1 transparent PNG raw bytes
TRANSPARENT_1PX_PNG = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00'
    b'\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)

from datetime import datetime
from sqlalchemy.orm import Session
from app.database.models import EmailCampaignRecipient

class EmailTrackingService:
    @staticmethod
    def get_1px_png() -> bytes:
        return TRANSPARENT_1PX_PNG

    @staticmethod
    def detect_device(user_agent: Optional[str]) -> str:
        if not user_agent:
            return "Desktop"
        ua = user_agent.lower()
        if any(keyword in ua for keyword in ["ipad", "tablet", "kindle"]):
            return "Tablet"
        elif any(keyword in ua for keyword in ["mobile", "android", "iphone", "ipod", "blackberry", "windows phone"]):
            return "Mobile"
        return "Desktop"

    @classmethod
    def record_open(
        cls,
        session: Session,
        recipient_id: int,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Records an email open event in database"""
        recipient = session.query(EmailCampaignRecipient).filter_by(id=recipient_id).first()
        if not recipient:
            return False

        now = datetime.utcnow()
        if not recipient.opened_at:
            recipient.opened_at = now
        recipient.open_count = (recipient.open_count or 0) + 1

        if ip:
            recipient.last_ip = ip[:45]
        if user_agent:
            recipient.device_type = cls.detect_device(user_agent)

        session.commit()
        return True

    @classmethod
    def record_click(
        cls,
        session: Session,
        recipient_id: int,
        target_url: str,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> str:
        """Records a link click event and returns target URL"""
        recipient = session.query(EmailCampaignRecipient).filter_by(id=recipient_id).first()
        if recipient:
            now = datetime.utcnow()
            if not recipient.clicked_at:
                recipient.clicked_at = now
            recipient.click_count = (recipient.click_count or 0) + 1

            # A click implies the recipient also opened the email
            if not recipient.opened_at:
                recipient.opened_at = now
            if not recipient.open_count:
                recipient.open_count = 1

            if ip:
                recipient.last_ip = ip[:45]
            if user_agent:
                recipient.device_type = cls.detect_device(user_agent)

            session.commit()

        # Validate and return safe destination URL
        clean_url = (target_url or "").strip()
        if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
            return "https://aesthetichub.vn"
        return clean_url

    @classmethod
    def inject_tracking(cls, html_content: str, base_url: str, recipient_id: int) -> str:
        """
        Rewrites all outgoing hyperlinks to route through click tracking redirector,
        and appends a hidden 1x1 tracking pixel to track email opens.
        """
        if not html_content:
            return html_content

        clean_base_url = (base_url or "").rstrip("/")
        if not clean_base_url:
            return html_content

        # 1. Rewrite <a href="..."> links
        def rewrite_link(match):
            prefix = match.group(1) # e.g. <a href="
            original_url = match.group(2).strip()
            suffix = match.group(3) # e.g. " class="..."

            # Skip anchors, mailto, tel, javascript, or already tracked URLs
            if (
                original_url.startswith("#") or
                original_url.startswith("mailto:") or
                original_url.startswith("tel:") or
                original_url.startswith("javascript:") or
                "/api/email/track/" in original_url
            ):
                return match.group(0)

            encoded_target = urllib.parse.quote(original_url, safe="")
            tracked_url = f"{clean_base_url}/api/email/track/click/{recipient_id}?url={encoded_target}"
            return f'{prefix}{tracked_url}{suffix}'

        link_regex = re.compile(r'(<a\s+[^>]*?href=["\'])([^"\']+)(["\'][^>]*>)', re.IGNORECASE)
        tracked_html = link_regex.sub(rewrite_link, html_content)

        # 2. Append 1x1 transparent tracking pixel
        pixel_url = f"{clean_base_url}/api/email/track/open/{recipient_id}.png"
        pixel_tag = (
            f'\n<!-- Email Open Tracking Pixel -->'
            f'\n<img src="{pixel_url}" width="1" height="1" border="0" '
            f'style="display:none !important;width:1px !important;height:1px !important;'
            f'max-height:0 !important;max-width:0 !important;opacity:0 !important;overflow:hidden !important;" '
            f'alt="" />'
        )

        if "</body>" in tracked_html.lower():
            body_close_pattern = re.compile(r'</body>', re.IGNORECASE)
            tracked_html = body_close_pattern.sub(f'{pixel_tag}\n</body>', tracked_html, count=1)
        else:
            tracked_html += pixel_tag

        return tracked_html
