"""Fast-path helpers for simple, low-risk chatbot queries.

These helpers are intentionally conservative. They only short-circuit the normal
ReAct loop for straightforward pet-owner symptom/care questions where a single
knowledge lookup is usually enough to produce an initial safe answer.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Set

from app.core.agents.text_utils import normalize_vietnamese_text


_BOOKING_OR_TRANSACTION_HINTS = {
    "dat lich",
    "book",
    "booking",
    "hen kham",
    "phong kham",
    "clinic",
    "slot",
    "lich trong",
    "gan toi",
    "gia",
    "bao nhieu tien",
    "vac xin",
    "vaccine",
    "tiem phong",
    "lich tiem",
    "benh an",
    "ho so",
    "emr",
    "tom tat suc khoe",
}

_QUESTION_CUES = {
    "nen lam gi",
    "phai lam gi",
    "lam sao",
    "phai lam sao",
    "co sao khong",
    "co nguy hiem khong",
    "can di kham khong",
    "xu ly the nao",
    "nen cho an gi",
    "nen uong gi",
}

_DIRECT_ADVICE_CUES = {
    "chi muon biet nen lam gi",
    "chi muon biet can lam gi",
    "cu cho toi biet nen lam gi",
    "toi chi muon biet nen lam gi",
    "toi chi muon biet can lam gi",
    "huong dan giup toi",
    "cho toi cach xu ly",
}

_MEDICAL_OR_CARE_HINTS = {
    "non",
    "non mua",
    "oi",
    "tieu chay",
    "bo an",
    "sot",
    "ho",
    "so mui",
    "ngua",
    "run",
    "met",
    "kho tho",
    "vet thuong",
    "chay mau",
    "bung",
    "an gi",
    "u an",
    "cham soc",
    "dinh duong",
}

_PET_TYPE_HINTS = {
    "cho": "dog",
    "dog": "dog",
    "cun": "dog",
    "meo": "cat",
    "cat": "cat",
    "boss": "cat",
    "tho": "rabbit",
    "rabbit": "rabbit",
    "chim": "bird",
    "bird": "bird",
    "hamster": "hamster",
}


def infer_general_pet_type(message: str) -> Optional[str]:
    normalized = normalize_vietnamese_text(message)
    if not normalized:
        return None

    for token, pet_type in _PET_TYPE_HINTS.items():
        if token in normalized:
            return pet_type
    return None


def should_fast_path_pet_care_query(
    message: str,
    *,
    user_role: Optional[str],
    enabled_tools_lower: Set[str],
    has_active_booking: bool,
    has_images: bool,
) -> bool:
    normalized = normalize_vietnamese_text(message)
    normalized_role = str(user_role or "PET_OWNER").strip().upper()

    if normalized_role not in {"PET_OWNER", "ADMIN"}:
        return False
    if has_active_booking or has_images:
        return False
    if "pet_knowledge_search" not in enabled_tools_lower:
        return False
    if not normalized:
        return False
    if any(token in normalized for token in _BOOKING_OR_TRANSACTION_HINTS):
        return False
    if infer_general_pet_type(normalized) is None:
        return False

    has_medical_signal = any(token in normalized for token in _MEDICAL_OR_CARE_HINTS)
    has_question_signal = (
        any(token in normalized for token in _QUESTION_CUES) or "?" in message
    )
    return has_medical_signal and has_question_signal


def should_fast_path_pet_care_from_conversation(
    latest_message: str,
    recent_dialogue: str,
    *,
    user_role: Optional[str],
    enabled_tools_lower: Set[str],
    has_active_booking: bool,
    has_images: bool,
) -> bool:
    if should_fast_path_pet_care_query(
        latest_message,
        user_role=user_role,
        enabled_tools_lower=enabled_tools_lower,
        has_active_booking=has_active_booking,
        has_images=has_images,
    ):
        return True

    normalized_latest = normalize_vietnamese_text(latest_message)
    if not normalized_latest:
        return False
    if not any(cue in normalized_latest for cue in _DIRECT_ADVICE_CUES):
        return False

    normalized_recent = normalize_vietnamese_text(recent_dialogue)
    return should_fast_path_pet_care_query(
        normalized_recent,
        user_role=user_role,
        enabled_tools_lower=enabled_tools_lower,
        has_active_booking=has_active_booking,
        has_images=has_images,
    )


def build_fast_pet_care_tool_call(
    message: str,
    *,
    user_role: Optional[str],
    enabled_tools_lower: Set[str],
    has_active_booking: bool,
    has_images: bool,
) -> Optional[Dict[str, Any]]:
    if not should_fast_path_pet_care_query(
        message,
        user_role=user_role,
        enabled_tools_lower=enabled_tools_lower,
        has_active_booking=has_active_booking,
        has_images=has_images,
    ):
        return None

    pet_type = infer_general_pet_type(message)
    if not pet_type:
        return None

    return {
        "name": "pet_knowledge_search",
        "arguments": {
            "query": message.strip(),
            "pet_type": pet_type,
            "top_k": 2,
            "min_score": 0.45,
            "enable_kg": False,
            "enable_case_memory": False,
            "enable_query_expansion": False,
        },
        "thought": "Mình sẽ tra cứu nhanh hướng dẫn an toàn và cách xử lý phù hợp trước.",
    }


def should_fast_finalize_pet_knowledge_answer(
    *,
    tool_name: Optional[str],
    tool_result: Any,
    latest_user_message: str,
    user_role: Optional[str],
) -> bool:
    normalized_role = str(user_role or "PET_OWNER").strip().upper()
    if normalized_role not in {"PET_OWNER", "ADMIN"}:
        return False
    if str(tool_name or "").strip().lower() != "pet_knowledge_search":
        return False
    if not isinstance(tool_result, dict) or tool_result.get("success") is False:
        return False

    data = tool_result.get("data") if isinstance(tool_result.get("data"), dict) else {}
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        return False

    normalized = normalize_vietnamese_text(latest_user_message)
    if any(token in normalized for token in _BOOKING_OR_TRANSACTION_HINTS):
        return False

    return should_fast_path_pet_care_query(
        latest_user_message,
        user_role=user_role,
        enabled_tools_lower={"pet_knowledge_search"},
        has_active_booking=False,
        has_images=False,
    )


def should_fast_finalize_simple_pet_care_answer(
    *,
    tool_name: Optional[str],
    tool_result: Any,
    latest_user_message: str,
    user_role: Optional[str],
) -> bool:
    normalized_tool = str(tool_name or "").strip().lower()
    if normalized_tool not in {"pet_knowledge_search", "web_search"}:
        return False
    if not isinstance(tool_result, dict) or tool_result.get("success") is False:
        return False

    data = tool_result.get("data") if isinstance(tool_result.get("data"), dict) else {}
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        return False

    enabled_tools = {normalized_tool}
    if normalized_tool == "web_search":
        enabled_tools.add("pet_knowledge_search")

    return should_fast_path_pet_care_query(
        latest_user_message,
        user_role=user_role,
        enabled_tools_lower=enabled_tools,
        has_active_booking=False,
        has_images=False,
    )


def should_auto_fallback_empty_kb_to_web_search(
    *,
    tool_name: Optional[str],
    tool_result: Any,
    latest_user_message: str,
    user_role: Optional[str],
    enabled_tools_lower: Set[str],
    has_active_booking: bool,
    has_images: bool,
) -> bool:
    if "web_search" not in enabled_tools_lower:
        return False
    if str(tool_name or "").strip().lower() != "pet_knowledge_search":
        return False
    if not isinstance(tool_result, dict) or tool_result.get("success") is False:
        return False

    data = tool_result.get("data") if isinstance(tool_result.get("data"), dict) else {}
    results = data.get("results") if isinstance(data, dict) else None
    if isinstance(results, list) and results:
        return False

    return should_fast_path_pet_care_query(
        latest_user_message,
        user_role=user_role,
        enabled_tools_lower=enabled_tools_lower,
        has_active_booking=has_active_booking,
        has_images=has_images,
    )


def build_web_search_fallback_call(message: str) -> Optional[Dict[str, Any]]:
    query = str(message or "").strip()
    if not query:
        return None

    return {
        "name": "web_search",
        "arguments": {
            "query": query,
            "max_results": 3,
        },
        "thought": "Nguồn nội bộ chưa đủ, mình tìm thêm nguồn web liên quan để tổng hợp câu trả lời ngắn gọn cho bạn.",
    }
