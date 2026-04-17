"""
PETTIES AGENT SERVICE - RAG Module (Full LlamaIndex)

Components:
- LlamaIndex RAG Engine: Full LlamaIndex integration for indexing and retrieval
- Cohere embed-multilingual-v3.0 for Vietnamese embeddings
- Qdrant Cloud for vector storage
- QueryExpander: LLM-based short query expansion for better recall
- CaseMemoryService: Confirmed case storage with quality-gated re-ranking
- HybridRAGEngine: Combines RAG + Case Memory with parallel search

Version: v4.0.0 (KG removed, RAG + Case Memory only)
"""

from app.core.rag.rag_engine import (
    LlamaIndexRAGEngine,
    get_rag_engine,
    reset_rag_engine,
    RetrievedChunk,
    COHERE_EMBED_DIMENSION,
)

from app.core.rag.query_expander import (
    QueryExpander,
    get_query_expander,
    reset_query_expander,
)

from app.core.rag.case_memory import (
    CaseMemoryService,
    CaseResult,
    get_case_memory_service,
    reset_case_memory_service,
    CASE_MEMORY_COLLECTION,
    CASE_MEMORY_TEXT_DIMENSION,
    CASE_MEMORY_IMAGE_DIMENSION,
)

from app.core.rag.hybrid_engine import (
    HybridRAGEngine,
    get_hybrid_rag_engine,
    reset_hybrid_rag_engine,
)

# Alias for backward compatibility
RAGEngine = LlamaIndexRAGEngine

__all__ = [
    # RAG Engine (core)
    "LlamaIndexRAGEngine",
    "RAGEngine",  # Alias
    "get_rag_engine",
    "reset_rag_engine",
    "RetrievedChunk",
    "COHERE_EMBED_DIMENSION",
    # Query Expander
    "QueryExpander",
    "get_query_expander",
    "reset_query_expander",
    # Case Memory
    "CaseMemoryService",
    "CaseResult",
    "get_case_memory_service",
    "reset_case_memory_service",
    "CASE_MEMORY_COLLECTION",
    "CASE_MEMORY_TEXT_DIMENSION",
    "CASE_MEMORY_IMAGE_DIMENSION",
    # Hybrid Engine
    "HybridRAGEngine",
    "get_hybrid_rag_engine",
    "reset_hybrid_rag_engine",
]
