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
# _runtime_secret_key = None (Deprecated)

# Security scheme for Swagger docs
security = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Current authenticated user"""

    user_id: str
    username: Optional[str] = None
    role: str = "USER"
    clinic_id: Optional[str] = None
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
    clinic_id = request.headers.get("X-User-Clinic-Id") or request.headers.get(
        "X-Clinic-Id"
    )

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
        user_id=user_id, role=role, clinic_id=clinic_id, is_admin=is_admin
    )


# ===== JWT FALLBACK (Development) =====


async def decode_jwt_token(token: str) -> Optional[CurrentUser]:
    """
    Decode JWT token directly (for development without Gateway)

    1. Tries to get JWT_SECRET from DB
    2. Falls back to JWT_SECRET from settings (.env)
    """
    # Use secret key from environment variables (settings.py)
    # This is more stable and prevents DB connection issues in middleware
    import os

    secret = settings.SECRET_KEY
    env = os.getenv("ENVIRONMENT", "").lower()

    try:
        # Decode token
        payload = jwt.decode(token, secret, algorithms=["HS256", "HS384", "HS512"])

        user_id = payload.get("sub", "")
        # Main backend uses "userId" claim for UUID, "sub" for username
        real_user_id = payload.get("userId", user_id)
        username = user_id if "userId" in payload else None

        # Role handling: Support "role" (string) or "roles" (list)
        role_raw = payload.get("role") or payload.get("roles") or "USER"
        if isinstance(role_raw, list):
            role_raw = role_raw[0] if role_raw else "USER"

        # Normalize role: Remove "ROLE_" prefix common in Spring Security
        role = str(role_raw).replace("ROLE_", "").upper()

        clinic_id = (
            payload.get("workingClinicId")
            or payload.get("working_clinic_id")
            or payload.get("clinicId")
            or payload.get("clinic_id")
        )

        # DEV FALLBACK: If no clinic_id in token, try to fetch from backend using userId
        if not clinic_id and env in ("dev", "development", ""):
            import requests

            try:
                # Use a simple endpoint to get user info from backend
                user_response = requests.get(
                    f"http://backend:8080/api/v1/users/{real_user_id}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5,
                )
                if user_response.status_code == 200:
                    user_data = user_response.json()
                    clinic_id = user_data.get("workingClinicId")
                    logger.info(
                        f"[JWT] Fetched clinic_id={clinic_id} from backend for user {real_user_id}"
                    )
            except Exception as e:
                logger.warning(f"[JWT] Could not fetch clinic_id from backend: {e}")

        # Handle role as string or list
        if isinstance(role, list):
            role = role[0] if role else "USER"

        # Already normalized above
        final_role = str(role).upper()

        return CurrentUser(
            user_id=str(real_user_id),
            username=username,
            role=final_role,
            clinic_id=str(clinic_id) if clinic_id else None,
            is_admin=final_role == "ADMIN",
        )
    except JWTError as e:
        # If signature failed, maybe the secret key in DB changed?
        # Clear cache for next attempt
        error_str = str(e)
        logger.warning(f"JWT decode failed ({type(e).__name__}): {error_str}")
        return None


# ===== MAIN AUTH DEPENDENCIES =====


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
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
        return user

    # Fallback to JWT (development)
    if credentials:
        user = await decode_jwt_token(credentials.credentials)
        if user:
            return user

    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
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
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_admin_user(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Admin-only auth - raises 403 if not admin
    """
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
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
