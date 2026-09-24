import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database.database import get_db
from app.database.models import (
    ChatChannel,
    ChatContact,
    ChatConversation,
    ChatMessage,
    ChatQuickReply,
    ChatSetting
)
from app.schemas.chat_schemas import (
    ChatChannelCreate,
    ChatChannelUpdate,
    ChatChannelResponse,
    ChatContactResponse,
    ChatContactUpdate,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatConversationResponse,
    ChatConversationDetailResponse,
    ChatConversationUpdate,
    ChatQuickReplyCreate,
    ChatQuickReplyResponse,
    ChatSettingResponse,
    ChatSettingUpdate,
    ChatStatsResponse,
    SimulateIncomingRequest,
    AISuggestRequest,
    AISuggestResponse,
    FBCookiesImportRequest,
    FBPersonalStatusResponse,
    FBPersonalSyncResponse
)
from app.services.chat.omnichannel_service import OmnichannelService
from app.services.chat.chat_ai_service import ChatAIService
from app.services.chat.fb_personal_sync_service import FBPersonalSyncService
from app.api.browser import parse_cookie_input
from app.automation.browser_manager import browser_manager

router = APIRouter(prefix="/api/chat", tags=["Omnichannel Chat"])


# ---------------------------------------------------------------------------
# STATS & DASHBOARD
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=ChatStatsResponse)
def get_chat_stats(db: Session = Depends(get_db)):
    OmnichannelService.ensure_initial_seed_data(db)

    total_convs = db.query(ChatConversation).count()
    open_convs = db.query(ChatConversation).filter(ChatConversation.status == 'OPEN').count()
    unread_sum = db.query(func.sum(ChatConversation.unread_count)).scalar() or 0
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    messages_today = db.query(ChatMessage).filter(ChatMessage.created_at >= today_start).count()
    channels_count = db.query(ChatChannel).filter(ChatChannel.is_active == True).count()

    # Breakdown by channel
    channels = db.query(ChatChannel).all()
    by_channel = {
        "FB_PAGE": {"name": "Facebook Fanpage", "conversations": 0, "unread": 0},
        "FB_PERSONAL": {"name": "Facebook Cá nhân", "conversations": 0, "unread": 0},
        "ZALO": {"name": "Zalo OA / Chat", "conversations": 0, "unread": 0},
        "WHATSAPP": {"name": "WhatsApp Business", "conversations": 0, "unread": 0}
    }

    for ch in channels:
        conv_count = db.query(ChatConversation).filter(ChatConversation.channel_id == ch.id).count()
        unread_c = db.query(func.sum(ChatConversation.unread_count)).filter(
            ChatConversation.channel_id == ch.id
        ).scalar() or 0

        ctype = ch.channel_type
        if ctype in by_channel:
            by_channel[ctype]["conversations"] += conv_count
            by_channel[ctype]["unread"] += unread_c

    return {
        "total_conversations": total_convs,
        "open_conversations": open_convs,
        "unread_messages": int(unread_sum),
        "messages_today": messages_today,
        "channels_count": channels_count,
        "by_channel": by_channel
    }


# ---------------------------------------------------------------------------
# CHANNELS MANAGEMENT
# ---------------------------------------------------------------------------

@router.get("/channels", response_model=List[ChatChannelResponse])
def get_channels(db: Session = Depends(get_db)):
    OmnichannelService.ensure_initial_seed_data(db)
    return db.query(ChatChannel).order_by(ChatChannel.id.asc()).all()

