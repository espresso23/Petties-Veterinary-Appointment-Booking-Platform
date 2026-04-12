"""
PETTIES AGENT SERVICE - WebSocket Message Schemas
Pydantic schemas for WebSocket chat communication

Package: app.api.schemas
Purpose: Type definitions for WebSocket messages
Version: v1.0.0
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


# ===== Incoming Messages =====


class ChatMessageRequest(BaseModel):
    """Incoming chat message from client"""

    message: str = Field(..., min_length=1, max_length=4000)
    agent_id: Optional[int] = Field(
        None, description="Agent ID to use, None for default"
    )


# ===== Outgoing Message Types =====


class BaseWebSocketMessage(BaseModel):
    """Base class for all WebSocket messages"""

    type: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class ConnectedMessage(BaseWebSocketMessage):
    """Sent when WebSocket connection is established"""

    type: Literal["connected"] = "connected"
    session_id: str
    user: Optional[str] = None
    context_type: Optional[str] = None
    message: str = "Connected to Petties Agent Chat"
    booking_state: Optional[Dict[str, Any]] = None
    supported_message_types: List[str] = [
        "thinking",
        "tool_call",
        "tool_result",
        "stream",
        "complete",
        "error",
        "info",
        "ui_schema",
        "history",
        "booking_state_update",
        "thinking_stream",
    ]


class AckMessage(BaseWebSocketMessage):
    """Acknowledgment of received message"""

    type: Literal["ack"] = "ack"
    message: str
    agent_id: Optional[int] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class AgentInfoMessage(BaseWebSocketMessage):
    """Information about the agent being used"""

    type: Literal["agent_info"] = "agent_info"
    agent_name: str
    agent_type: str
    provider: Optional[str] = None
    model: Optional[str] = None
    allowed_tools: List[str] = []
    allowed_resources: List[str] = []


class ThinkingMessage(BaseWebSocketMessage):
    """Agent's reasoning step (Thought in ReAct)"""

    type: Literal["thinking"] = "thinking"
    step_index: int
    content: str
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None


class ToolCallMessage(BaseWebSocketMessage):
    """Tool being called (Action in ReAct)"""

    type: Literal["tool_call"] = "tool_call"
    step_index: int
    tool_name: str
    tool_params: Dict[str, Any] = {}
    content: str = ""


class ToolResultMessage(BaseWebSocketMessage):
    """Result from tool execution (Observation in ReAct)"""

    type: Literal["tool_result"] = "tool_result"
    step_index: int
    tool_name: Optional[str] = None
    result: Optional[Any] = None
    content: str = ""


class ThinkingStreamMessage(BaseWebSocketMessage):
    """Streaming-safe thinking summary for UI display."""

    type: Literal["thinking_stream"] = "thinking_stream"
    content: str
    step_index: Optional[int] = None


class HistoryMessage(BaseWebSocketMessage):
    """Restored message history for an existing session."""

    type: Literal["history"] = "history"
    session_id: str
    booking_state: Optional[Dict[str, Any]] = None
    messages: List[Dict[str, Any]] = []


class UISchemaMessage(BaseWebSocketMessage):
    """UI schema payload built by presentation layer."""

    type: Literal["ui_schema"] = "ui_schema"
    ui_schema: Dict[str, Any]
    stage: Optional[str] = None
    booking_state: Optional[Dict[str, Any]] = None


class BookingStateUpdateMessage(BaseWebSocketMessage):
    """Authoritative booking state update from server."""

    type: Literal["booking_state_update"] = "booking_state_update"
    booking_state: Dict[str, Any]
    stage: Optional[str] = None


class StreamMessage(BaseWebSocketMessage):
    """Token streaming from LLM"""

    type: Literal["stream"] = "stream"
    content: str


class CompleteMessage(BaseWebSocketMessage):
    """Final response with complete react trace"""

    type: Literal["complete"] = "complete"
    full_response: str
    react_trace: List[Dict[str, Any]] = []
    agent_id: Optional[int] = None
    total_steps: int = 0


class ErrorMessage(BaseWebSocketMessage):
    """Error occurred during processing"""

    type: Literal["error"] = "error"
    error: str
    error_code: Optional[str] = None
    recoverable: Optional[bool] = None
    suggestion: Optional[str] = None
    react_trace: Optional[List[Dict[str, Any]]] = None  # Partial trace for debugging


# ===== ReAct Trace Schema =====


class ReActTraceStep(BaseModel):
    """Single step in ReAct trace"""

    step_index: int
    step_type: Literal["thought", "action", "observation"]
    content: str
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None
    tool_result: Optional[Any] = None


class ReActTrace(BaseModel):
    """Complete ReAct trace for debugging/visualization"""

    steps: List[ReActTraceStep]
    final_answer: str
    total_iterations: int
    agent_name: str
    agent_type: str


# ===== Type Union for All Messages =====

WebSocketMessageType = (
    ConnectedMessage
    | HistoryMessage
    | BookingStateUpdateMessage
    | UISchemaMessage
    | AckMessage
    | AgentInfoMessage
    | ThinkingMessage
    | ThinkingStreamMessage
    | ToolCallMessage
    | ToolResultMessage
    | StreamMessage
    | CompleteMessage
    | ErrorMessage
)
