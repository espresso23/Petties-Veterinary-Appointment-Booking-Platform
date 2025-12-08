"""
PETTIES AGENT SERVICE - Main Agent (Supervisor)

LangGraph Supervisor-Worker pattern for multi-agent orchestration.
Uses StateGraph with conditional routing to sub-agents.

Flow:
User Message -> Supervisor (classify) -> Route to Sub-Agent -> Response
"""

from typing import Literal, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
import logging

from app.config.settings import settings
from app.core.agents.state import AgentState, Message

logger = logging.getLogger(__name__)



# ===== PROMPTS =====

SUPERVISOR_PROMPT = """You are the Main Agent (Supervisor) of Petties - veterinary booking platform.

Your tasks:
1. Classify user intent
2. Route to appropriate Sub-Agent
3. Synthesize results and respond in Vietnamese

Available Sub-Agents:
- booking_agent: Book appointments, check slots, view schedule
- medical_agent: Diagnose symptoms, medical advice, disease lookup
- research_agent: Tìm kiếm thông tin trên web (sản phẩm, bài viết, video, mẹo vặt)

For general greetings or unclear intent, respond directly.
"""


# ===== MAIN AGENT CLASS =====

class MainAgent:
    """Supervisor Agent - Routes to Sub-Agents based on intent"""
    
    def __init__(self, llm=None, system_prompt: Optional[str] = None):
        self.llm = llm or self._get_default_llm()
        # Prompt từ DB (via AgentFactory) hoặc fallback to hardcoded
        self.system_prompt = system_prompt or SUPERVISOR_PROMPT
    
    def _get_default_llm(self):
        """Get LLM from Ollama (local) - NOT OpenAI for reasoning"""
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.2
        )
    
    def classify_intent(self, message: str) -> tuple[str, str]:
        """Classify user intent and determine routing"""
        msg = message.lower()
        
        # Booking
        if any(kw in msg for kw in ['dat lich', 'book', 'hen', 'slot', 'lich kham', 'appointment']):
            return 'booking', 'booking_agent'
        
        # Medical
        if any(kw in msg for kw in ['benh', 'trieu chung', 'non', 'tieu chay', 'sot', 'sick', 'symptom']):
            return 'medical', 'medical_agent'
        
        # Research (web search - bao gồm sản phẩm, thông tin, video, mẹo vặt)
        if any(kw in msg for kw in ['mua', 'san pham', 'thuc an', 'gia', 'buy', 'product', 'food', 
                                     'tim kiem', 'thong tin', 'research', 'web', 'video', 'meo', 
                                     'cach', 'huong dan', 'review', 'tin tuc']):
            return 'research', 'research_agent'
        
        return 'general', 'main_agent'
    
    async def invoke(self, message: str, session_id: str = "default") -> str:
        """Process user message directly (without graph)"""
        intent, next_agent = self.classify_intent(message)
        logger.info(f"Intent: {intent}, Routing to: {next_agent}")
        
        if next_agent == 'main_agent':
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=message)
            ]
            response = await self.llm.ainvoke(messages)
            return response.content
        
        return f"[Routing to {next_agent}] Intent: {intent}"


# ===== LANGGRAPH NODES =====

def supervisor_node(state: AgentState) -> AgentState:
    """Supervisor node - classifies intent and sets routing"""
    agent = MainAgent()
    messages = state.get("messages", [])
    
    if messages:
        last_msg = messages[-1]
        content = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
        intent, next_agent = agent.classify_intent(content)
        return {**state, "intent": intent, "next_agent": next_agent}
    
    return {**state, "intent": "unknown", "next_agent": "main_agent"}


def booking_node(state: AgentState) -> AgentState:
    """Booking agent node"""
    from app.core.agents.booking_agent import BookingAgent
    # TODO: Implement actual booking logic
    new_msg = AIMessage(content="[Booking Agent] Processing booking request...")
    return {**state, "messages": [*state["messages"], new_msg]}


def medical_node(state: AgentState) -> AgentState:
    """Medical agent node"""
    from app.core.agents.medical_agent import MedicalAgent
    # TODO: Implement with RAG
    new_msg = AIMessage(content="[Medical Agent] Analyzing symptoms...")
    return {**state, "messages": [*state["messages"], new_msg]}


def research_node(state: AgentState) -> AgentState:
    """Research agent node"""
    from app.core.agents.research_agent import ResearchAgent
    new_msg = AIMessage(content="[Research Agent] Searching web...")
    return {**state, "messages": [*state["messages"], new_msg]}


def response_node(state: AgentState) -> AgentState:
    """Final response synthesis"""
    return state


# ===== ROUTING =====

def route_to_agent(state: AgentState) -> Literal["booking", "medical", "research", "response"]:
    """Conditional routing based on classified intent"""
    next_agent = state.get("next_agent", "main_agent")
    routes = {
        "booking_agent": "booking",
        "medical_agent": "medical",
        "research_agent": "research",
    }
    return routes.get(next_agent, "response")


# ===== GRAPH BUILDER =====

def create_supervisor_graph():
    """
    Create LangGraph workflow with supervisor pattern.
    
    Returns:
        Compiled StateGraph with memory checkpointer
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("booking", booking_node)
    workflow.add_node("medical", medical_node)
    workflow.add_node("research", research_node)
    workflow.add_node("response", response_node)
    
    # Set entry and edges
    workflow.set_entry_point("supervisor")
    workflow.add_conditional_edges(
        "supervisor",
        route_to_agent,
        {"booking": "booking", "medical": "medical", "research": "research", "response": "response"}
    )
    workflow.add_edge("booking", "response")
    workflow.add_edge("medical", "response")
    workflow.add_edge("research", "response")
    workflow.add_edge("response", END)
    
    # Compile with memory for conversation history
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
