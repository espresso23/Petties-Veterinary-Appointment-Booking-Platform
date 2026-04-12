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

from app.core.agents.single_agent import SingleAgent
from app.core.context_policy import ContextPolicyService
from app.services.llm_client import (
    create_llm_client_from_db,
    LLMConfig,
    OpenRouterClient,
)
from app.db.postgres.models import Agent as AgentModel, Tool
from app.core.tools.mcp_resources import list_resources_metadata


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

    # Cache: key = (provider, model, user_role, context_type) -> SingleAgent
    _agent_cache: dict[str, SingleAgent] = {}
    _cache_config_hash: Optional[str] = None

    @staticmethod
    async def get_agent(
        db_session: AsyncSession,
        provider_override: Optional[str] = None,
        model_override: Optional[str] = None,
        user_role: Optional[str] = None,
        context_type: Optional[str] = None,
    ) -> SingleAgent:
        """
        Load Single Agent tu DB voi dynamic config

        Args:
            db_session: Database session
            provider_override: Optional provider to use ("openrouter")
            model_override: Optional model to override default (e.g., "google/gemini-2.5-flash-lite")

        Returns:
            SingleAgent instance voi:
            - LLM client (OpenRouter)
            - System prompt tu DB
            - Enabled tools tu DB

        Raises:
            ValueError: Neu khong tim thay agent enabled trong DB
        """
        # Build cache key
        effective_provider = provider_override or "openrouter"
        effective_model = model_override or "default"
        cache_key = (
            f"{effective_provider}:{effective_model}:"
            f"{user_role or 'none'}:{context_type or 'none'}"
        )

        # Check cache first
        if cache_key in AgentFactory._agent_cache:
            logger.debug(f"Agent cache hit: {cache_key}")
            return AgentFactory._agent_cache[cache_key]

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
        # If no model_override provided, use the agent's configured model from DB
        effective_model = model_override or agent_config.model
        llm_client = await create_llm_client_from_db(
            db_session,
            provider_override=provider_override,
            model_override=effective_model,
        )

        logger.info(
            f"LLM client created: provider={provider_override or 'default'}, model={effective_model}"
        )

        # 4. Load enabled tools tu DB
        tools_list = await AgentFactory._load_enabled_tools(
            db_session=db_session,
            user_role=user_role,
            context_type=context_type,
        )
        enabled_tools = [t.name for t in tools_list]
        tool_schemas = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
            }
            for t in tools_list
        ]

        logger.info(f"Enabled tools: {enabled_tools}")
        available_resources = [item["name"] for item in list_resources_metadata()]
        allowed_resources = ContextPolicyService.get_allowed_resources(
            user_role=user_role,
            context_type=context_type,
            available_resources=available_resources,
        )

        # System prompt is hardcoded in single_agent.py - no longer load from DB
        # Role guardrails and tool whitelist are added via ContextPolicyService
        from app.core.agents.single_agent import DEFAULT_SYSTEM_PROMPT

        system_prompt = ContextPolicyService.build_system_prompt(
            DEFAULT_SYSTEM_PROMPT,  # Hardcoded, not from DB
            user_role=user_role,
            context_type=context_type,
            allowed_tools=enabled_tools,
            allowed_resources=allowed_resources,
        )

        # 5. Build Single Agent voi ReAct pattern
        agent = SingleAgent(
            llm_client=llm_client,
            name=agent_config.name,
            agent_type="single_agent",
            system_prompt=system_prompt,
            temperature=agent_config.temperature,
            max_tokens=agent_config.max_tokens,
            top_p=agent_config.top_p or 0.9,
            enabled_tools=enabled_tools,
            tool_schemas=tool_schemas,
        )
        agent.allowed_resources = allowed_resources

        actual_model = model_override or agent_config.model
        logger.info(
            f"SingleAgent created: {agent_config.name} | "
            f"model={actual_model} | "
            f"tools={len(enabled_tools)}"
        )

        # Cache the agent
        AgentFactory._agent_cache[cache_key] = agent
        logger.info(
            f"Agent cached: {cache_key} (total cached: {len(AgentFactory._agent_cache)})"
        )

        return agent

    @staticmethod
    async def get_agent_by_id(
        agent_id: int,
        db_session: AsyncSession,
        provider_override: Optional[str] = None,
        model_override: Optional[str] = None,
        user_role: Optional[str] = None,
        context_type: Optional[str] = None,
    ) -> SingleAgent:
        """
        Create agent by ID

        Args:
            agent_id: Database ID cua agent
            db_session: Database session
            provider_override: Optional provider to use ("openrouter")
            model_override: Optional model to override default

        Returns:
            SingleAgent instance

        Raises:
            ValueError: Neu khong tim thay agent
        """
        # Build cache key
        effective_provider = provider_override or "openrouter"
        effective_model = model_override or "default"
        cache_key = (
            f"id:{agent_id}:{effective_provider}:{effective_model}:"
            f"{user_role or 'none'}:{context_type or 'none'}"
        )

        # Check cache first
        if cache_key in AgentFactory._agent_cache:
            logger.debug(f"Agent cache hit: {cache_key}")
            return AgentFactory._agent_cache[cache_key]

        result = await db_session.execute(
            select(AgentModel).where(AgentModel.id == agent_id)
        )
        agent_config = result.scalar_one_or_none()

        if not agent_config:
            raise ValueError(f"Agent ID {agent_id} not found")

        if not agent_config.enabled:
            raise ValueError(f"Agent '{agent_config.name}' is disabled")

        # Load LLM client with provider/model override
        # If no model_override provided, use the agent's configured model from DB
        effective_model = model_override or agent_config.model
        llm_client = await create_llm_client_from_db(
            db_session,
            provider_override=provider_override,
            model_override=effective_model,
        )

        logger.info(
            f"LLM client created for agent {agent_id}: provider={provider_override or 'default'}, model={effective_model}"
        )

        # Load enabled tools tu DB
        tools_list = await AgentFactory._load_enabled_tools(
            db_session=db_session,
            user_role=user_role,
            context_type=context_type,
        )
        enabled_tools = [t.name for t in tools_list]
        tool_schemas = [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
            }
            for t in tools_list
        ]
        available_resources = [item["name"] for item in list_resources_metadata()]
        allowed_resources = ContextPolicyService.get_allowed_resources(
            user_role=user_role,
            context_type=context_type,
            available_resources=available_resources,
        )

        # System prompt is hardcoded in single_agent.py - no longer load from DB
        from app.core.agents.single_agent import DEFAULT_SYSTEM_PROMPT

        system_prompt = ContextPolicyService.build_system_prompt(
            DEFAULT_SYSTEM_PROMPT,  # Hardcoded, not from DB
            user_role=user_role,
            context_type=context_type,
            allowed_tools=enabled_tools,
            allowed_resources=allowed_resources,
        )

        # Build agent
        agent = SingleAgent(
            llm_client=llm_client,
            name=agent_config.name,
            agent_type="single_agent",
            system_prompt=system_prompt,
            temperature=agent_config.temperature,
            max_tokens=agent_config.max_tokens,
            top_p=agent_config.top_p or 0.9,
            enabled_tools=enabled_tools,
            tool_schemas=tool_schemas,
        )
        agent.allowed_resources = allowed_resources

        # Cache the agent
        AgentFactory._agent_cache[cache_key] = agent
        logger.info(
            f"Agent cached: {cache_key} (total cached: {len(AgentFactory._agent_cache)})"
        )

        return agent

    @staticmethod
    async def _load_enabled_tools(
        db_session: AsyncSession,
        user_role: Optional[str] = None,
        context_type: Optional[str] = None,
    ) -> List[Tool]:
        """Load enabled tools and apply role/context whitelist."""
        tools_result = await db_session.execute(
            select(Tool).where(Tool.enabled == True)
        )
        tools_list = tools_result.scalars().all()

        if not user_role and not context_type:
            return tools_list

        allowed_names = ContextPolicyService.get_allowed_tools(
            user_role=user_role,
            context_type=context_type,
            available_tools=[tool.name for tool in tools_list],
        )
        allowed_lookup = {tool_name.lower() for tool_name in allowed_names}

        return [tool for tool in tools_list if tool.name.lower() in allowed_lookup]

    @staticmethod
    def clear_cache() -> None:
        """Clear all cached agents. Call when agent config changes."""
        count = len(AgentFactory._agent_cache)
        AgentFactory._agent_cache.clear()
        logger.info(f"Agent cache cleared ({count} agents removed)")

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
                "model": "google/gemini-2.5-flash-lite",
                "enabled": True,
                "enabled_tools": ["pet_knowledge_search", "web_search", ...]
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
            "enabled": agent_config.enabled,
            "enabled_tools": enabled_tools,
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
    result = await db_session.execute(select(Tool.name).where(Tool.enabled == True))
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
