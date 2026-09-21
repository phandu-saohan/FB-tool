import asyncio
import urllib.parse
import re
import random
from typing import List, Dict, Any, Tuple
from playwright.async_api import Page
from app.automation.browser_manager import browser_manager
from app.automation.checkpoint_detector import detect_facebook_checkpoint, assert_no_checkpoint
from app.database.database import SessionLocal
from app.database.models import FacebookGroup
from app.utils.logger import log_info, log_success, log_warning, log_error
from app.utils.exceptions import FacebookCheckpointDetected, FacebookLoginRequired
from app.utils.rate_limiter import SafeRateLimiter

def clean_facebook_url(url: str) -> str:
    if not url:
        return ''
    parsed = urllib.parse.urlparse(url)
    clean_path = parsed.path.rstrip('/')
    return f"https://www.facebook.com{clean_path}"

def parse_group_metadata(text: str) -> Dict[str, str]:
    meta = {'privacy': 'Public', 'members': 'N/A', 'description': ''}
    if not text:
        return meta
    
    if re.search(r'(riêng tư|private)', text, re.I):
        meta['privacy'] = 'Private'
    elif re.search(r'(công khai|public)', text, re.I):
        meta['privacy'] = 'Public'

    member_match = re.search(r'([\d.,]+[KkMm]?)\s*(thành viên|members|người tham gia)', text, re.I)
    if member_match:
        meta['members'] = member_match.group(1).strip()

    return meta

