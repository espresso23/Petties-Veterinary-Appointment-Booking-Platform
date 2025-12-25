"""
PETTIES AGENT SERVICE - Authentication Middleware
Reads user info from API Gateway headers (Production)
Falls back to JWT validation for development

Package: app.api.middleware
Purpose: Auth middleware supporting Gateway + Dev modes
Version: v0.0.2
"""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional
from pydantic import BaseModel
import logging

from app.config.settings import settings
from app.core.config_helper import get_setting
from app.db.postgres.session import get_db, AsyncSessionLocal

logger = logging.getLogger(__name__)

# Cache for secret key to avoid DB hits on every request
_runtime_secret_key = None

# Security scheme for Swagger docs
security = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Current authenticated user"""
    user_id: str
    username: Optional[str] = None
    role: str = "USER"
    is_admin: bool = False


class TokenPayload(BaseModel):
    """JWT Token payload structure"""
    sub: str  # Subject (user_id)
    role: Optional[str] = None
    exp: Optional[int] = None


# ===== GATEWAY HEADERS (Production) =====

def get_user_from_gateway_headers(request: Request) -> Optional[CurrentUser]:
    """
    Read user info from Gateway-forwarded headers
    
    Gateway adds these headers after JWT validation:
    - X-User-Id: user ID from JWT subject
    - X-User-Roles: user roles from JWT claims
    """
    user_id = request.headers.get("X-User-Id")
    roles = request.headers.get("X-User-Roles", "")
    
    if not user_id:
        return None
    
    # Determine role from roles string (comma-separated or single)
    role = "USER"
    is_admin = False
    
    if roles:
        role_list = [r.strip().upper() for r in roles.split(",")]
        if "ADMIN" in role_list:
            role = "ADMIN"
            is_admin = True
        elif role_list:
            role = role_list[0]
    
    return CurrentUser(
        user_id=user_id,
        role=role,
        is_admin=is_admin
    )


# ===== JWT FALLBACK (Development) =====

async def decode_jwt_token(token: str) -> Optional[CurrentUser]:
    """
    Decode JWT token directly (for development without Gateway)
    
    1. Tries to get SECRET_KEY from DB
    2. Falls back to SECRET_KEY from settings (.env)
    """
    global _runtime_secret_key
    
    # Try to load secret key from DB if not cached
    if _runtime_secret_key is None:
        try:
            async with AsyncSessionLocal() as db:
                db_key = await get_setting("SECRET_KEY", db)
                if db_key:
                    _runtime_secret_key = db_key
                    logger.info("🔑 Loaded SECRET_KEY from database")
        except Exception:
            pass
            
    # Use cached or settings default
    secret = _runtime_secret_key or settings.SECRET_KEY
    key_source = "Database" if _runtime_secret_key else "Environment/Settings"
    
    # Mask secret for log
    masked_secret = f"{secret[:4]}...{secret[-4:]}" if secret and len(secret) > 8 else "****"
    logger.debug(f"Attempting JWT decode with {key_source} key: {masked_secret}")
    
    try:
        # Decode token
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256", "HS384", "HS512"]
        )
        
        user_id = payload.get("sub", "")
        # Main backend uses "userId" claim for UUID, "sub" for username
        real_user_id = payload.get("userId", user_id)
        username = user_id if "userId" in payload else None
        
        role = payload.get("role", payload.get("roles", "USER"))
        
        # Handle role as string or list
        if isinstance(role, list):
            role = role[0] if role else "USER"
        
        logger.debug(f"JWT decoded successfully. user_id={real_user_id}, role={role}")
        
        return CurrentUser(
            user_id=str(real_user_id),
            username=username,
            role=role.upper() if role else "USER",
            is_admin=role.upper() == "ADMIN" if role else False
        )
    except JWTError as e:
        # If signature failed, maybe the secret key in DB changed? 
        # Clear cache for next attempt
        error_str = str(e)
        if "Signature verification failed" in error_str:
            _runtime_secret_key = None
            logger.warning(f"JWT Signature verification failed using {key_source} key. Resetting runtime cache.")
        else:
            logger.warning(f"JWT decode failed ({type(e).__name__}): {error_str}")
        return None


# ===== MAIN AUTH DEPENDENCIES =====

async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[CurrentUser]:
    """
    Optional auth - returns user if authenticated, None if not
    
    Priority:
    1. Gateway headers (X-User-Id)
    2. JWT token (development fallback)
    3. None (anonymous)
    """
    # Try Gateway headers first (production)
    user = get_user_from_gateway_headers(request)
    if user:
        logger.debug(f"Auth via Gateway: user_id={user.user_id}")
        return user
    
    # Fallback to JWT (development)
    if credentials:
        user = await decode_jwt_token(credentials.credentials)
        if user:
            logger.debug(f"Auth via JWT: user_id={user.user_id}")
            return user
    
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """
    Required auth - raises 401 if not authenticated
    
    Use for protected endpoints
    """
    user = await get_current_user_optional(request, credentials)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return user


async def get_admin_user(
    user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    """
    Admin-only auth - raises 403 if not admin
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return user


# ===== HELPER FUNCTIONS =====

def create_access_token(data: dict) -> str:
    """
    Create JWT access token (for testing)
    """
    from datetime import datetime, timedelta
    
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
