import sys
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock, AsyncMock, mock_open
from datetime import datetime
import types

# Setup path to import app
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Mock motor/mongodb
motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from fastapi import HTTPException, UploadFile
from app.api.routes import knowledge as knowledge_routes

class KnowledgeUnitTests(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.mock_db = AsyncMock()
        self.admin_user = {"user_id": "admin", "role": "ADMIN"}

    # --- USE CASE 5: Upload Document ---

    @patch("app.api.routes.knowledge.get_storage_dir")
    @patch("app.api.routes.knowledge.open", new_callable=mock_open)
    async def test_utc_id_05_01_upload_success(self, mock_file, mock_storage):
        """UTCID05-01 - Happy Path: Upload file PDF thành công"""
        mock_storage.return_value = Path("/tmp")
        
        # Mock UploadFile
        file_content = b"fake pdf content"
        mock_upload_file = AsyncMock(spec=UploadFile)
        mock_upload_file.filename = "test.pdf"
        mock_upload_file.read.return_value = file_content
        
        # Mock DB record
        mock_doc = MagicMock()
        mock_doc.id = 1
        
        with patch("app.api.routes.knowledge.KnowledgeDocument", return_value=mock_doc):
            response = await knowledge_routes.upload_document(
                file=mock_upload_file,
                notes="Test note",
                db=self.mock_db,
                _Subscription=True
            )
        
        self.assertTrue(response.success)
        self.assertEqual(response.document_id, 1)
        self.mock_db.add.assert_called_once()
        self.mock_db.commit.assert_called_once()

    async def test_utc_id_05_02_upload_invalid_extension(self):
        """UTCID05-02 - Abnormal: Định dạng file không hỗ trợ (.exe)"""
        mock_upload_file = AsyncMock(spec=UploadFile)
        mock_upload_file.filename = "virus.exe"
        
        with self.assertRaises(HTTPException) as exc:
            await knowledge_routes.upload_document(
                file=mock_upload_file,
                db=self.mock_db,
                _Subscription=True
            )
        self.assertEqual(exc.exception.status_code, 400)
        self.assertIn("not allowed", exc.exception.detail)

    @patch("app.api.routes.knowledge.MAX_FILE_SIZE", 100) # Mock small max size
    async def test_utc_id_05_03_upload_file_too_large(self):
        """UTCID05-03 - Boundary: File vượt quá dung lượng cho phép"""
        mock_upload_file = AsyncMock(spec=UploadFile)
        mock_upload_file.filename = "large.pdf"
        mock_upload_file.read.return_value = b"a" * 200 # 200 > 100
        
        with self.assertRaises(HTTPException) as exc:
            await knowledge_routes.upload_document(
                file=mock_upload_file,
                db=self.mock_db,
                _Subscription=True
            )
        self.assertEqual(exc.exception.status_code, 400)
        self.assertIn("File too large", exc.exception.detail)

    # --- USE CASE 7: View Case Memory ---

    @patch("app.api.routes.knowledge.qdrant_client")
    async def test_utc_id_07_01_get_case_memory_success(self, mock_qdrant):
        """UTCID07-01 - Happy Path: Lấy chi tiết ca bệnh thành công"""
        # Mock Qdrant response
        mock_point = MagicMock()
        mock_point.payload = {"case_id": "case-123", "diagnosis": "Flu"}
        mock_qdrant.retrieve.return_value = [mock_point]
        
        response = await knowledge_routes.get_case_detail("case-123")
        # Giả định function get_case_detail trả về JSON chứa payload
        self.assertEqual(response["case_id"], "case-123")

    @patch("app.api.routes.knowledge.qdrant_client")
    async def test_utc_id_07_02_get_case_memory_not_found(self, mock_qdrant):
        """UTCID07-02 - Abnormal: Case ID không tồn tại trong Vector DB"""
        mock_qdrant.retrieve.return_value = []
        
        with self.assertRaises(HTTPException) as exc:
            await knowledge_routes.get_case_detail("unknown-id")
        self.assertEqual(exc.exception.status_code, 404)

if __name__ == "__main__":
    unittest.main()
