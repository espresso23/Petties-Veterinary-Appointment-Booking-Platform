"""
PETTIES AGENT SERVICE - RAG Engine (Full LlamaIndex)

Full LlamaIndex integration for document indexing and retrieval.
Uses LlamaIndex to manage: chunking, embedding, vector storage, and search.

Package: app.core.rag
Purpose: Document indexing and retrieval for pet care knowledge
Version: v2.0.0 (Full LlamaIndex integration)

Components:
- LlamaIndex VectorStoreIndex for indexing
- Cohere embed-multilingual-v3.0 for Vietnamese embeddings
- Qdrant Cloud for vector storage
"""

from typing import List, Optional
from dataclasses import dataclass
from loguru import logger
import asyncio

# LlamaIndex imports
from llama_index.core import (
    VectorStoreIndex,
    Document,
    Settings,
    StorageContext,
)
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.cohere import CohereEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

from app.config.settings import settings
from app.core.config_helper import get_setting
from app.db.postgres.session import AsyncSessionLocal


# Cohere embed-multilingual-v3.0 dimension
COHERE_EMBED_DIMENSION = 1024


@dataclass
class RetrievedChunk:
    """Retrieved document chunk"""
    document_id: int
    document_name: str
    chunk_index: int
    content: str
    score: float


class LlamaIndexRAGEngine:
    """
    Full LlamaIndex RAG Engine
    
    Uses LlamaIndex to handle:
    - Document chunking (SentenceSplitter)
    - Embedding (Cohere)
    - Vector storage (Qdrant)
    - Similarity search
    
    Usage:
        engine = LlamaIndexRAGEngine()
        await engine.initialize()
        await engine.index_document(content, "doc.pdf", doc_id=1)
        results = await engine.query("pet symptoms")
    """
    
    _instance: Optional["LlamaIndexRAGEngine"] = None
    _initialized: bool = False
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.index: Optional[VectorStoreIndex] = None
        self.vector_store: Optional[QdrantVectorStore] = None
        self.qdrant_client: Optional[QdrantClient] = None
        self._collection_name = settings.QDRANT_COLLECTION_NAME or "petties_knowledge_base"
        
    async def initialize(self):
        """
        Initialize LlamaIndex components with settings from database
        
        Must be called before using index_document or query
        """
        if self._initialized and self.index is not None:
            return
            
        logger.info("Initializing LlamaIndex RAG Engine...")
        
        async with AsyncSessionLocal() as db:
            # Get API keys from database
            cohere_api_key = await get_setting("COHERE_API_KEY", db)
            cohere_model = await get_setting("COHERE_EMBEDDING_MODEL", db) or "embed-multilingual-v3.0"
            qdrant_url = await get_setting("QDRANT_URL", db) or settings.QDRANT_URL
            qdrant_api_key = await get_setting("QDRANT_API_KEY", db) or settings.QDRANT_API_KEY
            self._collection_name = await get_setting("QDRANT_COLLECTION_NAME", db) or "petties_knowledge_base"
        
        if not cohere_api_key:
            logger.warning("COHERE_API_KEY not configured. RAG search will be unavailable. Please set it in Settings.")
            return
        
        # Configure LlamaIndex Settings (global)
        Settings.embed_model = CohereEmbedding(
            api_key=cohere_api_key,
            model_name=cohere_model,
            input_type="search_document"  # For indexing
        )
        
        # Configure chunking
        Settings.node_parser = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=50
        )
        
        # Initialize Qdrant client
        if qdrant_url and qdrant_api_key:
            logger.info(f"Connecting to Qdrant Cloud: {qdrant_url}")
            self.qdrant_client = QdrantClient(
                url=qdrant_url,
                api_key=qdrant_api_key
            )
        else:
            logger.info("Using local Qdrant")
            self.qdrant_client = QdrantClient(host="localhost", port=6333)
        
        # Create vector store
        self.vector_store = QdrantVectorStore(
            client=self.qdrant_client,
            collection_name=self._collection_name,
            enable_hybrid=False,  # Can enable for BM25 + Vector
        )
        
        # Create or load index
        storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        
        # Check if collection exists with data
        try:
            collection_info = self.qdrant_client.get_collection(self._collection_name)
            points_count = collection_info.points_count
            
            if points_count > 0:
                logger.info(f"Loading existing index with {points_count} vectors")
                self.index = VectorStoreIndex.from_vector_store(
                    self.vector_store,
                    storage_context=storage_context
                )
            else:
                logger.info("Creating new empty index")
                self.index = VectorStoreIndex.from_documents(
                    [],
                    storage_context=storage_context
                )
        except Exception as e:
            logger.warning(f"Collection not found, creating new: {e}")
            self.index = VectorStoreIndex.from_documents(
                [],
                storage_context=storage_context
            )
        
        self._initialized = True
        logger.info("LlamaIndex RAG Engine initialized successfully")
    
    async def index_document(
        self,
        file_content: bytes,
        filename: str,
        document_id: int,
        metadata: Optional[dict] = None
    ) -> int:
        """
        Index a document into the knowledge base
        
        LlamaIndex handles:
        - Text extraction (if needed)
        - Chunking with SentenceSplitter
        - Embedding with Cohere
        - Storing in Qdrant
        
        Args:
            file_content: Raw file bytes
            filename: Original filename
            document_id: Database document ID
            metadata: Additional metadata
            
        Returns:
            Number of chunks indexed
        """
        await self.initialize()
        
        # Extract text from file
        text = self._extract_text(file_content, filename)
        if not text:
            logger.warning(f"No text extracted from {filename}")
            return 0
        
        # Create LlamaIndex Document with metadata
        doc_metadata = {
            "document_id": document_id,
            "document_name": filename,
            "filename": filename,
            "file_type": filename.split('.')[-1].lower(),
            **(metadata or {})
        }
        
        doc = Document(
            text=text,
            metadata=doc_metadata,
            doc_id=str(document_id)
        )
        
        # Insert into index (LlamaIndex handles chunking + embedding + storage)
        try:
            # Use refresh method to add new document
            self.index.refresh_ref_docs([doc])
            
            # Count nodes created
            nodes = Settings.node_parser.get_nodes_from_documents([doc])
            chunks_count = len(nodes)
            
            logger.info(f"Indexed {filename}: {chunks_count} chunks with LlamaIndex")
            return chunks_count
            
        except Exception as e:
            logger.error(f"Failed to index document: {e}")
            raise
    
    async def query(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.5,
        document_ids: Optional[List[int]] = None
    ) -> List[RetrievedChunk]:
        """
        Query the knowledge base
        
        LlamaIndex handles:
        - Query embedding with Cohere
        - Vector similarity search in Qdrant
        
        Args:
            query: Search query text
            top_k: Number of results
            min_score: Minimum similarity score
            document_ids: Filter by specific documents (optional)
            
        Returns:
            List of retrieved chunks
        """
        await self.initialize()
        
        logger.info(f"Query: '{query[:50]}...', top_k={top_k}, min_score={min_score}")
        
        try:
            # Create retriever with settings
            retriever = self.index.as_retriever(
                similarity_top_k=top_k,
            )
            
            # Retrieve nodes
            nodes = await asyncio.to_thread(retriever.retrieve, query)
            
            logger.info(f"Retrieved {len(nodes)} raw results")
            
            # Filter by score and convert to RetrievedChunk
            chunks = []
            for i, node in enumerate(nodes):
                score = node.score if hasattr(node, 'score') and node.score else 0.0
                
                # Skip if below min_score
                if score < min_score:
                    continue
                
                # Extract metadata
                meta = node.metadata if hasattr(node, 'metadata') else {}
                
                chunk = RetrievedChunk(
                    document_id=meta.get("document_id", 0),
                    document_name=meta.get("document_name", meta.get("filename", "")),
                    chunk_index=i,
                    content=node.text if hasattr(node, 'text') else str(node),
                    score=score
                )
                chunks.append(chunk)
                
                logger.debug(f"  Result {i}: score={score:.3f}, content_len={len(chunk.content)}")
            
            # Filter by document_ids if provided
            if document_ids:
                chunks = [c for c in chunks if c.document_id in document_ids]
            
            logger.info(f"Query '{query[:30]}...' returned {len(chunks)} filtered results")
            return chunks
            
        except Exception as e:
            logger.error(f"Query failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    async def delete_document(self, document_id: int) -> int:
        """
        Delete all chunks for a document from Qdrant
        
        Args:
            document_id: Database document ID
            
        Returns:
            Number of points deleted
        """
        await self.initialize()
        
        try:
            # Delete by filter
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            result = self.qdrant_client.delete(
                collection_name=self._collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
            
            logger.info(f"Deleted vectors for document_id={document_id}")
            return 1  # Qdrant doesn't return count
            
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")
            return 0
    
    def _extract_text(self, content: bytes, filename: str) -> str:
        """Extract text from file based on extension"""
        ext = filename.lower().split('.')[-1]
        
        try:
            if ext in ["txt", "md"]:
                return content.decode("utf-8")
            
            elif ext == "pdf":
                try:
                    import fitz  # PyMuPDF
                    doc = fitz.open(stream=content, filetype="pdf")
                    text = ""
                    for page in doc:
                        text += page.get_text()
                    return text
                except ImportError:
                    from PyPDF2 import PdfReader
                    import io
                    reader = PdfReader(io.BytesIO(content))
                    return "\n".join(page.extract_text() or "" for page in reader.pages)
            
            elif ext in ["doc", "docx"]:
                from docx import Document as DocxDocument
                import io
                doc = DocxDocument(io.BytesIO(content))
                return "\n".join(p.text for p in doc.paragraphs)
            
            else:
                return content.decode("utf-8", errors="ignore")
                
        except Exception as e:
            logger.error(f"Text extraction failed for {filename}: {e}")
            return ""
    
    async def get_status(self) -> dict:
        """Get RAG engine status"""
        await self.initialize()
        
        try:
            collection_info = self.qdrant_client.get_collection(self._collection_name)
            return {
                "initialized": self._initialized,
                "collection_name": self._collection_name,
                "points_count": collection_info.points_count,
                "status": str(collection_info.status),
                "engine": "LlamaIndex"
            }
        except Exception as e:
            return {
                "initialized": self._initialized,
                "error": str(e),
                "engine": "LlamaIndex"
            }
    
    async def recreate_collection(self) -> bool:
        """Delete and recreate the Qdrant collection"""
        try:
            # Delete existing
            try:
                self.qdrant_client.delete_collection(self._collection_name)
                logger.info(f"Deleted collection: {self._collection_name}")
            except Exception:
                pass
            
            # Recreate with new dimensions
            from qdrant_client.models import Distance, VectorParams
            
            self.qdrant_client.create_collection(
                collection_name=self._collection_name,
                vectors_config=VectorParams(
                    size=COHERE_EMBED_DIMENSION,
                    distance=Distance.COSINE
                )
            )
            
            # Reinitialize vector store and index
            self._initialized = False
            await self.initialize()
            
            logger.info(f"Recreated collection: {self._collection_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to recreate collection: {e}")
            return False

    async def get_debug_info(self) -> dict:
        """
        Get detailed debug info including sample points

        Used by /debug/qdrant endpoint for troubleshooting

        Returns:
            Dict with collection info, vector count, and sample points
        """
        await self.initialize()

        try:
            # Get collection info
            info = self.qdrant_client.get_collection(self._collection_name)

            # Get sample points
            results = self.qdrant_client.scroll(
                collection_name=self._collection_name,
                limit=3,
                with_vectors=True,
                with_payload=True
            )

            sample_points = []
            if results and results[0]:
                for point in results[0]:
                    vector_data = point.vector
                    # Handle both dict and list vector formats
                    if isinstance(vector_data, dict):
                        vector_preview = list(vector_data.values())[0][:5] if vector_data else None
                    elif isinstance(vector_data, list):
                        vector_preview = vector_data[:5]
                    else:
                        vector_preview = None

                    sample_points.append({
                        "id": str(point.id),
                        "payload": point.payload,
                        "vector_preview": vector_preview
                    })

            return {
                "collection_name": self._collection_name,
                "vectors_count": info.points_count,
                "status": info.status.value if info.status else "unknown",
                "indexed_vectors_count": info.indexed_vectors_count if hasattr(info, 'indexed_vectors_count') else None,
                "sample_points": sample_points,
                "engine": "LlamaIndex"
            }
        except Exception as e:
            logger.error(f"Debug info failed: {e}")
            return {
                "error": str(e),
                "collection_name": self._collection_name,
                "engine": "LlamaIndex"
            }


# Singleton instance
_rag_engine: Optional[LlamaIndexRAGEngine] = None


def get_rag_engine() -> LlamaIndexRAGEngine:
    """Get singleton RAG engine instance"""
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = LlamaIndexRAGEngine()
    return _rag_engine


def reset_rag_engine():
    """Reset singleton RAG engine"""
    global _rag_engine
    _rag_engine = None


# Backward compatibility alias
RAGEngine = LlamaIndexRAGEngine


# Export for compatibility with existing code
__all__ = [
    "LlamaIndexRAGEngine",
    "RAGEngine",  # Alias for backward compatibility
    "RetrievedChunk",
    "get_rag_engine",
    "reset_rag_engine",
    "COHERE_EMBED_DIMENSION"
]
