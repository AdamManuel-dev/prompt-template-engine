"""
@fileoverview Authentication middleware for PromptWizard service
@lastmodified 2025-08-26T12:35:00Z

Features: JWT token validation and API key authentication
Main APIs: AuthMiddleware class with token verification
Constraints: Supports both JWT and API key authentication
Patterns: FastAPI middleware, dependency injection
"""

from typing import Dict, Any, Optional
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import jwt
import structlog

from ..config import settings

logger = structlog.get_logger(__name__)
security = HTTPBearer(auto_error=False)


class AuthMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for API requests."""
    
    # Public endpoints that don't require authentication
    PUBLIC_PATHS = {
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/health",
    }
    
    async def dispatch(self, request: Request, call_next):
        """Process authentication for incoming requests."""
        
        # Skip auth for public paths
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)
        
        # Skip auth in debug mode
        if settings.DEBUG:
            request.state.user = {"sub": "debug-user", "scopes": ["admin"]}
            return await call_next(request)
        
        try:
            # Extract and validate token
            auth_result = await self._validate_request_auth(request)
            if not auth_result:
                return Response(
                    content='{"error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}',
                    status_code=401,
                    media_type="application/json"
                )
            
            # Store user info in request state
            request.state.user = auth_result
            
            return await call_next(request)
            
        except Exception as e:
            logger.error("Authentication error", exc_info=e)
            return Response(
                content='{"error": {"code": "AUTH_ERROR", "message": "Authentication failed"}}',
                status_code=401,
                media_type="application/json"
            )
    
    async def _validate_request_auth(self, request: Request) -> Optional[Dict[str, Any]]:
        """Validate authentication from request headers."""
        
        # Try Bearer token first
        authorization = request.headers.get("authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:]  # Remove "Bearer " prefix
            
            # Try JWT token
            try:
                payload = jwt.decode(
                    token,
                    settings.SECRET_KEY,
                    algorithms=["HS256"]
                )
                return payload
            except jwt.PyJWTError:
                pass
            
            # Try API key
            return await self._validate_api_key(token)
        
        # Try API key from headers
        api_key = request.headers.get("x-api-key")
        if api_key:
            return await self._validate_api_key(api_key)
        
        return None
    
    async def _validate_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Validate API key authentication."""
        
        # In a real implementation, this would check against a database
        # For now, we'll use a simple environment variable check
        if api_key == settings.PROMPTWIZARD_API_KEY:
            return {
                "sub": "api-key-user",
                "scopes": ["optimize", "score", "compare"],
                "auth_type": "api_key"
            }
        
        return None
    
    @staticmethod
    async def verify_token(request: Request) -> Dict[str, Any]:
        """Dependency function to verify authentication."""
        if hasattr(request.state, "user"):
            return request.state.user
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    @staticmethod
    def create_access_token(data: Dict[str, Any]) -> str:
        """Create a JWT access token."""
        return jwt.encode(data, settings.SECRET_KEY, algorithm="HS256")
    
    @staticmethod
    def verify_token_string(token: str) -> Dict[str, Any]:
        """Verify a JWT token string."""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"]
            )
            return payload
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )