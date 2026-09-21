import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.services.post_service import post_service
from app.services.queue_service import queue_service
from app.ai.content_generator import generate_facebook_post
from app.schemas.schemas import (
    FacebookPostCreate,
    FacebookPostResponse,
    AIGenerateRequest,
    AIGenerateResponse
)
from app.utils.logger import log_info

router = APIRouter(prefix="/posts", tags=["Posts"])

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
UPLOAD_DIR = os.path.abspath('data/uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("", response_model=List[FacebookPostResponse])
def get_posts(db: Session = Depends(get_db)):
    return post_service.get_all_posts(db)

@router.get("/{post_id}", response_model=FacebookPostResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = post_service.get_post_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")
    return post

@router.post("", response_model=FacebookPostResponse)
def create_post(post_data: FacebookPostCreate, db: Session = Depends(get_db)):
    return post_service.create_post(db, post_data)

@router.delete("/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db)):
    success = post_service.delete_post(db, post_id)
    if not success:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")
    return {"message": "Bài viết đã được xóa thành công"}

@router.post("/{post_id}/publish")
async def publish_post(post_id: int, db: Session = Depends(get_db)):
    """Puts the post and its targets into the automation posting queue"""
    post = post_service.get_post_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")
    
    if not post.targets:
        raise HTTPException(status_code=400, detail="Bài viết chưa có mục tiêu (Group hoặc Page) nào được chọn để đăng.")

    try:
        await queue_service.enqueue_post(post_id)
        return {"message": f"Bài viết ID {post_id} đã được thêm vào hàng đợi đăng bài thành công."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ai-generate", response_model=AIGenerateResponse)
async def ai_generate_post(req: AIGenerateRequest):
    """Generates structured Facebook post text using AI"""
    result = await generate_facebook_post(
        topic=req.topic,
        audience=req.audience,
        tone=req.tone,
        call_to_action=req.call_to_action,
        provider_name=req.provider
    )
    return result

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Securely uploads an image for Facebook posting with extension sanitization"""
    filename = file.filename or "upload.jpg"
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng file không được hỗ trợ. Chỉ chấp nhận: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)

    content = await file.read()
    # Limit to 15MB
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Kích thước file ảnh vượt quá giới hạn cho phép (15MB).")

    with open(dest_path, "wb") as f:
        f.write(content)

    log_info("UPLOAD", f"Image uploaded securely: {safe_filename} ({len(content)} bytes)")
    return {
        "image_path": dest_path,
        "filename": safe_filename,
        "url": f"/static/uploads/{safe_filename}"
    }
