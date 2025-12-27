"""
PETTIES AGENT SERVICE - Agent Factory
Load Single Agent from Database voi Dynamic Configuration Loader

Theo Technical Scope:
- Dynamic Configuration Loader query DB
- Inject vao Runtime Context
- Agent load prompts, tools tu DB khi runtime

Package: app.core.agents
Purpose: Factory pattern cho Single Agent creation
Version: v1.0.0 (Migrated from Multi-Agent to Single Agent)
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.core.agents.single_agent import SingleAgent, build_react_agent
from app.services.llm_client import (
    create_llm_client_from_db,
    LLMConfig,
    OpenRouterClient,
    OllamaClient
)
from app.db.postgres.models import Agent as AgentModel, Tool


class AgentFactory:
    """
    Factory de tao Single Agent instance tu Database

    Theo Technical Scope:
    - Dynamic Configuration Loader query DB
    - Inject vao Runtime Context
    - Agent load prompts, tools tu DB khi runtime

    Usage:
        ```python
        agent = await AgentFactory.get_agent(db_session)
        response = await agent.invoke("Con meo bi sot")
        ```
    """

    @staticmethod
    async def get_agent(
        db_session: AsyncSession,
        provider_override: Optional[str] = None,
        model_override: Optional[str] = None
    ) -> SingleAgent:
        """
        Load Single Agent tu DB voi dynamic config

        Args:
            db_session: Database session
            provider_override: Optional provider to use ("openrouter" | "deepseek")
            model_override: Optional model to override default (e.g., "google/gemini-2.0-flash-exp:free")

        Returns:
            SingleAgent instance voi:
            - LLM client (OpenRouter/DeepSeek/Ollama)
            - System prompt tu DB
            - Enabled tools tu DB

        Raises:
            ValueError: Neu khong tim thay agent enabled trong DB
        """
        # 1. Load enabled agent tu DB
        result = await db_session.execute(
            select(AgentModel).where(AgentModel.enabled == True).limit(1)
        )
        agent_config = result.scalar_one_or_none()

        if not agent_config:
            raise ValueError(
                "No enabled agent found in database. "
                "Run 'POST /api/v1/settings/seed' to initialize."
            )

        logger.info(f"Loading agent: {agent_config.name}")

        # 2. Load LLM client with provider/model override
        llm_client = await create_llm_client_from_db(
            db_session,
            provider_override=provider_override,
            model_override=model_override
        )

        logger.info(f"LLM client created: provider={provider_override or 'default'}, model={model_override or 'default'}")

        # 4. Load enabled tools tu DB
        tools_result = await db_session.execute(
            select(Tool).where(Tool.enabled == True)
        )
        tools_list = tools_result.scalars().all()
        enabled_tools = [t.name for t in tools_list]
        tool_schemas = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema
            } 
            for t in tools_list
        ]

        logger.info(f"Enabled tools: {enabled_tools}")

        # 5. Build Single Agent voi ReAct pattern
        agent = build_react_agent(
            llm_client=llm_client,
            name=agent_config.name,
            agent_type="single_agent",
            system_prompt=agent_config.system_prompt,
            temperature=agent_config.temperature,
            max_tokens=agent_config.max_tokens,
            top_p=agent_config.top_p or 0.9,
            enabled_tools=enabled_tools,
            tool_schemas=tool_schemas
        )

        actual_model = model_override or agent_config.model
        logger.info(
            f"SingleAgent created: {agent_config.name} | "
            f"model={actual_model} | "
            f"tools={len(enabled_tools)}"
        )

        return agent

    @staticmethod
    async def get_agent_by_id(
        agent_id: int,
        db_session: AsyncSession,
        provider_override: Optional[str] = None,
        model_override: Optional[str] = None
    ) -> SingleAgent:
        """
        Create agent by ID

        Args:
            agent_id: Database ID cua agent
            db_session: Database session
            provider_override: Optional provider to use ("openrouter" | "deepseek")
            model_override: Optional model to override default

        Returns:
            SingleAgent instance

        Raises:
            ValueError: Neu khong tim thay agent
        """
        result = await db_session.execute(
            select(AgentModel).where(AgentModel.id == agent_id)
        )
        agent_config = result.scalar_one_or_none()

        if not agent_config:
            raise ValueError(f"Agent ID {agent_id} not found")

        if not agent_config.enabled:
            raise ValueError(f"Agent '{agent_config.name}' is disabled")

        # Load LLM client with provider/model override
        llm_client = await create_llm_client_from_db(
            db_session,
            provider_override=provider_override,
            model_override=model_override
        )

        logger.info(f"LLM client created for agent {agent_id}: provider={provider_override or 'default'}, model={model_override or 'default'}")

        # Load enabled tools tu DB
        tools_result = await db_session.execute(
            select(Tool).where(Tool.enabled == True)
        )
        tools_list = tools_result.scalars().all()
        enabled_tools = [t.name for t in tools_list]
        tool_schemas = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema
            } 
            for t in tools_list
        ]

        # Build agent
        agent = build_react_agent(
            llm_client=llm_client,
            name=agent_config.name,
            agent_type="single_agent",
            system_prompt=agent_config.system_prompt,
            temperature=agent_config.temperature,
            max_tokens=agent_config.max_tokens,
            top_p=agent_config.top_p or 0.9,
            enabled_tools=enabled_tools,
            tool_schemas=tool_schemas
        )

        return agent

    @staticmethod
    async def get_agent_config(db_session: AsyncSession) -> dict:
        """
        Get agent configuration without creating instance

        Useful cho Admin Dashboard de hien thi config

        Args:
            db_session: Database session

        Returns:
            Dict voi agent config:
            {
                "id": 1,
                "name": "petties_agent",
                "description": "...",
                "temperature": 0.7,
                "max_tokens": 2000,
                "top_p": 0.9,
                "model": "google/gemini-2.0-flash-exp:free",
                "system_prompt": "...",
                "enabled": True,
                "enabled_tools": ["search_symptoms", "RAG_search", ...]
            }
        """
        # Load agent
        result = await db_session.execute(
            select(AgentModel).where(AgentModel.enabled == True).limit(1)
        )
        agent_config = result.scalar_one_or_none()

        if not agent_config:
            return None

        # Load enabled tools
        tools_result = await db_session.execute(
            select(Tool).where(Tool.enabled == True)
        )
        enabled_tools = [t.name for t in tools_result.scalars().all()]

        return {
            "id": agent_config.id,
            "name": agent_config.name,
            "description": agent_config.description,
            "temperature": agent_config.temperature,
            "max_tokens": agent_config.max_tokens,
            "top_p": agent_config.top_p,
            "model": agent_config.model,
            "system_prompt": agent_config.system_prompt,
            "enabled": agent_config.enabled,
            "enabled_tools": enabled_tools
        }


# ===== HELPER FUNCTIONS =====

async def get_enabled_tools(db_session: AsyncSession) -> List[str]:
    """
    Get list of enabled tool names

    Args:
        db_session: Database session

    Returns:
        List of enabled tool names
    """
    result = await db_session.execute(
        select(Tool.name).where(Tool.enabled == True)
    )
    return [row[0] for row in result.fetchall()]


async def is_tool_enabled(tool_name: str, db_session: AsyncSession) -> bool:
    """
    Check if a specific tool is enabled

    Args:
        tool_name: Name of the tool
        db_session: Database session

    Returns:
        True if tool is enabled, False otherwise
    """
    result = await db_session.execute(
        select(Tool).where(Tool.name == tool_name, Tool.enabled == True)
    )
    return result.scalar_one_or_none() is not None
