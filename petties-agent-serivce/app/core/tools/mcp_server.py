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
import json

logger = logging.getLogger(__name__)

# FastMCP server instance - single source of truth cho tất cả tools
mcp_server = FastMCP("Petties Agent Tools")

# ===== MCP TOOLS CACHE =====
# Cache cho list_tools() để tránh gọi lại mỗi request
_mcp_tools_cache = None
_mcp_tools_cache_lock = asyncio.Lock()


async def _get_tools_with_cache() -> List[Any]:
    """
    Internal helper to get tools with caching.
    Ensures safe concurrent initialization.
    """
    global _mcp_tools_cache
    if _mcp_tools_cache is not None:
        return _mcp_tools_cache

    async with _mcp_tools_cache_lock:
        if _mcp_tools_cache is not None:
            return _mcp_tools_cache

        logger.info("📡 Refilling MCP tools cache...")
        try:
            _mcp_tools_cache = await mcp_server.list_tools()
            logger.info(f"✅ Cached {len(_mcp_tools_cache)} MCP tools")
        except Exception as e:
            logger.error(f"❌ Failed to list tools from FastMCP: {e}")
            return []

    return _mcp_tools_cache


def invalidate_mcp_tools_cache() -> None:
    """Explicitly invalidate the tools cache."""
    global _mcp_tools_cache
    _mcp_tools_cache = None
    logger.info("♻️ MCP tools cache invalidated")


# Note: health_check is NOT an MCP tool for agents
# Use the /health endpoint for server health checks instead


# ===== TOOL METADATA GETTER (ASYNC) =====
async def get_mcp_tools_metadata() -> List[Dict[str, Any]]:
    """
    Retrieve tool metadata from FastMCP server (async version for FastMCP 2.x).
    Returns full metadata including input/output schema for Admin Dashboard.
    """
    tools_metadata = []

    tools = await _get_tools_with_cache()

    for tool in tools:
        tool_name = tool.name
        # Extract input schema from tool parameters
        input_schema = None
        if hasattr(tool, "parameters") and tool.parameters:
            input_schema = tool.parameters
        elif hasattr(tool, "inputSchema"):
            input_schema = tool.inputSchema
        elif hasattr(tool, "input_schema"):
            input_schema = tool.input_schema

        metadata = {
            "name": tool_name,
            "description": tool.description or "",
            "tool_type": "code_based",
            "input_schema": input_schema,
            "output_schema": None,  # FastMCP doesn't provide output schema
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
def _normalize_mcp_result(value: Any) -> Any:
    """
    Convert FastMCP/Pydantic tool results to JSON-serializable primitives.

    Priority:
    1. `structured_content` when available
    2. Pydantic `model_dump()` / `dict()` data
    3. Lists/dicts recursively
    4. Text JSON payloads if parsable
    5. String fallback
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {str(k): _normalize_mcp_result(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_normalize_mcp_result(item) for item in value]

    structured_content = getattr(value, "structured_content", None)
    if structured_content is not None:
        return _normalize_mcp_result(structured_content)

    if hasattr(value, "model_dump"):
        try:
            return _normalize_mcp_result(value.model_dump(mode="json"))
        except TypeError:
            return _normalize_mcp_result(value.model_dump())

    if hasattr(value, "dict"):
        try:
            return _normalize_mcp_result(value.dict())
        except Exception:
            pass

    content = getattr(value, "content", None)
    meta = getattr(value, "meta", None)
    if content is not None or meta is not None:
        normalized_payload: Dict[str, Any] = {}
        if content is not None:
            normalized_payload["content"] = _normalize_mcp_result(content)
        if meta is not None:
            normalized_payload["meta"] = _normalize_mcp_result(meta)
        return normalized_payload

    text = getattr(value, "text", None)
    if isinstance(text, str):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    if hasattr(value, "json"):
        try:
            return json.loads(value.json())
        except Exception:
            pass

    if hasattr(value, "__dict__"):
        try:
            public_attrs = {
                key: attr_value
                for key, attr_value in vars(value).items()
                if not key.startswith("_")
            }
            if public_attrs:
                return _normalize_mcp_result(public_attrs)
        except Exception:
            pass

    return str(value)


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

    # Get registered tools from cache
    registered_tools = await _get_tools_with_cache()
    available_tools = [tool.name for tool in registered_tools]

    if tool_name not in available_tools:
        logger.error(
            f"❌ [MCP] Tool '{tool_name}' not found. Available: {available_tools}"
        )
        raise ValueError(
            f"Tool '{tool_name}' not found. Available tools: {available_tools}"
        )

    # Get the tool metadata
    tool = await mcp_server.get_tool(tool_name)

    logger.info(f"🔧 [MCP] ===== CALLING: {tool_name} =====")
    logger.info(f"  ├─ Parameters: {json.dumps(parameters, ensure_ascii=False)[:500]}")

    try:
        # Execute the tool - FastMCP hiện tại expose call_tool trực tiếp
        result = await mcp_server.call_tool(tool_name, parameters)
        logger.info(f"  ├─ Raw result type: {type(result).__name__}")

        normalized_result = _normalize_mcp_result(result)
        logger.info(
            f"  ├─ Normalized result: {json.dumps(normalized_result, ensure_ascii=False)[:1000]}"
        )

        logger.info(f"  └─ ✅ Tool '{tool_name}' executed successfully")
        return normalized_result

    except TypeError as e:
        logger.error(f"  └─ ❌ Parameter error for '{tool_name}': {e}")
        raise ValueError(f"Invalid parameters for tool '{tool_name}': {e}")

    except Exception as e:
        logger.error(f"  └─ ❌ Execution error for '{tool_name}': {e}")
        import traceback

        logger.error(f"  └─ Traceback: {traceback.format_exc()}")
        raise


# ===== MCP SERVER INFO =====
async def get_server_info_async() -> Dict[str, Any]:
    """Get MCP server information (async)"""
    try:
        tools = await _get_tools_with_cache()
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
                desc = (
                    tool["description"][:50]
                    if tool["description"]
                    else "No description"
                )
                print(f"  - {tool['name']}: {desc}...")

        asyncio.run(show_info())
    else:
        # Defaults to stdio mode for standard MCP clients
        mcp_server.run()
