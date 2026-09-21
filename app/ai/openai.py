import asyncio
from app.ai.provider import BaseAIProvider
from app.config import settings
from app.utils.logger import log_info, log_error

class OpenAIProvider(BaseAIProvider):
    def __init__(self, api_key: str = None, is_openrouter: bool = False):
        self.is_openrouter = is_openrouter
        if is_openrouter:
            self.api_key = api_key or settings.OPENROUTER_API_KEY
            self.base_url = "https://openrouter.ai/api/v1"
            self.model = "anthropic/claude-3.5-sonnet"
        else:
            self.api_key = api_key or settings.OPENAI_API_KEY
            self.base_url = None
            self.model = "gpt-4o"

    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key:
            provider_name = "OPENROUTER_API_KEY" if self.is_openrouter else "OPENAI_API_KEY"
            raise ValueError(f"{provider_name} is not configured in .env")

        from openai import OpenAI
        client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        def call_chat():
            resp = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7
            )
            return resp.choices[0].message.content

        return await asyncio.to_thread(call_chat)
