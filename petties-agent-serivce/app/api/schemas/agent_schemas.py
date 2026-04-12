"""
PETTIES AGENT SERVICE - Agent Management API Schemas
Pydantic schemas for Agent CRUD and playground testing.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentResponse(BaseModel):
    """Single agent response (Single Agent architecture)."""

    id: int
    name: str
    description: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9
    model: str = "google/gemini-2.5-flash-lite"
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tools: Optional[List[str]] = None

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    """List agents response."""

    total: int
    agents: List[AgentResponse] = []


class AgentDetailResponse(BaseModel):
    """Detailed agent response with available tools."""

    agent: AgentResponse
    tools: List[Dict[str, Any]] = []


class UpdateAgentRequest(BaseModel):
    """Update agent configuration."""

    description: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_tokens: Optional[int] = Field(None, ge=100, le=8000)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    model: Optional[str] = None
    enabled: Optional[bool] = None


class UpdateAgentResponse(BaseModel):
    """Response after updating agent."""

    success: bool
    message: str
    agent: AgentResponse


class TestAgentRequest(BaseModel):
    """Test agent with sample message."""

    message: str
    context: Optional[Dict[str, Any]] = None


class ReActStepSchema(BaseModel):
    """Single ReAct step for trace visualization."""

    step_type: str
    content: str
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None
    tool_result: Optional[Any] = None


class TestAgentResponse(BaseModel):
    """Test response with ReAct trace."""

    success: bool
    agent_name: str
    message: str
    response: str
    react_steps: Optional[List[ReActStepSchema]] = None
    thinking_process: Optional[List[str]] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class AgentErrorResponse(BaseModel):
    """Error response."""

    success: bool = False
    error: str
    detail: Optional[str] = None
