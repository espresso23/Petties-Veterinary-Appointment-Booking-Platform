"""
PETTIES AGENT SERVICE - Thinking Formatter

Convert ReAct steps to natural thinking stream for user display.
Removes labels like "Thought:", "Action:", "Observation:"
and presents as human-readable reasoning flow.

Package: app.core.agents
Version: v1.0.0
"""

from __future__ import annotations

import re
from typing import Any, Dict, List


# Tool name to Vietnamese readable name
TOOL_READABLE_NAMES: Dict[str, str] = {
    "pet_knowledge_search": "tra cứu kiến thức thú y",
    "pet_care_qa": "tìm hiểu về chăm sóc thú cưng",
    "search_clinics_nearby": "tìm phòng khám gần bạn",
    "get_clinic_services": "lấy thông tin dịch vụ phòng khám",
    "check_available_slots": "kiểm tra lịch trống",
    "create_booking_for_user": "tạo đặt lịch hẹn",
    "get_user_pets": "lấy danh sách thú cưng",
    "web_search": "tìm kiếm thông tin trên web",
    "get_staff_patients": "xem danh sách bệnh nhân",
    "get_patient_summary": "xem tóm tắt bệnh án",
    "symptom_search": "tra cứu triệu chứng bệnh",
    "get_emr_history": "lấy lịch sử bệnh án",
    "analyze_symptom_image": "phân tích hình ảnh triệu chứng",
}


def get_tool_readable_name(tool_name: str) -> str:
    """Convert tool name to Vietnamese readable text."""
    return TOOL_READABLE_NAMES.get(tool_name, f"sử dụng tool {tool_name}")


