import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from app.database.database import SessionLocal
from app.database.models import FacebookPost, FacebookPostTarget
from app.automation.facebook_post import post_to_facebook_target
from app.automation.checkpoint_detector import detect_facebook_checkpoint
from app.utils.logger import log_info, log_success, log_warning, log_error
from app.utils.exceptions import FacebookCheckpointDetected
from app.utils.rate_limiter import SafeRateLimiter

class AutomationQueueService:
    def __init__(self):
        self.status = 'IDLE' # IDLE, RUNNING, PAUSED, ACTION_REQUIRED, CANCELLED
        self.current_post_id: Optional[int] = None
        self.current_target_index: int = 0
        self.total_targets: int = 0
        self.completed_targets: int = 0
        self.failed_targets: int = 0
        self.status_message: str = "Hàng đợi đang rảnh."
        self.countdown_remaining: int = 0
        self._pause_event = asyncio.Event()
        self._pause_event.set() # Not paused initially
        self._is_cancelled = False
        self._worker_task: Optional[asyncio.Task] = None
        self.rate_limiter = SafeRateLimiter()

    def get_status(self) -> Dict[str, Any]:
        return {
            'status': self.status,
            'current_post_id': self.current_post_id,
            'total_in_queue': self.total_targets,
            'completed': self.completed_targets,
            'failed': self.failed_targets,
            'countdown_remaining': self.countdown_remaining,
            'message': self.status_message
        }

    def pause(self):
        if self.status == 'RUNNING':
            self.status = 'PAUSED'
            self._pause_event.clear()
            self.status_message = "Hàng đợi đã tạm dừng bởi người dùng."
            log_warning('QUEUE', self.status_message)

    def resume(self):
        if self.status in ['PAUSED', 'ACTION_REQUIRED']:
            self.status = 'RUNNING'
            self._pause_event.set()
            self.status_message = "Hàng đợi tiếp tục hoạt động."
            log_info('QUEUE', self.status_message)

    def cancel(self):
        self._is_cancelled = True
        self.status = 'CANCELLED'
        self._pause_event.set()
        self.status_message = "Hàng đợi đã bị hủy bởi người dùng."
        log_warning('QUEUE', self.status_message)

    async def enqueue_post(self, post_id: int):
        if self.status == 'RUNNING':
            raise ValueError("Có một tác vụ đang chạy trong hàng đợi. Vui lòng đợi hoặc tạm dừng.")

        self.current_post_id = post_id
        self._is_cancelled = False
        self._pause_event.set()
        self.rate_limiter.reset_counter()

        with SessionLocal() as db:
            post = db.query(FacebookPost).filter(FacebookPost.id == post_id).first()
            if not post:
                raise ValueError(f"Bài viết ID {post_id} không tồn tại.")
            post.status = 'QUEUED'
            db.commit()
            targets = db.query(FacebookPostTarget).filter(
                FacebookPostTarget.post_id == post_id,
                FacebookPostTarget.status.in_(['PENDING', 'FAILED'])
            ).all()
            self.total_targets = len(targets)
            self.completed_targets = 0
            self.failed_targets = 0

        self.status = 'RUNNING'
        self.status_message = f"Bắt đầu đăng bài viết ID {post_id} tới {self.total_targets} mục tiêu."
        log_info('QUEUE', self.status_message)

        # Start background worker
        self._worker_task = asyncio.create_task(self._process_post_queue(post_id))

    async def _process_post_queue(self, post_id: int):
        try:
            with SessionLocal() as db:
                post = db.query(FacebookPost).filter(FacebookPost.id == post_id).first()
                if not post:
                    return
                post.status = 'PROCESSING'
                db.commit()

            with SessionLocal() as db:
                targets = db.query(FacebookPostTarget).filter(
                    FacebookPostTarget.post_id == post_id,
                    FacebookPostTarget.status.in_(['PENDING', 'FAILED'])
                ).all()
                target_ids = [t.id for t in targets]

            for index, target_id in enumerate(target_ids):
                # Check cancellation
                if self._is_cancelled:
                    log_warning('QUEUE', f'Queue cancelled at target {index + 1}/{len(target_ids)}')
                    break

                # Wait if paused
                await self._pause_event.wait()

                # Check max posts per run
                if not self.rate_limiter.can_post_more():
                    self.status_message = f"Đã đạt giới hạn an toàn tối đa {self.rate_limiter.max_posts} bài trong một phiên chạy."
                    log_warning('QUEUE', self.status_message)
                    break

                with SessionLocal() as db:
                    target = db.query(FacebookPostTarget).filter(FacebookPostTarget.id == target_id).first()
                    if not target:
                        continue
                    target.status = 'RUNNING'
                    db.commit()
                    target_url = target.target_url
                    target_type = target.target_type

                with SessionLocal() as db:
                    post = db.query(FacebookPost).filter(FacebookPost.id == post_id).first()
                    post_content = post.content
                    post_image = post.image_path

                self.status_message = f"Đang đăng tới [{target_type.upper()}]: {target_url} ({index + 1}/{len(target_ids)})"
                log_info('QUEUE', self.status_message)

                try:
                    success, pub_url, error = await post_to_facebook_target(
                        target_type=target_type,
                        target_url=target_url,
                        content=post_content,
                        image_path=post_image
                    )

                    with SessionLocal() as db:
                        t = db.query(FacebookPostTarget).filter(FacebookPostTarget.id == target_id).first()
                        if success:
                            t.status = 'SUCCESS'
                            t.published_url = pub_url
                            t.published_at = datetime.utcnow()
                            t.error_message = None
                            self.completed_targets += 1
                            self.rate_limiter.increment_post()
                            log_success('QUEUE', f'Target {target_url} posted successfully!')
                        else:
                            t.status = 'FAILED'
                            t.error_message = error
                            self.failed_targets += 1
                            log_warning('QUEUE', f'Target {target_url} failed: {error}')
                        db.commit()

                except FacebookCheckpointDetected as cp:
                    self.status = 'ACTION_REQUIRED'
                    self.status_message = "Facebook yêu cầu xác minh bảo mật (Checkpoint/CAPTCHA)! Vui lòng hoàn tất trong trình duyệt."
                    log_error('QUEUE', self.status_message)
                    with SessionLocal() as db:
                        t = db.query(FacebookPostTarget).filter(FacebookPostTarget.id == target_id).first()
                        if t:
                            t.status = 'ACTION_REQUIRED'
                            t.error_message = cp.message
                            db.commit()
                    self._pause_event.clear()
                    return

                except Exception as ex:
                    log_error('QUEUE', f'Unexpected error on target {target_url}: {ex}')
                    with SessionLocal() as db:
                        t = db.query(FacebookPostTarget).filter(FacebookPostTarget.id == target_id).first()
                        if t:
                            t.status = 'FAILED'
                            t.error_message = str(ex)
                            db.commit()
                    self.failed_targets += 1

                # If more targets remain, wait rate limit interval
                if index < len(target_ids) - 1 and not self._is_cancelled:
                    async def update_countdown(remaining: int):
                        self.countdown_remaining = remaining
                        self.status_message = f"Nghỉ giãn cách an toàn ({remaining}s còn lại)..."

                    await self.rate_limiter.wait_post_interval(update_countdown)
                    self.countdown_remaining = 0

            # Wrap up
            with SessionLocal() as db:
                post = db.query(FacebookPost).filter(FacebookPost.id == post_id).first()
                if post:
                    if self.failed_targets == 0 and self.completed_targets > 0:
                        post.status = 'COMPLETED'
                    elif self.completed_targets > 0 and self.failed_targets > 0:
                        post.status = 'PARTIALLY_FAILED'
                    elif self.failed_targets > 0:
                        post.status = 'FAILED'
                    else:
                        post.status = 'DRAFT'
                    db.commit()

            if self.status not in ['ACTION_REQUIRED', 'CANCELLED']:
                self.status = 'IDLE'
                self.status_message = f"Hoàn thành queue: {self.completed_targets} thành công, {self.failed_targets} thất bại."
                log_success('QUEUE', self.status_message)

        except Exception as e:
            self.status = 'FAILED'
            self.status_message = f"Hàng đợi gặp lỗi ngoại lệ: {e}"
            log_error('QUEUE', self.status_message)

queue_service = AutomationQueueService()
