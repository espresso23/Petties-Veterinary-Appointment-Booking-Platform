"""
PETTIES AGENT SERVICE - Pre-LLM Enrichment Strategy

Decides when to auto-chain web search fallback and when to
auto-finalize answers from tool results.

Package: app.core.agents
Version: v3.0.0 (Pure data retrieval — removed symptom classification logic)
"""

from typing import Dict, Any, List, Optional, Set
from loguru import logger

from app.core.agents.text_utils import (
    extract_latest_user_message,
    get_latest_successful_tool_data,
)


# ===== WEB FALLBACK LOGIC =====


def should_use_web_fallback(
    tool_name: str,
    data: Dict[str, Any],
    enabled_tools_lower: Set[str],
) -> bool:
    """Decide whether to fallback from KB to web search.

    Args:
        tool_name: Lowercase name of the tool that just ran.
        data: The 'data' dict from the tool result.
        enabled_tools_lower: Pre-computed lowercase set of enabled tool names.
    """
    if "web_search" not in enabled_tools_lower:
        return False

    if tool_name == "pet_knowledge_search":
        sources_used = data.get("sources_used", 0)
        return sources_used == 0

    return False


# ===== WEB SEARCH FALLBACK =====


def build_web_search_fallback_call(
    last_action: Optional[Dict[str, Any]],
    tool_result: Any,
    react_steps: List[Dict[str, Any]],
    messages: List[Any],
    enabled_tools_lower: Set[str],
) -> Optional[Dict[str, Any]]:
    """Auto-chain web_search when KB tool returns insufficient results.

    Returns a tool call dict or None.
    """
    if not last_action or not isinstance(tool_result, dict):
        return None

    normalized_tool = str(last_action.get("tool_name") or "").strip().lower()
    if normalized_tool != "pet_knowledge_search":
        return None

    # Don't fallback if web_search already ran
    if any(
        step.get("step_type") == "action"
        and str(step.get("tool_name") or "").strip().lower() == "web_search"
        for step in react_steps
    ):
        return None

    if not should_use_web_fallback(
        normalized_tool, tool_result.get("data") or {}, enabled_tools_lower
    ):
        return None

    user_message = extract_latest_user_message(messages)
    if not user_message:
        return None

    return {
        "name": "web_search",
        "arguments": {"query": user_message, "max_results": 5},
    }


# ===== AUTO-FINALIZE FROM TOOL RESULT =====


def build_final_answer_from_tool_result(
    tool_name: Optional[str],
    tool_result: Any,
    react_steps: Optional[List[Dict[str, Any]]],
    messages: Optional[List[Any]],
    llm_client: Any,
    enabled_tools_lower: Set[str],
) -> Optional[str]:
    """Produce a final answer directly from tool results when appropriate.

    Only auto-finalizes when:
    - Tool returned an error
    - No LLM client available (test mode)

    Otherwise returns None so the LLM can synthesize the answer.
    """
    if not tool_name or not isinstance(tool_result, dict):
        return None

    # Case 1: Tool error
    if tool_result.get("success") is False:
        error_message = tool_result.get("error")
        if error_message:
            return f"Tôi chưa thể hoàn tất tra cứu do lỗi công cụ: {error_message}"
        return None

    # Case 2: No LLM client (test mode)
    if llm_client is None:
        return _build_fallback_answer(
            tool_name,
            tool_result,
            react_steps or [],
            messages or [],
            enabled_tools_lower,
        )

    # Case 3: LLM available — let it synthesize
    return None


def _build_fallback_answer(
    tool_name: str,
    tool_result: Dict[str, Any],
    react_steps: List[Dict[str, Any]],
    messages: List[Any],
    enabled_tools_lower: Set[str],
) -> Optional[str]:
    """Fallback answer when no LLM is available (test mode)."""
    data = tool_result.get("data")
    if not isinstance(data, dict):
        return None

    normalized_tool = tool_name.strip().lower()

    if normalized_tool == "pet_knowledge_search":
        if should_use_web_fallback(normalized_tool, data, enabled_tools_lower):
            return None

        # Pure data retrieval: summarize KB results for fallback (no LLM)
        results = data.get("results", [])
        if not results:
            return None

        parts: List[str] = []
        for r in results[:3]:
            if isinstance(r, dict):
                content = str(r.get("content", "")).strip()
                if content:
                    parts.append(f"- {content[:300]}")

        return "\n".join(parts) if parts else None

    if normalized_tool == "web_search":
        # Pure data retrieval: summarize web results for fallback (no LLM)
        sources_used = int(data.get("sources_used", 0) or 0)
        web_results = data.get("results", [])
        parts_ws: List[str] = []

        # Include KB content from earlier pet_knowledge_search step
        kb_data = get_latest_successful_tool_data(react_steps, "pet_knowledge_search")
        if kb_data:
            kb_results = kb_data.get("results", [])
            if kb_results and isinstance(kb_results, list):
                kb_snippets = []
                for r in kb_results[:2]:
                    if isinstance(r, dict):
                        content = str(r.get("content", "")).strip()
                        if content:
                            kb_snippets.append(f"- {content[:200]}")
                if kb_snippets:
                    parts_ws.append("Theo knowledge base:\n" + "\n".join(kb_snippets))

        # Format web results (same pattern as KB results)
        if isinstance(web_results, list) and web_results:
            web_lines = []
            for r in web_results[:3]:
                if isinstance(r, dict):
                    title = str(r.get("title", "")).strip()
                    snippet = str(r.get("snippet", "")).strip()
                    if title or snippet:
                        label = (
                            f"{title}: {snippet}"
                            if title and snippet
                            else title or snippet
                        )
                        web_lines.append(f"- {label[:300]}")
            if web_lines:
                parts_ws.append("Từ web:\n" + "\n".join(web_lines))

        if not parts_ws and sources_used == 0:
            return None

        return "\n\n".join(p for p in parts_ws if p) if parts_ws else None

    return None
