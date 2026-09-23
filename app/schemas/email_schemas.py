from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

class CampaignCreate(BaseModel):
    name: str
    subject: str
    from_name: str = "Aesthetic Conference Hub"
    from_email: str = "outreach@aesthetichub.vn"
    reply_to: Optional[str] = None
    daily_limit: int = 300
    hourly_limit: int = 30
    min_delay_seconds: int = 15
    max_delay_seconds: int = 45
    content_html: Optional[str] = None
    content_plain: Optional[str] = None
    preview_text: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    reply_to: Optional[str] = None
    daily_limit: Optional[int] = None
    hourly_limit: Optional[int] = None
    min_delay_seconds: Optional[int] = None
    max_delay_seconds: Optional[int] = None
    content_html: Optional[str] = None
    content_plain: Optional[str] = None
    preview_text: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None

class CampaignResponse(BaseModel):
    id: int
    name: str
    subject: str
    from_name: str
    from_email: str
    reply_to: Optional[str] = None
    status: str
    daily_limit: int
    hourly_limit: int
    min_delay_seconds: int
    max_delay_seconds: int
    total_recipients: int
    queued_count: int
    sent_count: int
    failed_count: int
    skipped_count: int
    remaining_count: int
    opened_count: Optional[int] = 0
    clicked_count: Optional[int] = 0
    open_rate: Optional[float] = 0.0
    click_rate: Optional[float] = 0.0
    content_html: Optional[str] = None
    content_plain: Optional[str] = None
    preview_text: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    estimated_days_remaining: Optional[float] = None

    @field_validator("opened_count", "clicked_count", mode="before")
    @classmethod
    def set_int_zero(cls, v):
        return int(v) if v is not None else 0

    @field_validator("open_rate", "click_rate", mode="before")
    @classmethod
    def set_float_zero(cls, v):
        return float(v) if v is not None else 0.0

    model_config = ConfigDict(from_attributes=True)


class RecipientCreate(BaseModel):
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    contact_id: Optional[str] = None

class BatchRecipientsImport(BaseModel):
    recipients: List[RecipientCreate]

