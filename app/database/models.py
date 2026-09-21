from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base

class FacebookGroup(Base):
    __tablename__ = 'facebook_groups'

    id = Column(Integer, primary_key=True, index=True)
    facebook_id = Column(String(100), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    members = Column(String(100), nullable=True)
    privacy = Column(String(50), nullable=True)
    category = Column(String(100), nullable=True)
    keyword = Column(String(200), nullable=True, index=True)
    selected = Column(Boolean, default=False)
    status = Column(String(50), default='ACTIVE')
    discovered_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FacebookPage(Base):
    __tablename__ = 'facebook_pages'

    id = Column(Integer, primary_key=True, index=True)
    facebook_id = Column(String(100), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    followers = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)
    keyword = Column(String(200), nullable=True, index=True)
    selected = Column(Boolean, default=False)
    status = Column(String(50), default='ACTIVE')
    discovered_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FacebookPost(Base):
    __tablename__ = 'facebook_posts'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    image_path = Column(String(500), nullable=True)
    status = Column(String(50), default='DRAFT')
    scheduled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    targets = relationship('FacebookPostTarget', back_populates='post', cascade='all, delete-orphan')

class FacebookPostTarget(Base):
    __tablename__ = 'facebook_post_targets'

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('facebook_posts.id'), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=False)
    target_url = Column(String(500), nullable=False)
    status = Column(String(50), default='PENDING')
    published_url = Column(String(500), nullable=True)
    published_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    post = relationship('FacebookPost', back_populates='targets')

class AutomationLog(Base):
    __tablename__ = 'automation_logs'

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), nullable=False)
    action = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# ---------------------------------------------------------------------------
# COMMENT ASSISTANT MODELS (Anti-Spam, Ethical Outreach Architecture)
# ---------------------------------------------------------------------------

from sqlalchemy import Float

class CommentMonitoringRule(Base):
    __tablename__ = 'comment_monitoring_rules'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    keywords = Column(Text, nullable=False)
    excluded_keywords = Column(Text, nullable=True)
    topics = Column(String(500), nullable=True)
    locations = Column(String(255), nullable=True)
    target_groups = Column(Text, nullable=True)  # JSON or comma-separated
    status = Column(String(50), default='ACTIVE')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    discovered_posts = relationship('DiscoveredPost', back_populates='rule', cascade='all, delete-orphan')

class DiscoveredPost(Base):
    __tablename__ = 'discovered_posts'

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey('comment_monitoring_rules.id'), nullable=True)
    external_post_id = Column(String(100), nullable=False, index=True)
    group_id = Column(String(100), nullable=True, index=True)
    group_name = Column(String(255), nullable=True)
    author_name = Column(String(255), nullable=True)
    post_text = Column(Text, nullable=False)
    post_url = Column(String(500), nullable=True)
    relevance_score = Column(Integer, default=0)
    relevance_reason = Column(Text, nullable=True)
    status = Column(String(50), default='FOUND')  # FOUND, RELEVANT, SKIPPED, COMMENTED
    discovered_at = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(Text, nullable=True)

    rule = relationship('CommentMonitoringRule', back_populates='discovered_posts')
    suggestions = relationship('CommentSuggestion', back_populates='post', cascade='all, delete-orphan')

class CommentCampaign(Base):
    __tablename__ = 'comment_campaigns'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    conference_name = Column(String(255), nullable=False)
    registration_url = Column(String(500), nullable=True)
    monitoring_topics = Column(Text, nullable=True)
    target_groups = Column(Text, nullable=True)
    comment_guidelines = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    daily_limit = Column(Integer, default=20)
    approval_mode = Column(String(50), default='APPROVAL')  # MANUAL, APPROVAL, CONTROLLED_AUTOMATION
    status = Column(String(50), default='ACTIVE')  # ACTIVE, PAUSED, COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)

    suggestions = relationship('CommentSuggestion', back_populates='campaign')

