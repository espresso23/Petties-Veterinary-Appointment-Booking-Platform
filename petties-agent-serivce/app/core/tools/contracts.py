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
            p["service_ids"] = [
                str(x).strip() for x in _as_list(p.get("service_ids")) if str(x).strip()
            ]
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
            p["service_ids"] = [
                str(x).strip() for x in _as_list(p.get("service_ids")) if str(x).strip()
            ]
        if p.get("items") is None and p.get("bookingItems") is not None:
            p["items"] = p.get("bookingItems")
        if isinstance(p.get("items"), list):
            normalized_items = []
            for raw_item in p["items"]:
                if not isinstance(raw_item, dict):
                    continue
                item = dict(raw_item)
                if item.get("pet_id") is None and item.get("petId") is not None:
                    item["pet_id"] = item.get("petId")
                if item.get("pet_hint") is None and item.get("petHint") is not None:
                    item["pet_hint"] = item.get("petHint")
                if (
                    item.get("service_ids") is None
                    and item.get("serviceIds") is not None
                ):
                    item["service_ids"] = item.get("serviceIds")
                if "service_ids" in item:
                    item["service_ids"] = [
                        str(x).strip()
                        for x in _as_list(item.get("service_ids"))
                        if str(x).strip()
                    ]
                normalized_items.append(item)
            p["items"] = normalized_items
        # Coerce confirmed if it comes as string.
        if isinstance(p.get("confirmed"), str):
            p["confirmed"] = p["confirmed"].strip().lower() in {
                "1",
                "true",
                "yes",
                "y",
                "ok",
            }

    # pet_knowledge_search
    if name == "pet_knowledge_search":
        if p.get("top_k") is not None:
            p["top_k"] = _to_int(p.get("top_k"))
        if p.get("min_score") is not None:
            p["min_score"] = _to_float(p.get("min_score"))
        if "pet_type" in p and p["pet_type"] is not None:
            p["pet_type"] = str(p["pet_type"]).strip().lower()

    # web_search
    if name == "web_search":
        if p.get("max_results") is not None:
            p["max_results"] = _to_int(p.get("max_results"))

    # get_user_pets
    if name == "get_user_pets":
        if "user_id" in p and p["user_id"] is not None:
            p["user_id"] = str(p["user_id"]).strip()
        if "pet_hint" in p and p["pet_hint"] is not None:
            p["pet_hint"] = str(p["pet_hint"]).strip()

    # check_vaccination_status
    if name == "check_vaccination_status":
        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if "vaccine_template_id" in p and p["vaccine_template_id"] is not None:
            p["vaccine_template_id"] = str(p["vaccine_template_id"]).strip()

    # get_staff_patients
    if name == "get_staff_patients":
        if "query_name" in p and p["query_name"] is not None:
            p["query_name"] = str(p["query_name"]).strip()
        if p.get("limit") is not None:
            p["limit"] = _to_int(p.get("limit"))

    # get_patient_summary
    if name == "get_patient_summary":
        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()

    # get_emr_history
    if name == "get_emr_history":
        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if p.get("limit") is not None:
            p["limit"] = _to_int(p.get("limit"))

    # get_pet_health_summary
    if name == "get_pet_health_summary":
        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if "user_id" in p and p["user_id"] is not None:
            p["user_id"] = str(p["user_id"]).strip()

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
        out["clinics"] = [
            c for c in _as_list(out.get("clinics")) if isinstance(c, dict)
        ]
        out["total_found"] = _to_int(out.get("total_found")) or len(out["clinics"])

    if name == "get_clinic_services":
        out["services"] = [
            s for s in _as_list(out.get("services")) if isinstance(s, dict)
        ]
        out["total_services"] = _to_int(out.get("total_services")) or len(
            out["services"]
        )

    if name == "check_available_slots":
        out["available_slots"] = [
            s for s in _as_list(out.get("available_slots")) if isinstance(s, dict)
        ]
        out["total_slots"] = _to_int(out.get("total_slots")) or len(
            out["available_slots"]
        )

    if name == "create_booking_for_user":
        # booking may be missing or a single dict; keep as dict.
        if out.get("booking") is not None and not isinstance(out.get("booking"), dict):
            out["booking"] = {"value": out.get("booking")}

    if name in {"pet_knowledge_search", "web_search"}:
        out["results"] = [
            r for r in _as_list(out.get("results")) if isinstance(r, dict)
        ]
        if out.get("sources_used") is not None:
            out["sources_used"] = _to_int(out.get("sources_used")) or 0

    if name == "get_staff_patients":
        out["pets"] = [p for p in _as_list(out.get("pets")) if isinstance(p, dict)]
        out["total"] = _to_int(out.get("total")) or len(out["pets"])

    if name == "get_patient_summary":
        out["recent_exams"] = [
            exam for exam in _as_list(out.get("recent_exams")) if isinstance(exam, dict)
        ]
        out["total_exams"] = _to_int(out.get("total_exams")) or len(out["recent_exams"])

    if name == "get_emr_history":
        out["emr_history"] = [
            emr for emr in _as_list(out.get("emr_history")) if isinstance(emr, dict)
        ]
        out["total"] = _to_int(out.get("total")) or len(out["emr_history"])

    # Generic: normalize common date field if present.
    for k in ("date", "booking_date"):
        if isinstance(out.get(k), str):
            v = out[k].strip()
            out[k] = v if _ISO_DATE_RE.match(v) else out[k]

    return out
