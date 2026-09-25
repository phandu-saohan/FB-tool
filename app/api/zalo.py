from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from app.database.database import get_db
from app.database.models import ZaloGroup, ZaloPost, ZaloPostItem, ZaloSetting
from app.schemas.zalo_schemas import (
    ZaloGroupCreate,
    ZaloGroupResponse,
    ZaloGroupBatchImport,
    ZaloGroupSearchQuery,
    ZaloGroupSearchResultItem,
    ZaloPostCreate,
    ZaloPostResponse,
    ZaloPostItemResponse,
    ZaloScheduleRequest,
    ZaloSettingResponse,
    ZaloSettingUpdate,
    ZaloDashboardStats,
    ZaloAIGenerateRequest,
    ZaloAIGenerateResponse
)
from app.services.zalo.group_search_service import ZaloGroupSearchService
from app.services.zalo.zalo_worker import zalo_worker
from app.services.zalo.zalo_ai_service import ZaloAIService
from app.services.zalo.zalo_bot_service import ZaloBotService
from app.utils.logger import log_info, log_warning, log_error

router = APIRouter(prefix="/zalo", tags=["Zalo Marketing Suite"])

# ---------------------------------------------------------------------------
# 1. DASHBOARD
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=ZaloDashboardStats)
def get_zalo_dashboard(db: Session = Depends(get_db)):
    setting = zalo_worker.get_or_create_settings(db)
    one_day_ago = datetime.utcnow() - timedelta(days=1)

    total_groups = db.query(ZaloGroup).count()
    active_groups = db.query(ZaloGroup).filter(ZaloGroup.status == "ACTIVE").count()

    total_posts = db.query(ZaloPost).count()
    scheduled_posts = db.query(ZaloPost).filter(ZaloPost.status == "SCHEDULED").count()
    completed_posts = db.query(ZaloPost).filter(ZaloPost.status == "COMPLETED").count()

    total_sent = db.query(ZaloPostItem).filter(ZaloPostItem.status == "SENT").count()
    total_failed = db.query(ZaloPostItem).filter(ZaloPostItem.status == "FAILED").count()

    total_processed = total_sent + total_failed
    success_rate = (total_sent / total_processed * 100.0) if total_processed > 0 else 100.0

    daily_sent_today = db.query(ZaloPostItem).filter(
        ZaloPostItem.status == "SENT",
        ZaloPostItem.sent_at >= one_day_ago
    ).count()

    return {
        "total_groups": total_groups,
        "active_groups": active_groups,
        "total_posts": total_posts,
        "scheduled_posts": scheduled_posts,
        "completed_posts": completed_posts,
        "total_sent_items": total_sent,
        "success_rate": round(success_rate, 1),
        "daily_sent_today": daily_sent_today,
        "daily_limit": setting.daily_limit
    }

# ---------------------------------------------------------------------------
# 2. GROUP MANAGEMENT & SEARCH
# ---------------------------------------------------------------------------

