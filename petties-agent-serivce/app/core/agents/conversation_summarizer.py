"""
PETTIES AGENT SERVICE - Conversation Summarization Service

Summarizes long chat histories to save token budget while preserving key context.
Uses LLM to compress conversations while maintaining important entities and intents.

Package: app.core.agents
Version: v1.0.0

Usage:
    summarizer = ConversationSummarizer(llm_client)
    summary = await summarizer.summarize(conversation, max_turns=6)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from loguru import logger


@dataclass
class ConversationSummary:
    """Summary of a conversation after compression."""

    summary_text: str
    key_entities: Dict[str, Any] = field(default_factory=dict)
    unresolved_intents: List[str] = field(default_factory=list)
    original_turn_count: int = 0
    compressed_turn_count: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class SummarizationResult:
    """Result from LLM summarization call."""

    success: bool
    summary: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None
    intents: Optional[List[str]] = None
    error: Optional[str] = None


class LLMClientProtocol(Protocol):
    """Protocol for LLM client - allows easy mocking in tests."""

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float,
        max_tokens: int,
        images: Optional[List[str]] = None,
    ) -> Any: ...


class ConversationSummarizer:
    """
    Summarizes long conversations to save token budget.

    Strategy:
    1. Keep recent N turns fully intact (configurable, default 6)
    2. Summarize older turns into a brief context paragraph
    3. Preserve key entities (pet names, clinic names, dates)
    4. Track unresolved intents that need follow-up

    This prevents token overflow while maintaining conversation continuity.
    """

    DEFAULT_SYSTEM_PROMPT = """Bạn là trợ lý tóm tắt hội thoại của Petties.
Nhiệm vụ: Tóm tắt cuộc trò chuyện dài thành một đoạn văn ngắn gọn.

QUY TẮC:
- Giữ lại các thực thể quan trọng: tên thú cưng, tên phòng khám, ngày giờ, triệu chứng
- Ghi nhận các ý định chưa được giải quyết (ví dụ: booking chưa xác nhận, thông tin còn thiếu)
- Loại bỏ các câu chào, câu cảm ơn, và các chi tiết thừa
- Trả lời bằng tiếng Việt

OUTPUT FORMAT (JSON):
{
    "summary": "Đoạn tóm tắt 2-3 câu về nội dung chính",
    "entities": {
        "pet_name": "tên thú cưng nếu có",
        "clinic_name": "tên phòng khám nếu có",
        "symptoms": ["các triệu chứng được đề cập"],
        "dates": ["ngày giờ được đề cập"]
    },
    "unresolved_intents": ["ý định chưa hoàn thành, ví dụ: 'đặt lịch khám cho Miu vào thứ 7'"]
}"""

    DEFAULT_SUMMARIZE_PROMPT_TEMPLATE = """TÓM TẮT CUỘC TRÒ CHUYỆN SAU:

---
{conversation}
---

Hãy tóm tắt và trả về JSON theo format qui định."""

    def __init__(
        self,
        llm_client: Optional[LLMClientProtocol] = None,
        recent_turns_keep: int = 6,
        max_summary_chars: int = 800,
    ):
        """
        Initialize summarizer.

        Args:
            llm_client: LLM client for generation (optional for testing)
            recent_turns_keep: Number of recent turns to keep fully intact
            max_summary_chars: Maximum characters for summary
        """
        self.llm_client = llm_client
        self.recent_turns_keep = recent_turns_keep
        self.max_summary_chars = max_summary_chars

    def should_summarize(self, messages: List[Any]) -> bool:
        """
        Check if conversation needs summarization.

        Args:
            messages: List of conversation messages

        Returns:
            True if summarization recommended
        """
        if not messages:
            return False

        # Count meaningful exchanges (skip system messages)
        turns = [
            m
            for m in messages
            if isinstance(m, dict) and m.get("role") in ("user", "assistant")
        ]

        return len(turns) > self.recent_turns_keep * 2

    def _format_conversation_for_summary(
        self,
        messages: List[Any],
        recent_turns_keep: Optional[int] = None,
    ) -> str:
        """
        Format conversation for LLM summarization.

        Args:
            messages: List of conversation messages
            recent_turns_keep: Override recent turns to keep

        Returns:
            Formatted conversation string
        """
        keep = recent_turns_keep or self.recent_turns_keep

        # Separate old and recent messages
        all_turns = [
            m
            for m in messages
            if isinstance(m, dict) and m.get("role") in ("user", "assistant")
        ]

        if len(all_turns) <= keep:
            return self._format_turns(all_turns)

        old_turns = all_turns[:-keep]
        recent_turns = all_turns[-keep:]

        old_formatted = self._format_turns(old_turns)
        recent_formatted = self._format_turns(recent_turns)

        return f"""[LICH SU CU (can tom tat)]:
{old_formatted}

