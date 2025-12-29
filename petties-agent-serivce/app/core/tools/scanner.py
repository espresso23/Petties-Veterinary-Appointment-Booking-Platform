"""
PETTIES AGENT SERVICE - Tool Scanner Service
Automated Tool Scanner - Quét và đồng bộ MCP tools vào PostgreSQL

Package: app.core.tools
Purpose:
    - Scan tất cả code-based tools từ FastMCP server
    - Đồng bộ tool metadata vào PostgreSQL database
    - Hiển thị "New Tools" trên Admin Dashboard để gán cho agents

Reference:
    - TL-01: Automated Tool Scanner (Critical Priority)
    - UC-02: Cập nhật MCP Tool mới từ Code

Flow:
    1. Admin nhấn "Scan Tools" trên Dashboard
    2. Backend gọi FastMCP server để lấy tool metadata
    3. Scanner compare với DB → tìm new tools
    4. Lưu new tools vào PostgreSQL (enabled=False by default)
    5. Admin gán tools cho agents và set enabled=True

Version: v0.0.1
"""

from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.tools.mcp_server import get_mcp_tools_metadata, mcp_server
from app.db.postgres.models import Tool
from app.db.postgres.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


class ToolScanner:
    """
    Tool Scanner Service

    Purpose:
        - Auto-discovery/listing tools từ FastMCP server
        - Đồng bộ vào PostgreSQL database
        - Track new tools vs existing tools
    """

    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.ToolScanner")

    async def scan_and_sync_tools(self) -> Dict[str, Any]:
        """
        Main method: Scan FastMCP server và sync vào database

        Returns:
            Dict chứa:
                - total_tools: int - Tổng số tools trong MCP server
                - new_tools: int - Số tools mới được thêm
                - updated_tools: int - Số tools đã cập nhật
                - tool_list: List[str] - Danh sách tool names

        Flow:
            1. Lấy tool metadata từ FastMCP server
            2. Query existing tools từ PostgreSQL
            3. Compare để tìm new/updated tools
            4. Insert/update vào database
        """
        self.logger.info("🔍 Starting tool scan...")

        # Step 1: Get tools from FastMCP server (async for FastMCP 2.x)
        mcp_tools = await get_mcp_tools_metadata()
        total_tools = len(mcp_tools)

        self.logger.info(f"📋 Found {total_tools} tools in FastMCP server")

        # Step 2: Sync to database
        async with AsyncSessionLocal() as session:
            new_count, updated_count = await self._sync_tools_to_db(
                session, mcp_tools
            )

        self.logger.info(
            f"✅ Tool scan complete: "
            f"{new_count} new, {updated_count} updated, {total_tools} total"
        )

        return {
            "total_tools": total_tools,
            "new_tools": new_count,
            "updated_tools": updated_count,
            "tool_list": [tool["name"] for tool in mcp_tools]
        }

    async def _sync_tools_to_db(
        self,
        session: AsyncSession,
        mcp_tools: List[Dict[str, Any]]
    ) -> tuple[int, int]:
        """
        Sync tools vào PostgreSQL database

        Args:
            session: AsyncSession
            mcp_tools: List of tool metadata từ FastMCP

        Returns:
            Tuple (new_count, updated_count)
        """
        new_count = 0
        updated_count = 0

        for tool_meta in mcp_tools:
            tool_name = tool_meta["name"]

            # Check if tool already exists
            result = await session.execute(
                select(Tool).where(Tool.name == tool_name)
            )
            existing_tool = result.scalar_one_or_none()

            if existing_tool:
                # Update existing tool metadata
                existing_tool.description = tool_meta.get("description", "")
                existing_tool.input_schema = tool_meta.get("input_schema")
                existing_tool.output_schema = tool_meta.get("output_schema")
                updated_count += 1

                self.logger.info(f"🔄 Updated tool: {tool_name}")
            else:
                # Create new tool (all tools are code-based per TECHNICAL SCOPE v4.0)
                new_tool = Tool(
                    name=tool_name,
                    description=tool_meta.get("description", ""),
                    input_schema=tool_meta.get("input_schema"),
                    output_schema=tool_meta.get("output_schema"),
                    enabled=False,  # Default disabled, admin needs to enable
                    assigned_agents=[]  # Empty list, admin needs to assign
                )
                session.add(new_tool)
                new_count += 1

                self.logger.info(f"✨ New tool discovered: {tool_name}")

        await session.commit()

        return new_count, updated_count

    async def get_new_tools(self) -> List[Dict[str, Any]]:
        """
        Lấy danh sách tools mới (chưa được enable)

        Returns:
            List of new tools (enabled=False)

        Purpose:
            - Admin Dashboard hiển thị "New Tools" cần review
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.enabled == False)
            )
            new_tools = result.scalars().all()

            return [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "tool_type": tool.tool_type,
                    "input_schema": tool.input_schema,
                    "output_schema": tool.output_schema
                }
                for tool in new_tools
            ]

    async def assign_tool_to_agent(
        self,
        tool_name: str,
        agent_name: str
    ) -> Dict[str, Any]:
        """
        Gán tool cho agent

        Args:
            tool_name: Tên tool (ví dụ: "check_slot")
            agent_name: Tên agent (ví dụ: "booking_agent")

        Returns:
            Dict với kết quả assignment

        Purpose:
            - Admin gán tool cho specific agent qua Dashboard
            - Update assigned_agents array in PostgreSQL

        Reference: TL-02 - Tool Assignment & Routing
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.name == tool_name)
            )
            tool = result.scalar_one_or_none()

            if not tool:
                return {
                    "success": False,
                    "message": f"Tool '{tool_name}' not found"
                }

            # Add agent to assigned_agents list
            if agent_name not in tool.assigned_agents:
                tool.assigned_agents.append(agent_name)
                await session.commit()

                self.logger.info(
                    f"✅ Assigned tool '{tool_name}' to agent '{agent_name}'"
                )

                return {
                    "success": True,
                    "message": f"Tool '{tool_name}' assigned to '{agent_name}'",
                    "assigned_agents": tool.assigned_agents
                }
            else:
                return {
                    "success": False,
                    "message": f"Tool '{tool_name}' already assigned to '{agent_name}'"
                }

    async def enable_tool(self, tool_name: str) -> Dict[str, Any]:
        """
        Enable tool (set enabled=True)

        Args:
            tool_name: Tên tool cần enable

        Returns:
            Dict với kết quả

        Purpose:
            - Admin enable tool sau khi review
            - Chỉ enabled tools mới được load vào LangGraph agents
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.name == tool_name)
            )
            tool = result.scalar_one_or_none()

            if not tool:
                return {
                    "success": False,
                    "message": f"Tool '{tool_name}' not found"
                }

            tool.enabled = True
            await session.commit()

            self.logger.info(f"✅ Enabled tool: {tool_name}")

            return {
                "success": True,
                "message": f"Tool '{tool_name}' enabled successfully"
            }


# ===== GLOBAL SCANNER INSTANCE =====
tool_scanner = ToolScanner()


# ===== CLI TEST =====
if __name__ == "__main__":
    import asyncio

    async def test_scanner():
        """Test tool scanner"""
        print("🔍 Testing Tool Scanner...")

        # Scan and sync
        result = await tool_scanner.scan_and_sync_tools()
        print(f"\n📊 Scan Result:")
        print(f"  Total: {result['total_tools']}")
        print(f"  New: {result['new_tools']}")
        print(f"  Updated: {result['updated_tools']}")

        # Get new tools
        new_tools = await tool_scanner.get_new_tools()
        print(f"\n✨ New Tools ({len(new_tools)}):")
        for tool in new_tools:
            print(f"  - {tool['name']}: {tool['description'][:50]}...")

    asyncio.run(test_scanner())
