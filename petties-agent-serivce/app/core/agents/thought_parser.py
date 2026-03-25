"""
PETTIES AGENT SERVICE - LLM Thought Parser

Parse LLM output to extract Tool name, Tool Input (params), and Final Answer.
Stateless module — all functions are pure.

Package: app.core.agents
Version: v1.1.0 (Extracted from single_agent.py)
"""

from typing import Dict, Any, List
from loguru import logger
import json
import re


def _try_parse_json_object(raw: str) -> Dict[str, Any]:
    """Best-effort parse for LLM-produced JSON objects."""
    if raw is None:
        return {}
    s = str(raw).strip()
    if not s:
        return {}

    # Remove code fences if present.
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE).strip()
    s = re.sub(r"\s*```$", "", s).strip()

    # First try strict JSON.
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        pass

    # Common LLM mistakes: trailing commas.
    s2 = re.sub(r",\s*}", "}", s)
    s2 = re.sub(r",\s*]", "]", s2)
    try:
        obj = json.loads(s2)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def parse_thought(thought_content: str, enabled_tools: List[str]) -> Dict[str, Any]:
    """Parse LLM thought output to extract tool call or final answer.

    Supports Markdown formatting (e.g. **Tool:**) and flexible whitespace.

    Args:
        thought_content: Raw text from LLM.
        enabled_tools: List of valid tool names to validate against.

    Returns:
        Dict with keys: thought, tool_name, tool_params, should_end.
    """
    if not thought_content:
        return {"thought": "", "should_end": True}

    # --- 1. Extract Tool name ---
    tool_name = None
    tool_match = re.search(
        r"(?:\*+|#|)\s*(?:Tool|Action)\s*(?:\*+|#|):\s*([\w_]+)",
        thought_content,
        re.IGNORECASE,
    )
    if tool_match:
        extracted_name = tool_match.group(1).strip()
        if extracted_name.upper() in [t.upper() for t in enabled_tools]:
            tool_name = extracted_name
        else:
            logger.warning(
                f"Extracted tool name '{extracted_name}' not in enabled_tools "
                f"{enabled_tools}, ignoring"
            )

    # --- 2. Extract Tool Input (JSON params) ---
    tool_params: Dict[str, Any] = {}

    # Pattern 0: Tool Input in fenced code block
    input_match = re.search(
        r"(?:Tool Input|Action Input|Input)\s*(?:\*+|#|)?:\s*```(?:json)?\s*([\s\S]*?)\s*```",
        thought_content,
        re.IGNORECASE,
    )

    # Pattern 1: Standard — Tool Input: {...}
    if not input_match:
        input_match = re.search(
            r"(?:\*+|#|)\s*(?:Tool Input|Action Input|Input)\s*(?:\*+|#|):\s*(\{.*?\})",
            thought_content,
            re.DOTALL | re.IGNORECASE,
        )

    # Pattern 2: JSON on new line after label
    if not input_match:
        input_match = re.search(
            r"(?:Tool Input|Action Input|Input)\s*(?:\*+|#|)?:\s*\n\s*(\{.*?\})",
            thought_content,
            re.DOTALL | re.IGNORECASE,
        )

    # Pattern 3: Fallback — any JSON object (only when tool_name found)
    if not input_match and tool_name:
        json_objects = re.findall(r"(\{[^{}]*\})", thought_content)
        for json_str in reversed(json_objects):
            try:
                potential = json.loads(json_str)
                if isinstance(potential, dict) and len(potential) > 0:
                    tool_params = potential
                    logger.info(f"Extracted params from fallback JSON: {tool_params}")
                    break
            except (json.JSONDecodeError, ValueError):
                continue

    # Parse matched pattern
    if input_match:
        raw_params = input_match.group(1).strip()
        tool_params = _try_parse_json_object(raw_params)
        # "{}" is valid for tools that rely on runtime context injection (e.g. get_user_pets),
        # so only warn when it looks like the LLM attempted JSON but we couldn't parse it.
        if not tool_params and raw_params.strip() not in ("{}", "{ }"):
            logger.warning("Failed to parse tool params JSON: invalid or empty object")
            inner = re.search(r"(\{[\s\S]*\})", raw_params)
            if inner:
                tool_params = _try_parse_json_object(inner.group(1))

    # Normalize keys (strip whitespace — LLM sometimes outputs { "query ": "..." })
    if tool_params and isinstance(tool_params, dict):
        tool_params = {k.strip(): v for k, v in tool_params.items()}
        logger.debug(f"Normalized tool params: {tool_params}")

    # --- 3. Clean thought content ---
    clean_thought = thought_content
    if tool_name:
        parts = re.split(
            r"(?:\*+|#|)\s*(?:Tool|Action)\s*(?:\*+|#|):",
            thought_content,
            flags=re.IGNORECASE,
        )
        if parts:
            clean_thought = parts[0].strip()

    # Always remove "Thought:" prefix from user-facing text (safety guard).
    clean_thought = re.sub(
        r"^(?:\*+|#|)\s*Thought\s*(?:\*+|#|):\s*",
        "",
        clean_thought,
        flags=re.IGNORECASE,
    ).strip()

    # --- 4. Determine should_end ---
    should_end = False
    if "Final Answer:" in thought_content or "final answer:" in thought_content.lower():
        should_end = True
        fa_parts = re.split(r"Final Answer:", thought_content, flags=re.IGNORECASE)
        if len(fa_parts) > 1:
            clean_thought = fa_parts[1].strip()
    elif not tool_name:
        should_end = True

    return {
        "thought": clean_thought or thought_content,
        "tool_name": tool_name,
        "tool_params": tool_params,
        "should_end": should_end,
    }
