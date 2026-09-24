import logging
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.database.models import (
    ChatChannel,
    ChatContact,
    ChatConversation,
    ChatMessage,
    ChatQuickReply,
    ChatSetting
)
from app.services.chat.base_connector import BaseChatConnector
from app.services.chat.fb_page_connector import FBPageConnector
from app.services.chat.fb_personal_connector import FBPersonalConnector
from app.services.chat.zalo_connector import ZaloConnector
from app.services.chat.whatsapp_connector import WhatsAppConnector

logger = logging.getLogger(__name__)

class OmnichannelService:
    """
    Central orchestration service for Omnichannel messaging:
    - Routing outbound messages to appropriate connectors
    - Ingesting inbound messages from webhooks or simulators
    - Syncing contacts & conversations
    - Automated quick replies & AI suggestions
    """

    @staticmethod
    def get_connector(channel: ChatChannel) -> BaseChatConnector:
        cfg = {
            "access_token": channel.access_token,
            "account_identifier": channel.account_identifier,
            "webhook_secret": channel.webhook_secret,
            "phone_number": channel.phone_number
        }
        if channel.channel_type == 'FB_PAGE':
            return FBPageConnector(cfg)
        elif channel.channel_type == 'FB_PERSONAL':
            return FBPersonalConnector(cfg)
        elif channel.channel_type == 'ZALO':
            return ZaloConnector(cfg)
        elif channel.channel_type == 'WHATSAPP':
            return WhatsAppConnector(cfg)
        else:
            return FBPageConnector(cfg)

    @classmethod
    async def send_outbound_message(
        cls,
        db: Session,
        conversation_id: int,
        content: str,
        message_type: str = "TEXT",
        media_url: Optional[str] = None,
        sender_name: Optional[str] = "Chuyên viên tư vấn"
    ) -> ChatMessage:
        conv = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
        if not conv:
            raise ValueError(f"Không tìm thấy cuộc hội thoại #{conversation_id}")

        channel = conv.channel
        contact = conv.contact

        # Route outbound message via platform connector
        connector = cls.get_connector(channel)
        import inspect
        if inspect.iscoroutinefunction(connector.send_message):
            result = await connector.send_message(
                recipient_id=contact.external_user_id or contact.phone or "user",
                content=content,
                media_url=media_url
            )
        else:
            result = connector.send_message(
                recipient_id=contact.external_user_id or contact.phone or "user",
                content=content,
                media_url=media_url
            )

        if not result.get("success"):
            error_msg = result.get("error") or "Không thể gửi tin nhắn qua kênh này"
            # Record failed message in database
            fail_msg = ChatMessage(
                conversation_id=conv.id,
                sender_type="AGENT",
                sender_name=sender_name or "Chuyên viên tư vấn",
                sender_avatar="/assets/agent-avatar.png",
                content=content,
                message_type=message_type,
                media_url=media_url,
                delivery_status="FAILED",
                error_message=error_msg,
                is_inbound=False,
                created_at=datetime.utcnow()
            )
            db.add(fail_msg)
            db.commit()
            db.refresh(fail_msg)
            raise ValueError(error_msg)

        # Create message record
        msg = ChatMessage(
            conversation_id=conv.id,
            sender_type="AGENT",
            sender_name=sender_name or "Chuyên viên tư vấn",
            sender_avatar="/assets/agent-avatar.png",
            content=content,
            message_type=message_type,
            media_url=media_url,
            delivery_status="SENT",
            external_message_id=result.get("message_id"),
            error_message=None,
            is_inbound=False,
            created_at=datetime.utcnow()
        )
        db.add(msg)

        # Update conversation status
        conv.last_message_text = content
        conv.last_message_at = datetime.utcnow()
        conv.last_message_sender = "AGENT"
        conv.unread_count = 0  # Staff has read/replied
        if conv.status == 'SNOOZED':
            conv.status = 'OPEN'

        db.commit()
        db.refresh(msg)
        return msg

    @classmethod
    def handle_inbound_message(
        cls,
        db: Session,
        channel_id: int,
        sender_id: str,
        sender_name: str,
        content: str,
        message_type: str = "TEXT",
        media_url: Optional[str] = None,
        external_id: Optional[str] = None,
        phone: Optional[str] = None,
        avatar_url: Optional[str] = None
    ) -> ChatMessage:
        channel = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
        if not channel:
            raise ValueError(f"Không tìm thấy kênh #{channel_id}")

        # Find or create contact
        contact = db.query(ChatContact).filter(
            ChatContact.channel_id == channel_id,
            ChatContact.external_user_id == sender_id
        ).first()

        if not contact:
            contact = ChatContact(
                channel_id=channel_id,
                external_user_id=sender_id,
                name=sender_name or f"Khách hàng #{sender_id[-4:]}",
                avatar_url=avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={sender_id}",
                phone=phone,
                tags=json.dumps(["Khách mới"]),
                customer_stage="CONSULTING",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(contact)
            db.flush()
        else:
            if sender_name and contact.name.startswith("Khách"):
                contact.name = sender_name
            if phone and not contact.phone:
                contact.phone = phone
            contact.updated_at = datetime.utcnow()

        # Find or create conversation
        conv = db.query(ChatConversation).filter(
            ChatConversation.channel_id == channel_id,
            ChatConversation.contact_id == contact.id
        ).first()

        if not conv:
            conv = ChatConversation(
                channel_id=channel_id,
                contact_id=contact.id,
                title=f"Chat với {contact.name}",
                unread_count=1,
                last_message_text=content,
                last_message_at=datetime.utcnow(),
                last_message_sender="CONTACT",
                status="OPEN",
                assigned_agent="CSKH Tổng",
                ai_auto_reply=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(conv)
            db.flush()
        else:
            conv.unread_count += 1
            conv.last_message_text = content
            conv.last_message_at = datetime.utcnow()
            conv.last_message_sender = "CONTACT"
            if conv.status == 'RESOLVED':
                conv.status = 'OPEN'
            conv.updated_at = datetime.utcnow()

        # Create message record
        msg = ChatMessage(
            conversation_id=conv.id,
            sender_type="CONTACT",
            sender_name=contact.name,
            sender_avatar=contact.avatar_url,
            content=content,
            message_type=message_type,
            media_url=media_url,
            delivery_status="DELIVERED",
            external_message_id=external_id or f"msg_{uuid.uuid4().hex[:10]}",
            is_inbound=True,
            created_at=datetime.utcnow()
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg

    @classmethod
    def simulate_incoming_message(
        cls,
        db: Session,
        channel_type: str,
        sender_name: str,
        message_text: str,
        phone: Optional[str] = None,
        avatar_url: Optional[str] = None,
        media_url: Optional[str] = None
    ) -> ChatMessage:
        # Find active channel of this type or first channel
        channel = db.query(ChatChannel).filter(ChatChannel.channel_type == channel_type).first()
        if not channel:
            # Create a channel automatically if none exists
            channel = ChatChannel(
                channel_type=channel_type,
                name=f"Kênh {channel_type}",
                account_identifier=f"id_{channel_type.lower()}_demo",
                status="CONNECTED",
                is_active=True
            )
            db.add(channel)
            db.commit()
            db.refresh(channel)

        clean_sender_id = f"sim_{channel_type.lower()}_{uuid.uuid4().hex[:6]}"
        return cls.handle_inbound_message(
            db=db,
            channel_id=channel.id,
            sender_id=clean_sender_id,
            sender_name=sender_name,
            content=message_text,
            message_type="IMAGE" if media_url else "TEXT",
            media_url=media_url,
            external_id=f"sim_mid_{uuid.uuid4().hex[:10]}",
            phone=phone,
            avatar_url=avatar_url
        )

    @classmethod
    def ensure_initial_seed_data(cls, db: Session):
        """
        Seeds standard channels, canned replies, and default settings if empty.
        """
        # 1. Channels
        if db.query(ChatChannel).count() == 0:
            channels = [
                ChatChannel(
                    channel_type="FB_PAGE",
                    name="Nha Khoa & Thẩm Mỹ Dr. Smile (Fanpage)",
                    account_identifier="108492048192841",
                    status="CONNECTED",
                    avatar_url="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=100&auto=format&fit=crop&q=80",
                    is_active=True
                ),
                ChatChannel(
                    channel_type="FB_PERSONAL",
                    name="Bác sĩ Tuấn Anh (FB Cá nhân)",
                    account_identifier="fb.tuananh.dentist",
                    status="CONNECTED",
                    avatar_url="https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=100&auto=format&fit=crop&q=80",
                    is_active=True
                ),
                ChatChannel(
                    channel_type="ZALO",
                    name="Zalo OA CSKH & Đặt Lịch",
                    account_identifier="2938491029481920",
                    phone_number="0988123456",
                    status="CONNECTED",
                    avatar_url="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100&auto=format&fit=crop&q=80",
                    is_active=True
                ),
                ChatChannel(
                    channel_type="WHATSAPP",
                    name="WhatsApp International Hotline",
                    account_identifier="wa_phone_id_84988",
                    phone_number="+84988123456",
                    status="CONNECTED",
                    avatar_url="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=100&auto=format&fit=crop&q=80",
                    is_active=True
                ),
            ]
            db.add_all(channels)
            db.commit()

        # 2. Quick replies
        if db.query(ChatQuickReply).count() == 0:
            quick_replies = [
                ChatQuickReply(
                    shortcut="/chao",
                    title="Lời chào chuẩn CSKH",
                    content="Dạ em chào anh/chị ạ! Cảm ơn anh/chị đã quan tâm đến dịch vụ. Em có thể hỗ trợ tư vấn thông tin gì cho mình hôm nay ạ?",
                    category="Lời chào"
                ),
                ChatQuickReply(
                    shortcut="/banggia",
                    title="Báo giá dịch vụ & Ưu đãi",
                    content="Dạ hiện bên em đang có chương trình trợ giá đặc biệt trong tháng này: Miễn phí khám & chụp X-quang, giảm ngay 25% cho liệu trình trọn gói. Anh/chị cho em xin số điện thoại để bác sĩ chuyên khoa gọi tư vấn trực tiếp nhé ạ!",
                    category="Báo giá"
                ),
                ChatQuickReply(
                    shortcut="/diachi",
                    title="Địa chỉ & Giờ làm việc",
                    content="Dạ cơ sở bên em tại: Số 126 Nguyễn Trãi, Thanh Xuân, Hà Nội (Có chỗ đỗ ô tô miễn phí). Thời gian làm việc từ 8:00 - 20:30 tất cả các ngày trong tuần ạ.",
                    category="Thông tin"
                ),
                ChatQuickReply(
                    shortcut="/datlich",
                    title="Xác nhận lịch hẹn khám",
                    content="Dạ em đã ghi nhận lịch hẹn của anh/chị vào lúc [GIỜ] ngày [NGÀY]. Trước khi đến 1 tiếng, bên em sẽ có chuyên viên gọi nhắc lịch để mình tiện sắp xếp ạ. Chúc anh/chị một ngày tốt lành!",
                    category="Đặt lịch"
                )
            ]
            db.add_all(quick_replies)
            db.commit()

        # 3. Default Settings
        if db.query(ChatSetting).count() == 0:
            setting = ChatSetting()
            db.add(setting)
            db.commit()

        # 4. Seed demo conversations if empty
        if db.query(ChatConversation).count() == 0:
            fb_page = db.query(ChatChannel).filter(ChatChannel.channel_type == 'FB_PAGE').first()
            zalo = db.query(ChatChannel).filter(ChatChannel.channel_type == 'ZALO').first()
            wa = db.query(ChatChannel).filter(ChatChannel.channel_type == 'WHATSAPP').first()
            fb_pers = db.query(ChatChannel).filter(ChatChannel.channel_type == 'FB_PERSONAL').first()

            if fb_page:
                c1 = ChatContact(
                    channel_id=fb_page.id,
                    external_user_id="psid_982173491",
                    name="Nguyễn Thùy Linh",
                    avatar_url="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
                    phone="0912345678",
                    email="thuylinh.nguyen@gmail.com",
                    tags=json.dumps(["VIP", "Niềng răng"]),
                    customer_stage="CONSULTING"
                )
                db.add(c1)
                db.flush()

                conv1 = ChatConversation(
                    channel_id=fb_page.id,
                    contact_id=c1.id,
                    title="Chat với Nguyễn Thùy Linh",
                    unread_count=1,
                    last_message_text="Em muốn hỏi gói niềng răng trong suốt Invisalign giá bao nhiêu vậy ạ?",
                    last_message_at=datetime.utcnow(),
                    last_message_sender="CONTACT",
                    status="OPEN",
                    assigned_agent="Bác sĩ Tuấn Anh"
                )
                db.add(conv1)
                db.flush()

                m1 = ChatMessage(
                    conversation_id=conv1.id,
                    sender_type="CONTACT",
                    sender_name="Nguyễn Thùy Linh",
                    content="Chào phòng khám, răng em hơi khấp khểnh nhẹ thì làm loại nào phù hợp ạ?",
                    is_inbound=True,
                    created_at=datetime.utcnow()
                )
                m2 = ChatMessage(
                    conversation_id=conv1.id,
                    sender_type="AGENT",
                    sender_name="Bác sĩ Tuấn Anh",
                    content="Chào bạn Thùy Linh! Trường hợp khấp khểnh nhẹ có thể niềng mắc cài hoặc máng trong suốt rất nhanh và thẩm mỹ bạn nhé.",
                    is_inbound=False,
                    created_at=datetime.utcnow()
                )
                m3 = ChatMessage(
                    conversation_id=conv1.id,
                    sender_type="CONTACT",
                    sender_name="Nguyễn Thùy Linh",
                    content="Em muốn hỏi gói niềng răng trong suốt Invisalign giá bao nhiêu vậy ạ?",
                    is_inbound=True,
                    created_at=datetime.utcnow()
                )
                db.add_all([m1, m2, m3])

            if zalo:
                c2 = ChatContact(
                    channel_id=zalo.id,
                    external_user_id="zalo_uid_88192301",
                    name="Anh Trần Hoàng Quân",
                    avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
                    phone="0987654321",
                    tags=json.dumps(["Trồng răng Implant", "Cần gọi lại"]),
                    customer_stage="BOOKED"
                )
                db.add(c2)
                db.flush()

                conv2 = ChatConversation(
                    channel_id=zalo.id,
                    contact_id=c2.id,
                    title="Chat Zalo với Anh Trần Hoàng Quân",
                    unread_count=0,
                    last_message_text="Dạ hẹn anh 9h sáng thứ 7 tuần này tại cơ sở Nguyễn Trãi nhé ạ.",
                    last_message_at=datetime.utcnow(),
                    last_message_sender="AGENT",
                    status="OPEN",
                    assigned_agent="CSKH Tổng"
                )
                db.add(conv2)
                db.flush()

                zm1 = ChatMessage(
                    conversation_id=conv2.id,
                    sender_type="CONTACT",
                    sender_name="Anh Trần Hoàng Quân",
                    content="Shop ơi mình muốn đặt lịch khám chụp phim răng vào sáng thứ 7 được không?",
                    is_inbound=True,
                    created_at=datetime.utcnow()
                )
                zm2 = ChatMessage(
                    conversation_id=conv2.id,
                    sender_type="AGENT",
                    sender_name="CSKH Tổng",
                    content="Dạ hẹn anh 9h sáng thứ 7 tuần này tại cơ sở Nguyễn Trãi nhé ạ.",
                    is_inbound=False,
                    created_at=datetime.utcnow()
                )
                db.add_all([zm1, zm2])

            if wa:
                c3 = ChatContact(
                    channel_id=wa.id,
                    external_user_id="84903334455",
                    name="David Miller (Việt kiều Úc)",
                    avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
                    phone="+84903334455",
                    tags=json.dumps(["Việt Kiều", "Bọc răng sứ trọn gói"]),
                    customer_stage="CUSTOMER"
                )
                db.add(c3)
                db.flush()

                conv3 = ChatConversation(
                    channel_id=wa.id,
                    contact_id=c3.id,
                    title="WhatsApp: David Miller",
                    unread_count=1,
                    last_message_text="Hi, I will be in Hanoi next Tuesday. Can I book a full dental veneers consultation?",
                    last_message_at=datetime.utcnow(),
                    last_message_sender="CONTACT",
                    status="OPEN",
                    assigned_agent="Chuyên viên Quốc tế"
                )
                db.add(conv3)
                db.flush()

                wam1 = ChatMessage(
                    conversation_id=conv3.id,
                    sender_type="CONTACT",
                    sender_name="David Miller",
                    content="Hi, I will be in Hanoi next Tuesday. Can I book a full dental veneers consultation?",
                    is_inbound=True,
                    created_at=datetime.utcnow()
                )
                db.add(wam1)

            db.commit()
