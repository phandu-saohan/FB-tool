from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os

class Settings(BaseSettings):
    DATABASE_URL: str = Field(default='sqlite:///./data/facebook_automation.db')
    FALLBACK_TO_SQLITE: bool = Field(default=True)
    
    # AI Providers
    AI_PROVIDER: str = Field(default='gemini') # gemini | openai | openrouter
    GEMINI_API_KEY: Optional[str] = Field(default=None)
    OPENAI_API_KEY: Optional[str] = Field(default=None)
    OPENROUTER_API_KEY: Optional[str] = Field(default=None)
    
    # Browser
    FACEBOOK_PROFILE_PATH: str = Field(default='./profiles/facebook')
    BROWSER_HEADLESS: bool = Field(default=False)
    CHROME_EXECUTABLE_PATH: Optional[str] = Field(default=None)
    
    # Posting Rate limits
    POST_DELAY_MIN: int = Field(default=60)
    POST_DELAY_MAX: int = Field(default=180)
    MAX_POSTS_PER_RUN: int = Field(default=10)
    
    # Server
    HOST: str = Field(default='127.0.0.1')
    PORT: int = Field(default=8000)

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        extra = 'ignore'

settings = Settings()
