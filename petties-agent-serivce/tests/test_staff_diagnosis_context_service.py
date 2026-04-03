from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.middleware.auth import CurrentUser
from app.ai_diagnose.context_service import (
    StaffDiagnosisContextService,
)
from app.ai_diagnose.schemas import Species, StaffDiagnosisRequest


class StaffDiagnosisContextServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_staff_booking_context_is_hydrated_from_backend(self):
        service = StaffDiagnosisContextService()
        user = CurrentUser(
            user_id="staff-1",
            role="STAFF",
            clinic_id="clinic-1",
            is_admin=False,
        )
        request = StaffDiagnosisRequest(
            booking_id="booking-1",
            pet_id="pet-1",
            species=Species.OTHER,
            breed="Giả mạo",
            weight_kg=1.0,
            doctor_description="Mô tả ca bệnh",
        )

        with patch(
            "app.ai_diagnose.context_service.get_backend_client"
        ) as backend_factory:
            backend = backend_factory.return_value
            backend.get_booking = AsyncMock(
                return_value={
                    "bookingId": "booking-1",
                    "petId": "pet-1",
                    "petSpecies": "dog",
                    "petBreed": "Poodle",
                    "petWeight": 9.5,
                    "clinicId": "clinic-1",
                }
            )
            backend.get_staff_patients = AsyncMock(
                return_value=[
                    {
                        "petId": "pet-1",
                        "petName": "Bông",
                    }
                ]
            )
            backend.get_pet = AsyncMock(
                return_value={
                    "id": "pet-1",
                    "species": "cat",
                    "breed": "Maine Coon",
                    "weight": 4.2,
                    "gender": "female",
                    "allergies": "Fish, Beef",
                    "dateOfBirth": "2025-01-01",
                }
            )

            hydrated = await service.resolve_request(
                request=request,
                user=user,
                auth_token="token-123",
            )

        self.assertEqual(hydrated.booking_id, "booking-1")
        self.assertEqual(hydrated.pet_id, "pet-1")
        self.assertEqual(hydrated.species, Species.CAT)
        self.assertEqual(hydrated.breed, "Maine Coon")
        self.assertEqual(hydrated.weight_kg, 4.2)
        self.assertEqual(hydrated.allergies, ["Fish", "Beef"])

    async def test_staff_booking_outside_clinic_is_forbidden(self):
        service = StaffDiagnosisContextService()
        user = CurrentUser(
            user_id="staff-1",
            role="STAFF",
            clinic_id="clinic-1",
            is_admin=False,
        )
        request = StaffDiagnosisRequest(
            booking_id="booking-2",
            species=Species.DOG,
            doctor_description="Mô tả ca bệnh",
        )

        with patch(
            "app.ai_diagnose.context_service.get_backend_client"
        ) as backend_factory:
            backend = backend_factory.return_value
            backend.get_booking = AsyncMock(
                return_value={
                    "bookingId": "booking-2",
                    "petId": "pet-2",
                    "clinicId": "clinic-99",
                }
            )

            with self.assertRaises(HTTPException) as exc_info:
                await service.resolve_request(
                    request=request,
                    user=user,
                    auth_token="token-123",
                )

        self.assertEqual(exc_info.exception.status_code, 403)

    async def test_booking_pet_mismatch_returns_422(self):
        service = StaffDiagnosisContextService()
        user = CurrentUser(
            user_id="staff-1",
            role="STAFF",
            clinic_id="clinic-1",
            is_admin=False,
        )
        request = StaffDiagnosisRequest(
            booking_id="booking-3",
            pet_id="pet-x",
            species=Species.DOG,
            doctor_description="Mô tả ca bệnh",
        )

        with patch(
            "app.ai_diagnose.context_service.get_backend_client"
        ) as backend_factory:
            backend = backend_factory.return_value
            backend.get_booking = AsyncMock(
                return_value={
                    "bookingId": "booking-3",
                    "petId": "pet-y",
                    "clinicId": "clinic-1",
                }
            )

            with self.assertRaises(HTTPException) as exc_info:
                await service.resolve_request(
                    request=request,
                    user=user,
                    auth_token="token-123",
                )

        self.assertEqual(exc_info.exception.status_code, 422)

    async def test_admin_nonexistent_pet_returns_404(self):
        service = StaffDiagnosisContextService()
        user = CurrentUser(
            user_id="admin-1",
            role="ADMIN",
            is_admin=True,
        )
        request = StaffDiagnosisRequest(
            pet_id="pet-404",
            species=Species.DOG,
            doctor_description="Mô tả ca bệnh",
        )

        with patch(
            "app.ai_diagnose.context_service.get_backend_client"
        ) as backend_factory:
            backend = backend_factory.return_value
            backend.get_pet = AsyncMock(return_value={})

            with self.assertRaises(HTTPException) as exc_info:
                await service.resolve_request(
                    request=request,
                    user=user,
                    auth_token="token-123",
                )

        self.assertEqual(exc_info.exception.status_code, 404)
