"""
PETTIES AI SERVICE - Hybrid RAG Engine

Kết hợp 3 nguồn tri thức:
    1. RAG (Qdrant petties_knowledge_base) - tài liệu thú y
    2. Knowledge Graph (SimpleGraphStore) - suy luận chuỗi
    3. Case Memory (Qdrant petties_case_memory) - case đã xác nhận

Trước khi search, query được mở rộng bởi QueryExpander (nếu ngắn).

Package: app.core.rag
Purpose: Unified query interface merging RAG + KG + Case Memory
Version: v1.0.0

Flow:
    User query
    -> QueryExpander (nếu ngắn)
    -> Song song: [RAG search, KG query, CaseMemory search]
    -> Gộp & sắp xếp lại
    -> Trả về HybridResult
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from loguru import logger


# ============================================================
# CONSTANTS
# ============================================================

DEFAULT_TOP_K = 5
DEFAULT_MIN_SCORE = 0.5

# Trọng số khi gộp kết quả từ các nguồn khác nhau
RAG_WEIGHT = 1.0
KG_WEIGHT = 0.8
CASE_MEMORY_WEIGHT = 1.2  # Case Memory với feedback boost được ưu tiên cao hơn


# ============================================================
# DATA CLASSES
# ============================================================


@dataclass
class HybridChunk:
    """Một kết quả đơn lẻ từ hybrid search."""

    content: str
    score: float
    source: str  # "rag", "kg", "case_memory"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HybridResult:
    """Kết quả tổng hợp từ hybrid RAG + KG + Case Memory search."""

    chunks: List[HybridChunk]
    expanded_query: str
    original_query: str
    sources_used: Dict[str, int]  # {"rag": 3, "kg": 1, "case_memory": 2}


# ============================================================
# HYBRID RAG ENGINE
# ============================================================


class HybridRAGEngine:
    """
    Giao diện truy vấn thống nhất kết hợp RAG, Knowledge Graph và Case Memory.

    Pipeline:
        1. QueryExpander: mở rộng query ngắn với từ đồng nghĩa + thuật ngữ y khoa
        2. Tìm kiếm song song qua 3 nguồn
        3. Gộp, chuẩn hóa điểm, và sắp xếp lại
        4. Trả về HybridResult thống nhất

    Mỗi nguồn có thể được tắt độc lập nếu chưa khởi tạo.

    Cách dùng:
        engine = HybridRAGEngine()
        result = await engine.query("mèo ho khan", pet_type="mèo")
    """

    _initialized: bool = False

    def __init__(self) -> None:
        """Initialize the hybrid engine."""
        if HybridRAGEngine._initialized:
            return
        # Initialization logic (if any)
        HybridRAGEngine._initialized = True

    # ----------------------------------------------------------
    # Public API
    # ----------------------------------------------------------

    async def query(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        min_score: float = DEFAULT_MIN_SCORE,
        image_urls: Optional[List[str]] = None,
        pet_type: Optional[str] = None,
        enable_rag: bool = True,
        enable_kg: bool = True,
        enable_case_memory: bool = True,
    ) -> HybridResult:
        """
        Thực hiện truy vấn hybrid qua tất cả các nguồn tri thức.

        Args:
            query: Câu truy vấn của người dùng.
            top_k: Số kết quả tối đa mỗi nguồn.
            min_score: Ngưỡng similarity tối thiểu (cho RAG & Case Memory).
            pet_type: Gợi ý loài vật (tùy chọn) cho query expansion.
            enable_rag: Có tìm kiếm RAG knowledge base không.
            enable_kg: Có truy vấn Knowledge Graph không.
            enable_case_memory: Có tìm kiếm Case Memory không.

        Returns:
            HybridResult với các chunks đã gộp & sắp xếp lại.
        """
        original_query = query.strip()

        # Step 1: Query Expansion
        expanded_query = await self._expand(original_query, pet_type)

        # Step 2: Parallel search across sources
        tasks = []
        source_labels = []

        if enable_rag:
            tasks.append(self._search_rag(expanded_query, top_k, min_score))
            source_labels.append("rag")

        if enable_kg:
            tasks.append(self._search_kg(expanded_query, top_k))
            source_labels.append("kg")

        if enable_case_memory:
            tasks.append(
                self._search_case_memory(
                    expanded_query, top_k, min_score, image_urls=image_urls
                )
            )
            source_labels.append("case_memory")

        if not tasks:
            return HybridResult(
                chunks=[],
                expanded_query=expanded_query,
                original_query=original_query,
                sources_used={},
            )

        # Execute in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Step 3: Merge
        all_chunks: List[HybridChunk] = []
        sources_used: Dict[str, int] = {}

        for label, result in zip(source_labels, results):
            if isinstance(result, Exception):
                logger.warning(f"Hybrid search source '{label}' failed: {result}")
                sources_used[label] = 0
                continue
            if isinstance(result, list):
                sources_used[label] = len(result)
                all_chunks.extend(result)
            else:
                sources_used[label] = 0

        # Step 4: Re-rank by weighted score
        all_chunks.sort(key=lambda c: c.score, reverse=True)

        # 5) Deduplicate chunks (order-preserving)
        seen_contents = {}
        unique_chunks = []
        for chunk in all_chunks:
            # Use content as key for basic deduplication
            content_key = chunk.content.strip()
            if content_key not in seen_contents:
                seen_contents[content_key] = True
                unique_chunks.append(chunk)

        # Trim to top_k
        unique_chunks = unique_chunks[:top_k]

        logger.info(
            f"Hybrid query '{original_query[:50]}...' "
            f"-> {len(unique_chunks)} results from {sources_used}"
        )

        return HybridResult(
            chunks=unique_chunks,
            expanded_query=expanded_query,
            original_query=original_query,
            sources_used=sources_used,
        )

    # ----------------------------------------------------------
    # Nội bộ: Mở rộng truy vấn
    # ----------------------------------------------------------

    async def _expand(self, query: str, pet_type: Optional[str]) -> str:
        """Mở rộng truy vấn ngắn bằng QueryExpander."""
        try:
            from app.core.rag.query_expander import get_query_expander

            expander = get_query_expander()
            return await expander.expand_query(query, pet_type=pet_type)
        except Exception as e:
            logger.warning(f"Query expansion failed, using original: {e}")
            return query

    # ----------------------------------------------------------
    # Nội bộ: Tìm kiếm RAG
    # ----------------------------------------------------------

    async def _search_rag(
        self, query: str, top_k: int, min_score: float
    ) -> List[HybridChunk]:
        """Tìm kiếm RAG knowledge base (Qdrant petties_knowledge_base)."""
        try:
            from app.core.rag.rag_engine import get_rag_engine

            rag = get_rag_engine()
            chunks = await rag.query(query, top_k=top_k, min_score=min_score)

            return [
                HybridChunk(
                    content=c.content,
                    score=c.score * RAG_WEIGHT,
                    source="rag",
                    metadata={
                        "document_id": c.document_id,
                        "document_name": c.document_name,
                        "chunk_index": c.chunk_index,
                    },
                )
                for c in chunks
            ]
        except Exception as e:
            logger.warning(f"RAG search failed: {e}")
            return []

    # ----------------------------------------------------------
    # Nội bộ: Truy vấn Knowledge Graph
    # ----------------------------------------------------------

    async def _search_kg(self, query: str, top_k: int) -> List[HybridChunk]:
        """Truy vấn Knowledge Graph để tìm quan hệ có cấu trúc."""
        try:
            from app.core.rag.knowledge_graph import get_knowledge_graph_service

            kg = get_knowledge_graph_service()
            results = await kg.query_graph(query, top_k=top_k)

            return [
                HybridChunk(
                    content=r.content,
                    score=r.score * KG_WEIGHT,
                    source="kg",
                    metadata={
                        "source_nodes": r.source_nodes,
                        "triplets_used": [list(t) for t in r.triplets_used]
                        if r.triplets_used
                        else [],
                    },
                )
                for r in results
            ]
        except Exception as e:
            logger.warning(f"KG query failed: {e}")
            return []

    # ----------------------------------------------------------
    # Nội bộ: Tìm kiếm Case Memory
    # ----------------------------------------------------------

    async def _search_case_memory(
        self,
        query: str,
        top_k: int,
        min_score: float,
        image_urls: Optional[List[str]] = None,
    ) -> List[HybridChunk]:
        """Tìm kiếm Case Memory cho các case đã xác nhận với feedback-weighted scoring."""
        try:
            from app.core.rag.case_memory import get_case_memory_service

            cm = get_case_memory_service()
            results = await cm.search_similar(
                query,
                top_k=top_k,
                min_score=min_score,
                image_urls=image_urls,
            )

            return [
                HybridChunk(
                    content=r.content,
                    score=r.final_score * CASE_MEMORY_WEIGHT,
                    source="case_memory",
                    metadata={
                        "case_id": r.case_id,
                        "feedback_count": r.payload.get("feedback_count", 0),
                        "vet_verified": r.payload.get("vet_verified", False),
                        "feedback_category": r.payload.get("feedback_category", ""),
                        "species": r.payload.get("species", ""),
                    },
                )
                for r in results
            ]
        except Exception as e:
            logger.warning(f"Case Memory search failed: {e}")
            return []


# ============================================================
# SINGLETON - Quản lý instance duy nhất
# ============================================================

_hybrid_engine: Optional[HybridRAGEngine] = None


def get_hybrid_rag_engine() -> HybridRAGEngine:
    """Lấy singleton HybridRAGEngine instance."""
    global _hybrid_engine
    if _hybrid_engine is None:
        _hybrid_engine = HybridRAGEngine()
    return _hybrid_engine


def reset_hybrid_rag_engine() -> None:
    """Reset singleton (dùng cho testing)."""
    global _hybrid_engine
    _hybrid_engine = None


__all__ = [
    "HybridRAGEngine",
    "HybridResult",
    "HybridChunk",
    "get_hybrid_rag_engine",
    "reset_hybrid_rag_engine",
]
