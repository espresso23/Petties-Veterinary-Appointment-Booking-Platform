"""
Pre-LLM enrichment strategy helpers.

This module remains intentionally small:
- decide when knowledge search should fall back to web search
- auto-finalize only on tool errors or when no LLM client exists
"""

from typing import Any, Dict, List, Optional, Set

from app.core.agents.text_utils import extract_latest_user_message


def should_use_web_fallback(
    tool_name: str,
    data: Dict[str, Any],
    enabled_tools_lower: Set[str],
) -> bool:
    """Fallback from KB to web search only when KB returned no usable sources."""
    if "web_search" not in enabled_tools_lower:
        return False
    if tool_name == "pet_knowledge_search":
        return int(data.get("sources_used", 0) or 0) == 0
    return False


def build_web_search_fallback_call(
    last_action: Optional[Dict[str, Any]],
    tool_result: Any,
    react_steps: List[Dict[str, Any]],
    messages: List[Any],
    enabled_tools_lower: Set[str],
) -> Optional[Dict[str, Any]]:
    """Auto-chain web_search when KB search returned no sources."""
    if not last_action or not isinstance(tool_result, dict):
        return None

    normalized_tool = str(last_action.get("tool_name") or "").strip().lower()
    if normalized_tool != "pet_knowledge_search":
        return None

    if any(
        step.get("step_type") == "action"
        and str(step.get("tool_name") or "").strip().lower() == "web_search"
        for step in react_steps
    ):
        return None

    if not should_use_web_fallback(
        normalized_tool,
        tool_result.get("data") or {},
        enabled_tools_lower,
    ):
        return None

    user_message = extract_latest_user_message(messages)
    if not user_message:
        return None

    return {
        "name": "web_search",
        "arguments": {"query": user_message, "max_results": 5},
    }


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
    - If a tool returns an error, surface the error immediately.
    - If there is no LLM client (test mode), build a simple deterministic fallback.
    - Otherwise let the LLM continue the ReAct loop.
    """
    _ = react_steps
    _ = messages

    if not tool_name or not isinstance(tool_result, dict):
        return None

    normalized_tool = tool_name.strip().lower()
    data = tool_result.get("data") if isinstance(tool_result.get("data"), dict) else {}

    if tool_result.get("success") is False:
        error_message = tool_result.get("error")
        if error_message:
            return f"Toi chua the hoan tat tra cuu do loi cong cu: {error_message}"
        return None

    if llm_client is None:
        return _build_fallback_answer(
            normalized_tool,
            data,
            enabled_tools_lower,
        )

    return None


def _build_fallback_answer(
    tool_name: str,
    data: Dict[str, Any],
    enabled_tools_lower: Set[str],
) -> Optional[str]:
    """Simple summaries for test mode only."""
    if tool_name == "pet_knowledge_search":
        if should_use_web_fallback(tool_name, data, enabled_tools_lower):
            return None

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
