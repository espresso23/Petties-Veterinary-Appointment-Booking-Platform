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

logger = logging.getLogger(__name__)

async def verify_subscription_logic(user: CurrentUser, db: AsyncSession):
    """
    Core logic to verify subscription without FastAPI dependency overhead.
    """
    # 1. Bypass check for admins (Playground/Testing)
    if user.is_admin:
        return True

    # 2. Ensure clinic context exists
    if not user.clinic_id:
        logger.warning(f"User {user.user_id} ({user.role}) attempted to use AI without clinic_id")
        raise HTTPException(
            status_code=403, 
            detail="Tính năng này yêu cầu quyền truy cập phòng khám."
        )

    # 3. Query PostgreSQL for active subscription
    query = text("""
        SELECT status, end_date 
        FROM user_subscriptions 
        WHERE clinic_id = :clinic_id 
        AND status IN ('ACTIVE', 'CANCELLED')
        ORDER BY created_at DESC 
        LIMIT 1
    """)
    
    try:
        result = await db.execute(query, {"clinic_id": user.clinic_id})
        subscription = result.fetchone()
        
        if not subscription:
            logger.info(f"Clinic {user.clinic_id} blocked: No active subscription record found")
            raise HTTPException(
                status_code=402, 
                detail="Yêu cầu đăng ký gói hội viên để sử dụng tính năng AI."
            )
            
        status, end_date = subscription
        
        # 4. Expiration Check
        if end_date:
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            
            if end_date < datetime.now(timezone.utc):
                logger.info(f"Clinic {user.clinic_id} blocked: Subscription expired on {end_date}")
                raise HTTPException(
                    status_code=402, 
                    detail="Gói hội viên của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng."
                )
            
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription verification error for clinic {user.clinic_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Không thể xác thực trạng thái hội viên. Vui lòng thử lại sau."
        )

async def check_active_subscription(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    FastAPI Dependency wrapper for verify_subscription_logic.
    """
    return await verify_subscription_logic(user, db)
