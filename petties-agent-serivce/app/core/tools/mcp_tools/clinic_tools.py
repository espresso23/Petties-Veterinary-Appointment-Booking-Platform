from typing import Optional, Dict, Any
from app.core.tools.fastmcp_app import mcp_server
from app.core.tools.auth_deps import _require_auth_token
from app.core.tool_runtime_context import get_tool_runtime_context
from app.services.backend_client import BackendClient


@mcp_server.tool()
async def list_clinic_services(
    is_home_visit: Optional[bool] = None,
    is_active: Optional[bool] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Xem danh sách dịch vụ của phòng khám (chỉ dành cho Quản lý/Chủ phòng khám)."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.list_clinic_services(
        token, is_home_visit=is_home_visit, is_active=is_active
    )
    # response should be list, if not we wrap it
    if isinstance(response, dict) and "data" in response:
        data = response["data"]
    elif isinstance(response, dict) and "content" in response:
        data = response["content"]
    else:
        data = response
    return {
        "services": data,
        "ui_card": "clinic_service_list_card",
        "total": len(data) if isinstance(data, list) else 0,
    }


@mcp_server.tool()
async def update_service_info(
    service_id: str,
    updates: Dict[str, Any],
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Cập nhật thông tin dịch vụ của phòng khám (giá, mô tả, thời lượng). Cần được người dùng xác nhận."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.update_service_info(token, service_id, updates)
    return {"success": True, "service": response, "ui_card": "service_detail_card"}


@mcp_server.tool()
async def create_clinic_service(
    name: str,
    base_price: float,
    duration_minutes: int,
    service_category: str,
    pet_type: str,
    description: Optional[str] = None,
    is_home_visit: bool = False,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Tạo dịch vụ mới cho phòng khám. Cần được người dùng xác nhận."""
    token = _require_auth_token()
    client = BackendClient()
    payload = {
        "name": name,
        "basePrice": base_price,
        "durationMinutes": duration_minutes,
        "serviceCategory": service_category,
        "petType": pet_type,
        "description": description,
        "isHomeVisit": is_home_visit,
    }
    response = await client.create_service(token, payload)
    return {"success": True, "service": response, "ui_card": "service_detail_card"}


@mcp_server.tool()
async def get_my_clinics(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Lấy danh sách các phòng khám mà người dùng hiện tại (Owner/Manager/Staff) đang quản lý hoặc làm việc."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.get_my_clinics(token)
    clinics = response if isinstance(response, list) else response.get("data", [])
    if not clinics:
        return {"success": False, "error": "Không tìm thấy phòng khám nào", "clinics": []}
    
    return {
        "success": True,
        "clinics": clinics,
        "total": len(clinics),
    }


@mcp_server.tool()
async def generate_clinic_services(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Gợi ý danh sách dịch vụ từ master services cho phòng khám mới setup."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.get_master_services(token)
    services = response if isinstance(response, list) else response.get("data", [])
    return {
        "suggested_services": services,
        "ui_card": "clinic_service_suggestion_card",
        "total": len(services) if isinstance(services, list) else 0,
        "message": "Danh sách dịch vụ gợi ý từ hệ thống. Bạn có thể chọn dịch vụ phù hợp để thêm vào phòng khám.",
    }


@mcp_server.tool()
async def execute_update_service_confirmed(
    service_id: str,
    updates: Dict[str, Any],
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Áp dụng cập nhật dịch vụ sau khi người dùng đã xác nhận (HITL)."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.update_service_info(token, service_id, updates)
    return {
        "success": True,
        "service": response,
        "ui_card": "service_detail_card",
        "message": "Đã cập nhật dịch vụ thành công.",
    }