def _with_reasoning_prefix(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned:
        return "Đang suy luận: mình đang phân tích yêu cầu của bạn."
    lowered = cleaned.lower()
    if lowered.startswith("đang suy luận:"):
        return cleaned
    return f"Đang suy luận: {cleaned}"


def clean_thought(text: str) -> str:
    """
    Clean thought text - remove prefixes and normalize.

    Args:
        text: Raw thought content from ReAct

    Returns:
        Cleaned, user-friendly thought text
    """
    if not text:
        return "mình đang phân tích yêu cầu của bạn."

    text = text.strip()

    # Remove common prefixes
    prefixes_to_remove = [
        r"^thought\s*:\s*",
        r"^suy\s+nghi\s*:\s*",
        r"^thinking\s*:\s*",
        r"^tôi\s+",
    ]

    for prefix in prefixes_to_remove:
        text = re.sub(prefix, "", text, flags=re.IGNORECASE).strip()

    # Keep only first paragraph
    text = text.split("\n")[0].strip()

    # Remove any accidental tool markers
    text = re.split(r"\btool\s*:\b", text, maxsplit=1, flags=re.IGNORECASE)[0]
    text = re.split(r"\baction\s*:\b", text, maxsplit=1, flags=re.IGNORECASE)[0]

    # Truncate if too long
    max_length = 300
    if len(text) > max_length:
        text = text[:max_length].rstrip() + "..."

    if not text:
        return "mình đang phân tích yêu cầu của bạn."

    first_char = text[:1]
    if first_char and first_char.isalpha():
        text = first_char.lower() + text[1:]

    if not re.match(r"^(mình|toi|tôi|co ve|người dùng|user)\b", text, re.IGNORECASE):
        text = f"mình thấy {text}"

    return text if text else "mình đang phân tích yêu cầu của bạn."


def format_tool_call(tool_name: str, params: Dict[str, Any]) -> str:
    """
    Format tool call as natural Vietnamese text.

    Args:
        tool_name: Name of the tool
        params: Tool parameters

    Returns:
        Human-readable tool call description
    """
    tool_readable = get_tool_readable_name(tool_name)

    # Extract key params for context
    key_info = []

    if "query" in params:
        key_info.append(f'"{params["query"]}"')
    if "symptoms" in params:
        syms = params["symptoms"]
        if isinstance(syms, list):
            key_info.append(", ".join(syms[:2]))
        else:
            key_info.append(str(syms)[:50])
    if "pet_type" in params:
        key_info.append(f"loài {params['pet_type']}")
    if "location" in params:
        loc = params["location"]
        if isinstance(loc, dict):
            key_info.append(f"tại {loc.get('address', 'vị trí gần đó')}")

    context = f" với {', '.join(key_info)}" if key_info else ""

    return (
        f"mình thấy cần thêm dữ liệu nên sẽ {tool_readable}{context} "
        "rồi tổng hợp lại đúng ý bạn hỏi."
    )


def summarize_observation(observation: str, max_length: int = 150) -> str:
    """
    Summarize observation result - keep key info, truncate long results.

    Args:
        observation: Raw observation content
        max_length: Maximum length of summary

    Returns:
        Summarized observation
    """
    if not observation or str(observation).strip() == "":
        return ""

    obs = str(observation).strip()
    compact = re.sub(r"\s+", " ", obs)
    if compact.startswith("{") or compact.startswith("["):
        return ""
    if re.search(r'"[A-Za-z0-9_\-]+"\s*:', compact):
        return ""

    # If it's JSON-like, extract key fields
    if "{" in obs or "[" in obs:
        for _ in range(4):
            obs = re.sub(r"\{[^{}\n]{0,1000}\}", " ", obs)
            obs = re.sub(r"\[[^\[\]\n]{0,1000}\]", " ", obs)
        obs = re.sub(r'"[A-Za-z0-9_\-]+"\s*:\s*"[^\"]*"', " ", obs)
        obs = re.sub(r'"[A-Za-z0-9_\-]+"\s*:\s*[^,}\]]+', " ", obs)

    if "{" in obs or "[" in obs or re.search(r'"[A-Za-z0-9_\-]+"\s*:', obs):
        return ""

    obs = re.sub(r"\s+", " ", obs).strip(" .,:;-")
    if not obs:
        return ""

    # Take first few sentences
    sentences = re.split(r"[.!?]", obs)
    if sentences:
        summary = sentences[0].strip()
        if len(sentences) > 1 and len(summary) < 50:
            summary = f"{summary}. {sentences[1].strip()}"
    else:
        summary = obs

    # Truncate if needed
    if len(summary) > max_length:
        summary = summary[:max_length].rstrip() + "..."

    return summary


def format_observation_reasoning(tool_name: str, observation: str) -> str:
    tool_readable = get_tool_readable_name(tool_name or "")
    summarized = summarize_observation(observation)
    if summarized and len(summarized) > 10:
        return (
            f"mình đã có dữ liệu từ bước {tool_readable}. "
            f"{summarized}. Giờ mình đang rút ý chính để trả lời ngắn gọn cho bạn."
        )
    return f"mình đã có dữ liệu từ bước {tool_readable} và đang tổng hợp lại để trả lời đúng câu hỏi của bạn."


def format_thinking_stream(
    react_steps: List[Dict[str, Any]],
    include_tool_details: bool = True,
) -> List[Dict[str, str]]:
    """
    Convert ReAct steps to natural thinking stream.

    Args:
        react_steps: List of ReAct step dictionaries
        include_tool_details: Whether to include detailed tool info

    Returns:
        List of thinking segments with type and content
    """
    thinking_segments: List[Dict[str, str]] = []

    for i, step in enumerate(react_steps):
        if not isinstance(step, dict):
            continue

        step_type = step.get("step_type", "")
        content = step.get("content", "")
        tool_name = step.get("tool_name", "")
        tool_params = step.get("tool_params", {})

        if step_type == "thought":
            cleaned = clean_thought(content)
            if cleaned:
                thinking_segments.append(
                    {
                        "type": "thought",
                        "content": _with_reasoning_prefix(cleaned),
                        "step_index": str(i),
                    }
                )

        elif step_type == "action" and include_tool_details:
            tool_text = format_tool_call(tool_name, tool_params)
            thinking_segments.append(
                {
                    "type": "tool_call",
                    "content": _with_reasoning_prefix(tool_text),
                    "tool_name": tool_name,
                    "step_index": str(i),
                }
            )

        elif step_type == "observation":
            observation_text = format_observation_reasoning(tool_name, content)
            thinking_segments.append(
                {
                    "type": "observation",
                    "content": _with_reasoning_prefix(observation_text),
                    "step_index": str(i),
                }
            )

    return thinking_segments


def get_thinking_summary(react_steps: List[Dict[str, Any]]) -> str:
    """
    Get a single summary string of the thinking process.

    Args:
        react_steps: List of ReAct steps

    Returns:
        One-line summary of thinking process
    """
    segments = format_thinking_stream(react_steps, include_tool_details=False)

    if not segments:
        return "Đang phân tích yêu cầu..."

    # Take first thought or observation
    for seg in segments:
        if seg["type"] in ("thought", "observation"):
            return seg["content"]

    return "Đang xử lý..."


# ============================================================================
# STREAMING HELPERS
# ============================================================================


def chunk_for_streaming(text: str, chunk_size: int = 20) -> List[str]:
    """
    Split text into chunks for streaming.

    Args:
        text: Text to chunk
        chunk_size: Characters per chunk

    Returns:
        List of text chunks
    """
    if not text:
        return []

    # For smoother streaming, vary chunk sizes slightly
    chunks = []
    i = 0
    while i < len(text):
        # Random-ish chunk size between chunk_size/2 and chunk_size

        if not observation or observation.strip() == "":
            return ""
        compact = observation.strip()
        if compact.startswith("{") or compact.startswith("["):
            return ""
        if re.search(r'"[A-Za-z0-9_\-]+"\s*:', compact):
            return ""
        i += size

    return chunks


def format_thinking_for_stream(react_steps: List[Dict[str, Any]]) -> List[str]:
    """
    Format thinking for real-time streaming.

    Returns list of text segments that can be streamed one by one.
    """
    segments = format_thinking_stream(react_steps)

    streaming_texts = []
    for seg in segments:
        content = seg["content"]

        if seg["type"] == "thought":
            streaming_texts.append(content)
        elif seg["type"] == "tool_call":
            streaming_texts.append(content)
        elif seg["type"] == "observation":
            streaming_texts.append(content)

    return streaming_texts
