from fastapi import APIRouter
from app.services.queue_service import queue_service

router = APIRouter(prefix="/automation", tags=["Automation"])

@router.get("/status")
def get_queue_status():
    return queue_service.get_status()

@router.post("/pause")
def pause_queue():
    queue_service.pause()
    return {"message": "Hàng đợi đã tạm dừng."}

@router.post("/resume")
def resume_queue():
    queue_service.resume()
    return {"message": "Hàng đợi đã tiếp tục hoạt động."}

@router.post("/cancel")
def cancel_queue():
    queue_service.cancel()
    return {"message": "Hàng đợi đã bị hủy."}
