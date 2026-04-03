from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.chat_context import BUSINESS_CHAT, PLAYGROUND_TEST
from app.core.context_policy import ContextPolicyService


class ContextPolicyTests(unittest.TestCase):
    def test_pet_owner_business_chat_filters_tools_by_role(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="PET_OWNER",
            context_type=BUSINESS_CHAT,
            available_tools=[
                "pet_knowledge_search",
                "web_search",
                "get_patient_summary",
            ],
        )

        self.assertEqual(allowed, ["pet_knowledge_search", "web_search"])

    def test_admin_playground_gets_only_playground_testable_tools(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="ADMIN",
            context_type=PLAYGROUND_TEST,
            available_tools=[
                "pet_knowledge_search",
                "get_patient_summary",
                "web_search",
            ],
        )

        self.assertEqual(
            allowed,
            ["pet_knowledge_search", "web_search"],
        )

    def test_non_admin_playground_has_no_tools(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="PET_OWNER",
            context_type=PLAYGROUND_TEST,
            available_tools=["pet_knowledge_search"],
        )

        self.assertEqual(allowed, [])

    def test_build_system_prompt_appends_guardrails(self):
        prompt = ContextPolicyService.build_system_prompt(
            base_prompt="Base prompt",
            user_role="PET_OWNER",
            context_type=BUSINESS_CHAT,
            allowed_tools=["pet_knowledge_search", "web_search"],
        )

        self.assertIn("Base prompt", prompt)
        self.assertIn("BUSINESS_CHAT", prompt)
        self.assertIn("pet_knowledge_search, web_search", prompt)
        self.assertIn("dễ hiểu", prompt)

    def test_build_system_prompt_appends_pet_owner_style(self):
        prompt = ContextPolicyService.build_system_prompt(
            base_prompt="Base prompt",
            user_role="PET_OWNER",
            context_type=BUSINESS_CHAT,
            allowed_tools=["pet_knowledge_search"],
        )

        self.assertIn("role PET_OWNER", prompt)
        self.assertIn("thân thiện, dễ hiểu", prompt)

    def test_build_system_prompt_appends_clinic_manager_style(self):
        prompt = ContextPolicyService.build_system_prompt(
            base_prompt="Base prompt",
            user_role="CLINIC_MANAGER",
            context_type=BUSINESS_CHAT,
            allowed_tools=["analyze_revenue_trends", "suggest_staff_assignments"],
        )

        self.assertIn("role CLINIC_MANAGER", prompt)
        self.assertIn("vận hành phòng khám", prompt)
        self.assertIn("checklist hành động", prompt)

    def test_pet_owner_business_chat_allows_check_vaccination_status(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="PET_OWNER",
            context_type=BUSINESS_CHAT,
            available_tools=[
                "get_clinic_services",
                "check_vaccination_status",
                "get_patient_summary",
            ],
        )

        self.assertEqual(allowed, ["get_clinic_services", "check_vaccination_status"])

    def test_pet_owner_business_chat_allows_booking_session_tools(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="PET_OWNER",
            context_type=BUSINESS_CHAT,
            available_tools=[
                "start_booking_session",
                "get_booking_session",
                "update_booking_draft",
                "end_booking_session",
                "get_patient_summary",
            ],
        )

        self.assertEqual(
            allowed,
            [
                "start_booking_session",
                "get_booking_session",
                "update_booking_draft",
                "end_booking_session",
            ],
        )

    def test_clinic_manager_no_phantom_tools(self):
        """Phantom tools not in MCP registry must NOT appear in CLINIC_MANAGER whitelist."""
        phantom_tools = [
            "suggest_staff_assignments",
            "create_staff_shifts",
            "get_patient_summary",
            "get_emr_history",
        ]
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="CLINIC_MANAGER",
            context_type=BUSINESS_CHAT,
            available_tools=phantom_tools,
        )
        self.assertEqual(
            allowed,
            [],
            msg=f"Phantom tools should be blocked for CLINIC_MANAGER but got: {allowed}",
        )

    def test_clinic_owner_allows_clinic_setup_tools_only(self):
        """CLINIC_OWNER should get implemented clinic setup tools only."""
        available_tools = [
            "generate_clinic_services",
            "list_clinic_services",
            "update_service_info",
            "execute_update_service_confirmed",
            "create_clinic_service",
            "get_my_clinic_info",
            "analyze_revenue_trends",
            "get_clinic_metrics",
            "suggest_staff_assignments",
        ]
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="CLINIC_OWNER",
            context_type=BUSINESS_CHAT,
            available_tools=available_tools,
        )
        self.assertEqual(
            allowed,
            [
                "generate_clinic_services",
                "list_clinic_services",
                "update_service_info",
                "execute_update_service_confirmed",
                "create_clinic_service",
                "get_my_clinic_info",
                "analyze_revenue_trends",
                "get_clinic_metrics",
            ],
            msg=f"CLINIC_OWNER allowed tools mismatch: {allowed}",
        )


if __name__ == "__main__":
    unittest.main()
