from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, UploadFile, File, Response
from fastapi.responses import StreamingResponse
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
    EmailAccountCreate,
    EmailAccountUpdate,
    EmailAccountResponse,
    EmailDashboardStats,
    ExcelImportResult
)
from app.services.email.quota_manager import EmailQuotaManager
from app.services.email.circuit_breaker import EmailCircuitBreaker
from app.services.email.suppression_service import EmailSuppressionService
from app.services.email.audit_logger import EmailAuditLogger
from app.services.email.worker import EmailWorker
from app.services.email.providers.hostinger_smtp_provider import HostingerSMTPProvider
from app.services.email.providers.mock_email_provider import MockEmailProvider
from app.services.email.excel_service import ExcelContactService


router = APIRouter(prefix="/api/email", tags=["Email Campaign Queue & Sending"])

# ---------------------------------------------------------------------------
# DASHBOARD & ANALYTICS
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=EmailDashboardStats)
def get_email_dashboard(db: Session = Depends(get_db)):
    try:
        # 1. Aggregate Quota across all active accounts
        aggregate_quota = EmailQuotaManager.get_aggregate_quota_status(db)
        setting = db.query(EmailProviderSetting).first()
        provider_name = setting.provider_name if setting else "Hostinger"

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

        camp_responses = []
        effective_limit = aggregate_quota.get("effective_limit", 300)
        for c in active_camps:
            try:
                c_dict = CampaignResponse.model_validate(c)
                if c.status == "RUNNING" and c.remaining_count > 0 and effective_limit > 0:
                    c_dict.estimated_days_remaining = round(c.remaining_count / effective_limit, 1)
                camp_responses.append(c_dict)
            except Exception:
                pass

        # 4. Provider Status & Rotation Indicator
        cb_tripped, cb_reason = EmailCircuitBreaker.is_tripped(db, provider_name)
        provider_status = {
            "provider_name": provider_name,
            "is_paused": setting.is_paused if setting else False,
            "circuit_breaker_tripped": cb_tripped,
            "pause_reason": setting.pause_reason if setting else None,
            "consecutive_failures": setting.consecutive_failures if setting else 0,
            "current_active_sender": aggregate_quota.get("current_active_sender", "Default")
        }

        return {
            "quota": aggregate_quota,
            "metrics": metrics,
            "provider_status": provider_status,
            "active_campaigns": camp_responses,
            "accounts": aggregate_quota.get("accounts_breakdown", [])
        }
    except Exception as e:
        from app.utils.logger import log_error
        log_error("EMAIL_DASHBOARD", f"Error compiling email dashboard: {e}")
        date_str = EmailQuotaManager.get_local_date_str()
        return {
            "quota": {
                "date": date_str,
                "total_accounts": 0,
                "active_accounts": 0,
                "current_active_sender": "Chưa thiết lập",
                "daily_limit": 300,
                "effective_limit": 270,
                "used_count": 0,
                "reserved_count": 0,
                "remaining_count": 270,
                "percent_used": 0.0,
                "is_exhausted": False,
                "resets_at": f"{date_str} 23:59:59 (+07:00)",
                "accounts_breakdown": []
            },
            "metrics": {
                "total_campaigns": 0,
                "total_recipients": 0,
                "sent_count": 0,
                "queued_count": 0,
                "processing_count": 0,
                "retry_count": 0,
                "failed_count": 0,
                "bounced_count": 0,
                "skipped_count": 0
            },
            "provider_status": {
                "provider_name": "Hostinger",
                "is_paused": False,
                "circuit_breaker_tripped": False,
                "pause_reason": None,
                "consecutive_failures": 0,
                "current_active_sender": "Chưa thiết lập"
            },
            "active_campaigns": [],
            "accounts": []
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
            phone=ExcelContactService.normalize_phone(item.phone),
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

@router.get("/template-excel")
def download_sample_excel():
    """Returns sample Excel template with 3 columns: Tên, Email, Số điện thoại"""
    buf = ExcelContactService.generate_sample_template()
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=mau_danh_sach_email_sdt.xlsx"}
    )

