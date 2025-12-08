"""
PETTIES AGENT SERVICE - Dynamic Configuration Loader
Module thay thế python-dotenv. Truy vấn bảng system_configs và agents 
trong Postgres để lấy API Keys và settings, sau đó inject vào Runtime Context.

Theo Technical Scope:
- Load API Keys từ system_settings (encrypted)
- Load Agent configs từ agents table
- Inject vào Runtime Context của Agent
"""

from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.db.postgres.models import Agent as AgentModel, SystemSetting


class DynamicConfigLoader:
    """
    Dynamic Configuration Loader
    
    Load configuration từ Database thay vì .env files.
    Theo Technical Scope: Module thay thế python-dotenv.
    """
    
    @staticmethod
    async def load_agent_config(
        session: AsyncSession,
        agent_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Load agent configuration từ Database
        
        Args:
            session: Database session
            agent_name: Tên agent (main_agent, booking_agent, etc.)
        
        Returns:
            Dict với config hoặc None nếu không tìm thấy
        """
        try:
            result = await session.execute(
                select(AgentModel).where(AgentModel.name == agent_name)
            )
            agent = result.scalar_one_or_none()
            
            if not agent:
                logger.warning(f"Agent '{agent_name}' not found in database")
                return None
            
            if not agent.enabled:
                logger.warning(f"Agent '{agent_name}' is disabled")
                return None
            
            config = {
                "id": agent.id,
                "name": agent.name,
                "agent_type": agent.agent_type.value,
                "system_prompt": agent.system_prompt or "",
                "temperature": agent.temperature,
                "max_tokens": agent.max_tokens,
                "model": agent.model,
                "description": agent.description or "",
            }
            
            logger.debug(f"✅ Loaded config for {agent_name} from DB")
            return config
            
        except Exception as e:
            logger.error(f"Failed to load agent config for {agent_name}: {e}")
            return None
    
    @staticmethod
    async def load_system_settings(
        session: AsyncSession
    ) -> Dict[str, str]:
        """
        Load system settings từ system_settings table
        
        Returns:
            Dict với key-value settings (API keys, URLs, etc.)
            
        Note: Values are stored as-is in DB (encryption handling ở API layer)
        """
        try:
            result = await session.execute(select(SystemSetting))
            settings = result.scalars().all()
            
            config = {}
            for setting in settings:
                config[setting.key] = setting.value
            
            logger.debug(f"✅ Loaded {len(config)} system settings from DB")
            return config
            
        except Exception as e:
            logger.warning(f"Failed to load system settings: {e}")
            return {}
    
    @staticmethod
    async def get_setting(
        session: AsyncSession,
        key: str,
        default: str = ""
    ) -> str:
        """
        Get single setting value from DB
        
        Args:
            session: Database session
            key: Setting key
            default: Default value nếu không tìm thấy
        
        Returns:
            Setting value hoặc default
        """
        try:
            result = await session.execute(
                select(SystemSetting).where(SystemSetting.key == key)
            )
            setting = result.scalar_one_or_none()
            return setting.value if setting else default
        except Exception as e:
            logger.warning(f"Failed to load setting {key}: {e}")
            return default

