from pathlib import Path
import sys
import unittest
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.tool_runtime_context import (
    ToolRuntimeContext,
    reset_tool_runtime_context,
    set_tool_runtime_context,
)
from app.core.tools.mcp_tools.booking_tools import (
    _resolve_booking_datetime_inputs,
    check_available_slots,
    check_vaccination_status,
    create_booking_for_user,
    get_clinic_services,
    get_user_pets,
    search_clinics_nearby,
)


class BookingToolsTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_user_pets_uses_runtime_context(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.get_user_pets.return_value = [
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
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await get_user_pets()
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertEqual(result["user_id"], "user-1")
        self.assertEqual(result["total_pets"], 1)
        self.assertEqual(result["pets"][0]["name"], "Mimi")

    async def test_search_clinics_nearby_uses_clinic_options_for_explicit_clinic(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {
            "resolvedLocation": {"latitude": 15.9575, "longitude": 108.2575},
            "resolvedClinicHint": "PetCare",
        }
        client.get_booking_clinic_options.return_value = {
            "totalFound": 1,
            "clinics": [
                {
                    "clinicId": "clinic-1",
                    "name": "Benh Vien Thu Y PetCare",
                    "address": "FPT Complex Da Nang",
                    "distanceKm": 0.2,
                    "ratingAvg": 5.0,
                    "ratingCount": 4,
                    "operatingHours": {
                        "FRIDAY": {"openTime": "08:00", "closeTime": "20:00"}
                    },
                    "matchMode": "explicit_name",
                }
            ],
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await search_clinics_nearby(
                    latitude=15.9575,
                    longitude=108.2575,
                    clinic_hint="PetCare",
                    service_hint="kham benh",
                    latest_message="Dat lich o PetCare",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_booking_clinic_options.assert_awaited_once()
        sent_payload = client.get_booking_clinic_options.await_args.args[1]
        self.assertEqual(sent_payload["clinicHint"], "PetCare")
        self.assertEqual(result["total_found"], 1)
        self.assertEqual(result["clinics"][0]["name"], "Benh Vien Thu Y PetCare")
        self.assertEqual(result["match_mode"], "explicit_name")
        self.assertTrue(result["auto_select_clinic"])

    async def test_get_clinic_services_resolves_clinic_hint_to_canonical_id(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {}
        client.get_booking_clinic_options.return_value = {
            "totalFound": 1,
            "clinics": [
                {
                    "clinicId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "clinicName": "Pet Care Da Nang",
                    "address": "Da Nang",
                    "estimatedPriceFrom": 120000,
                    "matchedServices": [
                        {
                            "serviceId": "svc-1",
                            "name": "Kham benh",
                            "category": "GENERAL",
                            "basePrice": 120000,
                        }
                    ],
                    "reasonMatched": "Phu hop voi nhu cau dich vu ban dang hoi",
                }
            ],
        }
        client.get_clinic_services.return_value = []

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await get_clinic_services(
                    "pet_care",
                    pet_species="DOG",
                    service_hint="kham benh",
                    latest_message="Dat lich o Pet Care",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_clinic_services.assert_awaited_once_with(
            "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            pet_species="DOG",
            is_home_visit=None,
        )
        self.assertEqual(
            result["resolved_clinic_id"], "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        )

    async def test_get_clinic_services_normalizes_vietnamese_pet_species_to_enum(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {}
        client.get_booking_clinic_options.return_value = {
            "totalFound": 1,
            "clinics": [
                {
                    "clinicId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "clinicName": "Pet Care Da Nang",
                    "address": "Da Nang",
                }
            ],
        }
        client.get_clinic_services.return_value = []

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                await get_clinic_services(
                    "pet_care",
                    pet_species="Chó",
                    latest_message="Dat lich cho cho",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_clinic_services.assert_awaited_once_with(
            "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            pet_species="DOG",
            is_home_visit=None,
        )

    async def test_check_available_slots_returns_choose_clinic_when_hint_is_ambiguous(
        self,
    ):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {}
        client.get_booking_clinic_options.return_value = {
            "totalFound": 2,
            "clinics": [
                {
                    "clinicId": "clinic-1",
                    "clinicName": "Pet Care Hai Chau",
                    "address": "Hai Chau",
                },
                {
                    "clinicId": "clinic-2",
                    "clinicName": "Pet Care Ngu Hanh Son",
                    "address": "Ngu Hanh Son",
                },
            ],
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await check_available_slots(
                    clinic_id="pet care",
                    date_expression="thu bay nay",
                    service_hint="kham benh",
                    latest_message="Dat lich o Pet Care",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertTrue(result["needs_clarification"])
        self.assertEqual(result["next_best_action"], "choose_clinic")
        self.assertEqual(len(result["clinic_options"]), 2)

    async def test_search_clinics_nearby_resolves_text_address_before_clinic_lookup(
        self,
    ):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {
            "resolvedLocation": {
                "latitude": 15.975,
                "longitude": 108.25,
                "address": "Ngu Hanh Son, Da Nang",
            },
            "resolvedClinicHint": "PetCare",
            "resolvedServiceHint": "kham benh",
        }
        client.get_booking_clinic_options.return_value = {
            "totalFound": 1,
            "clinics": [
                {
                    "clinicId": "clinic-1",
                    "name": "Benh Vien Thu Y PetCare",
                    "address": "Ngu Hanh Son, Da Nang",
                    "distanceKm": 0.5,
                    "ratingAvg": 4.9,
                    "ratingCount": 10,
                    "operatingHours": {
                        "SATURDAY": {"openTime": "08:00", "closeTime": "18:00"}
                    },
                    "matchMode": "explicit_name",
                }
            ],
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await search_clinics_nearby(
                    clinic_hint="PetCare",
                    address="Ngu Hanh Son Da Nang",
                    latest_message="Dat lich o phong kham PetCare tai Ngu Hanh Son Da Nang",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.resolve_booking_context.assert_awaited_once()
        client.get_booking_clinic_options.assert_awaited_once()
        sent_payload = client.get_booking_clinic_options.await_args.args[1]
        self.assertEqual(sent_payload["latitude"], 15.975)
        self.assertEqual(sent_payload["longitude"], 108.25)
        self.assertEqual(result["clinics"][0]["name"], "Benh Vien Thu Y PetCare")

    async def test_search_clinics_nearby_does_not_fallback_to_nearest_when_explicit_clinic_not_found(
        self,
    ):
        client = AsyncMock()
        client.find_nearby_clinics.return_value = {
            "content": [
                {
                    "clinicId": "clinic-2",
                    "name": "Bien Xanh Pet Hospital",
                    "address": "123 Vo Nguyen Giap",
                    "distance": 1.9,
                    "ratingAvg": 4.8,
                    "ratingCount": 134,
                    "operatingHours": {},
                }
            ]
        }

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await search_clinics_nearby(
                latitude=15.9575,
                longitude=108.2575,
                clinic_hint="PetCare",
            )

        self.assertEqual(result["total_found"], 0)
        self.assertIsNone(result["matched_clinic"])
        self.assertTrue(result["needs_clarification"])

    async def test_check_available_slots_prefers_internal_orchestration_when_token_exists(
        self,
    ):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.get_booking_slot_options.return_value = {
            "resolvedServiceIds": ["svc-1"],
            "resolvedServiceNames": ["Kham benh"],
            "recommendedSlots": [
                {
                    "startTime": "09:00",
                    "endTime": "09:30",
                    "durationMinutes": 30,
                    "exactRequested": False,
                }
            ],
            "alternatives": [
                {
                    "startTime": "10:00",
                    "endTime": "10:30",
                    "durationMinutes": 30,
                    "exactRequested": False,
                }
            ],
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await check_available_slots(
                    clinic_id="clinic-1",
                    date_expression="thu bay nay",
                    service_hint="kham benh",
                    pet_id="pet-1",
                    time_preference="sang",
                    latest_message="Dat lich sang thu bay nay",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_booking_slot_options.assert_awaited_once()
        sent_payload = client.get_booking_slot_options.await_args.args[1]
        self.assertIsNotNone(sent_payload["bookingDate"])
        self.assertEqual(sent_payload["serviceHint"], "kham benh")
        self.assertEqual(result["resolved_service_ids"], ["svc-1"])
        self.assertEqual(result["available_slots"][0]["start_time"], "09:00")

    async def test_check_available_slots_normalizes_vietnamese_pet_species_to_enum(
        self,
    ):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.get_booking_slot_options.return_value = {
            "resolvedServiceIds": ["svc-1"],
            "resolvedServiceNames": ["Kham benh"],
            "recommendedSlots": [],
            "alternatives": [],
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                await check_available_slots(
                    clinic_id="clinic-1",
                    date_expression="thu bay nay",
                    service_hint="kham benh",
                    pet_species="Chó",
                    latest_message="Dat lich cho cho thu bay nay",
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_booking_slot_options.assert_awaited_once()
        sent_payload = client.get_booking_slot_options.await_args.args[1]
        self.assertEqual(sent_payload["petSpecies"], "DOG")

    async def test_create_booking_reports_missing_fields_before_confirmation(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        try:
            result = await create_booking_for_user(
                pet_id="pet-1",
                clinic_id="clinic-1",
                date_expression="thu bay nay",
                confirmed=False,
            )
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertFalse(result["success"])
        self.assertEqual(result["next_best_action"], "collect_missing_fields")
        self.assertIn("dich vu", result["missing_fields"])
        self.assertIn("gio kham", result["missing_fields"])

    async def test_create_booking_requires_confirmation_after_fields_are_complete(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {}
        client.get_booking_clinic_options.return_value = {
            "totalFound": 1,
            "clinics": [
                {
                    "clinicId": "550e8400-e29b-41d4-a716-446655440000",
                    "clinicName": "Test Clinic",
                    "address": "Test Address",
                }
            ],
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await create_booking_for_user(
                    pet_id="pet-1",
                    clinic_id="550e8400-e29b-41d4-a716-446655440000",
                    booking_date="2026-12-25",
                    start_time="09:00",
                    service_ids=["svc-1"],
                    confirmed=False,
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertFalse(result["success"])
        self.assertEqual(result["next_best_action"], "confirm_booking")
        self.assertEqual(result["booking_preview"]["service_ids"], ["svc-1"])

    async def test_create_home_visit_booking_calls_ai_booking_endpoint(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.resolve_booking_context.return_value = {}
        client.get_booking_clinic_options.return_value = {
            "totalFound": 1,
            "clinics": [
                {
                    "clinicId": "550e8400-e29b-41d4-a716-446655440001",
                    "clinicName": "Petties Clinic",
                    "address": "Test Address",
                }
            ],
        }
        client.create_ai_booking.return_value = {
            "bookingId": "booking-1",
            "bookingCode": "BK001",
            "status": "PENDING",
            "petName": "Mimi",
            "clinicName": "Petties Clinic",
            "bookingDate": "2026-12-25",
            "bookingTime": "09:00",
            "managerWillConfirm": True,
        }

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await create_booking_for_user(
                    pet_id="pet-1",
                    clinic_id="550e8400-e29b-41d4-a716-446655440001",
                    booking_date="2026-12-25",
                    start_time="09:00",
                    service_ids=["service-1"],
                    booking_type="HOME_VISIT",
                    home_address="123 Duong ABC, Da Nang",
                    home_lat=16.0544,
                    home_long=108.2022,
                    distance_km=4.2,
                    confirmed=True,
                )
        finally:
            reset_tool_runtime_context(runtime_token)

        client.create_ai_booking.assert_awaited_once()
        sent_payload = client.create_ai_booking.await_args.args[1]
        self.assertTrue(sent_payload["confirmed"])
        self.assertEqual(sent_payload["bookingType"], "HOME_VISIT")
        self.assertEqual(sent_payload["homeAddress"], "123 Duong ABC, Da Nang")
        self.assertTrue(result["success"])
        self.assertEqual(result["booking"]["type"], "HOME_VISIT")

    async def test_get_clinic_services_includes_vaccination_metadata(self):
        client = AsyncMock()
        client.get_clinic_services.return_value = [
            {
                "serviceId": "svc-vaccine-1",
                "name": "Tiem phong dai",
                "description": "Tiem chung cho cho/meo",
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
                        "doseLabel": "Mui 1",
                        "price": 150000,
                        "isActive": True,
                    },
                    {
                        "doseNumber": 2,
                        "doseLabel": "Mui 2",
                        "price": 180000,
                        "isActive": True,
                    },
                ],
                "isActive": True,
            }
        ]

        with patch(
            "app.core.tools.mcp_tools.booking_tools.get_backend_client",
            return_value=client,
        ):
            result = await get_clinic_services(
                "clinic-1", pet_species="DOG", is_home_visit=False
            )

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

    async def test_check_vaccination_status_returns_filtered_history(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(
                user_id="user-1", role="PET_OWNER", auth_token="jwt-token"
            )
        )

        client = AsyncMock()
        client.get_vaccinations_by_pet.return_value = [
            {
                "id": "vac-1",
                "petId": "pet-1",
                "bookingId": "booking-1",
                "clinicId": "clinic-1",
                "clinicName": "Petties Clinic",
                "staffId": "staff-1",
                "staffName": "Dr A",
                "vaccineName": "Vac xin 7 benh",
                "vaccineTemplateId": "template-1",
                "doseNumber": 1,
                "totalDoses": 3,
                "vaccinationDate": "2026-01-10",
                "nextDueDate": "2026-02-10",
                "status": "VALID",
            },
            {
                "id": "vac-2",
                "petId": "pet-1",
                "vaccineName": "Vac xin dai",
                "vaccineTemplateId": "template-x",
                "doseNumber": 1,
                "vaccinationDate": "2026-01-12",
                "status": "VALID",
            },
        ]
        client.get_upcoming_vaccinations.return_value = [
            {
                "id": "up-1",
                "petId": "pet-1",
                "bookingId": "booking-1",
                "clinicId": "clinic-1",
                "clinicName": "Petties Clinic",
                "staffId": "staff-1",
                "staffName": "Dr A",
                "vaccineName": "Vac xin 7 benh",
                "vaccineTemplateId": "template-1",
                "doseNumber": 2,
                "totalDoses": 3,
                "nextDueDate": "2026-02-10",
                "status": "UPCOMING",
            }
        ]

        try:
            with patch(
                "app.core.tools.mcp_tools.booking_tools.get_backend_client",
                return_value=client,
            ):
                result = await check_vaccination_status("pet-1", "template-1")
        finally:
            reset_tool_runtime_context(runtime_token)

        client.get_vaccinations_by_pet.assert_awaited_once_with("jwt-token", "pet-1")
        client.get_upcoming_vaccinations.assert_awaited_once_with("jwt-token", "pet-1")
        self.assertEqual(result["total_history"], 1)
        self.assertEqual(result["total_upcoming"], 1)
        self.assertEqual(result["history"][0]["dose_number"], 1)
        self.assertEqual(result["upcoming"][0]["dose_number"], 2)

    def test_resolve_booking_datetime_inputs_supports_relative_weekday(self):
        resolved = _resolve_booking_datetime_inputs(
            date_expression="thu bay nay",
            latest_message="Dat lich sang thu bay nay",
        )

        today = date.today()
        target = today + timedelta(days=(5 - today.weekday()) % 7)
        self.assertEqual(resolved["date"], target.isoformat())
        self.assertEqual(resolved["time_preference"], "buoi_sang")

    def test_resolve_booking_datetime_inputs_prioritizes_latest_explicit_fact(self):
        resolved = _resolve_booking_datetime_inputs(
            latest_message="Doi lich sang thu bay nay luc 09:30",
            transcript="Dat lich cho Hadine chieu ngay mai\nDoi lich sang thu bay nay luc 09:30",
        )

        today = date.today()
        saturday = today + timedelta(days=(5 - today.weekday()) % 7)
        self.assertEqual(resolved["date"], saturday.isoformat())
        self.assertEqual(resolved["exact_time"], "09:30")


if __name__ == "__main__":
    unittest.main()
