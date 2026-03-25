"""HTTP client goi Spring Boot backend cho booking AI tools."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from app.config.settings import settings


class BackendClientError(Exception):
    """Backend client error voi message an toan cho AI tools."""


class SpringBackendClient:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[int] = None):
        self.base_url = (base_url or settings.SPRING_BACKEND_URL).rstrip("/")
        self.timeout = timeout or settings.MCP_TIMEOUT
        self.max_retries = 3

    async def _request(
        self,
        method: str,
        path: str,
        *,
        token: Optional[str] = None,
        params: Optional[Any] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}
        if json_body is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"

        delay_seconds = 0.5
        last_error: Optional[str] = None

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        params=params,
                        json=json_body,
                    )

                if 500 <= response.status_code < 600:
                    last_error = response.text
                    if attempt < self.max_retries:
                        await asyncio.sleep(delay_seconds)
                        delay_seconds *= 2
                        continue

                response.raise_for_status()
                if not response.content:
                    return None
                return response.json()
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                try:
                    error_payload = exc.response.json()
                    detail = error_payload.get("message") or error_payload.get("detail") or exc.response.text
                except Exception:
                    detail = exc.response.text

                logger.warning(
                    f"Spring backend request failed: {method} {url} -> {status_code} {detail}"
                )

                if status_code >= 500 and attempt < self.max_retries:
                    await asyncio.sleep(delay_seconds)
                    delay_seconds *= 2
                    continue

                safe_detail = str(detail or "").strip()
                if not safe_detail:
                    safe_detail = f"Backend request failed (HTTP {status_code})"
                elif safe_detail == "Backend request failed":
                    safe_detail = f"{safe_detail} (HTTP {status_code})"
                raise BackendClientError(safe_detail) from exc
            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning(f"Spring backend transport error: {url} {exc}")
                if attempt < self.max_retries:
                    await asyncio.sleep(delay_seconds)
                    delay_seconds *= 2
                    continue
                raise BackendClientError(f"Khong the ket noi backend booking: {exc}") from exc

        raise BackendClientError(last_error or "Khong the goi Spring backend")

    async def get_my_pets(self, token: str) -> Any:
        return await self._request("GET", "/pets/me", token=token)

    async def get_user_pets(self, token: str, user_id: Optional[str] = None) -> Any:
        """
        Compatibility wrapper for booking tools.

        `GET /pets/me` always resolves from JWT, so `user_id` is kept only to
        preserve the tool-facing signature and session consistency checks.
        """
        return await self.get_my_pets(token)

    async def get_vaccinations_by_pet(self, token: str, pet_id: str) -> List[Dict[str, Any]]:
        return await self._request("GET", f"/vaccinations/pet/{pet_id}", token=token)

    async def get_upcoming_vaccinations(self, token: str, pet_id: str) -> List[Dict[str, Any]]:
        return await self._request("GET", f"/vaccinations/pet/{pet_id}/upcoming", token=token)

    async def get_pet(self, token: str, pet_id: str) -> Any:
        return await self._request("GET", f"/pets/{pet_id}", token=token)

    async def get_staff_patients(
        self,
        *,
        token: str,
        clinic_id: str,
        staff_id: str,
    ) -> Any:
        return await self._request(
            "GET",
            "/pets/staff",
            token=token,
            params={"clinicId": clinic_id, "staffId": staff_id},
        )

    async def get_pet_emr_history(
        self,
        *,
        token: str,
        pet_id: str,
    ) -> Any:
        return await self._request("GET", f"/emr/pet/{pet_id}", token=token)

    async def find_nearby_clinics(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
        page: int = 0,
        size: int = 20,
    ) -> Dict[str, Any]:
        return await self._request(
            "GET",
            "/clinics/nearby",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "radius": radius_km,
                "page": page,
                "size": size,
            },
        )

    async def get_clinic_services(
        self,
        clinic_id: str,
        pet_species: Optional[str] = None,
        is_home_visit: Optional[bool] = None,
    ) -> Any:
        use_compatible_endpoint = pet_species is not None or is_home_visit is not None
        base_path = f"/services/by-clinic/{clinic_id}"
        if not use_compatible_endpoint:
            return await self._request("GET", base_path, params=None)

        params: Dict[str, Any] = {}
        if pet_species is not None:
            params["petSpecies"] = pet_species
        if is_home_visit is not None:
            params["isHomeVisit"] = is_home_visit

        compatible_path = f"{base_path}/compatible"
        return await self._request("GET", compatible_path, params=params)

    async def get_available_slots(
        self,
        clinic_id: str,
        date: str,
        service_ids: list[str],
    ) -> Any:
        params: list[tuple[str, Any]] = [
            ("clinicId", clinic_id),
            ("date", date),
        ]
        params.extend(("serviceIds", service_id) for service_id in service_ids)
        return await self._request("GET", "/bookings/public/available-slots", params=params)

    async def resolve_booking_context(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/ai-tools/booking/context", token=token, json_body=payload)

    async def get_booking_clinic_options(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/ai-tools/booking/clinic-options", token=token, json_body=payload)

    async def get_booking_slot_options(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/ai-tools/booking/slot-options", token=token, json_body=payload)

    async def build_booking_draft(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/ai-tools/booking/draft", token=token, json_body=payload)

    async def create_ai_booking(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/ai-tools/booking/create", token=token, json_body=payload)

    async def create_booking(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/bookings", token=token, json_body=payload)


_backend_client = SpringBackendClient()


def get_backend_client() -> SpringBackendClient:
    return _backend_client
