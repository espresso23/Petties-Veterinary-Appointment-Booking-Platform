"""
PETTIES AGENT SERVICE - Response Formatter

Keep tool observations neutral so the LLM can decide the final wording.
"""

from __future__ import annotations

from typing import Any, Dict
import json


_MAX_TEXT_LEN = 240
_MAX_JSON_LEN = 3200
_MAX_ITEMS = 8


def _truncate_text(value: str, max_len: int = _MAX_TEXT_LEN) -> str:
    text = (value or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def _compact_value(value: Any, *, depth: int = 0) -> Any:
    if value is None or isinstance(value, (int, float, bool)):
        return value

    if isinstance(value, str):
        return _truncate_text(value)

    if isinstance(value, list):
        items = [_compact_value(item, depth=depth + 1) for item in value[:_MAX_ITEMS]]
        if len(value) > _MAX_ITEMS:
            items.append(f"... {len(value) - _MAX_ITEMS} more")
        return items

    if isinstance(value, dict):
        max_items = _MAX_ITEMS if depth == 0 else 5
        compacted: Dict[str, Any] = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= max_items:
                compacted["..."] = f"{len(value) - max_items} more fields"
                break
            compacted[str(key)] = _compact_value(item, depth=depth + 1)
        return compacted

    return _truncate_text(str(value))


def format_tool_observation(data: Dict[str, Any]) -> str:
    """
    Convert tool data into a compact neutral observation for the LLM.

    The formatter intentionally avoids domain-specific headings or response wording.
    """
    if not isinstance(data, dict):
        return _truncate_text(str(data))

    compacted = _compact_value(data)
    serialized = json.dumps(compacted, ensure_ascii=False, separators=(",", ":"))
    if len(serialized) <= _MAX_JSON_LEN:
        return serialized
    return serialized[: _MAX_JSON_LEN - 3].rstrip() + "..."
