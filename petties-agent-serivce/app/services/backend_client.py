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
        url = (base_url or settings.SPRING_BACKEND_URL).rstrip("/")
        # If the settings URL already includes /api, we strip it because 
        # all paths in this client already start with /api/
        if url.endswith("/api"):
            url = url[:-4]
        self.base_url = url
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
                    detail = (
                        error_payload.get("message")
                        or error_payload.get("detail")
                        or exc.response.text
                    )
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
                raise BackendClientError(
                    f"Khong the ket noi backend booking: {exc}"
                ) from exc

        raise BackendClientError(last_error or "Khong the goi Spring backend")

    async def get_user_pets(self, token: str, user_id: Optional[str] = None) -> Any:
        # Since PetController uses /me for current user, we prefer that
        return await self._request("GET", "/api/pets/me", token=token)

    async def get_current_user_profile(self, token: str) -> Any:
        """Fetch the current authenticated user's profile from Spring backend."""
        return await self._request("GET", "/api/users/profile", token=token)

    async def get_my_pets(self, token: str) -> Any:
        return await self._request("GET", "/api/pets/me", token=token)

    async def get_vaccinations_by_pet(
        self, token: str, pet_id: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            "GET", f"/api/vaccinations/pet/{pet_id}", token=token
        )

    async def get_upcoming_vaccinations(
        self, token: str, pet_id: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            "GET", f"/api/vaccinations/pet/{pet_id}/upcoming", token=token
        )

    async def get_pet(self, token: str, pet_id: str) -> Any:
        return await self._request("GET", f"/api/pets/{pet_id}", token=token)

    async def get_booking(self, token: str, booking_id: str) -> Any:
        return await self._request("GET", f"/api/bookings/{booking_id}", token=token)

    async def get_staff_patients(
        self, token: str, clinic_id: str, staff_id: str
    ) -> Any:
        params = {"clinicId": clinic_id, "staffId": staff_id}
        return await self._request("GET", "/api/pets/staff", token=token, params=params)

    async def get_pet_emr_history(
        self, token: str, pet_id: str
    ) -> Any:
        return await self._request("GET", f"/api/emr/pet/{pet_id}", token=token)

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
            "/api/clinics/nearby",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "radius": radius_km,
                "page": page,
                "size": size,
            },
        )

    async def get_clinic_services_by_clinic(
        self,
        clinic_id: str,
        pet_species: Optional[str] = None,
        is_home_visit: Optional[bool] = None,
    ) -> Any:
        use_compatible_endpoint = pet_species is not None or is_home_visit is not None
        base_path = f"/api/services/by-clinic/{clinic_id}"
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
        return await self._request(
            "GET", "/api/bookings/public/available-slots", params=params
        )

    async def resolve_booking_context(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request(
            "POST", "/api/ai-tools/booking/context", token=token, json_body=payload
        )

    async def get_booking_clinic_options(
        self, token: str, payload: Dict[str, Any]
    ) -> Any:
        return await self._request(
            "POST",
            "/api/ai-tools/booking/clinic-options",
            token=token,
            json_body=payload,
        )

    async def get_booking_slot_options(
        self, token: str, payload: Dict[str, Any]
    ) -> Any:
        return await self._request(
            "POST", "/api/ai-tools/booking/slot-options", token=token, json_body=payload
        )

    async def create_ai_booking(self, token: str, payload: Dict[str, Any]) -> Any:
        return await self._request(
            "POST", "/api/ai-tools/booking/create", token=token, json_body=payload
        )

    async def get_clinic_bookings(
        self,
        token: str,
        clinic_id: str,
        status: Optional[str] = None,
        booking_type: Optional[str] = None,
        page: int = 0,
        size: int = 20,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"page": page, "size": size}
        if status:
            params["status"] = status
        if booking_type:
            params["type"] = booking_type
        return await self._request(
            "GET", f"/api/bookings/clinic/{clinic_id}", token=token, params=params
        )

    async def get_my_bookings(
        self,
        token: str,
        status: Optional[str] = None,
        page: int = 0,
        size: int = 10,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"page": page, "size": size}
        if status:
            params["status"] = status
        return await self._request(
            "GET", "/api/bookings/my-bookings", token=token, params=params
        )

    async def get_my_clinics(self, token: str) -> Any:
        """Get clinics owned by current user (CLINIC_OWNER/MANAGER)."""
        return await self._request("GET", "/api/clinics/owner/my-clinics", token=token)

    async def get_clinic_services(
        self, token: str, clinic_id: Optional[str] = None, is_home_visit: bool = None, is_active: bool = None
    ) -> list:
        """Get services for a clinic. If clinic_id is provided, use by-clinic endpoint."""
        params = {}
        if is_home_visit is not None:
            params["isHomeVisit"] = is_home_visit
        if is_active is not None:
            params["isActive"] = is_active
            
        if clinic_id:
            return await self._request("GET", f"/api/services/by-clinic/{clinic_id}", token=token, params=params)
        return await self._request("GET", "/api/services", token=token, params=params)

    async def get_my_clinic_services(
        self,
        token: str,
        clinic_id: Optional[str] = None,
        is_home_visit: Optional[bool] = None,
        is_active: Optional[bool] = None,
    ) -> Any:
        """Compatibility alias for clinic tools service listing."""
        return await self.get_clinic_services(
            token,
            clinic_id=clinic_id,
            is_home_visit=is_home_visit,
            is_active=is_active,
        )

    async def search_clinics_by_name(
        self,
        name: str,
        size: int = 10,
    ) -> list:
        """Search clinics by name (public access, no token required).

        Calls GET /api/clinics/search?query=<name>&size=<size>.
        Returns a plain list extracted from the Page response.
        """
        response = await self._request(
            "GET",
            "/api/clinics/search",
            params={"query": name, "size": size, "page": 0},
        )
        if isinstance(response, list):
            return response
        if isinstance(response, dict):
            # Spring Page: { "content": [...], "totalElements": ... }
            content = response.get("content") or response.get("data") or []
            return content if isinstance(content, list) else []
        return []


    async def create_service(self, token: str, payload: dict) -> dict:
        """Create a new service. payload must contain clinicId for multi-clinic support."""
        return await self._request(
            "POST", "/api/services", token=token, json_body=payload
        )

    async def create_clinic_service(self, token: str, payload: dict) -> dict:
        """Compatibility alias for clinic tools service creation."""
        return await self.create_service(token, payload)

    async def update_service_info(
        self, token: str, service_id: str, payload: dict
    ) -> dict:
        """Update service information."""
        return await self._request(
            "PUT", f"/api/services/{service_id}", token=token, json_body=payload
        )

    async def update_clinic_service(
        self, token: str, service_id: str, payload: dict
    ) -> dict:
        """Compatibility alias for clinic tools service updates."""
        return await self.update_service_info(token, service_id, payload)

    async def get_master_services(
        self,
        token: str,
        category: Optional[str] = None,
        pet_type: Optional[str] = None,
    ) -> Any:
        """Get all master services (service templates)."""
        params = {}
        if category:
            params["category"] = category
        if pet_type:
            params["petType"] = pet_type
        return await self._request(
            "GET",
            "/api/master-services",
            token=token,
            params=params if params else None,
        )

    async def get_clinic_today_bookings(
        self, token: str, clinic_id: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            "GET", f"/api/bookings/clinic/{clinic_id}/today", token=token
        )

    async def get_clinic_revenue(
        self,
        token: str,
        clinic_id: str,
        period: str = "MONTH",
    ) -> Any:
        """Get revenue data for a clinic."""
        return await self._request(
            "GET",
            f"/api/payments/history/clinic/{clinic_id}/revenue",
            token=token,
            params={"period": period},
        )

    async def get_clinic_revenue_breakdown(
        self,
        token: str,
        clinic_id: str,
    ) -> Any:
        """Get revenue breakdown (QR vs Cash) for a clinic."""
        return await self._request(
            "GET", f"/api/payments/history/clinic/{clinic_id}/breakdown", token=token
        )

    async def get_clinic_staff(
        self, token: str, clinic_id: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            "GET", f"/api/clinics/{clinic_id}/staff", token=token
        )

    async def get_available_staff_for_reassign(
        self, token: str, booking_id: str, service_id: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            "GET",
            f"/api/bookings/{booking_id}/services/{service_id}/available-staff",
            token=token,
        )

    async def reassign_staff_for_service(
        self, token: str, booking_id: str, service_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        return await self._request(
            "PUT",
            f"/api/bookings/{booking_id}/services/{service_id}/reassign",
            token=token,
            json_body=payload,
        )

    async def confirm_booking(self, token: str, booking_id: str) -> Dict[str, Any]:
        return await self._request(
            "POST",
            f"/api/bookings/{booking_id}/confirm",
            token=token,
        )

    async def cancel_booking(
        self, token: str, booking_id: str, reason: str
    ) -> Dict[str, Any]:
        return await self._request(
            "POST",
            f"/api/bookings/{booking_id}/cancel",
            token=token,
            params={"reason": reason},
        )

    async def get_booking_availability(
        self, token: str, booking_id: str
    ) -> Dict[str, Any]:
        return await self._request(
            "GET", f"/api/bookings/{booking_id}/availability", token=token
        )

    async def get_clinic_shifts(
        self, token: str, clinic_id: str, start_date: str, end_date: str
    ) -> List[Dict[str, Any]]:
        return await self._request(
            "GET",
            f"/api/clinics/{clinic_id}/shifts",
            token=token,
            params={"startDate": start_date, "endDate": end_date},
        )

    async def get_clinic_staff_shifts(
        self, token: str, clinic_id: str, start_date: str, end_date: str
    ) -> List[Dict[str, Any]]:
        """Alias for get_clinic_shifts — returns shifts with slot-level detail.

        Called by staff_tools.get_slot_availability.
        """
        return await self.get_clinic_shifts(token, clinic_id, start_date, end_date)

    async def get_clinic_by_id(self, clinic_id: str) -> Any:
        """Get clinic info by ID (public access, no token required).

        Called by booking_tools.get_clinic_detail.
        Maps to GET /api/clinics/{id} which is public in ClinicController.
        """
        return await self._request("GET", f"/api/clinics/{clinic_id}")

    async def get_clinic_reviews(self, clinic_id: str) -> List[Dict[str, Any]]:
        """Fetch detailed reviews for a clinic. Public access.
        Maps to GET /api/reviews/clinic/{clinicId}
        """
        response = await self._request("GET", f"/api/reviews/clinic/{clinic_id}")
        return response if isinstance(response, list) else []



_backend_client = SpringBackendClient()


def get_backend_client() -> SpringBackendClient:
    return _backend_client

