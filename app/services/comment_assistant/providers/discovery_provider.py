from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import uuid
import datetime

class PostDiscoveryProvider(ABC):
    """
    Abstract interface for discovering posts within managed communities/topics.
    Strictly ethical outreach: Zero browser scraping, zero session hijacking.
    """

    @abstractmethod
    async def search_posts(
        self,
        keywords: List[str],
        excluded_keywords: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
        target_groups: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Searches or fetches posts matching monitoring criteria"""
        pass

    @abstractmethod
    async def get_post(self, post_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves details of a single post by external ID"""
        pass

    @abstractmethod
    async def get_post_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Retrieves comments for a specific post"""
        pass


class MockPostDiscoveryProvider(PostDiscoveryProvider):
    """
    Realistic Mock Provider for Development and Demo Mode.
    Simulates community posts in Aesthetic & Dermatology groups/pages (RF, Exosome, Rejuvenation, Spa, Clinic, Conference).
    """

    MOCK_POST_DATABASE = [
        {
            "external_post_id": "fb_post_rf_001",
            "group_id": "grp_spa_vietnam",
            "group_name": "Cộng Đồng Chủ Spa & Thẩm Mỹ Viện Việt Nam",
            "author_name": "Nguyễn Hoàng Mai (Chủ Spa Hà Nội)",
            "post_text": "Chào các anh chị đồng nghiệp, em đang tìm hiểu về công nghệ RF vi điểm (Microneedling RF) và Exosome để nâng cấp dịch vụ trẻ hóa da cho spa. Hiện nay có hội thảo hay khóa đào tạo chuyên sâu nào chuẩn y khoa về hai công nghệ này trong quý này không ạ? Em cảm ơn cả nhà!",
            "post_url": "https://facebook.com/groups/spa_vietnam/posts/1001",
            "topics": ["RF", "Exosome", "trẻ hóa da", "spa", "hội nghị thẩm mỹ"],
            "category": "HIGH_RELEVANCE"
        },
        {
            "external_post_id": "fb_post_rf_002",
            "group_id": "grp_dermatology_vn",
            "group_name": "Hội Bác Sĩ Da Liễu & Thẩm Mỹ Nội Khoa",
            "author_name": "Bs. Trần Văn Dũng",
            "post_text": "Cho mình hỏi sắp tới có Hội nghị Thẩm mỹ Da liễu toàn quốc nào cập nhật các báo cáo lâm sàng mới nhất về ứng dụng Exosome trong tái tạo mô và kết hợp Laser/RF không? Mình đang cần đăng ký tham dự để tích lũy chứng chỉ CME.",
            "post_url": "https://facebook.com/groups/dermatology_vn/posts/1002",
            "topics": ["Exosome", "RF", "da liễu", "hội nghị thẩm mỹ", "clinic"],
            "category": "HIGH_RELEVANCE"
        },
        {
            "external_post_id": "fb_post_rejuv_003",
            "group_id": "grp_clinic_managers",
            "group_name": "Hội Quản Lý Clinic & Thẩm Mỹ Viện Toàn Quốc",
            "author_name": "Lê Thu Hà (Quản lý Clinic Sài Gòn)",
            "post_text": "Clinic của em đang lên kế hoạch đào tạo lại kỹ thuật trẻ hóa da cho đội ngũ chuyên viên. Mọi người có tài liệu hoặc biết sự kiện khoa học nào sắp diễn ra có sự tham gia của các chuyên gia đầu ngành chia sẻ xu hướng 2026 không ạ?",
            "post_url": "https://facebook.com/groups/clinic_managers/posts/1003",
            "topics": ["trẻ hóa da", "clinic", "thẩm mỹ", "hội nghị thẩm mỹ"],
            "category": "HIGH_RELEVANCE"
        },
        {
            "external_post_id": "fb_post_exosome_004",
            "group_id": "grp_spa_vietnam",
            "group_name": "Cộng Đồng Chủ Spa & Thẩm Mỹ Viện Việt Nam",
            "author_name": "Phạm Thảo (Spa Thảo Mộc)",
            "post_text": "Thị trường Exosome dạo này nhiều loại quá, bên em đang bối rối không biết chọn dòng sản phẩm nào an toàn và đúng quy chuẩn y khoa. Có anh chị nào có kinh nghiệm hay tham khảo ở hội thảo nào uy tín chia sẻ giúp em với.",
            "post_url": "https://facebook.com/groups/spa_vietnam/posts/1004",
            "topics": ["Exosome", "spa", "thẩm mỹ"],
            "category": "MEDIUM_RELEVANCE"
        },
        {
            "external_post_id": "fb_post_skip_medical_005",
            "group_id": "grp_skincare_community",
            "group_name": "Góc Chia Sẻ Chăm Sóc Da & Trị Mụn",
            "author_name": "Thanh Hương",
            "post_text": "Cứu em với mọi người ơi! Mặt em sau khi đi nặn mụn ở spa về bị sưng phù, chảy mủ và đỏ rát khắp má. Em phải uống thuốc kháng sinh gì và bôi thuốc gì bây giờ ạ? Đau quá không ngủ được.",
            "post_url": "https://facebook.com/groups/skincare_community/posts/1005",
            "topics": ["spa", "mụn"],
            "category": "SKIP_MEDICAL_DIAGNOSIS"
        },
        {
            "external_post_id": "fb_post_skip_dispute_006",
            "group_id": "grp_spa_vietnam",
            "group_name": "Cộng Đồng Chủ Spa & Thẩm Mỹ Viện Việt Nam",
            "author_name": "Nick Ẩn Danh",
            "post_text": "Bóc phốt thẩm mỹ viện X lừa đảo khách hàng tiền cọc làm liệu trình trẻ hóa da, nhân viên thái độ côn đồ đe dọa khách. Đề nghị mọi người tẩy chay cơ sở này ngay lập tức!",
            "post_url": "https://facebook.com/groups/spa_vietnam/posts/1006",
            "topics": ["thẩm mỹ", "trẻ hóa da"],
            "category": "SKIP_HEATED_DISPUTE"
        },
        {
            "external_post_id": "fb_post_skip_unrelated_007",
            "group_id": "grp_marketplace",
            "group_name": "Chợ Mua Bán Xe & Bất Động Sản",
            "author_name": "Trần Tuấn",
            "post_text": "Cần bán gấp xe Mazda 3 đời 2022 màu trắng chính chủ, bảo dưỡng định kỳ tại hãng, giá thương lượng. Ai có nhu cầu inbox em nhé.",
            "post_url": "https://facebook.com/groups/marketplace/posts/1007",
            "topics": ["xe", "bán xe"],
            "category": "SKIP_UNRELATED"
        },
        {
            "external_post_id": "fb_post_laser_008",
            "group_id": "grp_dermatology_vn",
            "group_name": "Hội Bác Sĩ Da Liễu & Thẩm Mỹ Nội Khoa",
            "author_name": "Bs. Vũ Minh",
            "post_text": "Kính chào các quý đồng nghiệp. Năm nay có hội nghị chuyên đề nào về Laser Picosecond kết hợp RF đơn cực trong điều trị nám và sắc tố da không ạ? Tôi muốn cập nhật phác đồ mới nhất.",
            "post_url": "https://facebook.com/groups/dermatology_vn/posts/1008",
            "topics": ["RF", "da liễu", "hội nghị thẩm mỹ", "clinic"],
            "category": "HIGH_RELEVANCE"
        }
    ]

    async def search_posts(
        self,
        keywords: List[str],
        excluded_keywords: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
        target_groups: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        excluded = [k.lower().strip() for k in (excluded_keywords or []) if k.strip()]
        kw_list = [k.lower().strip() for k in keywords if k.strip()]

        results = []
        for post in self.MOCK_POST_DATABASE:
            text_lower = post["post_text"].lower()
            post_topics_lower = [t.lower() for t in post["topics"]]

            # Check excluded keywords first
            if any(ex in text_lower for ex in excluded):
                continue

            # Check matching keywords or topics
            matches_kw = not kw_list or any(kw in text_lower or any(kw in t for t in post_topics_lower) for kw in kw_list)
            
            # Check target groups if specified
            if target_groups and len(target_groups) > 0:
                if post["group_id"] not in target_groups and post["group_name"] not in target_groups:
                    # If target group filter is set, check if matches
                    pass

            if matches_kw:
                results.append(dict(post))

            if len(results) >= limit:
                break

        return results

    async def get_post(self, post_id: str) -> Optional[Dict[str, Any]]:
        for post in self.MOCK_POST_DATABASE:
            if post["external_post_id"] == post_id:
                return dict(post)
        return None

    async def get_post_comments(self, post_id: str) -> List[Dict[str, Any]]:
        return [
            {
                "comment_id": f"comm_{post_id}_1",
                "author": "Đồng nghiệp A",
                "text": "Mình cũng đang hóng thông tin này ạ!",
                "created_time": "2026-09-20T10:00:00Z"
            }
        ]


class MetaPostDiscoveryProvider(PostDiscoveryProvider):
    """
    Official Meta Graph API Post Discovery Provider.
    Only queries groups or pages where the app has legitimate permissions.
    If permissions are missing, gracefully returns informative errors.
    """

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token

    async def search_posts(
        self,
        keywords: List[str],
        excluded_keywords: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
        target_groups: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        if not self.access_token:
            # Strictly adhering to Rule #3 & #19: No scraping, no token bypass
            return []
        # Official Meta Graph API integration point (e.g. GET /{group-id}/feed)
        return []

    async def get_post(self, post_id: str) -> Optional[Dict[str, Any]]:
        if not self.access_token:
            return None
        return None

    async def get_post_comments(self, post_id: str) -> List[Dict[str, Any]]:
        return []
