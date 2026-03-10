"""
PETTIES AGENT SERVICE - Text Utility Functions

Pure stateless utility functions for text extraction and analysis.
Extracted from SingleAgent to reduce class complexity.

Package: app.core.agents
Version: v2.0.0 (Removed keyword constants — LLM handles all classification)
"""

from typing import List, Optional, Any


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


def infer_pet_type(user_message: str) -> str:
    """Infer pet type from user message; defaults to 'dog'."""
    normalized = (user_message or "").lower()
    if any(kw in normalized for kw in ["mèo", "meo", "cat", "kitten"]):
        return "cat"
    return "dog"


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
