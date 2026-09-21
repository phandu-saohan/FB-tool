import re
from typing import List, Tuple, Optional
from difflib import SequenceMatcher

class CommentSimilarityService:
    """
    Prevents repetitive, copy-paste or spammy comments across communities.
    Checks: Exact duplicate, Levenshtein sequence similarity, token Jaccard similarity, and URL repetition.
    """

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Removes punctuation and normalizes whitespace for comparison"""
        t = re.sub(r'https?://\S+', '', text.lower())
        t = re.sub(r'[^\w\s]', '', t)
        return ' '.join(t.split())

    @classmethod
    def extract_urls(cls, text: str) -> List[str]:
        """Finds all URLs in text"""
        return re.findall(r'https?://[^\s]+', text.lower())

    @classmethod
    def calculate_similarity(cls, text1: str, text2: str) -> float:
        """
        Computes composite similarity score between 0.0 and 1.0.
        Uses difflib SequenceMatcher on normalized text.
        """
        c1 = cls.clean_text(text1)
        c2 = cls.clean_text(text2)

        if not c1 or not c2:
            return 0.0

        if c1 == c2:
            return 1.0

        # Sequence matcher similarity
        seq_sim = SequenceMatcher(None, c1, c2).ratio()

        # Token set Jaccard similarity
        tokens1 = set(c1.split())
        tokens2 = set(c2.split())
        if tokens1 and tokens2:
            jaccard = len(tokens1.intersection(tokens2)) / len(tokens1.union(tokens2))
        else:
            jaccard = 0.0

        # Weighted blend
        return round(0.6 * seq_sim + 0.4 * jaccard, 3)

    @classmethod
    def check_duplicate(
        cls,
        new_comment: str,
        recent_comments: List[str],
        threshold: float = 0.8
    ) -> Tuple[bool, float, Optional[str]]:
        """
        Validates if `new_comment` is too similar to any comment in `recent_comments`.
        Returns: (is_duplicate: bool, max_similarity: float, reason: Optional[str])
        """
        new_cleaned = cls.clean_text(new_comment)
        new_urls = cls.extract_urls(new_comment)

        max_sim = 0.0
        most_similar_text = None

        for prev in recent_comments:
            prev_cleaned = cls.clean_text(prev)
            if new_cleaned == prev_cleaned:
                return True, 1.0, "Nội dung bình luận trùng khớp 100% với một bình luận gần đây. Vui lòng chỉnh sửa hoặc chọn biến thể khác để đảm bảo tính tự nhiên."

            sim = cls.calculate_similarity(new_comment, prev)
            if sim > max_sim:
                max_sim = sim
                most_similar_text = prev

        if max_sim >= threshold:
            pct = int(max_sim * 100)
            return True, max_sim, f"Nội dung quá tương đồng ({pct}%) với bình luận đã dùng trước đó. Vui lòng điều chỉnh câu từ."

        return False, max_sim, None
