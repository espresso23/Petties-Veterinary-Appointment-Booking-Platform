"""
PETTIES AGENT SERVICE - RAG Engine

Main RAG (Retrieval Augmented Generation) engine.
Combines Qdrant vector search with LlamaIndex processing and Cohere embeddings.

Package: app.core.rag
Purpose: Document indexing and retrieval for pet care knowledge
Version: v1.0.0 (Migrated to Cohere embeddings)

Changes from v0.x:
- Uses Cohere embed-multilingual-v3.0 (1024 dimensions)
- Better Vietnamese text support
- Async operations throughout
"""

from typing import List, Optional
from dataclasses import dataclass
from loguru import logger

from app.core.rag.qdrant_client import QdrantManager, get_qdrant_manager, COHERE_EMBED_DIMENSION
from app.core.rag.document_processor import DocumentProcessor, get_document_processor
from app.config.settings import settings
from app.core.config_helper import get_setting
from app.db.postgres.session import AsyncSessionLocal


# Collection name for knowledge base is loaded from settings


@dataclass
class RetrievedChunk:
    """Retrieved document chunk"""
    document_id: int
    document_name: str
    chunk_index: int
    content: str
    score: float


class RAGEngine:
    """
    RAG Engine - Document indexing and retrieval

    Usage:
        engine = RAGEngine()
        await engine.index_document(file_bytes, "doc.pdf", doc_id=1)
        results = await engine.query("pet symptoms")
    """

    _instance: Optional["RAGEngine"] = None

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.qdrant = get_qdrant_manager()
        self.processor = get_document_processor()
        # Initial check, will be updated dynamically during operations
        self._initialized = True

    async def _get_collection_name(self, db=None) -> str:
        """Get collection name from DB with fallback to settings"""
        return await get_setting("QDRANT_COLLECTION_NAME", db, settings.QDRANT_COLLECTION_NAME)

    async def _ensure_collection_dynamic(self, db=None):
        """Ensure knowledge collection exists (dynamic check)"""
        col_name = await self._get_collection_name(db)
        self.qdrant.create_collection(
            collection_name=col_name,
            dimension=COHERE_EMBED_DIMENSION
        )
        return col_name

    async def index_document(
        self,
        file_content: bytes,
        filename: str,
        document_id: int,
        metadata: Optional[dict] = None
    ) -> int:
        """
        Index a document into the knowledge base

        Args:
            file_content: Raw file bytes
            filename: Original filename
            document_id: Database document ID
            metadata: Additional metadata

        Returns:
            Number of chunks indexed
        """
        # Process document into chunks
        chunks = self.processor.process_file(
            file_content,
            filename,
            metadata={
                "document_id": document_id,
                **(metadata or {})
            }
        )

        if not chunks:
            logger.warning(f"No chunks generated for {filename}")
            return 0

        # Ensure collection exists
        col_name = await self._ensure_collection_dynamic()

        # Generate embeddings with Cohere
        embeddings = await self.processor.embed_chunks(chunks)

        # Prepare payloads
        payloads = [
            {
                "document_id": document_id,
                "document_name": filename,
                "chunk_index": c["chunk_index"],
                "content": c["content"],
                **c["metadata"]
            }
            for c in chunks
        ]

        # Upsert to Qdrant
        success = self.qdrant.upsert_vectors(
            collection_name=col_name,
            vectors=embeddings,
            payloads=payloads
        )

        if success:
            logger.info(f"Indexed {len(chunks)} chunks for document {document_id}")
            return len(chunks)
        return 0

    async def query(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.5,
        document_ids: Optional[List[int]] = None
    ) -> List[RetrievedChunk]:
        """
        Query the knowledge base

        Args:
            query: Search query text
            top_k: Number of results
            min_score: Minimum similarity score
            document_ids: Filter by specific documents

        Returns:
            List of retrieved chunks
        """
        # Generate query embedding with Cohere
        query_vector = await self.processor.embed_query(query)

        # Build filter conditions
        filter_conditions = None
        if document_ids and len(document_ids) == 1:
            filter_conditions = {"document_id": document_ids[0]}

        # Get dynamic collection name
        col_name = await self._get_collection_name()

        # Search Qdrant
        results = self.qdrant.search(
            collection_name=col_name,
            query_vector=query_vector,
            top_k=top_k,
            score_threshold=min_score,
            filter_conditions=filter_conditions
        )

        # Filter by document_ids if multiple
        if document_ids and len(document_ids) > 1:
            results = [r for r in results if r.get("document_id") in document_ids]

        # Convert to RetrievedChunk objects
        chunks = [
            RetrievedChunk(
                document_id=r.get("document_id", 0),
                document_name=r.get("document_name", ""),
                chunk_index=r.get("chunk_index", 0),
                content=r.get("content", ""),
                score=r.get("score", 0)
            )
            for r in results
        ]

        logger.info(f"Query '{query[:50]}...' returned {len(chunks)} results")
        return chunks

    async def delete_document(self, document_id: int) -> bool:
        """Delete all chunks for a document"""
        try:
            col_name = await self._get_collection_name()
            success = self.qdrant.delete_by_filter(
                collection_name=col_name,
                filter_conditions={"document_id": document_id}
            )
            if success:
                logger.info(f"Deleted chunks for document {document_id}")
            return success

        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return False

    async def get_stats(self) -> dict:
        """Get knowledge base stats"""
        col_name = await self._get_collection_name()
        info = self.qdrant.get_collection_info(col_name)
        return {
            "collection": col_name,
            "total_chunks": info.get("points_count", 0),
            "status": info.get("status", "unknown"),
            "embedding_model": "cohere/embed-multilingual-v3.0",
            "dimension": COHERE_EMBED_DIMENSION
        }


# Singleton accessor
def get_rag_engine() -> RAGEngine:
    """Get singleton RAGEngine instance"""
    return RAGEngine()
