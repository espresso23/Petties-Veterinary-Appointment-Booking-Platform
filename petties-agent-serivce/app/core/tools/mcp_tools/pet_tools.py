"""AI tools for pet management."""

from __future__ import annotations
from typing import Any, Dict, Optional
from loguru import logger

from app.core.tools.mcp_server import mcp_server
from app.core.tools.auth_deps import _require_auth_token, AuthenticationRequiredError
from app.services.backend_client import BackendClientError, get_backend_client
from app.core.tools.booking_helpers import (
    _standardize_booking_tool_response,
    _attach_booking_error_metadata,
    _calculate_age_years,
    _resolve_user_id
)

@mcp_server.tool
@_standardize_booking_tool_response
async def get_user_pets(user_id: Optional[str] = None) -> Dict[str, Any]:
    """Lấy danh sách thú cưng của người dùng hiện tại.

    Sử dụng khi:
    - User hỏi "mình có bao nhiêu pet", "danh sách thú cưng của mình"
    - Cần chọn pet để đặt lịch khám
    - Kiểm tra thông tin tuổi, giống loài của pet

    Params:
        user_id: Optional ID của người dùng (mặc định lấy từ session)

    Returns:
        pets: Danh sách thú cưng (id, name, species, breed, gender, age)
        total_pets: Tổng số lượng thú cưng
    """
    try:
        token = _require_auth_token()
        resolved_user_id = _resolve_user_id(user_id)
    except AuthenticationRequiredError as e:
        return _attach_booking_error_metadata(
            {"pets": [], "total_pets": 0, "message": str(e), "requires_auth": True},
            error_code="UNAUTHORIZED",
            suggestion="Vui lòng đăng nhập lại để xem danh sách thú cưng.",
            recoverable=True,
        )
    except Exception as e:
        return _attach_booking_error_metadata(
            {"pets": [], "total_pets": 0, "message": str(e)},
            error_code="UNAUTHORIZED",
            suggestion="Lỗi xác thực người dùng.",
            recoverable=True,
        )

    client = get_backend_client()
    try:
        pets = await client.get_user_pets(token, resolved_user_id)
    except BackendClientError as exc:
        logger.error(f"get_user_pets failed: {exc}")
        return _attach_booking_error_metadata(
            {"pets": [], "total_pets": 0, "message": f"Không thể tải danh sách thú cưng: {exc}"},
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau ít phút.",
            recoverable=True,
        )

    formatted_pets = [
        {
            "id": pet.get("id"),
            "name": pet.get("name"),
            "species": pet.get("species"),
            "breed": pet.get("breed"),
            "gender": pet.get("gender"),
            "date_of_birth": pet.get("dateOfBirth"),
            "age_years": _calculate_age_years(pet.get("dateOfBirth")),
            "weight": pet.get("weight"),
            "image_url": pet.get("imageUrl"),
        }
        for pet in pets
    ]

    return {
        "pets": formatted_pets,
        "total_pets": len(formatted_pets),
        "message": None if formatted_pets else "Bạn chưa có thú cưng nào được đăng ký.",
    }
