"""
PETTIES AI SERVICE - Case Memory Service

Tích lũy case đã xác nhận từ EMR vào Qdrant collection `petties_case_memory_v2`:
    - Nguồn: EMR confirmed (final_diagnosis từ bác sĩ)
    - Text vector (Cohere)
    - Image vector (Jina CLIP, optional)

Package: app.core.rag
Purpose: Lưu trữ case đã xác nhận để hỗ trợ chẩn đoán phân biệt
Version: v2.1.0 (2026-03-23 - EMR-driven, no feedback)

Flow:
    1. EMR được tạo/sửa với final_diagnosis
    2. EmrCaseMemorySyncService extract case -> gọi CaseMemoryService.upsert_case()
    3. Text description luôn được embed; ảnh (nếu có URL hợp lệ) sẽ embed thêm
    4. Staff diagnosis flow query case tương tự -> hybrid search

Lưu ý: Nguồn dữ liệu duy nhất là EMR confirmed. Thumbs-up feedback đã bị loại bỏ.

Công thức điểm runtime:
    final_score = base_similarity

Case confirmed được xem là dữ liệu học tương đương nhau; runtime không còn dùng
quality gate để ưu tiên hoặc giảm điểm case.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger

from app.config.settings import settings


# ============================================================
# CONSTANTS
# ============================================================

CASE_MEMORY_COLLECTION = "petties_case_memory_v2"
"""Tên collection Qdrant cho case memory (v2, hỗ trợ text + image)."""

CASE_MEMORY_TEXT_DIMENSION = 1024
"""Kích thước vector text (Cohere embed-multilingual-v3.0)."""

CASE_MEMORY_IMAGE_DIMENSION = 1024
"""Kích thước vector ảnh (Jina CLIP v2)."""

DEFAULT_SEARCH_LIMIT = 5
DEFAULT_MIN_SCORE = 0.7

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
        - Tìm kiếm case tương tự với re-ranking theo similarity thuần
        - Dọn dẹp case cũ theo tuổi dữ liệu
        - Cung cấp thống kê

    Cách dùng:
        service = get_case_memory_service()
        await service.initialize()
        await service.upsert_case(text, payload)
        results = await service.search_similar("tai mèo cần nâu đen")
    """

    def __init__(self) -> None:
        self._qdrant_client = None
        self._embed_model = None
        self._query_embed_model = None
        self._image_enabled = False
        self._collection_name = CASE_MEMORY_COLLECTION
        self._initialized = False
        self._init_lock = asyncio.Lock()

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

        async with self._init_lock:
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

            # Embedding models (search_document cho indexing, search_query cho querying)
            self._embed_model = CohereEmbedding(
                api_key=cohere_api_key,
                model_name=cohere_model,
                input_type="search_document",
            )
            self._query_embed_model = CohereEmbedding(
                api_key=cohere_api_key,
                model_name=cohere_model,
                input_type="search_query",
            )

            # Qdrant client
            if qdrant_url and qdrant_api_key:
                logger.info(f"CaseMemory connecting to Qdrant Cloud: {qdrant_url}")
                self._qdrant_client = QdrantClient(
                    url=qdrant_url, api_key=qdrant_api_key
                )
            else:
                logger.info("CaseMemory using local Qdrant")
                self._qdrant_client = QdrantClient(host="localhost", port=6333)

            # Ensure collection exists (named vectors: text + image)
            try:
                # Use robust check if available, else get_collection
                from qdrant_client.http.exceptions import UnexpectedResponse

                try:
                    exists = self._qdrant_client.collection_exists(
                        self._collection_name
                    )
                    if exists:
                        logger.info(
                            f"CaseMemory collection '{self._collection_name}' already exists"
                        )
                    else:
                        raise ValueError("Collection does not exist")
                except AttributeError:
                    # Fallback for older qdrant_client versions
                    self._qdrant_client.get_collection(self._collection_name)
                    logger.info(
                        f"CaseMemory collection '{self._collection_name}' already exists"
                    )
            except Exception:
                logger.info(f"Creating CaseMemory collection: {self._collection_name}")
                try:
                    self._qdrant_client.create_collection(
                        collection_name=self._collection_name,
                        vectors_config={
                            "text": VectorParams(
                                size=CASE_MEMORY_TEXT_DIMENSION,
                                distance=Distance.COSINE,
                            ),
                            "image": VectorParams(
                                size=CASE_MEMORY_IMAGE_DIMENSION,
                                distance=Distance.COSINE,
                            ),
                        },
                    )
                except Exception as e:
                    # Ignore 409 Conflict if collection was created concurrently
                    if "already exists" in str(e):
                        logger.info(
                            f"Collection {self._collection_name} already exists (concurrent creation)"
                        )
                    else:
                        raise e

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
        # Chọn model theo input_type để tránh tạo CohereEmbedding mới mỗi lần
        if input_type == "search_document":
            model = self._embed_model
        else:
            model = self._query_embed_model

        if model is None:
            logger.warning(
                "CaseMemoryService embed model is not initialized (input_type=%s)",
                input_type,
            )
            return []

        embedding = await asyncio.to_thread(model.get_text_embedding, text)
        return embedding

    # ----------------------------------------------------------
    # Public API
    # ----------------------------------------------------------

    async def upsert_case(
        self,
        text_to_embed: str,
        payload: Dict[str, Any],
        case_id: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        image_base64: Optional[List[str]] = None,
    ) -> str:
        """
        Embed và upsert case đã xác nhận vào Qdrant.

        Nếu tồn tại case gần trùng (similarity >= DEDUP_THRESHOLD),
        hệ thống sẽ tái sử dụng case hiện có thay vì tạo mới.

        Args:
            text_to_embed: Nội dung text để embed (visual_desc + chẩn đoán + triệ).
            payload: Metadata của case (species, body_part, v.v.).
            case_id: UUID tùy chọn. Tự tạo nếu không cung cấp.
            image_urls: Danh sách URL ảnh (https).
            image_base64: Danh sách ảnh dạng base64 (raw hoặc data URL).

        Returns:
            case_id của case đã upsert hoặc case trùng lặp.
        """
        await self.initialize()

        if self._qdrant_client is None or self._embed_model is None:
            logger.warning("CaseMemoryService not available, skipping upsert")
            return ""

        from qdrant_client.models import PointStruct

        # Generate text embedding một lần, dùng cho cả dedup và upsert
        text_vector = await self._embed_text(
            text_to_embed, input_type="search_document"
        )
        if not text_vector:
            logger.warning("CaseMemoryService failed to embed text, skipping upsert")
            return ""

        # Dedup trực tiếp trên text_vector để tránh embed + search 2 lần
        dedup_hits = []
        if not case_id:
            try:
                dedup_resp = self._qdrant_client.query_points(
                    collection_name=self._collection_name,
                    query=text_vector,
                    using="text",
                    limit=1,
                    score_threshold=DEDUP_THRESHOLD,
                    with_payload=True,
                )
                dedup_hits = dedup_resp.points if dedup_resp else []
            except Exception as e:
                logger.error(f"CaseMemory dedup query failed: {e}")
                dedup_hits = []

            if dedup_hits:
                hit = dedup_hits[0]
                payload = hit.payload or {}
                existing_id = payload.get("case_id", str(hit.id))
                logger.info(
                    f"Near-duplicate found via vector check (score={hit.score:.3f}), "
                    f"reuse existing case {existing_id}"
                )
                return existing_id

        image_vector: Optional[List[float]] = None
        image_urls_clean: List[str] = []

        # Xử lý image URLs (https)
        if image_urls:
            # Lọc URL hợp lệ
            image_urls_clean = [
                u.strip()
                for u in image_urls
                if isinstance(u, str) and u.strip().startswith("http")
            ]
            if image_urls_clean:
                try:
                    from app.core.embeddings.jina_image_embeddings import (
                        embed_image_urls,
                    )

                    image_embeddings = await embed_image_urls(image_urls_clean[:1])
                    if image_embeddings:
                        image_vector = image_embeddings[0]
                        self._image_enabled = True
                except Exception as e:
                    logger.error(f"Failed to generate image embedding from URL: {e}")

        # Xử lý image base64 (upload từ device hoặc paste)
        if image_base64 and image_vector is None:
            # Chỉ embed base64 nếu chưa có vector từ URL
            try:
                from app.core.embeddings.jina_image_embeddings import (
                    embed_image_base64,
                )

                base64_embeddings = await embed_image_base64(image_base64[:1])
                if base64_embeddings:
                    image_vector = base64_embeddings[0]
                    self._image_enabled = True
                    logger.info(f"[CaseMemory] Generated embedding from base64 image")
            except Exception as e:
                logger.error(f"Failed to generate image embedding from base64: {e}")

        case_id = case_id or str(uuid.uuid4())
        point_id = self._to_point_id(case_id)

        full_payload = {
            "case_id": case_id,
            "text_content": text_to_embed,
            **payload,
        }

        # Chuẩn bị vectors cho named vectors (text luôn có, image nếu tồn tại)
        vectors: Dict[str, Any] = {"text": text_vector}
        if image_vector is not None:
            vectors["image"] = image_vector

        # Upsert point
        self._qdrant_client.upsert(
            collection_name=self._collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vectors,
                    payload=full_payload,
                )
            ],
        )

        logger.info(f"Upserted case {case_id} text_len={len(text_to_embed)})")
        return case_id

    async def search_similar(
        self,
        query: str,
        top_k: int = DEFAULT_SEARCH_LIMIT,
        min_score: float = DEFAULT_MIN_SCORE,
        image_urls: Optional[List[str]] = None,
    ) -> List[CaseResult]:
        """
        Tìm kiếm case tương tự với similarity thuần.

        Công thức tính điểm:
            final_score = cosine_similarity

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
            # 1) Text branch
            query_vector = await self._embed_text(query, input_type="search_query")
            text_response = self._qdrant_client.query_points(
                collection_name=self._collection_name,
                query=query_vector,
                using="text",
                limit=top_k * 2,
                score_threshold=min_score,
                with_payload=True,
            )
            text_hits = text_response.points if text_response else []

            # 2) Image branch (optional)
            image_hits = []
            if image_urls:
                image_urls_clean = [
                    u.strip()
                    for u in image_urls
                    if isinstance(u, str) and u.strip().startswith("http")
                ]
                if image_urls_clean:
                    from app.core.embeddings.jina_image_embeddings import (
                        embed_image_urls,
                    )

                    img_vectors = await embed_image_urls(image_urls_clean[:1])
                    if img_vectors:
                        image_response = self._qdrant_client.query_points(
                            collection_name=self._collection_name,
                            query=img_vectors[0],
                            using="image",
                            limit=top_k * 2,
                            with_payload=True,
                        )
                        image_hits = image_response.points if image_response else []

            # 3) Merge by case_id
            merged: Dict[str, Dict[str, Any]] = {}

            for hit in text_hits:
                payload = hit.payload or {}
                cid = payload.get("case_id", str(hit.id))
                merged[cid] = {
                    "payload": payload,
                    "text_score": hit.score,
                    "image_score": 0.0,
                }

            for hit in image_hits:
                payload = hit.payload or {}
                cid = payload.get("case_id", str(hit.id))
                if cid not in merged:
                    merged[cid] = {
                        "payload": payload,
                        "text_score": 0.0,
                        "image_score": hit.score,
                    }
                else:
                    merged[cid]["image_score"] = max(
                        merged[cid]["image_score"], hit.score
                    )

            if not merged:
                return []

            # 4) Re-rank with hybrid score only
            has_image_query = len(image_hits) > 0
            w_text = 0.3 if has_image_query else 1.0
            w_image = 0.7 if has_image_query else 0.0

            case_results: List[CaseResult] = []
            for cid, row in merged.items():
                payload = row["payload"]
                base_score = w_text * row["text_score"] + w_image * row["image_score"]

                case_results.append(
                    CaseResult(
                        case_id=cid,
                        content=payload.get("text_content", ""),
                        score=base_score,
                        final_score=base_score,
                        payload=payload,
                    )
                )

            case_results.sort(key=lambda r: r.final_score, reverse=True)
            case_results = case_results[:top_k]

            logger.info(
                f"CaseMemory search '{query[:50]}...' returned {len(case_results)} results "
                f"(text_hits={len(text_hits)}, image_hits={len(image_hits)})"
            )
            return case_results

        except Exception as e:
            logger.error(f"CaseMemory search failed: {e}")
            return []

    async def delete_case(self, case_id: str) -> bool:
        """
        Xóa một case khỏi Qdrant collection.

        Dùng khi EMR bị hủy, chẩn đoán bị sửa đổi về trạng thái không hợp lệ,
        hoặc cần gỡ bỏ case đã embed sai khỏi vector database.

        Args:
            case_id: UUID của case cần xóa.

        Returns:
            True nếu xóa thành công.
        """
        await self.initialize()

        if self._qdrant_client is None:
            return False

        try:
            # Retrieve point directly by ID
            try:
                points = self._qdrant_client.retrieve(
                    collection_name=self._collection_name,
                    ids=[self._to_point_id(case_id)],
                    with_payload=False,
                    with_vectors=False,
                )
            except Exception:
                from qdrant_client.models import Filter, FieldCondition, MatchValue

                # Tìm point theo case_id trong payload (fallback)
                scroll_results = self._qdrant_client.scroll(
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
                points = scroll_results[0] if scroll_results else []

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
        older_than_days: int = 90,
    ) -> int:
        """
        Xóa các case đã cũ hơn ngưỡng thời gian.

        Dùng cho bảo trì định kỳ, giữ collection sạch.

        Args:
            older_than_days: Chỉ xóa case cũ hơn số ngày này.

        Returns:
            Số lượng case đã xóa.
        """
        await self.initialize()

        if self._qdrant_client is None:
            return 0

        try:
            from qdrant_client.models import Filter
            from datetime import timedelta

            cutoff = (
                datetime.now(timezone.utc) - timedelta(days=older_than_days)
            ).isoformat()

            # Find candidates với pagination để không bỏ sót >1000 records
            all_points = []
            offset = None
            while True:
                points, next_offset = self._qdrant_client.scroll(
                    collection_name=self._collection_name,
                    scroll_filter=Filter(must=[]),
                    limit=100,
                    with_payload=True,
                    with_vectors=False,
                    offset=offset,
                )
                if not points:
                    break
                all_points.extend(points)
                if next_offset is None:
                    break
                offset = next_offset
            ids_to_delete = []
            for point in all_points:
                payload = point.payload or {}
                created = payload.get("created_at", "")
                if created and created < cutoff:
                    ids_to_delete.append(point.id)

            if ids_to_delete:
                self._qdrant_client.delete(
                    collection_name=self._collection_name,
                    points_selector=ids_to_delete,
                )
                logger.info(f"Pruned {len(ids_to_delete)} stale cases")

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
                "image_enabled": self._image_enabled,
                "error": "CaseMemoryService not available",
            }

        try:
            info = self._qdrant_client.get_collection(self._collection_name)
            return {
                "initialized": self._initialized,
                "collection": self._collection_name,
                "points_count": info.points_count,
                "status": str(info.status),
                "image_enabled": self._image_enabled,
            }
        except Exception as e:
            return {
                "initialized": self._initialized,
                "collection": self._collection_name,
                "image_enabled": self._image_enabled,
                "error": str(e),
            }

    async def list_cases(
        self,
        query: Optional[str] = None,
        species: Optional[str] = None,
        diagnosis: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """
        Lấy danh sách cases với pagination và filters.

        Args:
            query: Tìm kiếm trong nội dung case
            species: Lọc theo loài (dog, cat)
            diagnosis: Lọc theo từ khóa chẩn đoán
            page: Số trang (1-indexed)
            page_size: Số items mỗi trang (max 100)

        Returns:
            Dict với items, total, page, page_size
        """
        await self.initialize()

        if self._qdrant_client is None:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "error": "CaseMemoryService not available",
            }

        try:
            from qdrant_client.models import (
                Filter,
                FieldCondition,
                MatchValue,
                MatchAny,
            )

            # Build filter conditions
            must_conditions = []
            if species:
                must_conditions.append(
                    FieldCondition(key="species", match=MatchValue(value=species))
                )

            filter_obj = Filter(must=must_conditions) if must_conditions else None

            # Determine if we need text filtering (requires in-memory filtering)
            needs_text_filter = bool(query or diagnosis)

            if needs_text_filter:
                # Text filtering requires scanning — but limit to avoid OOM
                # Fetch in batches, stopping once we have enough for the requested page
                all_items = []
                offset = None
                max_scan_pages = 50  # Safety limit: max 5000 items scanned
                scan_count = 0

                while scan_count < max_scan_pages:
                    points, next_offset = self._qdrant_client.scroll(
                        collection_name=self._collection_name,
                        scroll_filter=filter_obj,
                        limit=100,
                        with_payload=True,
                        with_vectors=False,
                        offset=offset,
                    )
                    if not points:
                        break
                    all_items.extend(points)
                    scan_count += 1
                    if next_offset is None:
                        break
                    offset = next_offset

                # Filter by query text if provided
                if query:
                    query_lower = query.lower()
                    all_items = [
                        p
                        for p in all_items
                        if query_lower
                        in (p.payload.get("text_content", "") or "").lower()
                        or query_lower
                        in (p.payload.get("chief_complaint", "") or "").lower()
                        or query_lower
                        in (p.payload.get("final_diagnosis_text", "") or "").lower()
                    ]

                if diagnosis:
                    diagnosis_lower = diagnosis.lower()
                    all_items = [
                        p
                        for p in all_items
                        if diagnosis_lower
                        in (p.payload.get("final_diagnosis_text", "") or "").lower()
                    ]

                # Sort by exam_at descending
                all_items.sort(key=lambda p: p.payload.get("exam_at", ""), reverse=True)

                # Paginate
                total = len(all_items)
                start_idx = (page - 1) * page_size
                end_idx = start_idx + page_size
                page_items = all_items[start_idx:end_idx]

            else:
                # No text filter — use native Qdrant pagination with offset
                offset_val = (page - 1) * page_size
                points, next_offset = self._qdrant_client.scroll(
                    collection_name=self._collection_name,
                    scroll_filter=filter_obj,
                    limit=page_size,
                    with_payload=True,
                    with_vectors=False,
                    offset=offset_val if offset_val > 0 else None,
                )
                page_items = points or []

                # Get total count from collection info
                try:
                    info = self._qdrant_client.get_collection(self._collection_name)
                    total = info.points_count
                except Exception:
                    total = len(page_items)

            # Format response
            items = []
            for point in page_items:
                payload = point.payload or {}
                items.append(
                    {
                        "case_id": payload.get("case_id", str(point.id)),
                        "species": payload.get("species", "unknown"),
                        "chief_complaint": payload.get("chief_complaint", ""),
                        "display_name_vi": payload.get("display_name_vi"),
                        "final_diagnosis_text": payload.get("final_diagnosis_text", ""),
                        "canonical_code": payload.get("canonical_code"),
                        "mapping_status": payload.get("mapping_status"),
                        "exam_at": payload.get("exam_at"),
                    }
                )

            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
            }

        except Exception as e:
            logger.error(f"Failed to list cases: {e}")
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "error": str(e),
            }

    async def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """
        Lấy chi tiết một case.

        Args:
            case_id: UUID của case cần lấy

        Returns:
            Dict chứa case details hoặc None nếu không tìm thấy
        """
        await self.initialize()

        if self._qdrant_client is None:
            return None

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            # Try direct ID first
            try:
                points = self._qdrant_client.retrieve(
                    collection_name=self._collection_name,
                    ids=[self._to_point_id(case_id)],
                    with_payload=True,
                    with_vectors=False,
                )
            except Exception:
                # Fallback: search by case_id in payload
                scroll_results = self._qdrant_client.scroll(
                    collection_name=self._collection_name,
                    scroll_filter=Filter(
                        must=[
                            FieldCondition(
                                key="case_id", match=MatchValue(value=case_id)
                            )
                        ]
                    ),
                    limit=1,
                    with_payload=True,
                    with_vectors=False,
                )
                points = scroll_results[0] if scroll_results else []

            if not points:
                return None

            point = points[0]
            payload = point.payload or {}
            return {
                "case_id": payload.get("case_id", str(point.id)),
                "text_content": payload.get("text_content", ""),
                "species": payload.get("species", "unknown"),
                "chief_complaint": payload.get("chief_complaint", ""),
                "display_name_vi": payload.get("display_name_vi"),
                "clinical_notes": payload.get("clinical_notes"),
                "final_diagnosis_text": payload.get("final_diagnosis_text", ""),
                "canonical_code": payload.get("canonical_code"),
                "mapping_status": payload.get("mapping_status"),
                "exam_at": payload.get("exam_at"),
                "protocol_pattern": payload.get("protocol_pattern"),
            }

        except Exception as e:
            logger.error(f"Failed to get case {case_id}: {e}")
            return None

    def _to_point_id(self, case_id: str) -> str:
        """Map logical case_id to a deterministic UUID accepted by Qdrant."""
        normalized_case_id = (case_id or "").strip()
        if not normalized_case_id:
            normalized_case_id = str(uuid.uuid4())
        try:
            return str(uuid.UUID(normalized_case_id))
        except ValueError:
            return str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"petties-case-memory:{normalized_case_id}",
                )
            )


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
    "CASE_MEMORY_TEXT_DIMENSION",
    "CASE_MEMORY_IMAGE_DIMENSION",
]
