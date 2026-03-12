"""
PETTIES AI SERVICE - Query Expander
Mở rộng query ngắn gọn thành câu hỏi đầy đủ hơn trước khi search RAG.

Package: app.core.rag
Purpose: Cải thiện RAG recall bằng cách mở rộng query ngắn với từ đồng nghĩa,
         thuật ngữ y khoa, và ngữ cảnh loài thú cưng thông qua LLM rewrite.
Version: v1.0.1
"""

import asyncio
from typing import Optional

from loguru import logger

# ============================================================
# CONSTANTS
# ============================================================

MIN_WORD_THRESHOLD = 5
"""Queries có ít hơn ngưỡng này sẽ được mở rộng."""

MAX_EXPANSION_TOKENS = 150
"""Số tokens tối đa cho phản hồi mở rộng từ LLM."""

EXPANSION_TEMPERATURE = 0.3
"""Temperature thấp để mở rộng chính xác, ít sáng tạo."""

EXPANSION_SYSTEM_PROMPT = (
    "Bạn là chuyên gia thú y Việt Nam. Nhiệm vụ của bạn là mở rộng "
    "query tìm kiếm thành câu hỏi đầy đủ hơn để cải thiện kết quả "
    "tra cứu tài liệu thú y. Chỉ trả về query đã mở rộng, không giải giải thích."
)

EXPANSION_PROMPT_TEMPLATE = """Mở rộng query tìm kiếm thú y sau thành đầy đủ hơn.
Thêm từ đồng nghĩa thú y, thuật ngữ chuyên môn, triệu chứng liên quan.
Chỉ trả về query đã mở rộng (1-2 câu), KHÔNG giải thích.

Query gốc: {query}
Loại thú cưng: {pet_type}

Query mở rộng:"""


# ============================================================
# QUERY EXPANDER
# ============================================================


class QueryExpander:
    """
    Mở rộng query thú y ngắn bằng LLM rewrite trước khi tìm kiếm RAG.

    Chiến lược:
        - Query < MIN_WORD_THRESHOLD từ -> mở rộng qua LLM
        - Query >= ngưỡng -> trả về nguyên gốc (đã đủ cụ thể)
        - Khi LLM thất bại -> fallback về query gốc
    """

    def __init__(
        self,
        min_word_threshold: int = MIN_WORD_THRESHOLD,
        max_tokens: int = MAX_EXPANSION_TOKENS,
        temperature: float = EXPANSION_TEMPERATURE,
    ):
        self._min_word_threshold = min_word_threshold
        self._max_tokens = max_tokens
        self._temperature = temperature
        self._llm_client = None
        self._lock = asyncio.Lock()

    # ----------------------------------------------------------
    # Public API
    # ----------------------------------------------------------

    async def expand_query(
        self,
        query: str,
        pet_type: Optional[str] = None,
    ) -> str:
        """
        Mở rộng query ngắn thành query tìm kiếm phong phú hơn.

        Args:
            query: Query gốc từ người dùng (có thể rất ngắn).
            pet_type: Gợi ý loài ("chó", "mèo", "dog", "cat").

        Returns:
            Query đã mở rộng. Nếu thất bại, trả về query gốc.
        """
        query = query.strip()
        if not query:
            return query

        if not self._is_short_query(query):
            logger.debug(
                f"Query is long enough ({len(query.split())} words), skipping expansion"
            )
            return query

        logger.info(
            f"Expanding short query ({len(query.split())} words): '{query[:80]}...'"
        )

        try:
            expanded = await self._call_llm(query, pet_type)
            # Prepend original query to ensure original terms are always present
            if expanded:
                result = f"{query} {expanded}".strip()
                logger.info(f"Expanded query: '{result[:120]}...'")
                return result
            return query
        except Exception as e:
            logger.warning(f"Query expansion failed, using original: {e}")
            return query

    # ----------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------

    def _is_short_query(self, query: str) -> bool:
        """Kiểm tra query có ít hơn ngưỡng số từ không."""
        word_count = len(query.split())
        return word_count < self._min_word_threshold

    def _build_expansion_prompt(self, query: str, pet_type: Optional[str]) -> str:
        """Tạo prompt cho LLM để mở rộng query."""
        return EXPANSION_PROMPT_TEMPLATE.format(
            query=query,
            pet_type=pet_type or "không rõ",
        )

    async def _get_client(self):
        """Lazy init of LLM client."""
        if self._llm_client is not None:
            return self._llm_client
            
        async with self._lock:
            if self._llm_client is not None:
                return self._llm_client
            
            from app.services.llm_client import create_llm_client
            self._llm_client = create_llm_client()
            return self._llm_client

    async def _call_llm(self, query: str, pet_type: Optional[str]) -> str:
        """Calls LLM for query expansion."""
        client = await self._get_client()
        prompt = self._build_expansion_prompt(query, pet_type)
        response = await client.generate(
            prompt=prompt,
            system_prompt=EXPANSION_SYSTEM_PROMPT,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
        )
        expanded = response.content.strip()
        # Safety: if LLM returns empty or just repeats the original, skip
        if not expanded or expanded.lower() == query.lower():
            return ""
        return expanded


# ============================================================
# SINGLETON
# ============================================================

_query_expander: Optional[QueryExpander] = None


def get_query_expander() -> QueryExpander:
    """Get singleton QueryExpander instance."""
    global _query_expander
    if _query_expander is None:
        _query_expander = QueryExpander()
    return _query_expander


def reset_query_expander() -> None:
    """Reset singleton (for testing)."""
    global _query_expander
    _query_expander = None


__all__ = [
    "QueryExpander",
    "get_query_expander",
    "reset_query_expander",
    "MIN_WORD_THRESHOLD",
]
