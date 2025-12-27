"""
PETTIES AGENT SERVICE - ReAct State Definition

LangGraph state management cho Single Agent voi ReAct pattern.
ReAct = Reason + Act: Thought -> Action -> Observation -> Loop

Package: app.core.agents
Purpose: Define shared state TypedDict cho LangGraph ReAct workflow
Version: v1.0.0 (Migrated from Multi-Agent to Single Agent)
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


class ReActStep(TypedDict):
    """
    Single step trong ReAct flow

    Attributes:
        step_type: Loai step (thought, action, observation)
        content: Noi dung step
        tool_name: Ten tool (chi cho action)
        tool_params: Parameters cua tool (chi cho action)
        tool_result: Ket qua tu tool (chi cho observation)
    """
    step_type: Literal["thought", "action", "observation"]
    content: str
    tool_name: Optional[str]
    tool_params: Optional[Dict[str, Any]]
    tool_result: Optional[Any]


class ReActState(TypedDict):
    """
    State cho Single Agent voi ReAct pattern

    ReAct Flow:
    1. THINK: LLM reasoning (Thought)
    2. ACT: Execute tool (Action)
    3. OBSERVE: Process result (Observation)
    4. Loop or END

    Attributes:
        messages: List conversation messages (user, assistant)
        react_steps: List ReAct steps cho debugging/visualization
        current_thought: Current thought tu Think node
        pending_tool_call: Tool call dang cho execution
        last_tool_result: Ket qua tu tool call gan nhat
        current_observation: Observation tu Observe node
        final_answer: Final answer de tra ve user
        should_end: Flag de ket thuc ReAct loop
        iteration: So iteration hien tai (de prevent infinite loop)
        context: Additional context (user_id, session_id, etc.)
        error: Error message neu co

    Usage:
        ```python
        from langgraph.graph import StateGraph
        from app.core.agents.state import ReActState

        graph = StateGraph(ReActState)
        graph.add_node("think", think_node)
        graph.add_node("act", act_node)
        graph.add_node("observe", observe_node)
        ```
    """
    # Conversation messages
    messages: List[Message]

    # ReAct trace for debugging
    react_steps: Annotated[List[ReActStep], add]

    # Think node output
    current_thought: Optional[str]

    # Act node
    pending_tool_call: Optional[Dict[str, Any]]  # {name, arguments}
    last_tool_result: Optional[Any]

    # Observe node
    current_observation: Optional[str]

    # Final output
    final_answer: Optional[str]

    # Control flow
    should_end: bool
    iteration: int

    # Additional context
    context: Dict[str, Any]
    # Example context:
    # {
    #     "user_id": "USR_12345",
    #     "session_id": "SES_67890",
    #     "pet_info": {"pet_id": "PET_001", "name": "Miu", "species": "cat"},
    #     "location": {"lat": 10.762622, "lng": 106.660172}
    # }

    # Error handling
    error: Optional[str]


def create_initial_react_state(
    user_message: str,
    context: Optional[Dict[str, Any]] = None
) -> ReActState:
    """
    Create initial state cho new conversation

    Args:
        user_message: User's input message
        context: Additional context (user_id, session_id, etc.)

    Returns:
        Initial ReActState

    Example:
        ```python
        state = create_initial_react_state(
            user_message="Con meo cua toi bi non, lam sao bay gio?",
            context={"user_id": "USR_123", "pet_info": {"name": "Miu"}}
        )
        ```
    """
    return ReActState(
        messages=[
            Message(
                role="user",
                content=user_message,
                name=None,
                tool_call_id=None
            )
        ],
        react_steps=[],
        current_thought=None,
        pending_tool_call=None,
        last_tool_result=None,
        current_observation=None,
        final_answer=None,
        should_end=False,
        iteration=0,
        context=context or {},
        error=None
    )


# ===== LEGACY SUPPORT =====
# Keep AgentState for backward compatibility during migration

class AgentState(TypedDict):
    """
    [DEPRECATED] Legacy AgentState for Multi-Agent architecture

    Migrated to ReActState for Single Agent.
    Kept for backward compatibility during transition.
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

    # Final response
    final_response: Optional[str]

    # Error handling
    error: Optional[str]


def create_initial_state(
    user_message: str,
    context: Optional[Dict[str, Any]] = None
) -> ReActState:
    """
    [DEPRECATED] Legacy function, use create_initial_react_state instead

    Kept for backward compatibility.
    """
    return create_initial_react_state(user_message, context)
