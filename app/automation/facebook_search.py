from typing import List, Dict, Any
from app.automation.facebook_group import search_facebook_groups
from app.automation.facebook_page import search_facebook_pages

class FacebookSearchEngine:
    @staticmethod
    async def search_groups(keyword: str, max_results: int = 50) -> List[Dict[str, Any]]:
        return await search_facebook_groups(keyword=keyword, max_results=max_results)

    @staticmethod
    async def search_pages(keyword: str, max_results: int = 50) -> List[Dict[str, Any]]:
        return await search_facebook_pages(keyword=keyword, max_results=max_results)

facebook_search = FacebookSearchEngine()
