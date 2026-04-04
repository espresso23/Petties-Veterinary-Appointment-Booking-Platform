
import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

print(f"Python path: {sys.path}")

try:
    from app.core.tools.mcp_tools.clinic_tools import get_my_clinics
    print("Successfully imported get_my_clinics")
except Exception as e:
    print(f"Error importing get_my_clinics: {e}")
    import traceback
    traceback.print_exc()

import asyncio

async def test_tool():
    print("Testing tool call (mocking backend client)...")
    from unittest.mock import AsyncMock, patch
    from app.core.tool_runtime_context import set_tool_runtime_context, ToolRuntimeContext
    
    set_tool_runtime_context(ToolRuntimeContext(
        user_id="test",
        role="CLINIC_OWNER",
        auth_token="test",
        clinic_id="test"
    ))
    
    client = AsyncMock()
    client.get_my_clinics.return_value = {"content": []}
    
    with patch("app.core.tools.mcp_tools.clinic_tools.BackendClient", return_value=client):
        try:
            result = await get_my_clinics()
            print(f"Tool call result: {result}")
        except Exception as e:
            print(f"Error calling tool: {e}")

if __name__ == "__main__":
    asyncio.run(test_tool())
