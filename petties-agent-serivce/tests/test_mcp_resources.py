from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.tools.mcp_resources.resource_registry import (
    get_resource_by_backing_tool,
    resolve_resource_request,
)
from app.core.tool_runtime_context import ToolRuntimeContext


class MCPResourceRegistryTests(unittest.TestCase):
    def test_resolve_user_pets_resource(self):
        with patch(
            "app.core.tools.mcp_resources.resource_registry.get_tool_runtime_context",
            return_value=ToolRuntimeContext(
                user_id="user-1",
                role="PET_OWNER",
                auth_token="token",
                clinic_id=None,
                session_id="s1",
                context_type="BUSINESS_CHAT",
            ),
        ):
            result = resolve_resource_request("petties://users/user-1/pets")
            self.assertEqual(result["resource_name"], "user_pets")
            self.assertEqual(result["tool_name"], "get_user_pets")
            self.assertEqual(result["tool_params"]["user_id"], "user-1")

    def test_forbid_pet_owner_access_patient_summary(self):
        with patch(
            "app.core.tools.mcp_resources.resource_registry.get_tool_runtime_context",
            return_value=ToolRuntimeContext(
                user_id="user-1",
                role="PET_OWNER",
                auth_token="token",
                clinic_id="clinic-1",
                session_id="s1",
                context_type="BUSINESS_CHAT",
            ),
        ):
            with self.assertRaises(PermissionError):
                resolve_resource_request("petties://patients/pet-1/summary")

    def test_get_resource_by_backing_tool_maps_booking_tool_aliases(self):
        clinic_res = get_resource_by_backing_tool("list_clinic_services")
        self.assertIsNotNone(clinic_res)
        self.assertEqual(clinic_res.name, "clinic_services")
        via_booking = get_resource_by_backing_tool("get_clinic_services")
        self.assertIs(via_booking, clinic_res)

        slot_res = get_resource_by_backing_tool("get_slot_availability")
        self.assertIsNotNone(slot_res)
        self.assertEqual(slot_res.name, "slot_availability")
        via_slots = get_resource_by_backing_tool("check_available_slots")
        self.assertIs(via_slots, slot_res)

    def test_resolve_clinic_services_and_slots_allowed_for_pet_owner(self):
        ctx = ToolRuntimeContext(
            user_id="user-1",
            role="PET_OWNER",
            auth_token="token",
            clinic_id=None,
            session_id="s1",
            context_type="BUSINESS_CHAT",
        )
        with patch(
            "app.core.tools.mcp_resources.resource_registry.get_tool_runtime_context",
            return_value=ctx,
        ):
            svc = resolve_resource_request("petties://clinics/clinic-9/services")
            self.assertEqual(svc["resource_name"], "clinic_services")
            self.assertEqual(svc["tool_name"], "list_clinic_services")
            self.assertEqual(svc["tool_params"]["target_clinic_id"], "clinic-9")

            slots = resolve_resource_request(
                "petties://clinics/clinic-9/slots?date=2026-04-10"
            )
            self.assertEqual(slots["resource_name"], "slot_availability")
            self.assertEqual(slots["tool_name"], "get_slot_availability")
            self.assertEqual(slots["tool_params"]["clinic_id"], "clinic-9")
            self.assertEqual(slots["tool_params"]["date"], "2026-04-10")

    def test_resolve_forbidden_when_role_missing(self):
        ctx = ToolRuntimeContext(
            user_id="user-1",
            role="",
            auth_token="token",
            clinic_id=None,
            session_id="s1",
            context_type="BUSINESS_CHAT",
        )
        with patch(
            "app.core.tools.mcp_resources.resource_registry.get_tool_runtime_context",
            return_value=ctx,
        ):
            with self.assertRaisesRegex(
                PermissionError, "Thiếu vai trò người dùng"
            ):
                resolve_resource_request("petties://users/user-1/pets")


if __name__ == "__main__":
    unittest.main()
