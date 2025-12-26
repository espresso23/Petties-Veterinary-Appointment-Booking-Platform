"""
PETTIES AGENT SERVICE - Knowledge Base API Routes
REST API endpoints for Document Upload and RAG Query (KB-01)

Package: app.api.routes
Purpose: Knowledge Management APIs
Version: v1.0.0 (Updated with Cohere + Qdrant integration)

Changes from v0.0.1:
- Added /documents/{id}/process endpoint for real indexing
- Implemented Qdrant integration for vector storage
- Using Cohere embed-multilingual-v3.0 for Vietnamese support
- Real RAG query with similarity search
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


def get_rag_engine():
    """Lazy import RAG engine to avoid circular imports"""
    from app.core.rag.rag_engine import get_rag_engine as _get_rag_engine
    return _get_rag_engine()


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


# ===== PROCESS DOCUMENT (INDEX TO QDRANT) =====

@router.post(
    "/documents/{document_id}/process",
    response_model=ProcessDocumentResponse,
    summary="[KB-01] Process document for RAG",
    description="""
    Process uploaded document and create vector embeddings.

    This endpoint:
    1. Reads the document file
    2. Chunks the content using LlamaIndex
    3. Creates embeddings using Cohere embed-multilingual-v3.0
    4. Stores vectors in Qdrant Cloud

    After processing, the document can be queried via RAG.
    """
)
async def process_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Process document and index to Qdrant

    Path params:
        - document_id: ID of the uploaded document

    Returns:
        - chunks_created: Number of chunks indexed
        - processing_time_ms: Time taken to process
    """
    try:
        import time
        start_time = time.time()

        # Get document from database
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

        # Allow reprocessing if document has 0 vectors (failed previous attempt)
        if document.processed and document.vector_count > 0:
            return ProcessDocumentResponse(
                success=True,
                message=f"Document '{document.filename}' already processed",
                document_id=document_id,
                chunks_created=document.vector_count,
                processing_time_ms=0
            )

        if document.processed and document.vector_count == 0:
            logger.warning(f"Document {document_id} was marked processed with 0 vectors. Reprocessing...")
            # Reset processed status for retry
            document.processed = False
            await db.commit()

        # Read file content
        file_path = document.file_path
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"Document file not found at {file_path}"
            )

        with open(file_path, "rb") as f:
            file_content = f.read()

        # Get RAG engine and index document
        rag = get_rag_engine()
        chunks_count = await rag.index_document(
            file_content=file_content,
            filename=document.filename,
            document_id=document.id,
            metadata={
                "file_type": document.file_type,
                "uploaded_by": document.uploaded_by,
                "notes": document.notes
            }
        )

        # Validate processing succeeded
        if chunks_count == 0:
            raise HTTPException(
                status_code=500,
                detail="Document processing failed: No vectors were created. This usually means the Cohere API key is missing or invalid."
            )

        # Update document status (only if vectors were created successfully)
        document.processed = True
        document.vector_count = chunks_count
        document.processed_at = datetime.utcnow()
        await db.commit()

        processing_time = int((time.time() - start_time) * 1000)

        logger.info(f"Processed document {document_id}: {chunks_count} chunks in {processing_time}ms")

        return ProcessDocumentResponse(
            success=True,
            message=f"Document '{document.filename}' processed successfully",
            document_id=document_id,
            chunks_created=chunks_count,
            processing_time_ms=processing_time
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")

        # Cleanup on failure: Delete file and database record
        # Only cleanup if document was just uploaded (processed=False, vector_count=0)
        try:
            # Try to get document from database
            result = await db.execute(
                select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            )
            doc = result.scalar_one_or_none()

            if doc and not doc.processed and doc.vector_count == 0:
                logger.warning(f"Processing failed for new document {document_id}. Cleaning up...")

                # Delete file from disk
                if doc.file_path and os.path.exists(doc.file_path):
                    os.remove(doc.file_path)
                    logger.info(f"Deleted file: {doc.file_path}")

                # Delete database record
                await db.delete(doc)
                await db.commit()
                logger.info(f"Deleted database record for document {document_id}")

        except Exception as cleanup_error:
            logger.error(f"Cleanup failed: {cleanup_error}")
            # Don't raise cleanup error, raise original error instead

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
        vectors_actually_deleted = 0

        # Delete vectors from Qdrant FIRST (most critical operation)
        # If this fails, we abort the entire delete operation
        if document.processed and vector_count > 0:
            try:
                rag = get_rag_engine()
                vectors_actually_deleted = await rag.delete_document(document_id)
                logger.info(f"Deleted {vectors_actually_deleted} vectors from Qdrant for document {document_id}")
            except Exception as e:
                # CRITICAL: If Qdrant delete fails, abort entire operation
                error_msg = f"Failed to delete vectors from Qdrant: {str(e)}. Aborting document deletion to prevent orphaned data."
                logger.error(error_msg)
                raise HTTPException(
                    status_code=500,
                    detail=error_msg
                )

        # Only proceed with file and DB deletion if Qdrant delete succeeded
        # Delete file from storage
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted file: {file_path}")

        # Delete database record
        await db.delete(document)
        await db.commit()

        logger.info(f"Deleted document: {filename} (ID: {document_id})")

        return DeleteDocumentResponse(
            success=True,
            message=f"Document '{filename}' and {vectors_actually_deleted} vectors deleted successfully",
            document_id=document_id,
            filename=filename,
            vectors_deleted=vectors_actually_deleted
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
    Test RAG retrieval query using Cohere embeddings + Qdrant.

    Admin can test what chunks are retrieved for a given query.
    This helps verify that the knowledge base is working correctly.

    Uses:
    - Cohere embed-multilingual-v3.0 for query embedding
    - Qdrant Cloud for vector similarity search
    """
)
async def query_knowledge(
    request: QueryKnowledgeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Test RAG retrieval with Qdrant + Cohere

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

        # Get RAG engine
        rag = get_rag_engine()

        # Query knowledge base using Qdrant
        results = await rag.query(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score
        )

        # Convert to response format
        chunks = [
            RetrievedChunk(
                document_id=r.document_id,
                document_name=r.document_name,
                chunk_index=r.chunk_index,
                content=r.content,
                score=r.score,
                metadata={"source": r.document_name}
            )
            for r in results
        ]

        # If no results, provide helpful message
        if not chunks:
            # Check if there are any processed documents
            result = await db.execute(
                select(func.count(KnowledgeDocument.id)).where(KnowledgeDocument.processed == True)
            )
            processed_count = result.scalar() or 0

            if processed_count == 0:
                chunks.append(RetrievedChunk(
                    document_id=0,
                    document_name="system",
                    chunk_index=0,
                    content=f"Chua co document nao duoc processed. Vui long upload va process document truoc khi query. Query: {request.query}",
                    score=0.0,
                    metadata={"type": "info"}
                ))
            else:
                chunks.append(RetrievedChunk(
                    document_id=0,
                    document_name="system",
                    chunk_index=0,
                    content=f"Khong tim thay ket qua phu hop voi min_score={request.min_score}. Thu giam min_score xuong 0.0 de xem tat ca ket qua. Neu van khong co ket qua, co the do: (1) Vector dimension mismatch - can recreate collection, (2) Query khong lien quan den noi dung document. Query: {request.query}",
                    score=0.0,
                    metadata={"type": "info", "suggestion": "Try lowering min_score to 0.0"}
                ))

        retrieval_time = int((time.time() - start_time) * 1000)

        return QueryKnowledgeResponse(
            success=True,
            query=request.query,
            total_chunks=len(chunks),
            chunks=chunks,
            retrieval_time_ms=retrieval_time
        )

    except Exception as e:
        logger.error(f"Error querying knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== RECREATE COLLECTION =====

@router.post(
    "/recreate-collection",
    summary="[Admin] Recreate Qdrant collection",
    description="""
    Manually delete and recreate the Qdrant collection with correct dimensions.

    Use this when:
    - Switching embedding models (OpenAI ↔ Cohere)
    - Fixing dimension mismatches
    - Resetting the knowledge base

    WARNING: This will delete ALL vectors. Documents in database will remain but need reprocessing.
    """
)
async def recreate_collection(db: AsyncSession = Depends(get_db)):
    """
    Delete and recreate Qdrant collection

    Returns:
        Success message with collection info
    """
    try:
        from app.core.rag.qdrant_client import get_qdrant_manager, COHERE_EMBED_DIMENSION
        from app.core.config_helper import get_setting

        # Get collection name from DB
        col_name = await get_setting("QDRANT_COLLECTION_NAME", db, "petties_knowledge_base")

        # Get Qdrant manager
        qdrant = get_qdrant_manager()

        # Delete existing collection if exists
        existing_collections = qdrant.list_collections()
        if col_name in existing_collections:
            logger.info(f"Deleting existing collection '{col_name}'")
            qdrant.delete_collection(col_name)

        # Create new collection with correct dimension
        success = qdrant.create_collection(
            collection_name=col_name,
            dimension=COHERE_EMBED_DIMENSION,
            recreate_on_mismatch=True
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create collection")

        # Reset all documents to unprocessed
        result = await db.execute(
            select(KnowledgeDocument)
        )
        documents = result.scalars().all()

        for doc in documents:
            doc.processed = False
            doc.vector_count = 0
            doc.processed_at = None

        await db.commit()

        logger.info(f"Recreated collection '{col_name}' with dimension {COHERE_EMBED_DIMENSION}")
        logger.info(f"Reset {len(documents)} documents to unprocessed")

        return {
            "success": True,
            "message": f"Collection '{col_name}' recreated successfully",
            "collection_name": col_name,
            "dimension": COHERE_EMBED_DIMENSION,
            "documents_reset": len(documents)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recreating collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== DEBUG QDRANT =====

@router.get(
    "/debug/qdrant",
    summary="[Debug] Check Qdrant collection details",
    description="Debug endpoint to verify Qdrant collection configuration and contents"
)
async def debug_qdrant(db: AsyncSession = Depends(get_db)):
    """
    Debug Qdrant collection

    Returns detailed info about:
    - Collection existence
    - Vector dimensions
    - Number of points
    - Sample points
    """
    try:
        from app.core.rag.qdrant_client import get_qdrant_manager, COHERE_EMBED_DIMENSION
        from app.core.config_helper import get_setting

        # Get collection name
        col_name = await get_setting("QDRANT_COLLECTION_NAME", db, "petties_knowledge_base")

        # Get Qdrant manager
        qdrant = get_qdrant_manager()

        # Check if collection exists
        collections = qdrant.list_collections()

        if col_name not in collections:
            return {
                "exists": False,
                "collection_name": col_name,
                "available_collections": collections,
                "message": f"Collection '{col_name}' not found"
            }

        # Get collection info
        info = qdrant.get_collection_info(col_name)

        # Try to get a sample point
        try:
            sample_results = qdrant.client.scroll(
                collection_name=col_name,
                limit=3,
                with_vectors=True  # Include vectors to verify they're stored
            )
            sample_points = [
                {
                    "id": str(point.id),
                    "payload": point.payload,
                    "vector_length": len(point.vector) if hasattr(point, 'vector') and point.vector else 0
                }
                for point in sample_results[0]
            ]
        except Exception as e:
            sample_points = []
            logger.warning(f"Could not get sample points: {e}")

        return {
            "exists": True,
            "collection_name": col_name,
            "collection_info": info,
            "expected_dimension": COHERE_EMBED_DIMENSION,
            "sample_points": sample_points,
            "message": "Collection found and accessible"
        }

    except Exception as e:
        logger.error(f"Error debugging Qdrant: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== KNOWLEDGE BASE STATUS =====

@router.get(
    "/status",
    response_model=KnowledgeBaseStatusResponse,
    summary="Get knowledge base status",
    description="Overall status of the knowledge base including Qdrant info"
)
async def get_status(
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall knowledge base status

    Returns:
    - Document counts (total, processed, pending)
    - Vector counts from Qdrant
    - Storage size
    - Embedding model info
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

        # Sum vectors from database
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

        # Get Qdrant stats if available
        qdrant_info = {}
        try:
            rag = get_rag_engine()
            qdrant_info = await rag.get_stats()
        except Exception as e:
            logger.warning(f"Could not get Qdrant stats: {e}")
            qdrant_info = {"status": "unavailable", "error": str(e)}

        return KnowledgeBaseStatusResponse(
            total_documents=total_documents,
            processed_documents=processed_documents,
            pending_documents=total_documents - processed_documents,
            total_vectors=total_vectors,
            storage_size_bytes=storage_size,
            last_updated=last_updated,
            qdrant_info=qdrant_info
        )

    except Exception as e:
        logger.error(f"Error getting knowledge base status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
