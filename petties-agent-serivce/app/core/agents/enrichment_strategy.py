"""
Pre-LLM enrichment strategy helpers.

Policy (updated per PLAN.md):
- NO auto web_search fallback after KB empty. LLM decides the next step.
- Auto-finalize only when tool returns an error (surface error) or no LLM client (test mode).
- All tool chaining and fallback decisions are LLM-driven, not rule-driven.
"""

from typing import Any, Dict, List, Optional, Set


def build_final_answer_from_tool_result(
    tool_name: Optional[str],
    tool_result: Any,
    react_steps: Optional[List[Dict[str, Any]]],
    messages: Optional[List[Any]],
    llm_client: Any,
    enabled_tools_lower: Set[str],
) -> Optional[str]:
    """
    Produce a final answer directly from tool results only when it is safe.

    Policy:
    - If a tool returns an error, surface the error immediately (fail-closed).
    - If there is no LLM client (test mode), build a simple deterministic fallback.
    - Otherwise let the LLM continue the ReAct loop.
    """
    _ = react_steps
    _ = messages

    if not tool_name or not isinstance(tool_result, dict):
        return None

    data = tool_result.get("data") if isinstance(tool_result.get("data"), dict) else {}

    if tool_result.get("success") is False:
        error_message = tool_result.get("error")
        if error_message:
            return f"Tôi chưa thể hoàn tất tra cứu do lỗi công cụ: {error_message}"
        return None

    if llm_client is None:
        return _build_fallback_answer(
            tool_name.strip().lower(),
            data,
        )

    return None


def _build_fallback_answer(
    tool_name: str,
    data: Dict[str, Any],
) -> Optional[str]:
    """Simple summaries for test/no-LLM mode only. No web_search chaining."""
    if tool_name == "pet_knowledge_search":
        results = data.get("results", [])
        parts: List[str] = []
        for item in results[:3]:
            if not isinstance(item, dict):
                continue
            content = str(item.get("content") or "").strip()
            if content:
                parts.append(f"- {content[:300]}")
        return "\n".join(parts) if parts else None

    if tool_name == "web_search":
        results = data.get("results", [])
        parts: List[str] = []
        for item in results[:3]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            snippet = str(item.get("snippet") or item.get("content") or "").strip()
            if title and snippet:
                parts.append(f"- {title}: {snippet[:240]}")
            elif title:
                parts.append(f"- {title}")
            elif snippet:
                parts.append(f"- {snippet[:240]}")
        return "\n".join(parts) if parts else None

    return None
