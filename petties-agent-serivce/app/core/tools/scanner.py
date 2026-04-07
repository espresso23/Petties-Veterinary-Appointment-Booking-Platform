"""
PETTIES AGENT SERVICE - Tool Scanner Service
Synchronize FastMCP tools into PostgreSQL for the single-agent runtime.

Auto-sync behavior:
- Runs automatically on every service startup (main.py lifespan)
- Only updates tools that actually changed (compares description + schema)
- SYSTEM_MANAGED_TOOLS are always enabled
- ADMIN_CONFIGURABLE_TOOLS can be toggled by admin without being auto-disabled
- Any DB tool not present in current FastMCP registry is removed
"""

import hashlib
import json
from typing import Any, Dict, List
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tools.mcp_server import get_mcp_tools_metadata
from app.db.postgres.models import Tool, ToolType
from app.db.postgres.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


ADMIN_CONFIGURABLE_TOOLS = {
    "pet_knowledge_search",
    "web_search",
}

SYSTEM_MANAGED_TOOLS = {
    "get_user_pets",
    "search_clinics_nearby",
    "get_clinic_detail",
    "get_clinic_services",
    "check_vaccination_status",
    "check_available_slots",
    "create_booking_for_user",
    "get_my_booking_info",
    "list_my_bookings",
    "sync_booking_draft",
    "get_booking_session_info",
    "close_booking_session",
    "get_current_datetime",
    "resolve_booking_context",
    "get_staff_patients",
    "get_patient_summary",
    "get_emr_history",
    "get_pet_health_summary",
    # Phase 0: Clinic Setup AI
    "generate_clinic_services",
    "list_clinic_services",
    "update_service_info",
    "execute_update_service_confirmed",
    "create_clinic_service",
    "get_my_clinics",
    "analyze_revenue_trends",
    "get_clinic_metrics",
    # Clinic Staff & Shift Tools
    "get_clinic_staff",
    "get_clinic_shifts",
    "check_booking_availability",
    # Booking Management Tools
    "view_clinic_bookings",
    "get_clinic_today_summary",
    "get_staff_schedule",
    "get_slot_availability",
    "get_available_staff_for_reassign",
    "reassign_staff_for_service",
    "confirm_booking_manager",
    "cancel_booking_manager",
}


def _compute_tool_fingerprint(tool_meta: Dict[str, Any]) -> str:
    """Compute a hash of tool metadata to detect changes."""
    fingerprint_data = {
        "description": tool_meta.get("description", ""),
        "input_schema": tool_meta.get("input_schema"),
        "output_schema": tool_meta.get("output_schema"),
    }
    fingerprint_str = json.dumps(fingerprint_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(fingerprint_str.encode("utf-8")).hexdigest()[:16]


class ToolScanner:
    """Scan FastMCP tools and sync their metadata into PostgreSQL."""

    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.ToolScanner")

    async def scan_and_sync_tools(self) -> Dict[str, Any]:
        mcp_tools = await get_mcp_tools_metadata()
        total_tools = len(mcp_tools)

        self.logger.info("Found %s tools in FastMCP server", total_tools)

        async with AsyncSessionLocal() as session:
            new_count, updated_count, unchanged_count = await self._sync_tools_to_db(
                session, mcp_tools
            )

        return {
            "total_tools": total_tools,
            "new_tools": new_count,
            "updated_tools": updated_count,
            "unchanged_tools": unchanged_count,
            "tool_list": [tool["name"] for tool in mcp_tools],
        }

    async def _sync_tools_to_db(
        self, session: AsyncSession, mcp_tools: List[Dict[str, Any]]
    ) -> tuple[int, int, int]:
        new_count = 0
        updated_count = 0
        unchanged_count = 0
        mcp_tool_names = {tool["name"] for tool in mcp_tools}

        await self._remove_non_mcp_tools(session, mcp_tool_names)

        for tool_meta in mcp_tools:
            tool_name = tool_meta["name"]
            result = await session.execute(select(Tool).where(Tool.name == tool_name))
            existing_tool = result.scalar_one_or_none()

            if existing_tool:
                # Check if anything actually changed
                has_changes = (
                    existing_tool.description != tool_meta.get("description", "")
                    or existing_tool.input_schema != tool_meta.get("input_schema")
                    or existing_tool.output_schema != tool_meta.get("output_schema")
                )

                if has_changes:
                    existing_tool.description = tool_meta.get("description", "")
                    existing_tool.input_schema = tool_meta.get("input_schema")
                    existing_tool.output_schema = tool_meta.get("output_schema")
                    if tool_name in SYSTEM_MANAGED_TOOLS:
                        existing_tool.enabled = True
                    updated_count += 1
                    self.logger.info("Updated tool (changed): %s", tool_name)
                else:
                    # Still ensure SYSTEM_MANAGED_TOOLS are enabled
                    if tool_name in SYSTEM_MANAGED_TOOLS and not existing_tool.enabled:
                        existing_tool.enabled = True
                        updated_count += 1
                        self.logger.info("Updated tool (re-enabled): %s", tool_name)
                    else:
                        unchanged_count += 1
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

        # Invalidate tool executor cache so next execution uses updated tools
        from app.core.tools.executor import ToolExecutor

        ToolExecutor.invalidate_tool_cache()

        return new_count, updated_count, unchanged_count

    async def _remove_non_mcp_tools(
        self,
        session: AsyncSession,
        mcp_tool_names: set[str],
    ) -> None:
        """Delete tool rows that are not registered in current FastMCP metadata."""
        existing_result = await session.execute(select(Tool))
        stale_tools = [
            tool
            for tool in existing_result.scalars().all()
            if tool.name not in mcp_tool_names
        ]

        if not stale_tools:
            return

        for stale_tool in stale_tools:
            self.logger.info("Removing stale tool row: %s", stale_tool.name)
            await session.delete(stale_tool)

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
        print(f"Unchanged: {result['unchanged_tools']}")

        new_tools = await tool_scanner.get_new_tools()
        print(f"New tools: {len(new_tools)}")
        for tool in new_tools:
            print(f"- {tool['name']}: {tool['description'][:50]}...")

    asyncio.run(test_scanner())
