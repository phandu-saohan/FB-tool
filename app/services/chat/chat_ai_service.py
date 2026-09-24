import logging
import json
import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.database.models import ChatConversation, ChatMessage
from app.ai.content_generator import get_provider

logger = logging.getLogger(__name__)

class ChatAIService:
    """
    AI Copilot for Customer Service & Omnichannel Chat:
    - Generates 3 contextual quick-reply options using Gemini 2.5
    - Detects customer intent & auto-suggests CRM tags
    """

    @classmethod
    async def suggest_replies(cls, db: Session, conversation_id: int, custom_instruction: str = None) -> Dict[str, Any]:
        conv = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
        if not conv:
            raise ValueError(f"Không tìm thấy hội thoại #{conversation_id}")

        # Fetch recent messages (last 6 messages)
        recent_messages = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation_id
        ).order_by(ChatMessage.created_at.desc()).limit(6).all()
        recent_messages.reverse()

        last_inbound = next((m for m in reversed(recent_messages) if m.is_inbound), None)
        last_text = last_inbound.content if last_inbound else (conv.last_message_text or "")
        channel_name = conv.channel.name if conv.channel else "Kênh chat"
        contact_name = conv.contact.name if conv.contact else "Khách hàng"

        # Try Gemini LLM first
        try:
            provider = get_provider()
            if provider:
                system_prompt = (
                    "Bạn là chuyên viên chăm sóc khách hàng xuất sắc, chuyên nghiệp và tận tâm tại Việt Nam. "
                    "Hãy đọc lịch sử trò chuyện và đưa ra 3 câu phản hồi gợi ý (suggestions) ngắn gọn, tự nhiên, "
                    "lịch sự, có tâm, phù hợp với câu hỏi gần nhất của khách hàng. "
                    "Trả về định dạng JSON thuần túy:\n"
                    "{\n"
                    '  "suggestions": ["Câu 1", "Câu 2", "Câu 3"],\n'
                    '  "detected_intent": "Hỏi giá / Đặt lịch / Tư vấn / ...",\n'
                    '  "recommended_tags": ["Tag1", "Tag2"]\n'
                    "}"
                )

                history_context = "\n".join([
                    f"{'Khách hàng' if m.is_inbound else 'Chuyên viên'}: {m.content}"
                    for m in recent_messages
                ])

                prompt = (
                    f"Kênh: {channel_name}\n"
                    f"Tên khách hàng: {contact_name}\n"
                    f"Lịch sử chat gần nhất:\n{history_context}\n\n"
                    f"Câu hỏi mới nhất của khách: \"{last_text}\"\n"
                )
                if custom_instruction:
                    prompt += f"Lưu ý thêm từ quản lý: {custom_instruction}\n"

                if hasattr(provider, 'generate_text'):
                    result_text = await provider.generate_text(prompt, system_prompt=system_prompt)
                elif hasattr(provider, 'generate'):
                    result_text = await provider.generate(f"{system_prompt}\n\n{prompt}")
                else:
                    result_text = ""

                if result_text:
                    clean_json = re.sub(r'```json\s*|\s*```', '', result_text).strip()
                    data = json.loads(clean_json)
                    if "suggestions" in data and isinstance(data["suggestions"], list):
                        return data
        except Exception as e:
            logger.warning(f"[CHAT_AI] Gemini suggestion failed: {e}. Using fallback heuristic.")

        # Fallback intelligent suggestions
        return cls._heuristic_fallback(last_text, contact_name)

    @classmethod
    def _heuristic_fallback(cls, message_text: str, contact_name: str) -> Dict[str, Any]:
        lower = message_text.lower() if message_text else ""
        suggestions = []
        intent = "Tư vấn chung"
        tags = ["Cần tư vấn"]

        if any(w in lower for w in ["giá", "bao nhiêu", "chi phí", "bảng giá", "hết bao nhiêu"]):
            intent = "Hỏi chi phí / Báo giá"
            tags = ["Hỏi giá", "Tiềm năng"]
            suggestions = [
                f"Dạ em chào {contact_name}! Chi phí dịch vụ bên em đang được trợ giá ưu đãi giảm 25% trong tuần này. Mình cho em xin số điện thoại để bác sĩ gọi tư vấn bảng giá chi tiết theo tình trạng cụ thể nhé ạ!",
                f"Dạ chào bạn, gói dịch vụ này có mức giá trọn gói dao động từ 15tr - 35tr tùy mức độ. Hiện bên em có hỗ trợ trả góp 0% lãi suất nữa đó ạ. Bạn đã từng thăm khám ở đâu chưa ạ?",
                f"Dạ {contact_name} ơi, hôm nay bên em đang có ưu đãi miễn phí 100% chi phí khám tổng quát và chụp phim X-quang. Em hỗ trợ giữ suất ưu đãi này cho mình nhé?"
            ]
        elif any(w in lower for w in ["lịch", "hẹn", "khám", "sáng", "chiều", "thứ"]):
            intent = "Đặt lịch hẹn"
            tags = ["Đặt lịch"]
            suggestions = [
                f"Dạ {contact_name} muốn đặt lịch khám vào khung giờ sáng hay chiều ngày nào để em kiểm tra lịch trống của bác sĩ chuyên khoa giúp mình ạ?",
                f"Dạ em đã ghi nhận thông tin đặt lịch của mình. Bạn cho em xin Số điện thoại liên hệ để phòng khám lưu hồ sơ và gửi tin nhắn xác nhận lịch hẹn nhé ạ!",
                f"Dạ phòng khám mở cửa từ 8:00 - 20:30 hằng ngày. Mình tiện ghé khung giờ nào trong ngày mai để em sắp xếp bác sĩ đón tiếp chu đáo nhất ạ?"
            ]
        elif any(w in lower for w in ["ở đâu", "địa chỉ", "cơ sở", "chỗ nào"]):
            intent = "Hỏi địa chỉ"
            tags = ["Tìm địa chỉ"]
            suggestions = [
                f"Dạ cơ sở bên em tại số 126 Nguyễn Trãi, Thanh Xuân, Hà Nội (ngay gần Ngã Tư Sở, có chỗ đỗ ô tô rộng rãi miễn phí ạ).",
                f"Dạ em gửi mình định vị bản đồ và địa chỉ cụ thể nhé ạ. Anh/chị đang di chuyển từ khu vực nào để em hướng dẫn đường đi nhanh và thuận tiện nhất ạ?",
                f"Dạ phòng khám có 2 cơ sở tại Hà Nội và TP.HCM. Không biết {contact_name} đang ở gần khu vực nào hơn ạ?"
            ]
        elif any(w in lower for w in ["hi", "hello", "consultation", "price", "english"]):
            intent = "Khách quốc tế / Tiếng Anh"
            tags = ["International", "VIP"]
            suggestions = [
                f"Hello {contact_name}! Thank you for reaching out to us. We would be delighted to assist you. What specific treatment are you interested in?",
                f"Hi there! We provide full English-speaking doctor consultations and special packages for expats. Could you please share your preferred date to visit?",
                f"Hello! Our clinic is located in Hanoi and HCM City. Please feel free to let us know your requirements or leave your WhatsApp number for detailed guidance."
            ]
        else:
            intent = "Chào hỏi & Tìm hiểu"
            suggestions = [
                f"Dạ em chào {contact_name} ạ! Em có thể hỗ trợ tư vấn thông tin gì giúp mình hôm nay ạ?",
                f"Dạ chào bạn, rất vui được hỗ trợ bạn. Bạn đang quan tâm đến gói dịch vụ nào của bên mình vậy ạ?",
                f"Dạ em chào anh/chị! Hiện tại bên em đang có nhiều chương trình khuyến mãi tháng này, mình cần em giải đáp thắc mắc nào trước không ạ?"
            ]

        return {
            "suggestions": suggestions,
            "detected_intent": intent,
            "recommended_tags": tags
        }