async def search_facebook_groups(keyword: str, max_results: int = 50) -> List[Dict[str, Any]]:
    """
    Automates Facebook search for Groups, parses results, deduplicates, and saves to DB.
    """
    log_info('GROUP_SEARCH', f'Starting group search for keyword: "{keyword}" (Target max: {max_results})')
    
    if not browser_manager.is_running():
        await browser_manager.start()

    page = await browser_manager.get_page()

    encoded_kw = urllib.parse.quote(keyword)
    search_url = f'https://www.facebook.com/search/groups/?q={encoded_kw}'
    
    try:
        await page.goto(search_url, wait_until='domcontentloaded', timeout=45000)
        await asyncio.sleep(3)
    except Exception as e:
        log_error('GROUP_SEARCH', f'Error navigating to search page: {e}')
        raise

    await assert_no_checkpoint(page)

    collected_groups: List[Dict[str, Any]] = []
    seen_urls = set()

    with SessionLocal() as db:
        existing = db.query(FacebookGroup.url).all()
        for row in existing:
            seen_urls.add(row[0])

    scroll_attempts = 0
    max_scroll_attempts = max(10, max_results // 3)

    while len(collected_groups) < max_results and scroll_attempts < max_scroll_attempts:
        await assert_no_checkpoint(page)

        group_elements = await page.query_selector_all('a[href*="/groups/"]')
        
        for el in group_elements:
            try:
                href = await el.get_attribute('href')
                if not href or '/search/' in href or '/user/' in href:
                    continue

                full_url = clean_facebook_url(href)
                parts = [p for p in urllib.parse.urlparse(full_url).path.split('/') if p]
                if len(parts) < 2 or parts[0] != 'groups':
                    continue

                group_id_or_slug = parts[1]
                if group_id_or_slug in ['feed', 'discover', 'joins', 'create']:
                    continue

                if full_url in seen_urls:
                    continue

                name = (await el.inner_text() or '').strip()
                if not name or len(name) < 2 or name.lower() in ['tham gia', 'join', 'đã tham gia']:
                    continue

                card_text = await el.evaluate('''a => {
                    let parent = a.closest('div[role="feed"]') || a.closest('div[data-visualcompletion="ignore-dynamic-hydration"]') || a.parentElement.parentElement.parentElement;
                    return parent ? parent.innerText : '';
                }''')

                meta = parse_group_metadata(card_text)
                
                group_data = {
                    'facebook_id': group_id_or_slug if group_id_or_slug.isdigit() else None,
                    'name': name,
                    'url': full_url,
                    'description': card_text[:500] if card_text else '',
                    'members': meta['members'],
                    'privacy': meta['privacy'],
                    'category': 'Community',
                    'keyword': keyword,
                    'selected': False,
                    'status': 'ACTIVE'
                }

                seen_urls.add(full_url)
                collected_groups.append(group_data)
                log_info('GROUP_SEARCH', f'Found group: "{name}" ({meta["members"]} members, {meta["privacy"]})')

                if len(collected_groups) >= max_results:
                    break

            except Exception:
                continue

        if len(collected_groups) >= max_results:
            break

        scroll_attempts += 1
        await page.evaluate('window.scrollBy(0, 1200)')
        await asyncio.sleep(2)

    # Save to Database with deduplication protection
    saved_count = 0
    with SessionLocal() as db:
        for item in collected_groups:
            existing_group = db.query(FacebookGroup).filter(FacebookGroup.url == item['url']).first()
            if not existing_group:
                new_grp = FacebookGroup(**item)
                db.add(new_grp)
                saved_count += 1
            else:
                existing_group.name = item['name']
                existing_group.members = item['members']
                existing_group.privacy = item['privacy']
                existing_group.keyword = keyword
        db.commit()

    log_success('GROUP_SEARCH', f'Completed group search for "{keyword}". Found {len(collected_groups)} groups, {saved_count} new saved.')
    return collected_groups

async def fetch_joined_facebook_groups(max_results: int = 200) -> List[Dict[str, Any]]:
    """
    Automatically fetches all groups the currently logged-in account has joined.
    Navigates to https://www.facebook.com/groups/joins/ and extracts groups, updating status to JOINED.
    """
    log_info('GROUP_SYNC', 'Bắt đầu đồng bộ danh sách các nhóm đã tham gia (https://www.facebook.com/groups/joins/)...')

    if not browser_manager.is_running():
        await browser_manager.start()

    page = await browser_manager.get_page()

    try:
        await page.goto('https://www.facebook.com/groups/joins/', wait_until='domcontentloaded', timeout=45000)
        await asyncio.sleep(3)
    except Exception as e:
        log_error('GROUP_SYNC', f'Lỗi điều hướng trang nhóm đã tham gia: {e}')
        raise

    await assert_no_checkpoint(page)

    collected_joined: List[Dict[str, Any]] = []
    seen_urls = set()

    scroll_attempts = 0
    max_scrolls = max(8, max_results // 10)

    while len(collected_joined) < max_results and scroll_attempts < max_scrolls:
        await assert_no_checkpoint(page)

        links = await page.query_selector_all('a[href*="/groups/"]')
        for el in links:
            try:
                href = await el.get_attribute('href')
                if not href or '/search/' in href or '/user/' in href:
                    continue

                full_url = clean_facebook_url(href)
                parts = [p for p in urllib.parse.urlparse(full_url).path.split('/') if p]
                if len(parts) < 2 or parts[0] != 'groups':
                    continue

                slug = parts[1]
                if slug in ['feed', 'discover', 'joins', 'create', 'notifications']:
                    continue

                if full_url in seen_urls:
                    continue

                name = (await el.inner_text() or '').strip()
                if not name or len(name) < 2 or name.lower() in ['tham gia', 'join', 'đã tham gia', 'xem tất cả']:
                    continue

                card_text = await el.evaluate('''a => {
                    let parent = a.closest('div[role="listitem"]') || a.closest('div[role="article"]') || a.parentElement.parentElement;
                    return parent ? parent.innerText : '';
                }''')

                meta = parse_group_metadata(card_text)

                group_info = {
                    'facebook_id': slug if slug.isdigit() else None,
                    'name': name,
                    'url': full_url,
                    'description': card_text[:500] if card_text else '',
                    'members': meta['members'],
                    'privacy': meta['privacy'],
                    'category': 'Joined Group',
                    'keyword': 'Joined',
                    'selected': True,
                    'status': 'JOINED'
                }

                seen_urls.add(full_url)
                collected_joined.append(group_info)
                log_info('GROUP_SYNC', f'Đã lấy nhóm đã tham gia: "{name}"')

                if len(collected_joined) >= max_results:
                    break
            except Exception:
                continue

        if len(collected_joined) >= max_results:
            break

        scroll_attempts += 1
        await page.evaluate('window.scrollBy(0, 1500)')
        await asyncio.sleep(2)

    # Update or insert into database
    updated_count = 0
    new_count = 0
    with SessionLocal() as db:
        for item in collected_joined:
            existing = db.query(FacebookGroup).filter(FacebookGroup.url == item['url']).first()
            if existing:
                existing.status = 'JOINED'
                existing.name = item['name']
                if item['members'] != 'N/A':
                    existing.members = item['members']
                updated_count += 1
            else:
                db.add(FacebookGroup(**item))
                new_count += 1
        db.commit()

    log_success('GROUP_SYNC', f'Hoàn thành đồng bộ: {len(collected_joined)} nhóm đã tham gia ({new_count} nhóm mới, {updated_count} cập nhật trạng thái JOINED).')
    return collected_joined

async def join_facebook_group(target_url: str) -> Tuple[bool, str]:
    """
    Automates joining a single Facebook Group.
    Returns: (success: bool, status_message: str)
    """
    log_info('GROUP_JOIN', f'Bắt đầu tham gia nhóm: {target_url}')

    if not browser_manager.is_running():
        await browser_manager.start()

    page = await browser_manager.get_page()

    try:
        await page.goto(target_url, wait_until='domcontentloaded', timeout=45000)
        await SafeRateLimiter.human_delay(2.0, 3.5)

        await assert_no_checkpoint(page)

        # 1. Check if already a member
        already_joined = await page.query_selector(
            'div[aria-label="Đã tham gia"], div[aria-label="Joined"], '
            'div[role="button"]:has-text("Đã tham gia"), div[role="button"]:has-text("Joined")'
        )
        if already_joined:
            msg = 'Tài khoản đã là thành viên của nhóm này.'
            log_info('GROUP_JOIN', msg)
            with SessionLocal() as db:
                grp = db.query(FacebookGroup).filter(FacebookGroup.url == target_url).first()
                if grp:
                    grp.status = 'JOINED'
                    db.commit()
            return True, msg

        # 2. Check if already pending approval
        pending_btn = await page.query_selector(
            'div[aria-label*="Đang chờ"], div[aria-label*="Pending"], '
            'div[role="button"]:has-text("Đang chờ phê duyệt"), div[role="button"]:has-text("Cancel request"), '
            'div[role="button"]:has-text("Hủy yêu cầu")'
        )
        if pending_btn:
            msg = 'Yêu cầu tham gia đang chờ Quản trị viên phê duyệt.'
            log_info('GROUP_JOIN', msg)
            with SessionLocal() as db:
                grp = db.query(FacebookGroup).filter(FacebookGroup.url == target_url).first()
                if grp:
                    grp.status = 'PENDING'
                    db.commit()
            return True, msg

        # 3. Find Join Group button
        join_btn = None
        JOIN_BUTTON_SELECTORS = [
            'div[aria-label="Tham gia nhóm"][role="button"]',
            'div[aria-label="Join group"][role="button"]',
            'div[role="button"]:has-text("Tham gia nhóm")',
            'div[role="button"]:has-text("Join group")',
            'button:has-text("Tham gia nhóm")',
            'button:has-text("Join group")'
        ]

        for sel in JOIN_BUTTON_SELECTORS:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                join_btn = btn
                break

        if not join_btn:
            msg = 'Không tìm thấy nút "Tham gia nhóm" trên giao diện.'
            log_warning('GROUP_JOIN', msg)
            return False, msg

        log_info('GROUP_JOIN', 'Bấm nút "Tham gia nhóm"...')
        await join_btn.click()
        await SafeRateLimiter.human_delay(1.5, 3.0)

        await assert_no_checkpoint(page)

        # 4. Check for membership questions or rules agreement dialog
        dialog = await page.query_selector('div[role="dialog"]')
        if dialog:
            log_info('GROUP_JOIN', 'Phát hiện hộp thoại câu hỏi / quy tắc nhóm...')
            
            # Check agreement checkbox if available
            checkbox = await dialog.query_selector('input[type="checkbox"], div[role="checkbox"]')
            if checkbox:
                try:
                    await checkbox.click()
                    await SafeRateLimiter.human_delay(0.5, 1.0)
                except Exception:
                    pass

            # Look for submit / send button inside dialog
            SUBMIT_SELECTORS = [
                'div[role="dialog"] div[aria-label="Gửi"][role="button"]',
                'div[role="dialog"] div[aria-label="Submit"][role="button"]',
                'div[role="dialog"] button:has-text("Gửi")',
                'div[role="dialog"] button:has-text("Submit")',
                'div[role="dialog"] div[role="button"]:has-text("Gửi")',
                'div[role="dialog"] div[role="button"]:has-text("Hoàn tất")',
                'div[role="dialog"] div[role="button"]:has-text("Tiếp tục")'
            ]
            for sub_sel in SUBMIT_SELECTORS:
                submit_btn = await page.query_selector(sub_sel)
                if submit_btn and await submit_btn.is_visible():
                    log_info('GROUP_JOIN', 'Bấm gửi câu trả lời / đồng ý quy tắc...')
                    await submit_btn.click()
                    await SafeRateLimiter.human_delay(1.5, 2.5)
                    break

        # 5. Check final status
        await asyncio.sleep(2)
        final_joined = await page.query_selector('div[aria-label="Đã tham gia"], div[role="button"]:has-text("Đã tham gia")')
        final_pending = await page.query_selector('div[role="button"]:has-text("Đang chờ phê duyệt"), div[role="button"]:has-text("Hủy yêu cầu")')

        with SessionLocal() as db:
            grp = db.query(FacebookGroup).filter(FacebookGroup.url == target_url).first()
            if grp:
                if final_joined:
                    grp.status = 'JOINED'
                    msg = 'Tham gia nhóm thành công (Đã là thành viên).'
                else:
                    grp.status = 'PENDING'
                    msg = 'Đã gửi yêu cầu tham gia (Chờ duyệt).'
                db.commit()

        log_success('GROUP_JOIN', f'Kết quả nhóm {target_url}: {msg}')
        return True, msg

    except FacebookCheckpointDetected as cp:
        log_error('GROUP_JOIN', f'Bị gián đoạn bởi checkpoint: {cp.message}')
        raise
    except Exception as e:
        err_msg = str(e)
        log_error('GROUP_JOIN', f'Lỗi khi tham gia nhóm {target_url}: {err_msg}')
        return False, err_msg

async def bulk_join_facebook_groups(group_ids: List[int], delay_min: int = 15, delay_max: int = 40) -> Dict[str, Any]:
    """
    Sequentially joins multiple Facebook groups with safe human-like delays.
    """
    log_info('BULK_JOIN', f'Bắt đầu tham gia {len(group_ids)} nhóm đã chọn...')
    
    with SessionLocal() as db:
        groups = db.query(FacebookGroup).filter(FacebookGroup.id.in_(group_ids)).all()
        target_list = [{'id': g.id, 'name': g.name, 'url': g.url} for g in groups]

    results = {'success': 0, 'failed': 0, 'details': []}

    for idx, item in enumerate(target_list):
        log_info('BULK_JOIN', f'Đang xử lý nhóm {idx + 1}/{len(target_list)}: "{item["name"]}"')
        
        ok, msg = await join_facebook_group(item['url'])
        if ok:
            results['success'] += 1
        else:
            results['failed'] += 1

        results['details'].append({
            'group_id': item['id'],
            'name': item['name'],
            'url': item['url'],
            'success': ok,
            'message': msg
        })

        # Wait safe delay between joins if more remain
        if idx < len(target_list) - 1:
            delay = random.uniform(delay_min, delay_max)
            log_info('BULK_JOIN', f'Nghỉ an toàn {int(delay)}s trước khi tham gia nhóm tiếp theo...')
            await asyncio.sleep(delay)

    log_success('BULK_JOIN', f'Hoàn thành tham gia nhóm: {results["success"]} thành công, {results["failed"]} lỗi.')
    return results
