import asyncio
from typing import Tuple
from playwright.async_api import Page
from app.automation.browser_manager import browser_manager
from app.automation.checkpoint_detector import detect_facebook_checkpoint
from app.utils.logger import log_info, log_warning, log_success

async def check_facebook_login(open_browser_if_needed: bool = True) -> Tuple[bool, str]:
    """
    Checks Facebook login status.
    Returns: (is_logged_in: bool, status_message: str)
    Possible statuses:
      - 'LOGGED_IN'
      - 'WAITING_FOR_MANUAL_LOGIN'
      - 'CHECKPOINT_DETECTED'
      - 'STOPPED'
    """
    if not browser_manager.is_running():
        if open_browser_if_needed:
            await browser_manager.start()
        else:
            return False, 'STOPPED'

    page = await browser_manager.get_page()

    # Navigate to Facebook home
    try:
        current_url = page.url or ''
        if not current_url.startswith('https://www.facebook.com'):
            log_info('LOGIN_CHECK', 'Navigating to https://www.facebook.com/...')
            await page.goto('https://www.facebook.com/', wait_until='domcontentloaded', timeout=45000)
            await asyncio.sleep(2)
    except Exception as e:
        log_warning('LOGIN_CHECK', f'Navigation warning: {e}')

    # 1. Check for Checkpoint
    is_checkpoint, reason = await detect_facebook_checkpoint(page)
    if is_checkpoint:
        return False, 'CHECKPOINT_DETECTED'

    # 2. Check cookies for 'c_user'
    cookies = await browser_manager.context.cookies(['https://www.facebook.com'])
    c_user = any(c.get('name') == 'c_user' for c in cookies)

    if c_user:
        log_success('LOGIN_CHECK', 'Facebook session active (c_user cookie found)')
        return True, 'LOGGED_IN'

    # 3. Check page DOM selectors
    login_form = await page.query_selector('input[name="email"], input[id="email"], button[name="login"]')
    feed_or_profile = await page.query_selector('div[role="feed"], div[aria-label="Facebook"], div[aria-label="Tài khoản của bạn"], div[aria-label="Your profile"], svg[aria-label="Your profile"]')

    if feed_or_profile and not login_form:
        log_success('LOGIN_CHECK', 'Facebook session active (feed/profile elements detected)')
        return True, 'LOGGED_IN'

    log_info('LOGIN_CHECK', 'Facebook not logged in. Status: WAITING_FOR_MANUAL_LOGIN')
    return False, 'WAITING_FOR_MANUAL_LOGIN'

async def wait_for_manual_login(timeout_seconds: int = 300) -> bool:
    """
    Waits for user to manually complete login on the opened browser window.
    Checks every 3 seconds.
    """
    log_info('LOGIN_FLOW', f'Waiting for manual login in browser window (Timeout: {timeout_seconds}s)...')
    elapsed = 0
    while elapsed < timeout_seconds:
        logged_in, status = await check_facebook_login(open_browser_if_needed=True)
        if logged_in:
            log_success('LOGIN_FLOW', 'Manual login successful! Facebook profile session saved.')
            return True
        if status == 'CHECKPOINT_DETECTED':
            log_warning('LOGIN_FLOW', 'Facebook checkpoint detected during login flow.')
            return False
        await asyncio.sleep(3)
        elapsed += 3
    
    log_warning('LOGIN_FLOW', 'Manual login timed out.')
    return False
