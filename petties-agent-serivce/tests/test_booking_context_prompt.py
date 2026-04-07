from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.agents.prompt_builder import build_context, create_think_prompt
from app.core.agents.tool_routing import apply_booking_tool_routing


class TestBookingContextPrompt:
    def test_create_think_prompt_omits_booking_block_when_no_booking_tools(self):
        enabled_tools = {"pet_knowledge_search", "get_patient_summary"}

        prompt = create_think_prompt(
            messages=[{"role": "user", "content": "Tom tat benh an cho pet nay"}],
            context="",
            agent_name="petties_agent",
            agent_type="single_agent",
            system_prompt="Base prompt",
            tool_schemas=[],
            enabled_tools_lower=enabled_tools,
        )

        assert "TRẠNG THÁI BOOKING DRAFT" not in prompt
        assert "QUY TẮC BOOKING SESSION" not in prompt

    def test_create_think_prompt_includes_semantic_booking_guidance(self):
        enabled_tools = {
            "get_user_pets",
            "start_booking_session",
            "get_booking_session",
            "update_booking_draft",
            "search_clinics_nearby",
            "check_available_slots",
            "create_booking_for_user",
        }

        prompt = create_think_prompt(
            messages=[
                {
                    "role": "user",
                    "content": "Dat lich cho Hadine o phong kham PetCare sang thu bay nay",
                }
            ],
            context="Runtime location: latitude=15.9575, longitude=108.2575, address=Ngu Hanh Son, Da Nang",
            agent_name="petties_agent",
            agent_type="single_agent",
            system_prompt="Base prompt",
            tool_schemas=[],
            enabled_tools_lower=enabled_tools,
        )

        assert "BOOKING TOOLS" in prompt
        assert "semantic params" in prompt
        assert "create_booking" in prompt
        assert "conditional booking" in prompt.lower()
        assert "clinic_hint" in prompt
        assert "search_clinics_by_name" not in prompt

    def test_create_think_prompt_pet_owner_does_not_include_clinic_copilot_tone(self):
        prompt = create_think_prompt(
            messages=[{"role": "user", "content": "Toi muon dat lich cho be nha toi"}],
            context="",
            agent_name="petties_agent",
            agent_type="single_agent",
            system_prompt="Base prompt",
            tool_schemas=[],
            enabled_tools_lower={
                "get_user_pets",
                "search_clinics_nearby",
                "check_available_slots",
            },
            user_role="PET_OWNER",
        )

        assert "PET_OWNER CHATBOT" in prompt
        assert "CLINIC COPILOT" not in prompt

    def test_create_think_prompt_clinic_does_not_include_pet_owner_tone(self):
        prompt = create_think_prompt(
            messages=[{"role": "user", "content": "Tong quan lich hen hom nay"}],
            context="",
            agent_name="petties_agent",
            agent_type="single_agent",
            system_prompt="Base prompt",
            tool_schemas=[],
            enabled_tools_lower={
                "get_my_clinics",
                "get_clinic_today_summary",
                "view_clinic_bookings",
            },
            user_role="CLINIC_MANAGER",
        )

        assert "CLINIC COPILOT" in prompt
        assert "PET_OWNER CHATBOT" not in prompt

    def test_booking_validator_does_not_rewrite_create_booking_flow(self):
        parsed = {
            "thought": "Tao yeu cau booking cho user.",
            "tool_name": "create_booking_for_user",
            "tool_params": {
                "pet_id": "pet-1",
                "clinic_id": "clinic-1",
                "booking_date": "2026-03-21",
                "start_time": "09:00",
                "service_ids": ["svc-1"],
                "confirmed": True,
            },
            "should_end": False,
        }

        messages = [
            {
                "role": "user",
                "content": "Dat lich cho Hadine o PetCare sang thu bay nay, neu con slot thi tao yeu cau giup toi",
            }
        ]

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower={"create_booking_for_user", "check_available_slots"},
            build_context_fn=build_context,
        )

        assert result["tool_name"] == "create_booking_for_user"
        assert result["tool_params"]["pet_id"] == "pet-1"
        assert result["tool_params"]["clinic_id"] == "clinic-1"
        assert result["tool_params"]["service_ids"] == ["svc-1"]
        assert "PetCare" in result["tool_params"]["latest_message"]
        assert "Hadine" in result["tool_params"]["transcript"]

    def test_booking_validator_uses_runtime_location_without_forcing_new_tool(self):
        parsed = {
            "thought": "Tim phong kham gan ban.",
            "tool_name": "search_clinics_nearby",
            "tool_params": {
                "clinic_hint": "PetCare",
                "service_hint": "kham tong quat",
            },
            "should_end": False,
        }
        messages = [
            {
                "role": "user",
                "content": "Dat lich cho Hadine o phong kham PetCare gan toi",
            }
        ]

        def _build_context(_: list[dict]) -> str:
            return "Runtime location: latitude=15.9575, longitude=108.2575, address=Ngu Hanh Son, Da Nang"

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower={"search_clinics_nearby"},
            build_context_fn=_build_context,
        )

        assert result["tool_name"] == "search_clinics_nearby"
        assert result["tool_params"]["latitude"] == 15.9575
        assert result["tool_params"]["longitude"] == 108.2575
        assert result["tool_params"]["address"] == "Ngu Hanh Son, Da Nang"
        assert result["tool_params"]["clinic_hint"] == "PetCare"

    def test_booking_validator_requests_location_when_missing(self):
        parsed = {
            "thought": "Tim phong kham gan ban.",
            "tool_name": "search_clinics_nearby",
            "tool_params": {
                "service_hint": "kham benh",
            },
            "should_end": False,
        }

        result = apply_booking_tool_routing(
            parsed,
            messages=[{"role": "user", "content": "Tim phong kham gan toi"}],
            react_steps=[],
            enabled_tools_lower={"search_clinics_nearby"},
            build_context_fn=lambda _: "",
        )

        assert result["should_end"] is True
        assert result["tool_name"] is None
        assert "vi tri hien tai" in result["thought"]

    def test_booking_validator_enriches_date_from_latest_context(self):
        parsed = {
            "thought": "Kiem tra slot cho phong kham da chon.",
            "tool_name": "check_available_slots",
            "tool_params": {
                "clinic_id": "clinic-1",
                "service_hint": "kham benh",
            },
            "should_end": False,
        }

        messages = [
            {
                "role": "user",
                "content": "Dat lich cho Hadine o PetCare chieu ngay mai",
            },
            {
                "role": "user",
                "content": "Doi lich sang thu bay nay",
            },
        ]

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower={"check_available_slots"},
            build_context_fn=lambda _: "",
        )

        assert result["tool_name"] == "check_available_slots"
        assert result["tool_params"]["date"] is not None
        assert result["tool_params"]["time_preference"] == "buoi_sang"

    def test_booking_validator_allows_explicit_clinic_without_runtime_gps(self):
        parsed = {
            "thought": "Tim phong kham PetCare theo yeu cau cua user.",
            "tool_name": "search_clinics_nearby",
            "tool_params": {
                "clinic_hint": "PetCare",
                "address": "Ngu Hanh Son Da Nang",
            },
            "should_end": False,
        }

        result = apply_booking_tool_routing(
            parsed,
            messages=[
                {
                    "role": "user",
                    "content": "Dat lich o phong kham PetCare tai Ngu Hanh Son Da Nang",
                }
            ],
            react_steps=[],
            enabled_tools_lower={"search_clinics_nearby"},
            build_context_fn=lambda _: "",
        )

        assert result["should_end"] is False
        assert result["tool_name"] == "search_clinics_nearby"
        assert result["tool_params"]["clinic_hint"] == "PetCare"

    def test_booking_validator_maps_clinic_hint_for_clinic_services(self):
        parsed = {
            "thought": "Tai dich vu cua phong kham Pet Care.",
            "tool_name": "get_clinic_services",
            "tool_params": {
                "clinic_hint": "Pet Care",
                "service_hint": "kham tong quat",
            },
            "should_end": False,
        }

        result = apply_booking_tool_routing(
            parsed,
            messages=[
                {
                    "role": "user",
                    "content": "Dat lich cho Hadine o phong kham Pet Care, dich vu kham tong quat",
                }
            ],
            react_steps=[],
            enabled_tools_lower={"get_clinic_services"},
            build_context_fn=lambda _: "",
        )

        assert result["should_end"] is False
        assert result["tool_name"] == "get_clinic_services"
        assert result["tool_params"]["clinic_id"] == "Pet Care"
        assert "clinic_hint" not in result["tool_params"]
