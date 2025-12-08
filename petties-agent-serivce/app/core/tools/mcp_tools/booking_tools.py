"""
PETTIES AGENT SERVICE - Booking Tools (FastMCP)
Code-based tools cho Booking Agent - Viết bằng FastMCP

Package: app.core.tools.mcp_tools
Purpose:
    - Xử lý đặt lịch khám (check slot trống, tạo booking)
    - Tích hợp với Spring Boot backend qua MCP
    - Tools được scan và sync vào PostgreSQL

Tools:
    - check_slot: Kiểm tra slot trống
    - create_booking: Tạo booking mới

Reference: UC-02 - Cập nhật MCP Tool mới từ Code
Version: v0.0.1
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List
import httpx
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ===== BOOKING TOOLS =====

@mcp_server.tool()
async def check_slot(doctor_id: str, date: str) -> Dict[str, Any]:
    """
    Kiểm tra slot thời gian trống cho booking

    Args:
        doctor_id: ID của bác sĩ (format: DOC_xxxxx)
        date: Ngày khám (format: YYYY-MM-DD)

    Returns:
        Dict chứa:
            - available: Boolean - Có slot trống không
            - slots: List[str] - Danh sách slot trống (format: HH:MM)
            - doctor_name: str - Tên bác sĩ
            - date: str - Ngày được check

    Example:
        >>> await check_slot("DOC_12345", "2026-01-15")
        {
            "available": True,
            "slots": ["09:00", "10:00", "14:00", "15:30"],
            "doctor_name": "Dr. Nguyễn Văn A",
            "date": "2026-01-15"
        }

    Purpose:
        - Booking Agent dùng tool này để check slot trống
        - Call Spring Boot backend API qua MCP integration
    """
    try:
        # Call Spring Boot backend API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SPRING_BACKEND_URL}/bookings/check-slot",
                params={
                    "doctorId": doctor_id,
                    "date": date
                },
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Checked slot for doctor {doctor_id} on {date}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error checking slot: {e}")
        return {
            "available": False,
            "slots": [],
            "error": str(e)
        }


@mcp_server.tool()
async def create_booking(
    pet_id: str,
    doctor_id: str,
    date: str,
    time: str,
    service_type: str = "general_checkup"
) -> Dict[str, Any]:
    """
    Tạo booking mới cho thú cưng

    Args:
        pet_id: ID của thú cưng (format: PET_xxxxx)
        doctor_id: ID của bác sĩ (format: DOC_xxxxx)
        date: Ngày khám (format: YYYY-MM-DD)
        time: Giờ khám (format: HH:MM)
        service_type: Loại dịch vụ (general_checkup, vaccination, surgery, emergency)

    Returns:
        Dict chứa:
            - booking_id: str - ID của booking mới tạo
            - status: str - Trạng thái (confirmed, pending, rejected)
            - pet_name: str - Tên thú cưng
            - doctor_name: str - Tên bác sĩ
            - appointment_time: str - Thời gian hẹn

    Example:
        >>> await create_booking(
        ...     pet_id="PET_67890",
        ...     doctor_id="DOC_12345",
        ...     date="2026-01-15",
        ...     time="10:00",
        ...     service_type="general_checkup"
        ... )
        {
            "booking_id": "BK_2026011512345",
            "status": "confirmed",
            "pet_name": "Milo",
            "doctor_name": "Dr. Nguyễn Văn A",
            "appointment_time": "2026-01-15 10:00"
        }

    Purpose:
        - Booking Agent dùng tool này sau khi user xác nhận slot
        - Call Spring Boot backend API để tạo booking trong database
    """
    try:
        # Call Spring Boot backend API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.SPRING_BACKEND_URL}/bookings/create",
                json={
                    "petId": pet_id,
                    "doctorId": doctor_id,
                    "date": date,
                    "time": time,
                    "serviceType": service_type
                },
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Created booking {data.get('booking_id')} for pet {pet_id}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error creating booking: {e}")
        return {
            "booking_id": None,
            "status": "failed",
            "error": str(e)
        }


@mcp_server.tool()
async def cancel_booking(booking_id: str, reason: str = "") -> Dict[str, Any]:
    """
    Hủy booking đã tạo

    Args:
        booking_id: ID của booking cần hủy (format: BK_xxxxx)
        reason: Lý do hủy (optional)

    Returns:
        Dict chứa:
            - success: bool - Hủy thành công hay không
            - booking_id: str - ID booking đã hủy
            - message: str - Thông báo

    Purpose:
        - Cho phép user hủy booking qua Agent
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.SPRING_BACKEND_URL}/bookings/cancel",
                json={
                    "bookingId": booking_id,
                    "reason": reason
                },
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Cancelled booking {booking_id}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error cancelling booking: {e}")
        return {
            "success": False,
            "booking_id": booking_id,
            "error": str(e)
        }


@mcp_server.tool()
async def get_booking_history(pet_id: str, limit: int = 10) -> Dict[str, Any]:
    """
    Lấy lịch sử booking của thú cưng

    Args:
        pet_id: ID của thú cưng (format: PET_xxxxx)
        limit: Số lượng booking tối đa trả về (default: 10)

    Returns:
        Dict chứa:
            - pet_id: str
            - pet_name: str
            - bookings: List[Dict] - Danh sách booking history

    Purpose:
        - Agent dùng để tra cứu lịch sử khám của thú cưng
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SPRING_BACKEND_URL}/bookings/history/{pet_id}",
                params={"limit": limit},
                timeout=settings.MCP_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

        logger.info(f"✅ Retrieved booking history for pet {pet_id}")
        return data

    except httpx.HTTPError as e:
        logger.error(f"❌ Error getting booking history: {e}")
        return {
            "pet_id": pet_id,
            "bookings": [],
            "error": str(e)
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("🔧 Booking Tools registered in FastMCP:")
    print("  - check_slot")
    print("  - create_booking")
    print("  - cancel_booking")
    print("  - get_booking_history")
