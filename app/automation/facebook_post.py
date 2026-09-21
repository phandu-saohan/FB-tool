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
    'div[role="button"]:has-text("Bạn viết gì đi...")',
    'span:has-text("Bạn viết gì đi...")',
    'div[role="button"]:has-text("Tạo bài viết công khai...")',
    'span:has-text("Tạo bài viết công khai...")',
    'div[role="button"]:has-text("Tạo bài viết công khai")',
    'div[role="button"]:has-text("Viết bài viết công khai...")',
    'span:has-text("Viết bài viết công khai...")',
    'div[role="button"]:has-text("Viết gì đó...")',
    'span:has-text("Viết gì đó...")',
    'div[role="button"]:has-text("Bạn đang nghĩ gì?")',
    'span:has-text("Bạn đang nghĩ gì?")',
    'div[role="button"]:has-text("Bạn đang nghĩ gì thế?")',
    'span:has-text("Bạn đang nghĩ gì thế?")',
    'div[role="button"]:has-text("Tạo bài viết")',
    'div[role="button"]:has-text("Create post")',
    'div[role="button"]:has-text("Create a public post...")',
    'div[role="button"]:has-text("Create a public post")',
    'div[role="button"]:has-text("Write a public post...")',
    'div[role="button"]:has-text("Write something...")',
    'div[role="button"]:has-text("What\'s on your mind?")',
    'div[role="button"]:has-text("Start a discussion...")',
    'div[data-pagelet="GroupInlineComposer"] div[role="button"]',
    'div[data-pagelet="ProfileComposer"] div[role="button"]',
    'div[data-pagelet="FeedInlineComposer"] div[role="button"]',
    'div[data-pagelet*="Composer"] div[role="button"]'
]

POST_BUTTON_SELECTORS = [
    'div[aria-label="Đăng"][role="button"]',
    'div[aria-label="Post"][role="button"]',
    'div[aria-label="Gửi"][role="button"]',
    'div[aria-label*="phê duyệt"][role="button"]',
    'div[role="button"]:has-text("Đăng")',
    'div[role="button"]:has-text("Post")',
    'div[role="button"]:has-text("Gửi")',
    'button:has-text("Đăng")',
    'button:has-text("Post")',
    'button:has-text("Gửi")'
]

