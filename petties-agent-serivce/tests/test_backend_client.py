from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.backend_client import SpringBackendClient  # noqa: E402


class BackendClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_tc_unit_006_001_get_clinic_services_by_clinic_uses_public_endpoint(
        self,
    ):
        client = SpringBackendClient(base_url="http://backend.test")

        with patch.object(client, "_request", new_callable=AsyncMock) as request_mock:
            await client.get_clinic_services_by_clinic("clinic-1")

        request_mock.assert_awaited_once_with(
            "GET",
            "/api/services/by-clinic/clinic-1",
            params=None,
        )

    async def test_tc_unit_006_002_get_clinic_services_by_clinic_uses_compatible_endpoint_when_filtered(
        self,
    ):
        client = SpringBackendClient(base_url="http://backend.test")

        with patch.object(client, "_request", new_callable=AsyncMock) as request_mock:
            await client.get_clinic_services_by_clinic(
                "clinic-1",
                pet_species="DOG",
                is_home_visit=True,
            )

        request_mock.assert_awaited_once_with(
            "GET",
            "/api/services/by-clinic/clinic-1/compatible",
            params={"petSpecies": "DOG", "isHomeVisit": True},
        )

    async def test_tc_unit_006_003_get_my_clinic_services_uses_authenticated_endpoint(
        self,
    ):
        client = SpringBackendClient(base_url="http://backend.test")

        with patch.object(client, "_request", new_callable=AsyncMock) as request_mock:
            await client.get_my_clinic_services("jwt-token")

        request_mock.assert_awaited_once_with(
            "GET", "/api/services", token="jwt-token", params={}
        )
