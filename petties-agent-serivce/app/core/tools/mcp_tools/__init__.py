"""
PETTIES AGENT SERVICE - MCP Tools Package
Import tất cả FastMCP tools để register vào server

Purpose:
    - Import tất cả tool modules để @mcp_server.tool() decorator có hiệu lực
    - Tools được auto-register khi import
"""

# Import all tool modules to register tools with FastMCP server
from app.core.tools.mcp_tools import medical_tools
from app.core.tools.mcp_tools import booking_tools
from app.core.tools.mcp_tools import common_tools
from app.core.tools.mcp_tools import analytics_tools

__all__ = ["medical_tools", "booking_tools", "common_tools", "analytics_tools"]
import app.core.tools.mcp_tools.utility_tools
import app.core.tools.mcp_tools.booking_session_tools
