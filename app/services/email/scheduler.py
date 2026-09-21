import asyncio
import logging
from typing import Optional
from app.services.email.worker import EmailWorker

logger = logging.getLogger("email_scheduler")

class EmailScheduler:
    _instance: Optional['EmailScheduler'] = None
    _task: Optional[asyncio.Task] = None
    _running: bool = False
    _poll_interval: int = 10 # seconds

    def __init__(self, poll_interval: int = 10):
        self._poll_interval = poll_interval
        self._worker = EmailWorker()

    @classmethod
    def get_instance(cls) -> 'EmailScheduler':
        if cls._instance is None:
            cls._instance = EmailScheduler()
        return cls._instance

    async def _loop(self):
        logger.info("Email Campaign background scheduler started.")
        while self._running:
            try:
                # Run small batch
                await self._worker.run_batch(max_batch_size=10)
            except Exception as e:
                logger.error(f"Error in email scheduler loop: {e}", exc_info=True)
            
            # Wait for next poll interval
            try:
                await asyncio.sleep(self._poll_interval)
            except asyncio.CancelledError:
                break
        logger.info("Email Campaign background scheduler stopped.")

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()

    @property
    def is_running(self) -> bool:
        return self._running
