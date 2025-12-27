"""
PETTIES AGENT SERVICE - RAG Module (Full LlamaIndex)

Components:
- LlamaIndex RAG Engine: Full LlamaIndex integration for indexing and retrieval
- Cohere embed-multilingual-v3.0 for Vietnamese embeddings
- Qdrant Cloud for vector storage

Version: v2.0.0 (Full LlamaIndex)
"""

from app.core.rag.rag_engine import (
    LlamaIndexRAGEngine,
    get_rag_engine,
    reset_rag_engine,
    RetrievedChunk,
    COHERE_EMBED_DIMENSION
)

# Alias for backward compatibility
RAGEngine = LlamaIndexRAGEngine

__all__ = [
    "LlamaIndexRAGEngine",
    "RAGEngine",  # Alias
    "get_rag_engine",
    "reset_rag_engine",
    "RetrievedChunk",
    "COHERE_EMBED_DIMENSION",
]
