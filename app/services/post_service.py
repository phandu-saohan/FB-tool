from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.database.models import FacebookPost, FacebookPostTarget, FacebookGroup, FacebookPage
from app.schemas.schemas import FacebookPostCreate

class PostService:
    @staticmethod
    def get_all_posts(db: Session) -> List[FacebookPost]:
        return db.query(FacebookPost).order_by(FacebookPost.created_at.desc()).all()

    @staticmethod
    def get_post_by_id(db: Session, post_id: int) -> Optional[FacebookPost]:
        return db.query(FacebookPost).filter(FacebookPost.id == post_id).first()

    @staticmethod
    def create_post(db: Session, post_data: FacebookPostCreate) -> FacebookPost:
        post = FacebookPost(
            title=post_data.title,
            content=post_data.content,
            image_path=post_data.image_path,
            scheduled_at=post_data.scheduled_at,
            status='DRAFT'
        )
        db.add(post)
        db.flush()

        # Add group targets
        if post_data.target_group_ids:
            groups = db.query(FacebookGroup).filter(FacebookGroup.id.in_(post_data.target_group_ids)).all()
            for grp in groups:
                target = FacebookPostTarget(
                    post_id=post.id,
                    target_type='group',
                    target_id=grp.id,
                    target_url=grp.url,
                    status='PENDING'
                )
                db.add(target)

        # Add page targets
        if post_data.target_page_ids:
            pages = db.query(FacebookPage).filter(FacebookPage.id.in_(post_data.target_page_ids)).all()
            for pg in pages:
                target = FacebookPostTarget(
                    post_id=post.id,
                    target_type='page',
                    target_id=pg.id,
                    target_url=pg.url,
                    status='PENDING'
                )
                db.add(target)

        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def update_post_status(db: Session, post_id: int, status: str) -> Optional[FacebookPost]:
        post = db.query(FacebookPost).filter(FacebookPost.id == post_id).first()
        if post:
            post.status = status
            db.commit()
            db.refresh(post)
        return post

    @staticmethod
    def delete_post(db: Session, post_id: int) -> bool:
        post = db.query(FacebookPost).filter(FacebookPost.id == post_id).first()
        if not post:
            return False
        db.delete(post)
        db.commit()
        return True

post_service = PostService()
