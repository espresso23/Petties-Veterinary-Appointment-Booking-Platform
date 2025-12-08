"""
PETTIES AGENT SERVICE - Dynamic Tool Executor
Execute Swagger-imported API tools dynamically

Package: app.core.tools
Purpose: TL-03 - Dynamic execution cho Swagger tools
Version: v0.0.1
"""

import httpx
import json
from typing import Dict, List, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.postgres.models import Tool, ToolSource
from app.db.postgres.session import AsyncSessionLocal


class DynamicToolExecutor:
    """
    Dynamic Tool Executor

    Purpose: Execute Swagger-imported API tools dynamically
    Methods:
        - execute(): Execute tool với parameters
        - build_request(): Build HTTP request từ tool metadata
        - validate_parameters(): Validate parameters theo schema
    """

    def __init__(self, base_url: str = "http://localhost:8080", timeout: float = 30.0):
        """
        Initialize Dynamic Tool Executor

        Args:
            base_url: Base URL của Spring Boot backend
            timeout: Request timeout (seconds)
        """
        self.base_url = base_url
        self.timeout = timeout

    async def execute(
        self,
        tool_name: str,
        parameters: Dict[str, Any] = None,
        headers: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Execute tool với parameters

        Args:
            tool_name: Tool name (ví dụ: check_vaccine_history)
            parameters: Tool parameters dict
            headers: Custom HTTP headers (optional)

        Returns:
            Tool execution result:
                {
                    "success": True,
                    "data": {...},
                    "status_code": 200,
                    "tool_name": "check_vaccine_history"
                }

        Example:
            >>> executor = DynamicToolExecutor()
            >>> result = await executor.execute(
            ...     tool_name="check_vaccine_history",
            ...     parameters={"petId": "PET_12345"}
            ... )
        """
        if parameters is None:
            parameters = {}

        logger.info(f"🔧 Executing tool: {tool_name} with params: {parameters}")

        # Step 1: Load tool from database
        tool = await self._load_tool(tool_name)

        if not tool:
            raise Exception(f"Tool '{tool_name}' không tồn tại trong database")

        if not tool.enabled:
            raise Exception(f"Tool '{tool_name}' chưa được enable")

        # Step 2: Validate parameters
        self._validate_parameters(tool, parameters)

        # Step 3: Build HTTP request
        request_config = self._build_request(tool, parameters, headers)

        # Step 4: Execute request
        result = await self._execute_request(tool, request_config)

        logger.success(f"✅ Tool executed successfully: {tool_name}")

        return result

    async def _load_tool(self, tool_name: str) -> Optional[Tool]:
        """
        Load tool từ database

        Args:
            tool_name: Tool name

        Returns:
            Tool object hoặc None
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.name == tool_name)
            )
            return result.scalar_one_or_none()

    def _validate_parameters(self, tool: Tool, parameters: Dict[str, Any]):
        """
        Validate parameters theo tool schema

        Args:
            tool: Tool object
            parameters: User-provided parameters

        Raises:
            Exception nếu parameters invalid
        """
        # TODO: Implement JSON schema validation
        # Với path parameters
        path_params = tool.path_parameters or {}
        for param_name, param_schema in path_params.items():
            if param_schema.get("required", False) and param_name not in parameters:
                raise Exception(f"Missing required path parameter: {param_name}")

        # Với query parameters
        query_params = tool.query_parameters or {}
        for param_name, param_schema in query_params.items():
            if param_schema.get("required", False) and param_name not in parameters:
                raise Exception(f"Missing required query parameter: {param_name}")

        # Với request body
        if tool.request_body_schema:
            body_required = tool.request_body_schema.get("required", False)
            if body_required and "body" not in parameters:
                raise Exception("Missing required request body")

        logger.debug(f"✅ Parameters validated for tool: {tool.name}")

    def _build_request(
        self,
        tool: Tool,
        parameters: Dict[str, Any],
        custom_headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Build HTTP request từ tool metadata và parameters

        Args:
            tool: Tool object
            parameters: User-provided parameters
            custom_headers: Custom HTTP headers

        Returns:
            Request config dict:
                {
                    "method": "POST",
                    "url": "http://localhost:8080/api/bookings/12345",
                    "params": {"page": 0},
                    "json": {...},
                    "headers": {...}
                }
        """
        # Step 1: Build URL với path parameters
        url = self._build_url(tool, parameters)

        # Step 2: Extract query parameters
        query_params = self._extract_query_params(tool, parameters)

        # Step 3: Extract request body (POST/PUT)
        request_body = parameters.get("body") if tool.method in ["POST", "PUT", "PATCH"] else None

        # Step 4: Build headers
        headers = {"Content-Type": "application/json"}
        if tool.headers:
            headers.update(tool.headers)
        if custom_headers:
            headers.update(custom_headers)

        request_config = {
            "method": tool.method,
            "url": url,
            "params": query_params,
            "headers": headers
        }

        if request_body:
            request_config["json"] = request_body

        logger.debug(f"Built request config: {request_config}")

        return request_config

    def _build_url(self, tool: Tool, parameters: Dict[str, Any]) -> str:
        """
        Build URL với path parameters

        Args:
            tool: Tool object
            parameters: User parameters

        Returns:
            Full URL with path params replaced

        Example:
            tool.path = "/api/bookings/{id}"
            parameters = {"id": "12345"}
            -> "http://localhost:8080/api/bookings/12345"
        """
        url_path = tool.path

        # Replace path parameters: /api/bookings/{id} -> /api/bookings/12345
        path_params = tool.path_parameters or {}
        for param_name in path_params.keys():
            if param_name in parameters:
                placeholder = f"{{{param_name}}}"
                url_path = url_path.replace(placeholder, str(parameters[param_name]))

        # Build full URL
        full_url = f"{self.base_url}{url_path}"

        return full_url

    def _extract_query_params(
        self,
        tool: Tool,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Extract query parameters từ user parameters

        Args:
            tool: Tool object
            parameters: User parameters

        Returns:
            Query params dict

        Example:
            tool.query_parameters = {"page": {...}, "size": {...}}
            parameters = {"page": 0, "size": 10, "id": "123"}
            -> {"page": 0, "size": 10}
        """
        query_params = {}
        query_param_names = (tool.query_parameters or {}).keys()

        for param_name in query_param_names:
            if param_name in parameters:
                query_params[param_name] = parameters[param_name]

        return query_params

    async def _execute_request(
        self,
        tool: Tool,
        request_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute HTTP request đến Spring Boot backend

        Args:
            tool: Tool object
            request_config: Request config từ _build_request()

        Returns:
            Execution result dict
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=request_config["method"],
                    url=request_config["url"],
                    params=request_config.get("params"),
                    json=request_config.get("json"),
                    headers=request_config.get("headers")
                )

                # Parse response
                try:
                    response_data = response.json()
                except json.JSONDecodeError:
                    response_data = response.text

                # Check status
                if response.is_success:
                    return {
                        "success": True,
                        "data": response_data,
                        "status_code": response.status_code,
                        "tool_name": tool.name,
                        "method": tool.method,
                        "url": request_config["url"]
                    }
                else:
                    return {
                        "success": False,
                        "error": response_data,
                        "status_code": response.status_code,
                        "tool_name": tool.name,
                        "method": tool.method,
                        "url": request_config["url"]
                    }

        except httpx.HTTPError as e:
            logger.error(f"❌ HTTP error executing tool {tool.name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "status_code": 0,
                "tool_name": tool.name
            }

        except Exception as e:
            logger.error(f"❌ Error executing tool {tool.name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "status_code": 0,
                "tool_name": tool.name
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
                    {"tool_name": "get_vaccine_history", "parameters": {...}}
                ]

        Returns:
            List of execution results
        """
        import asyncio

        tasks = [
            self.execute(
                tool_name=call["tool_name"],
                parameters=call.get("parameters", {}),
                headers=call.get("headers")
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
        Tool object hoặc None
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
        agent_name: Agent name (ví dụ: booking_agent)

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
