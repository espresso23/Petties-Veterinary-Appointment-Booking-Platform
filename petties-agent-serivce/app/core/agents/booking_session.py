"""Booking session state and reducer helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.core.agents.state import map_booking_status_to_stage

STATUS_IDLE = "IDLE"
STATUS_COLLECTING = "COLLECTING"
STATUS_REVIEWING = "REVIEWING"
STATUS_CONFIRMING = "CONFIRMING"
STATUS_COMPLETED = "COMPLETED"
STATUS_SUSPENDED = "SUSPENDED"
STATUS_CANCELLED = "CANCELLED"


class BookingDraft(BaseModel):
    pet_id: Optional[str] = None
    pet_name: Optional[str] = None
    clinic_id: Optional[str] = None
    clinic_hint: Optional[str] = None
    clinic_name: Optional[str] = None
    service_ids: List[str] = Field(default_factory=list)
    service_names: List[str] = Field(default_factory=list)
    booking_date: Optional[str] = None
    start_time: Optional[str] = None
    time_preference: Optional[str] = None
    booking_type: Optional[str] = None
    home_address: Optional[str] = None
    home_lat: Optional[float] = None
    home_long: Optional[float] = None

    def get_missing_fields(self) -> List[str]:
        missing: List[str] = []
        if not self.pet_id:
            missing.append("pet_id")
        if not self.clinic_id:
            missing.append("clinic_id")
        if not self.service_ids:
            missing.append("service_ids")
        if not self.booking_date:
            missing.append("booking_date")
        if not self.start_time:
            missing.append("start_time")
        if not self.booking_type:
            missing.append("booking_type")
        if self.booking_type == "HOME_VISIT":
            if not self.home_address:
                missing.append("home_address")
            if self.home_lat is None or self.home_long is None:
                missing.append("home_coordinates")
        return missing

    def to_collected_fields(self) -> Dict[str, Any]:
        return {
            key: value
            for key, value in self.model_dump(mode="json").items()
            if value not in (None, [], "")
        }


class BookingSessionState(BaseModel):
    active: bool = False
    status: str = STATUS_IDLE
    intent: Optional[str] = None
    draft: BookingDraft = Field(default_factory=BookingDraft)
    last_confirmed_snapshot: Optional[Dict[str, Any]] = None
    interruption_reason: Optional[str] = None
    cancellation_reason: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc)

    def sync_status_from_draft(self) -> None:
        if not self.active:
            return
        if self.status == STATUS_SUSPENDED:
            return
        self.status = (
            STATUS_REVIEWING if self.is_ready_for_review else STATUS_COLLECTING
        )
        self.touch()

    @property
    def missing_fields(self) -> List[str]:
        return self.draft.get_missing_fields()

    @property
    def is_ready_for_review(self) -> bool:
        return not self.missing_fields

    @property
    def stage(self) -> str:
        return map_booking_status_to_stage(self.status, active=self.active)

    def to_summary(self) -> Dict[str, Any]:
        return {
            "active": self.active,
            "status": self.status,
            "stage": self.stage,
            "intent": self.intent,
            "missing_fields": self.missing_fields,
            "ready_for_review": self.is_ready_for_review,
            "draft": self.draft.model_dump(mode="json"),
            "collected_fields": self.draft.to_collected_fields(),
            "interruption_reason": self.interruption_reason,
            "updated_at": self.updated_at.isoformat(),
        }


def start_booking_session(
    intent: str = "create_booking",
    initial_draft: Optional[Dict[str, Any]] = None,
) -> BookingSessionState:
    state = BookingSessionState(
        active=True,
        status=STATUS_COLLECTING,
        intent=intent,
        draft=BookingDraft(**(initial_draft or {})),
        cancellation_reason=None,
    )
    state.sync_status_from_draft()
    return state


def merge_booking_draft(
    state: BookingSessionState,
    updates: Dict[str, Any],
) -> Dict[str, Any]:
    if not state.active:
        raise ValueError("Cannot update draft when booking session is not active")

    sanitized_updates = {
        key: value
        for key, value in updates.items()
        if key in BookingDraft.model_fields and value is not None
    }

    draft_dict = state.draft.model_dump(mode="python")
    invalidated_fields: List[str] = []

    old_clinic_id = draft_dict.get("clinic_id")
    new_clinic_id = sanitized_updates.get("clinic_id")
    if new_clinic_id and new_clinic_id != old_clinic_id:
        draft_dict["service_ids"] = []
        draft_dict["service_names"] = []
        draft_dict["start_time"] = None
        invalidated_fields.extend(["service_ids", "service_names", "start_time"])

    old_booking_date = draft_dict.get("booking_date")
    new_booking_date = sanitized_updates.get("booking_date")
    if new_booking_date and new_booking_date != old_booking_date:
        if draft_dict.get("start_time") is not None:
            invalidated_fields.append("start_time")
        draft_dict["start_time"] = None

    old_booking_type = draft_dict.get("booking_type")
    new_booking_type = sanitized_updates.get("booking_type")
    if new_booking_type and new_booking_type != old_booking_type:
        if new_booking_type == "IN_CLINIC":
            draft_dict["home_address"] = None
            draft_dict["home_lat"] = None
            draft_dict["home_long"] = None
            invalidated_fields.extend(["home_address", "home_lat", "home_long"])

    old_pet_id = draft_dict.get("pet_id")
    new_pet_id = sanitized_updates.get("pet_id")
    if new_pet_id and new_pet_id != old_pet_id:
        if draft_dict.get("service_ids"):
            draft_dict["service_ids"] = []
            draft_dict["service_names"] = []
            invalidated_fields.extend(["service_ids", "service_names"])
        if draft_dict.get("start_time") is not None:
            draft_dict["start_time"] = None
            if "start_time" not in invalidated_fields:
                invalidated_fields.append("start_time")

    for key, value in sanitized_updates.items():
        draft_dict[key] = value

    state.draft = BookingDraft.model_validate(draft_dict)
    state.last_confirmed_snapshot = None
    state.interruption_reason = None
    state.cancellation_reason = None
    state.sync_status_from_draft()

    return {
        "invalidated_fields": invalidated_fields,
        "missing_fields": state.missing_fields,
        "ready_for_review": state.is_ready_for_review,
        "draft": state.draft.model_dump(mode="json"),
        "summary": state.to_summary(),
    }


def suspend_booking_session(
    state: BookingSessionState,
    reason: str = "User asked off-topic question",
) -> BookingSessionState:
    if state.active:
        state.status = STATUS_SUSPENDED
        state.interruption_reason = reason
        state.touch()
    return state


def resume_booking_session(state: BookingSessionState) -> BookingSessionState:
    if state.active and state.status == STATUS_SUSPENDED:
        state.status = STATUS_COLLECTING
        state.interruption_reason = None
        state.sync_status_from_draft()
    return state


def complete_booking_session(state: BookingSessionState) -> BookingSessionState:
    state.active = False
    state.status = STATUS_COMPLETED
    state.last_confirmed_snapshot = state.draft.model_dump(mode="json")
    state.interruption_reason = None
    state.cancellation_reason = None
    state.touch()
    return state


def cancel_booking_session(
    state: BookingSessionState,
    reason: str = "USER_CANCELLED",
) -> BookingSessionState:
    state.active = False
    state.status = STATUS_CANCELLED
    state.cancellation_reason = reason
    state.interruption_reason = None
    state.touch()
    return state


def mark_booking_session_confirming(
    state: BookingSessionState,
    confirmation_snapshot: Dict[str, Any],
) -> BookingSessionState:
    if not state.active:
        raise ValueError("Cannot mark confirmation for inactive booking session")

    state.status = STATUS_CONFIRMING
    state.last_confirmed_snapshot = confirmation_snapshot
    state.touch()
    return state
