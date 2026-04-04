import os
import re

# Update backend_client.py
with open(
    "petties-agent-serivce/app/services/backend_client.py", "r", encoding="utf-8"
) as f:
    backend_content = f.read()

new_methods = """
    async def list_clinic_services(self, token: str, is_home_visit: bool = None, is_active: bool = None) -> list:
        params = {}
        if is_home_visit is not None:
            params["isHomeVisit"] = is_home_visit
        if is_active is not None:
            params["isActive"] = is_active
        return await self._request("GET", "/api/services", token=token, params=params)

    async def update_service_info(self, token: str, service_id: str, payload: dict) -> dict:
        return await self._request("PUT", f"/api/services/{service_id}", token=token, json_body=payload)

    async def create_service(self, token: str, payload: dict) -> dict:
        return await self._request("POST", "/api/services", token=token, json_body=payload)
"""
if "def list_clinic_services" not in backend_content:
    # insert before the last class line, or just at the end of the class
    # we know class BackendClient exists
    backend_content += new_methods
    with open(
        "petties-agent-serivce/app/services/backend_client.py", "w", encoding="utf-8"
    ) as f:
        f.write(backend_content)


# Create or update clinic_tools.py
clinic_tools_content = '''from typing import Optional, Dict, Any
from app.core.tools.fastmcp_app import mcp_server
from app.core.tools.auth_deps import _require_auth_token
from app.services.backend_client import BackendClient

@mcp_server.tool()
async def list_clinic_services(is_home_visit: Optional[bool] = None, is_active: Optional[bool] = None) -> Dict[str, Any]:
    """Xem danh sách dịch vụ của phòng khám (chỉ dành cho Quản lý/Chủ phòng khám)."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.list_clinic_services(token, is_home_visit=is_home_visit, is_active=is_active)
    # response should be list, if not we wrap it
    if isinstance(response, dict) and "data" in response:
        data = response["data"]
    elif isinstance(response, dict) and "content" in response:
        data = response["content"]
    else:
        data = response
    return {"services": data, "ui_card": "clinic_service_list_card", "total": len(data) if isinstance(data, list) else 0}

@mcp_server.tool()
async def update_service_info(service_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Cập nhật thông tin dịch vụ của phòng khám (giá, mô tả, thời lượng). Cần được người dùng xác nhận."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.update_service_info(token, service_id, updates)
    return {"success": True, "service": response, "ui_card": "service_detail_card"}

@mcp_server.tool()
async def create_service(name: str, base_price: float, duration_minutes: int, service_category: str, pet_type: str, description: Optional[str] = None, is_home_visit: bool = False) -> Dict[str, Any]:
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
        "isHomeVisit": is_home_visit
    }
    response = await client.create_service(token, payload)
    return {"success": True, "service": response, "ui_card": "service_detail_card"}
'''
with open(
    "petties-agent-serivce/app/core/tools/mcp_tools/clinic_tools.py",
    "w",
    encoding="utf-8",
) as f:
    f.write(clinic_tools_content)

# Update __init__.py
init_path = "petties-agent-serivce/app/core/tools/mcp_tools/__init__.py"
if os.path.exists(init_path):
    with open(init_path, "r", encoding="utf-8") as f:
        init_content = f.read()
    if "clinic_tools" not in init_content:
        init_content += "\\nfrom . import clinic_tools"
        with open(init_path, "w", encoding="utf-8") as f:
            f.write(init_content)
else:
    with open(init_path, "w", encoding="utf-8") as f:
        f.write("from . import clinic_tools\\n")

# Update tool_policy.py
tp_path = "petties-agent-serivce/app/core/tools/tool_policy.py"
with open(tp_path, "r", encoding="utf-8") as f:
    tp_content = f.read()

# Add tools to DEFAULT_POLICIES if not present
if "list_clinic_services" not in tp_content:
    new_policies = """
    "list_clinic_services": ToolPolicy(requires_auth=True, allowed_roles=["CLINIC_OWNER", "CLINIC_MANAGER"]),
    "update_service_info": ToolPolicy(requires_auth=True, requires_confirmation=True, allowed_roles=["CLINIC_OWNER", "CLINIC_MANAGER"]),
    "create_service": ToolPolicy(requires_auth=True, requires_confirmation=True, allowed_roles=["CLINIC_OWNER", "CLINIC_MANAGER"]),
"""
    # Just simple regex or string insert
    tp_content = re.sub(r"(DEFAULT_POLICIES = \{)", r"\\1" + new_policies, tp_content)
    with open(tp_path, "w", encoding="utf-8") as f:
        f.write(tp_content)

# Update context_policy.py
cp_path = "petties-agent-serivce/app/core/context_policy.py"
with open(cp_path, "r", encoding="utf-8") as f:
    cp_content = f.read()

if "list_clinic_services" not in cp_content:
    # Just add to ROLE_BUSINESS_TOOLS for CLINIC_OWNER and CLINIC_MANAGER
    for role in ["CLINIC_OWNER", "CLINIC_MANAGER"]:
        pattern = f'"{role}": \\['
        replacement = f'"{role}": ["list_clinic_services", "update_service_info", "create_service", '
        cp_content = re.sub(pattern, replacement, cp_content)
    with open(cp_path, "w", encoding="utf-8") as f:
        f.write(cp_content)
