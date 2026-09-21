import sys
import asyncio

def get_proactor_loop(*args, **kwargs):
    """
    Ensures ProactorEventLoop is used on Windows so Playwright
    can launch Chromium browser subprocesses without NotImplementedError.
    """
    if sys.platform == "win32":
        return asyncio.ProactorEventLoop()
    return asyncio.new_event_loop()
