from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.database import get_db
from app.services.group_service import group_service
from app.automation.facebook_group import (
    search_facebook_groups,
    fetch_joined_facebook_groups,
    join_facebook_group,
    bulk_join_facebook_groups
)
from app.schemas.schemas import FacebookGroupResponse, FacebookGroupUpdate, SearchRequest

router = APIRouter(prefix="/groups", tags=["Groups"])

@router.get("", response_model=List[FacebookGroupResponse])
def get_groups(
    keyword: Optional[str] = None,
    privacy: Optional[str] = None,
    status: Optional[str] = None,
    only_selected: bool = False,
    db: Session = Depends(get_db)
):
    return group_service.get_all_groups(db, keyword, privacy, status, only_selected)

@router.post("/search")
async def search_groups(req: SearchRequest):
    """Triggers Facebook Group search and collection"""
    results = await search_facebook_groups(keyword=req.keyword, max_results=req.max_results)
    return {
        "message": f"Tìm kiếm thành công, tìm thấy {len(results)} nhóm.",
        "count": len(results),
        "results": results
    }

@router.api_route("/sync-joined", methods=["GET", "POST"])
async def sync_joined_groups(max_results: int = Query(200, ge=10, le=500)):
    """Automatically fetches and saves all Facebook groups the user has already joined"""
    results = await fetch_joined_facebook_groups(max_results=max_results)
    return {
        "message": f"Đồng bộ thành công {len(results)} nhóm đã tham gia.",
        "count": len(results),
        "results": results
    }

@router.post("/bulk-join")
async def bulk_join_groups(group_ids: List[int]):
    """Sequentially joins multiple Facebook groups"""
    if not group_ids:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một nhóm để tham gia.")
    
    res = await bulk_join_facebook_groups(group_ids)
    return res

@router.post("/select-all")
def select_all_groups(selected: bool = Query(True), db: Session = Depends(get_db)):
    group_service.select_all(db, selected)
    return {"message": f"Đã {'chọn' if selected else 'bỏ chọn'} tất cả nhóm"}

@router.post("/bulk-select")
def bulk_select_groups(group_ids: List[int], selected: bool = Query(True), db: Session = Depends(get_db)):
    group_service.bulk_select(db, group_ids, selected)
    return {"message": f"Đã cập nhật {len(group_ids)} nhóm"}

@router.get("/{group_id}", response_model=FacebookGroupResponse)
def get_group(group_id: int, db: Session = Depends(get_db)):
    grp = group_service.get_group_by_id(db, group_id)
    if not grp:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    return grp

@router.put("/{group_id}", response_model=FacebookGroupResponse)
def update_group(group_id: int, update_data: FacebookGroupUpdate, db: Session = Depends(get_db)):
    grp = group_service.update_group(db, group_id, update_data)
    if not grp:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    return grp

@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    success = group_service.delete_group(db, group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    return {"message": "Nhóm đã được xóa thành công"}

@router.post("/{group_id}/join")
async def join_single_group(group_id: int, db: Session = Depends(get_db)):
    """Automates joining a specific group"""
    grp = group_service.get_group_by_id(db, group_id)
    if not grp:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    
    success, msg = await join_facebook_group(grp.url)
    return {
        "success": success,
        "message": msg,
        "group_id": group_id
    }
