"""
PETTIES AGENT SERVICE - Tool Scanner Service
Synchronize FastMCP tools into PostgreSQL for the single-agent runtime.
"""

from typing import Any, Dict, List
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tools.mcp_server import get_mcp_tools_metadata
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


class ToolScanner:
    """Scan FastMCP tools and sync their metadata into PostgreSQL."""

    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.ToolScanner")

    async def scan_and_sync_tools(self) -> Dict[str, Any]:
        mcp_tools = await get_mcp_tools_metadata()
        total_tools = len(mcp_tools)

        self.logger.info("Found %s tools in FastMCP server", total_tools)

        async with AsyncSessionLocal() as session:
            new_count, updated_count = await self._sync_tools_to_db(session, mcp_tools)

        return {
            "total_tools": total_tools,
            "new_tools": new_count,
            "updated_tools": updated_count,
            "tool_list": [tool["name"] for tool in mcp_tools],
        }

    async def _sync_tools_to_db(
        self, session: AsyncSession, mcp_tools: List[Dict[str, Any]]
    ) -> tuple[int, int]:
        new_count = 0
        updated_count = 0
        mcp_tool_map = {tool["name"]: tool for tool in mcp_tools}

        await self._migrate_legacy_tools(session, mcp_tool_map)

        for tool_meta in mcp_tools:
            tool_name = tool_meta["name"]
            result = await session.execute(select(Tool).where(Tool.name == tool_name))
            existing_tool = result.scalar_one_or_none()

            if existing_tool:
                existing_tool.description = tool_meta.get("description", "")
                existing_tool.input_schema = tool_meta.get("input_schema")
                existing_tool.output_schema = tool_meta.get("output_schema")
                if tool_name in SYSTEM_MANAGED_TOOLS:
                    existing_tool.enabled = True
                updated_count += 1
                self.logger.info("Updated tool: %s", tool_name)
                continue

            new_tool = Tool(
                name=tool_name,
                description=tool_meta.get("description", ""),
                tool_type=ToolType.CODE_BASED,
                input_schema=tool_meta.get("input_schema"),
                output_schema=tool_meta.get("output_schema"),
                enabled=tool_name in SYSTEM_MANAGED_TOOLS
                or tool_name in ADMIN_CONFIGURABLE_TOOLS,
            )
            session.add(new_tool)
            new_count += 1
            self.logger.info("Discovered new tool: %s", tool_name)

        await session.commit()
        return new_count, updated_count

    async def _migrate_legacy_tools(
        self,
        session: AsyncSession,
        mcp_tool_map: Dict[str, Dict[str, Any]],
    ) -> None:
        """Rename legacy tool rows in DB to canonical FastMCP tool names."""
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
            merged_enabled = legacy_tool.enabled or (
                canonical_tool.enabled if canonical_tool else False
            )
            if canonical_name in SYSTEM_MANAGED_TOOLS:
                merged_enabled = True

            if canonical_tool:
                canonical_tool.description = canonical_meta.get("description", "")
                canonical_tool.input_schema = canonical_meta.get("input_schema")
                canonical_tool.output_schema = canonical_meta.get("output_schema")
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
        """Return newly discovered tools that are still disabled."""
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

    async def enable_tool(self, tool_name: str) -> Dict[str, Any]:
        """Enable a tool after admin review."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Tool).where(Tool.name == tool_name))
            tool = result.scalar_one_or_none()

            if not tool:
                return {"success": False, "message": f"Tool '{tool_name}' not found"}

            tool.enabled = True
            await session.commit()

        self.logger.info("Enabled tool: %s", tool_name)
        return {
            "success": True,
            "message": f"Tool '{tool_name}' enabled successfully",
        }


tool_scanner = ToolScanner()


if __name__ == "__main__":
    import asyncio

    async def test_scanner():
        result = await tool_scanner.scan_and_sync_tools()
        print(f"Total: {result['total_tools']}")
        print(f"New: {result['new_tools']}")
        print(f"Updated: {result['updated_tools']}")

        new_tools = await tool_scanner.get_new_tools()
        print(f"New tools: {len(new_tools)}")
        for tool in new_tools:
            print(f"- {tool['name']}: {tool['description'][:50]}...")

    asyncio.run(test_scanner())
