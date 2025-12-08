"""
PETTIES AGENT SERVICE - Booking Agent

Handles appointment scheduling, slot checking, and booking management.
Called by Main Agent when booking intent is detected.
"""

from typing import Optional
from langchain_core.messages import HumanMessage, SystemMessage
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


BOOKING_PROMPT = """You are the Booking Agent for Petties veterinary platform.

Capabilities:
1. Check available appointment slots
2. Create new bookings
3. View existing appointments
4. Cancel or reschedule

When booking, collect: pet type, preferred clinic, date/time, service type.
Respond in Vietnamese.
"""


class BookingAgent:
    """Booking Sub-Agent - Appointment scheduling"""
    
    def __init__(self, llm=None, system_prompt: Optional[str] = None):
        self.llm = llm or self._get_default_llm()
        # Prompt từ DB (via AgentFactory) hoặc fallback to hardcoded
        self.system_prompt = system_prompt or BOOKING_PROMPT
    
    def _get_default_llm(self):
        """Get LLM from Ollama (local) - NOT OpenAI"""
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.2
        )
    
    async def invoke(self, message: str, user_id: str | None = None) -> str:
        """Process booking request"""
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=message)
        ]
        response = await self.llm.ainvoke(messages)
        return response.content
    
    async def check_slot(self, clinic_id: int, date: str) -> dict:
        """Check available slots - TODO: Call Spring Boot API"""
        return {"clinic_id": clinic_id, "date": date, "slots": ["09:00", "10:00", "14:00"]}
    
    async def create_booking(self, data: dict) -> dict:
        """Create booking - TODO: Call Spring Boot API"""
        return {"booking_id": 123, "status": "PENDING"}
