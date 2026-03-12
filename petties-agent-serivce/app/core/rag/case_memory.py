"""
PETTIES AI SERVICE - Case Memory Service

Tích lũy case đã xác nhận (medical, booking, clinic_ops, general)
vào Qdrant collection `petties_case_memory`. Mỗi case được embed
từ text description -> Cohere -> 1024-dim vector.

Package: app.core.rag
Purpose: Visual Case Memory & lưu trữ case đã xác nhận đa danh mục
Version: v1.0.0

Flow:
    1. User/Vet xác nhận AI trả lời đúng (feedback positive)
    2. FeedbackService extract case -> gọi CaseMemoryService.upsert_case()
    3. Text description được embed -> lưu vào Qdrant với metadata
    4. Lần sau query tương tự -> search_similar() -> re-rank theo feedback

Công thức tính điểm:
    final_score = cosine_similarity
                  + min(feedback_count / 100, 0.3)
                  + (0.1 nếu vet_verified)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger

from app.config.settings import settings


# ============================================================
# CONSTANTS
# ============================================================

CASE_MEMORY_COLLECTION = "petties_case_memory"
"""Tên collection Qdrant cho case memory."""

CASE_MEMORY_DIMENSION = 1024
"""Kích thước vector Cohere embed-multilingual-v3.0."""

DEFAULT_SEARCH_LIMIT = 5
DEFAULT_MIN_SCORE = 0.7

# Feedback-weighted re-ranking constants
FEEDBACK_COUNT_DIVISOR = 100
"""feedback_boost = min(feedback_count / FEEDBACK_COUNT_DIVISOR, MAX_FEEDBACK_BOOST)"""

MAX_FEEDBACK_BOOST = 0.3
"""Điểm cộng tối đa từ số lượng feedback."""

VET_VERIFIED_BOOST = 0.1
"""Điểm cộng thêm khi case được bác sĩ thú y xác nhận."""

DEDUP_THRESHOLD = 0.95
"""Ngưỡng cosine similarity để coi hai case là trùng lặp."""


# ============================================================
# DATA CLASSES
# ============================================================


@dataclass
class CaseResult:
    """Kết quả tìm kiếm case memory với điểm đã re-rank."""

    case_id: str
    content: str
    score: float
    final_score: float
    payload: Dict[str, Any] = field(default_factory=dict)


# ============================================================
# CASE MEMORY SERVICE
# ============================================================


class CaseMemoryService:
    """
    Quản lý Qdrant collection `petties_case_memory`.

    Trách nhiệm:
        - Khởi tạo Qdrant collection (tạo nếu chưa tồn tại)
        - Upsert case đã xác nhận với embeddings
        - Tìm kiếm case tương tự với re-ranking theo feedback
        - Cập nhật feedback count cho case hiện có
        - Dọn dẹp case điểm thấp
        - Cung cấp thống kê

    Cách dùng:
        service = CaseMemoryService()
        await service.initialize()
        await service.upsert_case(text, payload)
        results = await service.search_similar("tai mèo cần nâu đen")
    """

    _instance: Optional["CaseMemoryService"] = None
    _initialized: bool = False

    def __new__(cls) -> "CaseMemoryService":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._qdrant_client = None
        self._embed_model = None
        self._collection_name = CASE_MEMORY_COLLECTION

    # ----------------------------------------------------------
    # Initialization
    # ----------------------------------------------------------

    async def initialize(self) -> None:
        """
        Khởi tạo Qdrant client và Cohere embedding model.

        Lazy import để tránh circular dependencies.
        Tạo collection nếu chưa tồn tại.
        """
        if self._initialized and self._qdrant_client is not None:
            return

        logger.info("Initializing CaseMemoryService...")

        # Lazy imports
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams
        from llama_index.embeddings.cohere import CohereEmbedding

        from app.core.config_helper import get_setting
        from app.db.postgres.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            cohere_api_key = await get_setting("COHERE_API_KEY", db)
            cohere_model = (
                await get_setting("COHERE_EMBEDDING_MODEL", db)
                or "embed-multilingual-v3.0"
            )
            qdrant_url = await get_setting("QDRANT_URL", db) or settings.QDRANT_URL
            qdrant_api_key = (
                await get_setting("QDRANT_API_KEY", db) or settings.QDRANT_API_KEY
            )

        if not cohere_api_key:
            logger.warning(
                "COHERE_API_KEY not configured. CaseMemoryService will be unavailable."
            )
            return

        # Embedding model (search_document for indexing, search_query for querying)
        self._embed_model = CohereEmbedding(
            api_key=cohere_api_key,
            model_name=cohere_model,
            input_type="search_document",
        )

        # Qdrant client
        if qdrant_url and qdrant_api_key:
            logger.info(f"CaseMemory connecting to Qdrant Cloud: {qdrant_url}")
            self._qdrant_client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        else:
            logger.info("CaseMemory using local Qdrant")
            self._qdrant_client = QdrantClient(host="localhost", port=6333)

        # Ensure collection exists
        try:
            self._qdrant_client.get_collection(self._collection_name)
            logger.info(
                f"CaseMemory collection '{self._collection_name}' already exists"
            )
        except Exception:
            logger.info(f"Creating CaseMemory collection: {self._collection_name}")
            self._qdrant_client.create_collection(
                collection_name=self._collection_name,
                vectors_config=VectorParams(
                    size=CASE_MEMORY_DIMENSION,
                    distance=Distance.COSINE,
                ),
            )

        self._initialized = True
        logger.info("CaseMemoryService initialized successfully")

    # ----------------------------------------------------------
    # Embedding helper
    # ----------------------------------------------------------

    async def _embed_text(
        self, text: str, input_type: str = "search_document"
    ) -> List[float]:
        """Embed text bằng Cohere model.

        Args:
            text: Văn bản cần embed.
            input_type: ``search_document`` cho indexing, ``search_query`` cho querying.

        Returns:
            Vector embedding 1024 chiều.
        """
        import asyncio
        from llama_index.embeddings.cohere import CohereEmbedding

        # Chuyển input_type nếu cần (Cohere yêu cầu type khác nhau cho index vs query)
        if input_type != "search_document":
            cohere_api_key = self._embed_model.api_key
            model_name = self._embed_model.model_name
            query_embed = CohereEmbedding(
                api_key=cohere_api_key,
                model_name=model_name,
                input_type=input_type,
            )
            embedding = await asyncio.to_thread(query_embed.get_text_embedding, text)
        else:
            embedding = await asyncio.to_thread(
                self._embed_model.get_text_embedding, text
            )
        return embedding

    # ----------------------------------------------------------
    # Public API
    # ----------------------------------------------------------

    async def upsert_case(
        self,
        text_to_embed: str,
        payload: Dict[str, Any],
        case_id: Optional[str] = None,
    ) -> str:
        """
        Embed và upsert case đã xác nhận vào Qdrant.

        Nếu tồn tại case gần trùng (similarity >= DEDUP_THRESHOLD),
        feedback_count của case hiện có sẽ được tăng thay vì tạo mới.

        Args:
            text_to_embed: Nội dung text để embed (visual_desc + chẩn đoán + triệu chứng).
            payload: Metadata của case (species, body_part, feedback_type, v.v.).
            case_id: UUID tùy chọn. Tự tạo nếu không cung cấp.

        Returns:
            case_id của case đã upsert hoặc case trùng lặp.
        """
        await self.initialize()

        if self._qdrant_client is None or self._embed_model is None:
            logger.warning("CaseMemoryService not available, skipping upsert")
            return ""

        from qdrant_client.models import PointStruct

        # Check for near-duplicate first
        existing = await self.search_similar(
            text_to_embed, top_k=1, min_score=DEDUP_THRESHOLD
        )
        if existing:
            dup = existing[0]
            logger.info(
                f"Near-duplicate found (score={dup.score:.3f}), "
                f"incrementing feedback_count for case {dup.case_id}"
            )
            await self.update_feedback_count(dup.case_id)
            return dup.case_id

        # Generate embedding
        vector = await self._embed_text(text_to_embed, input_type="search_document")

        # Prepare payload
        now = datetime.now(timezone.utc).isoformat()
        case_id = case_id or str(uuid.uuid4())

        full_payload = {
            "case_id": case_id,
            "text_content": text_to_embed,
            "feedback_count": payload.get("feedback_count", 1),
            "vet_verified": payload.get("vet_verified", False),
            "feedback_type": payload.get("feedback_type", "confirmed"),
            "feedback_category": payload.get("feedback_category", "general"),
            "created_at": now,
            "last_confirmed_at": now,
            **payload,
        }

        # Upsert point
        self._qdrant_client.upsert(
            collection_name=self._collection_name,
            points=[
                PointStruct(
                    id=case_id,
                    vector=vector,
                    payload=full_payload,
                )
            ],
        )

        logger.info(
            f"Upserted case {case_id} "
            f"(category={full_payload.get('feedback_category')}, "
            f"text_len={len(text_to_embed)})"
        )
        return case_id

    async def search_similar(
        self,
        query: str,
        top_k: int = DEFAULT_SEARCH_LIMIT,
        min_score: float = DEFAULT_MIN_SCORE,
    ) -> List[CaseResult]:
        """
        Tìm kiếm case tương tự với re-ranking theo feedback.

        Công thức tính điểm:
            final_score = cosine_similarity
                          + min(feedback_count / 100, 0.3)
                          + (0.1 nếu vet_verified)

        Args:
            query: Câu truy vấn tìm kiếm.
            top_k: Số lượng kết quả tối đa trả về.
            min_score: Ngưỡng cosine similarity tối thiểu.

        Returns:
            Danh sách CaseResult, sắp xếp theo final_score giảm dần.
        """
        await self.initialize()

        if self._qdrant_client is None or self._embed_model is None:
            logger.warning("CaseMemoryService not available, returning empty results")
            return []

        try:
            # Embed query
            query_vector = await self._embed_text(query, input_type="search_query")

            # Search Qdrant (qdrant-client>=1.12 dùng query_points thay vì search)

            query_response = self._qdrant_client.query_points(
                collection_name=self._collection_name,
                query=query_vector,
                limit=top_k * 2,  # Fetch more for re-ranking then trim
                score_threshold=min_score,
                with_payload=True,
            )

            results = query_response.points if query_response else []

            if not results:
                return []

            # Re-rank with feedback weighting
            case_results: List[CaseResult] = []
            for hit in results:
                payload = hit.payload or {}
                base_score = hit.score

                feedback_count = payload.get("feedback_count", 0)
                feedback_boost = min(
                    feedback_count / FEEDBACK_COUNT_DIVISOR, MAX_FEEDBACK_BOOST
                )
                vet_boost = VET_VERIFIED_BOOST if payload.get("vet_verified") else 0

                final_score = base_score + feedback_boost + vet_boost

                case_results.append(
                    CaseResult(
                        case_id=payload.get("case_id", str(hit.id)),
                        content=payload.get("text_content", ""),
                        score=base_score,
                        final_score=final_score,
                        payload=payload,
                    )
                )

            # Sort by final_score descending, then trim to top_k
            case_results.sort(key=lambda r: r.final_score, reverse=True)
            case_results = case_results[:top_k]

            logger.info(
                f"CaseMemory search '{query[:50]}...' "
                f"returned {len(case_results)} results"
            )
            return case_results

        except Exception as e:
            logger.error(f"CaseMemory search failed: {e}")
            return []

    async def update_feedback_count(self, case_id: str) -> bool:
        """
        Tăng feedback_count và cập nhật last_confirmed_at cho một case.

        Args:
            case_id: UUID của case cần cập nhật.

        Returns:
            True nếu cập nhật thành công.
        """
        await self.initialize()

        if self._qdrant_client is None:
            return False

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            # Retrieve existing point
            results = self._qdrant_client.scroll(
                collection_name=self._collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="case_id", match=MatchValue(value=case_id))
                    ]
                ),
                limit=1,
                with_payload=True,
                with_vectors=False,
            )

            points = results[0] if results else []
            if not points:
                logger.warning(f"Case {case_id} not found for feedback update")
                return False

            point = points[0]
            payload = point.payload or {}
            new_count = payload.get("feedback_count", 0) + 1

            self._qdrant_client.set_payload(
                collection_name=self._collection_name,
                payload={
                    "feedback_count": new_count,
                    "last_confirmed_at": datetime.now(timezone.utc).isoformat(),
                },
                points=[point.id],
            )

            logger.info(f"Updated case {case_id} feedback_count -> {new_count}")
            return True

        except Exception as e:
            logger.error(f"Failed to update feedback count for {case_id}: {e}")
            return False

    async def delete_case(self, case_id: str) -> bool:
        """
        Xóa một case khỏi Qdrant collection.

        Dùng khi feedback bị xóa hoặc sửa từ positive → negative,
        cần gỡ bỏ case đã embed sai khỏi vector database.

        Args:
            case_id: UUID của case cần xóa.

        Returns:
            True nếu xóa thành công.
        """
        await self.initialize()

        if self._qdrant_client is None:
            return False

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            # Tìm point theo case_id trong payload
            results = self._qdrant_client.scroll(
                collection_name=self._collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="case_id", match=MatchValue(value=case_id)
                        )
                    ]
                ),
                limit=1,
                with_payload=False,
                with_vectors=False,
            )

            points = results[0] if results else []
            if not points:
                logger.warning(f"Case {case_id} not found in Qdrant for deletion")
                return False

            point_ids = [point.id for point in points]
            self._qdrant_client.delete(
                collection_name=self._collection_name,
                points_selector=point_ids,
            )

            logger.info(f"Deleted case {case_id} from Qdrant")
            return True

        except Exception as e:
            logger.error(f"Failed to delete case {case_id}: {e}")
            return False

    async def prune_low_score_cases(
        self,
        max_feedback_below: int = 0,
        older_than_days: int = 90,
    ) -> int:
        """
        Xóa các case không có feedback và đã cũ hơn ngưỡng thời gian.

        Dùng cho bảo trì định kỳ, giữ collection sạch.

        Args:
            max_feedback_below: Xóa case có feedback_count <= giá trị này.
            older_than_days: Chỉ xóa case cũ hơn số ngày này.

        Returns:
            Số lượng case đã xóa.
        """
        await self.initialize()

        if self._qdrant_client is None:
            return 0

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue, Range
            from datetime import timedelta

            cutoff = (
                datetime.now(timezone.utc) - timedelta(days=older_than_days)
            ).isoformat()

            # Find candidates
            results = self._qdrant_client.scroll(
                collection_name=self._collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="feedback_count",
                            range=Range(lte=max_feedback_below),
                        ),
                    ]
                ),
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )

            points = results[0] if results else []
            ids_to_delete = []
            for point in points:
                created = point.payload.get("created_at", "")
                if created and created < cutoff:
                    ids_to_delete.append(point.id)

            if ids_to_delete:
                self._qdrant_client.delete(
                    collection_name=self._collection_name,
                    points_selector=ids_to_delete,
                )
                logger.info(f"Pruned {len(ids_to_delete)} low-score cases")

            return len(ids_to_delete)

        except Exception as e:
            logger.error(f"Failed to prune cases: {e}")
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """
        Lấy thống kê collection.

        Returns:
            Dict chứa points_count, status, phân loại theo category, v.v.
        """
        await self.initialize()

        if self._qdrant_client is None:
            return {
                "initialized": False,
                "collection": self._collection_name,
                "error": "CaseMemoryService not available",
            }

        try:
            info = self._qdrant_client.get_collection(self._collection_name)
            return {
                "initialized": self._initialized,
                "collection": self._collection_name,
                "points_count": info.points_count,
                "status": str(info.status),
            }
        except Exception as e:
            return {
                "initialized": self._initialized,
                "collection": self._collection_name,
                "error": str(e),
            }


# ============================================================
# SINGLETON - Quản lý instance duy nhất
# ============================================================

_case_memory_service: Optional[CaseMemoryService] = None


def get_case_memory_service() -> CaseMemoryService:
    """Lấy singleton CaseMemoryService instance."""
    global _case_memory_service
    if _case_memory_service is None:
        _case_memory_service = CaseMemoryService()
    return _case_memory_service


def reset_case_memory_service() -> None:
    """Reset singleton (dùng cho testing)."""
    global _case_memory_service
    if _case_memory_service is not None:
        _case_memory_service._initialized = False
    _case_memory_service = None


__all__ = [
    "CaseMemoryService",
    "CaseResult",
    "get_case_memory_service",
    "reset_case_memory_service",
    "CASE_MEMORY_COLLECTION",
    "CASE_MEMORY_DIMENSION",
]
