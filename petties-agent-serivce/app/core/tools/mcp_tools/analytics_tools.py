"""
PETTIES AGENT SERVICE - Analytics Tools
Tools for retrieving clinic revenue and booking insights.
"""

from typing import Any, Dict, Optional
import logging

from app.core.tools.contracts import (
    build_tool_success_response,
    build_tool_error_response,
    classify_error_code,
)
from app.core.tools.mcp_server import mcp_server
from app.core.tool_runtime_context import (
    get_tool_runtime_context,
)
from app.core.tools.auth_deps import _require_auth_token
from app.services.backend_client import BackendClientError, get_backend_client
from app.core.tools.tool_policy import get_tool_policy

logger = logging.getLogger(__name__)


def _is_tool_available(tool_name: str) -> bool:
    """Clinic tools are runtime-filtered elsewhere; here we only validate registration."""
    return get_tool_policy(tool_name) is not None


# Refactored: authentication helpers moved to app.core.tools.auth_deps


@mcp_server.tool
async def get_clinic_today_summary(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_name_hint: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lấy danh sách các lịch khám trong ngày hôm nay của phòng khám.
    Sử dụng clinic_name_hint để tự động tìm ID phòng khám.

    Params:
        user_id: Override user ID (thường không cần truyền, lấy từ session)
        session_id: Session ID (thường không cần truyền, lấy từ session)
        clinic_id: Override clinic ID (thường không cần truyền, lấy từ session)

    Returns:
        Tổng quan lịch khám hôm nay và danh sách lịch khám.
    """
    if not _is_tool_available("get_clinic_today_summary"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Công cụ get_clinic_today_summary chưa được kích hoạt.",
            recoverable=True,
            suggestion="Liên hệ quản trị viên.",
        )

    ctx = get_tool_runtime_context()
    token = _require_auth_token()
    client = get_backend_client()

    # Resolve clinic_id if hint provided
    active_clinic_id = clinic_id or (ctx.clinic_id if ctx else None)
    if clinic_name_hint:
        try:
            from app.core.tools.mcp_tools.clinic_tools import get_my_clinics

            resp = await get_my_clinics(clinic_name_hint=clinic_name_hint)
            if resp.get("success") and resp.get("target_clinic_id"):
                active_clinic_id = resp["target_clinic_id"]
        except Exception:
            pass

    # Final check: if active_clinic_id still looks like a name hint (not UUID), it's an error
    from app.core.tools.contracts import _is_uuid

    if active_clinic_id and not _is_uuid(active_clinic_id):
        # The hint didn't resolve, but we have a hint-like ID
        clinic_name_hint = active_clinic_id
        active_clinic_id = None

    if not active_clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=True,
            suggestion="Vui lòng cung cấp tên phòng khám hoặc chọn phòng khám hoạt động.",
        )

    try:
        bookings = await client.get_clinic_today_bookings(token, active_clinic_id)

        if bookings is None:
            bookings = []

        total = len(bookings)
        pending = sum(1 for b in bookings if b.get("status") == "PENDING")
        confirmed = sum(1 for b in bookings if b.get("status") == "CONFIRMED")
        in_progress = sum(1 for b in bookings if b.get("status") == "IN_PROGRESS")
        completed = sum(1 for b in bookings if b.get("status") == "COMPLETED")
        cancelled = sum(1 for b in bookings if b.get("status") == "CANCELLED")

        summary = {
            "total_bookings": total,
            "pending": pending,
            "confirmed": confirmed,
            "in_progress": in_progress,
            "completed": completed,
            "cancelled": cancelled,
        }

        return build_tool_success_response(
            data={
                "summary": summary,
                "bookings": bookings,
            },
            metadata={"ui_card": "clinic_today_summary", "is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_clinic_today_summary: {e}")
        normalized_error = str(e).lower()
        if "không có quyền" in normalized_error or "khong co quyen" in normalized_error:
            return build_tool_error_response(
                error_code="FORBIDDEN",
                message="Bạn không có quyền xem lịch khám của phòng khám này.",
                recoverable=True,
                suggestion="Vui lòng chọn đúng phòng khám bạn đang quản lý hoặc liên hệ quản trị viên.",
            )
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi khi lấy thông tin ngày: {str(e)}",
            recoverable=True,
        )
    except Exception as e:
        logger.error(f"System error in get_clinic_today_summary: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống: {str(e)}",
            recoverable=True,
        )


@mcp_server.tool
async def analyze_revenue_trends(
    period: str = "MONTH",
    clinic_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyze revenue trends for the current clinic over a specific period.
    Use clinic_name_hint to automatically find the clinic.

    Args:
        period: Time period to aggregate (DAY, WEEK, MONTH, YEAR). Default is MONTH.
        clinic_name_hint: Name of the clinic to analyze (optional).

    Returns:
        Revenue breakdown and historical data points.
    """
    if not _is_tool_available("analyze_revenue_trends"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Cong cu analyze_revenue_trends chua duoc kich hoat",
            recoverable=True,
            suggestion="Lien he quan tri vien de biet them",
        )

    ctx = get_tool_runtime_context()
    token = _require_auth_token()
    client = get_backend_client()

    # Resolve clinic_id if hint provided
    active_clinic_id = clinic_id or (ctx.clinic_id if ctx else None)
    if clinic_name_hint:
        try:
            from app.core.tools.mcp_tools.clinic_tools import get_my_clinics

            resp = await get_my_clinics(clinic_name_hint=clinic_name_hint)
            if resp.get("success") and resp.get("target_clinic_id"):
                active_clinic_id = resp["target_clinic_id"]
        except Exception:
            pass

    # Final check: if active_clinic_id still looks like a name hint (not UUID), it's an error
    from app.core.tools.contracts import _is_uuid

    if active_clinic_id and not _is_uuid(active_clinic_id):
        # The hint didn't resolve, but we have a hint-like ID
        clinic_name_hint = active_clinic_id
        active_clinic_id = None

    if not active_clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=True,
            suggestion="Vui lòng cung cấp tên phòng khám cụ thể hoặc chọn phòng khám trong Dashboard.",
        )

    try:
        # 1. Fetch aggregated revenue items
        revenue_data = await client.get_clinic_revenue(
            token, active_clinic_id, period.upper()
        )

        # 2. Fetch revenue breakdown (QR vs Cash vs Withdrawable)
        breakdown_data = await client.get_clinic_revenue_breakdown(
            token, active_clinic_id
        )

        items = revenue_data.get("items", [])
        total_revenue = sum(float(item.get("totalRevenue", 0)) for item in items)

        return build_tool_success_response(
            data={
                "total_revenue": total_revenue,
                "currency": "VND",
                "period": period.upper(),
                "items": items,
                "breakdown": breakdown_data,
                "clinic_name": revenue_data.get("clinicName"),
            },
            metadata={"is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in analyze_revenue_trends: {e}")
        error_code = classify_error_code(str(e))
        return build_tool_error_response(
            error_code=error_code,
            message=f"Không thể lấy dữ liệu doanh thu: {str(e)}",
            recoverable=True,
            suggestion="Vui lóng thử lại sau.",
        )
    except Exception as e:
        logger.error(f"Error in analyze_revenue_trends: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống khi phân tích doanh thu: {str(e)}",
            recoverable=True,
            suggestion="Vui lóng thử lại sau.",
        )


@mcp_server.tool
async def get_clinic_metrics(
    clinic_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get overall performance metrics for the clinic, including bookings, completion rate, and popular services.
    Use clinic_name_hint to resolve the clinic ID.

    Params:
        user_id: Override user ID (thường không cần truyền, lấy từ session)
        session_id: Session ID (thường không cần truyền, lấy từ session)

    Returns:
        Key performance indicators (KPIs) for the clinic.
    """
    if not _is_tool_available("get_clinic_metrics"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Cong cu get_clinic_metrics chua duoc kich hoat",
            recoverable=True,
            suggestion="Lien he quan tri vien de biet them",
        )

    ctx = get_tool_runtime_context()
    token = _require_auth_token()
    client = get_backend_client()

    # Resolve clinic_id if hint provided
    active_clinic_id = ctx.clinic_id if ctx else None
    if clinic_name_hint:
        try:
            from app.core.tools.mcp_tools.clinic_tools import get_my_clinics

            resp = await get_my_clinics(clinic_name_hint=clinic_name_hint)
            if resp.get("success") and resp.get("target_clinic_id"):
                active_clinic_id = resp["target_clinic_id"]
        except Exception:
            pass

    # Final check: if active_clinic_id still looks like a name hint (not UUID), it's an error
    from app.core.tools.contracts import _is_uuid

    if active_clinic_id and not _is_uuid(active_clinic_id):
        # The hint didn't resolve, but we have a hint-like ID
        clinic_name_hint = active_clinic_id
        active_clinic_id = None

    if not active_clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=True,
            suggestion="Vui lòng cung cấp tên phòng khám hoặc chọn phòng khám hoạt động.",
        )

    try:
        # 1. Lấy dữ liệu doanh thu tháng này
        revenue_data = await client.get_clinic_revenue(token, active_clinic_id, "MONTH")
        items = revenue_data.get("items", [])
        total_bookings_month = sum(int(item.get("count", 0)) for item in items)
        total_revenue_month = sum(float(item.get("totalRevenue", 0)) for item in items)

        # 2. Lấy danh sách booking gần đây để tính toán top services
        # (Vì backend chưa có aggregate endpoint cho top services, ta tính từ 50 booking gần nhất)
        bookings_resp = await client.get_clinic_bookings(
            token, active_clinic_id, size=50
        )
        bookings_list = (
            bookings_resp.get("bookings", []) if isinstance(bookings_resp, dict) else []
        )

        from collections import Counter

        service_counts = Counter()

        for b in bookings_list:
            # Duyệt qua các pet trong booking (multi-pet hỗ trợ)
            pets = b.get("pets", [])
            for p in pets:
                services = p.get("services", [])
                for s in services:
                    s_name = s.get("serviceName")
                    if s_name:
                        service_counts[s_name] += 1

        # Lấy top 5 dịch vụ phổ biến nhất
        top_services = [
            {"name": name, "count": count}
            for name, count in service_counts.most_common(5)
        ]

        return build_tool_success_response(
            data={
                "clinic_name": revenue_data.get("clinicName"),
                "total_bookings_this_month": total_bookings_month,
                "total_revenue_this_month": total_revenue_month,
                "currency": "VND",
                "top_services": top_services,
                "stats_source": "Dựa trên 50 booking gần nhất",
                "note": (
                    "Thống kê top dịch vụ được tổng hợp từ dữ liệu vận hành gần đây. "
                    "Để xem báo cáo doanh thu chi tiết, hãy hỏi 'phân tích doanh thu tháng này'."
                ),
            },
            metadata={"ui_card": "clinic_metrics_card", "is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_clinic_metrics: {e}")
        error_code = classify_error_code(str(e))
        return build_tool_error_response(
            error_code=error_code,
            message=f"Không thể lấy chỉ số hoạt động của phòng khám: {str(e)}",
            recoverable=True,
            suggestion="Vui lóng thử lại sau.",
        )
    except Exception as e:
        logger.error(f"Error in get_clinic_metrics: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống khi lấy chỉ số phòng khám: {str(e)}",
            recoverable=True,
            suggestion="Vui lóng thử lại sau.",
        )


@mcp_server.tool
async def get_owner_stats_overview(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    period: str = "MONTH",
) -> Dict[str, Any]:
    """
    Lấy tổng quan thống kê (doanh thu, số lượng booking) của TẤT CẢ các phòng khám thuộc sở hữu của Owner này.
    """
    if not _is_tool_available("get_owner_stats_overview"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Công cụ get_owner_stats_overview chưa được kích hoạt.",
            recoverable=True,
        )

    token = _require_auth_token()
    client = get_backend_client()

    try:
        # 1. Lấy danh sách clinics của owner
        clinics_resp = await client.get_my_clinics(token)
        clinics = (
            clinics_resp
            if isinstance(clinics_resp, list)
            else clinics_resp.get("content") or clinics_resp.get("data") or []
        )

        if not clinics:
            return build_tool_success_response(
                data={"message": "Bạn chưa có phòng khám nào được đăng ký."},
                metadata={"is_final": True},
            )

        import asyncio

        # 2. Gọi API lấy doanh thu cho từng clinic song song
        async def fetch_clinic_stats(clinic):
            c_id = clinic.get("clinicId")
            try:
                rev = await client.get_clinic_revenue(token, c_id, period.upper())
                breakdown = await client.get_clinic_revenue_breakdown(token, c_id)
                return {
                    "name": clinic.get("name"),
                    "clinicId": c_id,
                    "revenue": rev,
                    "breakdown": breakdown,
                    "success": True,
                }
            except Exception as e:
                logger.error(f"Error fetching stats for clinic {c_id}: {e}")
                return {"name": clinic.get("name"), "success": False, "error": str(e)}

        results = await asyncio.gather(*(fetch_clinic_stats(c) for c in clinics))

        # 3. Tổng hợp dữ liệu
        total_revenue = 0.0
        total_bookings = 0
        clinic_summaries = []

        for res in results:
            if res["success"]:
                rev_data = res["revenue"]
                items = rev_data.get("items", [])
                c_revenue = sum(float(item.get("totalRevenue", 0)) for item in items)
                c_bookings = sum(int(item.get("count", 0)) for item in items)

                total_revenue += c_revenue
                total_bookings += c_bookings

                clinic_summaries.append(
                    {
                        "clinic_name": res["name"],
                        "revenue": c_revenue,
                        "bookings": c_bookings,
                        "breakdown": res["breakdown"],
                    }
                )

        return build_tool_success_response(
            data={
                "total_all_clinics_revenue": total_revenue,
                "total_all_clinics_bookings": total_bookings,
                "currency": "VND",
                "period": period.upper(),
                "clinic_details": clinic_summaries,
            },
            metadata={"ui_card": "owner_multi_clinic_stats", "is_final": True},
        )

    except Exception as e:
        logger.error(f"Error in get_owner_stats_overview: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi khi tổng hợp thống kê hệ thống: {str(e)}",
            recoverable=True,
        )