class CommentSuggestion(Base):
    __tablename__ = 'comment_suggestions'

    id = Column(Integer, primary_key=True, index=True)
    discovered_post_id = Column(Integer, ForeignKey('discovered_posts.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('comment_campaigns.id'), nullable=True)
    conference_name = Column(String(255), nullable=False)
    registration_url = Column(String(500), nullable=True)
    relevance_score = Column(Integer, default=0)
    reason = Column(Text, nullable=True)
    tone = Column(String(50), default='Professional')
    variants_json = Column(Text, nullable=False)  # JSON array of variants
    selected_comment = Column(Text, nullable=False)
    disclosure_mode = Column(String(50), default='OPTIONAL')  # OFF, OPTIONAL, REQUIRED
    disclosure_text = Column(String(255), default='Thông tin chương trình do BTC cung cấp.')
    status = Column(String(50), default='PENDING')  # PENDING, APPROVED, REJECTED, SCHEDULED, PUBLISHED, FAILED
    tags = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    post = relationship('DiscoveredPost', back_populates='suggestions')
    campaign = relationship('CommentCampaign', back_populates='suggestions')
    approvals = relationship('CommentApproval', back_populates='suggestion', cascade='all, delete-orphan')
    schedules = relationship('ScheduledComment', back_populates='suggestion', cascade='all, delete-orphan')

class ScheduledComment(Base):
    __tablename__ = 'scheduled_comments'

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey('comment_suggestions.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('comment_campaigns.id'), nullable=True)
    group_id = Column(String(100), nullable=True)
    comment_text = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    timezone = Column(String(50), default='Asia/Ho_Chi_Minh')
    status = Column(String(50), default='SCHEDULED')  # SCHEDULED, PUBLISHED, CANCELLED, FAILED
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    suggestion = relationship('CommentSuggestion', back_populates='schedules')

class CommentApproval(Base):
    __tablename__ = 'comment_approvals'

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey('comment_suggestions.id'), nullable=False)
    reviewer_id = Column(String(100), default='admin')
    action = Column(String(50), nullable=False)  # APPROVED, REJECTED, EDITED
    previous_text = Column(Text, nullable=True)
    final_text = Column(Text, nullable=False)
    reason = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    suggestion = relationship('CommentSuggestion', back_populates='approvals')

class CommentRateLimit(Base):
    __tablename__ = 'comment_rate_limits'

    id = Column(Integer, primary_key=True, index=True)
    target_group_id = Column(String(100), unique=True, nullable=False, index=True)
    last_comment_at = Column(DateTime, nullable=True)
    group_comment_count_24h = Column(Integer, default=0)
    group_comment_count_7d = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CommentLog(Base):
    __tablename__ = 'comment_logs'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), default='system')
    campaign_id = Column(Integer, nullable=True)
    group_id = Column(String(100), nullable=True)
    source_post_id = Column(String(100), nullable=True)
    conference_id = Column(String(100), nullable=True)
    content_id = Column(Integer, nullable=True)
    comment_text = Column(Text, nullable=False)
    provider = Column(String(50), default='MockCommentPublishingProvider')
    status = Column(String(50), nullable=False)  # PUBLISHED, FAILED, CANCELLED
    scheduled_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    external_comment_id = Column(String(100), nullable=True)
    external_comment_url = Column(String(500), nullable=True)
    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CommentAssistantSetting(Base):
    __tablename__ = 'comment_assistant_settings'

    id = Column(Integer, primary_key=True, index=True)
    automation_enabled = Column(Boolean, default=True)
    default_relevance_threshold = Column(Integer, default=70)
    daily_limit = Column(Integer, default=30)
    hourly_limit = Column(Integer, default=5)
    group_cooldown_hours = Column(Integer, default=24)
    duplicate_similarity_threshold = Column(Float, default=0.8)
    approval_required = Column(Boolean, default=True)
    default_disclosure = Column(String(50), default='OPTIONAL')  # OFF, OPTIONAL, REQUIRED
    ai_model = Column(String(100), default='gemini-2.5-flash')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ---------------------------------------------------------------------------
# EMAIL CAMPAIGN QUEUE & RELIABLE SENDING MODELS
# ---------------------------------------------------------------------------

from sqlalchemy import UniqueConstraint, Index

class EmailCampaign(Base):
    __tablename__ = 'email_campaigns'

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(100), nullable=True)
    conference_id = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    from_name = Column(String(100), nullable=False, default='Aesthetic Conference Hub')
    from_email = Column(String(255), nullable=False)
    reply_to = Column(String(255), nullable=True)

    status = Column(String(50), default='DRAFT', index=True)  # DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED

    daily_limit = Column(Integer, default=300)
    hourly_limit = Column(Integer, default=30)
    min_delay_seconds = Column(Integer, default=15)
    max_delay_seconds = Column(Integer, default=45)

    total_recipients = Column(Integer, default=0)
    queued_count = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    remaining_count = Column(Integer, default=0)

    content_html = Column(Text, nullable=True)
    content_plain = Column(Text, nullable=True)
    preview_text = Column(String(255), nullable=True)
    cta_text = Column(String(100), nullable=True)
    cta_url = Column(String(500), nullable=True)

    started_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    last_processed_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipients = relationship('EmailCampaignRecipient', back_populates='campaign', cascade='all, delete-orphan')
    jobs = relationship('EmailJob', back_populates='campaign', cascade='all, delete-orphan')

