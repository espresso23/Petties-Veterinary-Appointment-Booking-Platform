"""
PETTIES AGENT SERVICE - Agent Config Loader

Load agent configuration from database with caching.
Supports both agent_config table and system_settings table.

Package: app.core
Version: v1.0.0
"""

from typing import Optional, Dict, Any
from dataclasses import dataclass
import asyncio
import time
from loguru import logger

from app.db.postgres.session import AsyncSessionLocal
from app.db.postgres.models import Agent


@dataclass
class AgentConfig:
    """Agent configuration from database"""

    name: str
    temperature: float
    max_tokens: int
    top_p: float
    model: str
    system_prompt: Optional[str]
    enabled: bool


class AgentConfigLoader:
    """
    Load agent_config from database with in-memory caching.

    Flow:
    1. Check cache (TTL 5 minutes)
    2. If cache miss, load from agent_config table
    3. Return config with fallback to defaults
    """

    _cache: Optional[AgentConfig] = None
    _cache_time: float = 0
    _cache_ttl: float = 300  # 5 minutes
    _lock = asyncio.Lock()

    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 2000
    DEFAULT_TOP_P = 0.9
    DEFAULT_MODEL = "google/gemini-2.5-flash-lite"
    DEFAULT_SYSTEM_PROMPT = """Bạn là Petties AI Assistant - trợ lý AI chuyên về chăm sóc thú cưng.

## VAI TRÒ & GIỌNG ĐIỆU
- Xưng "mình", gọi người dùng là "bạn"
- Thân thiện, dễ hiểu, không dùng thuật ngữ quá chuyên môn
- Trả lời bằng tiếng Việt (trừ khi người dùng hỏi bằng tiếng Anh)

## NHIỆM VỤ
- Tư vấn sức khỏe thú cưng, nhận diện triệu chứng bệnh
- Hướng dẫn chăm sóc thú cưng (dinh dưỡng, vệ sinh, huấn luyện)
- Hỗ trợ đặt lịch khám tại phòng khám thú y
- Tìm kiếm phòng khám gần người dùng

## QUY TẮC NGHIỆP VỤ
- Không đưa ra chẩn đoán cuối cùng - luôn khuyến khích đưa thú cưng đi khám bác sĩ
- Ưu tiên an toàn và sức khỏe của thú cưng
- Khi triệu chứng nguy hiểm (co giật, nôn ra máu, khó thở), nhấn mạnh cần đi khám NGAY
- Chỉ tư vấn trong phạm vi chăm sóc thú cưng, từ chối lịch sự nếu hỏi ngoài phạm vi
"""

    @classmethod
    def _is_cache_valid(cls) -> bool:
        """Check if cache is still valid"""
        if cls._cache is None:
            return False
        return (time.time() - cls._cache_time) < cls._cache_ttl

    @classmethod
    async def get_config(
        cls,
        agent_name: str = "petties_agent",
        force_refresh: bool = False,
    ) -> AgentConfig:
        """
        Load agent_config from database.

        Args:
            agent_name: Name of the agent to load config for
            force_refresh: Force reload from DB, bypass cache

        Returns:
            AgentConfig with values from DB or defaults
        """
        # Check cache first
        if not force_refresh and cls._is_cache_valid():
            logger.debug(f"Using cached agent_config for {agent_name}")
            return cls._cache

        async with cls._lock:
            # Double-check after acquiring lock
            if not force_refresh and cls._is_cache_valid():
                return cls._cache

            logger.info(f"Loading agent_config from DB for {agent_name}")

            try:
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import select

                    result = await session.execute(
                        select(Agent).where(Agent.name == agent_name)
                    )
                    agent = result.scalar_one_or_none()

                    if agent:
                        config = AgentConfig(
                            name=agent.name,
                            temperature=agent.temperature
                            if agent.temperature is not None
                            else cls.DEFAULT_TEMPERATURE,
                            max_tokens=agent.max_tokens
                            if agent.max_tokens is not None
                            else cls.DEFAULT_MAX_TOKENS,
                            top_p=agent.top_p
                            if agent.top_p is not None
                            else cls.DEFAULT_TOP_P,
                            model=agent.model or cls.DEFAULT_MODEL,
                            system_prompt=agent.system_prompt,
                            enabled=agent.enabled,
                        )
                        logger.info(
                            f"Loaded agent_config: temp={config.temperature}, "
                            f"max_tokens={config.max_tokens}, model={config.model}"
                        )
                    else:
                        logger.warning(
                            f"Agent '{agent_name}' not found, using defaults"
                        )
                        config = cls._create_default_config(agent_name)

                    # Update cache
                    cls._cache = config
                    cls._cache_time = time.time()

                    return config

            except Exception as e:
                logger.error(f"Error loading agent_config: {e}")
                # Return defaults on error
                return cls._create_default_config(agent_name)

    @classmethod
    def _create_default_config(cls, agent_name: str) -> AgentConfig:
        """Create default config when DB is unavailable"""
        return AgentConfig(
            name=agent_name,
            temperature=cls.DEFAULT_TEMPERATURE,
            max_tokens=cls.DEFAULT_MAX_TOKENS,
            top_p=cls.DEFAULT_TOP_P,
            model=cls.DEFAULT_MODEL,
            system_prompt=None,  # Will use DEFAULT_SYSTEM_PROMPT
            enabled=True,
        )

    @classmethod
    async def get_system_prompt(cls, agent_name: str = "petties_agent") -> str:
        """
        Get system prompt for the agent.

        Returns:
            System prompt from DB, or default if not set
        """
        config = await cls.get_config(agent_name)
        return config.system_prompt or cls.DEFAULT_SYSTEM_PROMPT

    @classmethod
    async def get_temperature(cls, agent_name: str = "petties_agent") -> float:
        """Get temperature parameter"""
        config = await cls.get_config(agent_name)
        return config.temperature

    @classmethod
    async def get_max_tokens(cls, agent_name: str = "petties_agent") -> int:
        """Get max tokens parameter"""
        config = await cls.get_config(agent_name)
        return config.max_tokens

    @classmethod
    async def get_top_p(cls, agent_name: str = "petties_agent") -> float:
        """Get top_p parameter"""
        config = await cls.get_config(agent_name)
        return config.top_p

    @classmethod
    async def get_model(cls, agent_name: str = "petties_agent") -> str:
        """Get LLM model name"""
        config = await cls.get_config(agent_name)
        return config.model

    @classmethod
    def invalidate_cache(cls) -> None:
        """Manually invalidate the cache"""
        cls._cache = None
        cls._cache_time = 0
        logger.info("Agent config cache invalidated")


# Convenience function for easy import
async def get_agent_config(agent_name: str = "petties_agent") -> AgentConfig:
    """Get agent configuration"""
    return await AgentConfigLoader.get_config(agent_name)


async def get_system_prompt(agent_name: str = "petties_agent") -> str:
    """Get system prompt for the agent"""
    return await AgentConfigLoader.get_system_prompt(agent_name)


__all__ = [
    "AgentConfig",
    "AgentConfigLoader",
    "get_agent_config",
    "get_system_prompt",
]
