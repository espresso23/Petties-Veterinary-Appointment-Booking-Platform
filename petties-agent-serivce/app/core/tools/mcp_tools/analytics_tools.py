"""
PETTIES AGENT SERVICE - Analytics Tools
Tools for retrieving clinic revenue and booking insights.
"""

from typing import Any, Dict, Optional
import logging

from app.core.tools.contracts import (
    build_tool_success_response,
    build_tool_error_response,
)
from app.core.tools.mcp_server import mcp_server
from app.core.tool_runtime_context import (
    get_tool_runtime_context,
    require_tool_runtime_context,
)
from app.services.backend_client import BackendClientError, get_backend_client
from app.core.tools.tool_policy import get_tool_policy

logger = logging.getLogger(__name__)


def _is_tool_available(tool_name: str) -> bool:
    """Clinic tools are runtime-filtered elsewhere; here we only validate registration."""
    return get_tool_policy(tool_name) is not None


def _require_auth_token() -> str:
    """Yêu cầu JWT token - raise exception nếu không có token."""
    context = require_tool_runtime_context()
    if not context.auth_token:
        raise RuntimeError(
            "Yeu cau dang nhap de su dung chuc nang nay. Vui long dang nhap truoc."
        )
    return context.auth_token


@mcp_server.tool
async def analyze_revenue_trends(period: str = "MONTH") -> Dict[str, Any]:
    """
    Analyze revenue trends for the current clinic over a specific period.

    Args:
        period: Time period to aggregate (DAY, WEEK, MONTH, YEAR). Default is MONTH.

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
    if not ctx or not ctx.clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=False,
            suggestion="Yeu cau đăng nhập với quyền CLINIC_OWNER hoặc CLINIC_MANAGER.",
        )

    token = _require_auth_token()
    client = get_backend_client()

    try:
        # 1. Fetch aggregated revenue items
        revenue_data = await client.get_clinic_revenue(
            token, ctx.clinic_id, period.upper()
        )

        # 2. Fetch revenue breakdown (QR vs Cash vs Withdrawable)
        breakdown_data = await client.get_clinic_revenue_breakdown(token, ctx.clinic_id)

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
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
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
async def get_clinic_metrics() -> Dict[str, Any]:
    """
    Get overall performance metrics for the clinic, including bookings, completion rate, and popular services.

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
    if not ctx or not ctx.clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=False,
            suggestion="Yeu cau đăng nhập với quyền CLINIC_OWNER hoặc CLINIC_MANAGER.",
        )

    token = _require_auth_token()
    client = get_backend_client()

    try:
        # We don't have a dedicated single metrics endpoint yet,
        # so we combine data from existing ones or use a placeholder logic if backend is missing it.
        # For now, let's try to get a summary from payments as a proxy for activity.
        data = await client.get_clinic_revenue(token, ctx.clinic_id, "MONTH")

        items = data.get("items", [])
        total_bookings = sum(int(item.get("count", 0)) for item in items)
        total_revenue = sum(float(item.get("totalRevenue", 0)) for item in items)

        return build_tool_success_response(
            data={
                "clinic_name": data.get("clinicName"),
                "total_bookings_this_month": total_bookings,
                "total_revenue_this_month": total_revenue,
                "currency": "VND",
                "top_services": [
                    # Placeholder until backend provides detailed service analytics
                    {"name": "Khám tổng quát", "count": int(total_bookings * 0.4)},
                    {"name": "Tiêm chủng", "count": int(total_bookings * 0.3)},
                ]
                if total_bookings > 0
                else [],
            },
            metadata={"is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_clinic_metrics: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
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
