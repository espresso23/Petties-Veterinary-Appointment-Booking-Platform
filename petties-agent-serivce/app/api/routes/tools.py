"""
PETTIES AGENT SERVICE - Tool Management API Routes
REST API endpoints cho Tool Registry (Code-based tools only)

Package: app.api.routes
Purpose: Tool Management APIs
Version: v0.0.2 - Simplified for code-based tools
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from loguru import logger

from app.api.schemas.tool_schemas import (
    ExecuteToolRequest,
    ExecuteToolResponse,
    AssignToolToAgentRequest,
    EnableToolRequest,
    ToolResponse,
    ToolListResponse,
    ScanToolsResponse,
    ErrorResponse
)
from app.core.tools.scanner import ToolScanner
from app.db.postgres.models import Tool
from app.db.postgres.session import get_db

# Initialize router
router = APIRouter(prefix="/tools", tags=["Tools"])


# ===== TL-02: TOOL SCANNER ENDPOINTS =====

@router.post(
    "/scan",
    response_model=ScanToolsResponse,
    summary="[TL-02] Scan FastMCP code-based tools",
    description="Scan FastMCP server and sync code-based tools to database"
)
async def scan_code_tools(db: AsyncSession = Depends(get_db)):
    """
    TL-02: Scan FastMCP code-based tools

    Response:
        {
            "success": true,
            "total_tools": 12,
            "new_tools": 5,
            "updated_tools": 2
        }
    """
    try:
        from app.core.tools.mcp_server import mcp_server
        available_mcp = list(mcp_server.list_tools().keys())
        logger.info(f"🔍 Tools registered in FastMCP: {available_mcp}")

        scanner = ToolScanner()
        result = await scanner.scan_and_sync_tools()

        return ScanToolsResponse(
            success=True,
            message=f"Code-based tools scanned successfully. Found: {', '.join(available_mcp)}",
            **result
        )

    except Exception as e:
        logger.error(f"Error scanning tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GENERAL TOOL MANAGEMENT =====

@router.get(
    "",
    response_model=ToolListResponse,
    summary="Get all tools",
    description="List all code-based tools"
)
async def get_tools(
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    agent_name: Optional[str] = Query(None, description="Filter by assigned agent"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all tools with filters

    Query params:
        - enabled: true / false
        - agent_name: booking_agent / medical_agent / research_agent
    """
    try:
        query = select(Tool)

        # Apply filters
        if enabled is not None:
            query = query.where(Tool.enabled == enabled)

        if agent_name:
            query = query.where(Tool.assigned_agents.contains([agent_name]))

        result = await db.execute(query)
        tools = result.scalars().all()

        return ToolListResponse(
            total=len(tools),
            tools=[ToolResponse.model_validate(tool) for tool in tools],
            filters={
                "enabled": enabled,
                "agent_name": agent_name
            }
        )

    except Exception as e:
        logger.error(f"Error fetching tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{tool_id}",
    response_model=ToolResponse,
    summary="Get tool by ID",
    description="Get single tool details"
)
async def get_tool(
    tool_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get tool by ID
    """
    try:
        result = await db.execute(
            select(Tool).where(Tool.id == tool_id)
        )
        tool = result.scalar_one_or_none()

        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")

        return ToolResponse.model_validate(tool)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{tool_id}/enable",
    summary="Enable/disable tool",
    description="Enable or disable tool (Admin control)"
)
async def toggle_tool_enabled(
    tool_id: int,
    request: EnableToolRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Enable/disable tool

    Body:
        {
            "enabled": true
        }
    """
    try:
        result = await db.execute(
            select(Tool).where(Tool.id == tool_id)
        )
        tool = result.scalar_one_or_none()

        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")

        tool.enabled = request.enabled
        await db.commit()

        return {
            "success": True,
            "message": f"Tool {'enabled' if request.enabled else 'disabled'} successfully",
            "tool_id": tool_id,
            "tool_name": tool.name,
            "enabled": tool.enabled
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{tool_id}/assign",
    summary="Assign tool to agent",
    description="Assign tool to agent (Admin flow)"
)
async def assign_tool_to_agent(
    tool_id: int,
    request: AssignToolToAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Assign tool to agent

    Body:
        {
            "agent_name": "booking_agent"
        }
    """
    try:
        result = await db.execute(
            select(Tool).where(Tool.id == tool_id)
        )
        tool = result.scalar_one_or_none()

        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")

        # Add agent to assigned_agents if not already assigned
        assigned_agents = tool.assigned_agents or []
        if request.agent_name not in assigned_agents:
            assigned_agents.append(request.agent_name)
            tool.assigned_agents = assigned_agents
            await db.commit()

        return {
            "success": True,
            "message": f"Tool assigned to {request.agent_name}",
            "tool_id": tool_id,
            "tool_name": tool.name,
            "assigned_agents": tool.assigned_agents
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{tool_id}/unassign/{agent_name}",
    summary="Unassign tool from agent",
    description="Remove tool assignment from agent"
)
async def unassign_tool_from_agent(
    tool_id: int,
    agent_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Unassign tool from agent
    """
    try:
        result = await db.execute(
            select(Tool).where(Tool.id == tool_id)
        )
        tool = result.scalar_one_or_none()

        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")

        # Remove agent from assigned_agents
        assigned_agents = tool.assigned_agents or []
        if agent_name in assigned_agents:
            assigned_agents.remove(agent_name)
            tool.assigned_agents = assigned_agents
            await db.commit()

        return {
            "success": True,
            "message": f"Tool unassigned from {agent_name}",
            "tool_id": tool_id,
            "tool_name": tool.name,
            "assigned_agents": tool.assigned_agents
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unassigning tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{tool_id}",
    summary="Delete tool",
    description="Delete tool (Admin only, use with caution)"
)
async def delete_tool(
    tool_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete tool from database

    WARNING: This will permanently delete the tool
    """
    try:
        result = await db.execute(
            select(Tool).where(Tool.id == tool_id)
        )
        tool = result.scalar_one_or_none()

        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")

        tool_name = tool.name
        await db.delete(tool)
        await db.commit()

        return {
            "success": True,
            "message": f"Tool '{tool_name}' deleted successfully",
            "tool_id": tool_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{tool_name}/execute",
    response_model=ExecuteToolResponse,
    summary="Execute tool (testing)",
    description="Execute tool to test functionality (Admin testing)"
)
async def execute_tool(
    tool_name: str,
    request: ExecuteToolRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute tool for testing (Admin Dashboard)

    Path params:
        - tool_name: Tool name

    Body:
        {
            "parameters": {
                "pet_id": "PET_12345",
                "date": "2025-01-15"
            }
        }

    Response:
        {
            "success": true,
            "tool_name": "check_slot",
            "data": {...}
        }
    """
    try:
        # Load tool from database
        result = await db.execute(
            select(Tool).where(Tool.name == tool_name)
        )
        tool = result.scalar_one_or_none()

        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

        if not tool.enabled:
            raise HTTPException(status_code=400, detail=f"Tool '{tool_name}' is not enabled")

        # Execute tool via MCP server
        from app.core.tools.mcp_server import call_mcp_tool

        tool_result = await call_mcp_tool(tool_name, request.parameters)

        return ExecuteToolResponse(
            success=True,
            tool_name=tool_name,
            data=tool_result
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing tool: {e}")
        return ExecuteToolResponse(
            success=False,
            tool_name=tool_name,
            error=str(e)
        )
