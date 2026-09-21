import asyncio
import random
from app.config import settings
from app.utils.logger import log_info

class SafeRateLimiter:
    def __init__(self, min_delay: int = None, max_delay: int = None, max_posts_per_run: int = None):
        self.min_delay = min_delay if min_delay is not None else settings.POST_DELAY_MIN
        self.max_delay = max_delay if max_delay is not None else settings.POST_DELAY_MAX
        self.max_posts = max_posts_per_run if max_posts_per_run is not None else settings.MAX_POSTS_PER_RUN
        self.current_post_count = 0

    def reset_counter(self):
        self.current_post_count = 0

    def can_post_more(self) -> bool:
        return self.current_post_count < self.max_posts

    def increment_post(self):
        self.current_post_count += 1

    async def wait_post_interval(self, progress_callback=None):
        delay = random.uniform(self.min_delay, self.max_delay)
        delay_seconds = int(delay)
        log_info('RATE_LIMIT', f'Waiting {delay_seconds}s before next post to comply with rate limits...')
        for remaining in range(delay_seconds, 0, -1):
            if progress_callback:
                await progress_callback(remaining)
            await asyncio.sleep(1)

    @staticmethod
    async def human_delay(min_s: float = 1.0, max_s: float = 3.0):
        await asyncio.sleep(random.uniform(min_s, max_s))

    @staticmethod
    async def typing_delay(min_s: float = 0.03, max_s: float = 0.12):
        await asyncio.sleep(random.uniform(min_s, max_s))
