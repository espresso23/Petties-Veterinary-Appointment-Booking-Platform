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
            triplets = await self._extract_triplets_with_llm(
                all_text, openrouter_key, max_triplets_per_chunk
            )

            # Lưu triplets vào graph store (chỉ triplets hợp lệ)
            saved_count = 0
            for subj, pred, obj in triplets:
                subj_clean = subj.strip()
                pred_clean = pred.strip()
                obj_clean = obj.strip()

                # Validation: bỏ qua triplets rỗng, quá dài, hoặc chứa ký tự rác
                if not subj_clean or not pred_clean or not obj_clean:
                    continue
                if len(subj_clean) > 200 or len(pred_clean) > 100 or len(obj_clean) > 200:
                    logger.warning(f"Skipping oversized triplet: ({subj_clean[:30]}..., {pred_clean[:20]}..., {obj_clean[:30]}...)")
                    continue
                # Lọc ký tự đặc biệt/garbage (non-printable, control chars)
                import unicodedata
                def _is_clean(s: str) -> bool:
                    garbage_count = sum(
                        1 for c in s
                        if unicodedata.category(c).startswith('C')  # Control chars
                        or ord(c) > 0xFFFF  # Supplementary chars (often garbage)
                    )
                    return garbage_count < len(s) * 0.1  # < 10% garbage

                if not _is_clean(subj_clean) or not _is_clean(obj_clean):
                    logger.warning(f"Skipping garbage triplet: ({subj_clean[:30]}..., {pred_clean[:20]}..., {obj_clean[:30]}...)")
                    continue

                self._graph_store.upsert_triplet(
                    subj=subj_clean, rel=pred_clean, obj=obj_clean
                )
                saved_count += 1

            # Persist to disk
            self._persist()

            logger.info(
                f"Saved {saved_count}/{len(triplets)} triplets from {len(documents)} documents"
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

        # Làm sạch text trước khi gửi LLM (loại bỏ ký tự binary/garbage từ PDF)
        def _clean_text(s: str) -> str:
            """Loại bỏ ký tự non-printable, control chars, binary garbage."""
            cleaned = []
            for c in s:
                cat = unicodedata.category(c)
                # Giữ: chữ cái, số, dấu câu, khoảng trắng, dấu tiếng Việt
                if cat.startswith('C') and c not in ('\n', '\t', '\r'):
                    continue  # Bỏ ký tự control (trừ newline/tab)
                if ord(c) > 0xFFFF:
                    continue  # Bỏ supplementary chars (emoji, garbage)
                cleaned.append(c)
            return ''.join(cleaned)

        clean_text = _clean_text(text)

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

        for chunk in chunks[:3]:  # Giới hạn 3 chunks
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
                            "model": "google/gemini-2.0-flash-001",
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {
                                    "role": "user",
                                    "content": f"Trích xuất triplets từ văn bản thú y sau:\n\n{chunk[:3000]}",
                                },
                            ],
                            "max_tokens": 1200,
                            "temperature": 0.1,
                        },
                    )

                    if response.status_code == 200:
                        result = response.json()
                        content = result["choices"][0]["message"]["content"]

                        # Log raw response for debugging
                        logger.info(f"LLM response (first 500 chars): {content[:500]}")

                        # Parse JSON từ response - handle markdown code blocks
                        import json as json_module
                        import re

                        # Loại bỏ markdown code blocks
                        clean_content = re.sub(r"```json\s*", "", content)
                        clean_content = re.sub(r"```\s*$", "", clean_content)
                        clean_content = clean_content.strip()

                        try:
                            # Thử parse trực tiếp
                            data = json_module.loads(clean_content)
                            if isinstance(data, list):
                                for item in data:
                                    if isinstance(item, list) and len(item) >= 3:
                                        all_triplets.append(
                                            (
                                                str(item[0]).strip(),
                                                str(item[1]).strip(),
                                                str(item[2]).strip(),
                                            )
                                        )
                        except Exception as parse_err:
                            # Thử tìm array trong content
                            matches = re.findall(r"\[[\s\S]*?\]", content)
                            for match in matches:
                                try:
                                    data = json_module.loads(match)
                                    if isinstance(data, list):
                                        for item in data:
                                            if (
                                                isinstance(item, list)
                                                and len(item) >= 3
                                            ):
                                                all_triplets.append(
                                                    (
                                                        str(item[0]).strip(),
                                                        str(item[1]).strip(),
                                                        str(item[2]).strip(),
                                                    )
                                                )
                                except:
                                    continue
                        except Exception as parse_err:
                            logger.warning(f"JSON parse error: {parse_err}")
                            continue
            except Exception as e:
                logger.warning(f"Error extracting triplets from chunk: {e}")
                continue

        # Loại bỏ duplicates
        unique_triplets = list(set(all_triplets))[:max_triplets]
        return unique_triplets


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

    async def get_graph_visualization_data(self) -> Dict[str, Any]:
        """
        Lấy graph data cho visualization (nodes + edges).

        Returns:
            Dict với 'nodes' và 'edges' cho D3.js visualization
        """
        await self.initialize()

        if self._graph_store is None:
            return {"nodes": [], "edges": [], "error": "Graph store not initialized"}

        triplets = self._get_triplets_from_store(self._graph_store)

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
