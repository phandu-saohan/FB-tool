from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.models import FacebookPage
from app.schemas.schemas import FacebookPageCreate, FacebookPageUpdate

class PageService:
    @staticmethod
    def get_all_pages(
        db: Session,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        only_selected: bool = False
    ) -> List[FacebookPage]:
        query = db.query(FacebookPage)
        if keyword:
            query = query.filter(FacebookPage.keyword.ilike(f"%{keyword}%") | FacebookPage.name.ilike(f"%{keyword}%"))
        if status:
            query = query.filter(FacebookPage.status == status)
        if only_selected:
            query = query.filter(FacebookPage.selected == True)
        return query.order_by(FacebookPage.discovered_at.desc()).all()

    @staticmethod
    def get_page_by_id(db: Session, page_id: int) -> Optional[FacebookPage]:
        return db.query(FacebookPage).filter(FacebookPage.id == page_id).first()

    @staticmethod
    def update_page(db: Session, page_id: int, update_data: FacebookPageUpdate) -> Optional[FacebookPage]:
        pg = db.query(FacebookPage).filter(FacebookPage.id == page_id).first()
        if not pg:
            return None
        data = update_data.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(pg, key, val)
        db.commit()
        db.refresh(pg)
        return pg

    @staticmethod
    def delete_page(db: Session, page_id: int) -> bool:
        pg = db.query(FacebookPage).filter(FacebookPage.id == page_id).first()
        if not pg:
            return False
        db.delete(pg)
        db.commit()
        return True

    @staticmethod
    def bulk_select(db: Session, page_ids: List[int], selected: bool = True):
        db.query(FacebookPage).filter(FacebookPage.id.in_(page_ids)).update({'selected': selected}, synchronize_session=False)
        db.commit()

    @staticmethod
    def select_all(db: Session, selected: bool = True):
        db.query(FacebookPage).update({'selected': selected}, synchronize_session=False)
        db.commit()

page_service = PageService()
