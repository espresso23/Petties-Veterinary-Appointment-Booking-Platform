from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.tool_runtime_context import ToolRuntimeContext, reset_tool_runtime_context, set_tool_runtime_context
from app.core.tools.executor import ToolExecutor


class ToolExecutorTests(unittest.TestCase):
    def test_inject_contextual_user_id_for_booking_tools(self):
        executor = ToolExecutor()
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-ctx", role="PET_OWNER", auth_token="jwt-token")
        )

        try:
            params = executor._inject_contextual_parameters("create_booking_for_user", {"pet_id": "pet-1"})
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertEqual(params["user_id"], "user-ctx")
        self.assertEqual(params["pet_id"], "pet-1")


if __name__ == "__main__":
    unittest.main()