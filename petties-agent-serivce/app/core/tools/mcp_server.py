"""
PETTIES AGENT SERVICE - FastMCP Server Setup
MCP (Model Context Protocol) server cho Agent tools

Package: app.core.tools
Purpose:
    - Setup FastMCP server để expose tools cho LangGraph agents
    - Tự động discovery/listing tools cho Admin Dashboard
    - Chuẩn hóa tool protocol theo MCP standard

Reference: Section 8 - Tech Stack (Tool Framework: FastMCP)
Version: v0.0.1
"""

from fastmcp import FastMCP
from typing import Any, Dict, List
import logging

logger = logging.getLogger(__name__)

# ===== CREATE FASTMCP SERVER =====
# FastMCP server instance - single source of truth cho tất cả tools
# FastMCP 2.x API: only accepts 'name' parameter
mcp_server = FastMCP("Petties Agent Tools")


# ===== HEALTH CHECK TOOL (EXAMPLE) =====
@mcp_server.tool()
async def health_check() -> Dict[str, Any]:
    """
    Health check tool for MCP server

    Returns:
        Dict với server status
    """
    return {
        "status": "healthy",
        "server": "Petties MCP Server",
        "version": "0.0.1"
    }


# ===== TOOL METADATA GETTER =====
def get_mcp_tools_metadata() -> List[Dict[str, Any]]:
    """
    Lấy metadata của tất cả tools đã register trong MCP server

    Returns:
        List of tool metadata (name, description, input_schema, output_schema)

    Purpose:
        - Tool Scanner service gọi function này để lấy danh sách tools
        - Đồng bộ vào PostgreSQL database
        - Hiển thị trên Admin Dashboard
    """
    tools_metadata = []

    # Get all registered tools from FastMCP server
    for tool_name, tool_func in mcp_server.list_tools().items():
        metadata = {
            "name": tool_name,
            "description": tool_func.__doc__ or "",
            "tool_type": "code_based",  # FastMCP tools are code-based
            "input_schema": _extract_input_schema(tool_func),
            "output_schema": _extract_output_schema(tool_func),
        }
        tools_metadata.append(metadata)

    logger.info(f"📋 Retrieved {len(tools_metadata)} tools from MCP server")
    return tools_metadata


def _extract_input_schema(func) -> Dict[str, Any]:
    """
    Extract input schema từ function signature (type hints)

    Purpose: Generate JSON Schema cho tool input parameters
    """
    import inspect
    from typing import get_type_hints

    sig = inspect.signature(func)
    type_hints = get_type_hints(func)

    properties = {}
    required = []

    for param_name, param in sig.parameters.items():
        if param_name == "self":
            continue

        param_type = type_hints.get(param_name, str)

        # Map Python types to JSON Schema types
        type_mapping = {
            str: "string",
            int: "integer",
            float: "number",
            bool: "boolean",
            list: "array",
            dict: "object",
        }

        json_type = type_mapping.get(param_type, "string")

        properties[param_name] = {"type": json_type}

        # If parameter has no default value, it's required
        if param.default == inspect.Parameter.empty:
            required.append(param_name)

    return {
        "type": "object",
        "properties": properties,
        "required": required
    }


def _extract_output_schema(func) -> Dict[str, Any]:
    """
    Extract output schema từ return type hint

    Purpose: Generate JSON Schema cho tool output
    """
    from typing import get_type_hints

    type_hints = get_type_hints(func)
    return_type = type_hints.get("return", dict)

    # Simple output schema (có thể enhance sau)
    return {
        "type": "object",
        "description": f"Output from {func.__name__}"
    }


# ===== TOOL EXECUTION =====
async def call_mcp_tool(tool_name: str, parameters: Dict[str, Any] = None) -> Any:
    """
    Execute a registered MCP tool by name

    Args:
        tool_name: Name of the tool to execute
        parameters: Dictionary of parameters to pass to the tool

    Returns:
        Tool execution result

    Raises:
        ValueError: If tool not found
        Exception: If tool execution fails

    Example:
        >>> result = await call_mcp_tool("health_check", {})
        >>> print(result)  # {"status": "healthy", ...}
    """
    if parameters is None:
        parameters = {}

    # Get registered tools from MCP server
    registered_tools = mcp_server.list_tools()

    if tool_name not in registered_tools:
        available_tools = list(registered_tools.keys())
        raise ValueError(
            f"Tool '{tool_name}' not found. Available tools: {available_tools}"
        )

    # Get the tool function
    tool_func = registered_tools[tool_name]

    logger.info(f"🔧 Executing MCP tool: {tool_name} with params: {parameters}")

    try:
        # Execute the tool function with parameters
        result = await tool_func(**parameters)
        logger.info(f"✅ Tool '{tool_name}' executed successfully")
        return result

    except TypeError as e:
        # Handle parameter mismatch errors
        logger.error(f"❌ Parameter error for tool '{tool_name}': {e}")
        raise ValueError(f"Invalid parameters for tool '{tool_name}': {e}")

    except Exception as e:
        logger.error(f"❌ Error executing tool '{tool_name}': {e}")
        raise


# ===== MCP SERVER INFO =====
def get_server_info() -> Dict[str, Any]:
    """Get MCP server information"""
    try:
        tools_count = len(mcp_server.list_tools())
    except Exception:
        tools_count = 0
    return {
        "name": "Petties Agent Tools",
        "version": "0.0.1",
        "description": "MCP server providing tools for Petties AI Agents",
        "total_tools": tools_count,
    }


# ===== TRIGGER TOOL DISCOVERY =====
# Import mcp_tools package to trigger @mcp_server.tool decorators
try:
    from app.core.tools import mcp_tools
    logger.info(f"🚀 Registered {len(mcp_server.list_tools())} tools to FastMCP server")
except Exception as e:
    logger.error(f"❌ Failed to register tools: {e}")


if __name__ == "__main__":
    mcp.run()
    # Test MCP server
    print("🔧 FastMCP Server Info:")
    print(get_server_info())

    print("\n📋 Available Tools:")
    for tool in get_mcp_tools_metadata():
        print(f"  - {tool['name']}: {tool['description'][:50]}...")
