"""
PETTIES AGENT SERVICE - Agent State Definition
LangGraph state management cho multi-agent system

Package: app.core.agents
Purpose: Define shared state TypedDict cho LangGraph workflow
Version: v0.0.1
"""

from typing import TypedDict, Annotated, List, Dict, Any, Optional, Literal
from operator import add


class Message(TypedDict):
    """Single message in conversation"""
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    name: Optional[str]  # Tool name if role is "tool"
    tool_call_id: Optional[str]


class ToolCall(TypedDict):
    """Tool call request"""
    id: str
    name: str
    arguments: Dict[str, Any]


class ToolResult(TypedDict):
    """Tool execution result"""
    tool_call_id: str
    name: str
    result: Any
    error: Optional[str]


class AgentState(TypedDict):
    """
    Shared state cho LangGraph Supervisor-Worker workflow

    Attributes:
        messages: List of conversation messages (annotated với add để accumulate)
        current_agent: Agent đang xử lý (main, booking, medical, research)
        intent: Classified intent từ Main Agent
        tool_calls: Pending tool calls
        tool_results: Results từ tool executions
        routing_history: History of agent handoffs
        context: Additional context (user_id, session_id, pet_info, etc.)
        final_response: Final response để return cho user
        error: Error message nếu có

    Usage:
        ```python
        from langgraph.graph import StateGraph
        from app.core.agents.state import AgentState

        graph = StateGraph(AgentState)
        ```
    """
    # Conversation messages (accumulated)
    messages: Annotated[List[Message], add]

    # Current agent handling the request
    current_agent: Literal["main", "booking", "medical", "research"]

    # Classified intent from Main Agent
    intent: Optional[Literal["booking", "medical", "research", "general", "unclear"]]

    # Tool execution
    tool_calls: List[ToolCall]
    tool_results: List[ToolResult]

    # Routing history for debugging
    routing_history: Annotated[List[str], add]

    # Additional context
    context: Dict[str, Any]
    # Example context:
    # {
    #     "user_id": "USR_12345",
    #     "session_id": "SES_67890",
    #     "pet_info": {"pet_id": "PET_001", "name": "Miu", "species": "cat"},
    #     "location": {"lat": 10.762622, "lng": 106.660172}
    # }

    # Final response
    final_response: Optional[str]

    # Error handling
    error: Optional[str]


def create_initial_state(
    user_message: str,
    context: Optional[Dict[str, Any]] = None
) -> AgentState:
    """
    Create initial state cho new conversation

    Args:
        user_message: User's input message
        context: Additional context (user_id, session_id, etc.)

    Returns:
        Initial AgentState

    Example:
        ```python
        state = create_initial_state(
            user_message="Tôi muốn đặt lịch khám cho mèo",
            context={"user_id": "USR_123", "pet_info": {...}}
        )
        ```
    """
    return AgentState(
        messages=[
            Message(
                role="user",
                content=user_message,
                name=None,
                tool_call_id=None
            )
        ],
        current_agent="main",
        intent=None,
        tool_calls=[],
        tool_results=[],
        routing_history=["main"],
        context=context or {},
        final_response=None,
        error=None
    )
