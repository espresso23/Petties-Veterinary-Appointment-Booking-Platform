"""Tool contracts & normalization for business tools.

Mục tiêu:
- Tool input/output ổn định (list vs single item, numeric strings, etc.)
- Giảm crash/timeout do LLM truyền sai kiểu hoặc backend trả shape không nhất quán
- Không thay đổi semantics nghiệp vụ; chỉ normalize dữ liệu
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import re


_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def normalize_tool_input(tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Soft-normalize tool input based on tool name."""
    if not isinstance(parameters, dict):
        return {}

    name = (tool_name or "").strip().lower()
    p = dict(parameters)

    if name == "search_clinics_nearby":
        # Accept common aliases from clients/LLM.
        if p.get("latitude") is None and p.get("lat") is not None:
            p["latitude"] = p.get("lat")
        if p.get("longitude") is None and p.get("lng") is not None:
            p["longitude"] = p.get("lng")
        lat = p.get("latitude")
        lng = p.get("longitude")
        p["latitude"] = _to_float(lat)
        p["longitude"] = _to_float(lng)
        if p.get("radius_km") is not None:
            p["radius_km"] = _to_float(p.get("radius_km"))
        if p.get("top_k") is not None:
            p["top_k"] = _to_int(p.get("top_k"))

    if name == "get_clinic_services":
        if p.get("clinic_id") is None and p.get("clinicId") is not None:
            p["clinic_id"] = p.get("clinicId")
        if "clinic_id" in p and p["clinic_id"] is not None:
            p["clinic_id"] = str(p["clinic_id"]).strip()

    if name == "check_available_slots":
        if p.get("clinic_id") is None and p.get("clinicId") is not None:
            p["clinic_id"] = p.get("clinicId")
        if p.get("service_ids") is None and p.get("serviceIds") is not None:
            p["service_ids"] = p.get("serviceIds")
        # Allow booking_date alias (some prompts use booking_date consistently)
        if p.get("date") is None and p.get("booking_date") is not None:
            p["date"] = p.get("booking_date")
        if "clinic_id" in p and p["clinic_id"] is not None:
            p["clinic_id"] = str(p["clinic_id"]).strip()
        if "service_ids" in p:
            p["service_ids"] = [str(x).strip() for x in _as_list(p.get("service_ids")) if str(x).strip()]
        if "date" in p and isinstance(p["date"], str):
            p["date"] = p["date"].strip()

    if name == "create_booking_for_user":
        # Accept common aliases from LLM outputs.
        if p.get("pet_id") is None and p.get("petId") is not None:
            p["pet_id"] = p.get("petId")
        if p.get("clinic_id") is None and p.get("clinicId") is not None:
            p["clinic_id"] = p.get("clinicId")
        if p.get("service_ids") is None and p.get("serviceIds") is not None:
            p["service_ids"] = p.get("serviceIds")
        if p.get("booking_date") is None and p.get("bookingDate") is not None:
            p["booking_date"] = p.get("bookingDate")
        if p.get("start_time") is None and p.get("startTime") is not None:
            p["start_time"] = p.get("startTime")
        if "service_ids" in p:
            p["service_ids"] = [str(x).strip() for x in _as_list(p.get("service_ids")) if str(x).strip()]
        # Coerce confirmed if it comes as string.
        if isinstance(p.get("confirmed"), str):
            p["confirmed"] = p["confirmed"].strip().lower() in {"1", "true", "yes", "y", "ok"}

    return p


def normalize_tool_output(tool_name: str, result: Any) -> Any:
    """Soft-normalize tool output so downstream code can rely on consistent shapes."""
    name = (tool_name or "").strip().lower()

    # Keep primitives as-is.
    if result is None or isinstance(result, (str, int, float, bool)):
        return result

    # If a tool unexpectedly returns a list, wrap it.
    if isinstance(result, list):
        return {"items": result, "total": len(result)}

    if not isinstance(result, dict):
        return {"value": str(result)}

    out = dict(result)

    if name == "get_user_pets":
        out["pets"] = [p for p in _as_list(out.get("pets")) if isinstance(p, dict)]
        out["total_pets"] = _to_int(out.get("total_pets")) or len(out["pets"])

    if name == "search_clinics_nearby":
        out["clinics"] = [c for c in _as_list(out.get("clinics")) if isinstance(c, dict)]
        out["total_found"] = _to_int(out.get("total_found")) or len(out["clinics"])

    if name == "get_clinic_services":
        out["services"] = [s for s in _as_list(out.get("services")) if isinstance(s, dict)]
        out["total_services"] = _to_int(out.get("total_services")) or len(out["services"])

    if name == "check_available_slots":
        out["available_slots"] = [s for s in _as_list(out.get("available_slots")) if isinstance(s, dict)]
        out["total_slots"] = _to_int(out.get("total_slots")) or len(out["available_slots"])

    if name == "create_booking_for_user":
        # booking may be missing or a single dict; keep as dict.
        if out.get("booking") is not None and not isinstance(out.get("booking"), dict):
            out["booking"] = {"value": out.get("booking")}

    if name in {"pet_knowledge_search", "web_search"}:
        out["results"] = [r for r in _as_list(out.get("results")) if isinstance(r, dict)]
        if out.get("sources_used") is not None:
            out["sources_used"] = _to_int(out.get("sources_used")) or 0

    # Generic: normalize common date field if present.
    for k in ("date", "booking_date"):
        if isinstance(out.get(k), str):
            v = out[k].strip()
            out[k] = v if _ISO_DATE_RE.match(v) else out[k]

    return out
