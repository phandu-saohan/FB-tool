import os
import asyncio
from typing import Tuple, Optional
from playwright.async_api import Page
from app.automation.browser_manager import browser_manager
from app.automation.checkpoint_detector import detect_facebook_checkpoint, assert_no_checkpoint
from app.utils.logger import log_info, log_success, log_warning, log_error
from app.utils.exceptions import FacebookPostFailed, FacebookCheckpointDetected
from app.utils.rate_limiter import SafeRateLimiter

COMPOSER_TRIGGERS = [
    'div[role="button"]:has-text("Viết gì đó...")',
    'div[role="button"]:has-text("Bạn đang nghĩ gì?")',
    'div[role="button"]:has-text("Write something...")',
    'div[role="button"]:has-text("What\'s on your mind?")',
    'span:has-text("Viết gì đó...")',
    'span:has-text("Bạn đang nghĩ gì?")',
    'div[role="button"]:has-text("Tạo bài viết")',
    'div[role="button"]:has-text("Create post")'
]

POST_BUTTON_SELECTORS = [
    'div[aria-label="Đăng"][role="button"]',
    'div[aria-label="Post"][role="button"]',
    'div[role="dialog"] div[aria-label="Đăng"]',
    'div[role="dialog"] div[aria-label="Post"]',
    'button:has-text("Đăng")',
    'button:has-text("Post")'
]

async def post_to_facebook_target(
    target_type: str,
    target_url: str,
    content: str,
    image_path: Optional[str] = None
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Executes post creation in a Facebook Group or Page.
    Returns: (success: bool, published_url: Optional[str], error_message: Optional[str])
    """
    log_info('POSTING', f'Preparing to post to {target_type}: {target_url}')

    if not browser_manager.is_running():
        await browser_manager.start()

    page = await browser_manager.get_page()

    try:
        # 1. Navigate to target
        await page.goto(target_url, wait_until='domcontentloaded', timeout=45000)
        await SafeRateLimiter.human_delay(2.0, 4.0)

        # 2. Checkpoint check
        await assert_no_checkpoint(page)

        # 3. Check for permission / find composer trigger
        composer_trigger = None
        for sel in COMPOSER_TRIGGERS:
            el = await page.query_selector(sel)
            if el and await el.is_visible():
                composer_trigger = el
                break

        if not composer_trigger:
            # Check if user needs to join first
            join_btn = await page.query_selector('div[aria-label="Tham gia nhóm"], div[aria-label="Join group"]')
            if join_btn:
                err_msg = 'Cannot post: Account has not joined this group yet (Join button visible).'
                log_warning('POSTING', err_msg)
                return False, None, err_msg
            else:
                err_msg = 'Composer button ("Viết gì đó..." / "Bạn đang nghĩ gì?") not found on target page.'
                log_warning('POSTING', err_msg)
                return False, None, err_msg

        # 4. Click composer trigger
        log_info('POSTING', 'Opening post composer dialog...')
        await composer_trigger.click()
        await SafeRateLimiter.human_delay(1.5, 3.0)

        await assert_no_checkpoint(page)

        # 5. Find contenteditable textbox inside composer modal
        textbox = await page.query_selector('div[role="dialog"] div[role="textbox"], div[role="dialog"] div[contenteditable="true"]')
        if not textbox:
            textbox = await page.query_selector('div[role="textbox"][contenteditable="true"]')

        if not textbox:
            err_msg = 'Composer textbox could not be located in dialog.'
            log_error('POSTING', err_msg)
            return False, None, err_msg

        # 6. Fill post text
        log_info('POSTING', 'Filling post content...')
        await textbox.click()
        await SafeRateLimiter.human_delay(0.5, 1.0)
        
        # Human typing simulation or clipboard fill
        await page.keyboard.type(content, delay=25)
        await SafeRateLimiter.human_delay(1.0, 2.0)

        # 7. Attach image if provided
        if image_path and os.path.exists(image_path):
            log_info('POSTING', f'Attaching image: {image_path}')
            file_input = await page.query_selector('div[role="dialog"] input[type="file"], input[type="file"][accept*="image"]')
            if file_input:
                await file_input.set_input_files(os.path.abspath(image_path))
                # Wait for media upload to complete preview
                await SafeRateLimiter.human_delay(3.0, 5.0)
                log_info('POSTING', 'Image attached successfully')
            else:
                # Try clicking photo/video button inside dialog
                media_icon = await page.query_selector('div[role="dialog"] div[aria-label*="Ảnh/video"], div[role="dialog"] div[aria-label*="Photo/video"]')
                if media_icon:
                    await media_icon.click()
                    await SafeRateLimiter.human_delay(1.0, 2.0)
                    file_input = await page.query_selector('input[type="file"][accept*="image"]')
                    if file_input:
                        await file_input.set_input_files(os.path.abspath(image_path))
                        await SafeRateLimiter.human_delay(3.0, 5.0)

        # 8. Find and click Publish / Post button
        post_button = None
        for sel in POST_BUTTON_SELECTORS:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                post_button = btn
                break

        if not post_button:
            err_msg = 'Publish / Post button ("Đăng") not found in composer modal.'
            log_error('POSTING', err_msg)
            return False, None, err_msg

        # Ensure button is not disabled
        is_disabled = await post_button.get_attribute('aria-disabled')
        if is_disabled == 'true':
            err_msg = 'Post button is disabled (content may be empty or awaiting verification).'
            log_warning('POSTING', err_msg)
            return False, None, err_msg

        log_info('POSTING', 'Clicking Post ("Đăng") button...')
        await post_button.click()

        # 9. Wait for composer dialog to disappear or confirmation
        for _ in range(15):
            await asyncio.sleep(1)
            dialog = await page.query_selector('div[role="dialog"] div[role="textbox"]')
            if not dialog:
                break

        await assert_no_checkpoint(page)

        log_success('POSTING', f'Successfully posted to {target_url}!')
        return True, target_url, None

    except FacebookCheckpointDetected as cp:
        log_error('POSTING', f'Posting interrupted by checkpoint: {cp.message}')
        raise
    except Exception as e:
        err_str = str(e)
        log_error('POSTING', f'Failed to post to {target_url}: {err_str}')
        return False, None, err_str
