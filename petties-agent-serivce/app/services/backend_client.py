"""HTTP client gọi Spring Boot backend cho booking AI tools."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

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
                    "Spring backend request failed: %s %s -> %s %s",
                    method,
                    url,
                    status_code,
                    detail,
                )

                if status_code >= 500 and attempt < self.max_retries:
                    await asyncio.sleep(delay_seconds)
                    delay_seconds *= 2
                    continue

                raise BackendClientError(detail or "Backend request failed") from exc
            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning("Spring backend transport error: %s %s", url, exc)
                if attempt < self.max_retries:
                    await asyncio.sleep(delay_seconds)
                    delay_seconds *= 2
                    continue
                raise BackendClientError(f"Không thể kết nối backend booking: {exc}") from exc

        raise BackendClientError(last_error or "Không thể gọi Spring backend")

    async def get_my_pets(self, token: str) -> Any:
        return await self._request("GET", "/pets/me", token=token)

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

    async def get_clinic_services(self, clinic_id: str, pet_species: Optional[str] = None) -> Any:
        path = f"/services/by-clinic/{clinic_id}/compatible" if pet_species else f"/services/by-clinic/{clinic_id}"
        params = {"petSpecies": pet_species} if pet_species else None
        return await self._request("GET", path, params=params)

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

    async def create_booking(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request("POST", "/bookings", token=token, json_body=payload)


_backend_client = SpringBackendClient()


def get_backend_client() -> SpringBackendClient:
    return _backend_client