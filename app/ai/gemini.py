import os
import json
import asyncio
from app.ai.provider import BaseAIProvider
from app.config import settings
from app.utils.logger import log_info, log_error, log_warning

class GeminiProvider(BaseAIProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                log_warning('AI', f'google-genai init warning: {e}')

    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in .env")

        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        # Try google-genai SDK
        if self.client:
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model='gemini-2.5-flash',
                    contents=full_prompt
                )
                return response.text
            except Exception as sdk_err:
                log_warning('AI', f'Gemini SDK call failed ({sdk_err}), trying fallback model gemini-1.5-flash...')
                try:
                    response = await asyncio.to_thread(
                        self.client.models.generate_content,
                        model='gemini-1.5-flash',
                        contents=full_prompt
                    )
                    return response.text
                except Exception as fallback_err:
                    log_error('AI', f'Gemini fallback failed: {fallback_err}')

        # Direct HTTP fallback
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}]
        }
        res = await asyncio.to_thread(requests.post, url, json=payload, timeout=30)
        res.raise_for_status()
        data = res.json()
        candidates = data.get('candidates', [])
        if candidates and 'content' in candidates[0]:
            parts = candidates[0]['content'].get('parts', [])
            if parts:
                return parts[0].get('text', '')
        return ""
