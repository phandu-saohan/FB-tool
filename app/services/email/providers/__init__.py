from app.services.email.providers.base_provider import EmailProvider, EmailSendResult
from app.services.email.providers.hostinger_smtp_provider import HostingerSMTPProvider
from app.services.email.providers.mock_email_provider import MockEmailProvider

# Aliases for generic SMTP and Google/Gmail accounts
GmailSMTPProvider = HostingerSMTPProvider
StandardSMTPProvider = HostingerSMTPProvider

__all__ = [
    "EmailProvider",
    "EmailSendResult",
    "HostingerSMTPProvider",
    "GmailSMTPProvider",
    "StandardSMTPProvider",
    "MockEmailProvider"
]

