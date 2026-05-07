"""
PETTIES AGENT SERVICE - Subscription Guard
Enforces active membership for AI features.

Package: app.api.middleware
Purpose: Dependency injection for subscription verification
Version: v0.0.1
"""

from fastapi import Request, HTTPException, Depends
from sqlalchemy import text
from app.api.middleware.auth import CurrentUser, get_current_user
from app.db.postgres.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import logging

from app.services.backend_client import BackendClientError, get_backend_client

logger = logging.getLogger(__name__)


def _extract_bearer_token(request: Request | None) -> str | None:
    if not request:
        return None
    auth_header = request.headers.get("Authorization", "").strip()
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:].strip()
    return token or None


async def verify_subscription_logic(user: CurrentUser, db: AsyncSession, request: Request | None = None):
    """
    Core logic to verify subscription without FastAPI dependency overhead.
    """
    # 0. DEV ENVIRONMENT: Skip ALL subscription checks
    import os

    env = os.getenv("ENVIRONMENT", "").lower()
    if env in ("dev", "development", ""):
        logger.info(
            f"DEV mode: Skipping subscription check for user {user.user_id} ({user.role})"
        )
        return True

    # 1. DEV BYPASS: Allow all staff in development (temporary for testing)
    if user.role in ("STAFF", "VET"):
        logger.info(
            f"Staff/Vet {user.user_id} allowed without subscription (dev bypass)"
        )
        return True

    # 2. Bypass check for admins (Playground/Testing)
    if user.is_admin:
        return True

    # 3. Allow PET_OWNER without subscription requirement
    if user.role == "PET_OWNER":
        logger.info(f"Pet owner {user.user_id} allowed without subscription check")
        return True

    # 4. Ensure clinic context exists for staff/owner roles.
    # If the token/context is missing clinic_id, try to recover it from backend profile.
    resolved_clinic_id = user.clinic_id
    if not resolved_clinic_id and request:
        token = _extract_bearer_token(request)
        if token:
            try:
                profile = await get_backend_client().get_current_user_profile(token)
                resolved_clinic_id = (
                    profile.get("workingClinicId")
                    or profile.get("working_clinic_id")
                    or profile.get("clinicId")
                    or profile.get("clinic_id")
                )
                if resolved_clinic_id:
                    logger.info(
                        f"Resolved missing clinic_id for user {user.user_id} ({user.role}) from backend profile: {resolved_clinic_id}"
                    )
            except BackendClientError as e:
                logger.warning(
                    f"Could not resolve clinic profile for user {user.user_id} ({user.role}): {e}"
                )

    if not resolved_clinic_id:
        logger.warning(
            f"User {user.user_id} ({user.role}) attempted to use AI without clinic_id"
        )
        raise HTTPException(
            status_code=403,
            detail=(
                "Chưa xác định được phòng khám đang làm việc. "
                "Vui lòng chọn đúng phòng khám hoặc đồng bộ lại hồ sơ tài khoản."
            ),
        )

    # 4. Query PostgreSQL for active subscription
    query = text("""
        SELECT status, end_date 
        FROM user_subscriptions 
        WHERE clinic_id = :clinic_id 
        AND status IN ('ACTIVE', 'CANCELLED')
        ORDER BY created_at DESC 
        LIMIT 1
    """)

    try:
        result = await db.execute(query, {"clinic_id": resolved_clinic_id})
        subscription = result.fetchone()

        if not subscription:
            logger.info(
                f"Clinic {resolved_clinic_id} blocked: No active subscription record found"
            )
            raise HTTPException(
                status_code=402,
                detail=(
                    "Phòng khám chưa có gói hội viên đang hoạt động. "
                    "Vui lòng kiểm tra mục gói dịch vụ trong dashboard."
                ),
            )

        status, end_date = subscription

        # 5. Expiration Check
        if end_date:
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)

            if end_date < datetime.now(timezone.utc):
                logger.info(
                    f"Clinic {resolved_clinic_id} blocked: Subscription expired on {end_date}"
                )
                raise HTTPException(
                    status_code=402,
                    detail=(
                        "Gói hội viên của phòng khám đã hết hạn. "
                        "Vui lòng gia hạn để tiếp tục sử dụng AI."
                    ),
                )

        return True

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Subscription verification error for clinic {user.clinic_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail="Không thể xác thực trạng thái hội viên. Vui lòng thử lại sau.",
        )


async def check_active_subscription(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    FastAPI Dependency wrapper for verify_subscription_logic.
    """
    return await verify_subscription_logic(user, db, request=request)
