"""
@fileoverview Rate limiting middleware for PromptWizard service
@lastmodified 2025-08-26T12:40:00Z

Features: Redis-based rate limiting with sliding window
Main APIs: RateLimiterMiddleware class
Constraints: Requires Redis for distributed rate limiting
Patterns: Sliding window rate limiting, middleware pattern
"""

import time
from typing import Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import redis.asyncio as redis
import structlog

from ..config import settings

logger = structlog.get_logger(__name__)


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis sliding window."""
    
    def __init__(self, app):
        super().__init__(app)
        self.redis_client: Optional[redis.Redis] = None
        self.max_requests = settings.RATE_LIMIT_MAX_REQUESTS
        self.window_seconds = settings.RATE_LIMIT_WINDOW_SECONDS
    
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to requests."""
        
        # Skip rate limiting for health checks
        if request.url.path == "/api/v1/health":
            return await call_next(request)
        
        # Skip in debug mode
        if settings.DEBUG:
            return await call_next(request)
        
        try:
            # Initialize Redis client if needed
            if not self.redis_client:
                self.redis_client = redis.from_url(settings.REDIS_URL)
            
            # Get client identifier
            client_id = await self._get_client_id(request)
            
            # Check rate limit
            allowed, remaining, reset_time = await self._check_rate_limit(client_id)
            
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": "Too many requests",
                            "retry_after": reset_time
                        }
                    },
                    headers={
                        "X-RateLimit-Limit": str(self.max_requests),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(reset_time)),
                        "Retry-After": str(int(reset_time - time.time()))
                    }
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.max_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(int(reset_time))
            
            return response
            
        except Exception as e:
            logger.error("Rate limiting error", exc_info=e)
            # Continue without rate limiting on error
            return await call_next(request)
    
    async def _get_client_id(self, request: Request) -> str:
        """Get unique identifier for client."""
        
        # Use authenticated user ID if available
        if hasattr(request.state, "user") and request.state.user:
            user_id = request.state.user.get("sub")
            if user_id:
                return f"user:{user_id}"
        
        # Use API key if available
        api_key = request.headers.get("x-api-key")
        if api_key:
            return f"api_key:{api_key[:8]}..."
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"
    
    async def _check_rate_limit(self, client_id: str) -> tuple[bool, int, float]:
        """
        Check rate limit using sliding window algorithm.
        
        Returns:
            (allowed, remaining_requests, reset_timestamp)
        """
        
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        # Redis key for this client
        key = f"rate_limit:{client_id}"
        
        try:
            # Use Redis pipeline for atomic operations
            pipe = self.redis_client.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiration
            pipe.expire(key, self.window_seconds)
            
            results = await pipe.execute()
            current_requests = results[1]  # Count after removing old entries
            
            # Check if limit exceeded
            if current_requests >= self.max_requests:
                # Get oldest request time to calculate reset
                oldest_requests = await self.redis_client.zrange(key, 0, 0, withscores=True)
                if oldest_requests:
                    oldest_time = oldest_requests[0][1]
                    reset_time = oldest_time + self.window_seconds
                else:
                    reset_time = current_time + self.window_seconds
                
                return False, 0, reset_time
            
            remaining = self.max_requests - current_requests - 1  # -1 for current request
            reset_time = current_time + self.window_seconds
            
            return True, remaining, reset_time
            
        except Exception as e:
            logger.error("Redis rate limiting error", client_id=client_id, exc_info=e)
            # Allow request on Redis errors
            return True, self.max_requests, current_time + self.window_seconds
    
    async def cleanup(self):
        """Cleanup Redis connection."""
        if self.redis_client:
            await self.redis_client.close()