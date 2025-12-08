"""
PETTIES AGENT SERVICE - Knowledge Base API Routes
REST API endpoints for Document Upload and RAG Query (KB-01)

Package: app.api.routes
Purpose: Knowledge Management APIs
Version: v0.0.1
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from loguru import logger
from pathlib import Path
import os
import shutil
from datetime import datetime

from app.api.schemas.knowledge_schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentDetailResponse,
    UploadDocumentResponse,
    UploadErrorResponse,
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    QueryKnowledgeRequest,
    QueryKnowledgeResponse,
    RetrievedChunk,
    DeleteDocumentResponse,
    KnowledgeBaseStatusResponse
)
from app.db.postgres.models import KnowledgeDocument
from app.db.postgres.session import get_db

# Initialize router
router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])

# Storage configuration
STORAGE_DIR = Path("storage/documents")
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


# ===== UPLOAD DOCUMENT =====

@router.post(
    "/upload",
    response_model=UploadDocumentResponse,
    summary="[KB-01] Upload document for RAG",
    description="""
    Upload a document to the knowledge base.
    
    Supported formats: PDF, DOCX, TXT, MD
    Max file size: 10MB
    
    After upload, document needs to be processed to create vector embeddings.
    """
)
async def upload_document(
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form("admin"),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload document to knowledge base

    Form Data:
        - file: Document file (PDF, DOCX, TXT, MD)
        - notes: Optional notes about the document
        - uploaded_by: Admin username
    """
    try:
        # Validate file extension
        filename = file.filename or "unknown"
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{extension}' not allowed. Allowed: {list(ALLOWED_EXTENSIONS)}"
            )
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Check file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Create storage directory if not exists
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{filename}"
        file_path = STORAGE_DIR / safe_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Create database record
        document = KnowledgeDocument(
            filename=filename,
            file_path=str(file_path),
            file_type=extension,
            file_size=file_size,
            processed=False,
            vector_count=0,
            uploaded_by=uploaded_by,
            notes=notes
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        logger.info(f"Uploaded document: {filename} (ID: {document.id})")
        
        return UploadDocumentResponse(
            success=True,
            message=f"Document '{filename}' uploaded successfully",
            document_id=document.id,
            filename=filename,
            file_size=file_size,
            file_type=extension,
            status="pending"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== LIST DOCUMENTS =====

@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List all documents",
    description="Get all documents in knowledge base with processing status"
)
async def list_documents(
    processed: Optional[bool] = Query(None, description="Filter by processed status"),
    file_type: Optional[str] = Query(None, description="Filter by file type"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all documents in knowledge base

    Query params:
        - processed: true/false
        - file_type: pdf/docx/txt/md
    """
    try:
        query = select(KnowledgeDocument)
        
        if processed is not None:
            query = query.where(KnowledgeDocument.processed == processed)
        
        if file_type:
            query = query.where(KnowledgeDocument.file_type == file_type)
        
        result = await db.execute(query)
        documents = result.scalars().all()
        
        # Count processed vs pending
        processed_count = sum(1 for d in documents if d.processed)
        pending_count = len(documents) - processed_count
        
        return DocumentListResponse(
            total=len(documents),
            processed_count=processed_count,
            pending_count=pending_count,
            documents=[DocumentResponse.model_validate(d) for d in documents]
        )
    
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GET DOCUMENT =====

@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Get document detail",
    description="Get document details with chunks preview"
)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get document detail with:
    - Document metadata
    - First 5 chunks preview (if processed)
    """
    try:
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        # TODO: Get chunks from Qdrant when implemented
        chunks_preview = []
        
        return DocumentDetailResponse(
            document=DocumentResponse.model_validate(document),
            chunks_preview=chunks_preview
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== DELETE DOCUMENT =====

@router.delete(
    "/documents/{document_id}",
    response_model=DeleteDocumentResponse,
    summary="Delete document",
    description="Delete document and its vectors from knowledge base"
)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete document:
    1. Remove file from storage
    2. Remove vectors from Qdrant (when implemented)
    3. Remove database record
    """
    try:
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        
        filename = document.filename
        vector_count = document.vector_count
        file_path = document.file_path
        
        # Delete file if exists
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted file: {file_path}")
        
        # TODO: Delete vectors from Qdrant when implemented
        
        # Delete database record
        await db.delete(document)
        await db.commit()
        
        logger.info(f"Deleted document: {filename} (ID: {document_id})")
        
        return DeleteDocumentResponse(
            success=True,
            message=f"Document '{filename}' deleted successfully",
            document_id=document_id,
            filename=filename,
            vectors_deleted=vector_count
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== QUERY KNOWLEDGE BASE =====

@router.post(
    "/query",
    response_model=QueryKnowledgeResponse,
    summary="[KB-01] Test RAG retrieval",
    description="""
    Test RAG retrieval query.
    
    Admin can test what chunks are retrieved for a given query.
    This helps verify that the knowledge base is working correctly.
    
    NOTE: Returns placeholder data until Qdrant is integrated.
    """
)
async def query_knowledge(
    request: QueryKnowledgeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Test RAG retrieval

    Body:
        {
            "query": "Trieu chung cho bi non?",
            "top_k": 5,
            "min_score": 0.5
        }
    
    Response includes:
        - Retrieved chunks with relevance scores
        - Source document info
        - Retrieval time
    """
    try:
        import time
        start_time = time.time()
        
        # TODO: Implement actual Qdrant retrieval
        # For now, return placeholder response
        
        # Get some documents for placeholder
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.processed == True).limit(3)
        )
        documents = result.scalars().all()
        
        # Create placeholder chunks
        placeholder_chunks = []
        for i, doc in enumerate(documents):
            placeholder_chunks.append(RetrievedChunk(
                document_id=doc.id,
                document_name=doc.filename,
                chunk_index=0,
                content=f"[Placeholder] This is a sample chunk from {doc.filename}. Actual content will be retrieved from Qdrant when integrated.",
                score=0.95 - (i * 0.1),
                metadata={"file_type": doc.file_type}
            ))
        
        # If no processed documents, add demo chunk
        if not placeholder_chunks:
            placeholder_chunks.append(RetrievedChunk(
                document_id=0,
                document_name="demo.txt",
                chunk_index=0,
                content=f"[Placeholder] No processed documents yet. Upload and process documents to see actual retrieval results. Query was: {request.query}",
                score=0.85,
                metadata={"demo": True}
            ))
        
        retrieval_time = int((time.time() - start_time) * 1000)
        
        return QueryKnowledgeResponse(
            success=True,
            query=request.query,
            total_chunks=len(placeholder_chunks),
            chunks=placeholder_chunks[:request.top_k],
            retrieval_time_ms=retrieval_time
        )
    
    except Exception as e:
        logger.error(f"Error querying knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== KNOWLEDGE BASE STATUS =====

@router.get(
    "/status",
    response_model=KnowledgeBaseStatusResponse,
    summary="Get knowledge base status",
    description="Overall status of the knowledge base"
)
async def get_status(
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall knowledge base status
    """
    try:
        # Count documents
        total_result = await db.execute(
            select(func.count(KnowledgeDocument.id))
        )
        total_documents = total_result.scalar() or 0
        
        # Count processed
        processed_result = await db.execute(
            select(func.count(KnowledgeDocument.id)).where(KnowledgeDocument.processed == True)
        )
        processed_documents = processed_result.scalar() or 0
        
        # Sum vectors
        vectors_result = await db.execute(
            select(func.sum(KnowledgeDocument.vector_count))
        )
        total_vectors = vectors_result.scalar() or 0
        
        # Sum file sizes
        size_result = await db.execute(
            select(func.sum(KnowledgeDocument.file_size))
        )
        storage_size = size_result.scalar() or 0
        
        # Get last updated
        last_result = await db.execute(
            select(KnowledgeDocument.uploaded_at)
            .order_by(KnowledgeDocument.uploaded_at.desc())
            .limit(1)
        )
        last_updated = last_result.scalar()
        
        return KnowledgeBaseStatusResponse(
            total_documents=total_documents,
            processed_documents=processed_documents,
            pending_documents=total_documents - processed_documents,
            total_vectors=total_vectors,
            storage_size_bytes=storage_size,
            last_updated=last_updated
        )
    
    except Exception as e:
        logger.error(f"Error getting knowledge base status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