@router.post("/campaigns/{campaign_id}/upload-excel", response_model=ExcelImportResult)
async def upload_campaign_excel(
    campaign_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Uploads and imports Excel (.xlsx, .xls) or CSV file with 3 columns: Tên, Email, Số điện thoại"""
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch email")

    filename = file.filename or "contacts.xlsx"
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File rỗng, vui lòng kiểm tra lại.")

    contacts, parse_errors = ExcelContactService.parse_contacts_file(file_bytes, filename)
    if not contacts and parse_errors:
        raise HTTPException(status_code=400, detail=f"Không thể đọc danh sách: {'; '.join(parse_errors[:3])}")

    added_count = 0
    skipped_duplicates = 0
    zalo_ready_count = 0

    for item in contacts:
        clean_email = item["email"]
        phone = item.get("phone")
        name = item.get("name")

        # Check existing in this campaign
        existing = db.query(EmailCampaignRecipient).filter_by(
            campaign_id=campaign_id, email=clean_email
        ).first()

        if existing:
            # If exists but didn't have phone, update phone
            if phone and not existing.phone:
                existing.phone = phone
                if name and not existing.name:
                    existing.name = name
                zalo_ready_count += 1
            skipped_duplicates += 1
            continue

        recipient = EmailCampaignRecipient(
            campaign_id=campaign_id,
            email=clean_email,
            name=name,
            phone=phone,
            status="QUEUED"
        )
        db.add(recipient)
        db.flush()

        job = EmailJob(
            campaign_id=campaign_id,
            recipient_id=recipient.id,
            status="PENDING",
            available_at=datetime.utcnow()
        )
        db.add(job)
        added_count += 1
        if phone:
            zalo_ready_count += 1

    campaign.total_recipients = (campaign.total_recipients or 0) + added_count
    campaign.queued_count = (campaign.queued_count or 0) + added_count
    campaign.remaining_count = (campaign.remaining_count or 0) + added_count
    db.commit()

    EmailAuditLogger.log(
        db, action="IMPORT_EXCEL", campaign_id=campaign_id,
        metadata={"filename": filename, "added": added_count, "zalo_ready": zalo_ready_count}
    )

    return ExcelImportResult(
        success=True,
        imported_count=added_count,
        skipped_count=skipped_duplicates,
        invalid_count=len(parse_errors),
        zalo_ready_count=zalo_ready_count,
        message=f"Đã nạp thành công {added_count} liên hệ từ Excel. {zalo_ready_count} số điện thoại sẵn sàng cho Zalo OA ({skipped_duplicates} email trùng lặp)."
    )

@router.get("/campaigns/{campaign_id}/export-zalo-oa")
def export_campaign_zalo_oa(
    campaign_id: int,
    db: Session = Depends(get_db)
):
    """Exports all recipients with phone numbers into a specialized Excel format for Zalo OA Broadcast"""
    campaign = db.query(EmailCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch email")

    recipients = db.query(EmailCampaignRecipient).filter(
        EmailCampaignRecipient.campaign_id == campaign_id,
        EmailCampaignRecipient.phone.isnot(None)
    ).all()

    if not recipients:
        raise HTTPException(status_code=400, detail="Chiến dịch này chưa có số điện thoại nào được nạp.")

    import re
    buf = ExcelContactService.export_zalo_oa_contacts(campaign.name, recipients)
    safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', campaign.name)[:30]
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=zalo_oa_{safe_name}_{campaign_id}.xlsx"}
    )


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
# MULTI-ACCOUNT SENDER CONFIGURATIONS (UP TO 10 ACCOUNTS & AUTO-ROTATION)
# ---------------------------------------------------------------------------

def _format_account_response(session: Session, acc: EmailProviderSetting) -> EmailAccountResponse:
    q = EmailQuotaManager.get_account_quota_status(session, acc)
    base = ProviderSettingResponse.model_validate(acc).model_dump()
    base["used_today"] = q.get("used_count", 0)
    base["remaining_today"] = q.get("remaining_count", 0)
    base["effective_limit"] = q.get("effective_limit", 0)
    base["percent_used"] = q.get("percent_used", 0.0)
    base["is_exhausted"] = q.get("is_exhausted", False)
    return EmailAccountResponse(**base)

@router.get("/accounts", response_model=List[EmailAccountResponse])
def list_email_accounts(db: Session = Depends(get_db)):
    """Lists all configured sender email accounts (up to 10) ordered by priority."""
    accounts = db.query(EmailProviderSetting).order_by(
        EmailProviderSetting.priority.asc(),
        EmailProviderSetting.id.asc()
    ).all()
    if not accounts:
        default_acc = EmailProviderSetting()
        db.add(default_acc)
        db.commit()
        db.refresh(default_acc)
        accounts = [default_acc]
    return [_format_account_response(db, a) for a in accounts]

@router.post("/accounts", response_model=EmailAccountResponse)
def create_email_account(data: EmailAccountCreate, db: Session = Depends(get_db)):
    """Creates a new email sending configuration. Max 10 accounts allowed."""
    count = db.query(EmailProviderSetting).count()
    if count >= 10:
        raise HTTPException(
            status_code=400,
            detail="Đã đạt giới hạn tối đa 10 cấu hình email gửi. Vui lòng chỉnh sửa hoặc xóa bớt cấu hình hiện có."
        )

    new_acc = EmailProviderSetting(
        name=data.name,
        priority=data.priority,
        is_active=data.is_active,
        provider_name=data.provider_name,
        smtp_host=data.smtp_host,
        smtp_port=data.smtp_port,
        smtp_username=data.smtp_username,
        smtp_password=data.smtp_password,
        use_ssl=data.use_ssl,
        use_tls=data.use_tls,
        from_email=data.from_email,
        from_name=data.from_name,
        reply_to=data.reply_to,
        daily_limit=data.daily_limit,
        safety_margin_pct=data.safety_margin_pct,
        hourly_limit=data.hourly_limit,
        min_delay_seconds=data.min_delay_seconds,
        max_delay_seconds=data.max_delay_seconds,
        sending_window_start=data.sending_window_start,
        sending_window_end=data.sending_window_end
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)

    EmailAuditLogger.log(db, action="CREATE_ACCOUNT", metadata={"id": new_acc.id, "name": new_acc.name, "email": new_acc.from_email})
    return _format_account_response(db, new_acc)

@router.get("/accounts/{account_id}", response_model=EmailAccountResponse)
def get_email_account(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(EmailProviderSetting).filter_by(id=account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình email gửi")
    return _format_account_response(db, acc)

@router.put("/accounts/{account_id}", response_model=EmailAccountResponse)
def update_email_account(account_id: int, data: EmailAccountUpdate, db: Session = Depends(get_db)):
    acc = db.query(EmailProviderSetting).filter_by(id=account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình email gửi")

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(acc, k, v)

    db.commit()
    db.refresh(acc)
    EmailAuditLogger.log(db, action="UPDATE_ACCOUNT", metadata={"id": acc.id, "updates": update_dict})
    return _format_account_response(db, acc)

@router.delete("/accounts/{account_id}")
def delete_email_account(account_id: int, db: Session = Depends(get_db)):
    count = db.query(EmailProviderSetting).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Không thể xóa cấu hình duy nhất. Hệ thống cần ít nhất 1 tài khoản gửi.")

    acc = db.query(EmailProviderSetting).filter_by(id=account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình email gửi")

    name = acc.name
    db.delete(acc)
    db.commit()
    EmailAuditLogger.log(db, action="DELETE_ACCOUNT", metadata={"id": account_id, "name": name})
    return {"message": f"Đã xóa cấu hình '{name}' thành công."}

@router.post("/accounts/{account_id}/toggle-active", response_model=EmailAccountResponse)
def toggle_email_account_active(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(EmailProviderSetting).filter_by(id=account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình email gửi")

    acc.is_active = not acc.is_active
    db.commit()
    db.refresh(acc)
    EmailAuditLogger.log(db, action="TOGGLE_ACCOUNT_ACTIVE", metadata={"id": acc.id, "is_active": acc.is_active})
    return _format_account_response(db, acc)

@router.post("/accounts/{account_id}/test-connection")
async def test_account_smtp_connection(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(EmailProviderSetting).filter_by(id=account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình email gửi")

    if acc.provider_name == "MockEmailProvider":
        provider = MockEmailProvider()
    else:
        provider = HostingerSMTPProvider(
            smtp_host=acc.smtp_host,
            smtp_port=acc.smtp_port,
            smtp_username=acc.smtp_username,
            smtp_password=acc.smtp_password,
            use_ssl=acc.use_ssl,
            use_tls=acc.use_tls
        )
    
    success = await provider.verify_connection()
    return {
        "success": success,
        "account_id": acc.id,
        "account_name": acc.name,
        "message": f"Kết nối máy chủ SMTP của tài khoản '{acc.name}' thành công!" if success else f"Không thể kết nối đến máy chủ SMTP của tài khoản '{acc.name}'."
    }

@router.post("/accounts/{account_id}/reset-circuit-breaker")
def reset_account_circuit_breaker(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(EmailProviderSetting).filter_by(id=account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình email gửi")

    acc.consecutive_failures = 0
    acc.is_paused = False
    acc.pause_reason = None
    db.commit()
    EmailAuditLogger.log(db, action="RESET_ACCOUNT_CIRCUIT_BREAKER", metadata={"id": acc.id})
    return {"message": f"Đã reset trạng thái Circuit Breaker cho tài khoản '{acc.name}'"}

# ---------------------------------------------------------------------------
# SETTINGS & CIRCUIT BREAKER (LEGACY / PRIMARY ALIASES)
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
