import logging
import os
from datetime import datetime
from collections import deque
from typing import List, Dict, Any, Optional

# In-memory log buffer for dashboard real-time access
RECENT_LOGS = deque(maxlen=500)

os.makedirs('logs', exist_ok=True)
LOG_FILE = os.path.join('logs', 'automation.log')

class CustomFormatter(logging.Formatter):
    def format(self, record):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        level = record.levelname
        msg = record.getMessage()
        return f'[{timestamp}] [{level}] {msg}'

file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
file_handler.setFormatter(CustomFormatter())

console_handler = logging.StreamHandler()
console_handler.setFormatter(CustomFormatter())

app_logger = logging.getLogger('facebook_automation')
app_logger.setLevel(logging.INFO)
app_logger.addHandler(file_handler)
app_logger.addHandler(console_handler)

def record_log(level: str, action: str, message: str, save_to_db: bool = True):
    timestamp = datetime.now()
    log_item = {
        'id': len(RECENT_LOGS) + 1,
        'level': level.upper(),
        'action': action,
        'message': message,
        'created_at': timestamp.strftime('%Y-%m-%d %H:%M:%S')
    }
    RECENT_LOGS.append(log_item)
    
    formatted_msg = f'[{action}] {message}' if action else message
    if level.upper() == 'SUCCESS':
        app_logger.info(f'[SUCCESS] {formatted_msg}')
    elif level.upper() == 'WARNING':
        app_logger.warning(formatted_msg)
    elif level.upper() == 'ERROR':
        app_logger.error(formatted_msg)
    else:
        app_logger.info(formatted_msg)

    # Database async logging if needed
    if save_to_db:
        try:
            from app.database.database import SessionLocal
            from app.database.models import AutomationLog
            with SessionLocal() as db:
                log_entry = AutomationLog(
                    level=level.upper(),
                    action=action,
                    message=message,
                    created_at=timestamp
                )
                db.add(log_entry)
                db.commit()
        except Exception:
            # Avoid recursive failure during early startup before DB is ready
            pass

def log_info(action: str, message: str, save_to_db: bool = True):
    record_log('INFO', action, message, save_to_db)

def log_success(action: str, message: str, save_to_db: bool = True):
    record_log('SUCCESS', action, message, save_to_db)

def log_warning(action: str, message: str, save_to_db: bool = True):
    record_log('WARNING', action, message, save_to_db)

def log_error(action: str, message: str, save_to_db: bool = True):
    record_log('ERROR', action, message, save_to_db)

def get_recent_logs(limit: int = 100) -> List[Dict[str, Any]]:
    logs = list(RECENT_LOGS)
    return logs[-limit:]
