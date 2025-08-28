"""
@fileoverview Configuration management for PromptWizard service
@lastmodified 2025-08-26T12:25:00Z

Features: Environment-based configuration with validation
Main APIs: Settings class with pydantic validation
Constraints: Environment variables for production deployment
Patterns: Pydantic settings management, environment configuration
"""

from typing import List, Optional
from pydantic import BaseSettings, validator
import os


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application settings
    APP_NAME: str = "PromptWizard Integration Service"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    # PromptWizard settings
    PROMPTWIZARD_API_KEY: Optional[str] = None
    PROMPTWIZARD_MODEL: str = "gpt-4"
    PROMPTWIZARD_MAX_ITERATIONS: int = 10
    PROMPTWIZARD_TIMEOUT: int = 300  # 5 minutes
    
    # Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Redis/Cache settings
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL: int = 86400  # 24 hours
    CACHE_MAX_SIZE: int = 1000
    
    # Rate limiting
    RATE_LIMIT_MAX_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 3600  # 1 hour
    
    # Job queue settings
    JOB_QUEUE_URL: str = "redis://localhost:6379/1"
    JOB_TIMEOUT: int = 1800  # 30 minutes
    MAX_CONCURRENT_JOBS: int = 10
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # Database (optional)
    DATABASE_URL: Optional[str] = None
    
    @validator('ALLOWED_ORIGINS', pre=True)
    def assemble_cors_origins(cls, v):
        """Parse CORS origins from environment variable."""
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    @validator('SECRET_KEY')
    def validate_secret_key(cls, v):
        """Ensure secret key is set in production."""
        if not cls.DEBUG and v == "your-secret-key-change-in-production":
            raise ValueError("SECRET_KEY must be set in production")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings."""
    return settings