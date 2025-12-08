"""
PETTIES AGENT SERVICE - Medical Agent

Handles symptom analysis, medical advice, and disease lookup.
Uses RAG for veterinary knowledge retrieval.
"""

from typing import Optional
from langchain_core.messages import HumanMessage, SystemMessage
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


MEDICAL_PROMPT = """You are the Medical Agent for Petties veterinary platform.

Capabilities:
1. Analyze pet symptoms
2. Provide preliminary diagnosis
3. Access veterinary knowledge base (RAG)
4. Recommend when to visit a vet

IMPORTANT:
- Clarify pet type, age, weight before diagnosis
- Never provide definitive diagnosis - recommend vet visit
- Respond in Vietnamese
"""


class MedicalAgent:
    """Medical Sub-Agent - Symptom analysis with RAG"""
    
    def __init__(self, llm=None, rag_engine=None, system_prompt: Optional[str] = None):
        self.llm = llm or self._get_default_llm()
        self.rag_engine = rag_engine
        # Prompt từ DB (via AgentFactory) hoặc fallback to hardcoded
        self.system_prompt = system_prompt or MEDICAL_PROMPT
    
    def _get_default_llm(self):
        """Get LLM from Ollama (local) - NOT OpenAI"""
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.3
        )
    
    async def invoke(self, message: str, user_id: str | None = None) -> str:
        """Process medical query with optional RAG context"""
        context = ""
        
        # Try RAG retrieval
        if self.rag_engine:
            try:
                docs = await self.rag_engine.query(message, top_k=3)
                if docs:
                    context = "\n".join([d.content for d in docs[:3]])
            except Exception as e:
                logger.warning(f"RAG retrieval failed: {e}")
        
        prompt = self.system_prompt
        if context:
            prompt += f"\n\nContext:\n{context}"
        
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=message)
        ]
        response = await self.llm.ainvoke(messages)
        return response.content
