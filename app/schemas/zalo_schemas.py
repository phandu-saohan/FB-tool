from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# ---------------------------------------------------------------------------
# ZALO GROUP SCHEMAS
# ---------------------------------------------------------------------------

class ZaloGroupCreate(BaseModel):
    name: str
    group_link: str
    group_id_external: Optional[str] = None
    members_count: Optional[int] = 0
    category: Optional[str] = "Thẩm mỹ"
    description: Optional[str] = None
    is_joined: Optional[bool] = True
    can_post: Optional[bool] = True
    status: Optional[str] = "ACTIVE"

    @field_validator("members_count", mode="before")
    def coerce_members_count(cls, v):
        return v if v is not None else 0

    @field_validator("is_joined", "can_post", mode="before")
    def coerce_bool(cls, v):
        return v if v is not None else True


class ZaloGroupResponse(BaseModel):
    id: int
    name: str
    group_link: str
    group_id_external: Optional[str] = None
    members_count: int = 0
    category: str = "Thẩm mỹ"
    description: Optional[str] = None
    is_joined: bool = True
    can_post: bool = True
    status: str = "ACTIVE"
    last_posted_at: Optional[datetime] = None
    post_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ZaloGroupBatchImport(BaseModel):
    links_text: str  # Plain text or list of links separated by newline / comma
    category: Optional[str] = "Thẩm mỹ"
    auto_join: Optional[bool] = True


class ZaloGroupSearchQuery(BaseModel):
    keyword: str
    category: Optional[str] = None
    limit: Optional[int] = 20


class ZaloGroupSearchResultItem(BaseModel):
    name: str
    group_link: str
    estimated_members: int
    category: str
    description: str
    already_saved: bool = False


# ---------------------------------------------------------------------------
# ZALO POST SCHEMAS
# ---------------------------------------------------------------------------

class ZaloPostCreate(BaseModel):
    title: str
    content: str
    media_urls: Optional[List[str]] = None
    call_to_action_url: Optional[str] = None
    group_ids: List[int] = []  # List of target group IDs
    delay_seconds: Optional[int] = 20
    action: Optional[str] = "draft"  # "draft", "publish_now", "schedule"
    scheduled_at: Optional[datetime] = None


class ZaloPostItemResponse(BaseModel):
    id: int
    post_id: int
    group_id: int
    group_name: Optional[str] = None
    group_link: Optional[str] = None
    status: str  # PENDING, SENDING, SENT, FAILED
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class ZaloPostResponse(BaseModel):
    id: int
    title: str
    content: str
    media_urls: Optional[str] = None
    call_to_action_url: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    delay_seconds: int = 20
    target_groups_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    created_at: datetime
    updated_at: datetime
    items: Optional[List[ZaloPostItemResponse]] = None

    class Config:
        from_attributes = True


class ZaloScheduleRequest(BaseModel):
    scheduled_at: datetime
    group_ids: Optional[List[int]] = None
    delay_seconds: Optional[int] = 20


# ---------------------------------------------------------------------------
# ZALO SETTING & DASHBOARD
# ---------------------------------------------------------------------------

class ZaloSettingResponse(BaseModel):
    id: int
    account_name: str
    phone_number: Optional[str] = None
    daily_limit: int = 50
    min_delay_seconds: int = 15
    max_delay_seconds: int = 45
    smart_cooldown_hours: int = 24
    is_active: bool = True
    updated_at: datetime

    class Config:
        from_attributes = True


class ZaloSettingUpdate(BaseModel):
    account_name: Optional[str] = None
    phone_number: Optional[str] = None
    session_cookie: Optional[str] = None
    oa_secret_key: Optional[str] = None
    oa_access_token: Optional[str] = None
    daily_limit: Optional[int] = None
    min_delay_seconds: Optional[int] = None
    max_delay_seconds: Optional[int] = None
    smart_cooldown_hours: Optional[int] = None
    is_active: Optional[bool] = None


class ZaloDashboardStats(BaseModel):
    total_groups: int
    active_groups: int
    total_posts: int
    scheduled_posts: int
    completed_posts: int
    total_sent_items: int
    success_rate: float
    daily_sent_today: int
    daily_limit: int


# ---------------------------------------------------------------------------
# ZALO AI GENERATOR SCHEMAS
# ---------------------------------------------------------------------------

class ZaloAIGenerateRequest(BaseModel):
    topic: str
    conference_name: Optional[str] = "Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026"
    cta_url: Optional[str] = "https://kbit2026.vercel.app"
    tone: Optional[str] = "Friendly & Professional"
    target_audience: Optional[str] = "Bác sĩ, Dược sĩ, Chủ Spa & Clinic"


class ZaloAIGenerateResponse(BaseModel):
    title: str
    content: str
    call_to_action: str
    hashtags: str
    full_message: str
