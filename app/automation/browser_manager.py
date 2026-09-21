import os
import asyncio
import traceback
from typing import Optional, Tuple
from playwright.async_api import async_playwright, BrowserContext, Page, Playwright
from app.config import settings
from app.utils.logger import log_info, log_warning, log_error
from app.utils.exceptions import BrowserSessionError
from app.automation.checkpoint_detector import detect_facebook_checkpoint

class FacebookBrowserManager:
    _instance: Optional['FacebookBrowserManager'] = None
    _lock = asyncio.Lock()

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(FacebookBrowserManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.profile_path = os.path.abspath(settings.FACEBOOK_PROFILE_PATH)
        self.headless = settings.BROWSER_HEADLESS
        self.chrome_executable = settings.CHROME_EXECUTABLE_PATH
        self.playwright: Optional[Playwright] = None
        self.context: Optional[BrowserContext] = None
        self.active_page: Optional[Page] = None
        self._is_running = False
        self._lock_file = os.path.join(self.profile_path, '.browser.lock')
        self._initialized = True

    def _acquire_profile_lock(self):
        os.makedirs(self.profile_path, exist_ok=True)
        if os.path.exists(self._lock_file):
            try:
                with open(self._lock_file, 'r') as f:
                    pid_str = f.read().strip()
                if pid_str and pid_str.isdigit():
                    pid = int(pid_str)
                    import psutil
                    if not psutil.pid_exists(pid):
                        os.remove(self._lock_file)
                    else:
                        log_warning('BROWSER', f'Profile lock held by PID {pid}')
            except Exception:
                try:
                    os.remove(self._lock_file)
                except Exception:
                    pass

        try:
            with open(self._lock_file, 'w') as f:
                f.write(str(os.getpid()))
        except Exception as e:
            log_warning('BROWSER', f'Could not write profile lock: {e}')

    def _release_profile_lock(self):
        try:
            if os.path.exists(self._lock_file):
                os.remove(self._lock_file)
        except Exception as e:
            log_warning('BROWSER', f'Could not release profile lock: {e}')

    async def start(self) -> BrowserContext:
        async with self._lock:
            if self._is_running and self.context:
                try:
                    # Test if context is still alive
                    if len(self.context.pages) >= 0:
                        log_info('BROWSER', 'Browser context is already running and active')
                        return self.context
                except Exception:
                    log_warning('BROWSER', 'Previous context closed unexpectedly, restarting...')
                    self._is_running = False

            try:
                self._acquire_profile_lock()
                log_info('BROWSER', f'Starting browser with profile: {self.profile_path} (headless={self.headless})')
                
                self.playwright = await async_playwright().start()
                
                launch_args = [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--lang=vi-VN,vi,en-US,en'
                ]
                
                kwargs = {
                    'user_data_dir': self.profile_path,
                    'headless': self.headless,
                    'no_viewport': True,
                    'args': launch_args,
                    'ignore_default_args': ['--enable-automation'],
                    'locale': 'vi-VN',
                    'timezone_id': 'Asia/Ho_Chi_Minh'
                }
                
                if self.chrome_executable and os.path.exists(self.chrome_executable):
                    kwargs['executable_path'] = self.chrome_executable
                
                self.context = await self.playwright.chromium.launch_persistent_context(**kwargs)
                
                # Setup stealth script on all pages
                try:
                    await self.context.add_init_script("""
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    """)
                except Exception:
                    pass

                # Get or create initial page
                pages = self.context.pages
                self.active_page = pages[0] if pages else await self.context.new_page()
                self._is_running = True
                log_info('BROWSER', 'Browser session started successfully with Persistent Profile')
                return self.context
            except Exception as e:
                err_details = traceback.format_exc()
                log_error('BROWSER', f'Failed to start browser: {e}\n{err_details}')
                self._release_profile_lock()
                self._is_running = False
                raise BrowserSessionError(f'Không thể khởi động trình duyệt: {e}')

    async def stop(self):
        async with self._lock:
            try:
                log_info('BROWSER', 'Stopping browser session...')
                if self.context:
                    await self.context.close()
                if self.playwright:
                    await self.playwright.stop()
            except Exception as e:
                log_warning('BROWSER', f'Error during browser stop: {e}')
            finally:
                self.context = None
                self.playwright = None
                self.active_page = None
                self._is_running = False
                self._release_profile_lock()
                log_info('BROWSER', 'Browser session stopped cleanly')

    async def restart(self) -> BrowserContext:
        await self.stop()
        await asyncio.sleep(1)
        return await self.start()

    def is_running(self) -> bool:
        return self._is_running and self.context is not None

    def get_session(self) -> Optional[BrowserContext]:
        return self.context

    async def get_page(self) -> Page:
        if not self.is_running():
            await self.start()
        if not self.active_page or self.active_page.is_closed():
            pages = self.context.pages
            self.active_page = pages[0] if pages else await self.context.new_page()
        return self.active_page

browser_manager = FacebookBrowserManager()