async def _find_composer_trigger(page: Page) -> Optional[any]:
    """Scans for visible composer trigger with scrolling and polling."""
    for _ in range(8):
        for sel in COMPOSER_TRIGGERS:
            el = await page.query_selector(sel)
            if el and await el.is_visible():
                return el
        await page.evaluate('window.scrollBy(0, 350)')
        await asyncio.sleep(1)
    return None

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
        await SafeRateLimiter.human_delay(2.5, 4.0)

        # Dismiss any intrusive notification flyouts or dropdowns
        await page.keyboard.press('Escape')
        await asyncio.sleep(0.5)

        # 2. Checkpoint check
        await assert_no_checkpoint(page)

        # 3. Check for permission / find composer trigger
        composer_trigger = await _find_composer_trigger(page)

        # If not found on initial view, check if we are on 'Giới thiệu' (About) and switch to 'Thảo luận' (Discussion)
        if not composer_trigger:
            disc_tab = await page.query_selector(
                'a[role="tab"]:has-text("Thảo luận"), '
                'a[role="tab"]:has-text("Discussion"), '
                'div[role="tab"]:has-text("Thảo luận"), '
                'div[role="tab"]:has-text("Discussion")'
            )
            if disc_tab:
                log_info('POSTING', 'Switching to Discussion ("Thảo luận") tab...')
                await disc_tab.click()
                await SafeRateLimiter.human_delay(2.0, 3.5)
                composer_trigger = await _find_composer_trigger(page)

        # If still not found, diagnose group membership status
        if not composer_trigger:
            # Check if pending approval
            pending_notice = await page.query_selector(
                'span:has-text("chờ xử lý"), span:has-text("chờ phê duyệt"), '
                'div:has-text("Yêu cầu tham gia của bạn đang chờ"), '
                'div[role="button"]:has-text("Đang chờ")'
            )
            if pending_notice:
                err_msg = 'Yêu cầu tham gia nhóm đang chờ quản trị viên phê duyệt. Chưa thể đăng bài lúc này.'
                log_warning('POSTING', err_msg)
                return False, None, err_msg

            # Check if user needs to join first
            join_btn = await page.query_selector(
                'div[aria-label="Tham gia nhóm"], div[aria-label="Join group"], '
                'div[role="button"]:has-text("Tham gia nhóm"), div[role="button"]:has-text("Join group")'
            )
            if join_btn:
                log_info('POSTING', 'Group has not been joined yet. Attempting 1-click join...')
                await join_btn.click()
                await SafeRateLimiter.human_delay(2.0, 3.5)

                # Check if joined directly
                composer_trigger = await _find_composer_trigger(page)
                if not composer_trigger:
                    err_msg = 'Tài khoản chưa là thành viên của nhóm (Đã gửi yêu cầu tham gia, đang chờ phê duyệt).'
                    log_warning('POSTING', err_msg)
                    return False, None, err_msg
            else:
                err_msg = 'Không tìm thấy ô tạo bài viết ("Bạn viết gì đi..." / "Tạo bài viết công khai...") trên nhóm này.'
                log_warning('POSTING', err_msg)
                return False, None, err_msg

        # 4. Click composer trigger
        log_info('POSTING', 'Opening post composer dialog...')
        await composer_trigger.scroll_into_view_if_needed()
        await SafeRateLimiter.human_delay(0.5, 1.0)
        await composer_trigger.click()
        await SafeRateLimiter.human_delay(2.0, 3.5)

        await assert_no_checkpoint(page)

        # 5. Find composer modal dialog specifically (ignore notification and messenger flyouts)
        composer_dialog = None
        for _ in range(12):
            composer_dialog = await page.query_selector(
                'div[role="dialog"]:has(div[role="textbox"]), '
                'div[role="dialog"]:has(div[contenteditable="true"]), '
                'div[role="dialog"][aria-label*="Tạo bài viết"], '
                'div[role="dialog"][aria-label*="Create post"]'
            )
            if composer_dialog and await composer_dialog.is_visible():
                break
            await asyncio.sleep(0.5)

        if not composer_dialog:
            # Fallback to any visible dialog
            composer_dialog = await page.query_selector('div[role="dialog"]')

        if not composer_dialog:
            err_msg = 'Không thể mở hộp thoại soạn bài viết.'
            log_error('POSTING', err_msg)
            return False, None, err_msg

        # 6. Find textbox inside composer modal
        textbox = await composer_dialog.query_selector(
            'div[role="textbox"][contenteditable="true"], '
            'div[role="textbox"], '
            '[data-lexical-editor="true"], '
            'div[contenteditable="true"]'
        )

        if not textbox:
            # Global fallback
            textbox = await page.query_selector('div[role="textbox"][contenteditable="true"]')

        if not textbox:
            err_msg = 'Không tìm thấy khung soạn thảo văn bản trong hộp thoại đăng bài.'
            log_error('POSTING', err_msg)
            return False, None, err_msg

        # 7. Fill post text
        log_info('POSTING', 'Filling post content...')
        await textbox.click()
        await SafeRateLimiter.human_delay(0.5, 1.0)
        
        # Insert text cleanly preserving formatting and UTF-8 characters
        await page.keyboard.insert_text(content)
        # Type space + backspace to ensure React state and Lexical validator trigger
        await page.keyboard.press('Space')
        await page.keyboard.press('Backspace')
        await SafeRateLimiter.human_delay(1.5, 2.5)

        # 8. Attach image if provided
        if image_path and os.path.exists(image_path):
            log_info('POSTING', f'Attaching image: {image_path}')
            file_input = await composer_dialog.query_selector('input[type="file"][accept*="image"], input[type="file"]')
            if not file_input:
                file_input = await page.query_selector('div[role="dialog"] input[type="file"]')

            if not file_input:
                # Try clicking photo/video button inside dialog
                media_icon = await composer_dialog.query_selector(
                    'div[aria-label*="Ảnh/video"], div[aria-label*="Photo/video"], '
                    'div[role="button"]:has-text("Ảnh/video"), div[role="button"]:has-text("Photo/video")'
                )
                if media_icon:
                    await media_icon.click()
                    await SafeRateLimiter.human_delay(1.0, 2.0)
                    file_input = await page.query_selector('input[type="file"][accept*="image"], input[type="file"]')

            if file_input:
                await file_input.set_input_files(os.path.abspath(image_path))
                # Wait for media upload to complete preview
                await SafeRateLimiter.human_delay(3.0, 5.0)
                log_info('POSTING', 'Image attached successfully')
            else:
                log_warning('POSTING', 'Could not locate file input for image attachment.')

        # 9. Find Publish / Post button
        post_button = None
        for sel in POST_BUTTON_SELECTORS:
            btn = await composer_dialog.query_selector(sel)
            if btn and await btn.is_visible():
                post_button = btn
                break

        if not post_button:
            # Search globally in dialogs
            for sel in POST_BUTTON_SELECTORS:
                btn = await page.query_selector(f'div[role="dialog"] {sel}')
                if btn and await btn.is_visible():
                    post_button = btn
                    break

        if not post_button:
            err_msg = 'Không tìm thấy nút "Đăng" trong hộp thoại bài viết.'
            log_error('POSTING', err_msg)
            return False, None, err_msg

        # Ensure button is not disabled (wait up to 6s for text validation to enable button)
        is_ready = False
        for _ in range(12):
            is_disabled = await post_button.get_attribute('aria-disabled')
            disabled_attr = await post_button.get_attribute('disabled')
            if is_disabled != 'true' and disabled_attr is None:
                is_ready = True
                break
            await asyncio.sleep(0.5)

        if not is_ready:
            err_msg = 'Nút Đăng vẫn ở trạng thái vô hiệu hóa (nội dung có thể đang trống hoặc cần xác minh).'
            log_warning('POSTING', err_msg)
            return False, None, err_msg

        log_info('POSTING', 'Clicking Post ("Đăng") button...')
        await post_button.click()
        await SafeRateLimiter.human_delay(2.0, 3.5)

        # 10. Handle group rules agreement if popup appears
        rules_agree_btn = await page.query_selector(
            'div[role="dialog"] div[role="button"]:has-text("Đồng ý"), '
            'div[role="dialog"] button:has-text("Đồng ý"), '
            'div[role="dialog"] div[role="button"]:has-text("Gửi"), '
            'div[role="dialog"] div[role="button"]:has-text("Submit"), '
            'div[role="dialog"] div[role="button"]:has-text("I agree")'
        )
        if rules_agree_btn and await rules_agree_btn.is_visible():
            log_info('POSTING', 'Group rules confirmation dialog detected. Accepting rules...')
            await rules_agree_btn.click()
            await SafeRateLimiter.human_delay(1.5, 2.5)

        # 11. Wait for composer dialog to disappear or admin approval notice
        is_pending_approval = False
        for _ in range(15):
            await asyncio.sleep(1)
            # Check for admin approval notification
            approval_notice = await page.query_selector(
                'span:has-text("chờ phê duyệt"), span:has-text("pending approval"), '
                'span:has-text("đã được gửi"), div:has-text("quản trị viên sẽ phê duyệt")'
            )
            if approval_notice and await approval_notice.is_visible():
                is_pending_approval = True
                log_info('POSTING', 'Post submitted successfully and is awaiting admin approval.')
                break

            dialog = await page.query_selector('div[role="dialog"]:has(div[role="textbox"])')
            if not dialog or not await dialog.is_visible():
                break

        await assert_no_checkpoint(page)

        if is_pending_approval:
            log_success('POSTING', f'Đã đăng bài thành công lên {target_url} (Đang chờ Quản trị viên phê duyệt)!')
        else:
            log_success('POSTING', f'Đã đăng bài thành công lên {target_url}!')

        return True, target_url, None

    except FacebookCheckpointDetected as cp:
        log_error('POSTING', f'Posting interrupted by checkpoint: {cp.message}')
        raise
    except Exception as e:
        err_str = str(e)
        log_error('POSTING', f'Failed to post to {target_url}: {err_str}')
        return False, None, err_str

