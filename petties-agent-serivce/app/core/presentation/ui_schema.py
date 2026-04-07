"""
Petties AI Agent Service - Presentation Layer Schema
This module defines the UI Schema contracts that the Presentation Layer builds
and the Render Layer (Web/Mobile) consumes.

Based on PLAN.md: 4-Layer Architecture for Dynamic Components.
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class LayoutType(str, Enum):
    LIST = "list"
    GRID = "grid"
    CARD = "card"
    SLOT_GRID = "slot_grid"


class ComponentType(str, Enum):
    PET_CARD = "pet_card"
    CLINIC_CARD = "clinic_card"
    SERVICE_CARD = "service_card"
    SERVICE_CHIP = "service_chip"
    SLOT_BUTTON = "slot_button"
    BOOKING_SUMMARY = "booking_summary"
    EMR_SUMMARY = "emr_summary"
    VACCINATION_CARD = "vaccination_card"
    TEXT = "text"
    BADGE = "badge"
    BUTTON = "button"
    WEB_RESULT_CARD = "web_result_card"
    IMAGE_GALLERY = "image_gallery"
    EMPTY_STATE = "empty_state"
    ERROR_CARD = "error_card"


class ActionType(str, Enum):
    SELECT_ITEM = "select_item"
    SELECT_SERVICES = "select_services"
    CONFIRM_BOOKING = "confirm_booking"
    CONFIRM_SERVICE_CREATE = "confirm_service_create"
    CONFIRM_SERVICE_BATCH_CREATE = "confirm_service_batch_create"
    CONFIRM_SERVICE_UPDATE = "confirm_service_update"
    OPEN_NATIVE_CONFIRM = "open_native_confirm"
    CANCEL_FLOW = "cancel_flow"
    LOAD_MORE = "load_more"
    OPEN_DETAIL = "open_detail"
    RETRY_WITH_CHANGE = "retry_with_change"
    DISMISS = "dismiss"


class UIAction(BaseModel):
    type: ActionType
    label: str
    payload: Optional[Dict[str, Any]] = None


class UIComponent(BaseModel):
    type: ComponentType
    id: str  # Mandatory when actions are present, recommended otherwise
    data: Dict[str, Any]
    actions: Optional[List[UIAction]] = None


class PaginationMetadata(BaseModel):
    total: int
    shown: int
    has_more: bool
    next_cursor: Optional[str] = None


class UIMetadata(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    empty_state: Optional[str] = None
    pagination: Optional[PaginationMetadata] = None


class UISchemaV1(BaseModel):
    version: Literal["1.0"] = "1.0"
    layout: LayoutType
    components: List[UIComponent]
    metadata: Optional[UIMetadata] = None
