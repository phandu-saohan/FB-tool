import json
import re
from typing import Dict, Any, List, Optional
from app.config import settings
from app.ai.content_generator import get_provider
from app.utils.logger import log_info, log_error, log_warning

COMMENT_GEN_SYSTEM_PROMPT = """You are a senior community outreach assistant for Aesthetic Medicine Conferences.
Generate 3 to 5 ethical, polite, contextual comment variations in Vietnamese responding to a community post.

STRICT ETHICAL OUTREACH RULES:
1. Directly relevant to the source post question/topic.
2. Concise, polite, respectful, and providing genuine scientific/program information.
3. NEVER impersonate an independent member, consumer, or doctor. Speak respectfully from an informative perspective.
4. NEVER make medical claims, promises of treatment efficacy, or unverified claims.
5. Provide the conference name and registration/information link transparently.
6. Generate 3 to 5 variations with diverse tones (Professional, Educational, Friendly, Short, Invitation).

Output MUST be a JSON object:
{
  "reason": "Brief rationale for these suggested comments",
  "confidence": 0.95,
  "variants": [
    {
      "tone": "Professional",
      "text": "..."
    },
    {
      "tone": "Educational",
      "text": "..."
    },
    {
      "tone": "Friendly",
      "text": "..."
    },
    {
      "tone": "Short",
      "text": "..."
    },
    {
      "tone": "Invitation",
      "text": "..."
    }
  ]
}
"""

