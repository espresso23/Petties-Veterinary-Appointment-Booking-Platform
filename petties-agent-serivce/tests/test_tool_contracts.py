from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
    classify_error_code,
    get_error_title,
    normalize_tool_input,
    normalize_tool_output,
)


def test_normalize_input_service_ids_accepts_single_string():
    params = normalize_tool_input(
        "check_available_slots",
        {"clinic_id": "c1", "date": "2026-03-15", "service_ids": "s1"},
    )
    assert params["service_ids"] == ["s1"]


def test_normalize_search_clinics_by_name_accepts_runtime_aliases():
    params = normalize_tool_input(
        "search_clinics_by_name",
        {"clinic_hint": "PetCare", "top_k": "3"},
    )
    assert params["name"] == "PetCare"
    assert params["limit"] == 3


def test_normalize_output_wraps_single_clinic_dict_into_list():
    out = normalize_tool_output(
        "search_clinics_nearby",
        {"clinics": {"id": "c1", "name": "A"}},
    )
    assert isinstance(out["clinics"], list)
    assert out["total_found"] == 1


def test_normalize_output_wraps_list_result():
    out = normalize_tool_output("any_tool", [{"a": 1}, {"b": 2}])
    assert out["total"] == 2
    assert isinstance(out["items"], list)


def test_build_tool_error_response_has_standard_shape():
    payload = build_tool_error_response(
        error_code="INVALID_INPUT",
        message="Thiếu dữ liệu đầu vào.",
        recoverable=True,
        suggestion="Vui lòng nhập lại.",
        tool_name="demo_tool",
    )

    assert payload["success"] is False
    assert payload["error_code"] == "INVALID_INPUT"
    assert payload["recoverable"] is True
    assert payload["tool_name"] == "demo_tool"


def test_build_tool_success_response_has_metadata_and_is_final():
    payload = build_tool_success_response(
        {"value": 1}, tool_name="demo_tool", metadata={"x": 1}, is_final=True
    )

    assert payload["success"] is True
    assert payload["data"]["value"] == 1
    assert payload["metadata"]["x"] == 1
    assert payload["is_final"] is True


def test_classify_error_code_maps_common_messages():
    assert (
        classify_error_code("Missing required parameter: clinic_id") == "INVALID_INPUT"
    )
    assert classify_error_code("Tool 'x' not found in database") == "TOOL_NOT_AVAILABLE"
    assert classify_error_code("Yeu cau dang nhap de tiep tuc") == "UNAUTHORIZED"
    assert (
        classify_error_code("Khong tim thay phong kham phu hop") == "CLINIC_NOT_FOUND"
    )
    assert classify_error_code("Khong tim thay dich vu phu hop") == "SERVICE_NOT_FOUND"
    assert classify_error_code("Khong con slot phu hop") == "NO_SLOTS_AVAILABLE"


def test_get_error_title_returns_business_title():
    assert get_error_title("CONFIRMATION_REQUIRED") == "Cần xác nhận lại booking"
    assert get_error_title("SERVICE_NOT_FOUND") == "Không tìm thấy dịch vụ phù hợp"


def test_normalize_output_keeps_standardized_success_contract():
    out = normalize_tool_output(
        "web_search",
        {
            "success": True,
            "data": {
                "results": {"title": "A", "snippet": "B", "url": "https://example.com"},
                "sources_used": "1",
            },
        },
    )

    assert out["success"] is True
    assert isinstance(out["data"]["results"], list)
    assert out["data"]["sources_used"] == 1


def test_normalize_output_keeps_standardized_error_contract():
    out = normalize_tool_output(
        "get_staff_patients",
        {
            "success": False,
            "message": "Không thể xác thực",
        },
    )

    assert out["success"] is False
    assert out["error_code"] == "INTERNAL_ERROR"
    assert out["recoverable"] is True
