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

from app.core.tool_runtime_context import (  # noqa: E402
    ToolRuntimeContext,
    reset_tool_runtime_context,
    set_tool_runtime_context,
)
from app.core.tools.mcp_tools.booking_tools import (  # noqa: E402
    cancel_booking_manager,
    confirm_booking_manager,
    get_available_staff_for_reassign,
    reassign_staff_for_service,
    view_clinic_bookings,
)
from app.core.tools.mcp_tools.staff_tools import (  # noqa: E402
    get_slot_availability,
    get_staff_schedule,
)


class ClinicOperationToolsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="manager-1",
                role="CLINIC_MANAGER",
                auth_token="jwt-token",
                clinic_id="clinic-1",
            )
        )

    def tearDown(self):
        reset_tool_runtime_context(self.runtime_token)

    async def test_view_clinic_bookings_returns_normalized_payload(self):
        client = AsyncMock()
        client.get_clinic_bookings.return_value = {
            "content": [
                {
                    "id": "booking-1",
                    "bookingCode": "BK-001",
                    "status": "PENDING",
                    "petName": "Milo",
                    "ownerName": "Nguyen Van A",
                    "bookingDate": "2026-04-08",
                    "bookingTime": "09:30",
                    "type": "IN_CLINIC",
                    "services": [{"serviceName": "Kham tong quat"}],
                }
            ],
            "totalElements": 1,
            "totalPages": 1,
            "number": 0,
        }

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await view_clinic_bookings(clinic_id="clinic-1", status="PENDING")

        self.assertTrue(result["success"])
        self.assertEqual(result["total_elements"], 1)
        self.assertEqual(result["bookings"][0]["booking_code"], "BK-001")
        self.assertEqual(result["bookings"][0]["status"], "PENDING")

    async def test_confirm_booking_manager_success(self):
        client = AsyncMock()
        client.confirm_booking.return_value = {
            "id": "booking-1",
            "status": "CONFIRMED",
        }

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await confirm_booking_manager(booking_id="booking-1")

        self.assertTrue(result["success"])
        self.assertEqual(result["booking"]["status"], "CONFIRMED")

    async def test_cancel_booking_manager_success_with_booking_id(self):
        client = AsyncMock()
        client.cancel_booking.return_value = {
            "id": "booking-1",
            "status": "CANCELLED",
        }

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await cancel_booking_manager(
                booking_id="booking-1",
                reason="Clinic overbooked",
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["booking"]["status"], "CANCELLED")

    async def test_get_available_staff_for_reassign_success(self):
        client = AsyncMock()
        client.get_available_staff_for_reassign.return_value = [
            {
                "staffId": "staff-1",
                "fullName": "Tran Thi B",
            }
        ]

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await get_available_staff_for_reassign(
                booking_id="booking-1",
                service_id="service-1",
            )

        self.assertTrue(result["success"])
        self.assertEqual(len(result["staff_list"]), 1)
        self.assertEqual(result["staff_list"][0]["staffId"], "staff-1")

    async def test_reassign_staff_for_service_success(self):
        client = AsyncMock()
        client.reassign_staff_for_service.return_value = {
            "id": "booking-1",
            "status": "CONFIRMED",
            "services": [
                {
                    "serviceId": "service-1",
                    "staffId": "staff-2",
                }
            ],
        }

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await reassign_staff_for_service(
                booking_id="booking-1",
                service_id="service-1",
                booking_service_item_id="booking-service-1",
                new_staff_id="staff-2",
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["booking"]["services"][0]["staffId"], "staff-2")

    async def test_get_staff_schedule_success(self):
        client = AsyncMock()
        client.get_clinic_shifts.return_value = [
            {
                "shiftId": "shift-1",
                "staffName": "Le Van C",
                "displayDate": "2026-04-08",
                "startTime": "08:00:00",
                "endTime": "12:00:00",
                "availableSlots": 3,
                "bookedSlots": 2,
                "totalSlots": 5,
                "isContinuation": False,
            }
        ]

        with (
            patch(
                "app.core.tools.mcp_tools.staff_tools.get_backend_client",
                return_value=client,
            ),
            patch(
                "app.core.tools.mcp_tools.staff_tools._is_tool_available",
                return_value=True,
            ),
        ):
            result = await get_staff_schedule(date="2026-04-08", days=1)

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["total_shifts"], 1)
        self.assertEqual(result["data"]["total_available_slots"], 3)

    async def test_get_slot_availability_success(self):
        client = AsyncMock()
        client.get_clinic_staff_shifts.return_value = [
            {
                "shiftId": "shift-1",
                "staffName": "Le Van C",
                "slots": [
                    {
                        "startTime": "08:30:00",
                        "status": "BOOKED",
                        "petName": "Milo",
                        "serviceName": "Kham tong quat",
                        "bookingId": "booking-1",
                    },
                    {
                        "startTime": "09:00:00",
                        "status": "AVAILABLE",
                    },
                ],
            }
        ]

        with (
            patch(
                "app.core.tools.mcp_tools.staff_tools.get_backend_client",
                return_value=client,
            ),
            patch(
                "app.core.tools.mcp_tools.staff_tools._is_tool_available",
                return_value=True,
            ),
        ):
            result = await get_slot_availability(date="2026-04-08")

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["total_slots"], 2)
        self.assertEqual(result["data"]["slots"][0]["time"], "08:30")
        self.assertEqual(result["data"]["slots"][0]["status"], "BOOKED")


if __name__ == "__main__":
    unittest.main()
