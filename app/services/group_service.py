from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.models import FacebookGroup
from app.schemas.schemas import FacebookGroupCreate, FacebookGroupUpdate

class GroupService:
    @staticmethod
    def get_all_groups(
        db: Session,
        keyword: Optional[str] = None,
        privacy: Optional[str] = None,
        status: Optional[str] = None,
        only_selected: bool = False
    ) -> List[FacebookGroup]:
        query = db.query(FacebookGroup)
        if keyword:
            query = query.filter(FacebookGroup.keyword.ilike(f"%{keyword}%") | FacebookGroup.name.ilike(f"%{keyword}%"))
        if privacy:
            query = query.filter(FacebookGroup.privacy == privacy)
        if status:
            query = query.filter(FacebookGroup.status == status)
        if only_selected:
            query = query.filter(FacebookGroup.selected == True)
        return query.order_by(FacebookGroup.discovered_at.desc()).all()

    @staticmethod
    def get_group_by_id(db: Session, group_id: int) -> Optional[FacebookGroup]:
        return db.query(FacebookGroup).filter(FacebookGroup.id == group_id).first()

    @staticmethod
    def update_group(db: Session, group_id: int, update_data: FacebookGroupUpdate) -> Optional[FacebookGroup]:
        grp = db.query(FacebookGroup).filter(FacebookGroup.id == group_id).first()
        if not grp:
            return None
        data = update_data.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(grp, key, val)
        db.commit()
        db.refresh(grp)
        return grp

    @staticmethod
    def delete_group(db: Session, group_id: int) -> bool:
        grp = db.query(FacebookGroup).filter(FacebookGroup.id == group_id).first()
        if not grp:
            return False
        db.delete(grp)
        db.commit()
        return True

    @staticmethod
    def bulk_select(db: Session, group_ids: List[int], selected: bool = True):
        db.query(FacebookGroup).filter(FacebookGroup.id.in_(group_ids)).update({'selected': selected}, synchronize_session=False)
        db.commit()

    @staticmethod
    def select_all(db: Session, selected: bool = True):
        db.query(FacebookGroup).update({'selected': selected}, synchronize_session=False)
        db.commit()

group_service = GroupService()
