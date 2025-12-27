"""
PETTIES AGENT SERVICE - FastMCP Server Setup
MCP (Model Context Protocol) server cho Agent tools

Package: app.core.tools
Purpose:
    - Setup FastMCP server để expose tools cho LangGraph agents
    - Tự động discovery/listing tools cho Admin Dashboard
    - Chuẩn hóa tool protocol theo MCP standard

Reference: Section 8 - Tech Stack (Tool Framework: FastMCP)
Version: v2.0.0 - FastMCP 2.x Compatible
"""

from fastmcp import FastMCP
from typing import Any, Dict, List
import logging
import asyncio

logger = logging.getLogger(__name__)

# ===== CREATE FASTMCP SERVER =====
# FastMCP server instance - single source of truth cho tất cả tools
mcp_server = FastMCP("Petties Agent Tools")


# Note: health_check is NOT an MCP tool for agents
# Use the /health endpoint for server health checks instead


# ===== TOOL METADATA GETTER (ASYNC) =====
async def get_mcp_tools_metadata() -> List[Dict[str, Any]]:
    """
    Retrieve tool metadata from FastMCP server (async version for FastMCP 2.x).
    Returns simplified metadata (no schema - not needed for Admin UI).
    """
    tools_metadata = []
    
    # FastMCP 2.x uses async get_tools() method
    tools = await mcp_server.get_tools()
    
    for tool_name, tool in tools.items():
        metadata = {
            "name": tool_name,
            "description": tool.description or "",
            "tool_type": "code_based",
        }
        tools_metadata.append(metadata)

    logger.info(f"📋 Retrieved {len(tools_metadata)} tools from FastMCP")
    return tools_metadata


def get_mcp_tools_metadata_sync() -> List[Dict[str, Any]]:
    """
    Synchronous wrapper for get_mcp_tools_metadata.
    Use this when you need to call from sync code.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're in an async context, create a new task
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, get_mcp_tools_metadata())
                return future.result()
        else:
            return loop.run_until_complete(get_mcp_tools_metadata())
    except RuntimeError:
        # No event loop
        return asyncio.run(get_mcp_tools_metadata())


# ===== TOOL EXECUTION =====
async def call_mcp_tool(tool_name: str, parameters: Dict[str, Any] = None) -> Any:
    """
    Execute a registered MCP tool by name

    Args:
        tool_name: Name of the tool to execute
        parameters: Dictionary of parameters to pass to the tool

    Returns:
        Tool execution result
    """
    if parameters is None:
        parameters = {}

    # Get registered tools using async API
    registered_tools = await mcp_server.get_tools()

    if tool_name not in registered_tools:
        available_tools = list(registered_tools.keys())
        raise ValueError(
            f"Tool '{tool_name}' not found. Available tools: {available_tools}"
        )

    # Get the tool
    tool = registered_tools[tool_name]

    logger.info(f"🔧 Executing MCP tool: {tool_name} with params: {parameters}")

    try:
        # Execute the tool - FastMCP handles both sync and async tools
        if hasattr(tool, 'fn'):
            result = tool.fn(**parameters)
            if asyncio.iscoroutine(result):
                result = await result
        else:
            # Fallback: try calling tool directly
            result = await mcp_server._tool_manager.call_tool(tool_name, parameters)
        
        logger.info(f"✅ Tool '{tool_name}' executed successfully")
        return result

    except TypeError as e:
        logger.error(f"❌ Parameter error for tool '{tool_name}': {e}")
        raise ValueError(f"Invalid parameters for tool '{tool_name}': {e}")

    except Exception as e:
        logger.error(f"❌ Error executing tool '{tool_name}': {e}")
        raise


# ===== MCP SERVER INFO =====
async def get_server_info_async() -> Dict[str, Any]:
    """Get MCP server information (async)"""
    try:
        tools = await mcp_server.get_tools()
        tools_count = len(tools)
    except Exception:
        tools_count = 0
    return {
        "name": "Petties Agent Tools",
        "version": "2.0.0",
        "description": "MCP server providing tools for Petties AI Agents",
        "total_tools": tools_count,
    }


def get_server_info() -> Dict[str, Any]:
    """Get MCP server information (sync wrapper)"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Return minimal info if we can't run async
            return {
                "name": "Petties Agent Tools",
                "version": "2.0.0",
                "description": "MCP server providing tools for Petties AI Agents",
                "total_tools": -1,  # Unknown
            }
        return loop.run_until_complete(get_server_info_async())
    except RuntimeError:
        return asyncio.run(get_server_info_async())


# ===== TRIGGER TOOL DISCOVERY =====
# Import mcp_tools package to trigger @mcp_server.tool decorators
try:
    from app.core.tools import mcp_tools
    logger.info(f"🚀 MCP tools module imported successfully")
except Exception as e:
    logger.error(f"❌ Failed to import mcp_tools: {e}")


if __name__ == "__main__":
    # Standard FastMCP 2.0 execution
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "info":
        async def show_info():
            print("🔧 FastMCP Server Info:")
            print(await get_server_info_async())
            print("\n📋 Available Tools:")
            for tool in await get_mcp_tools_metadata():
                desc = tool['description'][:50] if tool['description'] else 'No description'
                print(f"  - {tool['name']}: {desc}...")
        
        asyncio.run(show_info())
    else:
        # Defaults to stdio mode for standard MCP clients
        mcp_server.run()
