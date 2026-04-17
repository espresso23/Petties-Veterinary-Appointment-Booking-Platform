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


STAGE_IDLE = "IDLE"
STAGE_COLLECTING = "COLLECTING"
STAGE_PRESENTING = "PRESENTING"
STAGE_CONFIRMING = "CONFIRMING"
STAGE_BOOKED = "BOOKED"

CANONICAL_STAGES = (
    STAGE_IDLE,
    STAGE_COLLECTING,
    STAGE_PRESENTING,
    STAGE_CONFIRMING,
    STAGE_BOOKED,
)


def map_booking_status_to_stage(status: Optional[str], active: bool = False) -> str:
    normalized = str(status or "").strip().upper()

    if normalized in {"COMPLETED", "BOOKED"}:
        return STAGE_BOOKED
    if normalized == "CONFIRMING":
        return STAGE_CONFIRMING
    if normalized in {"REVIEWING", "PRESENTING"}:
        return STAGE_PRESENTING
    if normalized in {"COLLECTING", "SUSPENDED"}:
        return STAGE_COLLECTING
    if normalized in {"CANCELLED", "IDLE"}:
        return STAGE_IDLE
    if active:
        return STAGE_COLLECTING
    return STAGE_IDLE


class Message(TypedDict):
    """Single message in conversation"""

    role: Literal["user", "assistant", "system", "tool"]
    content: str
    name: Optional[str]  # Tool name if role is "tool"
    tool_call_id: Optional[str]


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

    # Conversation State Machine
    stage: Literal["IDLE", "COLLECTING", "PRESENTING", "CONFIRMING", "BOOKED"]

    # Error handling
    error: Optional[str]


def create_initial_react_state(
    user_message: str,
    context: Optional[Dict[str, Any]] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    user_role: Optional[str] = None,
) -> ReActState:
    """
    Create initial state cho new conversation

    Args:
        user_message: User's input message
        context: Additional context (user_id, session_id, images, etc.)
        chat_history: Previous chat messages from MongoDB
        user_role: Role of the user (e.g., STAFF, PET_OWNER) for role-based guidance

    Returns:
        Initial ReActState

    Example:
        ```python
        state = create_initial_react_state(
            user_message="Con meo cua toi bi non, lam sao bay gio?",
            context={"user_id": "USR_123", "pet_info": {"name": "Miu"}},
            chat_history=[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
            user_role="STAFF"
        )
        ```
    """
    messages: List[Message] = []

    if chat_history:
        for msg in chat_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if not content:
                continue

            if role == "user":
                messages.append(
                    Message(role="user", content=content, name=None, tool_call_id=None)
                )
            elif role == "assistant":
                messages.append(
                    Message(
                        role="assistant", content=content, name=None, tool_call_id=None
                    )
                )

    messages.append(
        Message(role="user", content=user_message, name=None, tool_call_id=None)
    )

    # Merge user_role into context
    final_context = context or {}
    if user_role:
        final_context["user_role"] = user_role

    return ReActState(
        messages=messages,
        react_steps=[],
        current_thought=None,
        pending_tool_call=None,
        last_tool_result=None,
        current_observation=None,
        final_answer=None,
        should_end=False,
        iteration=0,
        context=final_context,
        stage=STAGE_IDLE,
        error=None,
    )
