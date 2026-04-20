import sys
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone
import uuid
import types

# Setup path to import app
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Mock motor/mongodb to avoid connection issues during import
motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from fastapi import HTTPException
from app.api.middleware.auth import CurrentUser
from app.api.routes import chat as chat_routes
from app.core.chat_context import BUSINESS_CHAT, PLAYGROUND_TEST
from app.api.schemas.feedback_schemas import (
    FeedbackRequest, 
    FeedbackType, 
    FeedbackCategory, 
    FeedbackReason
)

class ChatFeedbackUnitTests(unittest.IsolatedAsyncioTestCase):
    
    def setUp(self):
        self.user = CurrentUser(user_id="user-123", role="PET_OWNER", is_admin=False)
        self.admin = CurrentUser(user_id="admin-001", role="ADMIN", is_admin=True)
        self.session_id = str(uuid.uuid4())
        self.mock_session = {
            "session_id": self.session_id,
            "user_id": "user-123",
            "context_type": BUSINESS_CHAT,
            "deleted": False
        }

    # --- USE CASE 1: Interact with ChatBot ---
    
    @patch("app.api.routes.chat.get_chat_session")
    @patch("app.api.routes.chat.save_chat_message")
    @patch("app.api.routes.chat.touch_chat_session")
    async def test_utc_id_01_send_message_success(self, mock_touch, mock_save, mock_get_session):
        """UTCID01 - Happy Path: Gửi tin nhắn thành công"""
        mock_get_session.return_value = self.mock_session
        
        request = chat_routes.SendMessageRequest(message="Hello AI")
        response = await chat_routes.send_message(self.session_id, request, self.user)
        
        self.assertTrue(response.success)
        self.assertEqual(response.user_message, "Hello AI")
        mock_save.assert_called_once()
        mock_touch.assert_called_once()

    @patch("app.api.routes.chat.get_chat_session")
    async def test_utc_id_02_send_message_session_not_found(self, mock_get_session):
        """UTCID02 - Abnormal: Session không tồn tại"""
        mock_get_session.return_value = None
        
        request = chat_routes.SendMessageRequest(message="Hello")
        with self.assertRaises(HTTPException) as exc:
            await chat_routes.send_message(self.session_id, request, self.user)
        self.assertEqual(exc.exception.status_code, 404)

    @patch("app.api.routes.chat.get_chat_session")
    async def test_utc_id_03_send_message_invalid_payload(self, mock_get_session):
        """UTCID03 - Abnormal: Payload trống (FastAPI/Pydantic validation simulation)"""
        # Pydantic validates min_length=1 in SendMessageRequest
        with self.assertRaises(ValueError):
            chat_routes.SendMessageRequest(message="")

    # --- USE CASE 13: Provide AI's Response Feedback ---

    @patch("app.core.services.feedback_service.get_feedback_service")
    async def test_utc_id_13_01_submit_feedback_success(self, mock_get_service):
        """UTCID13-01 - Happy Path: Gửi feedback thành công"""
        mock_service = AsyncMock()
        mock_service.save_feedback.return_value = {"status": "success", "feedback_id": "fb-001"}
        mock_get_service.return_value = mock_service
        
        request = FeedbackRequest(
            session_id=self.session_id,
            message_id="msg-999",
            feedback_type=FeedbackType.THUMBS_UP,
            feedback_category=FeedbackCategory.GENERAL
        )
        
        response = await chat_routes.submit_feedback(request, self.user)
        self.assertTrue(response.success)
        self.assertEqual(response.feedback_id, "fb-001")

    @patch("app.core.services.feedback_service.get_feedback_service")
    async def test_utc_id_13_02_submit_feedback_error(self, mock_get_service):
        """UTCID13-02 - Abnormal: Lỗi service khi lưu feedback"""
        mock_service = AsyncMock()
        mock_service.save_feedback.return_value = {"status": "error", "error": "DB Fail"}
        mock_get_service.return_value = mock_service
        
        request = FeedbackRequest(
            session_id=self.session_id,
            message_id="msg-999",
            feedback_type=FeedbackType.THUMBS_DOWN
        )
        
        with self.assertRaises(HTTPException) as exc:
            await chat_routes.submit_feedback(request, self.user)
        self.assertEqual(exc.exception.status_code, 500)

    # --- USE CASE 9 & 14 (Contextual Chat) ---
    # Các Use Case này về mặt API gọi chung POST /messages, 
    # Logic phân biệt nằm ở AI Agent (Prompt/Tools) - Ở mức Unit Test API, 
    # ta kiểm tra xem message có được lưu đúng với session context hay không.

    @patch("app.api.routes.chat.get_chat_session")
    @patch("app.api.routes.chat.save_chat_message")
    async def test_utc_id_09_clinic_setup_context(self, mock_save, mock_get_session):
        """UTCID09 - Kiểm tra lưu tin nhắn với context BUSINESS_CHAT (cho Clinic Setup)"""
        setup_session = self.mock_session.copy()
        setup_session["context_type"] = BUSINESS_CHAT
        mock_get_session.return_value = setup_session
        
        request = chat_routes.SendMessageRequest(message="How to setup clinic?")
        await chat_routes.send_message(self.session_id, request, self.user)
        
        # Verify message saved with BUSINESS_CHAT context
        args, _ = mock_save.call_args
        self.assertEqual(args[0]["context_type"], BUSINESS_CHAT)

if __name__ == "__main__":
    unittest.main()
