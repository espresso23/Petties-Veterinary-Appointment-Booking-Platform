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
from app.db.postgres.session import AsyncSessionLocal


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
    triplets_used: List[Dict[str, str]] = field(default_factory=list)


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

    def __init__(self) -> None:
        """Khởi tạo service với các giá trị mặc định."""
        self._kg_index = None
        self._llm_model = "google/gemini-2.5-flash-lite"
        self._initialized = False

        # Deduplication tracking
        self._triplet_hashes: set = set()  # Track existing triplet hashes
        self._processed_doc_ids: set = set()  # Track processed document IDs

        import asyncio

        self._init_lock = asyncio.Lock()
        logger.debug("KnowledgeGraphService instance created")

    # ----------------------------------------------------------
    # Helper methods
    # ----------------------------------------------------------

    def _get_triplet_hash(self, subj: str, pred: str, obj: str) -> str:
        """Generate deterministic hash for triplet to detect duplicates."""
        import hashlib

        key = f"{subj.lower()}|{pred.lower()}|{obj.lower()}"
        return hashlib.md5(key.encode("utf-8")).hexdigest()

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
        if self._initialized:
            return

        async with self._init_lock:
            if self._initialized:
                return

            logger.info("Initializing KnowledgeGraphService...")

            # Lazy imports to avoid circular dependencies
            import asyncio
            from llama_index.embeddings.cohere import CohereEmbedding
            from llama_index.llms.openrouter import OpenRouter
            from llama_index.core import Settings as LlamaSettings

            from app.core.config_helper import get_setting
            from app.db.postgres.session import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                cohere_api_key = await get_setting("COHERE_API_KEY", db)
                cohere_model = (
                    await get_setting("COHERE_EMBEDDING_MODEL", db)
                    or "embed-multilingual-v3.0"
                )
                openrouter_api_key = await get_setting("OPENROUTER_API_KEY", db)
                llm_model = (
                    await get_setting("KG_LLM_MODEL", db)
                    or "google/gemini-2.5-flash-lite"
                )
                self._llm_model = llm_model

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

            # Configure LLM (OpenRouter)
            if openrouter_api_key:
                LlamaSettings.llm = OpenRouter(
                    api_key=openrouter_api_key,
                    model=llm_model,
                    temperature=0.1,
                )
            else:
                logger.warning(
                    "OPENROUTER_API_KEY not configured. KG extraction will fail."
                )

            self._initialized = True
            logger.info("KnowledgeGraphService initialized successfully (MongoDB backend)")

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

        import asyncio

        logger.info(
            f"Building KG from {len(documents)} documents "
            f"(max_triplets={max_triplets_per_chunk})"
        )

        try:
            # Get API keys from database
            async with AsyncSessionLocal() as db:
                from app.core.config_helper import get_setting

                cohere_key = await get_setting("COHERE_API_KEY", db)
                openrouter_key = await get_setting("OPENROUTER_API_KEY", db)

            # Extract text from documents
            all_text = "\n\n".join([doc.text for doc in documents])

            # Trích xuất triplets trực tiếp bằng LLM (cách đáng tin cậy hơn)
            triplets = (
                await self._extract_triplets_with_llm(
                    all_text, openrouter_key, max_triplets_per_chunk
                )
                or []
            )

            # Lưu triplets vào MongoDB (chỉ triplets hợp lệ)
            saved_count = 0

            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            kg_collection = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION]

            for subj, pred, obj in triplets:
                subj_clean = subj.strip()
                pred_clean = pred.strip()
                obj_clean = obj.strip()

                # Validation: bỏ qua triplets rỗng, quá dài, hoặc chứa ký tự rác
                if not subj_clean or not pred_clean or not obj_clean:
                    continue
                if (
                    len(subj_clean) > 200
                    or len(pred_clean) > 100
                    or len(obj_clean) > 200
                ):
                    logger.warning(
                        f"Skipping oversized triplet: ({subj_clean[:30]}..., {pred_clean[:20]}..., {obj_clean[:30]}...)"
                    )
                    continue
                # Lọc ký tự đặc biệt/garbage (non-printable, control chars)
                import unicodedata

                def _is_clean(s: str) -> bool:
                    garbage_count = sum(
                        1
                        for c in s
                        if unicodedata.category(c).startswith("C")  # Control chars
                        or ord(c) > 0xFFFF  # Supplementary chars (often garbage)
                    )
                    return garbage_count < len(s) * 0.1  # < 10% garbage

                if not _is_clean(subj_clean) or not _is_clean(obj_clean):
                    logger.warning(
                        f"Skipping garbage triplet: ({subj_clean[:30]}..., {pred_clean[:20]}..., {obj_clean[:30]}...)"
                    )
                    continue

                # Deduplication: MongoDB unique index will handle it, but we can compute hash
                triplet_hash = self._get_triplet_hash(subj_clean, pred_clean, obj_clean)
                
                doc_record = {
                    "subject": subj_clean,
                    "predicate": pred_clean,
                    "object": obj_clean,
                    "source": "documents",
                    "triplet_hash": triplet_hash
                }

                try:
                    await kg_collection.update_one(
                        {
                            "subject": subj_clean,
                            "predicate": pred_clean,
                            "object": obj_clean
                        },
                        {"$setOnInsert": doc_record},
                        upsert=True
                    )
                    saved_count += 1
                except Exception as e:
                    logger.warning(f"Error inserting triplet to MongoDB: {e}")

            # Track processed document IDs
            for doc in documents:
                doc_id = doc.metadata.get("document_id") if doc.metadata else None
                if doc_id:
                    self._processed_doc_ids.add(str(doc_id))

            logger.info(
                f"Saved {saved_count}/{len(triplets)} triplets from {len(documents)} documents "
                f"(MongoDB collection: {settings.MONGODB_KG_TRIPLETS_COLLECTION})"
            )
            return saved_count

        except Exception as e:
            logger.error(f"Failed to build KG: {e}")
            return 0

    async def _extract_triplets_with_llm(
        self, text: str, openrouter_key: str, max_triplets: int = 10
    ) -> List[Tuple[str, str, str]]:
        """
        Trích xuất triplets từ text bằng LLM qua OpenRouter API.

        Args:
            text: Văn bản cần extract
            openrouter_key: API key cho OpenRouter
            max_triplets: Số triplets tối đa

        Returns:
            List of (subject, predicate, object) tuples
        """
        import httpx
        import unicodedata

        clean_text = self._clean_text(text)

        # Chia text thành chunks nếu quá dài
        max_chunk_size = 5000
        chunks = []
        for i in range(0, len(clean_text), max_chunk_size):
            chunks.append(clean_text[i : i + max_chunk_size])

        all_triplets = []

        # Prompt chi tiết hơn cho thú y
        system_prompt = """Bạn là chuyên gia thú y Việt Nam.
Nhiệm vụ: trích xuất các bộ ba tri thức (triplet) từ văn bản thú y.

Mỗi triplet gồm: ["chủ_thể", "quan_hệ", "đối_tượng"]

Các loại quan hệ thường gặp:
- có_triệu_chứng: bệnh → triệu chứng
- điều_trị_bằng: bệnh → phương pháp/thuốc
- nguyên_nhân: bệnh → nguyên nhân
- thường_gặp_ở: bệnh/triệu chứng → loài/giống
- phòng_ngừa: bệnh → biện pháp phòng
- liều_dùng: thuốc → liều lượng
- thuộc_nhóm: bệnh → nhóm bệnh

QUY TẮC QUAN TRỌNG:
1. Chủ thể và đối tượng phải là text TIẾNG VIỆT có nghĩa, KHÔNG chứa ký tự lạ
2. Mỗi phần tử không quá 50 ký tự
3. Trả về tối thiểu 3-5 triplets có ý nghĩa
4. CHỈ trả về JSON array, KHÔNG giải thích

Ví dụ output:
[
  ["Rận tai", "có_triệu_chứng", "Ngứa dữ dội"],
  ["Rận tai", "điều_trị_bằng", "Thuốc nhỏ tai"],
  ["Rận tai", "thường_gặp_ở", "Mèo"]
]"""

        for chunk in chunks[
            :15
        ]:  # Tăng từ 3 lên 15 chunks để cover đầy đủ cho tài liệu lớn
            # Bỏ qua chunk quá ngắn
            if len(chunk.strip()) < 50:
                continue

            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openrouter_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://petties.world",
                            "X-Title": "Petties AI",
                        },
                        json={
                            "model": self._llm_model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {
                                    "role": "user",
                                    "content": f"Trích xuất triplets từ văn bản thú y sau:\n\n{chunk[:3000]}",
                                },
                            ],
                            "max_tokens": 2000,  # Tăng từ 1200 để đủ cho nhiều triplets hơn với 15 chunks
                            "temperature": 0.1,
                        },
                    )

                    if response.status_code == 200:
                        result = response.json()
                        content = result["choices"][0]["message"]["content"]

                        # Log raw response for debugging
                        logger.info(f"LLM response (first 500 chars): {content[:500]}")

                        # Parse JSON với cơ chế recovery if truncated
                        triplets_data = self._parse_triplets_json(content)
                        for item in triplets_data:
                            if isinstance(item, list) and len(item) >= 3:
                                all_triplets.append(
                                    (
                                        str(item[0]).strip(),
                                        str(item[1]).strip(),
                                        str(item[2]).strip(),
                                    )
                                )
            except Exception as e:
                logger.warning(f"Error extracting triplets from chunk: {e}")
                continue

        # Loại bỏ duplicates
        unique_triplets = list(set(all_triplets))[:max_triplets]
        return unique_triplets

    def _parse_triplets_json(self, raw: str) -> List[Any]:
        """
        Parse triplets JSON từ LLM response với cơ chế khôi phục nếu bị cắt (truncated).
        """
        import json as json_module
        import re

        # 1. Clean markdown code blocks
        text = raw.strip()
        text = re.sub(r"^```json\s*", "", text)
        text = re.sub(r"^```\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

        # 2. Thử parse trực tiếp
        try:
            return json_module.loads(text)
        except json_module.JSONDecodeError:
            # 3. Handle truncated JSON (thường thiếu ] ở cuối)
            logger.warning(
                "Detected truncated or invalid JSON from LLM, attempting recovery..."
            )

            # Nếu text không bắt đầu bằng [, thử tìm [ đầu tiên
            if not text.startswith("["):
                start_idx = text.find("[")
                if start_idx != -1:
                    text = text[start_idx:]

            # Thử tự đóng các dấu ngoặc
            try:
                # Tìm triplet hoàn chỉnh cuối cùng (được bao bởi [])
                # Regex tìm cụm ["...", "...", "..."]
                import re

                valid_triplets = re.findall(
                    r'\[\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*\]', text
                )
                if valid_triplets:
                    recovered_json = "[" + ",".join(valid_triplets) + "]"
                    return json_module.loads(recovered_json)
            except Exception as e:
                logger.error(f"Failed to recover JSON triplets: {e}")

            return []

    @staticmethod
    def _clean_text(s: str) -> str:
        """Loại bỏ ký tự non-printable, control chars, binary garbage."""
        import unicodedata

        cleaned = []
        for c in s:
            cat = unicodedata.category(c)
            # Giữ: chữ cái, số, dấu câu, khoảng trắng, dấu tiếng Việt
            if cat.startswith("C") and c not in ("\n", "\t", "\r"):
                continue  # Bỏ ký tự control (trừ newline/tab)
            if ord(c) > 0xFFFF:
                continue  # Bỏ supplementary chars (emoji, garbage)
            cleaned.append(c)
        return "".join(cleaned)

    async def query_graph(
        self,
        query: str,
        top_k: int = DEFAULT_KG_TOP_K,
        max_depth: int = 2,
    ) -> List[KGQueryResult]:
        """
        Truy vấn Knowledge Graph — Tìm kiếm Subgraph (Graph Traversal).

        Sử dụng BFS để tìm các mối quan hệ gián tiếp (A -> B -> C),
        giúp LLM thực hiện Transitive Reasoning.

        Args:
            query: Câu truy vấn ngôn ngữ tự nhiên.
            top_k: Số lượng node kết quả tối đa (để tránh context quá lớn).
            max_depth: Độ sâu tìm kiếm BFS (default: 2, A->B->C).

        Returns:
            Danh sách KGQueryResult với subgraph được tìm thấy.
        """
        await self.initialize()

        try:
            all_triplets = await self._get_all_triplets()
            if not all_triplets:
                logger.info("KG query: MongoDB graph store is empty")
                return []

            # 1. Build adjacency list for BFS
            from collections import defaultdict

            graph = defaultdict(list)
            for subj, pred, obj in all_triplets:
                graph[subj.lower()].append((pred, obj, subj))
                graph[obj.lower()].append((f"<- {pred}", subj, obj))

            # 2. Extract query keywords
            query_lower = query.lower().strip()
            query_keywords = [kw for kw in query_lower.split() if len(kw) > 2]

            # 3. Find start nodes
            start_nodes = set()
            for node in graph.keys():
                if query_lower in node or node in query_lower:
                    start_nodes.add(node)
                    continue
                for kw in query_keywords:
                    if kw in node:
                        start_nodes.add(node)
                        break

            # Fallback: if no start nodes, return ALL triplets (if small enough)
            if not start_nodes:
                max_triplets = top_k * 3
                if len(all_triplets) <= max_triplets:
                    selected = all_triplets
                else:
                    return []
            else:
                # 4. Perform BFS to extract Subgraph
                selected_triplets = set()
                visited_nodes = set(start_nodes)
                queue = [(node, 0) for node in start_nodes]

                while queue and len(selected_triplets) < top_k * 5:
                    current_node, depth = queue.pop(0)

                    if depth >= max_depth:
                        continue

                    for pred, neighbor, original_node in graph[current_node]:
                        neighbor_lower = neighbor.lower()

                        if pred.startswith("<- "):
                            # Reverse edge
                            real_pred = pred[3:]
                            selected_triplets.add((neighbor, real_pred, original_node))
                        else:
                            # Forward edge
                            selected_triplets.add((original_node, pred, neighbor))

                        if neighbor_lower not in visited_nodes:
                            visited_nodes.add(neighbor_lower)
                            queue.append((neighbor_lower, depth + 1))

                selected = list(selected_triplets)

            # Format thành text context cho LLM
            lines = []
            for subj, pred, obj in selected:
                lines.append(f"- {subj} → [{pred}] → {obj}")

            content = "Thông tin từ đồ thị tri thức:\n" + "\n".join(lines)

            triplets_used = [
                {"subject": s, "predicate": p, "object": o} for s, p, o in selected
            ]

            logger.info(
                f"KG query '{query[:50]}...' returned "
                f"{len(selected)}/{len(all_triplets)} triplets via BFS (depth={max_depth})"
            )

            return [
                KGQueryResult(
                    content=content,
                    score=1.0,
                    source_nodes=[],
                    triplets_used=triplets_used,
                )
            ]

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
                storage_context=temp_context,
                include_embeddings=False,
            )

            return self._get_triplets_from_store(temp_store)

        except Exception as e:
            logger.error(f"Failed to extract triplets from text: {e}")
            return []

    async def add_text_to_graph(self, text: str) -> int:
        """
        [Auto-update] Trích xuất triplets từ text và thêm trực tiếp vào Knowledge Graph hiện tại.
        Được gọi khi có Case Memory mới hoặc feedback tích cực.

        Args:
            text: Đoạn văn bản chứa thông tin y khoa cần thêm (VD: case chẩn đoán).

        Returns:
            Số lượng triplets đã được thêm thành công.
        """
        await self.initialize()

        if not text or not text.strip():
            return 0

        from app.core.config_helper import get_setting
        from app.db.postgres.session import AsyncSessionLocal
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        async with AsyncSessionLocal() as db:
            openrouter_api_key = await get_setting("OPENROUTER_API_KEY", db)

        if not openrouter_api_key:
            logger.warning(
                "OPENROUTER_API_KEY not configured. Cannot extract triplets."
            )
            return 0

        # Trích xuất triplets sử dụng LLM
        triplets = await self._extract_triplets_with_llm(text, openrouter_api_key)

        db_mongo = await get_mongodb_database()
        kg_collection = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION]

        added_count = 0
        for subj, pred, obj in triplets:
            if len(subj) > 50 or len(pred) > 50 or len(obj) > 50:
                continue  # Bỏ qua triplet rác

            subj_clean = self._clean_text(subj).strip()
            pred_clean = self._clean_text(pred).strip()
            obj_clean = self._clean_text(obj).strip()

            if not subj_clean or not pred_clean or not obj_clean:
                continue

            try:
                triplet_hash = self._get_triplet_hash(subj_clean, pred_clean, obj_clean)
                doc_record = {
                    "subject": subj_clean,
                    "predicate": pred_clean,
                    "object": obj_clean,
                    "source": "text_auto_update",
                    "triplet_hash": triplet_hash
                }

                # Upsert into MongoDB
                res = await kg_collection.update_one(
                    {
                        "subject": subj_clean,
                        "predicate": pred_clean,
                        "object": obj_clean
                    },
                    {"$setOnInsert": doc_record},
                    upsert=True
                )
                if res.upserted_id:
                    added_count += 1
            except Exception as e:
                logger.warning(f"Error adding triplet ({subj_clean}, {pred_clean}, {obj_clean}): {e}")

        if added_count > 0:
            logger.info(
                f"[Auto-update] Added {added_count} new triplets to KG from text"
            )

        return added_count

    async def get_graph_stats(self) -> Dict[str, Any]:
        """
        Lấy thống kê Knowledge Graph.

        Returns:
            Dict chứa triplet_count, node_count, edge_types, v.v.
        """
        await self.initialize()

        triplet_count = await self._count_triplets()
        triplets = await self._get_all_triplets()

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
            "relation_type_count": len(predicates)
        }

    async def reset_knowledge_graph(self) -> Dict[str, Any]:
        """
        Xóa toàn bộ Knowledge Graph và bắt đầu lại từ đầu.

        Dùng khi muốn rebuild KG hoàn toàn mới (xóa triplets cũ, reset tracking).

        Returns:
            Dict với thông báo thành công
        """
        await self.initialize()

        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            kg_collection = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION]
            await kg_collection.delete_many({})

            self._triplet_hashes = set()
            self._processed_doc_ids = set()

            logger.info("Knowledge Graph has been reset in MongoDB")
            return {
                "success": True,
                "message": "Đã xóa toàn bộ KG và bắt đầu lại từ đầu",
            }
        except Exception as e:
            logger.error(f"Failed to reset KG: {e}")
            return {"success": False, "error": str(e)}

    # ----------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------

    async def _count_triplets(self) -> int:
        """Đếm tổng số triplets trong MongoDB."""
        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            return await db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION].count_documents({})
        except Exception:
            return 0

    async def _get_all_triplets(self) -> List[Tuple[str, str, str]]:
        """Trích xuất tất cả triplets từ MongoDB."""
        triplets = []
        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings
            db_mongo = await get_mongodb_database()
            cursor = db_mongo[settings.MONGODB_KG_TRIPLETS_COLLECTION].find({}, {"subject": 1, "predicate": 1, "object": 1, "_id": 0})
            docs = await cursor.to_list(length=None)
            for d in docs:
                triplets.append((d.get("subject", ""), d.get("predicate", ""), d.get("object", "")))
        except Exception as e:
            logger.warning(f"Failed to fetch triplets from MongoDB: {e}")
        return triplets

    async def _load_index_from_store(self) -> bool:
        """Thử tải KG index (dummy)."""
        return False

    async def get_graph_visualization_data(self) -> Dict[str, Any]:
        """
        Lấy graph data cho visualization (nodes + edges).

        Returns:
            Dict với 'nodes' và 'edges' cho D3.js visualization
        """
        await self.initialize()

        triplets = await self._get_all_triplets()

        if not triplets:
            return {"nodes": [], "edges": [], "error": "No triplets found"}

        # Build nodes and edges
        nodes_dict: Dict[str, Dict[str, Any]] = {}
        edges: List[Dict[str, Any]] = []

        for subj, pred, obj in triplets:
            # Add subject node
            if subj not in nodes_dict:
                nodes_dict[subj] = {"id": subj, "label": subj, "type": "subject"}

            # Add object node
            if obj not in nodes_dict:
                nodes_dict[obj] = {"id": obj, "label": obj, "type": "object"}

            # Add edge
            edges.append(
                {
                    "id": f"{subj}-{pred}-{obj}",
                    "source": subj,
                    "target": obj,
                    "label": pred,
                }
            )

        return {
            "nodes": list(nodes_dict.values()),
            "edges": edges,
            "stats": {"node_count": len(nodes_dict), "edge_count": len(edges)},
        }


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
    _kg_service = None


__all__ = [
    "KnowledgeGraphService",
    "KGQueryResult",
    "get_knowledge_graph_service",
    "reset_knowledge_graph_service",
    "MAX_TRIPLETS_PER_CHUNK",
]
