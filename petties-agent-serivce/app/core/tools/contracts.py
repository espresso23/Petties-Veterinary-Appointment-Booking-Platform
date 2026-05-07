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
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


def _is_uuid(val: Any) -> bool:
    if not isinstance(val, str):
        return False
    return bool(_UUID_RE.match(val.strip()))


BUSINESS_ERROR_CODES = {
    "BOOKING_ALREADY_COMPLETED",
    "BOOKING_CONFLICT",
    "BOOKING_CREATE_FAILED",
    "BOOKING_SESSION_INACTIVE",
    "CLINIC_NOT_FOUND",
    "CONFIRMATION_CONTEXT_MISSING",
    "CONFIRMATION_EXPIRED",
    "CONFIRMATION_MISMATCH",
    "CONFIRMATION_REQUIRED",
    "FORBIDDEN",
    "INTERNAL_ERROR",
    "INVALID_CONFIRMATION",
    "INVALID_DATE",
    "INVALID_INPUT",
    "NO_SLOTS_AVAILABLE",
    "PET_NOT_FOUND",
    "RATE_LIMITED",
    "SERVICE_NOT_FOUND",
    "TOOL_NOT_AVAILABLE",
    "UNAUTHORIZED",
}

BUSINESS_ERROR_TITLES = {
    "BOOKING_ALREADY_COMPLETED": "Booking đã hoàn tất",
    "BOOKING_CONFLICT": "Xung đột booking",
    "BOOKING_CREATE_FAILED": "Không thể tạo booking",
    "BOOKING_SESSION_INACTIVE": "Phiên đặt lịch không còn hoạt động",
    "CLINIC_NOT_FOUND": "Không tìm thấy phòng khám",
    "CONFIRMATION_CONTEXT_MISSING": "Thiếu ngữ cảnh xác nhận",
    "CONFIRMATION_EXPIRED": "Xác nhận đã hết hiệu lực",
    "CONFIRMATION_MISMATCH": "Thông tin booking đã thay đổi",
    "CONFIRMATION_REQUIRED": "Cần xác nhận lại booking",
    "FORBIDDEN": "Không có quyền truy cập",
    "INTERNAL_ERROR": "Lỗi hệ thống",
    "INVALID_CONFIRMATION": "Xác nhận không hợp lệ",
    "INVALID_DATE": "Ngày giờ không hợp lệ",
    "INVALID_INPUT": "Dữ liệu chưa hợp lệ",
    "NO_SLOTS_AVAILABLE": "Không còn slot phù hợp",
    "PET_NOT_FOUND": "Không tìm thấy thú cưng",
    "RATE_LIMITED": "Hệ thống đang bận",
    "SERVICE_NOT_FOUND": "Không tìm thấy dịch vụ phù hợp",
    "TOOL_NOT_AVAILABLE": "Công cụ không khả dụng",
    "UNAUTHORIZED": "Cần đăng nhập lại",
}


def build_tool_success_response(
    data: Any,
    *,
    tool_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    is_final: bool = False,
) -> Dict[str, Any]:
    response: Dict[str, Any] = {
        "success": True,
        "data": data,
        "metadata": metadata or {},
    }
    if tool_name:
        response["tool_name"] = tool_name
    if is_final:
        response["is_final"] = True
    return response


