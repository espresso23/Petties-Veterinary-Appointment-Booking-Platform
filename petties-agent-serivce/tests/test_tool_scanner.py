from pathlib import Path
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.tools.scanner import SYSTEM_MANAGED_TOOLS, ToolScanner  # noqa: E402


class _FakeTool:
    def __init__(self, name: str):
        self.name = name


class _FakeScalarResult:
    def __init__(self, tools):
        self._tools = tools

    def scalars(self):
        return self

    def all(self):
        return self._tools


class _FakeSession:
    def __init__(self, tools):
        self._tools = tools
        self.deleted_names = []

    async def execute(self, _statement):
        return _FakeScalarResult(self._tools)

    async def delete(self, tool):
        self.deleted_names.append(tool.name)

    async def flush(self):
        return None


def test_tc_unit_006_004_get_my_clinics_is_system_managed():
    assert "get_my_clinics" in SYSTEM_MANAGED_TOOLS


@pytest.mark.asyncio
async def test_tool_scanner_removes_non_mcp_tool_rows():
    scanner = ToolScanner()
    session = _FakeSession(
        [
            _FakeTool("pet_care_qa"),
            _FakeTool("search_clinics"),
            _FakeTool("pet_knowledge_search"),
            _FakeTool("create_booking_for_user"),
        ]
    )

    await scanner._remove_non_mcp_tools(
        session,
        mcp_tool_names={"pet_knowledge_search", "create_booking_for_user"},
    )

    assert session.deleted_names == ["pet_care_qa", "search_clinics"]
