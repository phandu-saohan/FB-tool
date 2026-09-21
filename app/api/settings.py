import os
from fastapi import APIRouter
from app.config import settings
from app.schemas.schemas import SettingsUpdate
from app.utils.logger import log_info

router = APIRouter(prefix="/settings", tags=["Settings"])

def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"

@router.get("")
def get_settings():
    return {
        "AI_PROVIDER": settings.AI_PROVIDER,
        "GEMINI_API_KEY": mask_key(settings.GEMINI_API_KEY),
        "OPENAI_API_KEY": mask_key(settings.OPENAI_API_KEY),
        "OPENROUTER_API_KEY": mask_key(settings.OPENROUTER_API_KEY),
        "POST_DELAY_MIN": settings.POST_DELAY_MIN,
        "POST_DELAY_MAX": settings.POST_DELAY_MAX,
        "MAX_POSTS_PER_RUN": settings.MAX_POSTS_PER_RUN,
        "BROWSER_HEADLESS": settings.BROWSER_HEADLESS,
        "CHROME_EXECUTABLE_PATH": settings.CHROME_EXECUTABLE_PATH or "",
        "FACEBOOK_PROFILE_PATH": settings.FACEBOOK_PROFILE_PATH
    }

@router.post("")
def update_settings(data: SettingsUpdate):
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        if val is not None and hasattr(settings, key):
            setattr(settings, key, val)

    # Persist non-sensitive configuration to .env if needed
    try:
        if os.path.exists('.env'):
            with open('.env', 'r', encoding='utf-8') as f:
                lines = f.readlines()
            new_lines = []
            keys_written = set()
            for line in lines:
                written = False
                for k, v in updates.items():
                    if v is not None and line.startswith(f"{k}="):
                        new_lines.append(f"{k}={v}\n")
                        keys_written.add(k)
                        written = True
                        break
                if not written:
                    new_lines.append(line)
            for k, v in updates.items():
                if v is not None and k not in keys_written:
                    new_lines.append(f"{k}={v}\n")
            with open('.env', 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
    except Exception as e:
        log_info("SETTINGS", f"Could not update .env file directly: {e}")

    log_info("SETTINGS", "Application configuration updated.")
    return {"message": "Cấu hình đã được lưu thành công."}
