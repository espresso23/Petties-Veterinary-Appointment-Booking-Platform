from pathlib import Path
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.rag import rag_engine


class _FakeSession:
    def __init__(self) -> None:
        self.closed = False


class _FakeSessionContext:
    def __init__(self) -> None:
        self.session = _FakeSession()

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        self.session.closed = True
        return False


class _FakeQdrantClient:
    def __init__(self, *args, **kwargs) -> None:
        self.args = args
        self.kwargs = kwargs

    def get_collection(self, name: str):
        return types.SimpleNamespace(points_count=0)


class _FakeQdrantVectorStore:
    def __init__(self, *args, **kwargs) -> None:
        self.args = args
        self.kwargs = kwargs


class _FakeOpenRouter:
    def __init__(self, *args, **kwargs) -> None:
        self.args = args
        self.kwargs = kwargs


class TestLlamaIndexRAGEngine(unittest.IsolatedAsyncioTestCase):
    async def test_initialize_reads_all_settings_before_db_context_closes(self):
        rag_engine.LlamaIndexRAGEngine._initialized = False
        engine = rag_engine.LlamaIndexRAGEngine()
        fake_db_ctx = _FakeSessionContext()
        fake_settings = types.SimpleNamespace()
        fake_index = MagicMock()
        requested_keys: list[str] = []
        fake_qdrant_module = types.ModuleType("qdrant_client")
        fake_qdrant_module.QdrantClient = _FakeQdrantClient
        fake_vector_store_parent = types.ModuleType("llama_index.vector_stores")
        fake_vector_store_module = types.ModuleType("llama_index.vector_stores.qdrant")
        fake_vector_store_module.QdrantVectorStore = _FakeQdrantVectorStore
        fake_llms_parent = types.ModuleType("llama_index.llms")
        fake_openrouter_module = types.ModuleType("llama_index.llms.openrouter")
        fake_openrouter_module.OpenRouter = _FakeOpenRouter

        async def fake_get_setting(key: str, db):
            self.assertFalse(
                getattr(db, "closed", False),
                f"get_setting called after session closed for {key}",
            )
            requested_keys.append(key)
            values = {
                "COHERE_API_KEY": "cohere-key",
                "COHERE_EMBEDDING_MODEL": "embed-multilingual-v3.0",
                "QDRANT_URL": "https://qdrant.example",
                "QDRANT_API_KEY": "qdrant-key",
                "QDRANT_COLLECTION_NAME": "petties_knowledge_base",
                "OPENROUTER_API_KEY": "openrouter-key",
                "RAG_LLM_MODEL": "google/gemini-2.5-flash-lite",
            }
            return values.get(key)

        with (
            patch(
                "app.core.rag.rag_engine.AsyncSessionLocal", return_value=fake_db_ctx
            ),
            patch("app.core.rag.rag_engine.get_setting", side_effect=fake_get_setting),
            patch("app.core.rag.rag_engine.CohereEmbedding", return_value=object()),
            patch("app.core.rag.rag_engine.Settings", fake_settings),
            patch("app.core.rag.rag_engine.SentenceSplitter", return_value=object()),
            patch(
                "app.core.rag.rag_engine.StorageContext.from_defaults",
                return_value=object(),
            ),
            patch(
                "app.core.rag.rag_engine.VectorStoreIndex.from_documents",
                return_value=fake_index,
            ),
            patch(
                "app.core.rag.rag_engine.VectorStoreIndex.from_vector_store",
                return_value=fake_index,
            ),
            patch.dict(
                sys.modules,
                {
                    "qdrant_client": fake_qdrant_module,
                    "llama_index.vector_stores": fake_vector_store_parent,
                    "llama_index.vector_stores.qdrant": fake_vector_store_module,
                    "llama_index.llms": fake_llms_parent,
                    "llama_index.llms.openrouter": fake_openrouter_module,
                },
            ),
        ):
            await engine.initialize()

        self.assertTrue(fake_db_ctx.session.closed)
        self.assertIs(engine.index, fake_index)
        self.assertIn("RAG_LLM_MODEL", requested_keys)


if __name__ == "__main__":
    unittest.main()
