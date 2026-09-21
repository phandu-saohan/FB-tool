from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.database import get_db, SessionLocal
from app.database.models import (
    EmailCampaign,
    EmailCampaignRecipient,
    EmailJob,
    EmailSuppression,
    EmailProviderSetting,
    EmailAuditLog
)
from app.schemas.email_schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    BatchRecipientsImport,
    RecipientResponse,
    QueueItemResponse,
    SuppressionCreate,
    SuppressionResponse,
    ProviderSettingUpdate,
    ProviderSettingResponse,
    EmailDashboardStats
)
from app.services.email.quota_manager import EmailQuotaManager
from app.services.email.circuit_breaker import EmailCircuitBreaker
from app.services.email.suppression_service import EmailSuppressionService
from app.services.email.audit_logger import EmailAuditLogger
from app.services.email.worker import EmailWorker
from app.services.email.providers.hostinger_smtp_provider import HostingerSMTPProvider
from app.services.email.providers.mock_email_provider import MockEmailProvider

router = APIRouter(prefix="/api/email", tags=["Email Campaign Queue & Sending"])

# ---------------------------------------------------------------------------
# DASHBOARD & ANALYTICS
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=EmailDashboardStats)
def get_email_dashboard(db: Session = Depends(get_db)):
    # 1. Quota
    setting = db.query(EmailProviderSetting).first()
    provider_name = setting.provider_name if setting else "Hostinger"
    quota_info = EmailQuotaManager.get_quota_status(db, provider_name)

    # 2. Metrics across all campaigns
    total_campaigns = db.query(EmailCampaign).count()
    recip_stats = db.query(
        EmailCampaignRecipient.status,
        func.count(EmailCampaignRecipient.id)
    ).group_by(EmailCampaignRecipient.status).all()

    stats_dict = dict(recip_stats)
    metrics = {
        "total_campaigns": total_campaigns,
        "total_recipients": sum(stats_dict.values()),
        "sent_count": stats_dict.get("SENT", 0),
        "queued_count": stats_dict.get("QUEUED", 0),
        "processing_count": stats_dict.get("PROCESSING", 0),
        "retry_count": stats_dict.get("RETRY", 0),
        "failed_count": stats_dict.get("FAILED", 0),
        "bounced_count": stats_dict.get("BOUNCED", 0),
        "skipped_count": stats_dict.get("SKIPPED", 0)
    }

    # 3. Active Campaigns
    active_camps = db.query(EmailCampaign).filter(
        EmailCampaign.status.in_(["RUNNING", "PAUSED", "DRAFT"])
    ).order_by(EmailCampaign.updated_at.desc()).limit(10).all()

    # Compute estimated days remaining for each
    camp_responses = []
    effective_limit = quota_info["effective_limit"]
    for c in active_camps:
        c_dict = CampaignResponse.model_validate(c)
        if c.status == "RUNNING" and c.remaining_count > 0 and effective_limit > 0:
            c_dict.estimated_days_remaining = round(c.remaining_count / effective_limit, 1)
        camp_responses.append(c_dict)

    # 4. Provider Status
    cb_tripped, cb_reason = EmailCircuitBreaker.is_tripped(db, provider_name)
    provider_status = {
        "provider_name": provider_name,
        "is_paused": setting.is_paused if setting else False,
        "circuit_breaker_tripped": cb_tripped,
        "pause_reason": setting.pause_reason if setting else None,
        "consecutive_failures": setting.consecutive_failures if setting else 0
    }

    return {
        "quota": quota_info,
        "metrics": metrics,
        "provider_status": provider_status,
        "active_campaigns": camp_responses
    }

# ---------------------------------------------------------------------------
# CAMPAIGN CRUD & ACTIONS
# ---------------------------------------------------------------------------

@router.get("/campaigns", response_model=List[CampaignResponse])
def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(EmailCampaign).order_by(EmailCampaign.id.desc()).all()
    setting = db.query(EmailProviderSetting).first()
    eff_limit = EmailQuotaManager.get_effective_limit(setting.daily_limit if setting else 300, setting.safety_margin_pct if setting else 10.0)

    res = []
    for c in campaigns:
        cr = CampaignResponse.model_validate(c)
        if c.remaining_count > 0 and eff_limit > 0:
            cr.estimated_days_remaining = round(c.remaining_count / eff_limit, 1)
        res.append(cr)
    return res