class EmailCampaignRecipient(Base):
    __tablename__ = 'email_campaign_recipients'

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('email_campaigns.id'), nullable=False, index=True)
    contact_id = Column(String(100), nullable=True)

    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True, index=True)

    status = Column(String(50), default='QUEUED', index=True)  # QUEUED, PROCESSING, SENT, FAILED, RETRY, SKIPPED, BOUNCED, UNSUBSCRIBED


    attempt_count = Column(Integer, default=0)
    last_attempt_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True, index=True)

    provider_message_id = Column(String(255), nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String(255), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship('EmailCampaign', back_populates='recipients')
    job = relationship('EmailJob', back_populates='recipient', uselist=False, cascade='all, delete-orphan')

    __table_args__ = (
        UniqueConstraint('campaign_id', 'email', name='uq_campaign_email'),
    )

class EmailJob(Base):
    __tablename__ = 'email_jobs'

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('email_campaigns.id'), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey('email_campaign_recipients.id'), nullable=False, index=True)

    status = Column(String(50), default='PENDING', index=True)  # PENDING, PROCESSING, COMPLETED, RETRY, FAILED
    attempts = Column(Integer, default=0)

    available_at = Column(DateTime, default=datetime.utcnow, index=True)
    locked_at = Column(DateTime, nullable=True, index=True)
    locked_by = Column(String(100), nullable=True)

    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship('EmailCampaign', back_populates='jobs')
    recipient = relationship('EmailCampaignRecipient', back_populates='job')

class EmailQuota(Base):
    __tablename__ = 'email_quotas'

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), default='Hostinger', index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD in organization timezone

    daily_limit = Column(Integer, default=300)
    used_count = Column(Integer, default=0)
    remaining_count = Column(Integer, default=300)
    reserved_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('provider', 'date', name='uq_provider_date'),
    )

class EmailSuppression(Base):
    __tablename__ = 'email_suppressions'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    reason = Column(String(50), nullable=False)  # UNSUBSCRIBED, HARD_BOUNCE, COMPLAINT, INVALID
    source = Column(String(100), default='System')
    created_at = Column(DateTime, default=datetime.utcnow)

class EmailProviderSetting(Base):
    __tablename__ = 'email_provider_settings'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default='Tài khoản mặc định')
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=1)
    provider_name = Column(String(50), default='MockEmailProvider')  # Hostinger, MockEmailProvider, etc.
    smtp_host = Column(String(255), default='smtp.hostinger.com')
    smtp_port = Column(Integer, default=465)
    smtp_username = Column(String(255), default='outreach@aesthetichub.vn')
    smtp_password = Column(String(255), nullable=True)
    use_ssl = Column(Boolean, default=True)
    use_tls = Column(Boolean, default=False)

    from_email = Column(String(255), default='outreach@aesthetichub.vn')
    from_name = Column(String(100), default='Aesthetic Conference Intelligence')
    reply_to = Column(String(255), nullable=True)

    daily_limit = Column(Integer, default=300)
    safety_margin_pct = Column(Float, default=10.0)  # 5-20%, default 10%
    hourly_limit = Column(Integer, default=30)
    min_delay_seconds = Column(Integer, default=15)
    max_delay_seconds = Column(Integer, default=45)

    sending_window_start = Column(String(5), default='08:00')
    sending_window_end = Column(String(5), default='18:00')

    max_emails_per_contact_7d = Column(Integer, default=1)
    max_emails_per_contact_30d = Column(Integer, default=3)

    timezone = Column(String(50), default='Asia/Ho_Chi_Minh')

    circuit_breaker_failures = Column(Integer, default=20)
    circuit_breaker_rate = Column(Float, default=0.30)
    consecutive_failures = Column(Integer, default=0)
    is_paused = Column(Boolean, default=False)
    pause_reason = Column(Text, nullable=True)
    cooldown_until = Column(DateTime, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class EmailAuditLog(Base):
    __tablename__ = 'email_audit_logs'

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(100), default='System')
    action = Column(String(100), nullable=False, index=True)
    campaign_id = Column(Integer, nullable=True, index=True)
    recipient_id = Column(Integer, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

