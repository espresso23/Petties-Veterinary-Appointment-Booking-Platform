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
from app.db.postgres.models import Tool, ToolType
from app.db.postgres.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


LEGACY_TOOL_RENAMES = {
    "pet_care_qa": "pet_knowledge_search",
    "symptom_search": "pet_knowledge_search",
    "search_clinics": "search_clinics_nearby",
    "check_slots": "check_available_slots",
    "create_booking": "create_booking_for_user",
}

ADMIN_CONFIGURABLE_TOOLS = {
    "pet_knowledge_search",
    "web_search",
}

SYSTEM_MANAGED_TOOLS = {
    "get_user_pets",
    "search_clinics_nearby",
    "get_clinic_services",
    "check_vaccination_status",
    "check_available_slots",
    "create_booking_for_user",
}

SYSTEM_AGENT_NAME = "petties_agent"


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
            new_count, updated_count = await self._sync_tools_to_db(session, mcp_tools)

        self.logger.info(
            f"✅ Tool scan complete: "
            f"{new_count} new, {updated_count} updated, {total_tools} total"
        )

        return {
            "total_tools": total_tools,
            "new_tools": new_count,
            "updated_tools": updated_count,
            "tool_list": [tool["name"] for tool in mcp_tools],
        }

    async def _sync_tools_to_db(
        self, session: AsyncSession, mcp_tools: List[Dict[str, Any]]
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
        mcp_tool_map = {tool["name"]: tool for tool in mcp_tools}

        await self._migrate_legacy_tools(session, mcp_tool_map)

        for tool_meta in mcp_tools:
            tool_name = tool_meta["name"]

            # Check if tool already exists
            result = await session.execute(select(Tool).where(Tool.name == tool_name))
            existing_tool = result.scalar_one_or_none()

            if existing_tool:
                # Update existing tool metadata
                existing_tool.description = tool_meta.get("description", "")
                existing_tool.input_schema = tool_meta.get("input_schema")
                existing_tool.output_schema = tool_meta.get("output_schema")
                if tool_name in SYSTEM_MANAGED_TOOLS:
                    existing_tool.enabled = True
                    existing_tool.assigned_agents = [SYSTEM_AGENT_NAME]
                elif (
                    tool_name in ADMIN_CONFIGURABLE_TOOLS
                    and not existing_tool.assigned_agents
                ):
                    existing_tool.assigned_agents = [SYSTEM_AGENT_NAME]
                updated_count += 1

                self.logger.info(f"🔄 Updated tool: {tool_name}")
            else:
                # Create new tool (all tools are code-based per TECHNICAL SCOPE v4.0)
                new_tool = Tool(
                    name=tool_name,
                    description=tool_meta.get("description", ""),
                    tool_type=ToolType.CODE_BASED,
                    input_schema=tool_meta.get("input_schema"),
                    output_schema=tool_meta.get("output_schema"),
                    enabled=tool_name in SYSTEM_MANAGED_TOOLS
                    or tool_name in ADMIN_CONFIGURABLE_TOOLS,
                    assigned_agents=[SYSTEM_AGENT_NAME]
                    if tool_name in SYSTEM_MANAGED_TOOLS
                    or tool_name in ADMIN_CONFIGURABLE_TOOLS
                    else [],
                )
                session.add(new_tool)
                new_count += 1

                self.logger.info(f"✨ New tool discovered: {tool_name}")

        await session.commit()

        return new_count, updated_count

    async def _migrate_legacy_tools(
        self,
        session: AsyncSession,
        mcp_tool_map: Dict[str, Dict[str, Any]],
    ) -> None:
        """Migrate legacy tool rows in DB to current canonical tool names."""
        existing_result = await session.execute(select(Tool))
        existing_tools = {tool.name: tool for tool in existing_result.scalars().all()}

        for legacy_name, canonical_name in LEGACY_TOOL_RENAMES.items():
            legacy_tool = existing_tools.get(legacy_name)
            if not legacy_tool:
                continue

            canonical_meta = mcp_tool_map.get(canonical_name)
            if not canonical_meta:
                self.logger.warning(
                    "Skipping legacy tool migration '%s' -> '%s' because canonical tool is not registered in MCP.",
                    legacy_name,
                    canonical_name,
                )
                continue

            canonical_tool = existing_tools.get(canonical_name)
            merged_assigned_agents = sorted(
                set(
                    (legacy_tool.assigned_agents or [])
                    + ((canonical_tool.assigned_agents or []) if canonical_tool else [])
                )
            )
            merged_enabled = legacy_tool.enabled or (
                canonical_tool.enabled if canonical_tool else False
            )

            if canonical_name in SYSTEM_MANAGED_TOOLS:
                merged_enabled = True
                merged_assigned_agents = [SYSTEM_AGENT_NAME]
            elif (
                canonical_name in ADMIN_CONFIGURABLE_TOOLS
                and not merged_assigned_agents
            ):
                merged_assigned_agents = [SYSTEM_AGENT_NAME]

            if canonical_tool:
                canonical_tool.description = canonical_meta.get("description", "")
                canonical_tool.input_schema = canonical_meta.get("input_schema")
                canonical_tool.output_schema = canonical_meta.get("output_schema")
                canonical_tool.assigned_agents = merged_assigned_agents
                canonical_tool.enabled = merged_enabled
                self.logger.info(
                    "Merged legacy tool '%s' into existing '%s'",
                    legacy_name,
                    canonical_name,
                )
            else:
                legacy_tool.name = canonical_name
                legacy_tool.description = canonical_meta.get("description", "")
                legacy_tool.input_schema = canonical_meta.get("input_schema")
                legacy_tool.output_schema = canonical_meta.get("output_schema")
                legacy_tool.assigned_agents = merged_assigned_agents
                legacy_tool.enabled = merged_enabled
                canonical_tool = legacy_tool
                existing_tools[canonical_name] = canonical_tool
                self.logger.info(
                    "Migrated legacy tool '%s' -> '%s'",
                    legacy_name,
                    canonical_name,
                )

            if canonical_tool is not legacy_tool:
                await session.delete(legacy_tool)
            existing_tools.pop(legacy_name, None)

        await session.flush()

    async def get_new_tools(self) -> List[Dict[str, Any]]:
        """
        Lấy danh sách tools mới (chưa được enable)

        Returns:
            List of new tools (enabled=False)

        Purpose:
            - Admin Dashboard hiển thị "New Tools" cần review
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Tool).where(Tool.enabled == False))
            new_tools = result.scalars().all()

            return [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "tool_type": tool.tool_type,
                    "input_schema": tool.input_schema,
                    "output_schema": tool.output_schema,
                }
                for tool in new_tools
            ]

    async def assign_tool_to_agent(
        self, tool_name: str, agent_name: str
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
            result = await session.execute(select(Tool).where(Tool.name == tool_name))
            tool = result.scalar_one_or_none()

            if not tool:
                return {"success": False, "message": f"Tool '{tool_name}' not found"}

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
                    "assigned_agents": tool.assigned_agents,
                }
            else:
                return {
                    "success": False,
                    "message": f"Tool '{tool_name}' already assigned to '{agent_name}'",
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
            result = await session.execute(select(Tool).where(Tool.name == tool_name))
            tool = result.scalar_one_or_none()

            if not tool:
                return {"success": False, "message": f"Tool '{tool_name}' not found"}

            tool.enabled = True
            await session.commit()

            self.logger.info(f"✅ Enabled tool: {tool_name}")

            return {
                "success": True,
                "message": f"Tool '{tool_name}' enabled successfully",
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
