"""
PETTIES AGENT SERVICE - Agent Management API Routes
REST API endpoints for Agent CRUD and playground testing.
"""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.middleware.auth import get_admin_user
from app.api.schemas.agent_schemas import (
    AgentDetailResponse,
    AgentListResponse,
    AgentResponse,
    ReActStepSchema,
    TestAgentRequest,
    TestAgentResponse,
    UpdateAgentRequest,
    UpdateAgentResponse,
)
from app.db.postgres.models import Agent, Tool
from app.db.postgres.session import get_db

router = APIRouter(
    prefix="/agents",
    tags=["Agents"],
    dependencies=[Depends(get_admin_user)],
)


@router.get(
    "",
    response_model=AgentListResponse,
    summary="[AG-01] Get all agents",
)
async def get_agents(
    enabled: bool | None = Query(None, description="Filter by enabled status"),
    db: AsyncSession = Depends(get_db),
):
    try:
        query = select(Agent)
        if enabled is not None:
            query = query.where(Agent.enabled == enabled)

        result = await db.execute(query)
        agents = result.scalars().all()

        tools_result = await db.execute(select(Tool).where(Tool.enabled))
        enabled_tool_names = [tool.name for tool in tools_result.scalars().all()]

        agent_responses = []
        for agent in agents:
            response = AgentResponse(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens,
                top_p=agent.top_p or 0.9,
                model=agent.model,
                enabled=agent.enabled,
                created_at=agent.created_at,
                updated_at=agent.updated_at,
                tools=enabled_tool_names,
            )
            agent_responses.append(response)

        return AgentListResponse(total=len(agent_responses), agents=agent_responses)
    except Exception as exc:
        logger.error(f"Error fetching agents: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/{agent_id}",
    response_model=AgentDetailResponse,
    summary="Get agent detail",
)
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
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
            enabled=agent.enabled,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
        )

        tools_result = await db.execute(select(Tool).where(Tool.enabled))
        tools = tools_result.scalars().all()
        tools = [
            {
                "id": tool.id,
                "name": tool.name,
                "description": tool.description,
                "tool_type": tool.tool_type.value
                if hasattr(tool.tool_type, "value")
                else tool.tool_type,
                "enabled": tool.enabled,
            }
            for tool in tools
        ]

        return AgentDetailResponse(agent=agent_response, tools=tools)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching agent {agent_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.put(
    "/{agent_id}",
    response_model=UpdateAgentResponse,
    summary="[AG-03] Update agent configuration",
)
async def update_agent(
    agent_id: int,
    request: UpdateAgentRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

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

        from datetime import datetime, timezone

        agent.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(agent)

        # Invalidate agent cache so next request picks up new config
        from app.core.agents.factory import AgentFactory

        AgentFactory.clear_cache()

        return UpdateAgentResponse(
            success=True,
            message=f"Agent '{agent.name}' updated successfully",
            agent=AgentResponse(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens,
                top_p=agent.top_p or 0.9,
                model=agent.model,
                enabled=agent.enabled,
                created_at=agent.created_at,
                updated_at=agent.updated_at,
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error updating agent {agent_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/{agent_id}/test",
    response_model=TestAgentResponse,
    summary="[PG-01] Test agent in playground",
)
async def test_agent(
    agent_id: int,
    request: TestAgentRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent_db = result.scalar_one_or_none()
        if not agent_db:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

        from app.core.agents.factory import AgentFactory

        agent = await AgentFactory.get_agent_by_id(agent_id, db)

        react_trace = []
        full_response = ""
        tool_calls = []

        try:
            async for event in agent.stream(
                request.message,
                session_id=f"test-{uuid4().hex[:8]}",
            ):
                if not isinstance(event, dict):
                    continue

                event_type = event.get("type", "")
                if event_type == "react_step":
                    step = event.get("step", {})
                    react_trace.append(step)
                    if step.get("tool_name"):
                        tool_calls.append(
                            {
                                "tool_name": step.get("tool_name"),
                                "tool_params": step.get("tool_params"),
                                "tool_result": step.get("tool_result"),
                            }
                        )
                elif event_type in ("token", "final_answer"):
                    full_response += event.get("content", "")
                elif event_type == "error":
                    raise Exception(event.get("content", "Agent error during testing"))
        except Exception as exc:
            logger.error(f"Test stream failed: {exc}")
            if not full_response:
                full_response = f"Lỗi xử lý: {exc}"

        if not full_response.strip() and react_trace:
            last_obs = next(
                (
                    step
                    for step in reversed(react_trace)
                    if step.get("step_type") == "observation"
                ),
                None,
            )
            if last_obs:
                full_response = last_obs.get(
                    "content",
                    "Agent finished with trace but no final answer.",
                )

        return TestAgentResponse(
            success=True,
            agent_name=agent_db.name,
            message=request.message,
            response=full_response,
            react_steps=[ReActStepSchema(**step) for step in react_trace],
            thinking_process=[
                f"1. Loaded agent '{agent_db.name}' from DB",
                "2. Using hardcoded system prompt policy",
                f"3. Model: {agent_db.model}",
                f"4. Processing with ReAct pattern ({len(react_trace)} steps)...",
                "5. Generated response",
            ],
            tool_calls=tool_calls,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error testing agent {agent_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
