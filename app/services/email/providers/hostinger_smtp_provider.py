import smtplib
import ssl
import asyncio
import uuid
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, make_msgid
from typing import Dict, Any, Optional
from app.services.email.providers.base_provider import EmailProvider, EmailSendResult

logger = logging.getLogger("email_provider.hostinger")

class HostingerSMTPProvider(EmailProvider):
    def __init__(
        self,
        smtp_host: str = "smtp.hostinger.com",
        smtp_port: int = 465,
        smtp_username: str = "outreach@aesthetichub.vn",
        smtp_password: Optional[str] = None,
        use_ssl: bool = True,
        use_tls: bool = False,
        default_from_email: str = "outreach@aesthetichub.vn",
        default_from_name: str = "Aesthetic Conference Intelligence",
        daily_limit: int = 300,
        timeout: int = 30
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password or ""
        self.use_ssl = use_ssl
        self.use_tls = use_tls
        self.default_from_email = default_from_email
        self.default_from_name = default_from_name
        self.daily_limit = daily_limit
        self.timeout = timeout

    def _create_connection(self):
        context = ssl.create_default_context()
        if self.use_ssl:
            server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=self.timeout, context=context)
        else:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=self.timeout)
            if self.use_tls:
                server.starttls(context=context)

        if self.smtp_username and self.smtp_password:
            server.login(self.smtp_username, self.smtp_password)
        return server

    def _send_sync(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> EmailSendResult:
        sender_email = from_email or self.default_from_email
        sender_name = from_name or self.default_from_name

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((sender_name, sender_email))
        msg["To"] = formataddr((to_name or "", to_email)) if to_name else to_email
        
        message_id = make_msgid(domain=self.smtp_host)
        msg["Message-ID"] = message_id

        if reply_to:
            msg["Reply-To"] = reply_to

        if custom_headers:
            for k, v in custom_headers.items():
                msg[k] = v

        # Plain text alternative
        if plain_content:
            msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        else:
            # Simple text strip fallback
            msg.attach(MIMEText(html_content, "plain", "utf-8"))

        # HTML content
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        server = None
        try:
            server = self._create_connection()
            server.sendmail(sender_email, [to_email], msg.as_string())
            return EmailSendResult(
                success=True,
                message_id=message_id
            )
        except smtplib.SMTPResponseException as e:
            code = str(e.smtp_code)
            error_msg = str(e.smtp_error.decode("utf-8", errors="ignore") if isinstance(e.smtp_error, bytes) else e.smtp_error)
            # 4xx: Temporary failure; 5xx: Permanent failure
            is_temp = code.startswith("4") or code in ["421", "450", "451", "452"]
            logger.warning(f"SMTP response error {code}: {error_msg}")
            return EmailSendResult(
                success=False,
                error_code=code,
                error_message=error_msg,
                is_temporary=is_temp
            )
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError) as e:
            logger.warning(f"SMTP network/connection error: {str(e)}")
            return EmailSendResult(
                success=False,
                error_code="CONNECTION_ERROR",
                error_message=str(e),
                is_temporary=True
            )
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP auth error: {str(e)}")
            return EmailSendResult(
                success=False,
                error_code="AUTH_ERROR",
                error_message=str(e),
                is_temporary=False
            )
        except Exception as e:
            logger.error(f"Unexpected SMTP error: {str(e)}")
            return EmailSendResult(
                success=False,
                error_code="INTERNAL_ERROR",
                error_message=str(e),
                is_temporary=True
            )
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass

    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> EmailSendResult:
        return await asyncio.to_thread(
            self._send_sync,
            to_email,
            to_name,
            subject,
            html_content,
            plain_content,
            from_email,
            from_name,
            reply_to,
            custom_headers
        )

    def _verify_sync(self) -> bool:
        server = None
        try:
            server = self._create_connection()
            status, _ = server.noop()
            return status == 250
        except Exception as e:
            logger.warning(f"Hostinger SMTP verify failed: {str(e)}")
            return False
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass

    async def verify_connection(self) -> bool:
        return await asyncio.to_thread(self._verify_sync)

    def get_limits(self) -> Dict[str, Any]:
        return {
            "provider": "Hostinger",
            "daily_limit": self.daily_limit,
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "use_ssl": self.use_ssl
        }

    def get_health(self) -> Dict[str, Any]:
        return {
            "provider": "Hostinger",
            "host": self.smtp_host,
            "port": self.smtp_port,
            "status": "CONFIGURED" if self.smtp_password else "CREDENTIALS_MISSING"
        }
