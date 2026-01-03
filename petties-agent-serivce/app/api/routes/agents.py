"""
PETTIES AGENT SERVICE - Agent Management API Routes
REST API endpoints for Agent CRUD and Prompt Management

Package: app.api.routes
Purpose: Agent Management APIs (AG-01, AG-02, AG-03)
Version: v1.0.0 (Migrated from Multi-Agent to Single Agent)

Changes from v0.0.1:
- Simplified to Single Agent architecture
- Removed Multi-Agent hierarchy (main_agent, sub_agents)
- Added top_p parameter support
- Updated test endpoint with ReAct trace
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from loguru import logger

from app.api.schemas.agent_schemas import (
    AgentResponse,
    AgentListResponse,
    AgentDetailResponse,
    UpdateAgentRequest,
    UpdateAgentResponse,
    UpdatePromptRequest,
    UpdatePromptResponse,
    PromptVersionResponse,
    PromptHistoryResponse,
    TestAgentRequest,
    TestAgentResponse,
    ReActStepSchema,
    AgentErrorResponse
)
from app.db.postgres.models import Agent, Tool, PromptVersion
from app.db.postgres.session import get_db

# Initialize router
router = APIRouter(prefix="/agents", tags=["Agents"])


# ===== GET ALL AGENTS =====

@router.get(
    "",
    response_model=AgentListResponse,
    summary="[AG-01] Get all agents",
    description="""
    Get all agents (Single Agent architecture).

    Note: With Single Agent architecture, typically only 1 agent exists.
    Returns flat list instead of hierarchy.
    """
)
async def get_agents(
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all agents

    Response:
        {
            "total": 1,
            "agents": [...]
        }
    """
    try:
        query = select(Agent)

        if enabled is not None:
            query = query.where(Agent.enabled == enabled)

        result = await db.execute(query)
        agents = result.scalars().all()

        agent_responses = []
        for agent in agents:
            agent_response = AgentResponse(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens,
                top_p=agent.top_p or 0.9,
                model=agent.model,
                system_prompt=agent.system_prompt,
                enabled=agent.enabled,
                created_at=agent.created_at,
                updated_at=agent.updated_at
            )

            # Get enabled tools
            tools_query = select(Tool).where(Tool.enabled == True)
            tools_result = await db.execute(tools_query)
            tools = tools_result.scalars().all()
            agent_response.tools = [t.name for t in tools]

            agent_responses.append(agent_response)

        return AgentListResponse(
            total=len(agents),
            agents=agent_responses
        )

    except Exception as e:
        logger.error(f"Error fetching agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GET AGENT BY ID =====

@router.get(
    "/{agent_id}",
    response_model=AgentDetailResponse,
    summary="Get agent detail",
    description="Get detailed agent info with assigned tools and prompt history"
)
async def get_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get agent detail with:
    - Agent configuration
    - Enabled tools list
    - Recent prompt versions
    """
    try:
        # Get agent
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

        agent_response = AgentResponse(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
            top_p=agent.top_p or 0.9,
            model=agent.model,
            system_prompt=agent.system_prompt,
            enabled=agent.enabled,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )

        # Get enabled tools
        tools_query = select(Tool).where(Tool.enabled == True)
        tools_result = await db.execute(tools_query)
        tools = tools_result.scalars().all()

        assigned_tools = [{
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "tool_type": t.tool_type.value if hasattr(t.tool_type, 'value') else t.tool_type,
            "enabled": t.enabled
        } for t in tools]

        # Get recent prompt versions
        prompts_query = select(PromptVersion).where(
            PromptVersion.agent_id == agent_id
        ).order_by(desc(PromptVersion.version)).limit(5)
        prompts_result = await db.execute(prompts_query)
        prompts = prompts_result.scalars().all()

        recent_prompts = [{
            "id": p.id,
            "version": p.version,
            "is_active": p.is_active,
            "created_by": p.created_by,
            "notes": p.notes,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "prompt_preview": p.prompt_text[:200] + "..." if len(p.prompt_text) > 200 else p.prompt_text
        } for p in prompts]

        return AgentDetailResponse(
            agent=agent_response,
            assigned_tools=assigned_tools,
            recent_prompt_versions=recent_prompts
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== UPDATE AGENT CONFIG =====

@router.put(
    "/{agent_id}",
    response_model=UpdateAgentResponse,
    summary="[AG-03] Update agent configuration",
    description="""
    Update agent parameters:
    - temperature (0.0-1.0)
    - max_tokens (100-8000)
    - top_p (0.0-1.0) - NEW
    - model name (OpenRouter model ID)
    - enabled status
    """
)
async def update_agent(
    agent_id: int,
    request: UpdateAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update agent configuration (Admin flow)

    Body:
        {
            "temperature": 0.7,
            "max_tokens": 2000,
            "top_p": 0.9,
            "model": "google/gemini-2.0-flash-exp:free"
        }
    """
    try:
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

        # Update fields if provided
        if request.description is not None:
            agent.description = request.description
        if request.temperature is not None:
            agent.temperature = request.temperature
        if request.max_tokens is not None:
            agent.max_tokens = request.max_tokens
        if request.top_p is not None:
            agent.top_p = request.top_p
        if request.model is not None:
            agent.model = request.model
        if request.enabled is not None:
            agent.enabled = request.enabled

        await db.commit()
        await db.refresh(agent)

        logger.info(f"Updated agent {agent.name} config")

        agent_response = AgentResponse(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
            top_p=agent.top_p or 0.9,
            model=agent.model,
            system_prompt=agent.system_prompt,
            enabled=agent.enabled,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )

        return UpdateAgentResponse(
            success=True,
            message=f"Agent '{agent.name}' updated successfully",
            agent=agent_response
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== UPDATE SYSTEM PROMPT =====

@router.put(
    "/{agent_id}/prompt",
    response_model=UpdatePromptResponse,
    summary="[AG-02] Update system prompt",
    description="""
    Update agent's system prompt with version control.

    - Creates new version automatically
    - Sets new version as active
    - Keeps history of previous versions
    """
)
async def update_prompt(
    agent_id: int,
    request: UpdatePromptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update system prompt (Admin Supervisor Tuning - UC-01)

    Body:
        {
            "prompt_text": "Ban la Petties AI Assistant...",
            "notes": "Updated for ReAct pattern",
            "created_by": "admin"
        }
    """
    try:
        # Get agent
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

        # Get current max version
        version_result = await db.execute(
            select(PromptVersion.version)
            .where(PromptVersion.agent_id == agent_id)
            .order_by(desc(PromptVersion.version))
            .limit(1)
        )
        max_version = version_result.scalar_one_or_none() or 0
        new_version = max_version + 1

        # Deactivate all previous versions
        await db.execute(
            PromptVersion.__table__.update()
            .where(PromptVersion.agent_id == agent_id)
            .values(is_active=False)
        )

        # Create new version
        new_prompt = PromptVersion(
            agent_id=agent_id,
            version=new_version,
            prompt_text=request.prompt_text,
            is_active=True,
            created_by=request.created_by,
            notes=request.notes
        )
        db.add(new_prompt)

        # Update agent's current system_prompt
        agent.system_prompt = request.prompt_text

        await db.commit()

        logger.info(f"Created prompt version {new_version} for agent {agent.name}")

        return UpdatePromptResponse(
            success=True,
            message=f"Prompt updated to version {new_version}",
            agent_id=agent_id,
            agent_name=agent.name,
            version=new_version,
            prompt_preview=request.prompt_text[:200] + "..." if len(request.prompt_text) > 200 else request.prompt_text
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating prompt for agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GET PROMPT HISTORY =====

@router.get(
    "/{agent_id}/prompt-history",
    response_model=PromptHistoryResponse,
    summary="Get prompt version history",
    description="Get all prompt versions for an agent"
)
async def get_prompt_history(
    agent_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """
    Get prompt version history for rollback/review
    """
    try:
        # Get agent
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

        # Get prompt versions
        prompts_query = select(PromptVersion).where(
            PromptVersion.agent_id == agent_id
        ).order_by(desc(PromptVersion.version)).limit(limit)

        prompts_result = await db.execute(prompts_query)
        prompts = prompts_result.scalars().all()

        # Find active version
        active_version = 0
        versions = []
        for p in prompts:
            if p.is_active:
                active_version = p.version
            versions.append(PromptVersionResponse(
                id=p.id,
                version=p.version,
                prompt_text=p.prompt_text,
                is_active=p.is_active,
                created_by=p.created_by,
                notes=p.notes,
                created_at=p.created_at
            ))

        return PromptHistoryResponse(
            agent_id=agent_id,
            agent_name=agent.name,
            total_versions=len(versions),
            active_version=active_version,
            versions=versions
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prompt history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== TEST AGENT =====

@router.post(
    "/{agent_id}/test",
    response_model=TestAgentResponse,
    summary="[PG-01] Test agent in playground",
    description="""
    Test agent with sample message.
    Returns ReAct trace for debugging.
    """
)
async def test_agent(
    agent_id: int,
    request: TestAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Test agent with sample message

    Loads agent from DB with Dynamic Configuration Loader.
    Returns ReAct trace (Thought -> Action -> Observation).
    """
    try:
        # Load agent from DB with AgentFactory
        from app.core.agents.factory import AgentFactory

        agent = await AgentFactory.get_agent_by_id(agent_id, db)

        # Get agent name from DB
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent_db = result.scalar_one_or_none()

        # Invoke agent
        response = await agent.invoke(request.message)

        # Get ReAct trace if available
        react_steps = []
        # Note: ReAct trace would come from agent state
        # For now, return basic thinking process

        return TestAgentResponse(
            success=True,
            agent_name=agent_db.name if agent_db else "unknown",
            message=request.message,
            response=response,
            react_steps=react_steps,
            thinking_process=[
                f"1. Loaded agent '{agent_db.name if agent_db else 'unknown'}' from DB",
                "2. Using system prompt from database",
                f"3. Model: {agent_db.model if agent_db else 'unknown'}",
                "4. Processing with ReAct pattern...",
                "5. Generated response"
            ],
            tool_calls=[]
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
