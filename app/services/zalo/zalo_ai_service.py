import json
import re
from typing import Dict, Any, Optional
from app.ai.content_generator import get_provider
from app.utils.logger import log_info, log_warning

ZALO_POST_SYSTEM_PROMPT = """Bạn là chuyên gia truyền thông và xây dựng cộng đồng hàng đầu trên mạng xã hội Zalo.
Nhiệm vụ của bạn là soạn tin nhắn / bài đăng gửi vào các nhóm Zalo chuyên ngành (Bác sĩ, Y khoa, Thẩm mỹ, Spa, Clinic) với tiêu chí:
1. Độ dài vừa phải, súc tích (150 - 250 từ), dễ đọc trên màn hình điện thoại di động (Zalo mobile).
2. Có tiêu đề giật tít chuyên nghiệp, trang trọng, sử dụng emoji tinh tế.
3. Chia các gạch đầu dòng rõ ràng về quyền lợi, giá trị khoa học (CME, chuyển giao công nghệ, thị phạm lâm sàng).
4. Có lời kêu gọi hành động (CTA) thu hút và đường link đăng ký/thông tin rõ ràng.
5. Hashtags phù hợp ở cuối bài.

BẮT BUỘC trả về định dạng JSON thuần túy (không markdown block):
{
  "title": "Tiêu đề ngắn gọn...",
  "content": "Nội dung bài đăng Zalo với emoji và các ý chính...",
  "call_to_action": "Lời kêu gọi hành động...",
  "hashtags": "#HoiNghiThamMy #CME2026 #DaLieu",
  "full_message": "Toàn bộ bài viết hoàn chỉnh sẵn sàng gửi..."
}
"""

class ZaloAIService:
    """Generates engaging, medical/aesthetic community posts optimized for Zalo groups."""

    @classmethod
    async def generate_zalo_post(
        cls,
        topic: str,
        conference_name: str = "Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026",
        cta_url: str = "https://kbit2026.vercel.app",
        tone: str = "Friendly & Professional",
        target_audience: str = "Bác sĩ da liễu, chủ cơ sở Spa & Clinic"
    ) -> Dict[str, Any]:
        """
        Produces an optimized Zalo group post using Gemini 2.5 or deterministic template fallback.
        """
        try:
            provider = get_provider()
            prompt = (
                f"Chủ đề / Nội dung cốt lõi: {topic}\n"
                f"Tên hội nghị / Sự kiện: {conference_name}\n"
                f"Link đăng ký / Xem chi tiết: {cta_url}\n"
                f"Phong cách: {tone}\n"
                f"Đối tượng người đọc trong nhóm Zalo: {target_audience}\n"
            )
            if hasattr(provider, 'generate_text'):
                raw = await provider.generate_text(prompt, system_prompt=ZALO_POST_SYSTEM_PROMPT)
            elif hasattr(provider, 'generate'):
                raw = await provider.generate(f"{ZALO_POST_SYSTEM_PROMPT}\n\n{prompt}")
            else:
                raw = ""
            cleaned = re.sub(r'```json\s*|\s*```', '', raw).strip()
            data = json.loads(cleaned)


            if "full_message" not in data or not data["full_message"]:
                data["full_message"] = f"📢 {data.get('title', topic)}\n\n{data.get('content', '')}\n\n👉 {data.get('call_to_action', '')}: {cta_url}\n\n{data.get('hashtags', '')}"

            return data

        except Exception as e:
            log_warning("ZALO_AI", f"LLM generation failed or unavailable ({e}). Using specialized template fallback.")

        # Deterministic High-Quality Fallback
        headline = f"📢 THÔNG BÁO QUAN TRỌNG: {topic.upper()}"
        content = (
            f"Kính gửi Quý Bác sĩ, Quý Đồng nghiệp và các Chủ cơ sở làm đẹp,\n\n"
            f"Ban tổ chức trân trọng gửi tới Quý vị thông tin cập nhật về {conference_name}:\n\n"
            f"🔹 Cập nhật các xu hướng lâm sàng & công nghệ thẩm mỹ tân tiến nhất 2026.\n"
            f"🔹 Phiên thị phạm thực chiến trực tiếp từ chuyên gia đầu ngành trong và ngoài nước.\n"
            f"🔹 Cơ hội nhận chứng chỉ đào tạo y khoa liên tục (CME) và kết nối giao thương B2B."
        )
        cta = "Đăng ký giữ chỗ tham dự và nhận tài liệu độc quyền tại"
        hashtags = f"#ZaloCommunity #{re.sub(r'\\s+', '', topic)} #ThamMy2026 #CME"
        full = f"{headline}\n\n{content}\n\n👉 {cta}: {cta_url}\n\n{hashtags}"

        return {
            "title": headline,
            "content": content,
            "call_to_action": cta,
            "hashtags": hashtags,
            "full_message": full
        }
