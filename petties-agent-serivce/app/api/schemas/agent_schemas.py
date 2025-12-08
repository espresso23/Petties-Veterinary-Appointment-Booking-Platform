"""
PETTIES AGENT SERVICE - Agent Management API Schemas
Pydantic schemas for Agent CRUD and Prompt Management

Package: app.api.schemas
Purpose: Agent Management API request/response models
Version: v0.0.1
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class AgentTypeEnum(str, Enum):
    """Agent types"""
    MAIN = "main"
    BOOKING = "booking"
    MEDICAL = "medical"
    RESEARCH = "research"


# ===== Agent Response Schemas =====

class AgentResponse(BaseModel):
    """Single agent response"""
    id: int
    name: str
    agent_type: AgentTypeEnum
    description: Optional[str] = None
    temperature: float = 0.5
    max_tokens: int = 2000
    model: str = "kimi-k2-thinking"
    system_prompt: Optional[str] = None
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Related data
    tools: Optional[List[str]] = None  # Assigned tool names
    
    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    """List agents response with hierarchy"""
    total: int
    main_agent: Optional[AgentResponse] = None
    sub_agents: List[AgentResponse] = []


class AgentDetailResponse(BaseModel):
    """Detailed agent response with tools and prompt history"""
    agent: AgentResponse
    assigned_tools: List[Dict[str, Any]] = []
    recent_prompt_versions: List[Dict[str, Any]] = []


# ===== Agent Update Schemas =====

class UpdateAgentRequest(BaseModel):
    """Update agent configuration"""
    description: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_tokens: Optional[int] = Field(None, ge=100, le=8000)
    model: Optional[str] = None
    enabled: Optional[bool] = None


class UpdateAgentResponse(BaseModel):
    """Response after updating agent"""
    success: bool
    message: str
    agent: AgentResponse


# ===== Prompt Management Schemas =====

class UpdatePromptRequest(BaseModel):
    """Update system prompt"""
    prompt_text: str = Field(..., min_length=10)
    notes: Optional[str] = None
    created_by: Optional[str] = "admin"


class UpdatePromptResponse(BaseModel):
    """Response after updating prompt"""
    success: bool
    message: str
    agent_id: int
    agent_name: str
    version: int
    prompt_preview: str  # First 200 chars


class PromptVersionResponse(BaseModel):
    """Single prompt version"""
    id: int
    version: int
    prompt_text: str
    is_active: bool
    created_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class PromptHistoryResponse(BaseModel):
    """Prompt version history"""
    agent_id: int
    agent_name: str
    total_versions: int
    active_version: int
    versions: List[PromptVersionResponse]


# ===== Agent Test Schemas =====

class TestAgentRequest(BaseModel):
    """Test agent with sample message"""
    message: str
    context: Optional[Dict[str, Any]] = None


class TestAgentResponse(BaseModel):
    """Test response (placeholder)"""
    success: bool
    agent_name: str
    message: str
    response: str
    thinking_process: Optional[List[str]] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


# ===== Error Schema =====

class AgentErrorResponse(BaseModel):
    """Error response"""
    success: bool = False
    error: str
    detail: Optional[str] = None
