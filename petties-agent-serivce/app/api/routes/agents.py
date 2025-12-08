"""
PETTIES AGENT SERVICE - Agent Management API Routes
REST API endpoints for Agent CRUD and Prompt Management

Package: app.api.routes
Purpose: Agent Management APIs (AG-01, AG-02, AG-03)
Version: v0.0.1
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
    AgentErrorResponse
)
from app.db.postgres.models import Agent, Tool, PromptVersion, AgentType
from app.db.postgres.session import get_db

# Initialize router
router = APIRouter(prefix="/agents", tags=["Agents"])


# ===== GET ALL AGENTS =====

@router.get(
    "",
    response_model=AgentListResponse,
    summary="[AG-01] Get all agents with hierarchy",
    description="""
    Get all agents organized by hierarchy:
    - Main Agent (Supervisor) at top
    - Sub-Agents (Booking, Medical, Research) below
    """
)
async def get_agents(
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all agents with hierarchy view

    Response:
        {
            "total": 4,
            "main_agent": {...},
            "sub_agents": [...]
        }
    """
    try:
        query = select(Agent)
        
        if enabled is not None:
            query = query.where(Agent.enabled == enabled)
        
        result = await db.execute(query)
        agents = result.scalars().all()
        
        # Separate main agent from sub-agents
        main_agent = None
        sub_agents = []
        
        for agent in agents:
            agent_response = AgentResponse.model_validate(agent)
            
            # Get assigned tools for this agent
            tools_query = select(Tool).where(
                Tool.assigned_agents.contains([agent.name])
            )
            tools_result = await db.execute(tools_query)
            tools = tools_result.scalars().all()
            agent_response.tools = [t.name for t in tools]
            
            if agent.agent_type == AgentType.MAIN:
                main_agent = agent_response
            else:
                sub_agents.append(agent_response)
        
        return AgentListResponse(
            total=len(agents),
            main_agent=main_agent,
            sub_agents=sub_agents
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
    - Assigned tools list
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
        
        agent_response = AgentResponse.model_validate(agent)
        
        # Get assigned tools
        tools_query = select(Tool).where(
            Tool.assigned_agents.contains([agent.name])
        )
        tools_result = await db.execute(tools_query)
        tools = tools_result.scalars().all()
        
        assigned_tools = [{
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "tool_type": t.tool_type.value if t.tool_type else None,
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
    - model name
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
            "temperature": 0.3,
            "max_tokens": 1500,
            "model": "kimi-k2-thinking"
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
        if request.model is not None:
            agent.model = request.model
        if request.enabled is not None:
            agent.enabled = request.enabled
        
        await db.commit()
        await db.refresh(agent)
        
        logger.info(f"Updated agent {agent.name} config")
        
        return UpdateAgentResponse(
            success=True,
            message=f"Agent '{agent.name}' updated successfully",
            agent=AgentResponse.model_validate(agent)
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
            "prompt_text": "Ban la Main Agent cua Petties...",
            "notes": "Added routing rule for research queries",
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


# ===== TEST AGENT (Placeholder) =====

@router.post(
    "/{agent_id}/test",
    response_model=TestAgentResponse,
    summary="[PG-01] Test agent in playground",
    description="Send test message to agent. Loads agent from DB với Dynamic Configuration Loader."
)
async def test_agent(
    agent_id: int,
    request: TestAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Test agent with sample message
    
    Theo Technical Scope:
    - Load agent từ DB với Dynamic Configuration Loader
    - Agents load prompts từ DB khi runtime
    - Invoke với prompt từ DB
    """
    try:
        # Load agent từ DB với AgentFactory (Dynamic Configuration Loader)
        from app.core.agents.factory import AgentFactory
        
        agent = await AgentFactory.get_agent_by_id(agent_id, db)
        
        # Get agent name
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent_db = result.scalar_one_or_none()
        
        # Invoke với prompt từ DB
        response = await agent.invoke(request.message)
        
        return TestAgentResponse(
            success=True,
            agent_name=agent_db.name if agent_db else "unknown",
            message=request.message,
            response=response,
            thinking_process=[
                f"1. Loaded agent '{agent_db.name if agent_db else 'unknown'}' from DB",
                "2. Using system prompt from database",
                "3. Processing user message...",
                "4. Generating response..."
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
