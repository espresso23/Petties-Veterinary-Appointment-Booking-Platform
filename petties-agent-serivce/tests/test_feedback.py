"""Unit tests cho Feedback CRUD: update, delete, cascade xóa case Qdrant."""

from pathlib import Path
import sys
from datetime import datetime, timezone
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
import types

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Stub heavy dependencies
motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from fastapi import HTTPException
from app.api.middleware.auth import CurrentUser
from app.api.routes.chat import (
    update_feedback as update_feedback_endpoint,
    delete_feedback as delete_feedback_endpoint,
)
from app.api.schemas.feedback_schemas import UpdateFeedbackRequest, FeedbackType

# Module path cho lazy import bên trong endpoint functions
FEEDBACK_SERVICE_MODULE = "app.core.services.feedback_service"


def _make_user(user_id="user-1", role="PET_OWNER", is_admin=False):
    return CurrentUser(user_id=user_id, role=role, is_admin=is_admin)


def _mock_feedback_service(return_value):
    """Tạo mock FeedbackService với return_value cho method tương ứng."""
    mock_service = MagicMock()
    mock_service.update_feedback = AsyncMock(return_value=return_value)
    mock_service.delete_feedback = AsyncMock(return_value=return_value)
    return mock_service


class TestUpdateFeedbackEndpoint(unittest.IsolatedAsyncioTestCase):
    """Tests cho PUT /chat/feedback/{feedback_id}."""

    async def test_update_feedback_changes_type(self):
        """Cập nhật feedback_type thành công."""
        mock_service = _mock_feedback_service({
            "status": "updated",
            "feedback_id": "fb-1",
        })

        with patch(
            f"{FEEDBACK_SERVICE_MODULE}.get_feedback_service",
            return_value=mock_service,
        ):
            result = await update_feedback_endpoint(
                feedback_id="fb-1",
                request=UpdateFeedbackRequest(feedback_type=FeedbackType.THUMBS_DOWN),
                user=_make_user(),
            )

        self.assertEqual(result.status, "updated")
        self.assertEqual(result.feedback_id, "fb-1")
        mock_service.update_feedback.assert_awaited_once()
        call_args = mock_service.update_feedback.call_args
        self.assertEqual(call_args.kwargs["update_data"]["feedback_type"], "thumbs_down")

    async def test_update_feedback_not_found(self):
        """Trả 404 nếu feedback không tồn tại."""
        mock_service = _mock_feedback_service({
            "status": "error",
            "error": "Không tìm thấy feedback",
        })

        with patch(
            f"{FEEDBACK_SERVICE_MODULE}.get_feedback_service",
            return_value=mock_service,
        ):
            with self.assertRaises(HTTPException) as exc_info:
                await update_feedback_endpoint(
                    feedback_id="not-exist",
                    request=UpdateFeedbackRequest(
                        feedback_type=FeedbackType.THUMBS_DOWN
                    ),
                    user=_make_user(),
                )

        self.assertEqual(exc_info.exception.status_code, 404)

    async def test_update_feedback_wrong_user_rejected(self):
        """User khác không được sửa feedback của người khác."""
        mock_service = _mock_feedback_service({
            "status": "error",
            "error": "Bạn không có quyền sửa feedback này",
        })

        with patch(
            f"{FEEDBACK_SERVICE_MODULE}.get_feedback_service",
            return_value=mock_service,
        ):
            with self.assertRaises(HTTPException) as exc_info:
                await update_feedback_endpoint(
                    feedback_id="fb-1",
                    request=UpdateFeedbackRequest(
                        feedback_type=FeedbackType.THUMBS_DOWN
                    ),
                    user=_make_user(user_id="user-2"),
                )

        self.assertEqual(exc_info.exception.status_code, 403)

    async def test_update_feedback_empty_body_rejected(self):
        """Request body rỗng trả 400."""
        with self.assertRaises(HTTPException) as exc_info:
            await update_feedback_endpoint(
                feedback_id="fb-1",
                request=UpdateFeedbackRequest(),
                user=_make_user(),
            )

        self.assertEqual(exc_info.exception.status_code, 400)


class TestDeleteFeedbackEndpoint(unittest.IsolatedAsyncioTestCase):
    """Tests cho DELETE /chat/feedback/{feedback_id}."""

    async def test_delete_feedback_with_case(self):
        """Delete feedback is forbidden because records are append-only."""
        with self.assertRaises(HTTPException) as exc_info:
            await delete_feedback_endpoint(
                feedback_id="fb-1",
                user=_make_user(),
            )

        self.assertEqual(exc_info.exception.status_code, 403)

    async def test_delete_feedback_without_case(self):
        """Delete remains forbidden even when no linked case exists."""
        with self.assertRaises(HTTPException) as exc_info:
            await delete_feedback_endpoint(
                feedback_id="fb-2",
                user=_make_user(),
            )

        self.assertEqual(exc_info.exception.status_code, 403)

    async def test_delete_feedback_not_found(self):
        """Admin cũng không được xóa feedback."""
        with self.assertRaises(HTTPException) as exc_info:
            await delete_feedback_endpoint(
                feedback_id="not-exist",
                user=_make_user(user_id="admin-1", role="ADMIN", is_admin=True),
            )

        self.assertEqual(exc_info.exception.status_code, 403)


class TestCaseMemoryDeleteCase(unittest.IsolatedAsyncioTestCase):
    """Tests cho CaseMemoryService.delete_case."""

    async def test_delete_case_calls_qdrant(self):
        """Xóa case từ Qdrant khi tìm thấy point."""
        from app.core.rag.case_memory import CaseMemoryService

        service = CaseMemoryService.__new__(CaseMemoryService)
        service._initialized = True
        service._collection_name = "petties_case_memory"
        service.initialize = AsyncMock(return_value=None)

        # Mock point result
        mock_point = MagicMock()
        mock_point.id = "point-uuid-1"

        mock_qdrant = MagicMock()
        mock_qdrant.retrieve.return_value = [mock_point]
        mock_qdrant.delete.return_value = True
        service._qdrant_client = mock_qdrant

        result = await service.delete_case("case-uuid-1")

        self.assertTrue(result)
        mock_qdrant.retrieve.assert_called_once()
        mock_qdrant.delete.assert_called_once()

    async def test_delete_case_not_found(self):
        """Trả False nếu case không tồn tại trong Qdrant."""
        from app.core.rag.case_memory import CaseMemoryService

        service = CaseMemoryService.__new__(CaseMemoryService)
        service._initialized = True
        service._collection_name = "petties_case_memory"
        service.initialize = AsyncMock(return_value=None)

        mock_qdrant = MagicMock()
        mock_qdrant.retrieve.return_value = []
        service._qdrant_client = mock_qdrant

        result = await service.delete_case("non-existent-case")

        self.assertFalse(result)
        mock_qdrant.delete.assert_not_called()

    async def test_delete_case_no_client(self):
        """Trả False nếu Qdrant client chưa khởi tạo."""
        from app.core.rag.case_memory import CaseMemoryService

        service = CaseMemoryService.__new__(CaseMemoryService)
        service.initialize = AsyncMock(return_value=None)
        service._qdrant_client = None

        result = await service.delete_case("case-uuid-1")

        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
