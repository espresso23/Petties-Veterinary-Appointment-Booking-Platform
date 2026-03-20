from app.core.tools.contracts import normalize_tool_input, normalize_tool_output


def test_normalize_input_service_ids_accepts_single_string():
    params = normalize_tool_input(
        "check_available_slots",
        {"clinic_id": "c1", "date": "2026-03-15", "service_ids": "s1"},
    )
    assert params["service_ids"] == ["s1"]


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