[CUOC TRO CHUYEN GAN DAY (giu nguyen)]:
{recent_formatted}"""

    def _format_turns(self, turns: List[Any]) -> str:
        """Format a list of turns into readable text."""
        lines: List[str] = []
        for msg in turns:
            if not isinstance(msg, dict):
                continue
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if not content:
                continue
            label = "Nguoi dung" if role == "user" else "Tro ly"
            lines.append(f"{label}: {content[:300]}")
        return "\n".join(lines) if lines else "(khong co)"

    async def summarize(
        self,
        messages: List[Any],
        recent_turns_keep: Optional[int] = None,
    ) -> ConversationSummary:
        """
        Summarize a conversation.

        Args:
            messages: List of conversation messages
            recent_turns_keep: Override number of recent turns to keep

        Returns:
            ConversationSummary with compressed content
        """
        if not messages:
            return ConversationSummary(
                summary_text="",
                original_turn_count=0,
                compressed_turn_count=0,
            )

        # Format conversation
        formatted = self._format_conversation_for_summary(messages, recent_turns_keep)

        all_turns = [
            m
            for m in messages
            if isinstance(m, dict) and m.get("role") in ("user", "assistant")
        ]
        original_count = len(all_turns)

        # If using LLM summarization
        if self.llm_client:
            try:
                result = await self._summarize_with_llm(formatted)
                if result.success:
                    keep = recent_turns_keep or self.recent_turns_keep
                    compressed_count = keep + 1  # 1 summary + recent turns

                    return ConversationSummary(
                        summary_text=result.summary or "",
                        key_entities=result.entities or {},
                        unresolved_intents=result.intents or [],
                        original_turn_count=original_count,
                        compressed_turn_count=compressed_count,
                    )
            except Exception as e:
                logger.warning(f"LLM summarization failed, using fallback: {e}")

        # Fallback: Simple truncation
        return self._simple_summarize(messages, recent_turns_keep)

    async def _summarize_with_llm(self, conversation: str) -> SummarizationResult:
        """
        Use LLM to summarize conversation.

        Args:
            conversation: Formatted conversation text

        Returns:
            SummarizationResult with parsed JSON
        """
        if not self.llm_client:
            return SummarizationResult(success=False, error="No LLM client")

        prompt = self.DEFAULT_SUMMARIZE_PROMPT_TEMPLATE.format(
            conversation=conversation
        )

        try:
            response = await self.llm_client.generate(
                prompt=prompt,
                system_prompt=self.DEFAULT_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=1000,
                images=None,
            )

            content = (
                response.content if hasattr(response, "content") else str(response)
            )

            # Extract JSON from response
            json_match = _extract_json(content)
            if json_match:
                data = json.loads(json_match)
                return SummarizationResult(
                    success=True,
                    summary=data.get("summary", ""),
                    entities=data.get("entities", {}),
                    intents=data.get("unresolved_intents", []),
                )

            return SummarizationResult(
                success=True,
                summary=content[: self.max_summary_chars],
            )

        except Exception as e:
            logger.error(f"LLM summarization error: {e}")
            return SummarizationResult(success=False, error=str(e))

    def _simple_summarize(
        self,
        messages: List[Any],
        recent_turns_keep: Optional[int] = None,
    ) -> ConversationSummary:
        """
        Simple fallback summarization without LLM.

        Extracts key entities and creates a basic summary.
        """
        keep = recent_turns_keep or self.recent_turns_keep

        all_turns = [
            m
            for m in messages
            if isinstance(m, dict) and m.get("role") in ("user", "assistant")
        ]

        # Extract entities from user messages
        entities: Dict[str, Any] = {}
        intents: List[str] = []

        for msg in all_turns:
            if not isinstance(msg, dict) or msg.get("role") != "user":
                continue
            content = msg.get("content", "")

            # Simple keyword extraction
            if any(word in content.lower() for word in ["mèo", "chó", "pet"]):
                # Try to find pet name pattern
                import re

                pet_match = re.search(
                    r"(?:thú cưng|pet|con)\s+(?:của tôi|tên là|named?)\s+(\w+)",
                    content,
                    re.IGNORECASE,
                )
                if pet_match:
                    entities["pet_name"] = pet_match.group(1)

        # Build summary from recent turns
        recent = all_turns[-keep:] if len(all_turns) > keep else all_turns
        summary_parts = []

        for msg in recent:
            if not isinstance(msg, dict):
                continue
            role = "User" if msg.get("role") == "user" else "Bot"
            content = msg.get("content", "")
            if content:
                summary_parts.append(f"{role}: {content[:150]}")

        summary_text = " | ".join(summary_parts) if summary_parts else ""

        return ConversationSummary(
            summary_text=summary_text[: self.max_summary_chars],
            key_entities=entities,
            unresolved_intents=intents,
            original_turn_count=len(all_turns),
            compressed_turn_count=keep,
        )

    def build_summarized_context(
        self,
        summary: ConversationSummary,
        recent_messages: Optional[List[Any]] = None,
    ) -> str:
        """
        Build final context string from summary.

        Args:
            summary: ConversationSummary from summarize()
            recent_messages: Optional recent messages to append

        Returns:
            Formatted context string for prompt
        """
        parts: List[str] = []

        # Add summary
        if summary.summary_text:
            parts.append(f"[TÓM TẮT HỘI THOẠI]: {summary.summary_text}")

        # Add key entities
        if summary.key_entities:
            entity_lines = []
            for key, value in summary.key_entities.items():
                if value:
                    entity_lines.append(f"- {key}: {value}")
            if entity_lines:
                parts.append("[THÔNG TIN ĐÃ XÁC ĐỊNH]:\n" + "\n".join(entity_lines))

        # Add unresolved intents
        if summary.unresolved_intents:
            parts.append("[CẦN THEO DÕI]: " + "; ".join(summary.unresolved_intents))

        # Append recent messages if provided
        if recent_messages:
            parts.append("\n[GẦN ĐÂY]:")
            for msg in recent_messages[-3:]:
                if isinstance(msg, dict):
                    role = "User" if msg.get("role") == "user" else "Bot"
                    content = msg.get("content", "")[:200]
                    if content:
                        parts.append(f"- {role}: {content}")

        return "\n".join(parts)


def _extract_json(text: str) -> Optional[str]:
    """Extract JSON object from text that may contain other content."""
    import re

    # Try to find JSON object
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return match.group(0)

    return None


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_summarizer: Optional[ConversationSummarizer] = None


def get_conversation_summarizer(
    llm_client: Optional[LLMClientProtocol] = None,
) -> ConversationSummarizer:
    """Get singleton summarizer instance."""
    global _summarizer
    if _summarizer is None:
        _summarizer = ConversationSummarizer(llm_client=llm_client)
    return _summarizer


def reset_summarizer() -> None:
    """Reset singleton (for testing)."""
    global _summarizer
    _summarizer = None
