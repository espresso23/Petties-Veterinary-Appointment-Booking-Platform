"""
PETTIES AI SERVICE - Knowledge Graph Service

Đồ thị tri thức thú y: triệu chứng -> bệnh -> xử lý.
Dùng LlamaIndex KnowledgeGraphIndex + SimpleGraphStore để
extract triplets từ tài liệu và hỗ trợ suy luận chuỗi.

Package: app.core.rag
Purpose: Knowledge Graph construction & hybrid query for veterinary domain
Version: v1.0.0

Flow:
    1. Admin upload tài liệu -> build_from_documents() extract triplets qua LLM
    2. Triplets lưu vào SimpleGraphStore (in-memory, persist to disk)
    3. Query: query_graph() -> KG traversal + text retrieval
    4. HybridRAGEngine kết hợp KG results với RAG results

Ví dụ triplet:
    (Rận tai, triệu_chứng, Ngứa dữ dội)
    (Rận tai, triệu_chứng, Lắc đầu)
    (Rận tai, xử_lý, Thuốc nhỏ tai)
    (Rận tai, thường_gặp, Mèo)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from app.config.settings import settings


# ============================================================
# CONSTANTS
# ============================================================

MAX_TRIPLETS_PER_CHUNK = 10
"""Số triplets tối đa được extract từ mỗi text chunk."""

KG_PERSIST_DIR = "./data/knowledge_graph"
"""Thư mục lưu trữ graph store lên đĩa."""

DEFAULT_KG_TOP_K = 5
"""Số kết quả mặc định cho truy vấn KG."""


# ============================================================
# DATA CLASSES
# ============================================================


@dataclass
class KGQueryResult:
    """Kết quả truy vấn từ Knowledge Graph."""

    content: str
    score: float
    source_nodes: List[str] = field(default_factory=list)
    triplets_used: List[Tuple[str, str, str]] = field(default_factory=list)


# ============================================================
# KNOWLEDGE GRAPH SERVICE
# ============================================================


class KnowledgeGraphService:
    """
    Quản lý LlamaIndex KnowledgeGraphIndex với SimpleGraphStore.

    Phase 2: SimpleGraphStore (in-memory với disk persistence).
    Phase 3 tương lai: Chuyển sang Neo4j backend mà không thay đổi public API.

    Trách nhiệm:
        - Xây dựng KG từ tài liệu (extract triplets qua LLM)
        - Truy vấn KG bằng text queries (graph traversal + text retrieval)
        - Extract triplets thủ công (để kiểm tra / debug)
        - Lấy thống kê đồ thị
        - Lưu trữ / tải đồ thị từ đĩa

    Cách dùng:
        service = KnowledgeGraphService()
        await service.initialize()
        count = await service.build_from_documents(documents)
        results = await service.query_graph("mèo ho khan chảy nước mũi")
    """

    _instance: Optional["KnowledgeGraphService"] = None
    _initialized: bool = False

    def __new__(cls) -> "KnowledgeGraphService":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._kg_index = None
        self._graph_store = None
        self._llm = None
        self._persist_dir = KG_PERSIST_DIR

    # ----------------------------------------------------------
    # Initialization
    # ----------------------------------------------------------

    async def initialize(self) -> None:
        """
        Khởi tạo các thành phần LlamaIndex cho KG.

        Thiết lập:
            - LLM (dùng cho triplet extraction khi indexing)
            - Cohere embedding model
            - SimpleGraphStore (tải từ đĩa nếu có)
        """
        if self._initialized and self._graph_store is not None:
            return

        logger.info("Initializing KnowledgeGraphService...")

        # Lazy imports to avoid circular dependencies
        import asyncio
        from llama_index.core.graph_stores import SimpleGraphStore
        from llama_index.embeddings.cohere import CohereEmbedding
        from llama_index.core import Settings as LlamaSettings

        from app.core.config_helper import get_setting
        from app.db.postgres.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            cohere_api_key = await get_setting("COHERE_API_KEY", db)
            cohere_model = (
                await get_setting("COHERE_EMBEDDING_MODEL", db)
                or "embed-multilingual-v3.0"
            )

        if not cohere_api_key:
            logger.warning(
                "COHERE_API_KEY not configured. KnowledgeGraphService will be unavailable."
            )
            return

        # Configure embedding model (used for hybrid mode)
        LlamaSettings.embed_model = CohereEmbedding(
            api_key=cohere_api_key,
            model_name=cohere_model,
            input_type="search_document",
        )

        # Load or create graph store
        persist_path = Path(self._persist_dir)
        graph_store_file = persist_path / "graph_store.json"

        if graph_store_file.exists():
            logger.info(f"Loading existing graph store from {graph_store_file}")
            self._graph_store = SimpleGraphStore.from_persist_path(
                str(graph_store_file)
            )
        else:
            logger.info("Creating new SimpleGraphStore")
            self._graph_store = SimpleGraphStore()

        self._initialized = True
        logger.info("KnowledgeGraphService initialized successfully")

    # ----------------------------------------------------------
    # Public API
    # ----------------------------------------------------------

    async def build_from_documents(
        self,
        documents: List[Any],
        max_triplets_per_chunk: int = MAX_TRIPLETS_PER_CHUNK,
    ) -> int:
        """
        Xây dựng/mở rộng Knowledge Graph từ danh sách LlamaIndex Documents.

        LLM tự động extract triplets (subject, predicate, object) từ mỗi chunk.
        Triplets được lưu vào SimpleGraphStore và persist lên đĩa.

        Args:
            documents: Danh sách ``llama_index.core.Document``.
            max_triplets_per_chunk: Số triplets tối đa mỗi text chunk.

        Returns:
            Số lượng triplets đã extract.
        """
        await self.initialize()

        if self._graph_store is None:
            logger.warning("KnowledgeGraphService not available, skipping build")
            return 0

        import asyncio
        from llama_index.core import (
            KnowledgeGraphIndex,
            StorageContext,
            Settings as LlamaSettings,
        )

        logger.info(
            f"Building KG from {len(documents)} documents "
            f"(max_triplets={max_triplets_per_chunk})"
        )

        try:
            storage_context = StorageContext.from_defaults(
                graph_store=self._graph_store
            )

            # Build KG index (LLM extracts triplets automatically)
            self._kg_index = await asyncio.to_thread(
                KnowledgeGraphIndex.from_documents,
                documents,
                max_triplets_per_chunk=max_triplets_per_chunk,
                include_embeddings=True,
                storage_context=storage_context,
            )

            # Count triplets
            triplet_count = self._count_triplets()

            # Persist to disk
            self._persist()

            logger.info(f"KG built successfully: {triplet_count} triplets extracted")
            return triplet_count

        except Exception as e:
            logger.error(f"Failed to build KG: {e}")
            import traceback

            logger.error(traceback.format_exc())
            return 0

    async def query_graph(
        self,
        query: str,
        top_k: int = DEFAULT_KG_TOP_K,
    ) -> List[KGQueryResult]:
        """
        Truy vấn Knowledge Graph.

        Sử dụng KG traversal kết hợp text retrieval (hybrid mode).

        Args:
            query: Câu truy vấn ngôn ngữ tự nhiên.
            top_k: Số lượng kết quả.

        Returns:
            Danh sách KGQueryResult với nội dung và graph metadata.
        """
        await self.initialize()

        if self._kg_index is None:
            # Try to load existing index from graph store
            if self._graph_store is not None:
                loaded = await self._load_index_from_store()
                if not loaded:
                    logger.info("No KG index available for querying")
                    return []
            else:
                return []

        import asyncio

        try:
            query_engine = self._kg_index.as_query_engine(
                include_text=True,
                response_mode="tree_summarize",
            )

            response = await asyncio.to_thread(query_engine.query, query)

            # Convert to KGQueryResult
            results = []
            if response and str(response).strip():
                # Extract source nodes info
                source_texts = []
                if hasattr(response, "source_nodes"):
                    for node in response.source_nodes[:top_k]:
                        source_texts.append(
                            node.text[:200]
                            if hasattr(node, "text")
                            else str(node)[:200]
                        )

                results.append(
                    KGQueryResult(
                        content=str(response),
                        score=1.0,  # KG queries don't have cosine scores
                        source_nodes=source_texts,
                    )
                )

            logger.info(f"KG query '{query[:50]}...' returned {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"KG query failed: {e}")
            return []

    async def extract_triplets_from_text(self, text: str) -> List[Tuple[str, str, str]]:
        """
        Extract triplets từ một đoạn text bằng LLM.

        Hữu ích cho debugging hoặc kiểm tra thủ công kết quả extraction.

        Args:
            text: Văn bản gốc cần extract triplets.

        Returns:
            Danh sách tuple (subject, predicate, object).
        """
        await self.initialize()

        import asyncio
        from llama_index.core import Document, KnowledgeGraphIndex, StorageContext
        from llama_index.core.graph_stores import SimpleGraphStore

        try:
            # Create temporary graph store for extraction
            temp_store = SimpleGraphStore()
            temp_context = StorageContext.from_defaults(graph_store=temp_store)

            doc = Document(text=text)
            temp_index = await asyncio.to_thread(
                KnowledgeGraphIndex.from_documents,
                [doc],
                max_triplets_per_chunk=MAX_TRIPLETS_PER_CHUNK,
                include_embeddings=False,
                storage_context=temp_context,
            )

            # Extract triplets from the graph store
            triplets = self._get_triplets_from_store(temp_store)

            logger.info(
                f"Extracted {len(triplets)} triplets from text ({len(text)} chars)"
            )
            return triplets

        except Exception as e:
            logger.error(f"Triplet extraction failed: {e}")
            return []

    async def get_graph_stats(self) -> Dict[str, Any]:
        """
        Lấy thống kê Knowledge Graph.

        Returns:
            Dict chứa triplet_count, node_count, edge_types, v.v.
        """
        await self.initialize()

        if self._graph_store is None:
            return {
                "initialized": False,
                "error": "KnowledgeGraphService not available",
            }

        triplet_count = self._count_triplets()
        triplets = self._get_triplets_from_store(self._graph_store)

        # Count unique entities and relation types
        subjects = set()
        objects = set()
        predicates = set()
        for subj, pred, obj in triplets:
            subjects.add(subj)
            objects.add(obj)
            predicates.add(pred)

        all_entities = subjects | objects

        return {
            "initialized": self._initialized,
            "has_index": self._kg_index is not None,
            "triplet_count": triplet_count,
            "entity_count": len(all_entities),
            "relation_types": sorted(list(predicates)),
            "relation_type_count": len(predicates),
            "persist_dir": self._persist_dir,
        }

    # ----------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------

    def _count_triplets(self) -> int:
        """Đếm tổng số triplets trong graph store."""
        if self._graph_store is None:
            return 0
        triplets = self._get_triplets_from_store(self._graph_store)
        return len(triplets)

    def _get_triplets_from_store(self, store: Any) -> List[Tuple[str, str, str]]:
        """Trích xuất tất cả triplets từ SimpleGraphStore."""
        triplets = []
        try:
            # SimpleGraphStore stores data in _data.graph_dict
            # Format: { subject: { (relation, object), ... } }
            graph_dict = {}
            if hasattr(store, "_data") and hasattr(store._data, "graph_dict"):
                graph_dict = store._data.graph_dict
            elif hasattr(store, "graph_dict"):
                graph_dict = store.graph_dict

            for subject, edges in graph_dict.items():
                if isinstance(edges, (list, set)):
                    for edge in edges:
                        if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                            triplets.append((subject, edge[0], edge[1]))
                elif isinstance(edges, dict):
                    for relation, objects in edges.items():
                        if isinstance(objects, (list, set)):
                            for obj in objects:
                                triplets.append((subject, relation, obj))
                        else:
                            triplets.append((subject, relation, str(objects)))
        except Exception as e:
            logger.warning(f"Failed to extract triplets from store: {e}")
        return triplets

    async def _load_index_from_store(self) -> bool:
        """Thử tải KG index từ graph store hiện có."""
        if self._graph_store is None:
            return False

        # Check if graph has data
        if self._count_triplets() == 0:
            return False

        import asyncio
        from llama_index.core import KnowledgeGraphIndex, StorageContext

        try:
            storage_context = StorageContext.from_defaults(
                graph_store=self._graph_store
            )
            # Create an empty index backed by the existing graph store
            self._kg_index = await asyncio.to_thread(
                KnowledgeGraphIndex.from_documents,
                [],
                storage_context=storage_context,
                include_embeddings=True,
            )
            logger.info("Loaded KG index from existing graph store")
            return True
        except Exception as e:
            logger.warning(f"Failed to load KG index: {e}")
            return False

    def _persist(self) -> None:
        """Lưu trữ graph store lên đĩa."""
        if self._graph_store is None:
            return

        try:
            persist_path = Path(self._persist_dir)
            persist_path.mkdir(parents=True, exist_ok=True)

            graph_store_file = str(persist_path / "graph_store.json")
            self._graph_store.persist(persist_path=graph_store_file)
            logger.info(f"Graph store persisted to {graph_store_file}")
        except Exception as e:
            logger.warning(f"Failed to persist graph store: {e}")


# ============================================================
# SINGLETON - Quản lý instance duy nhất
# ============================================================

_kg_service: Optional[KnowledgeGraphService] = None


def get_knowledge_graph_service() -> KnowledgeGraphService:
    """Lấy singleton KnowledgeGraphService instance."""
    global _kg_service
    if _kg_service is None:
        _kg_service = KnowledgeGraphService()
    return _kg_service


def reset_knowledge_graph_service() -> None:
    """Reset singleton (dùng cho testing)."""
    global _kg_service
    if _kg_service is not None:
        _kg_service._initialized = False
    _kg_service = None


__all__ = [
    "KnowledgeGraphService",
    "KGQueryResult",
    "get_knowledge_graph_service",
    "reset_knowledge_graph_service",
    "MAX_TRIPLETS_PER_CHUNK",
]
