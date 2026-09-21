import re
from typing import Tuple
from playwright.async_api import Page
from app.utils.logger import log_warning, log_error
from app.utils.exceptions import FacebookCheckpointDetected

CHECKPOINT_URL_PATTERNS = [
    r'facebook\.com/checkpoint',
    r'facebook\.com/two_step_verification',
    r'facebook\.com/login/identify',
    r'facebook\.com/recover',
    r'facebook\.com/security',
    r'facebook\.com/confirmemail',
    r'facebook\.com/help/contact/260749603972907'
]

CHECKPOINT_TEXT_PATTERNS = [
    'chúng tôi đã tạm khóa tài khoản',
    'xác minh danh tính',
    'bảo mật tài khoản',
    'security check',
    'account locked',
    'suspicious activity',
    'confirm your identity',
    'enter the login code',
    'nhập mã bảo mật',
    'xác nhận đây là bạn',
    'we suspended your account',
    'checkpoint',
    'recaptcha',
    'robot'
]

async def detect_facebook_checkpoint(page: Page) -> Tuple[bool, str]:
    if not page:
        return False, ''
    
    current_url = page.url or ''
    for pattern in CHECKPOINT_URL_PATTERNS:
        if re.search(pattern, current_url, re.IGNORECASE):
            reason = f'Checkpoint URL detected: {current_url}'
            log_warning('CHECKPOINT', f'Facebook checkpoint detected! URL: {current_url}')
            return True, reason
            
    try:
        title = await page.title()
        title_lower = title.lower() if title else ''
        for text in ['checkpoint', 'xác minh', 'bảo mật', 'security check', 'robot']:
            if text in title_lower:
                reason = f'Checkpoint page title detected: {title}'
                log_warning('CHECKPOINT', reason)
                return True, reason

        captcha_elem = await page.query_selector('iframe[src*="captcha"], iframe[src*="recaptcha"], div.g-recaptcha, #captcha')
        if captcha_elem:
            reason = 'CAPTCHA challenge element detected on page'
            log_warning('CHECKPOINT', reason)
            return True, reason

        body_text = await page.evaluate('''() => {
            const el = document.querySelector('body');
            return el ? el.innerText.substring(0, 1000).toLowerCase() : '';
        }''')
        for pattern in CHECKPOINT_TEXT_PATTERNS:
            if pattern in body_text:
                reason = f'Checkpoint security challenge text found: "{pattern}"'
                log_warning('CHECKPOINT', reason)
                return True, reason

    except Exception:
        pass

    return False, ''

async def assert_no_checkpoint(page: Page):
    is_checkpoint, reason = await detect_facebook_checkpoint(page)
    if is_checkpoint:
        raise FacebookCheckpointDetected(reason)
