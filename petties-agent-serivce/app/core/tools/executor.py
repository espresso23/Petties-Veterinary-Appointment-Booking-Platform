"""
PETTIES AGENT SERVICE - Tool Executor
Execute code-based tools via FastMCP server

Package: app.core.tools
Purpose: Execute tools for LangGraph agents
Version: v0.0.3 - Enhanced logging for debugging
"""

from typing import Dict, List, Any, Optional
from sqlalchemy import select
from loguru import logger
import json

from app.db.postgres.models import Tool
from app.db.postgres.session import AsyncSessionLocal
from app.core.tool_runtime_context import get_tool_runtime_context
from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
    classify_error_code,
    normalize_tool_input,
    normalize_tool_output,
)


class ToolExecutor:
    """
    Tool Executor for Code-based Tools

    Purpose: Execute FastMCP tools from LangGraph agents
    Methods:
        - execute(): Execute tool with parameters
        - get_tool_schema(): Get tool schema for LLM
        - validate_parameters(): Validate parameters against schema
    """

    # Cache: tool_name -> Tool ORM object
    _tool_cache: dict[str, Any] = {}
    _cache_loaded = False

    def __init__(self):
        """Initialize Tool Executor"""
        pass

    async def _load_tool_cache(self) -> None:
        """Load all enabled tools into cache."""
        if ToolExecutor._cache_loaded:
            return
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Tool).where(Tool.enabled == True))
            tools = result.scalars().all()
            ToolExecutor._tool_cache = {tool.name: tool for tool in tools}
            ToolExecutor._cache_loaded = True
            logger.info(f"Tool cache loaded: {len(ToolExecutor._tool_cache)} tools")

    @classmethod
    def invalidate_tool_cache(cls) -> None:
        """Invalidate tool cache. Call when tools are added/removed/enabled/disabled."""
        cls._tool_cache.clear()
        cls._cache_loaded = False
        logger.info("Tool cache invalidated")

    async def execute(
        self, tool_name: str, parameters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Execute tool with parameters

        Args:
            tool_name: Tool name (e.g., check_slot, create_booking)
            parameters: Tool parameters dict

        Returns:
            Tool execution result:
                {
                    "success": True,
                    "data": {...},
                    "tool_name": "check_slot"
                }

        Example:
            >>> executor = ToolExecutor()
            >>> result = await executor.execute(
            ...     tool_name="check_slot",
            ...     parameters={"doctor_id": "DOC_001", "date": "2025-01-15"}
            ... )
        """
        if parameters is None:
            parameters = {}

        logger.debug(f"🔧 [EXECUTOR] START: {tool_name}")

        # Step 1: Load tool from database
        tool = await self._load_tool(tool_name)

        if not tool:
            logger.error(f"  └─ ❌ Tool '{tool_name}' not found in database")
            raise Exception(f"Tool '{tool_name}' not found in database")

        if not tool.enabled:
            logger.error(f"  └─ ❌ Tool '{tool_name}' is not enabled")
            raise Exception(f"Tool '{tool_name}' is not enabled")

        logger.debug(f"  ├─ Tool loaded: enabled={tool.enabled}")
        if tool.input_schema:
            schema_keys = list(tool.input_schema.get("properties", {}).keys())
            logger.debug(f"  ├─ Schema keys: {schema_keys}")
        else:
            logger.debug("  ├─ No input schema")

        # Normalize parameter keys: strip whitespace from keys
        # LLM sometimes outputs { "query ": "..." } with trailing space in key names
        if parameters and isinstance(parameters, dict):
            parameters = {k.strip(): v for k, v in parameters.items()}
            logger.debug(f"  ├─ After key strip: {list(parameters.keys())}")

        # Normalize aliases/coercions BEFORE schema filtering so we do not drop
        # clinicId/serviceIds/lat keys that the LLM may output.
        parameters = normalize_tool_input(tool_name, parameters)
        logger.debug(f"  ├─ After normalize: {list(parameters.keys())}")

        # Track dropped parameters for better error reporting
        # Instead of silent drop, we return error info so LLM can recover
        dropped_params: Dict[str, Any] = {}
        if tool.input_schema and isinstance(tool.input_schema, dict):
            schema = tool.input_schema
            allowed_keys: set = set()
            properties = schema.get("properties")
            if isinstance(properties, dict):
                allowed_keys = set(properties.keys())

            if allowed_keys:
                filtered_parameters = {
                    k: v for k, v in parameters.items() if k in allowed_keys
                }
                dropped = {k: v for k, v in parameters.items() if k not in allowed_keys}
                if dropped:
                    logger.warning(
                        f"  ├─ ⚠️ Dropped params for '{tool_name}': {list(dropped.keys())}"
                    )
                    dropped_params = dropped
                parameters = filtered_parameters
                logger.debug(
                    f"  ├─ After schema filter: keys={list(parameters.keys())}, dropped={list(dropped_params.keys())}"
                )

        # Store dropped params in result for LLM to see (via async context)
        # This allows LLM to understand what was dropped and potentially retry
        from app.core.tools import executor_state

        executor_state.set_dropped_params(dropped_params)

        # Context injection happens after the first schema filter, so normalize
        # and filter once more before calling FastMCP.
        parameters = self._inject_contextual_parameters(tool_name, parameters)
        logger.debug(f"  ├─ After context injection: {list(parameters.keys())}")
        parameters = normalize_tool_input(tool_name, parameters)
        if tool.input_schema and isinstance(tool.input_schema, dict):
            properties = tool.input_schema.get("properties")
            if isinstance(properties, dict) and properties:
                allowed_keys = set(properties.keys())
                parameters = {
                    key: value
                    for key, value in parameters.items()
                    if key in allowed_keys
                }

        # Step 2: Filter out None/null values to prevent Pydantic validation errors
        parameters = {k: v for k, v in parameters.items() if v is not None}
        logger.debug(f"  ├─ Final params keys: {list(parameters.keys())}")

        # Step 3: Validate parameters
        self._validate_parameters(tool, parameters)

        # Step 4: Execute via FastMCP (with normalized params)
        result = await self._execute_mcp_tool(tool_name, parameters)

        if result.get("success"):
            logger.info(f"  └─ ✅ Tool executed successfully: {tool_name}")
        else:
            logger.warning(
                f"  └─ ⚠️ Tool returned error: {tool_name} -> {result.get('error_code')} - {result.get('message')}"
            )

        return result

    async def _load_tool(self, tool_name: str) -> Optional[Tool]:
        """
        Load tool from cache (populated from database on first use)
        """
        await self._load_tool_cache()
        return ToolExecutor._tool_cache.get(tool_name)

    def _validate_parameters(self, tool: Tool, parameters: Dict[str, Any]):
        """
        Validate parameters against tool schema

        Args:
            tool: Tool object
            parameters: User-provided parameters (should be normalized already)

        Raises:
            Exception if parameters invalid
        """
        if not tool.input_schema:
            return

        schema = tool.input_schema
        required = schema.get("required", [])

        for param_name in required:
            if param_name not in parameters:
                # Log available keys for debugging
                logger.error(
                    f"Missing required parameter '{param_name}'. Available keys: {list(parameters.keys())}"
                )
                raise Exception(f"Missing required parameter: {param_name}")

        logger.debug(f"Parameters validated for tool: {tool.name}")

    def _inject_contextual_parameters(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Inject runtime context into tool params based on policy."""
        context = get_tool_runtime_context()
        if context is None:
            return parameters

        # Use policy system to determine what to inject
        from app.core.tools.tool_policy import requires_context

        injected = dict(parameters)

        # Check if tool requires context injection
        if requires_context(tool_name):
            # Common context fields that might be injected
            if hasattr(context, "user_id") and context.user_id:
                injected["user_id"] = context.user_id
            if hasattr(context, "clinic_id") and context.clinic_id:
                injected["clinic_id"] = context.clinic_id
            if hasattr(context, "session_id") and context.session_id:
                injected["session_id"] = context.session_id

        return injected

    async def _execute_mcp_tool(
        self, tool_name: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute tool via FastMCP server

        Args:
            tool_name: Tool name
            parameters: Tool parameters

        Returns:
            Execution result dict with optional dropped_params warning
        """
        try:
            from app.core.tools.mcp_server import call_mcp_tool
            from app.core.tools import executor_state

            result = await call_mcp_tool(tool_name, parameters)
            result = normalize_tool_output(tool_name, result)

            # Include dropped params warning if any
            dropped = executor_state.get_dropped_params()
            is_standard_success = (
                isinstance(result, dict)
                and result.get("success") is True
                and "data" in result
            )
            is_standard_error = (
                isinstance(result, dict)
                and result.get("success") is False
                and ("message" in result or "error_code" in result)
            )

            if is_standard_success or is_standard_error:
                response = dict(result)
                response.setdefault("tool_name", tool_name)
                response.setdefault("metadata", {})
            else:
                response = build_tool_success_response(result, tool_name=tool_name)
            if dropped:
                response["_warning"] = (
                    f"Các tham số không được chấp nhận (đã bị loại): {list(dropped.keys())}. "
                    "Vui lòng kiểm tra input schema của tool."
                )
                response["_dropped_params"] = list(dropped.keys())
                logger.info(
                    f"Tool '{tool_name}' executed with dropped params warning: {list(dropped.keys())}"
                )

            if isinstance(response, dict):
                logger.debug(f"  ├─ Response keys: {list(response.keys())}")
                if isinstance(response.get("data"), dict):
                    logger.debug(f"  ├─ Data keys: {list(response['data'].keys())}")

            # Clear dropped params after use
            executor_state.clear_dropped_params()
            return response

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            from app.core.tools import executor_state

            dropped = executor_state.get_dropped_params()
            executor_state.clear_dropped_params()
            response = build_tool_error_response(
                error_code=classify_error_code(str(e)),
                message=f"Không thể thực thi công cụ `{tool_name}` lúc này.",
                recoverable=True,
                suggestion="Vui lòng kiểm tra lại dữ liệu đầu vào hoặc thử lại sau ít phút.",
                tool_name=tool_name,
                metadata={"root_error": str(e)},
            )
            if dropped:
                response["_dropped_params"] = list(dropped.keys())
                response["_warning"] = (
                    f"Các tham số không được chấp nhận (đã bị loại): {list(dropped.keys())}. "
                    "Đây có thể là nguyên nhân gây lỗi."
                )
            return response

    async def execute_batch(
        self, tool_calls: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tools in batch (parallel)

        Args:
            tool_calls: List of tool call configs:
                [
                    {"tool_name": "check_available_slots", "parameters": {...}},
                    {"tool_name": "create_booking_for_user", "parameters": {...}}
                ]

        Returns:
            List of execution results
        """
        import asyncio

        tasks = [
            self.execute(
                tool_name=call["tool_name"], parameters=call.get("parameters", {})
            )
            for call in tool_calls
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        return [
            result
            if not isinstance(result, Exception)
            else build_tool_error_response(
                error_code=classify_error_code(str(result)),
                message="Không thể thực thi một hoặc nhiều công cụ trong batch.",
                recoverable=True,
                suggestion="Vui lòng thử lại với dữ liệu đầu vào rõ ràng hơn.",
                metadata={"root_error": str(result)},
            )
            for result in results
        ]


# ===== HELPER FUNCTIONS =====


async def get_tool_by_name(tool_name: str) -> Optional[Tool]:
    """
    Helper: Get tool by name

    Args:
        tool_name: Tool name

    Returns:
        Tool object or None
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tool).where(Tool.name == tool_name))
        return result.scalar_one_or_none()


async def get_enabled_tools() -> List[Tool]:
    """
    Helper: Get all enabled tools

    Returns:
        List of enabled Tool objects
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tool).where(Tool.enabled == True))
        return result.scalars().all()


async def get_tool_schemas() -> List[Dict[str, Any]]:
    """
    Get tool schemas formatted for LLM consumption

    Returns:
        List of tool schemas for LLM function calling
    """
    tools = await get_enabled_tools()

    return [
        {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.input_schema
            or {"type": "object", "properties": {}, "required": []},
        }
        for tool in tools
    ]


# ===== GLOBAL EXECUTOR INSTANCE =====
tool_executor = ToolExecutor()


# ===== CONVENIENCE FUNCTION FOR SINGLE AGENT =====


async def execute_tool(tool_name: str, params: dict) -> dict:
    """
    Execute tool by name (convenience function for Single Agent)

    This function is used by SingleAgent's act node to execute tools.

    Args:
        tool_name: Name of the tool to execute
        params: Parameters dictionary

    Returns:
        Tool execution result dict

    Usage in SingleAgent:
        from app.core.tools.executor import execute_tool
        result = await execute_tool("pet_knowledge_search", {"query": "chó bị tiêu chảy"})
    """
    return await tool_executor.execute(tool_name, params)
