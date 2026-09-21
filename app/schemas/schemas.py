from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Group Schemas
class FacebookGroupBase(BaseModel):
    name: str
    url: str
    facebook_id: Optional[str] = None
    description: Optional[str] = None
    members: Optional[str] = None
    privacy: Optional[str] = None
    category: Optional[str] = None
    keyword: Optional[str] = None
    selected: bool = False
    status: str = 'ACTIVE'

class FacebookGroupCreate(FacebookGroupBase):
    pass

class FacebookGroupUpdate(BaseModel):
    name: Optional[str] = None
    selected: Optional[bool] = None
    status: Optional[str] = None
    privacy: Optional[str] = None
    members: Optional[str] = None

class FacebookGroupResponse(FacebookGroupBase):
    id: int
    discovered_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Page Schemas
class FacebookPageBase(BaseModel):
    name: str
    url: str
    facebook_id: Optional[str] = None
    description: Optional[str] = None
    followers: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    keyword: Optional[str] = None
    selected: bool = False
    status: str = 'ACTIVE'

class FacebookPageCreate(BaseModel):
    url: str
    name: Optional[str] = None
    facebook_id: Optional[str] = None
    description: Optional[str] = None
    followers: Optional[str] = None
    category: Optional[str] = 'Page'
    location: Optional[str] = None
    keyword: Optional[str] = None
    selected: bool = False
    status: str = 'ACTIVE'

class FacebookPageBatchCreate(BaseModel):
    urls: List[str]
    category: Optional[str] = 'Page'
    keyword: Optional[str] = None

class FacebookPageUpdate(BaseModel):
    name: Optional[str] = None
    selected: Optional[bool] = None
    status: Optional[str] = None
    followers: Optional[str] = None
    category: Optional[str] = None

class FacebookPageResponse(FacebookPageBase):
    id: int
    discovered_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Target Schemas
class PostTargetResponse(BaseModel):
    id: int
    post_id: int
    target_type: str
    target_id: int
    target_url: str
    status: str
    published_url: Optional[str] = None
    published_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

# Post Schemas
class FacebookPostCreate(BaseModel):
    title: str
    content: str
    image_path: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    target_group_ids: List[int] = []
    target_page_ids: List[int] = []

class FacebookPostResponse(BaseModel):
    id: int
    title: str
    content: str
    image_path: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    created_at: datetime
    targets: List[PostTargetResponse] = []

    class Config:
        from_attributes = True

# Search Requests
class SearchRequest(BaseModel):
    keyword: str
    max_results: int = 50

# AI Content Generation
class AIGenerateRequest(BaseModel):
    topic: str
    audience: Optional[str] = 'Khách hàng tiềm năng'
    tone: Optional[str] = 'Chuyên nghiệp'
    call_to_action: Optional[str] = 'Liên hệ ngay để nhận tư vấn chi tiết'
    provider: Optional[str] = None

class AIGenerateResponse(BaseModel):
    headline: str
    content: str
    call_to_action: str
    hashtags: str
    full_text: str

# Status & Settings
class BrowserStatusResponse(BaseModel):
    is_running: bool
    profile_path: str
    is_logged_in: bool
    login_status: str
    checkpoint_detected: bool
    checkpoint_reason: Optional[str] = None

class QueueStatusResponse(BaseModel):
    status: str
    current_post_id: Optional[int] = None
    total_in_queue: int = 0
    completed: int = 0
    failed: int = 0
    message: Optional[str] = None

class SettingsUpdate(BaseModel):
    AI_PROVIDER: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    POST_DELAY_MIN: Optional[int] = None
    POST_DELAY_MAX: Optional[int] = None
    MAX_POSTS_PER_RUN: Optional[int] = None
    BROWSER_HEADLESS: Optional[bool] = None
    CHROME_EXECUTABLE_PATH: Optional[str] = None

class ImportCookiesRequest(BaseModel):
    cookie_data: str

class ImportCookiesResponse(BaseModel):
    success: bool
    is_logged_in: bool
    status: str
    message: str
    cookies_count: int = 0

