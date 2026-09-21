import json
import re
from typing import Dict, Any, Optional
from app.config import settings
from app.ai.gemini import GeminiProvider
from app.ai.openai import OpenAIProvider
from app.utils.logger import log_info, log_error, log_warning

SYSTEM_PROMPT = """Bạn là một chuyên gia sáng tạo nội dung (Content Creator) và Copywriter hàng đầu chuyên viết bài đăng Facebook (Facebook Post) có độ tương tác cao, văn phong thu hút, tự nhiên và chuyên nghiệp.
Hãy tạo bài viết tối ưu cho thuật toán Facebook:
- Có tiêu đề giật tít hấp dẫn nhưng chân thực (Headline)
- Thân bài chia đoạn ngắn gọn, sử dụng emoji tinh tế, tạo cảm xúc và giá trị rõ ràng
- Lời kêu gọi hành động (Call To Action - CTA) rõ ràng, thúc đẩy tương tác
- 3 đến 6 hashtag liên quan nhất.

Định dạng trả về BẮT BUỘC là JSON duy nhất với cấu trúc:
{
  "headline": "Tiêu đề bài viết...",
  "content": "Nội dung bài viết Facebook...",
  "call_to_action": "Lời kêu gọi hành động...",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3"
}
"""

def get_provider(provider_name: Optional[str] = None):
    provider_name = (provider_name or settings.AI_PROVIDER).lower()
    if provider_name == 'gemini':
        return GeminiProvider()
    elif provider_name == 'openrouter':
        return OpenAIProvider(is_openrouter=True)
    elif provider_name == 'openai':
        return OpenAIProvider(is_openrouter=False)
    return GeminiProvider()

def fallback_template_post(topic: str, audience: str, tone: str, call_to_action: str) -> Dict[str, str]:
    """Provides high quality template fallback if AI keys are not yet configured in .env"""
    headline = f"✨ KHÁM PHÁ NGAY: {topic.upper()} - GIẢI PHÁP TỐI ƯU DÀNH CHO BẠN!"
    content = f"""🌟 Bạn đang quan tâm đến {topic}?

Dành riêng cho {audience}, đây là cơ hội tuyệt vời để nâng tầm hiệu quả và tiếp cận những giá trị vượt trội.

🔹 Đúc kết từ kinh nghiệm thực tiễn và xu hướng mới nhất
🔹 Phong cách làm việc {tone.lower()}, tận tâm và chuẩn mực
🔹 Đem lại hiệu quả rõ rệt và sự hài lòng cao nhất

Đừng bỏ lỡ giải pháp được thiết kế tối ưu nhất cho bạn trong hôm nay!"""

    cta = call_to_action or "👉 Nhắn tin ngay cho chúng tôi hoặc để lại bình luận để được hỗ trợ chi tiết nhất!"
    hashtags = f"#{re.sub(r'\\s+', '', topic)} #ChuyenNghiep #GiaiPhapToiUu #FacebookMarketing"

    full_text = f"{headline}\n\n{content}\n\n{cta}\n\n{hashtags}"

    return {
        "headline": headline,
        "content": content,
        "call_to_action": cta,
        "hashtags": hashtags,
        "full_text": full_text
    }

async def generate_facebook_post(
    topic: str,
    audience: str = "Khách hàng tiềm năng",
    tone: str = "Chuyên nghiệp",
    call_to_action: str = "Liên hệ ngay để nhận tư vấn",
    provider_name: Optional[str] = None
) -> Dict[str, str]:
    """
    Generates a structured Facebook post using configured AI provider with template fallback.
    """
    prompt = f"""Hãy viết bài đăng Facebook với các yêu cầu sau:
- Chủ đề: {topic}
- Đối tượng độc giả mục tiêu: {audience}
- Giọng văn (Tone): {tone}
- Lời kêu gọi hành động (Call to action): {call_to_action}

Hãy trả về duy nhất JSON hợp lệ theo format đã chỉ định."""

    try:
        provider = get_provider(provider_name)
        raw_text = await provider.generate_text(prompt, system_prompt=SYSTEM_PROMPT)
        
        # Clean JSON markdown fences
        cleaned = re.sub(r'^```json\s*|\s*```$', '', raw_text.strip(), flags=re.MULTILINE)
        data = json.loads(cleaned)

        headline = data.get('headline', '')
        content = data.get('content', '')
        cta = data.get('call_to_action', '')
        hashtags = data.get('hashtags', '')

        full_text = f"{headline}\n\n{content}\n\n{cta}\n\n{hashtags}"

        return {
            "headline": headline,
            "content": content,
            "call_to_action": cta,
            "hashtags": hashtags,
            "full_text": full_text
        }
    except Exception as e:
        log_warning('AI', f"AI generation could not use external LLM ({e}). Generating template content.")
        return fallback_template_post(topic, audience, tone, call_to_action)
