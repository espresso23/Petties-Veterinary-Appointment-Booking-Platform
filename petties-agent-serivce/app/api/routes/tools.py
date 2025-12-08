"""
PETTIES AGENT SERVICE - Tool Management API Routes
REST API endpoints cho Tool Registry và TL-03 Swagger Import

Package: app.api.routes
Purpose: Tool Management APIs
Version: v0.0.1
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from loguru import logger

from app.api.schemas.tool_schemas import (
    ImportSwaggerRequest,
    ImportSwaggerResponse,
    RenameToolRequest,
    RenameToolResponse,
    ExecuteToolRequest,
    ExecuteToolResponse,
    AssignToolToAgentRequest,
    EnableToolRequest,
    ToolResponse,
    ToolListResponse,
    SwaggerImportHistoryResponse,
    ErrorResponse
)
from app.core.tools.swagger_importer import SwaggerImporter
from app.core.tools.executor import DynamicToolExecutor
from app.core.tools.scanner import ToolScanner
from app.db.postgres.models import Tool, ToolSource, ToolTypeEnum
from app.db.postgres.session import get_db
from app.config.settings import Settings

# Initialize router
router = APIRouter(prefix="/tools", tags=["Tools"])

# Initialize settings
settings = Settings()


# ===== TL-03: SWAGGER IMPORT ENDPOINTS =====

@router.post(
    "/import-swagger",
    response_model=ImportSwaggerResponse,
    summary="[TL-03] Import tools từ Swagger/OpenAPI spec",
    description="""
    Import tất cả endpoints từ Spring Boot Swagger JSON.

    Flow:
    1. Fetch OpenAPI spec từ URL
    2. Parse và extract all endpoints
    3. Sync vào database
    4. Return import summary

    Admin có thể rename tools sau khi import.
    """
)
async def import_from_swagger(
    request: ImportSwaggerRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    TL-03: Import tools từ Swagger/OpenAPI

    Body:
        {
            "swagger_url": "/v3/api-docs",
            "auto_enable": false
        }

    Response:
        {
            "success": true,
            "message": "Imported 15 endpoints from Swagger",
            "total_endpoints": 15,
            "new_tools": 10,
            "updated_tools": 3,
            "skipped_tools": 2,
            "tools": [...]
        }
    """
    try:
        logger.info(f"🚀 Starting Swagger import from {request.swagger_url}")

        # Initialize importer
        importer = SwaggerImporter(base_url=settings.SPRING_BACKEND_URL)

        # Import from Swagger
        result = await importer.import_from_swagger(
            swagger_url=request.swagger_url,
            auto_enable=request.auto_enable
        )

        return ImportSwaggerResponse(
            success=True,
            message=f"Successfully imported {result['total_endpoints']} endpoints from Swagger",
            swagger_url=result["swagger_url"],
            server_url=result["server_url"],
            openapi_version=result["openapi_version"],
            total_endpoints=result["total_endpoints"],
            new_tools=result["new_tools"],
            updated_tools=result["updated_tools"],
            skipped_tools=result["skipped_tools"],
            tools=result["tools"]
        )

    except Exception as e:
        logger.error(f"❌ Error importing from Swagger: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/swagger-imported",
    response_model=SwaggerImportHistoryResponse,
    summary="[TL-03] Get Swagger import history",
    description="Danh sách tools đã import từ Swagger"
)
async def get_swagger_imported_tools(
    swagger_url: Optional[str] = Query(None, description="Filter by Swagger URL"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get danh sách tools đã import từ Swagger

    Query params:
        - swagger_url: Filter by Swagger URL (optional)

    Response:
        {
            "total": 15,
            "swagger_url": "/v3/api-docs",
            "tools": [...]
        }
    """
    try:
        importer = SwaggerImporter(base_url=settings.SPRING_BACKEND_URL)
        tools = await importer.get_import_history(swagger_url=swagger_url)

        return SwaggerImportHistoryResponse(
            total=len(tools),
            swagger_url=swagger_url,
            tools=tools
        )

    except Exception as e:
        logger.error(f"❌ Error fetching import history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{tool_id}/rename",
    response_model=RenameToolResponse,
    summary="[TL-03] Rename imported tool",
    description="""
    Rename tool đã import từ Swagger.

    Example:
        vaccine_controller_get_history -> check_vaccine_history
    """
)
async def rename_tool(
    tool_id: int,
    request: RenameToolRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Rename tool (Admin flow trong UC-02)

    Path params:
        - tool_id: Tool ID

    Body:
        {
            "new_name": "check_vaccine_history"
        }

    Response:
        {
            "success": true,
            "message": "Tool renamed successfully",
            "old_name": "vaccine_controller_get_history",
            "new_name": "check_vaccine_history"
        }
    """
    try:
        importer = SwaggerImporter(base_url=settings.SPRING_BACKEND_URL)
        result = await importer.rename_tool(
            tool_id=tool_id,
            new_name=request.new_name
        )

        return RenameToolResponse(
            success=True,
            message="Tool renamed successfully",
            id=result["id"],
            old_name=result["old_name"],
            new_name=result["new_name"],
            original_name=result.get("original_name")
        )

    except Exception as e:
        logger.error(f"❌ Error renaming tool: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{tool_name}/execute",
    response_model=ExecuteToolResponse,
    summary="[TL-03] Execute tool (testing)",
    description="Execute tool để test functionality (Admin testing)"
)
async def execute_tool(
    tool_name: str,
    request: ExecuteToolRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute tool để test (Admin Dashboard)

    Path params:
        - tool_name: Tool name

    Body:
        {
            "parameters": {
                "petId": "PET_12345",
                "page": 0
            },
            "headers": {
                "Authorization": "Bearer token"
            }
        }

    Response:
        {
            "success": true,
            "tool_name": "check_vaccine_history",
            "status_code": 200,
            "data": {...}
        }
    """
    try:
        executor = DynamicToolExecutor(base_url=settings.SPRING_BACKEND_URL)
        result = await executor.execute(
            tool_name=tool_name,
            parameters=request.parameters,
            headers=request.headers
        )

        return ExecuteToolResponse(**result)

    except Exception as e:
        logger.error(f"❌ Error executing tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== TL-02: TOOL SCANNER ENDPOINTS =====

@router.post(
    "/scan",
    summary="[TL-02] Scan FastMCP code-based tools",
    description="Scan FastMCP server và sync code-based tools vào database"
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
        scanner = ToolScanner()
        result = await scanner.scan_and_sync_tools()

        return {
            "success": True,
            "message": "Code-based tools scanned successfully",
            **result
        }

    except Exception as e:
        logger.error(f"❌ Error scanning tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GENERAL TOOL MANAGEMENT =====

@router.get(
    "",
    response_model=ToolListResponse,
    summary="Get all tools",
    description="Danh sách tất cả tools (code-based + API-based)"
)
async def get_tools(
    tool_type: Optional[str] = Query(None, description="Filter by tool_type"),
    source: Optional[str] = Query(None, description="Filter by source"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    agent_name: Optional[str] = Query(None, description="Filter by assigned agent"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all tools với filters

    Query params:
        - tool_type: code_based / api_based
        - source: fastmcp_code / swagger_imported / manual_api
        - enabled: true / false
        - agent_name: booking_agent / medical_agent / research_agent
    """
    try:
        query = select(Tool)

        # Apply filters
        if tool_type:
            query = query.where(Tool.tool_type == tool_type)

        if source:
            query = query.where(Tool.source == source)

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
                "tool_type": tool_type,
                "source": source,
                "enabled": enabled,
                "agent_name": agent_name
            }
        )

    except Exception as e:
        logger.error(f"❌ Error fetching tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{tool_id}",
    response_model=ToolResponse,
    summary="Get tool by ID",
    description="Chi tiết 1 tool"
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
        logger.error(f"❌ Error fetching tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{tool_id}/enable",
    summary="Enable/disable tool",
    description="Enable hoặc disable tool (Admin control)"
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
        logger.error(f"❌ Error toggling tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{tool_id}/assign",
    summary="Assign tool to agent",
    description="Assign tool cho agent (Admin flow)"
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
        logger.error(f"❌ Error assigning tool: {e}")
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
        logger.error(f"❌ Error deleting tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))
