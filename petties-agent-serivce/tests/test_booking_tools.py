from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.tool_runtime_context import ToolRuntimeContext, reset_tool_runtime_context, set_tool_runtime_context
from app.core.tools.mcp_tools.booking_tools import (
    check_vaccination_status,
    create_booking_for_user,
    get_clinic_services,
    get_user_pets,
)


class BookingToolsTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_user_pets_uses_runtime_context(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        client = AsyncMock()
        client.get_my_pets.return_value = [
            {
                "id": "pet-1",
                "name": "Mimi",
                "species": "CAT",
                "breed": "Anh long ngan",
                "dateOfBirth": "2023-03-01",
                "weight": 3.2,
                "imageUrl": "https://example.com/mimi.png",
            }
        ]

        try:
            with patch("app.core.tools.mcp_tools.booking_tools.get_backend_client", return_value=client):
                result = await get_user_pets()
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertEqual(result["user_id"], "user-1")
        self.assertEqual(result["total_pets"], 1)
        self.assertEqual(result["pets"][0]["name"], "Mimi")

    async def test_create_booking_requires_confirmation(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        try:
            result = await create_booking_for_user(
                pet_id="pet-1",
                clinic_id="clinic-1",
                booking_date="2026-03-12",
                start_time="09:00",
                service_ids=["service-1"],
                confirmed=False,
            )
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertFalse(result["success"])
        self.assertIn("Chưa có xác nhận", result["message"])

    async def test_create_home_visit_booking_requires_location_fields(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        try:
            result = await create_booking_for_user(
                pet_id="pet-1",
                clinic_id="clinic-1",
                booking_date="2026-03-12",
                start_time="09:00",
                service_ids=["service-1"],
                booking_type="HOME_VISIT",
                confirmed=True,
            )
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertFalse(result["success"])
        self.assertIn("địa chỉ khám tại nhà", result["message"])

    async def test_create_home_visit_booking_sends_home_visit_payload(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        client = AsyncMock()
        client.create_booking.return_value = {
            "bookingId": "booking-1",
            "bookingCode": "BK001",
            "status": "PENDING",
            "petName": "Mimi",
            "clinicName": "Petties Clinic",
            "bookingDate": "2026-03-12",
            "bookingTime": "09:00:00",
            "type": "HOME_VISIT",
            "homeAddress": "123 Đường ABC, Đà Nẵng",
            "distanceKm": 4.2,
            "totalPrice": 250000,
            "pets": [
                {
                    "services": [
                        {"serviceName": "Khám tổng quát tại nhà"}
                    ]
                }
            ],
        }

        try:
            with patch("app.core.tools.mcp_tools.booking_tools.get_backend_client", return_value=client):
                result = await create_booking_for_user(
                    pet_id="pet-1",
                    clinic_id="clinic-1",
                    booking_date="2026-03-12",
                    start_time="09:00",
                    service_ids=["service-1"],
                    booking_type="HOME_VISIT",
                    home_address="123 Đường ABC, Đà Nẵng",
                    home_lat=16.0544,
                    home_long=108.2022,
                    distance_km=4.2,
                    confirmed=True,
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.create_booking.assert_awaited_once()
        sent_payload = client.create_booking.await_args.args[1]
        self.assertEqual(sent_payload["type"], "HOME_VISIT")
        self.assertEqual(sent_payload["homeAddress"], "123 Đường ABC, Đà Nẵng")
        self.assertEqual(sent_payload["distanceKm"], 4.2)
        self.assertTrue(result["success"])
        self.assertEqual(result["booking"]["type"], "HOME_VISIT")

    async def test_get_clinic_services_includes_vaccination_metadata(self):
        client = AsyncMock()
        client.get_clinic_services.return_value = [
            {
                "serviceId": "svc-vaccine-1",
                "name": "Tiêm phòng dại",
                "description": "Tiêm chủng cho chó/mèo",
                "basePrice": 150000,
                "durationTime": 15,
                "slotsRequired": 1,
                "serviceCategory": "VACCINATION",
                "petType": "DOG",
                "isHomeVisit": False,
                "reminderInterval": 12,
                "reminderUnit": "MONTH",
                "vaccineTemplateId": "template-1",
                "dosePrices": [
                    {
                        "doseNumber": 1,
                        "doseLabel": "Mũi 1",
                        "price": 150000,
                        "isActive": True,
                    },
                    {
                        "doseNumber": 2,
                        "doseLabel": "Mũi 2",
                        "price": 180000,
                        "isActive": True,
                    },
                ],
                "isActive": True,
            }
        ]

        with patch("app.core.tools.mcp_tools.booking_tools.get_backend_client", return_value=client):
            result = await get_clinic_services("clinic-1", pet_species="DOG", is_home_visit=False)

        client.get_clinic_services.assert_awaited_once_with(
            "clinic-1",
            pet_species="DOG",
            is_home_visit=False,
        )
        self.assertEqual(result["filters"]["pet_species"], "DOG")
        self.assertEqual(result["filters"]["is_home_visit"], False)
        self.assertEqual(result["services"][0]["vaccine_template_id"], "template-1")
        self.assertTrue(result["services"][0]["is_vaccination"])
        self.assertEqual(len(result["services"][0]["dose_prices"]), 2)

    async def test_check_vaccination_status_returns_filtered_history_and_recommendation(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        client = AsyncMock()
        client.get_vaccinations_by_pet.return_value = [
            {
                "id": "vac-1",
                "petId": "pet-1",
                "vaccineName": "Vắc-xin 7 bệnh",
                "vaccineTemplateId": "template-1",
                "doseNumber": 1,
                "totalDoses": 3,
                "vaccinationDate": "2026-01-10",
                "nextDueDate": "2026-02-10",
                "status": "Valid",
            },
            {
                "id": "vac-2",
                "petId": "pet-1",
                "vaccineName": "Vắc-xin dại",
                "vaccineTemplateId": "template-x",
                "doseNumber": 1,
                "vaccinationDate": "2026-01-12",
                "status": "Valid",
            },
        ]
        client.get_upcoming_vaccinations.return_value = [
            {
                "id": "up-1",
                "petId": "pet-1",
                "vaccineName": "Vắc-xin 7 bệnh",
                "vaccineTemplateId": "template-1",
                "doseNumber": 2,
                "totalDoses": 3,
                "nextDueDate": "2026-02-10",
                "status": "Upcoming",
            }
        ]

        try:
            with patch("app.core.tools.mcp_tools.booking_tools.get_backend_client", return_value=client):
                result = await check_vaccination_status("pet-1", "template-1")
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_vaccinations_by_pet.assert_awaited_once_with("jwt-token", "pet-1")
        client.get_upcoming_vaccinations.assert_awaited_once_with("jwt-token", "pet-1")
        self.assertEqual(result["history_count"], 1)
        self.assertEqual(result["upcoming_count"], 1)
        self.assertEqual(result["latest_history"]["dose_number"], 1)
        self.assertEqual(result["recommended_next"]["dose_number"], 2)
        self.assertIn("mũi tiếp theo", result["message"])


if __name__ == "__main__":
    unittest.main()