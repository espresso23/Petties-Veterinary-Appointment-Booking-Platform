"""
PETTIES AGENT SERVICE - Text Utility Functions

Pure stateless utility functions for text extraction and analysis.
Extracted from SingleAgent to reduce class complexity.

Package: app.core.agents
Version: v2.0.0 (Removed keyword constants — LLM handles all classification)
"""

from typing import List, Optional, Any, Dict
import re
import unicodedata


def extract_latest_user_message(messages: List[Any]) -> str:
    """Extract the latest user message from a list of messages."""
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "user":
            return str(msg.get("content", "")).strip()
        if hasattr(msg, "role") and getattr(msg, "role", None) == "user":
            return str(getattr(msg, "content", "")).strip()
        if isinstance(msg, str):
            return msg.strip()
    return ""


def extract_all_user_messages(messages: List[Any]) -> List[str]:
    """Extract all user messages from a list of messages."""
    user_messages: List[str] = []
    for msg in messages:
        if isinstance(msg, dict) and msg.get("role") == "user":
            content = str(msg.get("content", "")).strip()
            if content:
                user_messages.append(content)
            continue
        if hasattr(msg, "role") and getattr(msg, "role", None) == "user":
            content = str(getattr(msg, "content", "")).strip()
            if content:
                user_messages.append(content)
            continue
        if isinstance(msg, str) and msg.strip():
            user_messages.append(msg.strip())
    return user_messages


def build_recent_dialogue(messages: List[Any], limit: int = 10) -> str:
    """Build a short conversation transcript for prompt grounding."""
    if not messages:
        return ""

    lines: List[str] = []
    for msg in messages[-max(1, limit) :]:
        if isinstance(msg, dict):
            role = str(msg.get("role") or "").strip().lower()
            content = str(msg.get("content") or "").strip()
        else:
            role = str(getattr(msg, "role", "") or "").strip().lower()
            content = str(getattr(msg, "content", "") or "").strip()

        if not content:
            continue

        if role == "assistant":
            label = "Trợ lý"
        elif role == "user":
            label = "Người dùng"
        else:
            label = role or "Khác"

        compact = re.sub(r"\s+", " ", content).strip()
        lines.append(f"- {label}: {compact}")

    return "\n".join(lines)


def get_latest_successful_tool_data(
    react_steps: List[dict],
    tool_name: str,
) -> Optional[dict]:
    """Get the data from the most recent successful execution of a specific tool."""
    for step in reversed(react_steps):
        if step.get("step_type") != "action":
            continue
        if str(step.get("tool_name") or "").strip().lower() != tool_name:
            continue
        tool_result = step.get("tool_result")
        if not isinstance(tool_result, dict):
            continue
        if tool_result.get("success") is False:
            continue
        data = tool_result.get("data")
        if isinstance(data, dict):
            return data
    return None


def normalize_vietnamese_text(value: str) -> str:
    """Normalize Vietnamese text for tolerant entity matching."""
    s = (value or "").strip().lower()
    s = s.replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def resolve_pet_from_messages(
    messages: List[Any],
    pets: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Find the most likely pet mentioned anywhere in user chat history."""
    if not pets:
        return None

    user_messages = extract_all_user_messages(messages)
    if not user_messages:
        return None

    normalized_history = [
        normalize_vietnamese_text(msg) for msg in user_messages if str(msg).strip()
    ]
    normalized_history.reverse()

    candidates = []
    for pet in pets:
        if not isinstance(pet, dict):
            continue
        name = str(pet.get("name") or "").strip()
        if not name:
            continue
        normalized_name = normalize_vietnamese_text(name)
        if not normalized_name:
            continue
        candidates.append((pet, normalized_name))

    for message in normalized_history:
        matches = [
            pet
            for pet, normalized_name in sorted(
                candidates,
                key=lambda item: len(item[1]),
                reverse=True,
            )
            if normalized_name in message
        ]
        if matches:
            return matches[0]

    return None
