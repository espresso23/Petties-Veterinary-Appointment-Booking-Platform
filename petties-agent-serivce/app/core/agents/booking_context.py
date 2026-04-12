"""Helpers to build a deterministic booking context from chat history."""

from __future__ import annotations

import re
from datetime import date as date_cls, datetime, timedelta
from typing import Any, Dict, List, Optional

from app.core.agents.text_utils import normalize_vietnamese_text

_WEEKDAY_ALIASES = [
    ("chu nhat", 6),
    ("thu hai", 0),
    ("thu ba", 1),
    ("thu tu", 2),
    ("thu bon", 3),
    ("thu nam", 3),
    ("thu sau", 4),
    ("thu bay", 5),
    ("thu 2", 0),
    ("thu 3", 1),
    ("thu 4", 2),
    ("thu 5", 3),
    ("thu 6", 4),
    ("thu 7", 5),
    ("t2", 0),
    ("t3", 1),
    ("t4", 2),
    ("t5", 3),
    ("t6", 4),
    ("t7", 5),
    ("cn", 6),
]


def _iter_context_candidates(
    *,
    date_expression: Optional[str],
    latest_message: Optional[str],
    transcript: Optional[str],
) -> List[str]:
    candidates: List[str] = []
    seen: set[str] = set()

    def add(value: Optional[str]) -> None:
        text = str(value or "").strip()
        if text and text not in seen:
            candidates.append(text)
            seen.add(text)

    add(date_expression)
    add(latest_message)

    for line in reversed(str(transcript or "").splitlines()):
        add(line)

    return candidates


def _parse_date_token(
    raw_value: Optional[str], reference_date: date_cls
) -> Optional[date_cls]:
    text = str(raw_value or "").strip()
    if not text:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    short_match = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})", text)
    if short_match:
        first = int(short_match.group(1))
        second = int(short_match.group(2))

        # Auto-detect format: if first > 12, it's definitely DD
        if first > 12:
            day, month = first, second
        elif second > 12:
            # Second > 12, so it's DD (US format reversed)
            day, month = second, first
        elif first <= 12 and second <= 12:
            # Ambiguous case - assume VN format (DD/MM) for VN users
            day, month = first, second

        try:
            candidate = date_cls(reference_date.year, month, day)
            if candidate < reference_date:
                candidate = date_cls(reference_date.year + 1, month, day)
            return candidate
        except ValueError:
            # Invalid date (e.g., Feb 30), return None
            return None

    return None


def _resolve_weekday_date(
    normalized_text: str, reference_date: date_cls
) -> Optional[date_cls]:
    target_weekday = None
    for alias, weekday in sorted(
        _WEEKDAY_ALIASES, key=lambda item: len(item[0]), reverse=True
    ):
        if alias in normalized_text:
            target_weekday = weekday
            break

    if target_weekday is None and "cuoi tuan" in normalized_text:
        target_weekday = 5
    if target_weekday is None:
        return None

    days_ahead = (target_weekday - reference_date.weekday()) % 7
    if "tuan sau" in normalized_text or "next week" in normalized_text:
        days_ahead += 7 if days_ahead != 0 else 7
    return reference_date + timedelta(days=days_ahead)


def _resolve_relative_date_from_text(
    normalized_text: str,
    reference_date: date_cls,
) -> Optional[date_cls]:
    if not normalized_text:
        return None

    if "hom nay" in normalized_text or "today" in normalized_text:
        return reference_date
    if "ngay mai" in normalized_text or "tomorrow" in normalized_text:
        return reference_date + timedelta(days=1)
    if "ngay kia" in normalized_text:
        return reference_date + timedelta(days=2)

    return _resolve_weekday_date(normalized_text, reference_date)


def _resolve_time_preference_label(text: Optional[str]) -> Optional[str]:
    normalized = normalize_vietnamese_text(text or "")
    if not normalized:
        return None
    if any(
        token in normalized for token in ("buoi sang", "sang som", "sang", "morning")
    ):
        return "buoi_sang"
    if any(token in normalized for token in ("buoi chieu", "chieu", "afternoon")):
        return "buoi_chieu"
    if any(token in normalized for token in ("buoi toi", "toi", "evening", "night")):
        return "buoi_toi"
    return None


def _parse_exact_time_token(raw_value: Optional[str]) -> Optional[str]:
    text = str(raw_value or "").strip()
    if not text:
        return None

    colon_match = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", text)
    if colon_match:
        return f"{int(colon_match.group(1)):02d}:{colon_match.group(2)}"

    hour_match = re.search(
        r"\b([01]?\d|2[0-3])h(?:(\d{2}))?\b", normalize_vietnamese_text(text)
    )
    if hour_match:
        minute = hour_match.group(2) or "00"
        return f"{int(hour_match.group(1)):02d}:{minute}"

    return None


