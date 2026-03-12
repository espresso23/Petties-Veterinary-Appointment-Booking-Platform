from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.agents.single_agent import SingleAgent
from app.core.agents.prompt_builder import build_context, create_think_prompt
from app.core.agents.tool_routing import apply_booking_tool_routing


class TestBookingContextPrompt:
    def test_create_think_prompt_includes_booking_guidance_when_booking_intent_detected(
        self,
    ):
        agent = SingleAgent(
            llm_client=None,
            enabled_tools=[
                "get_user_pets",
                "check_available_slots",
                "create_booking_for_user",
            ],
        )

        prompt = create_think_prompt(
            messages=[
                {
                    "role": "user",
                    "content": "Mình muốn đặt lịch khám cho bé Bông vào ngày mai",
                }
            ],
            context="",
            agent_name=agent.name,
            agent_type=agent.agent_type,
            system_prompt=agent.system_prompt,
            tool_schemas=agent.tool_schemas,
            enabled_tools_lower=agent._enabled_tools_lower,
        )

        assert "QUY TRÌNH HỖ TRỢ ĐẶT LỊCH" in prompt
        assert "tại nhà hay tại phòng khám" in prompt
        assert "CHỈ hỏi phần còn thiếu" in prompt
        assert "tiêm chủng" in prompt

    def test_booking_routing_asks_for_booking_type_before_checking_slots(self):
        agent = SingleAgent(
            llm_client=None,
            enabled_tools=["check_available_slots", "create_booking_for_user"],
        )

        parsed = {
            "thought": "Tôi sẽ kiểm tra slot trống trước.",
            "tool_name": "check_available_slots",
            "tool_params": {
                "clinic_id": "clinic-1",
                "date": "2026-03-12",
                "service_ids": ["svc-1"],
            },
            "should_end": False,
        }
        messages = [
            {"role": "user", "content": "Đặt lịch khám cho bé Bông ngày mai nhé"}
        ]

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower=agent._enabled_tools_lower,
            build_context_fn=build_context,
        )

        assert result["should_end"] is True
        assert result["tool_name"] is None
        assert "tại phòng khám hay bác sĩ đến nhà" in result["thought"]

    def test_booking_routing_keeps_slot_check_when_type_known_from_history(self):
        agent = SingleAgent(
            llm_client=None,
            enabled_tools=["check_available_slots", "create_booking_for_user"],
        )

        parsed = {
            "thought": "Tôi sẽ kiểm tra slot trống.",
            "tool_name": "check_available_slots",
            "tool_params": {
                "clinic_id": "clinic-1",
                "date": "2026-03-12",
                "service_ids": ["svc-1"],
            },
            "should_end": False,
        }
        messages = [
            {"role": "user", "content": "Mình muốn khám tại nhà cho bé Bông"},
            {"role": "assistant", "content": "Bạn muốn ngày nào ạ?"},
            {"role": "user", "content": "Ngày mai buổi chiều"},
        ]

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower=agent._enabled_tools_lower,
            build_context_fn=build_context,
        )

        assert result == parsed

    def test_booking_routing_requires_confirmation_before_create_booking(self):
        agent = SingleAgent(
            llm_client=None,
            enabled_tools=["create_booking_for_user"],
        )

        parsed = {
            "thought": "Tôi sẽ tạo booking ngay.",
            "tool_name": "create_booking_for_user",
            "tool_params": {
                "pet_id": "pet-1",
                "clinic_id": "clinic-1",
                "booking_date": "2026-03-12",
                "start_time": "14:00",
                "service_ids": ["svc-1"],
            },
            "should_end": False,
        }
        messages = [
            {
                "role": "user",
                "content": "Mình muốn đặt lịch tại phòng khám cho bé Bông ngày 2026-03-12 lúc 14:00",
            },
        ]

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower=agent._enabled_tools_lower,
            build_context_fn=build_context,
        )

        assert result["should_end"] is True
        assert result["tool_name"] is None
        assert "xác nhận giúp mình" in result["thought"]

    def test_booking_routing_requires_home_visit_location_before_create_booking(self):
        agent = SingleAgent(
            llm_client=None,
            enabled_tools=["create_booking_for_user"],
        )

        parsed = {
            "thought": "Tôi sẽ tạo booking tại nhà.",
            "tool_name": "create_booking_for_user",
            "tool_params": {
                "pet_id": "pet-1",
                "clinic_id": "clinic-1",
                "booking_date": "2026-03-12",
                "start_time": "14:00",
                "service_ids": ["svc-1"],
            },
            "should_end": False,
        }
        messages = [
            {
                "role": "user",
                "content": "Mình muốn đặt lịch khám tại nhà cho bé Bông ngày 2026-03-12 lúc 14:00",
            },
        ]

        result = apply_booking_tool_routing(
            parsed,
            messages,
            react_steps=[],
            enabled_tools_lower=agent._enabled_tools_lower,
            build_context_fn=build_context,
        )

        assert result["should_end"] is True
        assert result["tool_name"] is None
        assert "địa chỉ khám tại nhà" in result["thought"]
