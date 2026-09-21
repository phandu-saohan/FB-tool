import json
import re
from typing import Dict, Any, Optional
from app.config import settings
from app.ai.content_generator import get_provider
from app.utils.logger import log_info, log_error, log_warning

RELEVANCE_SYSTEM_PROMPT = """You are assisting with professional aesthetic conference outreach.
Evaluate whether the following social media post from a medical/aesthetic community is relevant to an aesthetic conference or educational workshop.

Only recommend generating a comment when the source post is genuinely relevant to the conference topics (e.g., RF, Exosome, skin rejuvenation, aesthetic dermatology, laser, clinic/spa operations, scientific conferences).
Do not fabricate facts.
Do not make medical promises.
Do not impersonate users.
Do not use deceptive engagement tactics.

SKIP CONDITIONS - You MUST return action "SKIP" if:
- The post is not relevant to aesthetic medicine, dermatology, spa/clinic technologies or conferences.
- The post involves sensitive, heated disputes, drama, or controversy (bóc phốt, tranh cãi gay gắt).
- The post asks for personal medical diagnosis, prescription, or home treatment (yêu cầu chẩn đoán/kê đơn y khoa cá nhân).
- The post lacks sufficient context to add genuine value.

Response format MUST be strictly a JSON object:
{
  "action": "COMMENT" or "SKIP",
  "relevanceScore": integer between 0 and 100,
  "reason": "Detailed explanation in Vietnamese of why this post is or is not relevant"
}
"""

class CommentRelevanceEngine:
    """
    Evaluates discovered posts for relevance to Aesthetic Conferences & Outreach Campaigns.
    Strictly implements Skip Conditions (anti-spam, no medical diagnosis, no disputes).
    """

    # Skip condition triggers (Medical advice, heated disputes, completely unrelated)
    MEDICAL_DIAGNOSIS_TRIGGERS = [
        "uống thuốc gì", "bôi thuốc gì", "chảy mủ", "sưng phù", "nhiễm trùng",
        "kê đơn", "chữa bệnh", "kháng sinh gì", "cứu em với", "bị hoại tử"
    ]

    DISPUTE_TRIGGERS = [
        "bóc phốt", "lừa đảo", "côn đồ", "tẩy chay", "đe dọa", "kiện", "gian dối", "vạch mặt"
    ]

    UNRELATED_TRIGGERS = [
        "bán xe", "bất động sản", "nhà đất", "cho thuê nhà", "xe máy", "điện thoại", "sim số đẹp"
    ]

    AESTHETIC_RELEVANT_KEYWORDS = [
        "hội nghị", "hội thảo", "khoa học", "cme", "đào tạo", "rf", "exosome",
        "trẻ hóa da", "da liễu", "thẩm mỹ", "spa", "clinic", "laser", "filler",
        "botox", "chuyển giao công nghệ", "bác sĩ", "chuyên gia"
    ]

    @classmethod
    async def evaluate_post(
        cls,
        post_text: str,
        conference_name: str = "Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026",
        threshold: int = 70
    ) -> Dict[str, Any]:
        """
        Evaluates relevance score (0-100) and checks all skip conditions.
        Returns: { 'action': 'COMMENT'|'SKIP', 'relevance_score': int, 'reason': str }
        """
        text_lower = post_text.lower()

        # 1. Rule-based heuristic safety check for strict SKIP conditions
        for trigger in cls.MEDICAL_DIAGNOSIS_TRIGGERS:
            if trigger in text_lower:
                return {
                    "action": "SKIP",
                    "relevance_score": 15,
                    "reason": "BỎ QUA: Bài viết yêu cầu tư vấn/chẩn đoán y khoa cá nhân khẩn cấp, không phù hợp để truyền thông hội thảo."
                }

        for trigger in cls.DISPUTE_TRIGGERS:
            if trigger in text_lower:
                return {
                    "action": "SKIP",
                    "relevance_score": 10,
                    "reason": "BỎ QUA: Bài viết có nội dung tranh cãi, bóc phốt căng thẳng. Cần tránh tương tác để bảo vệ uy tín hội nghị."
                }

        for trigger in cls.UNRELATED_TRIGGERS:
            if trigger in text_lower:
                return {
                    "action": "SKIP",
                    "relevance_score": 5,
                    "reason": "BỎ QUA: Chủ đề hoàn toàn không liên quan đến thẩm mỹ, da liễu hay hội nghị."
                }

        # 2. Try LLM Evaluation if configured
        try:
            provider = get_provider()
            prompt = f"{RELEVANCE_SYSTEM_PROMPT}\n\nConference: {conference_name}\n\nSource Post:\n\"\"\"{post_text}\"\"\""
            raw_response = await provider.generate(prompt)
            cleaned = re.sub(r'```json\s*|\s*```', '', raw_response).strip()
            data = json.loads(cleaned)

            score = int(data.get("relevanceScore", 0))
            action = data.get("action", "SKIP").upper()
            reason = data.get("reason", "")

            if score < threshold:
                action = "SKIP"

            return {
                "action": action,
                "relevance_score": score,
                "reason": reason
            }
        except Exception as e:
            # 3. Deterministic Heuristic Fallback
            return cls._heuristic_evaluation(post_text, threshold)

    @classmethod
    def _heuristic_evaluation(cls, post_text: str, threshold: int = 70) -> Dict[str, Any]:
        """Deterministic heuristic evaluation for offline / demo mode"""
        text_lower = post_text.lower()
        matched = [k for k in cls.AESTHETIC_RELEVANT_KEYWORDS if k in text_lower]

        score = 30
        if "hội nghị" in text_lower or "hội thảo" in text_lower or "khoa học" in text_lower:
            score += 35
        if "rf" in text_lower or "exosome" in text_lower:
            score += 20
        if "trẻ hóa da" in text_lower or "da liễu" in text_lower:
            score += 15
        if "spa" in text_lower or "clinic" in text_lower:
            score += 10

        score = min(score, 98)

        if score >= threshold:
            action = "COMMENT"
            reason = f"Chủ đề liên quan trực tiếp đến các từ khóa hội nghị thẩm mỹ ({', '.join(matched[:4])}). Đối tượng là chủ spa/bác sĩ quan tâm cập nhật công nghệ."
        else:
            action = "SKIP"
            reason = f"Điểm phù hợp ({score}/{threshold}) dưới ngưỡng yêu cầu. Nội dung chưa đủ ngữ cảnh trọng tâm."

        return {
            "action": action,
            "relevance_score": score,
            "reason": reason
        }
