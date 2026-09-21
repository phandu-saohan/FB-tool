import os
import sys
import asyncio
import traceback

# On Windows, enforce WindowsProactorEventLoopPolicy so Playwright can launch subprocesses
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database.database import init_db
from app.automation.browser_manager import browser_manager
from app.utils.logger import log_info, log_error, log_warning

# API Routers
from app.api.groups import router as groups_router
from app.api.pages import router as pages_router
from app.api.posts import router as posts_router
from app.api.browser import router as browser_router
from app.api.settings import router as settings_router
from app.api.automation import router as automation_router
from app.api.logs import router as logs_router
from app.api.comments import router as comments_router
from app.api.email import router as email_router
from app.services.email.scheduler import EmailScheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    log_info("STARTUP", "Initializing database tables...")
    init_db()
    EmailScheduler.get_instance().start()
    log_info("STARTUP", "Facebook Automation & Email Engine is online.")
    yield
    # Shutdown
    log_info("SHUTDOWN", "Shutting down background resources...")
    EmailScheduler.get_instance().stop()
    if browser_manager.is_running():
        await browser_manager.stop()
    log_info("SHUTDOWN", "Clean shutdown complete.")

app = FastAPI(
    title="Facebook Automation Engine",
    description="Automated Facebook Group/Page search and posting with Persistent Browser Context & AI Studio",
    version="1.0.0",
    lifespan=lifespan
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    err_str = str(exc)
    trace = traceback.format_exc()
    log_error("SERVER", f"Unhandled error at {request.url.path}: {err_str}\n{trace}")
    return JSONResponse(
        status_code=500,
        content={"detail": err_str or "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng kiểm tra tab Logs."}
    )

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploads directory
UPLOAD_DIR = os.path.abspath("data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include API routers
app.include_router(groups_router, prefix="/api")
app.include_router(pages_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
app.include_router(browser_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(automation_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(comments_router, prefix="/api")
app.include_router(email_router)

# Serve frontend build if exists
FRONTEND_DIST = os.path.abspath("frontend/dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def index():
        return {
            "status": "online",
            "name": "Facebook Automation API",
            "docs_url": "/docs",
            "health": "healthy"
        }
