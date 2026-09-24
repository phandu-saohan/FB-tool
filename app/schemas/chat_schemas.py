from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

# --- Channel Schemas ---
class ChatChannelCreate(BaseModel):
    channel_type: str = Field(..., description="FB_PAGE, FB_PERSONAL, ZALO, WHATSAPP")
    name: str
    account_identifier: Optional[str] = None
    avatar_url: Optional[str] = None
    access_token: Optional[str] = None
    webhook_secret: Optional[str] = None
    phone_number: Optional[str] = None
    metadata_json: Optional[str] = None

class ChatChannelUpdate(BaseModel):
    name: Optional[str] = None
    account_identifier: Optional[str] = None
    avatar_url: Optional[str] = None
    access_token: Optional[str] = None
    webhook_secret: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class ChatChannelResponse(BaseModel):
    id: int
    channel_type: str
    name: str
    account_identifier: Optional[str] = None
    status: str
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Contact Schemas ---
class ChatContactResponse(BaseModel):
    id: int
    channel_id: int
    external_user_id: str
    name: str
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tags: str
    notes: Optional[str] = None
    customer_stage: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    customer_stage: Optional[str] = None


# --- Message Schemas ---
class ChatMessageCreate(BaseModel):
    content: str
    message_type: str = "TEXT"
    media_url: Optional[str] = None
    sender_name: Optional[str] = "Chuyên viên tư vấn"

class ChatMessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_type: str
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    content: str
    message_type: str
    media_url: Optional[str] = None
    delivery_status: str
    external_message_id: Optional[str] = None
    error_message: Optional[str] = None
    is_inbound: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Conversation Schemas ---
class ChatConversationResponse(BaseModel):
    id: int
    channel_id: int
    contact_id: int
    title: Optional[str] = None
    unread_count: int
    last_message_text: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_sender: str
    status: str
    assigned_agent: Optional[str] = None
    ai_auto_reply: bool
    channel_type: Optional[str] = None
    channel_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_avatar: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatConversationUpdate(BaseModel):
    status: Optional[str] = None  # OPEN, RESOLVED, SNOOZED
    assigned_agent: Optional[str] = None
    ai_auto_reply: Optional[bool] = None

class ChatConversationDetailResponse(ChatConversationResponse):
    contact: Optional[ChatContactResponse] = None
    channel: Optional[ChatChannelResponse] = None
    messages: List[ChatMessageResponse] = []


# --- Quick Replies / Templates ---
class ChatQuickReplyCreate(BaseModel):
    shortcut: str
    title: str
    content: str
    channel_type: str = "ALL"
    category: str = "Chăm sóc khách hàng"

class ChatQuickReplyResponse(BaseModel):
    id: int
    shortcut: str
    title: str
    content: str
    channel_type: str
    category: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Settings & Stats ---
class ChatSettingResponse(BaseModel):
    id: int
    ai_auto_suggest: bool
    ai_auto_reply_enabled: bool
    auto_reply_outside_hours: bool
    business_hours_start: str
    business_hours_end: str
    outside_hours_message: str
    sound_notifications: bool
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatSettingUpdate(BaseModel):
    ai_auto_suggest: Optional[bool] = None
    ai_auto_reply_enabled: Optional[bool] = None
    auto_reply_outside_hours: Optional[bool] = None
    business_hours_start: Optional[str] = None
    business_hours_end: Optional[str] = None
    outside_hours_message: Optional[str] = None
    sound_notifications: Optional[bool] = None

class ChatStatsResponse(BaseModel):
    total_conversations: int
    open_conversations: int
    unread_messages: int
    messages_today: int
    channels_count: int
    by_channel: dict


# --- Simulation & AI ---
class SimulateIncomingRequest(BaseModel):
    channel_type: str = Field(..., description="FB_PAGE, FB_PERSONAL, ZALO, WHATSAPP")
    sender_name: str
    sender_phone: Optional[str] = None
    sender_avatar: Optional[str] = None
    message_text: str
    media_url: Optional[str] = None

class AISuggestRequest(BaseModel):
    custom_instruction: Optional[str] = None

class AISuggestResponse(BaseModel):
    suggestions: List[str]
    detected_intent: Optional[str] = None
    recommended_tags: List[str] = []
