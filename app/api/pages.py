from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.database import get_db
from app.services.page_service import page_service
from app.automation.facebook_page import search_facebook_pages, fetch_managed_facebook_pages
from app.schemas.schemas import (
    FacebookPageResponse, 
    FacebookPageCreate, 
    FacebookPageBatchCreate, 
    FacebookPageUpdate, 
    SearchRequest
)

router = APIRouter(prefix="/pages", tags=["Pages"])

@router.get("", response_model=List[FacebookPageResponse])
def get_pages(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    only_selected: bool = False,
    db: Session = Depends(get_db)
):
    return page_service.get_all_pages(db, keyword, status, only_selected)

@router.post("", response_model=FacebookPageResponse)
def create_page(page_data: FacebookPageCreate, db: Session = Depends(get_db)):
    """Creates a new Facebook Page record manually"""
    if not page_data.url or not page_data.url.strip():
        raise HTTPException(status_code=400, detail="Đường dẫn URL của Trang là bắt buộc.")
    return page_service.create_page(db, page_data)

@router.post("/batch")
def batch_create_pages(batch_data: FacebookPageBatchCreate, db: Session = Depends(get_db)):
    """Imports multiple Facebook Pages from a list of URLs"""
    if not batch_data.urls:
        raise HTTPException(status_code=400, detail="Danh sách URL không được để trống.")
    return page_service.batch_create_pages(
        db, 
        urls=batch_data.urls, 
        category=batch_data.category or 'Page', 
        keyword=batch_data.keyword or 'Batch Import'
    )

@router.api_route("/sync-managed", methods=["GET", "POST"])
async def sync_managed_pages(max_results: int = Query(100, ge=5, le=300)):
    """Automatically connects to Facebook and syncs all Pages managed by the logged-in account"""
    results = await fetch_managed_facebook_pages(max_results=max_results)
    return {
        "message": f"Đồng bộ thành công {len(results)} trang bạn quản lý.",
        "count": len(results),
        "results": results
    }

@router.post("/search")
async def search_pages(req: SearchRequest):
    """Triggers Facebook Page search and collection"""
    results = await search_facebook_pages(keyword=req.keyword, max_results=req.max_results)
    return {
        "message": f"Tìm kiếm thành công, tìm thấy {len(results)} trang.",
        "count": len(results),
        "results": results
    }

@router.post("/select-all")
def select_all_pages(selected: bool = Query(True), db: Session = Depends(get_db)):
    page_service.select_all(db, selected)
    return {"message": f"Đã {'chọn' if selected else 'bỏ chọn'} tất cả trang"}

@router.post("/bulk-select")
def bulk_select_pages(page_ids: List[int], selected: bool = Query(True), db: Session = Depends(get_db)):
    page_service.bulk_select(db, page_ids, selected)
    return {"message": f"Đã cập nhật {len(page_ids)} trang"}

@router.get("/{page_id}", response_model=FacebookPageResponse)
def get_page(page_id: int, db: Session = Depends(get_db)):
    pg = page_service.get_page_by_id(db, page_id)
    if not pg:
        raise HTTPException(status_code=404, detail="Trang không tồn tại")
    return pg

@router.put("/{page_id}", response_model=FacebookPageResponse)
def update_page(page_id: int, update_data: FacebookPageUpdate, db: Session = Depends(get_db)):
    pg = page_service.update_page(db, page_id, update_data)
    if not pg:
        raise HTTPException(status_code=404, detail="Trang không tồn tại")
    return pg

@router.delete("/{page_id}")
def delete_page(page_id: int, db: Session = Depends(get_db)):
    success = page_service.delete_page(db, page_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trang không tồn tại")
    return {"message": "Trang đã được xóa thành công"}
