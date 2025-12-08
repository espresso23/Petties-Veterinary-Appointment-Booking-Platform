"""
PETTIES AGENT SERVICE - RAG Engine

Main RAG (Retrieval Augmented Generation) engine.
Combines Qdrant vector search with LlamaIndex processing.
"""

from typing import List, Optional
from dataclasses import dataclass
import logging

from app.core.rag.qdrant_client import QdrantManager
from app.core.rag.document_processor import DocumentProcessor
from app.config.settings import settings

logger = logging.getLogger(__name__)


# Collection name for knowledge base
KNOWLEDGE_COLLECTION = "petties_knowledge"


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
        await engine.index_document(file_bytes, "doc.pdf")
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
            
        self.qdrant = QdrantManager()
        self.processor = DocumentProcessor()
        self._ensure_collection()
        self._initialized = True
    
    def _ensure_collection(self):
        """Ensure knowledge collection exists"""
        self.qdrant.create_collection(
            collection_name=KNOWLEDGE_COLLECTION,
            dimension=1536  # OpenAI ada-002 dimension
        )
    
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
            return 0
        
        # Generate embeddings
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
            collection_name=KNOWLEDGE_COLLECTION,
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
        # Generate query embedding
        query_vector = await self.processor.embed_query(query)
        
        # Search Qdrant
        results = self.qdrant.search(
            collection_name=KNOWLEDGE_COLLECTION,
            query_vector=query_vector,
            top_k=top_k,
            score_threshold=min_score
        )
        
        # Filter by document_ids if specified
        if document_ids:
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
            # Qdrant delete filter
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            self.qdrant.client.delete(
                collection_name=KNOWLEDGE_COLLECTION,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
            logger.info(f"Deleted chunks for document {document_id}")
            return True
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return False
    
    def get_stats(self) -> dict:
        """Get knowledge base stats"""
        info = self.qdrant.get_collection_info(KNOWLEDGE_COLLECTION)
        return {
            "collection": KNOWLEDGE_COLLECTION,
            "total_chunks": info.get("points_count", 0),
            "status": info.get("status", "unknown")
        }