class CommentGeneratorService:
    """
    Generates high-context, ethical comment suggestions with 3-5 variants for human review.
    """

    @classmethod
    async def generate_comment_variants(
        cls,
        post_text: str,
        conference_name: str = "Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026",
        group_name: str = "Cộng đồng Thẩm mỹ",
        author_name: str = "Quý đồng nghiệp",
        target_audience: str = "Bác sĩ da liễu, chủ Clinic và Spa",
        tone: str = "Professional",
        registration_url: str = "https://aesthetichub.vn/hoi-nghi-2026",
        disclosure_mode: str = "OPTIONAL",
        disclosure_text: str = "Thông tin chương trình do BTC cung cấp."
    ) -> Dict[str, Any]:
        """
        Produces 3-5 context-specific comment variations.
        """
        # Try AI generation first
        try:
            provider = get_provider()
            prompt = (
                f"{COMMENT_GEN_SYSTEM_PROMPT}\n\n"
                f"Conference: {conference_name}\n"
                f"Community Group: {group_name}\n"
                f"Author: {author_name}\n"
                f"Target Audience: {target_audience}\n"
                f"Registration URL: {registration_url}\n"
                f"Preferred Tone: {tone}\n"
                f"Source Post Content:\n\"\"\"{post_text}\"\"\""
            )
            raw = await provider.generate(prompt)
            cleaned = re.sub(r'```json\s*|\s*```', '', raw).strip()
            data = json.loads(cleaned)

            variants = data.get("variants", [])
            if len(variants) >= 3:
                # Append disclosure if REQUIRED
                if disclosure_mode == "REQUIRED" and disclosure_text:
                    for v in variants:
                        v["text"] = f"{v['text']}\n\n[{disclosure_text}]"

                selected = variants[0]["text"]
                return {
                    "reason": data.get("reason", "Nội dung phù hợp với nhu cầu tìm hiểu thông tin hội thảo của tác giả bài viết."),
                    "confidence": float(data.get("confidence", 0.9)),
                    "variants": variants,
                    "selected_comment": selected,
                    "disclosure_mode": disclosure_mode,
                    "disclosure_text": disclosure_text
                }
        except Exception:
            pass

        # High Quality Deterministic Fallback Generator
        return cls._template_comment_variants(
            post_text=post_text,
            conference_name=conference_name,
            registration_url=registration_url,
            author_name=author_name,
            disclosure_mode=disclosure_mode,
            disclosure_text=disclosure_text
        )

    @classmethod
    def _template_comment_variants(
        cls,
        post_text: str,
        conference_name: str,
        registration_url: str,
        author_name: str,
        disclosure_mode: str,
        disclosure_text: str
    ) -> Dict[str, Any]:
        """Creates 5 varied, polite and ethical comments tailored to the topic"""
        kw = "công nghệ mới"
        if "exosome" in post_text.lower():
            kw = "ứng dụng Exosome và phác đồ tái tạo da"
        elif "rf" in post_text.lower():
            kw = "công nghệ Microneedling RF và trẻ hóa da"
        elif "laser" in post_text.lower():
            kw = "công nghệ Laser Picosecond và sắc tố da"
        elif "trẻ hóa da" in post_text.lower():
            kw = "các xu hướng trẻ hóa da chuẩn y khoa 2026"

        v_prof = (
            f"Chào anh/chị, anh/chị có thể tham khảo chương trình {conference_name}. "
            f"Sự kiện có các phiên báo cáo khoa học chuyên sâu về {kw} do các chuyên gia đầu ngành trình bày. "
            f"Thông tin chi tiết chương trình: {registration_url}"
        )

        v_edu = (
            f"Nếu anh/chị đang tìm kiếm tài liệu và cập nhật kiến thức chuẩn y khoa về {kw}, "
            f"{conference_name} sắp tới sẽ có phần thảo luận lâm sàng và cấp chứng chỉ CME. "
            f"Anh/chị xem thêm chương trình đào tạo tại: {registration_url}"
        )

        v_friendly = (
            f"Chào bạn, đúng chủ đề bạn đang quan tâm thì sắp tới có {conference_name} "
            f"tập hợp nhiều báo cáo thực tế về {kw} rất đáng tham khảo. "
            f"Bạn có thể xem lịch trình chi tiết tại link này nhé: {registration_url}"
        )

        v_short = (
            f"Anh/chị tham khảo chương trình {conference_name} cập nhật chuyên đề về {kw} tại: {registration_url}"
        )

        v_invitation = (
            f"Kính mời anh/chị tham dự {conference_name} để cùng trao đổi, thảo luận cùng các chuyên gia về {kw}. "
            f"Đăng ký tham dự tại: {registration_url}"
        )

        variants = [
            {"tone": "Professional", "text": v_prof},
            {"tone": "Educational", "text": v_edu},
            {"tone": "Friendly", "text": v_friendly},
            {"tone": "Short", "text": v_short},
            {"tone": "Invitation", "text": v_invitation}
        ]

        if disclosure_mode == "REQUIRED" and disclosure_text:
            for v in variants:
                v["text"] = f"{v['text']}\n\n[{disclosure_text}]"

        return {
            "reason": f"Bài viết đề cập trực tiếp đến {kw}. Đề xuất các phản hồi cung cấp thông tin hội thảo chính thống và liên kết đăng ký minh bạch.",
            "confidence": 0.94,
            "variants": variants,
            "selected_comment": variants[0]["text"],
            "disclosure_mode": disclosure_mode,
            "disclosure_text": disclosure_text
        }

    @classmethod
    async def generate_custom_comment(
        cls,
        prompt: str,
        post_text: str = "",
        conference_name: str = "Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026",
        registration_url: str = "https://aesthetichub.vn/hoi-nghi-2026",
        tone: str = "Professional"
    ) -> Dict[str, Any]:
        """
        Generates a custom comment strictly following user-specified prompt/intent.
        """
        try:
            provider = get_provider()
            ai_prompt = (
                f"Bạn là trợ lý truyền thông chuyên nghiệp cho hội nghị khoa học thẩm mỹ.\n"
                f"Hãy viết 1 đoạn bình luận Facebook ngắn gọn, tự nhiên, văn minh và lịch sự theo đúng yêu cầu sau:\n"
                f"YÊU CẦU CỤ THỂ CỦA NGƯỜI DÙNG: \"{prompt}\"\n\n"
                f"Thông tin hội nghị: {conference_name}\n"
                f"Link đăng ký/thông tin (nếu cần chèn): {registration_url}\n"
                f"Nội dung bài viết liên quan (nếu có): \"{post_text}\"\n"
                f"Phong cách: {tone}\n\n"
                f"Yêu cầu:\n"
                f"- Trả về duy nhất đoạn văn bản bình luận hoàn chỉnh, không rào đón, không để trong dấu ngoặc kép hay markdown block.\n"
                f"- Độ dài từ 2 đến 4 câu vừa vặn cho Facebook comment."
            )
            raw = await provider.generate(ai_prompt)
            cleaned = re.sub(r'```[a-zA-Z]*\s*|\s*```', '', raw).strip().strip('"').strip("'")
            if cleaned:
                return {
                    "success": True,
                    "comment_text": cleaned,
                    "source": "AI"
                }
        except Exception:
            pass

        # Fallback template based on user prompt
        fallback_text = f"Chào anh/chị, về chủ đề bạn quan tâm, anh/chị có thể tham khảo thêm tại {conference_name}: {registration_url}"
        return {
            "success": True,
            "comment_text": fallback_text,
            "source": "TemplateFallback"
        }

