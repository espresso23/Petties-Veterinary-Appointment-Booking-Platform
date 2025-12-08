"""
PETTIES AGENT SERVICE - Swagger Importer
Auto-import API tools từ Spring Boot Swagger/OpenAPI specs

Package: app.core.tools
Purpose: TL-03 - Swagger/OpenAPI Importer
Version: v0.0.1
"""

from typing import Dict, List, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.tools.openapi_parser import OpenAPIParser
from app.db.postgres.models import Tool, ToolTypeEnum, ToolSource
from app.db.postgres.session import AsyncSessionLocal


class SwaggerImporter:
    """
    Swagger Importer Service

    Purpose: Auto-import API tools từ Swagger/OpenAPI specs
    Methods:
        - import_from_swagger(): Main method - import tất cả endpoints
        - sync_tools_to_db(): Sync tools vào PostgreSQL
        - compare_with_existing(): Compare với tools hiện có
    """

    def __init__(self, base_url: str = "http://localhost:8080"):
        """
        Initialize Swagger Importer

        Args:
            base_url: Base URL của Spring Boot backend
        """
        self.base_url = base_url
        self.parser = OpenAPIParser(base_url)

    async def import_from_swagger(
        self,
        swagger_url: str = "/v3/api-docs",
        auto_enable: bool = False
    ) -> Dict[str, Any]:
        """
        Main method: Import tất cả endpoints từ Swagger

        Args:
            swagger_url: URL của Swagger spec (ví dụ: /v3/api-docs)
            auto_enable: Tự động enable tools sau khi import (default: False)

        Returns:
            Dict với import summary:
                {
                    "total_endpoints": 15,
                    "new_tools": 10,
                    "updated_tools": 3,
                    "skipped_tools": 2,
                    "tools": [...]
                }

        Flow:
            1. Fetch OpenAPI spec từ URL
            2. Parse spec và extract endpoints
            3. Compare với tools hiện có trong DB
            4. Insert new tools / Update existing tools
            5. Return summary
        """
        logger.info(f"🚀 Starting Swagger import from {swagger_url}")

        # Step 1: Fetch OpenAPI spec
        spec = await self.parser.fetch_spec(swagger_url)
        server_url = self.parser.get_server_url()

        # Step 2: Parse spec và extract endpoints
        tools_metadata = self.parser.parse_spec()
        total_endpoints = len(tools_metadata)

        logger.info(f"📊 Found {total_endpoints} endpoints in Swagger spec")

        # Step 3 & 4: Sync to database
        sync_result = await self.sync_tools_to_db(
            tools_metadata=tools_metadata,
            swagger_url=swagger_url,
            auto_enable=auto_enable
        )

        # Step 5: Build summary
        summary = {
            "swagger_url": swagger_url,
            "server_url": server_url,
            "openapi_version": spec.get("openapi", "unknown"),
            "total_endpoints": total_endpoints,
            "new_tools": sync_result["new_count"],
            "updated_tools": sync_result["updated_count"],
            "skipped_tools": sync_result["skipped_count"],
            "tools": sync_result["tools"]
        }

        logger.success(
            f"✅ Swagger import completed: "
            f"{sync_result['new_count']} new, "
            f"{sync_result['updated_count']} updated, "
            f"{sync_result['skipped_count']} skipped"
        )

        return summary

    async def sync_tools_to_db(
        self,
        tools_metadata: List[Dict[str, Any]],
        swagger_url: str,
        auto_enable: bool = False
    ) -> Dict[str, Any]:
        """
        Sync tools vào PostgreSQL database

        Args:
            tools_metadata: List of tool metadata từ parser
            swagger_url: Swagger URL (lưu vào tool record)
            auto_enable: Auto enable tools sau khi import

        Returns:
            Dict với sync result:
                {
                    "new_count": 10,
                    "updated_count": 3,
                    "skipped_count": 2,
                    "tools": [...]
                }
        """
        async with AsyncSessionLocal() as session:
            new_count = 0
            updated_count = 0
            skipped_count = 0
            imported_tools = []

            for tool_meta in tools_metadata:
                try:
                    # Check if tool already exists (by name or operation_id)
                    result = await session.execute(
                        select(Tool).where(
                            (Tool.name == tool_meta["name"]) |
                            (Tool.operation_id == tool_meta["operation_id"])
                        )
                    )
                    existing_tool = result.scalar_one_or_none()

                    if existing_tool:
                        # UPDATE existing tool
                        if self._should_update_tool(existing_tool, tool_meta, swagger_url):
                            self._update_tool_from_metadata(
                                tool=existing_tool,
                                metadata=tool_meta,
                                swagger_url=swagger_url
                            )
                            updated_count += 1
                            logger.info(f"🔄 Updated tool: {existing_tool.name}")
                        else:
                            skipped_count += 1
                            logger.debug(f"⏭️  Skipped tool (no changes): {existing_tool.name}")

                        imported_tools.append({
                            "id": existing_tool.id,
                            "name": existing_tool.name,
                            "action": "updated" if self._should_update_tool(existing_tool, tool_meta, swagger_url) else "skipped"
                        })

                    else:
                        # INSERT new tool
                        new_tool = self._create_tool_from_metadata(
                            metadata=tool_meta,
                            swagger_url=swagger_url,
                            auto_enable=auto_enable
                        )
                        session.add(new_tool)
                        new_count += 1
                        logger.info(f"✨ Created new tool: {new_tool.name}")

                        imported_tools.append({
                            "name": new_tool.name,
                            "action": "created"
                        })

                except Exception as e:
                    logger.error(f"❌ Error syncing tool {tool_meta['name']}: {e}")
                    skipped_count += 1

            # Commit all changes
            await session.commit()

            return {
                "new_count": new_count,
                "updated_count": updated_count,
                "skipped_count": skipped_count,
                "tools": imported_tools
            }

    def _create_tool_from_metadata(
        self,
        metadata: Dict[str, Any],
        swagger_url: str,
        auto_enable: bool = False
    ) -> Tool:
        """
        Create Tool object từ metadata

        Args:
            metadata: Tool metadata từ OpenAPIParser
            swagger_url: Swagger URL
            auto_enable: Auto enable tool

        Returns:
            Tool object
        """
        return Tool(
            name=metadata["name"],
            original_name=metadata["original_name"],
            tool_type=ToolTypeEnum.API_BASED,
            source=ToolSource.SWAGGER_IMPORTED,
            description=metadata["description"],

            # API fields
            method=metadata["method"],
            path=metadata["path"],
            endpoint=metadata["endpoint"],

            # Swagger fields
            swagger_url=swagger_url,
            operation_id=metadata["operation_id"],
            path_parameters=metadata["path_parameters"],
            query_parameters=metadata["query_parameters"],
            request_body_schema=metadata["request_body_schema"],
            response_schema=metadata["response_schema"],

            # Status
            enabled=auto_enable,
            assigned_agents=[]
        )

    def _update_tool_from_metadata(
        self,
        tool: Tool,
        metadata: Dict[str, Any],
        swagger_url: str
    ):
        """
        Update existing tool từ metadata

        Args:
            tool: Existing Tool object
            metadata: New metadata từ OpenAPIParser
            swagger_url: Swagger URL
        """
        # Update description (nếu thay đổi)
        if metadata["description"] != tool.description:
            tool.description = metadata["description"]

        # Update schemas
        tool.path_parameters = metadata["path_parameters"]
        tool.query_parameters = metadata["query_parameters"]
        tool.request_body_schema = metadata["request_body_schema"]
        tool.response_schema = metadata["response_schema"]

        # Update swagger metadata
        tool.swagger_url = swagger_url
        tool.operation_id = metadata["operation_id"]

        # Update endpoint (nếu base URL thay đổi)
        tool.endpoint = metadata["endpoint"]

    def _should_update_tool(
        self,
        existing_tool: Tool,
        new_metadata: Dict[str, Any],
        swagger_url: str
    ) -> bool:
        """
        Check if tool cần được update

        Args:
            existing_tool: Existing Tool object
            new_metadata: New metadata từ parser
            swagger_url: Swagger URL

        Returns:
            True nếu cần update, False nếu không
        """
        # Check if description changed
        if existing_tool.description != new_metadata["description"]:
            return True

        # Check if schemas changed
        if existing_tool.request_body_schema != new_metadata["request_body_schema"]:
            return True

        if existing_tool.path_parameters != new_metadata["path_parameters"]:
            return True

        if existing_tool.query_parameters != new_metadata["query_parameters"]:
            return True

        # Check if swagger URL changed (migrating to new backend)
        if existing_tool.swagger_url != swagger_url:
            return True

        return False

    async def get_import_history(
        self,
        swagger_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get import history - danh sách tools đã import từ Swagger

        Args:
            swagger_url: Filter by Swagger URL (optional)

        Returns:
            List of imported tools
        """
        async with AsyncSessionLocal() as session:
            query = select(Tool).where(Tool.source == ToolSource.SWAGGER_IMPORTED)

            if swagger_url:
                query = query.where(Tool.swagger_url == swagger_url)

            result = await session.execute(query)
            tools = result.scalars().all()

            return [
                {
                    "id": tool.id,
                    "name": tool.name,
                    "original_name": tool.original_name,
                    "method": tool.method,
                    "path": tool.path,
                    "enabled": tool.enabled,
                    "swagger_url": tool.swagger_url,
                    "assigned_agents": tool.assigned_agents,
                    "created_at": tool.created_at.isoformat() if tool.created_at else None
                }
                for tool in tools
            ]

    async def rename_tool(
        self,
        tool_id: int,
        new_name: str
    ) -> Dict[str, Any]:
        """
        Rename imported tool (UC-02 flow - Admin rename)

        Args:
            tool_id: Tool ID
            new_name: New tool name

        Returns:
            Updated tool info

        Example:
            Admin nhìn thấy "vaccine_controller_get_history"
            Admin rename thành "check_vaccine_history"
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.id == tool_id)
            )
            tool = result.scalar_one_or_none()

            if not tool:
                raise Exception(f"Tool với ID {tool_id} không tồn tại")

            # Check if new name already exists
            result = await session.execute(
                select(Tool).where(Tool.name == new_name)
            )
            existing = result.scalar_one_or_none()

            if existing and existing.id != tool_id:
                raise Exception(f"Tool name '{new_name}' đã tồn tại")

            # Update name
            old_name = tool.name
            tool.name = new_name

            await session.commit()

            logger.info(f"✏️  Renamed tool: {old_name} -> {new_name}")

            return {
                "id": tool.id,
                "old_name": old_name,
                "new_name": new_name,
                "original_name": tool.original_name
            }
