"""Unit tests cho image embedding pipeline (Jina + CaseMemory + WebSocket metadata)."""

from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
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

from app.api.middleware.auth import CurrentUser
from app.api.websocket.chat import handle_chat_message
from app.core.chat_context import BUSINESS_CHAT
from app.core.rag.case_memory import CaseMemoryService
from app.core.embeddings.jina_image_embeddings import (
    embed_image_urls,
    EXPECTED_IMAGE_DIMENSION,
)


class TestJinaImageEmbeddings(unittest.IsolatedAsyncioTestCase):
    async def test_embed_image_urls_filters_non_https_only(self):
        class _FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                # Jina CLIP v2 trả về 1024 dim; test cần dim đúng để pass validation
                emb = [0.1] * EXPECTED_IMAGE_DIMENSION
                return {"data": [{"embedding": emb}]}

        class _FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def post(self, *args, **kwargs):
                return _FakeResponse()

        with patch(
            "app.core.embeddings.jina_image_embeddings._get_jina_config",
            AsyncMock(
                return_value={
                    "api_key": "k",
                    "model": "jina-clip-v2",
                }
            ),
        ), patch(
            "app.core.embeddings.jina_image_embeddings.httpx.AsyncClient",
            return_value=_FakeClient(),
        ):
            vectors = await embed_image_urls(
                [
                    "http://example.com/a.png",  # non-https -> filtered
                    "https://example.com/b.png",  # keep
                    "https://res.cloudinary.com/demo/image/upload/x.png",  # keep
                ]
            )

        # Chỉ filter non-https, không filter theo domain
        self.assertEqual(len(vectors), 2)

    async def test_embed_image_urls_rejects_wrong_dimension(self):
        """Khi Jina trả về dim khác 1024 (model config sai) -> skip embedding."""
        class _FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                # Sai dim (3 thay vì 1024) -> _validate_embedding trả về None
                return {"data": [{"embedding": [0.1, 0.2, 0.3]}]}

        class _FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def post(self, *args, **kwargs):
                return _FakeResponse()

        with patch(
            "app.core.embeddings.jina_image_embeddings._get_jina_config",
            AsyncMock(
                return_value={
                    "api_key": "k",
                    "model": "jina-clip-v2",
                }
            ),
        ), patch(
            "app.core.embeddings.jina_image_embeddings.httpx.AsyncClient",
            return_value=_FakeClient(),
        ):
            vectors = await embed_image_urls(["https://res.cloudinary.com/demo/x.png"])

        self.assertEqual(len(vectors), 0)


class TestCaseMemoryHybridSearch(unittest.IsolatedAsyncioTestCase):
    async def test_search_similar_merges_text_and_image_hits(self):
        service = CaseMemoryService.__new__(CaseMemoryService)
        service._initialized = True
        service._qdrant_client = MagicMock()
        service._embed_model = object()
        service._collection_name = "petties_case_memory_v2"
        service._image_enabled = True

        # initialize() should early-return because _initialized and _qdrant_client exist
        service.initialize = AsyncMock(return_value=None)
        service._embed_text = AsyncMock(return_value=[0.1, 0.2, 0.3])

        # Fake qdrant responses
        text_hit = types.SimpleNamespace(
            id="p1",
            score=0.8,
            payload={"case_id": "c1", "text_content": "case text", "feedback_count": 2},
        )
        image_hit = types.SimpleNamespace(
            id="p1",
            score=0.9,
            payload={"case_id": "c1", "text_content": "case text", "feedback_count": 2},
        )
        text_resp = types.SimpleNamespace(points=[text_hit])
        image_resp = types.SimpleNamespace(points=[image_hit])
        service._qdrant_client.query_points.side_effect = [text_resp, image_resp]

        with patch(
            "app.core.embeddings.jina_image_embeddings.embed_image_urls",
            AsyncMock(return_value=[[0.9, 0.9, 0.9]]),
        ):
            results = await service.search_similar(
                "test query",
                top_k=3,
                min_score=0.1,
                image_urls=["https://res.cloudinary.com/demo/image/upload/x.png"],
            )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].case_id, "c1")
        self.assertGreater(results[0].final_score, 0)


class TestWebSocketStoresImageMetadata(unittest.IsolatedAsyncioTestCase):
    async def test_handle_chat_message_saves_images_in_user_message_metadata(self):
        user = CurrentUser(user_id="u1", username="test", role="PET_OWNER", is_admin=False)

        class _FakeAgent:
            name = "agent"
            agent_type = "single"
            enabled_tools = []

            async def stream(self, *args, **kwargs):
                yield {"type": "final_answer", "content": "ok"}

        class _FakeDbCtx:
            async def __aenter__(self):
                return object()

            async def __aexit__(self, exc_type, exc, tb):
                return False

        save_chat_message_mock = AsyncMock()

        with patch("app.api.websocket.chat.AsyncSessionLocal", return_value=_FakeDbCtx()), patch(
            "app.api.websocket.chat.AgentFactory.get_agent",
            AsyncMock(return_value=_FakeAgent()),
        ), patch(
            "app.api.websocket.chat.save_chat_message",
            save_chat_message_mock,
        ), patch(
            "app.api.websocket.chat.touch_chat_session",
            AsyncMock(return_value=True),
        ), patch(
            "app.api.websocket.chat.set_tool_runtime_context",
            return_value="token",
        ), patch(
            "app.api.websocket.chat.reset_tool_runtime_context",
            return_value=None,
        ), patch(
            "app.api.websocket.chat.manager.send_message",
            AsyncMock(return_value=None),
        ):
            await handle_chat_message(
                websocket=MagicMock(),
                session_id="s1",
                user=user,
                session_context=BUSINESS_CHAT,
                message='{"message":"xin chao","images":["https://res.cloudinary.com/demo/image/upload/x.png"]}',
                auth_token="t",
            )

        # First save_chat_message call is user message
        first_call_payload = save_chat_message_mock.await_args_list[0].args[0]
        self.assertIn("metadata", first_call_payload)
        self.assertEqual(
            first_call_payload["metadata"]["images"],
            ["https://res.cloudinary.com/demo/image/upload/x.png"],
        )


if __name__ == "__main__":
    unittest.main()

