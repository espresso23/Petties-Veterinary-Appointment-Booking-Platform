"""
PETTIES AGENT SERVICE - Tool API Schemas
Pydantic schemas cho Tool Management APIs

Package: app.api.schemas
Purpose: Request/Response validation
Version: v0.0.1
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===== REQUEST SCHEMAS =====

class ImportSwaggerRequest(BaseModel):
    """
    Request schema cho import từ Swagger

    Endpoint: POST /tools/import-swagger
    """
    swagger_url: str = Field(
        ...,
        description="URL của Swagger spec",
        examples=["/v3/api-docs", "http://localhost:8080/v3/api-docs"]
    )
    auto_enable: bool = Field(
        default=False,
        description="Tự động enable tools sau khi import"
    )


class RenameToolRequest(BaseModel):
    """
    Request schema cho rename tool

    Endpoint: PUT /tools/{tool_id}/rename
    """
    new_name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="New tool name (snake_case)",
        examples=["check_vaccine_history", "create_booking"]
    )


class ExecuteToolRequest(BaseModel):
    """
    Request schema cho execute tool (testing)

    Endpoint: POST /tools/{tool_name}/execute
    """
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tool parameters"
    )
    headers: Optional[Dict[str, str]] = Field(
        default=None,
        description="Custom HTTP headers"
    )


class AssignToolToAgentRequest(BaseModel):
    """
    Request schema cho assign tool to agent

    Endpoint: POST /tools/{tool_id}/assign
    """
    agent_name: str = Field(
        ...,
        description="Agent name",
        examples=["booking_agent", "medical_agent", "research_agent"]
    )


class EnableToolRequest(BaseModel):
    """
    Request schema cho enable/disable tool

    Endpoint: PUT /tools/{tool_id}/enable
    """
    enabled: bool = Field(
        ...,
        description="Enable or disable tool"
    )


# ===== RESPONSE SCHEMAS =====

class ToolResponse(BaseModel):
    """
    Response schema cho single tool
    """
    id: int
    name: str
    original_name: Optional[str] = None
    tool_type: str
    source: str
    description: Optional[str] = None
    method: Optional[str] = None
    path: Optional[str] = None
    endpoint: Optional[str] = None
    enabled: bool
    assigned_agents: List[str]
    swagger_url: Optional[str] = None
    operation_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportSwaggerResponse(BaseModel):
    """
    Response schema cho Swagger import

    Endpoint: POST /tools/import-swagger
    """
    success: bool
    message: str
    swagger_url: str
    server_url: str
    openapi_version: str
    total_endpoints: int
    new_tools: int
    updated_tools: int
    skipped_tools: int
    tools: List[Dict[str, Any]]


class RenameToolResponse(BaseModel):
    """
    Response schema cho rename tool

    Endpoint: PUT /tools/{tool_id}/rename
    """
    success: bool
    message: str
    id: int
    old_name: str
    new_name: str
    original_name: Optional[str] = None


class ExecuteToolResponse(BaseModel):
    """
    Response schema cho execute tool

    Endpoint: POST /tools/{tool_name}/execute
    """
    success: bool
    tool_name: str
    method: str
    url: str
    status_code: int
    data: Optional[Any] = None
    error: Optional[str] = None


class ToolListResponse(BaseModel):
    """
    Response schema cho list tools

    Endpoint: GET /tools
    """
    total: int
    tools: List[ToolResponse]
    filters: Optional[Dict[str, Any]] = None


class SwaggerImportHistoryResponse(BaseModel):
    """
    Response schema cho import history

    Endpoint: GET /tools/swagger-imported
    """
    total: int
    swagger_url: Optional[str] = None
    tools: List[ToolResponse]


# ===== ERROR RESPONSE =====

class ErrorResponse(BaseModel):
    """
    Generic error response
    """
    success: bool = False
    error: str
    detail: Optional[str] = None
