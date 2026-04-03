import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.tools.mcp_tools.analytics_tools import (
    analyze_revenue_trends,
    get_clinic_metrics,
)
from app.services.backend_client import BackendClientError


@pytest.fixture
def mock_context():
    ctx = MagicMock()
    ctx.auth_token = "mock-token"
    ctx.clinic_id = "clinic-123"
    ctx.user_id = "user-456"
    return ctx


@pytest.fixture
def mock_backend_client():
    client = AsyncMock()
    return client


@pytest.mark.asyncio
async def test_analyze_revenue_trends_success(mock_context, mock_backend_client):
    # Mock context
    with (
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_tool_runtime_context",
            return_value=mock_context,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools.require_tool_runtime_context",
            return_value=mock_context,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_backend_client",
            return_value=mock_backend_client,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools._is_tool_available",
            return_value=True,
        ),
    ):
        mock_backend_client.get_clinic_revenue.return_value = {
            "clinicName": "Test Clinic",
            "items": [
                {"totalRevenue": 100000, "count": 2},
                {"totalRevenue": 200000, "count": 3},
            ],
        }
        mock_backend_client.get_clinic_revenue_breakdown.return_value = {
            "qr": 150000,
            "cash": 150000,
        }

        result = await analyze_revenue_trends(period="MONTH")

        assert result["success"] is True
        assert result["data"]["total_revenue"] == 300000
        assert result["data"]["period"] == "MONTH"
        assert result["data"]["clinic_name"] == "Test Clinic"
        assert result["data"]["breakdown"]["qr"] == 150000


@pytest.mark.asyncio
async def test_analyze_revenue_trends_no_context():
    with (
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_tool_runtime_context",
            return_value=None,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools._is_tool_available",
            return_value=True,
        ),
    ):
        result = await analyze_revenue_trends(period="MONTH")

        assert result["success"] is False
        assert result["error_code"] == "UNAUTHORIZED"
        assert "Không tìm thấy thông tin phòng khám" in result["message"]


@pytest.mark.asyncio
async def test_get_clinic_metrics_success(mock_context, mock_backend_client):
    # Mock context
    with (
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_tool_runtime_context",
            return_value=mock_context,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools.require_tool_runtime_context",
            return_value=mock_context,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_backend_client",
            return_value=mock_backend_client,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools._is_tool_available",
            return_value=True,
        ),
    ):
        mock_backend_client.get_clinic_revenue.return_value = {
            "clinicName": "Test Clinic",
            "items": [
                {"totalRevenue": 100000, "count": 2},
                {"totalRevenue": 200000, "count": 3},
            ],
        }

        result = await get_clinic_metrics()

        assert result["success"] is True
        assert result["data"]["total_bookings_this_month"] == 5
        assert result["data"]["total_revenue_this_month"] == 300000
        assert result["data"]["clinic_name"] == "Test Clinic"
        assert len(result["data"]["top_services"]) == 2


@pytest.mark.asyncio
async def test_get_clinic_metrics_backend_error(mock_context, mock_backend_client):
    with (
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_tool_runtime_context",
            return_value=mock_context,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools.require_tool_runtime_context",
            return_value=mock_context,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools.get_backend_client",
            return_value=mock_backend_client,
        ),
        patch(
            "app.core.tools.mcp_tools.analytics_tools._is_tool_available",
            return_value=True,
        ),
    ):
        mock_backend_client.get_clinic_revenue.side_effect = BackendClientError(
            "Service unavailable"
        )

        result = await get_clinic_metrics()

        assert result["success"] is False
        assert result["error_code"] == "INTERNAL_ERROR"
        assert "Không thể lấy chỉ số hoạt động của phòng khám" in result["message"]