@router.get("/groups", response_model=List[ZaloGroupResponse])
def get_zalo_groups(
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(ZaloGroup)
    if search:
        search_fmt = f"%{search.strip()}%"
        q = q.filter(ZaloGroup.name.ilike(search_fmt) | ZaloGroup.group_link.ilike(search_fmt))
    if category and category != "all":
        q = q.filter(ZaloGroup.category == category)
    return q.order_by(ZaloGroup.created_at.desc()).all()

@router.post("/groups", response_model=ZaloGroupResponse)
def create_zalo_group(req: ZaloGroupCreate, db: Session = Depends(get_db)):
    raw_input = req.group_link.strip()
    links = ZaloGroupSearchService.extract_zalo_links(raw_input)
    
    if links:
        normalized_link = links[0]
        group_id_ext = req.group_id_external or (normalized_link.split('/')[-1] if '/' in normalized_link else None)
    elif raw_input.startswith("http://") or raw_input.startswith("https://"):
        normalized_link = raw_input
        group_id_ext = req.group_id_external or raw_input.split('/')[-1]
    else:
        # User entered a pure Chat ID (e.g. -123456789 or 987654321)
        group_id_ext = raw_input
        normalized_link = f"https://zalo.me/chat/{group_id_ext}"

    existing = db.query(ZaloGroup).filter(
        (ZaloGroup.group_link == normalized_link) | 
        ((ZaloGroup.group_id_external == group_id_ext) if group_id_ext else False)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Nhóm Zalo này đã tồn tại trong hệ thống.")

    group = ZaloGroup(
        name=req.name.strip(),
        group_link=normalized_link,
        group_id_external=group_id_ext,
        members_count=req.members_count or 0,
        category=req.category or "Thẩm mỹ",
        description=req.description,
        is_joined=req.is_joined if req.is_joined is not None else True,
        can_post=req.can_post if req.can_post is not None else True,
        status=req.status or "ACTIVE"
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.post("/groups/batch-import")
def batch_import_groups(req: ZaloGroupBatchImport, db: Session = Depends(get_db)):
    res = ZaloGroupSearchService.import_groups_from_text(
        links_text=req.links_text,
        category=req.category or "Thẩm mỹ",
        auto_join=req.auto_join if req.auto_join is not None else True,
        db=db
    )
    return res

@router.post("/groups/search", response_model=List[ZaloGroupSearchResultItem])
def search_zalo_groups(req: ZaloGroupSearchQuery, db: Session = Depends(get_db)):
    results = ZaloGroupSearchService.search_groups(
        keyword=req.keyword,
        category=req.category,
        limit=req.limit or 20,
        db=db
    )
    return results

@router.delete("/groups/{group_id}")
def delete_zalo_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(ZaloGroup).filter(ZaloGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Nhóm Zalo không tồn tại.")
    db.delete(group)
    db.commit()
    return {"success": True, "message": f"Đã xóa nhóm '{group.name}'."}

# ---------------------------------------------------------------------------
# 3. POST CREATION, SCHEDULING & EXECUTION
# ---------------------------------------------------------------------------

@router.get("/posts", response_model=List[ZaloPostResponse])
def get_zalo_posts(db: Session = Depends(get_db)):
    return db.query(ZaloPost).order_by(ZaloPost.created_at.desc()).limit(100).all()

@router.get("/posts/{post_id}", response_model=ZaloPostResponse)
def get_zalo_post_detail(post_id: int, db: Session = Depends(get_db)):
    post = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Bài đăng không tồn tại.")
    return post

@router.post("/posts", response_model=ZaloPostResponse)
def create_zalo_post(req: ZaloPostCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    title = req.title.strip()
    content = req.content.strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Tiêu đề và nội dung bài đăng không được để trống.")

    # Target groups
    target_group_ids = req.group_ids
    if not target_group_ids:
        # If no groups specified, select all active groups by default
        active_groups = db.query(ZaloGroup.id).filter(ZaloGroup.status == "ACTIVE").all()
        target_group_ids = [g[0] for g in active_groups]

    action = (req.action or "draft").lower()
    initial_status = "DRAFT"
    scheduled_at = None

    if action == "schedule":
        initial_status = "SCHEDULED"
        scheduled_at = req.scheduled_at or (datetime.utcnow() + timedelta(minutes=15))
    elif action == "publish_now":
        initial_status = "PROCESSING"
        scheduled_at = datetime.utcnow()

    media_json = json.dumps(req.media_urls) if req.media_urls else None

    post = ZaloPost(
        title=title,
        content=content,
        media_urls=media_json,
        call_to_action_url=req.call_to_action_url,
        status=initial_status,
        scheduled_at=scheduled_at,
        delay_seconds=req.delay_seconds or 20,
        target_groups_count=len(target_group_ids),
        success_count=0,
        failed_count=0
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Create Post Items (Queue for each group)
    for g_id in target_group_ids:
        item = ZaloPostItem(
            post_id=post.id,
            group_id=g_id,
            status="PENDING"
        )
        db.add(item)
    db.commit()
    db.refresh(post)

    # If action is publish_now, trigger background execution
    if action == "publish_now":
        zalo_worker.trigger_publish_now(post.id)

    return post

@router.post("/posts/{post_id}/publish-now")
def publish_post_now(post_id: int, db: Session = Depends(get_db)):
    post = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Bài đăng không tồn tại.")

    post.status = "PROCESSING"
    post.scheduled_at = datetime.utcnow()
    db.commit()

    zalo_worker.trigger_publish_now(post.id)
    return {"success": True, "message": f"Đang tiến hành gửi bài viết tới {post.target_groups_count} nhóm Zalo..."}

@router.post("/posts/{post_id}/schedule")
def schedule_post(post_id: int, req: ZaloScheduleRequest, db: Session = Depends(get_db)):
    post = db.query(ZaloPost).filter(ZaloPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Bài đăng không tồn tại.")

    post.status = "SCHEDULED"
    post.scheduled_at = req.scheduled_at
    if req.delay_seconds:
        post.delay_seconds = req.delay_seconds

    # Optionally update target groups if provided
    if req.group_ids:
        # Delete old items
        db.query(ZaloPostItem).filter(ZaloPostItem.post_id == post.id).delete()
        for g_id in req.group_ids:
            item = ZaloPostItem(post_id=post.id, group_id=g_id, status="PENDING")
            db.add(item)
        post.target_groups_count = len(req.group_ids)

    db.commit()
    return {"success": True, "message": f"Đã lên lịch đăng bài lúc {req.scheduled_at.isoformat()}"}

@router.post("/posts/{post_id}/pause")
def pause_post_campaign(post_id: int):
    return zalo_worker.pause_campaign(post_id)

@router.post("/posts/{post_id}/cancel")
def cancel_post_campaign(post_id: int):
    return zalo_worker.cancel_campaign(post_id)

# ---------------------------------------------------------------------------
# 4. AI CONTENT STUDIO FOR ZALO
# ---------------------------------------------------------------------------

@router.post("/ai/generate", response_model=ZaloAIGenerateResponse)
async def generate_zalo_ai_post(req: ZaloAIGenerateRequest):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập chủ đề cần viết bài.")

    res = await ZaloAIService.generate_zalo_post(
        topic=req.topic,
        conference_name=req.conference_name or "Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026",
        cta_url=req.cta_url or "https://kbit2026.vercel.app",
        tone=req.tone or "Friendly & Professional",
        target_audience=req.target_audience or "Bác sĩ, Dược sĩ, Chủ Spa & Clinic"
    )
    return res

# ---------------------------------------------------------------------------
# 5. SETTINGS
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=ZaloSettingResponse)
def get_zalo_settings(db: Session = Depends(get_db)):
    return zalo_worker.get_or_create_settings(db)

@router.put("/settings", response_model=ZaloSettingResponse)
def update_zalo_settings(req: ZaloSettingUpdate, db: Session = Depends(get_db)):
    setting = zalo_worker.get_or_create_settings(db)
    for key, val in req.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(setting, key, val)
    db.commit()
    db.refresh(setting)
    return setting

# ---------------------------------------------------------------------------
# 6. OFFICIAL ZALO BOT PLATFORM (bot.zaloplatforms.com)
# ---------------------------------------------------------------------------

@router.post("/bot/test")
async def test_zalo_bot(token_data: Dict[str, Optional[str]] = None, db: Session = Depends(get_db)):
    """
    Validates a Zalo Bot Token via GET /bot{TOKEN}/getMe and saves bot info.
    """
    token = (token_data or {}).get("bot_token")
    if not token:
        setting = zalo_worker.get_or_create_settings(db)
        token = setting.bot_token

    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp Zalo Bot Token để kiểm tra.")

    res = await ZaloBotService.get_me(token.strip())
    if res.get("success"):
        setting = zalo_worker.get_or_create_settings(db)
        setting.bot_token = token.strip()
        setting.bot_name = res.get("bot_name")
        setting.bot_username = res.get("bot_username")
        db.commit()
    return res

@router.get("/bot/webhook")
def verify_zalo_bot_webhook():
    return {"status": "ok", "message": "Zalo Bot Webhook endpoint is live and ready."}

@router.post("/bot/webhook")
async def receive_zalo_bot_webhook(
    request: Request,
    update: Dict[str, Any],
    secret_token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Receives events from Zalo Bot Platform webhook.
    Validates Secret Token if configured, automatically captures group chats and synchronizes incoming messages.
    """
    setting = zalo_worker.get_or_create_settings(db)
    if setting.bot_webhook_secret and setting.bot_webhook_secret.strip():
        # Check standard headers used by Bot platforms
        header_token = (
            request.headers.get("x-bot-api-secret-token") or
            request.headers.get("x-telegram-bot-api-secret-token") or
            request.headers.get("x-zalo-bot-api-secret-token") or
            request.headers.get("x-secret-token") or
            secret_token
        )
        if not header_token or header_token.strip() != setting.bot_webhook_secret.strip():
            log_warning("ZALO_BOT", f"Webhook unauthorized attempt: missing or invalid Secret Token.")
            raise HTTPException(status_code=403, detail="Forbidden: Invalid or missing Secret Token")

    res = ZaloBotService.handle_webhook_update(db, update)
    return res

@router.post("/bot/set-webhook")
async def set_zalo_bot_webhook(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Registers this server's public webhook with Zalo Bot Platform with optional Secret Token.
    """
    webhook_url = payload.get("webhook_url", "").strip()
    secret_token = payload.get("secret_token", "").strip()

    if not webhook_url:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp URL webhook.")

    setting = zalo_worker.get_or_create_settings(db)
    if not setting.bot_token:
        raise HTTPException(status_code=400, detail="Chưa có Zalo Bot Token. Vui lòng nhập và lưu Bot Token trước.")

    if not secret_token and setting.bot_webhook_secret:
        secret_token = setting.bot_webhook_secret

    res = await ZaloBotService.set_webhook(setting.bot_token, webhook_url, secret_token)
    if res.get("success"):
        setting.bot_webhook_secret = secret_token or None
        db.commit()
    return res

