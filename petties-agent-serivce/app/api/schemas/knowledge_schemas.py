"""
PETTIES AGENT SERVICE - Knowledge Base API Schemas
Pydantic schemas for Document Upload and RAG Query

Package: app.api.schemas
Purpose: Knowledge Management API request/response models
Version: v1.0.0 (Updated for Cohere + Qdrant integration)

Changes from v0.0.1:
- Added qdrant_info to KnowledgeBaseStatusResponse
- Updated ProcessDocumentResponse fields
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class FileTypeEnum(str, Enum):
    """Supported file types"""
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    MD = "md"


# ===== Document Response Schemas =====

class DocumentResponse(BaseModel):
    """Single document response"""
    id: int
    filename: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    processed: bool = False
    vector_count: int = 0
    uploaded_by: Optional[str] = None
    notes: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    """List documents response"""
    total: int
    processed_count: int
    pending_count: int
    documents: List[DocumentResponse]


class DocumentDetailResponse(BaseModel):
    """Document detail with chunks preview"""
    document: DocumentResponse
    chunks_preview: List[Dict[str, Any]] = []  # First 5 chunks


# ===== Upload Schemas =====

class UploadDocumentResponse(BaseModel):
    """Response after upload"""
    success: bool
    message: str
    document_id: int
    filename: str
    file_size: int
    file_type: str
    status: str  # pending, processing, completed


class UploadErrorResponse(BaseModel):
    """Upload error response"""
    success: bool = False
    error: str
    allowed_types: List[str] = ["pdf", "docx", "txt", "md"]


# ===== Processing Schemas =====

class ProcessDocumentRequest(BaseModel):
    """Request to process document"""
    chunk_size: int = Field(500, ge=100, le=2000)
    chunk_overlap: int = Field(50, ge=0, le=200)


class ProcessDocumentResponse(BaseModel):
    """Response after processing document into vectors"""
    success: bool
    message: str
    document_id: int
    chunks_created: int
    processing_time_ms: int


# ===== RAG Query Schemas =====

class QueryKnowledgeRequest(BaseModel):
    """RAG query request"""
    query: str = Field(..., min_length=3, max_length=500)
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.5, ge=0.0, le=1.0)


class RetrievedChunk(BaseModel):
    """Single retrieved chunk"""
    document_id: int
    document_name: str
    chunk_index: int
    content: str
    score: float
    metadata: Optional[Dict[str, Any]] = None


class QueryKnowledgeResponse(BaseModel):
    """RAG query response"""
    success: bool
    query: str
    total_chunks: int
    chunks: List[RetrievedChunk]
    retrieval_time_ms: int


# ===== Delete Schemas =====

class DeleteDocumentResponse(BaseModel):
    """Response after delete"""
    success: bool
    message: str
    document_id: int
    filename: str
    vectors_deleted: int


# ===== Status Schemas =====

class KnowledgeBaseStatusResponse(BaseModel):
    """Overall knowledge base status with Qdrant info"""
    total_documents: int
    processed_documents: int
    pending_documents: int
    total_vectors: int
    storage_size_bytes: int
    last_updated: Optional[datetime] = None
    qdrant_info: Optional[Dict[str, Any]] = None  # Qdrant collection stats