@router.post("/campaigns", response_model=CampaignResponse)
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    campaign = EmailCampaign(
        name=data.name,
        subject=data.subject,
        from_name=data.from_name,
        from_email=data.from_email,
        reply_to=data.reply_to,
        daily_limit=data.daily_limit,
        hourly_limit=data.hourly_limit,
        min_delay_seconds=data.min_delay_seconds,
        max_delay_seconds=data.max_delay_seconds,
        content_html=data.content_html,
        content_plain=data.content_plain,
        preview_text=data.preview_text,
        cta_text=data.cta_text,
        cta_url=data.cta_url,
        status="DRAFT"
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    EmailAuditLogger.log(db, action="CREATE_CAMPAIGN", campaign_id=campaign.id, metadata={"name": campaign.name})
    return CampaignResponse.model_validate(campaign)

@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    setting = db.query(EmailProviderSetting).first()
    eff_limit = EmailQuotaManager.get_effective_limit(setting.daily_limit if setting else 300, setting.safety_margin_pct if setting else 10.0)
    cr = CampaignResponse.model_validate(campaign)
    if campaign.remaining_count > 0 and eff_limit > 0:
        cr.estimated_days_remaining = round(campaign.remaining_count / eff_limit, 1)
    return cr

@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
def update_campaign(campaign_id: int, data: CampaignUpdate, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(campaign, k, v)

    db.commit()
    db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)

@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.delete(campaign)
    db.commit()
    EmailAuditLogger.log(db, action="DELETE_CAMPAIGN", campaign_id=campaign_id)
    return {"message": "Campaign deleted successfully"}

# ---------------------------------------------------------------------------
# RECIPIENT MANAGEMENT & BULK IMPORT
# ---------------------------------------------------------------------------

@router.post("/campaigns/{campaign_id}/recipients")
def add_recipients_to_campaign(
    campaign_id: int,
    data: BatchRecipientsImport,
    db: Session = Depends(get_db)
):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    added_count = 0
    skipped_duplicates = 0

    for item in data.recipients:
        clean_email = item.email.strip().lower()
        if not clean_email:
            continue

        # Check existing in this campaign
        existing = db.query(EmailCampaignRecipient).filter_by(
            campaign_id=campaign_id, email=clean_email
        ).first()

        if existing:
            skipped_duplicates += 1
            continue

        recipient = EmailCampaignRecipient(
            campaign_id=campaign_id,
            contact_id=item.contact_id,
            email=clean_email,
            name=item.name,
            status="QUEUED"
        )
        db.add(recipient)
        db.flush() # populate recipient.id

        job = EmailJob(
            campaign_id=campaign_id,
            recipient_id=recipient.id,
            status="PENDING",
            available_at=datetime.utcnow()
        )
        db.add(job)
        added_count += 1

    # Update campaign recipient count
    campaign.total_recipients = (campaign.total_recipients or 0) + added_count
    campaign.queued_count = (campaign.queued_count or 0) + added_count
    campaign.remaining_count = (campaign.remaining_count or 0) + added_count

    db.commit()

    EmailAuditLogger.log(
        db, action="IMPORT_RECIPIENTS", campaign_id=campaign_id,
        metadata={"added": added_count, "skipped_duplicates": skipped_duplicates}
    )

    return {
        "message": f"Successfully imported {added_count} recipients ({skipped_duplicates} duplicates skipped)",
        "added_count": added_count,
        "skipped_duplicates": skipped_duplicates,
        "total_recipients": campaign.total_recipients
    }

@router.get("/campaigns/{campaign_id}/recipients", response_model=List[RecipientResponse])
def get_campaign_recipients(
    campaign_id: int,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(EmailCampaignRecipient).filter_by(campaign_id=campaign_id)
    if status:
        query = query.filter_by(status=status)
    recipients = query.order_by(EmailCampaignRecipient.id.asc()).offset(offset).limit(limit).all()
    return [RecipientResponse.model_validate(r) for r in recipients]

# ---------------------------------------------------------------------------
# CAMPAIGN LIFECYCLE CONTROLS
# ---------------------------------------------------------------------------

@router.post("/campaigns/{campaign_id}/start")
def start_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "RUNNING"
    if not campaign.started_at:
        campaign.started_at = datetime.utcnow()
    db.commit()

    EmailAuditLogger.log(db, action="START_CAMPAIGN", campaign_id=campaign_id)
    return {"message": "Campaign started successfully", "status": campaign.status}

@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "PAUSED"
    campaign.paused_at = datetime.utcnow()
    db.commit()

    EmailAuditLogger.log(db, action="PAUSE_CAMPAIGN", campaign_id=campaign_id)
    return {"message": "Campaign paused successfully", "status": campaign.status}

@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "RUNNING"
    db.commit()

    EmailAuditLogger.log(db, action="RESUME_CAMPAIGN", campaign_id=campaign_id)
    return {"message": "Campaign resumed successfully", "status": campaign.status}

@router.post("/campaigns/{campaign_id}/stop")
def stop_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "CANCELLED"
    db.commit()

    EmailAuditLogger.log(db, action="STOP_CAMPAIGN", campaign_id=campaign_id)
    return {"message": "Campaign stopped successfully", "status": campaign.status}

@router.post("/emergency-stop")
def emergency_stop_all(db: Session = Depends(get_db)):
    """
    EMERGENCY STOP ("STOP ALL EMAIL"): Immediately pauses all running campaigns
    and pauses provider settings to prevent any further sending.
    """
    # 1. Pause all RUNNING campaigns
    running_camps = db.query(EmailCampaign).filter_by(status="RUNNING").all()
    count = len(running_camps)
    for c in running_camps:
        c.status = "PAUSED"
        c.paused_at = datetime.utcnow()

    # 2. Pause provider settings
    setting = db.query(EmailProviderSetting).first()
    if setting:
        setting.is_paused = True
        setting.pause_reason = f"Emergency stop activated by user at {datetime.utcnow().isoformat()}"

    db.commit()

    EmailAuditLogger.log(
        db, action="EMERGENCY_STOP",
        metadata={"paused_campaigns_count": count}
    )

    return {
        "message": f"EMERGENCY STOP ACTIVATED: Paused {count} running campaigns and provider sending.",
        "paused_campaigns_count": count
    }

# ---------------------------------------------------------------------------
# QUEUE & WORKER EXECUTION
# ---------------------------------------------------------------------------

@router.get("/queue", response_model=List[QueueItemResponse])
def get_queue(
    campaign_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(EmailJob).join(EmailCampaign).join(EmailCampaignRecipient)
    if campaign_id:
        query = query.filter(EmailJob.campaign_id == campaign_id)
    if status:
        query = query.filter(EmailJob.status == status)

    jobs = query.order_by(EmailJob.id.asc()).offset(offset).limit(limit).all()

    items = []
    for j in jobs:
        items.append(QueueItemResponse(
            id=j.id,
            campaign_id=j.campaign_id,
            campaign_name=j.campaign.name if j.campaign else None,
            recipient_id=j.recipient_id,
            recipient_email=j.recipient.email if j.recipient else None,
            recipient_name=j.recipient.name if j.recipient else None,
            status=j.status,
            attempts=j.attempts,
            available_at=j.available_at,
            locked_at=j.locked_at,
            locked_by=j.locked_by,
            last_error=j.last_error
        ))
    return items

@router.post("/queue/retry-failed")
def retry_failed_jobs(campaign_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(EmailJob).filter(EmailJob.status == "FAILED")
    if campaign_id:
        query = query.filter(EmailJob.campaign_id == campaign_id)
    
    failed_jobs = query.all()
    count = len(failed_jobs)
    for j in failed_jobs:
        j.status = "PENDING"
        j.attempts = 0
        j.available_at = datetime.utcnow()
        if j.recipient:
            j.recipient.status = "QUEUED"
            j.recipient.attempt_count = 0

    db.commit()
    return {"message": f"Re-queued {count} failed jobs.", "count": count}

@router.post("/process-batch")
async def process_batch_now(
    campaign_id: Optional[int] = None,
    max_batch: int = 10,
    enable_delay: bool = False
):
    """Triggers an immediate worker batch execution."""
    worker = EmailWorker(enable_delay=enable_delay)
    results = await worker.run_batch(max_batch_size=max_batch, campaign_id=campaign_id)
    return {"processed_count": len(results), "results": results}

# ---------------------------------------------------------------------------
# SUPPRESSION LIST
# ---------------------------------------------------------------------------

@router.get("/suppression", response_model=List[SuppressionResponse])
def get_suppressions(db: Session = Depends(get_db)):
    items = db.query(EmailSuppression).order_by(EmailSuppression.id.desc()).all()
    return [SuppressionResponse.model_validate(i) for i in items]

@router.post("/suppression", response_model=SuppressionResponse)
def add_suppression(data: SuppressionCreate, db: Session = Depends(get_db)):
    clean_email = data.email.strip().lower()
    existing = db.query(EmailSuppression).filter_by(email=clean_email).first()
    if existing:
        return SuppressionResponse.model_validate(existing)

    supp = EmailSuppression(email=clean_email, reason=data.reason, source=data.source)
    db.add(supp)
    db.commit()
    db.refresh(supp)
    return SuppressionResponse.model_validate(supp)

@router.delete("/suppression/{suppression_id}")
def delete_suppression(suppression_id: int, db: Session = Depends(get_db)):
    supp = db.query(EmailSuppression).filter_by(id=suppression_id).first()
    if not supp:
        raise HTTPException(status_code=404, detail="Suppression entry not found")
    db.delete(supp)
    db.commit()
    return {"message": "Suppression entry removed"}

# ---------------------------------------------------------------------------
# SETTINGS & CIRCUIT BREAKER
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=ProviderSettingResponse)
def get_settings(db: Session = Depends(get_db)):
    setting = db.query(EmailProviderSetting).first()
    if not setting:
        setting = EmailProviderSetting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return ProviderSettingResponse.model_validate(setting)

@router.put("/settings", response_model=ProviderSettingResponse)
def update_settings(data: ProviderSettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(EmailProviderSetting).first()
    if not setting:
        setting = EmailProviderSetting()
        db.add(setting)

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(setting, k, v)

    db.commit()
    db.refresh(setting)
    EmailAuditLogger.log(db, action="UPDATE_SETTINGS", metadata=update_dict)
    return ProviderSettingResponse.model_validate(setting)

@router.post("/settings/test-connection")
async def test_smtp_connection(db: Session = Depends(get_db)):
    setting = db.query(EmailProviderSetting).first()
    if not setting or setting.provider_name == "MockEmailProvider":
        provider = MockEmailProvider()
    else:
        provider = HostingerSMTPProvider(
            smtp_host=setting.smtp_host,
            smtp_port=setting.smtp_port,
            smtp_username=setting.smtp_username,
            smtp_password=setting.smtp_password,
            use_ssl=setting.use_ssl,
            use_tls=setting.use_tls
        )
    
    success = await provider.verify_connection()
    return {
        "success": success,
        "message": "Connection verified successfully" if success else "Failed to verify SMTP connection"
    }

@router.post("/circuit-breaker/reset")
def reset_circuit_breaker(db: Session = Depends(get_db)):
    setting = db.query(EmailProviderSetting).first()
    provider_name = setting.provider_name if setting else "Hostinger"
    EmailCircuitBreaker.reset(db, provider_name)
    EmailAuditLogger.log(db, action="RESET_CIRCUIT_BREAKER")
    return {"message": "Circuit breaker reset to healthy state"}

@router.get("/logs")
def get_audit_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(EmailAuditLog).order_by(EmailAuditLog.id.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "actor": l.actor,
            "action": l.action,
            "campaign_id": l.campaign_id,
            "recipient_id": l.recipient_id,
            "metadata": l.metadata_json,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]
