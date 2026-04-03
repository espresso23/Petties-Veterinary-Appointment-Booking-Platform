"""Resolve and hydrate trusted context for staff diagnosis requests."""

from __future__ import annotations

from datetime import date, datetime
import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from app.api.middleware.auth import CurrentUser
from app.services.backend_client import BackendClientError, get_backend_client

from .schemas import Sex, Species, StaffDiagnosisRequest

logger = logging.getLogger(__name__)


def _as_text(value: Any) -> Optional[str]:
    text = str(value).strip() if value is not None else ""
    return text or None


def _normalize_species(value: Any) -> Optional[Species]:
    if value is None:
        return None
    lowered = str(value).strip().lower()
    if lowered in {"dog", "cho", "chó"}:
        return Species.DOG
    if lowered in {"cat", "meo", "mèo"}:
        return Species.CAT
    return Species.OTHER if lowered else None


def _normalize_sex(value: Any) -> Optional[Sex]:
    if value is None:
        return None
    lowered = str(value).strip().lower()
    if lowered in {"male", "m", "đực", "duc"}:
        return Sex.MALE
    if lowered in {"female", "f", "cái", "cai"}:
        return Sex.FEMALE
    return Sex.UNKNOWN if lowered else None


def _normalize_allergies(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _parse_age_months(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return max(int(value), 0)

    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return max(int(text), 0)

    digits = "".join(ch for ch in text if ch.isdigit())
    if digits and ("tháng" in text or "month" in text.lower()):
        return int(digits)
    return None


def _age_months_from_birthdate(value: Any) -> Optional[int]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    normalized = text.replace("Z", "+00:00")
    parsed: Optional[date] = None
    for parser in (
        lambda raw: datetime.fromisoformat(raw).date(),
        lambda raw: date.fromisoformat(raw[:10]),
    ):
        try:
            parsed = parser(normalized)
            break
        except Exception:
            continue

    if parsed is None:
        return None

    today = date.today()
    months = (today.year - parsed.year) * 12 + (today.month - parsed.month)
    if today.day < parsed.day:
        months -= 1
    return max(months, 0)


class StaffDiagnosisContextService:
    """Verify booking and pet scope before staff diagnosis synthesis runs."""

    async def resolve_request(
        self,
        *,
        request: StaffDiagnosisRequest,
        user: CurrentUser,
        auth_token: Optional[str],
    ) -> StaffDiagnosisRequest:
        booking_id = _as_text(request.booking_id)
        pet_id = _as_text(request.pet_id)

        if not booking_id and not pet_id:
            return request

        if not auth_token:
            logger.warning(
                "Missing bearer token for context hydration; fallback to raw request for user=%s role=%s",
                user.user_id,
                user.role,
            )
            return request

        if booking_id:
            return await self._resolve_from_booking(
                request=request,
                user=user,
                auth_token=auth_token,
                booking_id=booking_id,
            )
        return await self._resolve_from_pet(
            request=request,
            user=user,
            auth_token=auth_token,
            pet_id=pet_id,
        )

    async def _resolve_from_booking(
        self,
        *,
        request: StaffDiagnosisRequest,
        user: CurrentUser,
        auth_token: str,
        booking_id: str,
    ) -> StaffDiagnosisRequest:
        booking = await self._fetch_booking(
            auth_token=auth_token, booking_id=booking_id
        )

        booking_pet_id = _as_text(booking.get("petId"))
        booking_clinic_id = _as_text(booking.get("clinicId"))
        requested_pet_id = _as_text(request.pet_id)

        if user.role.upper() == "STAFF":
            if (
                not user.clinic_id
                or not booking_clinic_id
                or booking_clinic_id != user.clinic_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Bạn không có quyền truy cập booking ngoài phạm vi clinic hiện tại.",
                )

        if requested_pet_id and booking_pet_id and requested_pet_id != booking_pet_id:
            raise HTTPException(
                status_code=422,
                detail="pet_id không khớp với booking_id hiện tại",
            )

        pet = None
        if booking_pet_id:
            pet = await self._fetch_pet_if_allowed(
                auth_token=auth_token,
                pet_id=booking_pet_id,
                user=user,
            )

        return self._build_hydrated_request(
            request=request,
            booking=booking,
            pet=pet,
            booking_id=booking_id,
            pet_id=booking_pet_id,
        )

    async def _resolve_from_pet(
        self,
        *,
        request: StaffDiagnosisRequest,
        user: CurrentUser,
        auth_token: str,
        pet_id: Optional[str],
    ) -> StaffDiagnosisRequest:
        if not pet_id:
            return request

        pet = await self._fetch_pet_if_allowed(
            auth_token=auth_token,
            pet_id=pet_id,
            user=user,
        )
        return self._build_hydrated_request(
            request=request,
            booking=None,
            pet=pet,
            booking_id=_as_text(request.booking_id),
            pet_id=pet_id,
        )

    async def _fetch_booking(
        self,
        *,
        auth_token: str,
        booking_id: str,
    ) -> Dict[str, Any]:
        backend = get_backend_client()
        try:
            booking = await backend.get_booking(auth_token, booking_id)
        except BackendClientError as exc:
            detail = str(exc).lower()
            if "404" in detail or "Không tìm thấy" in detail or "not found" in detail:
                raise HTTPException(
                    status_code=404,
                    detail="Không tìm thấy booking để đối chiếu chẩn đoán.",
                ) from exc
            raise HTTPException(
                status_code=502,
                detail="Không thể tải booking từ backend để xác minh ngữ cảnh chẩn đoán.",
            ) from exc

        if not isinstance(booking, dict) or not booking:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy booking để đối chiếu chẩn đoán.",
            )
        return booking

    async def _fetch_pet_if_allowed(
        self,
        *,
        auth_token: str,
        pet_id: str,
        user: CurrentUser,
    ) -> Dict[str, Any]:
        backend = get_backend_client()

        if user.role.upper() == "STAFF":
            if not user.clinic_id:
                raise HTTPException(
                    status_code=403,
                    detail="Không xác định được clinic của staff để đối chiếu hồ sơ thú cưng.",
                )

            try:
                patients = await backend.get_staff_patients(
                    token=auth_token,
                    clinic_id=user.clinic_id,
                    staff_id=user.user_id,
                )
            except BackendClientError as exc:
                raise HTTPException(
                    status_code=502,
                    detail="Không thể tải danh sách bệnh nhân của staff để xác minh pet_id.",
                ) from exc

            allowed = any(
                isinstance(item, dict) and _as_text(item.get("petId")) == pet_id
                for item in (patients or [])
            )
            if not allowed:
                raise HTTPException(
                    status_code=403,
                    detail="Bạn không có quyền truy cập pet ngoài phạm vi bệnh nhân của clinic.",
                )

        try:
            pet = await backend.get_pet(auth_token, pet_id)
        except BackendClientError as exc:
            detail = str(exc).lower()
            if (
                "404" in detail
                or "không tìm thấy" in detail
                or "not found" in detail
            ):
                raise HTTPException(
                    status_code=404,
                    detail="Không tìm thấy hồ sơ thú cưng để đối chiếu chẩn đoán.",
                ) from exc
            raise HTTPException(
                status_code=502,
                detail="Không thể tải hồ sơ thú cưng từ backend để xác minh ngữ cảnh chẩn đoán.",
            ) from exc

        if not isinstance(pet, dict) or not pet:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy hồ sơ thú cưng để đối chiếu chẩn đoán.",
            )
        return pet

    def _build_hydrated_request(
        self,
        *,
        request: StaffDiagnosisRequest,
        booking: Optional[Dict[str, Any]],
        pet: Optional[Dict[str, Any]],
        booking_id: Optional[str],
        pet_id: Optional[str],
    ) -> StaffDiagnosisRequest:
        species = (
            _normalize_species((pet or {}).get("species"))
            or _normalize_species((booking or {}).get("petSpecies"))
            or request.species
        )
        breed = (
            _as_text((pet or {}).get("breed"))
            or _as_text((booking or {}).get("petBreed"))
            or request.breed
        )
        weight_kg = (
            (pet or {}).get("weight")
            if (pet or {}).get("weight") not in (None, "")
            else (booking or {}).get("petWeight")
        )
        age_months = (
            _parse_age_months((pet or {}).get("ageMonths"))
            or _age_months_from_birthdate((pet or {}).get("dateOfBirth"))
            or request.age_months
        )
        sex = _normalize_sex((pet or {}).get("gender")) or request.sex
        allergies = (
            _normalize_allergies((pet or {}).get("allergies")) or request.allergies
        )

        return request.model_copy(
            update={
                "booking_id": booking_id or request.booking_id,
                "pet_id": pet_id or request.pet_id,
                "species": species,
                "breed": breed,
                "weight_kg": float(weight_kg)
                if weight_kg not in (None, "")
                else request.weight_kg,
                "age_months": age_months,
                "sex": sex,
                "allergies": allergies,
            }
        )


_staff_diagnosis_context_service: Optional[StaffDiagnosisContextService] = None


def get_staff_diagnosis_context_service() -> StaffDiagnosisContextService:
    global _staff_diagnosis_context_service
    if _staff_diagnosis_context_service is None:
        _staff_diagnosis_context_service = StaffDiagnosisContextService()
    return _staff_diagnosis_context_service
