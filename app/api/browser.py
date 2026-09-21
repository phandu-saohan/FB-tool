import asyncio
import json
import re
from fastapi import APIRouter, HTTPException
from app.automation.browser_manager import browser_manager
from app.automation.facebook_login import check_facebook_login
from app.automation.checkpoint_detector import detect_facebook_checkpoint
from app.schemas.schemas import BrowserStatusResponse, ImportCookiesRequest, ImportCookiesResponse
from app.utils.logger import log_info, log_error

router = APIRouter(prefix="/browser", tags=["Browser"])

def parse_cookie_input(raw_input: str) -> list[dict]:
    raw = raw_input.strip()
    if not raw:
        return []

    cookies = []
    # 1. Try parsing JSON (e.g. from Cookie-Editor, EditThisCookie extensions)
    if (raw.startswith('[') and raw.endswith(']')) or (raw.startswith('{') and raw.endswith('}')):
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                data = [data]
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and "name" in item and "value" in item:
                        domain = item.get("domain") or ".facebook.com"
                        if not domain.endswith("facebook.com"):
                            domain = ".facebook.com"
                        c = {
                            "name": str(item["name"]).strip(),
                            "value": str(item["value"]).strip(),
                            "domain": domain,
                            "path": item.get("path") or "/"
                        }
                        ss = item.get("sameSite")
                        if ss in ["Strict", "Lax", "None"]:
                            c["sameSite"] = ss
                        if "secure" in item and isinstance(item["secure"], bool):
                            c["secure"] = item["secure"]
                        if "httpOnly" in item and isinstance(item["httpOnly"], bool):
                            c["httpOnly"] = item["httpOnly"]
                        cookies.append(c)
                if cookies:
                    return cookies
        except Exception:
            pass

    # 2. Parse raw cookie string or key=val per line (c_user=...; xs=...)
    tokens = re.split(r'[;\r\n]+', raw)
    for token in tokens:
        token = token.strip()
        if not token or '=' not in token:
            continue
        parts = token.split('=', 1)
        name = parts[0].strip()
        val = parts[1].strip()
        if name:
            cookies.append({
                "name": name,
                "value": val,
                "domain": ".facebook.com",
                "path": "/"
            })
    return cookies

@router.get("/status", response_model=BrowserStatusResponse)
async def get_browser_status():
    try:
        is_running = browser_manager.is_running()
        checkpoint_detected = False
        checkpoint_reason = None
        login_status = "STOPPED"
        is_logged_in = False

        if is_running:
            try:
                page = await browser_manager.get_page()
                is_cp, cp_reason = await detect_facebook_checkpoint(page)
                checkpoint_detected = is_cp
                checkpoint_reason = cp_reason if is_cp else None
                
                logged_in, status_str = await check_facebook_login(open_browser_if_needed=False)
                is_logged_in = logged_in
                login_status = status_str
            except Exception as check_err:
                log_error("BROWSER_STATUS", f"Error checking active page: {check_err}")

        return BrowserStatusResponse(
            is_running=is_running,
            profile_path=browser_manager.profile_path,
            is_logged_in=is_logged_in,
            login_status=login_status,
            checkpoint_detected=checkpoint_detected,
            checkpoint_reason=checkpoint_reason
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi kiểm tra trạng thái trình duyệt: {str(e)}")

@router.post("/start")
async def start_browser():
    try:
        await browser_manager.start()
        return {"message": "Trình duyệt đã được khởi động thành công với Persistent Profile."}
    except Exception as e:
        log_error("BROWSER_START", f"Lỗi khởi động trình duyệt: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể khởi động trình duyệt: {str(e)}")

@router.post("/stop")
async def stop_browser():
    try:
        await browser_manager.stop()
        return {"message": "Trình duyệt đã dừng hoạt động."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi dừng trình duyệt: {str(e)}")

@router.post("/open-login")
async def open_facebook_login():
    """Opens Facebook home page in browser so user can manually log in once"""
    try:
        await browser_manager.start()
        page = await browser_manager.get_page()
        try:
            await page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=45000)
        except Exception as nav_err:
            log_error("BROWSER", f"Navigation to facebook.com had warning: {nav_err}")

        log_info("BROWSER", "Opened Facebook for user manual login.")
        return {"message": "Đã mở Facebook trên trình duyệt. Vui lòng đăng nhập thủ công tài khoản của bạn."}
    except Exception as e:
        log_error("BROWSER_OPEN_LOGIN", f"Lỗi mở Facebook: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể mở Facebook trên trình duyệt: {str(e)}")

@router.get("/login-check")
async def run_login_check():
    try:
        logged_in, status = await check_facebook_login(open_browser_if_needed=True)
        return {
            "is_logged_in": logged_in,
            "status": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi kiểm tra đăng nhập: {str(e)}")

@router.post("/import-cookies", response_model=ImportCookiesResponse)
async def import_facebook_cookies(req: ImportCookiesRequest):
    """Imports Facebook cookies directly into the browser session (ideal for headless VPS/Dokploy)"""
    try:
        cookies = parse_cookie_input(req.cookie_data)
        if not cookies:
            raise HTTPException(status_code=400, detail="Không tìm thấy cookie hợp lệ. Vui lòng kiểm tra lại chuỗi cookie hoặc định dạng JSON.")

        # Ensure browser is started
        await browser_manager.start()
        
        # Add cookies to context
        await browser_manager.context.add_cookies(cookies)
        log_info("BROWSER_COOKIE", f"Injected {len(cookies)} cookies into browser context.")

        # Navigate to Facebook to initialize session
        page = await browser_manager.get_page()
        try:
            await page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=45000)
            await asyncio.sleep(2)
        except Exception as nav_err:
            log_error("BROWSER_COOKIE", f"Navigation warning after cookie import: {nav_err}")

        is_logged_in, status = await check_facebook_login(open_browser_if_needed=False)

        if is_logged_in:
            msg = f"Đã nạp thành công {len(cookies)} cookies! Phiên Facebook đã đăng nhập thành công."
        else:
            msg = f"Đã nạp {len(cookies)} cookies nhưng chưa thể xác nhận đăng nhập (Trạng thái: {status}). Vui lòng kiểm tra cookie c_user và xs còn hạn hay không."

        return ImportCookiesResponse(
            success=is_logged_in,
            is_logged_in=is_logged_in,
            status=status,
            message=msg,
            cookies_count=len(cookies)
        )
    except HTTPException:
        raise
    except Exception as e:
        log_error("BROWSER_COOKIE", f"Lỗi nạp cookies: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể nạp cookies: {str(e)}")

