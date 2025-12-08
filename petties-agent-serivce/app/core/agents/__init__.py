"""
PETTIES AGENT SERVICE - Agents Package

LangGraph Multi-Agent Architecture:
- main_agent.py: Supervisor with StateGraph workflow
- booking_agent.py: Appointment scheduling
- medical_agent.py: Symptom analysis + RAG
- research_agent.py: Web research (general-purpose)
- factory.py: AgentFactory với Dynamic Configuration Loader
"""

from app.core.agents.main_agent import MainAgent, create_supervisor_graph, AgentState
from app.core.agents.booking_agent import BookingAgent
from app.core.agents.medical_agent import MedicalAgent
from app.core.agents.research_agent import ResearchAgent
from app.core.agents.factory import AgentFactory

__all__ = [
    "MainAgent",
    "create_supervisor_graph",
    "AgentState",
    "BookingAgent",
    "MedicalAgent",
    "ResearchAgent",
    "AgentFactory",
]
