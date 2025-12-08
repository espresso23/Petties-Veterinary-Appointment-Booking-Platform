"""
PETTIES AGENT SERVICE - Research Agent

Web Researcher chuyên tìm kiếm thông tin trên Internet (general-purpose).
Tìm bất cứ thứ gì người dùng cần khi được Main Agent giao phó.
"""

from typing import Optional
from langchain_core.messages import HumanMessage, SystemMessage
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


RESEARCH_PROMPT = """You are the Research Agent for Petties veterinary platform.

Vai trò: Web Researcher chuyên tìm kiếm thông tin Internet (general-purpose).

Nhiệm vụ:
- Tìm bất cứ thứ gì người dùng cần trên web khi được Main Agent giao phó
- Phục vụ Main Agent: Tìm sản phẩm, thông tin, tin tức, mẹo vặt
- Phục vụ Medical Agent: Tìm bệnh lạ, bài viết y khoa, video hướng dẫn, home remedies

Use cases:
1. Tìm sản phẩm (thuốc, thức ăn) trên web
2. Tìm bài viết y khoa, tài liệu tham khảo uy tín
3. Tìm mẹo chăm sóc, kinh nghiệm từ chuyên gia
4. Tìm video hướng dẫn trên YouTube
5. Tìm thông tin chung, tin tức liên quan

Nguyên tắc:
- BẮT BUỘC trích dẫn nguồn (URL) cho mọi thông tin tìm được
- Ưu tiên nguồn uy tín và đáng tin cậy
- Cung cấp link trực tiếp để người dùng có thể kiểm chứng
- Phân biệt rõ ràng giữa thông tin và nguồn trích dẫn

Respond in Vietnamese.
"""


class ResearchAgent:
    """Research Sub-Agent - Web search general-purpose"""
    
    def __init__(self, llm=None, system_prompt: Optional[str] = None):
        self.llm = llm or self._get_default_llm()
        # Prompt từ DB (via AgentFactory) hoặc fallback to hardcoded
        self.system_prompt = system_prompt or RESEARCH_PROMPT
    
    def _get_default_llm(self):
        """Get LLM from Ollama (local) - NOT OpenAI"""
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.3
        )
    
    async def invoke(self, message: str, user_id: str | None = None) -> str:
        """Process research/search request"""
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=message)
        ]
        response = await self.llm.ainvoke(messages)
        return response.content

