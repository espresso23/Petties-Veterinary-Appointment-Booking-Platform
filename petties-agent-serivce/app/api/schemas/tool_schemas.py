"""
PETTIES AGENT SERVICE - Tool API Schemas
Pydantic schemas cho Tool Management APIs (Code-based tools only)

Package: app.api.schemas
Purpose: Request/Response validation
Version: v0.0.2 - Simplified for code-based tools
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===== REQUEST SCHEMAS =====

class ExecuteToolRequest(BaseModel):
    """
    Request schema cho execute tool (testing)

    Endpoint: POST /tools/{tool_name}/execute
    """
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tool parameters"
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


class CreateToolRequest(BaseModel):
    """
    Request schema cho create new tool (manual)

    Endpoint: POST /tools
    """
    name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Tool name (snake_case)",
        examples=["check_slot", "create_booking"]
    )
    description: str = Field(
        ...,
        description="Semantic description for LLM"
    )
    input_schema: Optional[Dict[str, Any]] = Field(
        default=None,
        description="JSON schema for input parameters"
    )
    output_schema: Optional[Dict[str, Any]] = Field(
        default=None,
        description="JSON schema for output"
    )
    enabled: bool = Field(
        default=False,
        description="Enable tool immediately"
    )
    assigned_agents: List[str] = Field(
        default_factory=list,
        description="List of agent names to assign"
    )


class UpdateToolRequest(BaseModel):
    """
    Request schema cho update tool

    Endpoint: PUT /tools/{tool_id}
    """
    description: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None
    assigned_agents: Optional[List[str]] = None


# ===== RESPONSE SCHEMAS =====

class ToolResponse(BaseModel):
    """
    Response schema cho single tool (simplified for code-based)
    """
    id: int
    name: str
    description: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    enabled: bool
    assigned_agents: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecuteToolResponse(BaseModel):
    """
    Response schema cho execute tool

    Endpoint: POST /tools/{tool_name}/execute
    """
    success: bool
    tool_name: str
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


class ScanToolsResponse(BaseModel):
    """
    Response schema cho scan tools

    Endpoint: POST /tools/scan
    """
    success: bool
    message: str
    total_tools: int
    new_tools: int
    updated_tools: int
    tool_list: List[str]


# ===== ERROR RESPONSE =====

class ErrorResponse(BaseModel):
    """
    Generic error response
    """
    success: bool = False
    error: str
    detail: Optional[str] = None
