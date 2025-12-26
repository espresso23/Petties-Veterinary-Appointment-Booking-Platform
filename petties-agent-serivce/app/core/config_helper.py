"""
PETTIES AGENT SERVICE - Config Helper
Helps fetch settings from Database with fallback to Environment variables.
"""

import os
import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres.models import SystemSetting

logger = logging.getLogger(__name__)

async def get_setting(key: str, db: Optional[AsyncSession] = None, default: Optional[str] = None) -> Optional[str]:
    """
    Get setting value by key.
    Checks database first, falls back to environment variable, then to default value.
    
    Args:
        key: The setting key (e.g. 'OPENROUTER_API_KEY')
        db: Optional database session
        default: Default value if not found
    """
    # 1. Check Database if session provided
    if db:
        try:
            result = await db.execute(
                select(SystemSetting).where(SystemSetting.key == key)
            )
            setting = result.scalar_one_or_none()
            if setting and setting.value:
                return setting.value
        except Exception as e:
            logger.warning(f"Error fetching setting {key} from DB: {e}")

    # 2. Check Environment Variable
    env_val = os.getenv(key)
    
    # Fallback to common aliases
    if not env_val:
        if key == "JWT_SECRET":
            env_val = os.getenv("SECRET_KEY")
            if env_val:
                logger.debug(f"Found alias SECRET_KEY for {key}")
        elif key == "DATABASE_URL" and not env_val:
            env_val = os.getenv("POSTGRES_URL")
    
    if env_val:
        return env_val
        
    # 3. Fallback to default
    return default