class ExcelImportResult(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    invalid_count: int
    zalo_ready_count: int
    message: str

class RecipientResponse(BaseModel):
    id: int
    campaign_id: int
    contact_id: Optional[str] = None
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    status: str
    attempt_count: int
    last_attempt_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    provider_message_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    opened_at: Optional[datetime] = None
    open_count: Optional[int] = 0
    clicked_at: Optional[datetime] = None
    click_count: Optional[int] = 0
    device_type: Optional[str] = None
    created_at: datetime

    @field_validator("open_count", "click_count", mode="before")
    @classmethod
    def set_zero_if_none(cls, v):
        return int(v) if v is not None else 0

    model_config = ConfigDict(from_attributes=True)



class QueueItemResponse(BaseModel):
    id: int
    campaign_id: int
    campaign_name: Optional[str] = None
    recipient_id: int
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    status: str
    attempts: int
    available_at: datetime
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    last_error: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SuppressionCreate(BaseModel):
    email: str
    reason: str = "UNSUBSCRIBED"
    source: str = "Manual"

class SuppressionResponse(BaseModel):
    id: int
    email: str
    reason: str
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProviderSettingUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    provider_name: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    use_ssl: Optional[bool] = None
    use_tls: Optional[bool] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    daily_limit: Optional[int] = None
    safety_margin_pct: Optional[float] = None
    hourly_limit: Optional[int] = None
    min_delay_seconds: Optional[int] = None
    max_delay_seconds: Optional[int] = None
    sending_window_start: Optional[str] = None
    sending_window_end: Optional[str] = None
    max_emails_per_contact_7d: Optional[int] = None
    max_emails_per_contact_30d: Optional[int] = None
    circuit_breaker_failures: Optional[int] = None
    circuit_breaker_rate: Optional[float] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_alerts_enabled: Optional[bool] = None
    telegram_notify_on_complete: Optional[bool] = None
    telegram_notify_on_error: Optional[bool] = None
    tracking_base_url: Optional[str] = None

class ProviderSettingResponse(BaseModel):
    id: int
    name: str = "Tài khoản mặc định"
    is_active: bool = True
    priority: int = 1
    provider_name: str
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: Optional[str] = None
    use_ssl: bool
    use_tls: bool
    from_email: str
    from_name: str
    reply_to: Optional[str] = None
    daily_limit: int
    safety_margin_pct: float
    hourly_limit: int
    min_delay_seconds: int
    max_delay_seconds: int
    sending_window_start: str
    sending_window_end: str
    max_emails_per_contact_7d: int
    max_emails_per_contact_30d: int
    timezone: str
    circuit_breaker_failures: int
    circuit_breaker_rate: float
    consecutive_failures: int
    is_paused: bool
    pause_reason: Optional[str] = None
    cooldown_until: Optional[datetime] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_alerts_enabled: Optional[bool] = False
    telegram_notify_on_complete: Optional[bool] = True
    telegram_notify_on_error: Optional[bool] = True
    tracking_base_url: Optional[str] = None

    @field_validator("telegram_alerts_enabled", mode="before")
    @classmethod
    def set_telegram_alerts_enabled(cls, v):
        return bool(v) if v is not None else False

    @field_validator("telegram_notify_on_complete", mode="before")
    @classmethod
    def set_telegram_notify_on_complete(cls, v):
        return bool(v) if v is not None else True

    @field_validator("telegram_notify_on_error", mode="before")
    @classmethod
    def set_telegram_notify_on_error(cls, v):
        return bool(v) if v is not None else True

    model_config = ConfigDict(from_attributes=True)

class TelegramSettingUpdate(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_alerts_enabled: bool = True
    telegram_notify_on_complete: bool = True
    telegram_notify_on_error: bool = True

class AIEmailGenerateRequest(BaseModel):
    topic: str
    audience: Optional[str] = "Bác sĩ, Dược sĩ & Chủ Spa"
    tone: Optional[str] = "Chuyên nghiệp, sang trọng, thu hút"
    cta_text: Optional[str] = "Đăng Ký Tham Dự Ngay"
    cta_url: Optional[str] = "https://aesthetichub.vn/register"
    key_points: Optional[str] = None

class AIEmailGenerateResponse(BaseModel):
    subject_variants: List[str]
    preview_text: str
    content_html: str
    content_plain: str


class EmailAccountCreate(BaseModel):
    name: str = "Hostinger Outreach"
    priority: int = 1
    is_active: bool = True
    provider_name: str = "Hostinger"
    smtp_host: str = "smtp.hostinger.com"
    smtp_port: int = 465
    smtp_username: str
    smtp_password: Optional[str] = None
    use_ssl: bool = True
    use_tls: bool = False
    from_email: str
    from_name: str = "Aesthetic Conference"
    reply_to: Optional[str] = None
    daily_limit: int = 300
    safety_margin_pct: float = 10.0
    hourly_limit: int = 30
    min_delay_seconds: int = 15
    max_delay_seconds: int = 45
    sending_window_start: str = "08:00"
    sending_window_end: str = "18:00"

class EmailAccountUpdate(BaseModel):
    name: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    provider_name: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    use_ssl: Optional[bool] = None
    use_tls: Optional[bool] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    daily_limit: Optional[int] = None
    safety_margin_pct: Optional[float] = None
    hourly_limit: Optional[int] = None
    min_delay_seconds: Optional[int] = None
    max_delay_seconds: Optional[int] = None
    sending_window_start: Optional[str] = None
    sending_window_end: Optional[str] = None
    is_paused: Optional[bool] = None

class EmailAccountResponse(ProviderSettingResponse):
    used_today: int = 0
    remaining_today: int = 0
    effective_limit: int = 0
    percent_used: float = 0.0
    is_exhausted: bool = False

class EmailDashboardStats(BaseModel):
    quota: Dict[str, Any]
    metrics: Dict[str, Any]
    provider_status: Dict[str, Any]
    active_campaigns: List[CampaignResponse]
    accounts: Optional[List[Dict[str, Any]]] = None

