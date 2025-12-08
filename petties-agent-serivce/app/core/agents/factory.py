"""
PETTIES AGENT SERVICE - Agent Factory
Load agents from Database với Dynamic Configuration Loader

Theo Technical Scope:
- Dynamic Configuration Loader query DB
- Inject vào Runtime Context
- Agents load prompts từ DB khi runtime
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.config.dynamic_loader import DynamicConfigLoader
from app.core.agents.main_agent import MainAgent
from app.core.agents.booking_agent import BookingAgent
from app.core.agents.medical_agent import MedicalAgent
from app.core.agents.research_agent import ResearchAgent
from app.services.llm_client import create_llm_client, LLMConfig


class AgentFactory:
    """
    Factory để tạo Agent instances từ Database
    
    Theo Technical Scope:
    - Dynamic Configuration Loader query DB
    - Inject vào Runtime Context
    - Agents load prompts từ DB khi runtime
    """
    
    @staticmethod
    async def create_agent(
        agent_name: str,
        db_session: AsyncSession,
        llm=None
    ):
        """
        Create agent với Dynamic Configuration Loader
        
        Args:
            agent_name: Tên agent (main_agent, booking_agent, etc.)
            db_session: Database session
            llm: Optional LLM client (auto-create if None)
        
        Returns:
            Agent instance với prompt từ DB
        
        Raises:
            ValueError: Nếu agent không tìm thấy trong DB
        """
        # Load config từ DB (Dynamic Configuration Loader)
        config = await DynamicConfigLoader.load_agent_config(
            db_session, agent_name
        )
        
        if not config:
            raise ValueError(
                f"Agent '{agent_name}' not found or disabled in database. "
                f"Run seed_db.py first."
            )
        
        # Load system settings (API keys, etc.) từ DB
        system_settings = await DynamicConfigLoader.load_system_settings(db_session)
        
        # Create LLM config từ DB settings
        if llm is None:
            llm_config = LLMConfig(
                provider="ollama",
                model=config["model"],
                temperature=config["temperature"],
                max_tokens=config["max_tokens"],
                # Load Ollama config từ system_settings
                base_url=system_settings.get("OLLAMA_BASE_URL", "http://localhost:11434"),
                api_key=system_settings.get("OLLAMA_API_KEY") or None,
            )
            llm = create_llm_client(llm_config)
        
        # Create agent instance dựa trên type
        agent_class_map = {
            "main_agent": MainAgent,
            "booking_agent": BookingAgent,
            "medical_agent": MedicalAgent,
            "research_agent": ResearchAgent,
        }
        
        agent_class = agent_class_map.get(agent_name)
        if not agent_class:
            raise ValueError(f"Unknown agent type: {agent_name}")
        
        # Create với prompt từ DB (pass vào constructor)
        agent = agent_class(llm=llm, system_prompt=config["system_prompt"])
        
        logger.info(f"✅ Created {agent_name} with prompt from DB (length: {len(config['system_prompt'])} chars)")
        return agent
    
    @staticmethod
    async def get_agent_by_id(
        agent_id: int,
        db_session: AsyncSession,
        llm=None
    ):
        """
        Create agent by ID
        
        Args:
            agent_id: Database ID của agent
            db_session: Database session
            llm: Optional LLM client
        """
        from sqlalchemy import select
        from app.db.postgres.models import Agent as AgentModel
        
        result = await db_session.execute(
            select(AgentModel).where(AgentModel.id == agent_id)
        )
        agent_db = result.scalar_one_or_none()
        
        if not agent_db:
            raise ValueError(f"Agent ID {agent_id} not found")
        
        return await AgentFactory.create_agent(agent_db.name, db_session, llm)

