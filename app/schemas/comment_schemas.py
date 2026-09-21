from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class MonitoringRuleCreate(BaseModel):
    name: str
    keywords: str
    excluded_keywords: Optional[str] = ""
    topics: Optional[str] = ""
    locations: Optional[str] = ""
    target_groups: Optional[str] = ""
    status: Optional[str] = "ACTIVE"

class MonitoringRuleResponse(MonitoringRuleCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DiscoveredPostResponse(BaseModel):
    id: int
    rule_id: Optional[int] = None
    external_post_id: str
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    author_name: Optional[str] = None
    post_text: str
    post_url: Optional[str] = None
    relevance_score: int
    relevance_reason: Optional[str] = None
    status: str
    discovered_at: datetime

    class Config:
        from_attributes = True

class CommentVariantItem(BaseModel):
    tone: str
    text: str

class CommentSuggestionResponse(BaseModel):
    id: int
    discovered_post_id: int
    campaign_id: Optional[int] = None
    conference_name: str
    registration_url: Optional[str] = None
    relevance_score: int
    reason: Optional[str] = None
    tone: str
    variants_json: str
    selected_comment: str
    disclosure_mode: str
    disclosure_text: Optional[str] = None
    status: str
    tags: Optional[str] = None
    created_at: datetime
    post: Optional[DiscoveredPostResponse] = None

    class Config:
        from_attributes = True

class SuggestionEditRequest(BaseModel):
    selected_comment: str
    disclosure_mode: Optional[str] = "OPTIONAL"
    tags: Optional[str] = None

class SuggestionApproveRequest(BaseModel):
    reviewer_id: Optional[str] = "admin"
    comment_text: Optional[str] = None

class SuggestionRejectRequest(BaseModel):
    reviewer_id: Optional[str] = "admin"
    reason: Optional[str] = "Nội dung chưa phù hợp tiêu chuẩn"

class BulkSuggestionActionRequest(BaseModel):
    suggestion_ids: List[int]
    action: str  # approve, reject, tag
    tag: Optional[str] = None
    reason: Optional[str] = None

class ScheduleCommentRequest(BaseModel):
    suggestion_id: int
    scheduled_at: datetime
    comment_text: Optional[str] = None
    timezone: Optional[str] = "Asia/Ho_Chi_Minh"

class ScheduledCommentResponse(BaseModel):
    id: int
    suggestion_id: int
    campaign_id: Optional[int] = None
    group_id: Optional[str] = None
    comment_text: str
    scheduled_at: datetime
    timezone: str
    status: str
    error_message: Optional[str] = None
    executed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CampaignCreate(BaseModel):
    name: str
    conference_name: str
    registration_url: Optional[str] = ""
    monitoring_topics: Optional[str] = ""
    target_groups: Optional[str] = ""
    comment_guidelines: Optional[str] = ""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    daily_limit: Optional[int] = 20
    approval_mode: Optional[str] = "APPROVAL"
    status: Optional[str] = "ACTIVE"

class CampaignResponse(CampaignCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class CommentSettingsUpdate(BaseModel):
    automation_enabled: Optional[bool] = None
    default_relevance_threshold: Optional[int] = None
    daily_limit: Optional[int] = None
    hourly_limit: Optional[int] = None
    group_cooldown_hours: Optional[int] = None
    duplicate_similarity_threshold: Optional[float] = None
    approval_required: Optional[bool] = None
    default_disclosure: Optional[str] = None
    ai_model: Optional[str] = None

class CommentDashboardStats(BaseModel):
    posts_found: int
    relevant_posts: int
    comments_pending: int
    approved: int
    scheduled: int
    published: int
    failed: int
    automation_enabled: bool
    daily_limit: int
    daily_used: int
