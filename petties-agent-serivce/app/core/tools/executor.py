"""
PETTIES AGENT SERVICE - Tool Executor
Execute code-based tools via FastMCP server

Package: app.core.tools
Purpose: Execute tools for LangGraph agents
Version: v0.0.2 - Simplified for code-based tools
"""

from typing import Dict, List, Any, Optional
from sqlalchemy import select
from loguru import logger

from app.db.postgres.models import Tool
from app.db.postgres.session import AsyncSessionLocal


class ToolExecutor:
    """
    Tool Executor for Code-based Tools

    Purpose: Execute FastMCP tools from LangGraph agents
    Methods:
        - execute(): Execute tool with parameters
        - get_tool_schema(): Get tool schema for LLM
        - validate_parameters(): Validate parameters against schema
    """

    def __init__(self):
        """Initialize Tool Executor"""
        pass

    async def execute(
        self,
        tool_name: str,
        parameters: Dict[str, Any] = None
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

        logger.info(f"Executing tool: {tool_name} with params: {parameters}")

        # Step 1: Load tool from database
        tool = await self._load_tool(tool_name)

        if not tool:
            raise Exception(f"Tool '{tool_name}' not found in database")

        if not tool.enabled:
            raise Exception(f"Tool '{tool_name}' is not enabled")

        # Step 2: Validate parameters
        self._validate_parameters(tool, parameters)

        # Step 3: Execute via FastMCP
        result = await self._execute_mcp_tool(tool_name, parameters)

        logger.info(f"Tool executed successfully: {tool_name}")

        return result

    async def _load_tool(self, tool_name: str) -> Optional[Tool]:
        """
        Load tool from database

        Args:
            tool_name: Tool name

        Returns:
            Tool object or None
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.name == tool_name)
            )
            return result.scalar_one_or_none()

    def _validate_parameters(self, tool: Tool, parameters: Dict[str, Any]):
        """
        Validate parameters against tool schema

        Args:
            tool: Tool object
            parameters: User-provided parameters

        Raises:
            Exception if parameters invalid
        """
        if not tool.input_schema:
            return

        schema = tool.input_schema
        required = schema.get("required", [])

        for param_name in required:
            if param_name not in parameters:
                raise Exception(f"Missing required parameter: {param_name}")

        logger.debug(f"Parameters validated for tool: {tool.name}")

    async def _execute_mcp_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute tool via FastMCP server

        Args:
            tool_name: Tool name
            parameters: Tool parameters

        Returns:
            Execution result dict
        """
        try:
            from app.core.tools.mcp_server import call_mcp_tool

            result = await call_mcp_tool(tool_name, parameters)

            return {
                "success": True,
                "data": result,
                "tool_name": tool_name
            }

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "tool_name": tool_name
            }

    async def execute_batch(
        self,
        tool_calls: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tools in batch (parallel)

        Args:
            tool_calls: List of tool call configs:
                [
                    {"tool_name": "check_slot", "parameters": {...}},
                    {"tool_name": "create_booking", "parameters": {...}}
                ]

        Returns:
            List of execution results
        """
        import asyncio

        tasks = [
            self.execute(
                tool_name=call["tool_name"],
                parameters=call.get("parameters", {})
            )
            for call in tool_calls
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        return [
            result if not isinstance(result, Exception) else {
                "success": False,
                "error": str(result)
            }
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
        result = await session.execute(
            select(Tool).where(Tool.name == tool_name)
        )
        return result.scalar_one_or_none()


async def get_enabled_tools_for_agent(agent_name: str) -> List[Tool]:
    """
    Helper: Get enabled tools for specific agent

    Args:
        agent_name: Agent name (e.g., booking_agent)

    Returns:
        List of enabled Tool objects assigned to agent
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Tool).where(
                Tool.enabled == True,
                Tool.assigned_agents.contains([agent_name])
            )
        )
        return result.scalars().all()


async def get_tool_schemas_for_agent(agent_name: str) -> List[Dict[str, Any]]:
    """
    Get tool schemas formatted for LLM consumption

    Args:
        agent_name: Agent name

    Returns:
        List of tool schemas for LLM function calling
    """
    tools = await get_enabled_tools_for_agent(agent_name)

    return [
        {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.input_schema or {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
        for tool in tools
    ]


# ===== GLOBAL EXECUTOR INSTANCE =====
tool_executor = ToolExecutor()
