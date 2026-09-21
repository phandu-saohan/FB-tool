from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import AutomationLog
from app.utils.logger import get_recent_logs

router = APIRouter(prefix="/logs", tags=["Logs"])

@router.get("")
def get_logs(limit: int = Query(100, ge=10, le=500)):
    return get_recent_logs(limit)

@router.get("/db")
def get_db_logs(limit: int = Query(100, ge=10, le=500), db: Session = Depends(get_db)):
    records = db.query(AutomationLog).order_by(AutomationLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "level": r.level,
            "action": r.action,
            "message": r.message,
            "created_at": r.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }
        for r in reversed(records)
    ]
