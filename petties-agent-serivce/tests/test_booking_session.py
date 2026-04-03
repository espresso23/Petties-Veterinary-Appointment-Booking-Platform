from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from app.core.agents.booking_session import (
    STATUS_CANCELLED,
    STATUS_REVIEWING,
    STATUS_SUSPENDED,
    cancel_booking_session,
    merge_booking_draft,
    resume_booking_session,
    start_booking_session,
    suspend_booking_session,
)
from app.core.tool_runtime_context import (
    ToolRuntimeContext,
    reset_tool_runtime_context,
    set_tool_runtime_context,
)
from app.core.agents.single_agent import SingleAgent
from app.core.tools.mcp_tools.booking_session_tools import (
    get_booking_session,
    start_booking_session_tool,
    update_booking_draft,
)
from app.core.tools.mcp_tools.utility_tools import (
    extract_booking_entities,
    validate_booking_readiness,
)


class BookingSessionReducerTests(unittest.TestCase):
    def test_change_clinic_invalidates_services_and_slot(self):
        state = start_booking_session(
            initial_draft={
                "pet_id": "pet-1",
                "clinic_id": "clinic-1",
                "service_ids": ["svc-1"],
                "service_names": ["Kham tong quat"],
                "booking_date": "2026-03-28",
                "start_time": "09:00",
                "booking_type": "IN_CLINIC",
            }
        )

        result = merge_booking_draft(state, {"clinic_id": "clinic-2"})

        self.assertEqual(state.draft.clinic_id, "clinic-2")
        self.assertEqual(state.draft.service_ids, [])
        self.assertEqual(state.draft.service_names, [])
        self.assertIsNone(state.draft.start_time)
        self.assertIn("service_ids", result["invalidated_fields"])
        self.assertIn("service_names", result["invalidated_fields"])
        self.assertIn("start_time", result["invalidated_fields"])

    def test_change_date_invalidates_only_slot(self):
        state = start_booking_session(
            initial_draft={
                "pet_id": "pet-1",
                "clinic_id": "clinic-1",
                "service_ids": ["svc-1"],
                "booking_date": "2026-03-28",
                "start_time": "09:00",
                "booking_type": "IN_CLINIC",
            }
        )

        result = merge_booking_draft(state, {"booking_date": "2026-03-29"})

        self.assertEqual(state.draft.booking_date, "2026-03-29")
        self.assertEqual(state.draft.service_ids, ["svc-1"])
        self.assertIsNone(state.draft.start_time)
        self.assertEqual(result["invalidated_fields"], ["start_time"])

    def test_complete_required_fields_moves_to_reviewing(self):
        state = start_booking_session()

        merge_booking_draft(
            state,
            {
                "pet_id": "pet-1",
                "clinic_id": "clinic-1",
                "service_ids": ["svc-1"],
                "booking_date": "2026-03-29",
                "start_time": "10:00",
                "booking_type": "IN_CLINIC",
            },
        )

        self.assertEqual(state.status, STATUS_REVIEWING)
        self.assertEqual(state.stage, "PRESENTING")
        self.assertEqual(state.missing_fields, [])

    def test_summary_exposes_canonical_stage(self):
        state = start_booking_session(initial_draft={"pet_id": "pet-1"})

        summary = state.to_summary()

        self.assertEqual(summary["stage"], "COLLECTING")

    def test_suspend_resume_and_cancel(self):
        state = start_booking_session(initial_draft={"pet_id": "pet-1"})

        suspend_booking_session(state, reason="side question")
        self.assertEqual(state.status, STATUS_SUSPENDED)
        self.assertEqual(state.interruption_reason, "side question")

        resume_booking_session(state)
        self.assertNotEqual(state.status, STATUS_SUSPENDED)
        self.assertIsNone(state.interruption_reason)

        cancel_booking_session(state, reason="USER_CANCELLED")
        self.assertEqual(state.status, STATUS_CANCELLED)
        self.assertFalse(state.active)


class BookingSessionToolTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1",
                role="PET_OWNER",
                session_id="session-1",
            )
        )

    async def asyncTearDown(self):
        reset_tool_runtime_context(self.runtime_token)

    async def test_start_and_get_booking_session_tool(self):
        with patch(
            "app.core.tools.mcp_tools.booking_session_tools.update_booking_state_in_db",
            new=AsyncMock(return_value=True),
        ):
            started = await start_booking_session_tool(
                initial_draft={"pet_id": "pet-1", "booking_type": "IN_CLINIC"}
            )
            fetched = await get_booking_session()

        self.assertTrue(started["success"])
        self.assertEqual(started["data"]["state"]["draft"]["pet_id"], "pet-1")
        self.assertTrue(fetched["success"])
        self.assertEqual(fetched["data"]["state"]["draft"]["pet_id"], "pet-1")

    async def test_update_booking_draft_tool_syncs_context(self):
        with patch(
            "app.core.tools.mcp_tools.booking_session_tools.update_booking_state_in_db",
            new=AsyncMock(return_value=True),
        ):
            await start_booking_session_tool(initial_draft={"pet_id": "pet-1"})
            result = await update_booking_draft(
                clinic_id="clinic-1",
                service_ids=["svc-1"],
                booking_date="2026-03-29",
                start_time="10:00",
                booking_type="IN_CLINIC",
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["state"]["draft"]["clinic_id"], "clinic-1")
        self.assertEqual(result["data"]["missing_fields"], [])

    async def test_single_agent_marks_booking_state_completed_after_create_booking(
        self,
    ):
        agent = SingleAgent(
            llm_client=object(), enabled_tools=["create_booking_for_user"]
        )
        runtime_context = ToolRuntimeContext(
            user_id="user-1",
            role="PET_OWNER",
            session_id="session-1",
            booking_state=start_booking_session(
                initial_draft={
                    "pet_id": "pet-1",
                    "clinic_id": "clinic-1",
                    "service_ids": ["svc-1"],
                    "booking_date": "2026-03-29",
                    "start_time": "10:00",
                    "booking_type": "IN_CLINIC",
                }
            ).model_dump(mode="json"),
        )
        reset_tool_runtime_context(self.runtime_token)
        self.runtime_token = set_tool_runtime_context(runtime_context)

        with patch(
            "app.core.agents.single_agent.update_booking_state_in_db",
            new=AsyncMock(return_value=True),
        ):
            await agent._sync_booking_state_after_tool(
                "create_booking_for_user",
                {"success": True, "ready_to_create": True, "booking": {"id": "b1"}},
            )

        self.assertEqual(runtime_context.booking_state["status"], "COMPLETED")
        self.assertFalse(runtime_context.booking_state["active"])


class BookingUtilityToolTests(unittest.IsolatedAsyncioTestCase):
    async def test_extract_booking_entities_returns_structured_payload(self):
        result = await extract_booking_entities(
            "Tôi muốn đặt lịch khám tổng quát cho bé Mimi ở phòng khám Pet Care sáng mai"
        )

        self.assertTrue(result["success"])
        self.assertTrue(result["data"]["booking_intent"])
        self.assertIsNotNone(result["data"]["booking_date"])
        self.assertEqual(result["data"]["time_preference"], "buoi_sang")

    async def test_validate_booking_readiness_for_home_visit(self):
        result = await validate_booking_readiness(
            pet_id="pet-1",
            clinic_id="clinic-1",
            service_ids=["svc-1"],
            booking_date="2026-03-29",
            start_time="10:00",
            booking_type="HOME_VISIT",
            home_address="123 Duong ABC",
        )

        self.assertTrue(result["success"])
        self.assertFalse(result["data"]["is_ready"])
        self.assertIn("home_coordinates", result["data"]["missing_fields"])


if __name__ == "__main__":
    unittest.main()
