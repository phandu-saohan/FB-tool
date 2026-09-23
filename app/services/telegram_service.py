import logging
import asyncio
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger("telegram_service")

class TelegramService:
    @staticmethod
    async def send_message(bot_token: str, chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
        if not bot_token or not chat_id:
            logger.debug("Telegram credentials not configured. Skipping alert.")
            return False

        clean_token = bot_token.strip()
        clean_chat_id = chat_id.strip()
        url = f"https://api.telegram.org/bot{clean_token}/sendMessage"

        payload = {
            "chat_id": clean_chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    logger.info("Telegram notification sent successfully.")
                    return True
                else:
                    logger.warning(f"Telegram API returned status {res.status_code}: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to send Telegram notification: {e}")
            return False

    @classmethod
    async def notify_campaign_completed(
        cls,
        bot_token: str,
        chat_id: str,
        campaign_name: str,
        total: int,
        sent: int,
        failed: int,
        open_rate: float = 0.0,
        click_rate: float = 0.0
    ):
        text = (
            f"🚀 <b>[CHIẾN DỊCH HOÀN TẤT]</b>\n\n"
            f"📌 <b>Chiến dịch:</b> <i>{campaign_name}</i>\n"
            f"📊 <b>Tổng số người nhận:</b> {total}\n"
            f"✅ <b>Gửi thành công:</b> {sent}\n"
            f"❌ <b>Thất bại / Lỗi:</b> {failed}\n"
            f"👁️ <b>Tỷ lệ mở (Open Rate):</b> {open_rate}%\n"
            f"🔗 <b>Tỷ lệ Click (CTR):</b> {click_rate}%\n\n"
            f"🕒 <i>Hệ thống tự động chạy ngầm 24/7 trên Dokploy VPS</i>"
        )
        await cls.send_message(bot_token, chat_id, text)

    @classmethod
    async def notify_circuit_breaker(
        cls,
        bot_token: str,
        chat_id: str,
        account_name: str,
        reason: str
    ):
        text = (
            f"⚠️ <b>[CẢNH BÁO CIRCUIT BREAKER]</b>\n\n"
            f"Tài khoản email <b>'{account_name}'</b> đã bị tạm dừng tự động để bảo vệ uy tín gửi thư (Domain Reputation).\n\n"
            f"🛑 <b>Nguyên nhân:</b> <code>{reason}</code>\n\n"
            f"👉 Vui lòng kiểm tra lại cấu hình hoặc bấm khôi phục trên Dashboard."
        )
        await cls.send_message(bot_token, chat_id, text)

    @classmethod
    async def notify_cooldown(
        cls,
        bot_token: str,
        chat_id: str,
        account_name: str,
        cooldown_until: str
    ):
        text = (
            f"❄️ <b>[TẠM NGHỈ HẠ NHIỆT RATE-LIMIT]</b>\n\n"
            f"Tài khoản <b>'{account_name}'</b> vừa chạm ngưỡng giới hạn gửi của nhà cung cấp.\n"
            f"⏳ <b>Thời gian hạ nhiệt:</b> Đến <code>{cooldown_until}</code> (15 phút).\n"
            f"🔄 <i>Hệ thống sẽ tự động chuyển sang tài khoản phụ kế tiếp hoặc tiếp tục khi hết thời gian hạ nhiệt.</i>"
        )
        await cls.send_message(bot_token, chat_id, text)
