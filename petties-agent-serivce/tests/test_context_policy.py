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
            available_tools=["pet_care_qa", "symptom_search", "get_patient_summary"],
        )

        self.assertEqual(allowed, ["pet_care_qa", "symptom_search"])

    def test_admin_playground_gets_all_available_tools(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="ADMIN",
            context_type=PLAYGROUND_TEST,
            available_tools=["pet_care_qa", "symptom_search", "get_patient_summary"],
        )

        self.assertEqual(
            allowed,
            ["pet_care_qa", "symptom_search", "get_patient_summary"],
        )

    def test_non_admin_playground_has_no_tools(self):
        allowed = ContextPolicyService.get_allowed_tools(
            user_role="PET_OWNER",
            context_type=PLAYGROUND_TEST,
            available_tools=["pet_care_qa", "symptom_search"],
        )

        self.assertEqual(allowed, [])

    def test_build_system_prompt_appends_guardrails(self):
        prompt = ContextPolicyService.build_system_prompt(
            base_prompt="Base prompt",
            user_role="PET_OWNER",
            context_type=BUSINESS_CHAT,
            allowed_tools=["pet_care_qa", "symptom_search"],
        )

        self.assertIn("Base prompt", prompt)
        self.assertIn("BUSINESS_CHAT", prompt)
        self.assertIn("pet_care_qa, symptom_search", prompt)


if __name__ == "__main__":
    unittest.main()