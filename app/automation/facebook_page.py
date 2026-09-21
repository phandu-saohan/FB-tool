import asyncio
import urllib.parse
import re
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from app.automation.browser_manager import browser_manager
from app.automation.checkpoint_detector import detect_facebook_checkpoint, assert_no_checkpoint
from app.database.database import SessionLocal
from app.database.models import FacebookPage
from app.utils.logger import log_info, log_success, log_warning, log_error

def clean_facebook_page_url(url: str) -> str:
    if not url:
        return ''
    
    url = url.strip()
    if url.startswith(('http://', 'https://')):
        parsed = urllib.parse.urlparse(url)
        if parsed.netloc and 'facebook.com' not in parsed.netloc and 'fb.com' not in parsed.netloc:
            return ''
        clean_path = parsed.path.rstrip('/')
        if not clean_path.startswith('/'):
            clean_path = '/' + clean_path
        if 'profile.php' in clean_path:
            query_params = urllib.parse.parse_qs(parsed.query)
            page_id = query_params.get('id', [''])[0]
            if page_id:
                return f"https://www.facebook.com/profile.php?id={page_id}"
        return f"https://www.facebook.com{clean_path}"

    if url.startswith('/'):
        clean_path = url.rstrip('/')
        return f"https://www.facebook.com{clean_path}"
    elif url.startswith(('facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com')):
        return clean_facebook_page_url(f"https://{url}")
    elif '.' in url:
        # Another non-facebook domain like other-site.com
        return ''
    else:
        # Slug like "thammyviensaohan"
        return f"https://www.facebook.com/{url.strip('/')}"

def parse_page_metadata(text: str) -> Dict[str, str]:
    meta = {'followers': 'N/A', 'category': 'Page', 'location': ''}
    if not text:
        return meta

    # Match followers or likes: e.g. "15K người theo dõi", "20K lượt thích", "5.2K followers", "100K likes"
    follower_match = re.search(r'([\d.,]+[KkMm]?)\s*(người theo dõi|lượt thích|followers|likes)', text, re.I)
    if follower_match:
        meta['followers'] = follower_match.group(1).strip()

    # Look for location or category clues in common vietnamese business formats
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if len(lines) > 2:
        meta['category'] = lines[1] if len(lines[1]) < 50 else 'Page'

    return meta

