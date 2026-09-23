import json
import re
import asyncio
from typing import Dict, Any, List, Optional
from app.config import settings
from app.ai.gemini import GeminiProvider
from app.ai.openai import OpenAIProvider
from app.utils.logger import log_info, log_error, log_warning

SYSTEM_EMAIL_PROMPT = """Bạn là một chuyên gia Email Marketing & Copywriter B2B/B2C hàng đầu.
Nhiệm vụ của bạn là tạo chiến dịch email chuyên nghiệp, tối ưu tỷ lệ mở (Open Rate > 45%) và tỷ lệ click (CTR > 15%), tuân thủ chuẩn Responsive Email và tránh bị bộ lọc spam của Gmail/Outlook đánh dấu thư rác.

Khi được cung cấp chủ đề và đối tượng, bạn BẮT BUỘC phải trả về duy nhất một đối tượng JSON hợp lệ (không kèm giải thích bên ngoài) theo cấu trúc:
{
  "subject_variants": [
    "Tiêu đề 1 (Giật tít tò mò, có emoji và biến {{name}})...",
    "Tiêu đề 2 (Trực diện, lợi ích giá trị cho {{name}})...",
    "Tiêu đề 3 (Gợi tính cấp bách / lời mời VIP)..."
  ],
  "preview_text": "Đoạn văn ngắn 40-70 ký tự hiển thị xem trước trong hộp thư đến...",
  "content_html": "<div style=\\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;\\">...Toàn bộ mã HTML Email đẹp mắt, sang trọng, có card bố cục, danh sách điểm nổi bật, và nút bấm CTA...</div>",
  "content_plain": "Phiên bản văn bản thuần (plain text) tương ứng..."
}
"""

def _get_provider():
    provider_name = (settings.AI_PROVIDER or 'gemini').lower()
    if provider_name == 'gemini':
        return GeminiProvider()
    elif provider_name == 'openrouter':
        return OpenAIProvider(is_openrouter=True)
    elif provider_name == 'openai':
        return OpenAIProvider(is_openrouter=False)
    return GeminiProvider()

def _fallback_email_template(
    topic: str,
    audience: str,
    tone: str,
    cta_text: str,
    cta_url: str
) -> Dict[str, Any]:
    safe_cta_text = cta_text or "Đăng Ký Tham Dự Ngay"
    safe_cta_url = cta_url or "https://aesthetichub.vn/register"

    subjects = [
        f"🌟 [Thư Mời VIP] Trân trọng kính mời {{name}} tham dự: {topic}",
        f"Kính gửi {{name}}: Cơ hội tiếp cận giải pháp đột phá về {topic}",
        f"⚡ Giữ chỗ ưu tiên dành riêng cho {{name}} - {topic}"
    ]

    preview = f"Lời mời chính thức và thông tin chi tiết về {topic} dành riêng cho Quý khách."

    html = f"""<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">THƯ MỜI CHUYÊN BIỆT</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Chương trình đặc quyền dành cho {audience}</p>
  </div>
  <div style="padding: 32px 24px; color: #334155; line-height: 1.7; font-size: 15px;">
    <p style="margin-top: 0;">Kính gửi <strong>{{name}}</strong>,</p>
    <p>Ban tổ chức trân trọng gửi tới Quý khách lời chào trân trọng nhất. Chúng tôi hân hạnh giới thiệu chương trình chuyên sâu với chủ đề: <strong>{topic}</strong>.</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1e293b;">Nội dung nổi bật của chương trình:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 6px;">Cập nhật xu hướng và công nghệ thực chiến mới nhất trong năm 2026.</li>
        <li style="margin-bottom: 6px;">Giao lưu và kết nối trực tiếp cùng các chuyên gia đầu ngành.</li>
        <li>Bộ tài liệu và quà tặng đặc quyền dành riêng cho khách mời xác nhận sớm.</li>
      </ul>
    </div>

    <p style="margin-bottom: 28px;">Để đảm bảo chất lượng tiếp đón và giữ chỗ ưu tiên tốt nhất, kính mời Quý khách xác nhận thông tin trước thời hạn quy định.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{safe_cta_url}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">{safe_cta_text}</a>
    </div>

    <p style="margin-bottom: 0; font-size: 14px; color: #64748b;">Mọi thắc mắc cần hỗ trợ, Quý khách vui lòng phản hồi email này hoặc liên hệ hotline ban tổ chức.</p>
  </div>
  <div style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0 0 6px 0;">Email này được gửi đến <strong>{{email}}</strong>.</p>
    <p style="margin: 0;">Nếu Quý khách không có nhu cầu nhận thư, vui lòng bỏ qua hoặc bấm hủy đăng ký.</p>
  </div>
</div>"""

    plain = (
        f"Kính gửi {{name}},\n\n"
        f"Ban tổ chức trân trọng kính mời Quý khách tham dự chương trình: {topic}.\n\n"
        f"Dành riêng cho: {audience}.\n"
        f"Đăng ký xác nhận tham dự tại: {safe_cta_url}\n\n"
        f"Trân trọng cảm ơn Quý khách!"
    )

    return {
        "subject_variants": subjects,
        "preview_text": preview,
        "content_html": html,
        "content_plain": plain
    }