def resolve_booking_datetime_inputs(
    *,
    date: Optional[str] = None,
    date_expression: Optional[str] = None,
    exact_time: Optional[str] = None,
    time_preference: Optional[str] = None,
    latest_message: Optional[str] = None,
    transcript: Optional[str] = None,
    reference_date: Optional[date_cls] = None,
) -> Dict[str, Optional[str]]:
    """Resolve date/time fields from chat with newest explicit user fact winning."""

    effective_reference_date = reference_date or date_cls.today()
    candidates = _iter_context_candidates(
        date_expression=date_expression,
        latest_message=latest_message,
        transcript=transcript,
    )

    resolved_date = None
    parsed_direct_date = _parse_date_token(date, effective_reference_date)
    if parsed_direct_date and parsed_direct_date >= effective_reference_date:
        resolved_date = parsed_direct_date.isoformat()
    else:
        for candidate in candidates:
            parsed = _parse_date_token(candidate, effective_reference_date)
            if parsed and parsed >= effective_reference_date:
                resolved_date = parsed.isoformat()
                break

            relative_date = _resolve_relative_date_from_text(
                normalize_vietnamese_text(candidate),
                effective_reference_date,
            )
            if relative_date:
                resolved_date = relative_date.isoformat()
                break

    resolved_exact_time = str(exact_time or "").strip() or None
    if not resolved_exact_time:
        for candidate in candidates:
            parsed_time = _parse_exact_time_token(candidate)
            if parsed_time:
                resolved_exact_time = parsed_time
                break

    resolved_time_preference = str(time_preference or "").strip() or None
    if not resolved_time_preference:
        for candidate in candidates:
            label = _resolve_time_preference_label(candidate)
            if label:
                resolved_time_preference = label
                break

    return {
        "date": resolved_date,
        "exact_time": resolved_exact_time,
        "time_preference": resolved_time_preference,
    }


def parse_conditional_intent(
    user_message: str,
    transcript: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Parse 'nếu...thì...' conditional intents from user message.

    Returns dict with:
        - condition_type: slot_available | clinic_confirmed | price_acceptable | etc.
        - condition_details: parsed details about the condition
        - action: create_booking | suggest_alternative | wait_for_confirmation
        - raw_text: original conditional text
    """
    text = normalize_vietnamese_text(user_message)
    if not text:
        return None

    conditional_patterns = [
        (
            r"neu\s+((con|co|dung|khong\s+day))\s+.*?thi\s+(tao|dat|giup)",
            "slot_available",
            "create_booking",
        ),
        (
            r"neu\s+((phong\s+kham|clinic)[^,]*)\s+con\s+slot",
            "slot_available",
            "create_booking",
        ),
        (
            r"neu\s+((ngay|gio|thoi\s+gian)[^,]*)\s+con\s+trong",
            "slot_available",
            "create_booking",
        ),
        (
            r"neu\s+((phong\s+kham|clinic)[^,]*)\s+gan\s+nh[ao]t",
            "nearest_clinic",
            "auto_select",
        ),
        (r"neu\s+([^,]+)\s+th[ij]\s+([^,]+)", None, None),  # Generic pattern
    ]

    for pattern, condition_type, action in conditional_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            condition_text = match.group(1) if match.lastindex >= 1 else ""
            action_text = match.group(2) if match.lastindex >= 2 else ""

            if condition_type == "slot_available" or action == "create_booking":
                return {
                    "condition_type": "slot_available",
                    "action": "create_booking",
                    "condition_details": {
                        "check_slot": True,
                        "preferred_time": action_text or None,
                    },
                    "raw_text": match.group(0),
                }

            if condition_type == "nearest_clinic" or "gan nhat" in condition_text:
                return {
                    "condition_type": "nearest_clinic",
                    "action": "auto_select",
                    "condition_details": {
                        "auto_select_nearest": True,
                    },
                    "raw_text": match.group(0),
                }

    if "tao yeu cau" in text and ("dat lich" in text or "booking" in text):
        if any(kw in text for kw in ["giup", "giup toi", "ho tan", "ban"]):
            return {
                "condition_type": "explicit_request",
                "action": "create_booking",
                "condition_details": {
                    "user_confirmed": True,
                    "auto_follow_up": True,
                },
                "raw_text": text,
            }

    return None


def fuzzy_match_pet_name(
    pet_name: str, pet_list: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Fuzzy match pet name against list of user pets.

    Returns the best matching pet dict or None if no good match.
    Uses normalized Vietnamese text comparison.
    """
    if not pet_name or not pet_list:
        return None

    normalized_query = normalize_vietnamese_text(pet_name).lower().strip()
    if not normalized_query:
        return None

    best_match = None
    best_score = 0.0

    for pet in pet_list:
        pet_name_val = pet.get("name", "") or ""
        normalized_pet_name = normalize_vietnamese_text(pet_name_val).lower().strip()

        if not normalized_pet_name:
            continue

        score = 0.0

        if normalized_pet_name == normalized_query:
            score = 1.0
        elif normalized_query in normalized_pet_name:
            score = 0.8
        elif normalized_pet_name in normalized_query:
            score = 0.7
        elif _fuzzy_token_match(normalized_query, normalized_pet_name):
            score = 0.5

        if score > best_score:
            best_score = score
            best_match = pet

    return best_match if best_score >= 0.4 else None


def _fuzzy_token_match(query: str, target: str) -> bool:
    """Check if query tokens have high overlap with target."""
    query_tokens = set(query.split())
    target_tokens = set(target.split())

    if not query_tokens or not target_tokens:
        return False

    overlap = len(query_tokens & target_tokens)
    return overlap >= len(query_tokens) * 0.6