@router.post("/channels", response_model=ChatChannelResponse)
def create_channel(ch_in: ChatChannelCreate, db: Session = Depends(get_db)):
    ch = ChatChannel(
        channel_type=ch_in.channel_type,
        name=ch_in.name,
        account_identifier=ch_in.account_identifier,
        avatar_url=ch_in.avatar_url,
        access_token=ch_in.access_token,
        webhook_secret=ch_in.webhook_secret,
        phone_number=ch_in.phone_number,
        metadata_json=ch_in.metadata_json,
        status="CONNECTED",
        is_active=True
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return ch

@router.put("/channels/{id}", response_model=ChatChannelResponse)
def update_channel(id: int, ch_in: ChatChannelUpdate, db: Session = Depends(get_db)):
    ch = db.query(ChatChannel).filter(ChatChannel.id == id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Kênh không tồn tại")
    
    update_data = ch_in.dict(exclude_unset=True)
    for field, val in update_data.items():
        setattr(ch, field, val)
    ch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ch)
    return ch

@router.delete("/channels/{id}")
def delete_channel(id: int, db: Session = Depends(get_db)):
    ch = db.query(ChatChannel).filter(ChatChannel.id == id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Kênh không tồn tại")
    db.delete(ch)
    db.commit()
    return {"message": "Đã xóa kênh thành công"}


# ---------------------------------------------------------------------------
# FACEBOOK PERSONAL SYNC & COOKIES
# ---------------------------------------------------------------------------

@router.get("/channels/fb-personal/status", response_model=FBPersonalStatusResponse)
async def get_fb_personal_status(db: Session = Depends(get_db)):
    return await FBPersonalSyncService.get_connection_status(db)

@router.post("/channels/fb-personal/sync", response_model=FBPersonalSyncResponse)
async def sync_fb_personal_messages(db: Session = Depends(get_db)):
    try:
        result = await FBPersonalSyncService.sync_messages(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đồng bộ tin nhắn FB cá nhân: {e}")

@router.post("/channels/fb-personal/cookies", response_model=FBPersonalSyncResponse)
async def import_fb_personal_cookies(req: FBCookiesImportRequest, db: Session = Depends(get_db)):
    parsed_cookies = parse_cookie_input(req.cookies)
    if not parsed_cookies:
        raise HTTPException(status_code=400, detail="Cookie không đúng định dạng JSON hoặc chuỗi c_user=...; xs=...")

    try:
        if not browser_manager.is_running():
            await browser_manager.start()

        # Add cookies to persistent browser context
        await browser_manager.context.add_cookies(parsed_cookies)

        # Trigger sync immediately
        result = await FBPersonalSyncService.sync_messages(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi nhập cookie FB cá nhân: {e}")


# ---------------------------------------------------------------------------
# CONVERSATIONS LIST & DETAILS
# ---------------------------------------------------------------------------

@router.get("/conversations", response_model=List[ChatConversationResponse])
def get_conversations(
    channel_type: Optional[str] = Query(None, description="FB_PAGE, FB_PERSONAL, ZALO, WHATSAPP, or empty for all"),
    status: Optional[str] = Query(None, description="OPEN, RESOLVED, SNOOZED"),
    search: Optional[str] = Query(None, description="Search by contact name, phone, or message"),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    OmnichannelService.ensure_initial_seed_data(db)

    query = db.query(ChatConversation).join(ChatContact, ChatConversation.contact_id == ChatContact.id)
    if channel_type and channel_type != 'ALL':
        query = query.join(ChatChannel, ChatConversation.channel_id == ChatChannel.id).filter(
            ChatChannel.channel_type == channel_type
        )
    if status and status != 'ALL':
        query = query.filter(ChatConversation.status == status)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (ChatContact.name.ilike(s)) |
            (ChatContact.phone.ilike(s)) |
            (ChatConversation.last_message_text.ilike(s))
        )

    convs = query.order_by(desc(ChatConversation.last_message_at)).offset(offset).limit(limit).all()

    # Format response items
    result = []
    for c in convs:
        c_dict = {
            "id": c.id,
            "channel_id": c.channel_id,
            "contact_id": c.contact_id,
            "title": c.title,
            "unread_count": c.unread_count,
            "last_message_text": c.last_message_text,
            "last_message_at": c.last_message_at,
            "last_message_sender": c.last_message_sender,
            "status": c.status,
            "assigned_agent": c.assigned_agent,
            "ai_auto_reply": c.ai_auto_reply,
            "channel_type": c.channel.channel_type if c.channel else None,
            "channel_name": c.channel.name if c.channel else None,
            "contact_name": c.contact.name if c.contact else "Khách hàng",
            "contact_avatar": c.contact.avatar_url if c.contact else None,
            "contact_phone": c.contact.phone if c.contact else None,
            "created_at": c.created_at,
            "updated_at": c.updated_at
        }
        result.append(c_dict)

    return result

@router.get("/conversations/{id}", response_model=ChatConversationDetailResponse)
def get_conversation_detail(id: int, db: Session = Depends(get_db)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Cuộc hội thoại không tồn tại")

    messages = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == id
    ).order_by(ChatMessage.created_at.asc()).all()

    return {
        "id": conv.id,
        "channel_id": conv.channel_id,
        "contact_id": conv.contact_id,
        "title": conv.title,
        "unread_count": conv.unread_count,
        "last_message_text": conv.last_message_text,
        "last_message_at": conv.last_message_at,
        "last_message_sender": conv.last_message_sender,
        "status": conv.status,
        "assigned_agent": conv.assigned_agent,
        "ai_auto_reply": conv.ai_auto_reply,
        "channel_type": conv.channel.channel_type if conv.channel else None,
        "channel_name": conv.channel.name if conv.channel else None,
        "contact_name": conv.contact.name if conv.contact else None,
        "contact_avatar": conv.contact.avatar_url if conv.contact else None,
        "contact_phone": conv.contact.phone if conv.contact else None,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "contact": conv.contact,
        "channel": conv.channel,
        "messages": messages
    }

@router.post("/conversations/{id}/sync", response_model=ChatConversationDetailResponse)
async def sync_conversation_messages(id: int, db: Session = Depends(get_db)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Cuộc hội thoại không tồn tại")

    if conv.channel and conv.channel.channel_type == 'FB_PERSONAL':
        await FBPersonalSyncService.sync_conversation_history(db, id)

    return get_conversation_detail(id, db)

@router.patch("/conversations/{id}", response_model=ChatConversationResponse)
def update_conversation(id: int, c_in: ChatConversationUpdate, db: Session = Depends(get_db)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Cuộc hội thoại không tồn tại")
    
    if c_in.status is not None:
        conv.status = c_in.status
    if c_in.assigned_agent is not None:
        conv.assigned_agent = c_in.assigned_agent
    if c_in.ai_auto_reply is not None:
        conv.ai_auto_reply = c_in.ai_auto_reply
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)

    return {
        "id": conv.id,
        "channel_id": conv.channel_id,
        "contact_id": conv.contact_id,
        "title": conv.title,
        "unread_count": conv.unread_count,
        "last_message_text": conv.last_message_text,
        "last_message_at": conv.last_message_at,
        "last_message_sender": conv.last_message_sender,
        "status": conv.status,
        "assigned_agent": conv.assigned_agent,
        "ai_auto_reply": conv.ai_auto_reply,
        "channel_type": conv.channel.channel_type if conv.channel else None,
        "channel_name": conv.channel.name if conv.channel else None,
        "contact_name": conv.contact.name if conv.contact else None,
        "contact_avatar": conv.contact.avatar_url if conv.contact else None,
        "contact_phone": conv.contact.phone if conv.contact else None,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at
    }

@router.post("/conversations/{id}/mark-read")
def mark_conversation_as_read(id: int, db: Session = Depends(get_db)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Cuộc hội thoại không tồn tại")
    conv.unread_count = 0
    db.commit()
    return {"message": "Đã đánh dấu đã đọc"}


# ---------------------------------------------------------------------------
# MESSAGES (OUTBOUND & INBOUND)
# ---------------------------------------------------------------------------

@router.post("/conversations/{id}/messages", response_model=ChatMessageResponse)
async def send_message(id: int, msg_in: ChatMessageCreate, db: Session = Depends(get_db)):
    try:
        msg = await OmnichannelService.send_outbound_message(
            db=db,
            conversation_id=id,
            content=msg_in.content,
            message_type=msg_in.message_type,
            media_url=msg_in.media_url,
            sender_name=msg_in.sender_name
        )
        return msg
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi gửi tin nhắn: {e}")


# ---------------------------------------------------------------------------
# AI COPILOT & QUICK REPLIES
# ---------------------------------------------------------------------------

@router.post("/conversations/{id}/ai-suggest", response_model=AISuggestResponse)
async def get_ai_suggestions(id: int, req: AISuggestRequest = None, db: Session = Depends(get_db)):
    custom_instruction = req.custom_instruction if req else None
    try:
        data = await ChatAIService.suggest_replies(db=db, conversation_id=id, custom_instruction=custom_instruction)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tạo phản hồi AI: {e}")

@router.get("/quick-replies", response_model=List[ChatQuickReplyResponse])
def get_quick_replies(channel_type: Optional[str] = None, db: Session = Depends(get_db)):
    OmnichannelService.ensure_initial_seed_data(db)
    query = db.query(ChatQuickReply)
    if channel_type and channel_type != 'ALL':
        query = query.filter((ChatQuickReply.channel_type == channel_type) | (ChatQuickReply.channel_type == 'ALL'))
    return query.order_by(ChatQuickReply.shortcut.asc()).all()

@router.post("/quick-replies", response_model=ChatQuickReplyResponse)
def create_quick_reply(qr_in: ChatQuickReplyCreate, db: Session = Depends(get_db)):
    qr = ChatQuickReply(
        shortcut=qr_in.shortcut.strip(),
        title=qr_in.title.strip(),
        content=qr_in.content.strip(),
        channel_type=qr_in.channel_type,
        category=qr_in.category
    )
    db.add(qr)
    db.commit()
    db.refresh(qr)
    return qr

@router.delete("/quick-replies/{id}")
def delete_quick_reply(id: int, db: Session = Depends(get_db)):
    qr = db.query(ChatQuickReply).filter(ChatQuickReply.id == id).first()
    if not qr:
        raise HTTPException(status_code=404, detail="Tin nhắn mẫu không tồn tại")
    db.delete(qr)
    db.commit()
    return {"message": "Đã xóa tin nhắn mẫu"}


# ---------------------------------------------------------------------------
# CONTACT CRM MANAGEMENT
# ---------------------------------------------------------------------------

@router.patch("/contacts/{id}", response_model=ChatContactResponse)
def update_contact(id: int, c_in: ChatContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(ChatContact).filter(ChatContact.id == id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Khách hàng không tồn tại")
    
    update_data = c_in.dict(exclude_unset=True)
    for field, val in update_data.items():
        setattr(contact, field, val)
    contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contact)
    return contact


# ---------------------------------------------------------------------------
# SIMULATION FOR TESTING & DEMO
# ---------------------------------------------------------------------------

@router.post("/simulate-incoming", response_model=ChatMessageResponse)
def simulate_incoming_message(req: SimulateIncomingRequest, db: Session = Depends(get_db)):
    """
    Simulates receiving an inbound message from Facebook Page, Facebook Personal, Zalo, or WhatsApp.
    Useful for demonstration and verifying real-time reception!
    """
    msg = OmnichannelService.simulate_incoming_message(
        db=db,
        channel_type=req.channel_type,
        sender_name=req.sender_name,
        message_text=req.message_text,
        phone=req.sender_phone,
        avatar_url=req.sender_avatar,
        media_url=req.media_url
    )
    return msg


# ---------------------------------------------------------------------------
# WEBHOOK ENDPOINTS (META, ZALO, WHATSAPP)
# ---------------------------------------------------------------------------

@router.get("/webhooks/{platform}")
def verify_webhook(platform: str, request: Request):
    """
    Standard Meta / Zalo webhook challenge verification.
    """
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and challenge:
        return Response(content=challenge, media_type="text/plain")

    return {"status": "ok", "platform": platform}

@router.post("/webhooks/{platform}")
async def receive_webhook(platform: str, request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        body = {}

    platform_upper = platform.upper()
    ch_type = "FB_PAGE"
    if "ZALO" in platform_upper:
        ch_type = "ZALO"
    elif "WHATSAPP" in platform_upper:
        ch_type = "WHATSAPP"
    elif "PERSONAL" in platform_upper:
        ch_type = "FB_PERSONAL"

    channel = db.query(ChatChannel).filter(ChatChannel.channel_type == ch_type).first()
    if channel:
        connector = OmnichannelService.get_connector(channel)
        parsed = connector.parse_inbound_webhook(body)
        OmnichannelService.handle_inbound_message(
            db=db,
            channel_id=channel.id,
            sender_id=parsed["sender_id"],
            sender_name=parsed["sender_name"],
            content=parsed["content"],
            message_type=parsed.get("message_type", "TEXT"),
            media_url=parsed.get("media_url"),
            external_id=parsed.get("external_id")
        )

    return {"status": "received", "platform": platform}


# ---------------------------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=ChatSettingResponse)
def get_chat_settings(db: Session = Depends(get_db)):
    OmnichannelService.ensure_initial_seed_data(db)
    setting = db.query(ChatSetting).first()
    if not setting:
        setting = ChatSetting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting

@router.put("/settings", response_model=ChatSettingResponse)
def update_chat_settings(s_in: ChatSettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(ChatSetting).first()
    if not setting:
        setting = ChatSetting()
        db.add(setting)

    for field, val in s_in.dict(exclude_unset=True).items():
        setattr(setting, field, val)
    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)
    return setting