class EmailAIService:
    @classmethod
    async def generate_campaign(
        cls,
        topic: str,
        audience: str = "Bác sĩ, Chủ Spa & Khách hàng VIP",
        tone: str = "Chuyên nghiệp, sang trọng, thu hút",
        cta_text: str = "Đăng Ký Tham Dự Ngay",
        cta_url: str = "https://aesthetichub.vn/register",
        key_points: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uses Gemini LLM to generate high-converting email subject lines, preview text,
        and fully styled HTML email content.
        """
        if not settings.GEMINI_API_KEY and not settings.OPENAI_API_KEY:
            log_warning("AI", "GEMINI_API_KEY not configured. Using high-quality email template fallback.")
            return _fallback_email_template(topic, audience, tone, cta_text, cta_url)

        user_prompt = f"""Hãy thiết kế chiến dịch email với các thông số sau:
- Chủ đề chiến dịch: {topic}
- Đối tượng người nhận: {audience}
- Phong cách / Giọng văn (Tone): {tone}
- Lời kêu gọi hành động (CTA Text): {cta_text}
- Đường dẫn CTA (CTA URL): {cta_url}
- Các điểm nhấn nội dung quan trọng: {key_points or 'Tạo nội dung hấp dẫn, cập nhật xu hướng 2026, quà tặng đặc quyền'}

Yêu cầu định dạng:
1. 'subject_variants': Mảng gồm đúng 3 tiêu đề tiếng Việt xuất sắc, có emoji và biến cá nhân hóa {{name}}.
2. 'preview_text': Đoạn xem trước ngắn trong inbox.
3. 'content_html': HTML email hoàn chỉnh có CSS inline, responsive di động, màu sắc hài hòa và nút CTA nổi bật.
4. 'content_plain': Bản text thuần.

Hãy trả về duy nhất chuỗi JSON hợp lệ."""

        try:
            provider = _get_provider()
            raw_text = await provider.generate_text(user_prompt, system_prompt=SYSTEM_EMAIL_PROMPT)
            cleaned = re.sub(r'^```json\s*|\s*```$', '', raw_text.strip(), flags=re.MULTILINE)
            data = json.loads(cleaned)

            # Ensure all required keys exist
            if not data.get("subject_variants") or not isinstance(data.get("subject_variants"), list):
                data["subject_variants"] = [
                    f"🌟 [Thư Mời VIP] {topic} dành cho {{name}}",
                    f"Kính gửi {{name}}: Cập nhật chương trình {topic}",
                    f"Ưu đãi đặc quyền dành cho {{name}} - {topic}"
                ]
            if not data.get("content_html"):
                data["content_html"] = _fallback_email_template(topic, audience, tone, cta_text, cta_url)["content_html"]

            return data
        except Exception as e:
            log_warning("AI", f"Gemini Email Generation encountered error ({e}). Returning polished template fallback.")
            return _fallback_email_template(topic, audience, tone, cta_text, cta_url)
