from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.middleware.auth import CurrentUser
from app.ai_diagnose.routes import analyze_staff_case
from app.ai_diagnose.schemas import (
    DoctorDiagnosisSynthesisResponse,
    Species,
    StaffDiagnosisRequest,
)


class StaffDiagnosisRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_blocks_non_staff_non_admin(self):
        payload = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Mô tả ca bệnh",
        )
        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with self.assertRaises(HTTPException) as exc_info:
            await analyze_staff_case(payload=payload, user=user, credentials=None)

        self.assertEqual(exc_info.exception.status_code, 403)

    async def test_route_resolves_context_before_service(self):
        payload = StaffDiagnosisRequest(
            booking_id="booking-1",
            species=Species.DOG,
            doctor_description="Mô tả ca bệnh",
        )
        user = CurrentUser(
            user_id="staff-1",
            role="STAFF",
            clinic_id="clinic-1",
            is_admin=False,
        )
        hydrated_payload = payload.model_copy(update={"species": Species.CAT})
        response = DoctorDiagnosisSynthesisResponse(request_id="req-1")
        credentials = type("Creds", (), {"credentials": "token-123"})()

        with (
            patch(
                "app.ai_diagnose.routes.get_staff_diagnosis_context_service"
            ) as resolver_factory,
            patch(
                "app.ai_diagnose.routes.get_staff_diagnosis_service"
            ) as service_factory,
        ):
            resolver_factory.return_value.resolve_request = AsyncMock(
                return_value=hydrated_payload
            )
            service_factory.return_value.analyze_case = AsyncMock(return_value=response)

            result = await analyze_staff_case(
                payload=payload,
                user=user,
                credentials=credentials,
            )

        resolver_factory.return_value.resolve_request.assert_awaited_once()
        service_factory.return_value.analyze_case.assert_awaited_once_with(
            hydrated_payload
        )
        self.assertEqual(result.request_id, "req-1")
