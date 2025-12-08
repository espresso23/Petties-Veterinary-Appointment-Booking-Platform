"""
PETTIES AGENT SERVICE - OpenAPI/Swagger Parser
Parse OpenAPI 3.0 specs và extract endpoints thành Tool metadata

Package: app.core.tools
Purpose: TL-03 - Swagger/OpenAPI Importer
Version: v0.0.1
"""

import httpx
import json
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin
from loguru import logger


class OpenAPIParser:
    """
    OpenAPI/Swagger Parser

    Purpose: Parse OpenAPI 3.0 specs và extract endpoints
    Methods:
        - fetch_spec(): Fetch OpenAPI JSON từ URL
        - parse_spec(): Parse spec và extract tools
        - extract_endpoint_metadata(): Extract metadata cho 1 endpoint
    """

    def __init__(self, base_url: str = "http://localhost:8080"):
        """
        Initialize OpenAPI Parser

        Args:
            base_url: Base URL của Spring Boot backend
        """
        self.base_url = base_url
        self.spec: Optional[Dict[str, Any]] = None

    async def fetch_spec(self, swagger_url: str) -> Dict[str, Any]:
        """
        Fetch OpenAPI spec từ URL

        Args:
            swagger_url: URL của OpenAPI spec (ví dụ: /v3/api-docs)

        Returns:
            OpenAPI spec as dict

        Example:
            >>> parser = OpenAPIParser("http://localhost:8080")
            >>> spec = await parser.fetch_spec("/v3/api-docs")
        """
        try:
            # Build full URL
            if swagger_url.startswith("http"):
                full_url = swagger_url
            else:
                full_url = urljoin(self.base_url, swagger_url)

            logger.info(f"📥 Fetching OpenAPI spec from: {full_url}")

            async with httpx.AsyncClient() as client:
                response = await client.get(full_url, timeout=30.0)
                response.raise_for_status()

                self.spec = response.json()
                logger.success(f"✅ Successfully fetched OpenAPI spec (version: {self.spec.get('openapi', 'unknown')})")

                return self.spec

        except httpx.HTTPError as e:
            logger.error(f"❌ Failed to fetch OpenAPI spec: {e}")
            raise Exception(f"Cannot fetch Swagger spec from {full_url}: {e}")

    def parse_spec(self) -> List[Dict[str, Any]]:
        """
        Parse OpenAPI spec và extract ALL endpoints thành Tool metadata

        Returns:
            List of tool metadata dicts

        Flow:
            1. Duyệt qua spec["paths"]
            2. Với mỗi path, extract tất cả operations (GET, POST, PUT, DELETE)
            3. Với mỗi operation, extract metadata
            4. Return list of tools

        Example Output:
            [
                {
                    "name": "booking_controller_create_booking",
                    "description": "Create new booking appointment",
                    "method": "POST",
                    "path": "/api/bookings",
                    "operation_id": "createBooking",
                    "parameters": {...},
                    "request_body": {...},
                    "responses": {...}
                },
                ...
            ]
        """
        if not self.spec:
            raise Exception("OpenAPI spec chưa được fetch. Hãy gọi fetch_spec() trước.")

        tools_metadata = []
        paths = self.spec.get("paths", {})

        logger.info(f"🔍 Parsing OpenAPI spec - Found {len(paths)} paths")

        for path, path_item in paths.items():
            # path: /api/bookings/{id}
            # path_item: {get: {...}, post: {...}, put: {...}, delete: {...}}

            for method, operation in path_item.items():
                # Skip non-HTTP methods (parameters, servers, etc.)
                if method.lower() not in ["get", "post", "put", "delete", "patch"]:
                    continue

                if not isinstance(operation, dict):
                    continue

                # Extract metadata cho endpoint này
                tool_metadata = self._extract_endpoint_metadata(
                    path=path,
                    method=method.upper(),
                    operation=operation
                )

                tools_metadata.append(tool_metadata)

        logger.success(f"✅ Parsed {len(tools_metadata)} endpoints from OpenAPI spec")
        return tools_metadata

    def _extract_endpoint_metadata(
        self,
        path: str,
        method: str,
        operation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Extract metadata cho 1 endpoint

        Args:
            path: API path (ví dụ: /api/bookings/{id})
            method: HTTP method (GET, POST, PUT, DELETE)
            operation: Operation object từ OpenAPI spec

        Returns:
            Tool metadata dict
        """
        # Extract operation ID (unique identifier)
        operation_id = operation.get("operationId", f"{method.lower()}_{path.replace('/', '_')}")

        # Extract description/summary
        description = operation.get("description") or operation.get("summary", "No description")

        # Extract tags (dùng để categorize)
        tags = operation.get("tags", [])

        # Generate tool name từ operationId or tags
        # Ví dụ: "BookingController_createBooking" -> "booking_controller_create_booking"
        tool_name = self._generate_tool_name(operation_id, tags, method, path)

        # Extract parameters (path params, query params, headers)
        parameters = self._extract_parameters(operation.get("parameters", []))

        # Extract request body (POST/PUT)
        request_body = self._extract_request_body(operation.get("requestBody"))

        # Extract responses
        responses = operation.get("responses", {})

        # Build tool metadata
        tool_metadata = {
            "name": tool_name,
            "original_name": operation_id,
            "description": description,
            "method": method,
            "path": path,
            "operation_id": operation_id,
            "tags": tags,

            # Parameters
            "path_parameters": parameters.get("path", {}),
            "query_parameters": parameters.get("query", {}),
            "header_parameters": parameters.get("header", {}),

            # Request/Response
            "request_body_schema": request_body,
            "response_schema": responses,

            # Full endpoint URL (sẽ được build runtime)
            "endpoint": f"{self.base_url}{path}"
        }

        return tool_metadata

    def _generate_tool_name(
        self,
        operation_id: str,
        tags: List[str],
        method: str,
        path: str
    ) -> str:
        """
        Generate tool name từ operationId

        Args:
            operation_id: Operation ID từ OpenAPI
            tags: Tags từ OpenAPI
            method: HTTP method
            path: API path

        Returns:
            Tool name (snake_case, lowercase)

        Examples:
            "BookingController_createBooking" -> "booking_controller_create_booking"
            "getVaccineHistory" -> "get_vaccine_history"
        """
        # Convert camelCase/PascalCase sang snake_case
        name = operation_id

        # Replace uppercase letters với _lowercase
        result = []
        for i, char in enumerate(name):
            if char.isupper():
                if i > 0 and name[i-1].islower():
                    result.append('_')
                result.append(char.lower())
            else:
                result.append(char)

        tool_name = ''.join(result)

        # Clean up double underscores
        tool_name = tool_name.replace('__', '_').strip('_')

        return tool_name

    def _extract_parameters(self, parameters: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Extract parameters từ OpenAPI operation

        Args:
            parameters: List of parameter objects

        Returns:
            Dict với keys: path, query, header
            Mỗi key chứa dict of parameter schemas

        Example:
            {
                "path": {"id": {"type": "string", "required": true}},
                "query": {"page": {"type": "integer", "default": 0}},
                "header": {}
            }
        """
        result = {
            "path": {},
            "query": {},
            "header": {}
        }

        for param in parameters:
            param_in = param.get("in")  # path, query, header
            param_name = param.get("name")
            param_required = param.get("required", False)
            param_schema = param.get("schema", {})
            param_description = param.get("description", "")

            if param_in in result:
                result[param_in][param_name] = {
                    "type": param_schema.get("type", "string"),
                    "description": param_description,
                    "required": param_required,
                    "schema": param_schema
                }

        return result

    def _extract_request_body(self, request_body: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Extract request body schema từ OpenAPI operation

        Args:
            request_body: requestBody object từ OpenAPI

        Returns:
            Request body schema hoặc None

        Example:
            {
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {...}
                        }
                    }
                }
            }
        """
        if not request_body:
            return None

        # Extract schema từ application/json content
        content = request_body.get("content", {})
        json_content = content.get("application/json", {})
        schema = json_content.get("schema")

        if schema:
            return {
                "required": request_body.get("required", False),
                "description": request_body.get("description", ""),
                "schema": schema
            }

        return None

    def get_server_url(self) -> str:
        """
        Extract server URL từ OpenAPI spec

        Returns:
            Server URL (ví dụ: http://localhost:8080)
        """
        if not self.spec:
            return self.base_url

        servers = self.spec.get("servers", [])
        if servers and len(servers) > 0:
            return servers[0].get("url", self.base_url)

        return self.base_url


# ===== HELPER FUNCTIONS =====

def convert_openapi_to_tool_schema(openapi_schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert OpenAPI parameter schema sang Tool input_schema format

    Args:
        openapi_schema: OpenAPI parameter/request body schema

    Returns:
        Tool-compatible input schema

    Example:
        Input (OpenAPI):
            {
                "path": {"id": {"type": "string", "required": true}},
                "query": {"page": {"type": "integer"}},
                "body": {"schema": {...}}
            }

        Output (Tool Schema):
            {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "page": {"type": "integer"},
                    "body": {...}
                },
                "required": ["id"]
            }
    """
    # TODO: Implement conversion logic
    # This is a placeholder - will implement based on actual FastMCP requirements
    return openapi_schema