async def search_facebook_pages(keyword: str, max_results: int = 50) -> List[Dict[str, Any]]:
    """
    Automates Facebook search for Pages, parses details, deduplicates, and saves to DB.
    """
    log_info('PAGE_SEARCH', f'Starting page search for keyword: "{keyword}" (Target max: {max_results})')
    
    if not browser_manager.is_running():
        await browser_manager.start()

    page = await browser_manager.get_page()

    encoded_kw = urllib.parse.quote(keyword)
    search_url = f'https://www.facebook.com/search/pages/?q={encoded_kw}'

    try:
        await page.goto(search_url, wait_until='domcontentloaded', timeout=45000)
        await asyncio.sleep(3)
    except Exception as e:
        log_error('PAGE_SEARCH', f'Error navigating to search page: {e}')
        raise

    await assert_no_checkpoint(page)

    collected_pages: List[Dict[str, Any]] = []
    seen_urls = set()

    with SessionLocal() as db:
        existing = db.query(FacebookPage.url).all()
        for row in existing:
            seen_urls.add(row[0])

    scroll_attempts = 0
    max_scroll_attempts = max(10, max_results // 3)

    while len(collected_pages) < max_results and scroll_attempts < max_scroll_attempts:
        await assert_no_checkpoint(page)

        # Extract links in page search feed
        page_links = await page.query_selector_all(
            'div[role="feed"] a[role="presentation"], '
            'div[role="feed"] a[tabindex="0"], '
            'div[role="feed"] a[role="link"], '
            'div[role="main"] a[role="presentation"], '
            'div[role="main"] a[role="link"], '
            'a[href*="/pages/"], '
            'a[href*="facebook.com/"]'
        )

        for el in page_links:
            try:
                href = await el.evaluate('a => a.href || a.getAttribute("href")')
                if not href or '/search/' in href or '/groups/' in href or '/events/' in href or '/watch/' in href:
                    continue

                full_url = clean_facebook_page_url(href)
                parts = [p for p in urllib.parse.urlparse(full_url).path.split('/') if p]
                if not parts:
                    continue

                slug = parts[0]
                # If profile.php without id, ignore
                if slug == 'profile.php' and 'id=' not in full_url:
                    continue

                # Ignore general fb tabs
                if slug in ['watch', 'marketplace', 'gaming', 'stories', 'bookmarks', 'friends', 'saved', 'messages']:
                    continue

                if full_url in seen_urls:
                    continue

                name = (await el.inner_text() or '').strip()
                if not name or len(name) < 2 or name.lower() in ['thích', 'like', 'theo dõi', 'follow', 'nhắn tin', 'xem trang']:
                    continue

                card_text = await el.evaluate('''a => {
                    let parent = a.closest('div[role="feed"]') || a.closest('div[role="article"]') || a.parentElement.parentElement.parentElement;
                    return parent ? parent.innerText : '';
                }''')

                meta = parse_page_metadata(card_text)

                page_data = {
                    'facebook_id': slug if slug.isdigit() else None,
                    'name': name,
                    'url': full_url,
                    'description': card_text[:500] if card_text else '',
                    'followers': meta['followers'],
                    'category': meta['category'],
                    'location': meta['location'],
                    'keyword': keyword,
                    'selected': False,
                    'status': 'ACTIVE'
                }

                seen_urls.add(full_url)
                collected_pages.append(page_data)
                log_info('PAGE_SEARCH', f'Found page: "{name}" ({meta["followers"]} followers)')

                if len(collected_pages) >= max_results:
                    break

            except Exception:
                continue

        if len(collected_pages) >= max_results:
            break

        scroll_attempts += 1
        await page.evaluate('window.scrollBy(0, 1200)')
        await asyncio.sleep(2)

    saved_count = 0
    with SessionLocal() as db:
        for item in collected_pages:
            existing_page = db.query(FacebookPage).filter(FacebookPage.url == item['url']).first()
            if not existing_page:
                new_pg = FacebookPage(**item)
                db.add(new_pg)
                saved_count += 1
            else:
                existing_page.name = item['name']
                existing_page.followers = item['followers']
                existing_page.keyword = keyword
        db.commit()

    log_success('PAGE_SEARCH', f'Completed page search for "{keyword}". Found {len(collected_pages)} pages, {saved_count} new saved.')
    return collected_pages


async def fetch_managed_facebook_pages(max_results: int = 100) -> List[Dict[str, Any]]:
    """
    Automatically fetches all Facebook Pages that the currently logged-in account manages/owns.
    Navigates to https://www.facebook.com/pages/?category=your_pages and extracts page details.
    """
    log_info('PAGE_SYNC', 'Đang kết nối Facebook để đồng bộ danh sách Trang bạn quản lý...')

    if not browser_manager.is_running():
        await browser_manager.start()

    page = await browser_manager.get_page()

    # Try standard URLs for managed pages
    urls_to_try = [
        'https://www.facebook.com/pages/?category=your_pages',
        'https://www.facebook.com/pages/'
    ]

    for target_url in urls_to_try:
        try:
            await page.goto(target_url, wait_until='domcontentloaded', timeout=45000)
            await asyncio.sleep(3)
            break
        except Exception as e:
            log_warning('PAGE_SYNC', f'Không thể mở {target_url}: {e}')

    await assert_no_checkpoint(page)

    collected_pages: List[Dict[str, Any]] = []
    seen_urls = set()

    with SessionLocal() as db:
        existing = db.query(FacebookPage.url).all()
        for row in existing:
            seen_urls.add(row[0])

    scroll_attempts = 0
    max_scrolls = max(6, max_results // 10)

    while len(collected_pages) < max_results and scroll_attempts < max_scrolls:
        await assert_no_checkpoint(page)

        # Look for page cards and links
        elements = await page.query_selector_all(
            'div[role="main"] a[role="link"], '
            'div[role="main"] a[role="presentation"], '
            'div[role="feed"] a[role="link"], '
            'a[href*="facebook.com/"]'
        )

        for el in elements:
            try:
                href = await el.evaluate('a => a.href || a.getAttribute("href")')
                if not href or '/pages/' in href or '/search/' in href or '/groups/' in href or '/settings/' in href:
                    continue

                full_url = clean_facebook_page_url(href)
                parts = [p for p in urllib.parse.urlparse(full_url).path.split('/') if p]
                if not parts:
                    continue

                slug = parts[0]
                if slug in ['watch', 'marketplace', 'gaming', 'stories', 'bookmarks', 'friends', 'saved', 'messages', 'ads']:
                    continue
                if slug == 'profile.php' and 'id=' not in full_url:
                    continue

                if full_url in seen_urls:
                    continue

                name = (await el.inner_text() or '').strip()
                if not name or len(name) < 2 or name.lower() in [
                    'chuyển ngay', 'switch now', 'xem trang', 'tạo trang mới', 'create new page',
                    'thích', 'like', 'theo dõi', 'follow', 'nhắn tin', 'trang của bạn', 'your pages'
                ]:
                    continue

                card_text = await el.evaluate('''a => {
                    let parent = a.closest('div[role="article"]') || a.closest('div[role="listitem"]') || a.parentElement.parentElement;
                    return parent ? parent.innerText : '';
                }''')

                meta = parse_page_metadata(card_text)

                page_info = {
                    'facebook_id': slug if slug.isdigit() else None,
                    'name': name,
                    'url': full_url,
                    'description': card_text[:500] if card_text else 'Trang Facebook bạn quản lý',
                    'followers': meta['followers'],
                    'category': 'Trang của tôi',
                    'location': meta['location'],
                    'keyword': 'Managed Page',
                    'selected': True,  # Default selected for posting
                    'status': 'ACTIVE'
                }

                seen_urls.add(full_url)
                collected_pages.append(page_info)
                log_info('PAGE_SYNC', f'Phát hiện trang quản lý: "{name}" ({full_url})')

                if len(collected_pages) >= max_results:
                    break

            except Exception:
                continue

        if len(collected_pages) >= max_results:
            break

        scroll_attempts += 1
        await page.evaluate('window.scrollBy(0, 800)')
        await asyncio.sleep(1.5)

    saved_count = 0
    with SessionLocal() as db:
        for item in collected_pages:
            existing_page = db.query(FacebookPage).filter(FacebookPage.url == item['url']).first()
            if not existing_page:
                new_pg = FacebookPage(**item)
                db.add(new_pg)
                saved_count += 1
            else:
                existing_page.name = item['name']
                existing_page.category = 'Trang của tôi'
                existing_page.status = 'ACTIVE'
        db.commit()

    log_success('PAGE_SYNC', f'Đồng bộ hoàn tất: Tìm thấy {len(collected_pages)} trang bạn quản lý, lưu mới {saved_count} trang.')
    return collected_pages
