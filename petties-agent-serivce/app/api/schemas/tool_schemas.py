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
        default_factory=dict, description="Tool parameters"
    )


class EnableToolRequest(BaseModel):
    """
    Request schema cho enable/disable tool

    Endpoint: PUT /tools/{tool_id}/enable
    """

    enabled: bool = Field(..., description="Enable or disable tool")


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
        examples=["check_available_slots", "create_booking_for_user"],
    )
    description: str = Field(..., description="Semantic description for LLM")
    input_schema: Optional[Dict[str, Any]] = Field(
        default=None, description="JSON schema for input parameters"
    )
    output_schema: Optional[Dict[str, Any]] = Field(
        default=None, description="JSON schema for output"
    )
    enabled: bool = Field(default=False, description="Enable tool immediately")


class UpdateToolRequest(BaseModel):
    """
    Request schema cho update tool

    Endpoint: PUT /tools/{tool_id}
    """

    description: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


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
    is_system_managed: bool = False  # True if tool is in SYSTEM_MANAGED_TOOLS
    is_admin_configurable: bool = False  # True if tool is in ADMIN_CONFIGURABLE_TOOLS
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
    total_resources: int = 0
    new_tools: int
    updated_tools: int
    unchanged_tools: int = 0
    tool_list: List[str]
    resource_list: List[str] = Field(default_factory=list)
    resource_metadata: List[Dict[str, Any]] = Field(default_factory=list)


# ===== ERROR RESPONSE =====


class ErrorResponse(BaseModel):
    """
    Generic error response
    """

    success: bool = False
    error: str
    detail: Optional[str] = None
