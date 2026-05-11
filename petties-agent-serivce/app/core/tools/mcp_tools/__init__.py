"""
PETTIES AGENT SERVICE - MCP Tools Package
Import tất cả FastMCP tools để register vào server

Purpose:
    - Import tất cả tool modules để @mcp_server.tool() decorator có hiệu lực
    - Tools được auto-register khi import
"""

# Import all tool modules to register tools with FastMCP server
from app.core.tools.mcp_tools import medical_tools
from app.core.tools.mcp_tools import common_tools
from app.core.tools.mcp_tools import analytics_tools
from app.core.tools.mcp_tools import pet_tools
from app.core.tools.mcp_tools import clinic_search_tools
from app.core.tools.mcp_tools import scheduling_tools
from app.core.tools.mcp_tools import appointment_tools
from app.core.tools.mcp_tools import staff_tools
from app.core.tools.mcp_tools import utility_tools
from app.core.tools.mcp_tools import clinic_tools

__all__ = [
    "medical_tools",
    "common_tools",
    "analytics_tools",
    "pet_tools",
    "clinic_search_tools",
    "scheduling_tools",
    "appointment_tools",
    "staff_tools",
    "utility_tools",
    "clinic_tools",
]
