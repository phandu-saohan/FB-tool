import urllib.parse
from typing import List, Optional, Dict, Any
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
    def create_page(db: Session, page_data: FacebookPageCreate) -> FacebookPage:
        from app.automation.facebook_page import clean_facebook_page_url
        clean_url = clean_facebook_page_url(page_data.url)
        existing = db.query(FacebookPage).filter(FacebookPage.url == clean_url).first()
        if existing:
            if page_data.name and page_data.name.strip():
                existing.name = page_data.name.strip()
            if page_data.category:
                existing.category = page_data.category
            existing.status = 'ACTIVE'
            db.commit()
            db.refresh(existing)
            return existing

        name = (page_data.name or '').strip()
        if not name:
            path = urllib.parse.urlparse(clean_url).path.strip('/')
            name = path.replace('-', ' ').replace('_', ' ').title() or 'Facebook Page'

        new_pg = FacebookPage(
            name=name,
            url=clean_url,
            facebook_id=page_data.facebook_id,
            description=page_data.description or '',
            followers=page_data.followers or 'N/A',
            category=page_data.category or 'Page',
            location=page_data.location or '',
            keyword=page_data.keyword or 'Manual',
            selected=page_data.selected if page_data.selected is not None else False,
            status=page_data.status or 'ACTIVE'
        )
        db.add(new_pg)
        db.commit()
        db.refresh(new_pg)
        return new_pg

    @staticmethod
    def batch_create_pages(db: Session, urls: List[str], category: str = "Page", keyword: str = None) -> Dict[str, Any]:
        from app.automation.facebook_page import clean_facebook_page_url
        added = 0
        updated = 0
        invalid = 0

        for raw_url in urls:
            raw_url = raw_url.strip()
            if not raw_url:
                continue

            clean_url = clean_facebook_page_url(raw_url)
            if not clean_url or 'facebook.com' not in clean_url:
                invalid += 1
                continue

            existing = db.query(FacebookPage).filter(FacebookPage.url == clean_url).first()
            if existing:
                existing.status = 'ACTIVE'
                if category:
                    existing.category = category
                updated += 1
            else:
                path = urllib.parse.urlparse(clean_url).path.strip('/')
                derived_name = path.replace('-', ' ').replace('_', ' ').title() or 'Facebook Page'
                new_pg = FacebookPage(
                    name=derived_name,
                    url=clean_url,
                    category=category or 'Page',
                    keyword=keyword or 'Batch Import',
                    selected=True,
                    status='ACTIVE'
                )
                db.add(new_pg)
                added += 1

        db.commit()
        return {
            "message": f"Nạp danh sách trang thành công: Thêm mới {added} trang, cập nhật {updated} trang.",
            "added": added,
            "updated": updated,
            "invalid": invalid,
            "total": added + updated
        }

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
