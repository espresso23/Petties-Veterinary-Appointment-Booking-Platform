from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.chat_context import (
    BUSINESS_CHAT,
    PLAYGROUND_TEST,
    default_context_for_user,
    normalize_context_type,
)


class ChatContextTests(unittest.TestCase):
    def test_normalize_context_type_defaults_to_business_chat(self):
        self.assertEqual(normalize_context_type(None), BUSINESS_CHAT)


    def test_default_context_for_admin_is_playground(self):
        self.assertEqual(default_context_for_user(True), PLAYGROUND_TEST)


    def test_default_context_for_non_admin_is_business_chat(self):
        self.assertEqual(default_context_for_user(False), BUSINESS_CHAT)


    def test_normalize_context_type_rejects_invalid_value(self):
        with self.assertRaises(ValueError):
            normalize_context_type("invalid-context")


if __name__ == "__main__":
    unittest.main()