def build_tool_error_response(
    *,
    error_code: str,
    message: str,
    recoverable: bool,
    suggestion: Optional[str] = None,
    tool_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    response: Dict[str, Any] = {
        "success": False,
        "error_code": error_code,
        "message": message,
        "recoverable": recoverable,
        "suggestion": suggestion,
        "metadata": metadata or {},
    }
    if tool_name:
        response["tool_name"] = tool_name
    return response


def get_error_title(error_code: Optional[str]) -> str:
    normalized = str(error_code or "INTERNAL_ERROR").strip().upper()
    return BUSINESS_ERROR_TITLES.get(normalized, "Lỗi")


def classify_error_code(message: str, *, default: str = "INTERNAL_ERROR") -> str:
    normalized = str(message or "").strip().lower()
    if any(
        token in normalized
        for token in [
            "không có quyền",
            "khong co quyen",
            "forbidden",
            "access denied",
            "http 403",
            " 403",
        ]
    ):
        return "FORBIDDEN"
    if any(
        token in normalized
        for token in [
            "khong duoc enabled",
            "not enabled",
            "not found in database",
            "not found",
        ]
    ):
        return "TOOL_NOT_AVAILABLE"
    if any(
        token in normalized
        for token in ["auth", "token", "dang nhap", "đăng nhập", "unauthorized"]
    ):
        return "UNAUTHORIZED"
    if any(
        token in normalized
        for token in ["missing required parameter", "validation", "tham so", "tham số"]
    ):
        return "INVALID_INPUT"
    if (
        any(
            token in normalized
            for token in ["khong tim thay phong kham", "clinic not found", "phong kham"]
        )
        and "slot" not in normalized
    ):
        return "CLINIC_NOT_FOUND"
    if any(
        token in normalized
        for token in ["khong tim thay dich vu", "service not found", "dich vu"]
    ):
        return "SERVICE_NOT_FOUND"
    if any(
        token in normalized
        for token in ["khong tim thay thu cung", "pet not found", "thu cung"]
    ):
        return "PET_NOT_FOUND"
    if any(
        token in normalized
        for token in ["khong con slot", "no slots", "het slot", "slot unavailable"]
    ):
        return "NO_SLOTS_AVAILABLE"
    if any(
        token in normalized
        for token in ["ngay khong hop le", "invalid date", "gio khong hop le"]
    ):
        return "INVALID_DATE"
    if any(
        token in normalized for token in ["conflict", "trung lich", "booking conflict"]
    ):
        return "BOOKING_CONFLICT"
    if any(
        token in normalized
        for token in ["timeout", "too many requests", "rate limit", "429"]
    ):
        return "RATE_LIMITED"
    return default


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

    if name == "search_clinics_by_name":
        if p.get("name") is None and p.get("clinic_hint") is not None:
            p["name"] = p.get("clinic_hint")
        if p.get("name") is None and p.get("clinic_name") is not None:
            p["name"] = p.get("clinic_name")
        if p.get("limit") is None and p.get("top_k") is not None:
            p["limit"] = p.get("top_k")
        if p.get("limit") is None and p.get("size") is not None:
            p["limit"] = p.get("size")
        if p.get("name") is not None:
            p["name"] = str(p.get("name")).strip()
        if p.get("limit") is not None:
            p["limit"] = _to_int(p.get("limit"))

    if name == "generate_clinic_services":
        def _normalize_string_list(raw: Any) -> List[str]:
            if raw is None:
                return []
            if isinstance(raw, str):
                return [part.strip() for part in raw.split(",") if part.strip()]
            if isinstance(raw, list):
                return [str(item).strip() for item in raw if str(item).strip()]
            text = str(raw).strip()
            return [text] if text else []

        p["pet_types"] = _normalize_string_list(p.get("pet_types"))
        p["service_scope"] = _normalize_string_list(p.get("service_scope"))
        if p.get("target_clinic_id") is not None:
            clinic_id = str(p.get("target_clinic_id") or "").strip()
            p["target_clinic_id"] = clinic_id or None

    if name == "get_clinic_services":
        if p.get("clinic_id") is None and p.get("clinicId") is not None:
            p["clinic_id"] = p.get("clinicId")
        if p.get("clinic_id") is None and p.get("clinic_name_hint") is not None:
            p["clinic_id"] = p.get("clinic_name_hint")

        cid = p.get("clinic_id")
        if cid and not _is_uuid(cid) and p.get("clinic_name_hint") is None:
            p["clinic_name_hint"] = cid
            # Keep clinic_id as is, do not set to None, so tools don't fail validation
            # The tool implementation will handle the non-UUID case via _resolve_clinic_reference
            p["clinic_id"] = str(cid).strip()

        if "clinic_id" in p and p["clinic_id"] is not None:
            p["clinic_id"] = str(p["clinic_id"]).strip()

    if name == "check_available_slots":
        if p.get("clinic_id") is None and p.get("clinicId") is not None:
            p["clinic_id"] = p.get("clinicId")
        if p.get("clinic_id") is None and p.get("clinic_name_hint") is not None:
            p["clinic_id"] = p.get("clinic_name_hint")

        cid = p.get("clinic_id")
        if cid and not _is_uuid(cid) and p.get("clinic_name_hint") is None:
            p["clinic_name_hint"] = cid
            # Keep clinic_id as is, do not set to None, so tools don't fail validation
            # The tool implementation will handle the non-UUID case via _resolve_clinic_reference
            p["clinic_id"] = str(cid).strip()

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
        if p.get("pet_id") is None and p.get("petId") is not None:
            p["pet_id"] = p.get("petId")

        pid = p.get("pet_id")
        if pid and not _is_uuid(pid) and p.get("pet_hint") is None:
            p["pet_hint"] = pid
            p["pet_id"] = None

        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if "vaccine_template_id" in p and p["vaccine_template_id"] is not None:
            p["vaccine_template_id"] = str(p["vaccine_template_id"]).strip()
        if "pet_hint" in p and p["pet_hint"] is not None:
            p["pet_hint"] = str(p["pet_hint"]).strip()

    # get_staff_patients
    if name == "get_staff_patients":
        if "query_name" in p and p["query_name"] is not None:
            p["query_name"] = str(p["query_name"]).strip()
        if p.get("limit") is not None:
            p["limit"] = _to_int(p.get("limit"))

    # get_patient_summary
    if name == "get_patient_summary":
        if p.get("pet_id") is None and p.get("petId") is not None:
            p["pet_id"] = p.get("petId")

        pid = p.get("pet_id")
        if pid and not _is_uuid(pid) and p.get("pet_name_hint") is None:
            p["pet_name_hint"] = pid
            p["pet_id"] = None

        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if "pet_name_hint" in p and p["pet_name_hint"] is not None:
            p["pet_name_hint"] = str(p["pet_name_hint"]).strip()

    # get_emr_history
    if name == "get_emr_history":
        if p.get("pet_id") is None and p.get("petId") is not None:
            p["pet_id"] = p.get("petId")

        pid = p.get("pet_id")
        if pid and not _is_uuid(pid) and p.get("pet_name_hint") is None:
            p["pet_name_hint"] = pid
            p["pet_id"] = None

        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if p.get("limit") is not None:
            p["limit"] = _to_int(p.get("limit"))
        if "pet_name_hint" in p and p["pet_name_hint"] is not None:
            p["pet_name_hint"] = str(p["pet_name_hint"]).strip()

    # get_pet_health_summary
    if name == "get_pet_health_summary":
        if p.get("pet_id") is None and p.get("petId") is not None:
            p["pet_id"] = p.get("petId")

        pid = p.get("pet_id")
        if pid and not _is_uuid(pid) and p.get("pet_name_hint") is None:
            p["pet_name_hint"] = pid
            p["pet_id"] = None

        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()
        if "user_id" in p and p["user_id"] is not None:
            p["user_id"] = str(p["user_id"]).strip()
        if "pet_name_hint" in p and p["pet_name_hint"] is not None:
            p["pet_name_hint"] = str(p["pet_name_hint"]).strip()

    # list_my_bookings
    if name == "list_my_bookings":
        if p.get("limit") is not None:
            p["limit"] = _to_int(p.get("limit"))
        if "status" in p and p["status"] is not None:
            p["status"] = str(p["status"]).strip().lower()

    # get_my_booking_info
    if name == "get_my_booking_info":
        if "booking_id" in p and p["booking_id"] is not None:
            p["booking_id"] = str(p["booking_id"]).strip()
        if "booking_code" in p and p["booking_code"] is not None:
            p["booking_code"] = str(p["booking_code"]).strip()

    # Utility tools
    if name == "get_current_datetime":
        if p.get("time_expression") is None and p.get("expression") is not None:
            p["time_expression"] = p.get("expression")
        if "reference_date_iso" in p and p["reference_date_iso"] is not None:
            p["reference_date_iso"] = str(p["reference_date_iso"]).strip()

    # Medical tools
    if name == "get_patient_summary":
        if "pet_id" in p and p["pet_id"] is not None:
            p["pet_id"] = str(p["pet_id"]).strip()

    # Clinic Owner stats overview
    if name == "get_owner_stats_overview":
        if p.get("period") is None:
            p["period"] = "MONTH"
        p["period"] = str(p["period"]).strip().upper()

    # Clinic metrics
    if name == "get_clinic_metrics":
        if p.get("period") is None:
            p["period"] = "MONTH"
        p["period"] = str(p["period"]).strip().upper()

    if name == "cancel_booking_manager":
        if p.get("booking_id") is None and p.get("bookingId") is not None:
            p["booking_id"] = p.get("bookingId")
        bid = p.get("booking_id")
        if bid and not _is_uuid(bid) and p.get("booking_code_hint") is None:
            p["booking_code_hint"] = bid
            p["booking_id"] = None
        if "booking_id" in p and p["booking_id"] is not None:
            p["booking_id"] = str(p["booking_id"]).strip()
        if "booking_code_hint" in p and p["booking_code_hint"] is not None:
            p["booking_code_hint"] = str(p["booking_code_hint"]).strip()

    # Analytics & Summary
    if name in {
        "analyze_revenue_trends",
        "get_clinic_metrics",
        "get_clinic_today_summary",
        "get_staff_schedule",
        "get_slot_availability",
    }:
        if p.get("clinic_id") is None and p.get("clinicId") is not None:
            p["clinic_id"] = p.get("clinicId")

        cid = p.get("clinic_id")
        # If clinic_id is provided but it's clearly a name hint, move it
        if cid and not _is_uuid(cid) and p.get("clinic_name_hint") is None:
            p["clinic_name_hint"] = cid
            p["clinic_id"] = None

        # Upper case period if exists
        if p.get("period"):
            p["period"] = str(p["period"]).strip().upper()
        if "clinic_id" in p and p["clinic_id"] is not None:
            p["clinic_id"] = str(p["clinic_id"]).strip()
        if "clinic_name_hint" in p and p["clinic_name_hint"] is not None:
            p["clinic_name_hint"] = str(p["clinic_name_hint"]).strip()

    return p


def normalize_tool_output(tool_name: str, result: Any) -> Any:
    """Soft-normalize tool output so downstream code can rely on consistent shapes."""
    name = (tool_name or "").strip().lower()
    success_envelope_keys = {
        "success",
        "data",
        "metadata",
        "tool_name",
        "is_final",
        "_warning",
        "_dropped_params",
    }

    def _normalize_raw_data(out: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(out)

        if name == "get_user_pets":
            data["pets"] = [
                p for p in _as_list(data.get("pets")) if isinstance(p, dict)
            ]
            data["total_pets"] = _to_int(data.get("total_pets")) or len(data["pets"])

        if name == "search_clinics_nearby":
            data["clinics"] = [
                c for c in _as_list(data.get("clinics")) if isinstance(c, dict)
            ]
            data["total_found"] = _to_int(data.get("total_found")) or len(
                data["clinics"]
            )

        if name == "get_clinic_services":
            data["services"] = [
                s for s in _as_list(data.get("services")) if isinstance(s, dict)
            ]
            data["total_services"] = _to_int(data.get("total_services")) or len(
                data["services"]
            )

        if name == "check_available_slots":
            data["available_slots"] = [
                s for s in _as_list(data.get("available_slots")) if isinstance(s, dict)
            ]
            data["total_slots"] = _to_int(data.get("total_slots")) or len(
                data["available_slots"]
            )

        if name == "create_booking_for_user":
            if data.get("booking") is not None and not isinstance(
                data.get("booking"), dict
            ):
                data["booking"] = {"value": data.get("booking")}

        if name in {"pet_knowledge_search", "web_search"}:
            data["results"] = [
                r for r in _as_list(data.get("results")) if isinstance(r, dict)
            ]
            if data.get("sources_used") is not None:
                data["sources_used"] = _to_int(data.get("sources_used")) or 0

        if name == "get_staff_patients":
            data["pets"] = [
                p for p in _as_list(data.get("pets")) if isinstance(p, dict)
            ]
            data["total"] = _to_int(data.get("total")) or len(data["pets"])

        if name == "get_patient_summary":
            data["recent_exams"] = [
                exam
                for exam in _as_list(data.get("recent_exams"))
                if isinstance(exam, dict)
            ]
            data["total_exams"] = _to_int(data.get("total_exams")) or len(
                data["recent_exams"]
            )

        if name == "get_emr_history":
            data["emr_history"] = [
                emr
                for emr in _as_list(data.get("emr_history"))
                if isinstance(emr, dict)
            ]
            data["total"] = _to_int(data.get("total")) or len(data["emr_history"])

        if name == "get_pet_health_summary":
            data["pet_id"] = (
                str(data.get("pet_id", "")).strip() if data.get("pet_id") else None
            )

        if name == "list_my_bookings":
            data["bookings"] = [
                b for b in _as_list(data.get("bookings")) if isinstance(b, dict)
            ]
            data["total"] = _to_int(data.get("total")) or len(data["bookings"])
            data["upcoming_count"] = _to_int(data.get("upcoming_count")) or 0

        if name == "get_my_booking_info":
            if data.get("booking") is not None and not isinstance(
                data.get("booking"), dict
            ):
                data["booking"] = {"value": data.get("booking")}

        if name == "get_owner_stats_overview":
            data["clinics_stats"] = [
                s for s in _as_list(data.get("clinics_stats")) if isinstance(s, dict)
            ]
            data["total_revenue"] = _to_float(data.get("total_revenue")) or 0.0

        if name == "get_clinic_metrics":
            data["top_services"] = [
                s for s in _as_list(data.get("top_services")) if isinstance(s, dict)
            ]

        if name == "get_clinic_staff":
            data["staff"] = [
                s for s in _as_list(data.get("staff")) if isinstance(s, dict)
            ]
            data["total"] = _to_int(data.get("total")) or len(data["staff"])

        if name == "get_clinic_shifts":
            data["shifts"] = [
                s for s in _as_list(data.get("shifts")) if isinstance(s, dict)
            ]

        if name == "get_patient_summary":
            if "pet_info" in data and isinstance(data["pet_info"], dict):
                data["pet_info"]["allergies"] = _as_list(
                    data["pet_info"].get("allergies")
                )
            data["recent_exams"] = [
                e for e in _as_list(data.get("recent_exams")) if isinstance(e, dict)
            ]

        if name == "get_current_datetime":
            for k in ["resolved_date", "resolved_time"]:
                if data.get(k):
                    data[k] = str(data[k]).strip()

        for k in ("date", "booking_date"):
            if isinstance(data.get(k), str):
                v = data[k].strip()
                data[k] = v if _ISO_DATE_RE.match(v) else data[k]

        return data

    # Keep primitives as-is.
    if result is None or isinstance(result, (str, int, float, bool)):
        return result

    # If a tool unexpectedly returns a list, wrap it.
    if isinstance(result, list):
        return {"items": result, "total": len(result)}

    if not isinstance(result, dict):
        return {"value": str(result)}

    out = dict(result)

    # Standardized tool contract already exists from tool implementation.
    if isinstance(out.get("success"), bool):
        if out.get("success"):
            payload = out.get("data")
            if isinstance(payload, dict):
                out["data"] = _normalize_raw_data(payload)
            elif payload is None or payload == {}:
                derived_payload = {
                    key: value
                    for key, value in out.items()
                    if key not in success_envelope_keys
                }
                out["data"] = (
                    _normalize_raw_data(derived_payload) if derived_payload else {}
                )
        else:
            out["error_code"] = str(out.get("error_code") or "INTERNAL_ERROR")
            out["message"] = str(
                out.get("message") or "Đã xảy ra lỗi khi thực thi công cụ."
            )
            out["recoverable"] = bool(out.get("recoverable", True))
            if "suggestion" not in out:
                out["suggestion"] = None
        return out

    out = _normalize_raw_data(out)

    # Normalize error vs success state based on PLAN.md without changing LLM data schema wrappers
    if "success" not in out:
        is_error = False
        error_code = "INTERNAL_ERROR"

        # Simple heuristic to identify explicit error returns from tools
        msg_str = str(out.get("message", "")).lower()
        if (
            "khong the" in msg_str
            or "không thể" in msg_str
            or "chua xac dinh duoc" in msg_str
            or "chua the" in msg_str
        ):
            is_error = True

        if "auth" in msg_str or "token" in msg_str or out.get("requires_auth"):
            is_error = True
            error_code = "UNAUTHORIZED"

        if is_error:
            out["success"] = False
            out["error_code"] = out.get("error_code", error_code)
            out["recoverable"] = out.get("recoverable", True)
        else:
            out["success"] = True

    return out
