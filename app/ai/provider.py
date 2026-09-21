from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseAIProvider(ABC):
    @abstractmethod
    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        """Generates text from prompt using LLM provider"""
        pass
