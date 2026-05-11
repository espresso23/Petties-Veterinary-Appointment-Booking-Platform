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

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Query,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional, Dict, Any
from loguru import logger
from pathlib import Path
import os
import tempfile
from app.api.middleware.auth import get_admin_user
from app.api.middleware.subscription_guard import check_active_subscription
from app.config.settings import settings
from app.core.services.cloudinary_service import get_cloudinary_service

from app.api.schemas.knowledge_schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentDetailResponse,
    UploadDocumentResponse,
    ProcessDocumentResponse,
    QueryKnowledgeRequest,
    QueryKnowledgeResponse,
    RetrievedChunk,
    DeleteDocumentResponse,
    KnowledgeBaseStatusResponse,
)
from app.db.postgres.models import KnowledgeDocument
from app.db.postgres.session import get_db
from app.core.services.document_processing_service import get_document_processing_service

# Initialize router - no global auth, add individually per endpoint
router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


# Storage configuration
def _is_directory_writable(path: Path) -> bool:
    """Check whether a directory can be created and written to."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path, prefix=".write_test_", delete=True):
            pass
        return True
    except (PermissionError, OSError) as exc:
        logger.warning(f"Storage path not writable: {path} ({exc})")
        return False


def get_storage_dir() -> Path:
    """Resolve a writable storage directory for uploaded knowledge files."""
    configured_dir = Path(settings.UPLOAD_DIR)
    candidate_dirs = [
        configured_dir,
        Path("/app/uploads/documents"),
        Path("uploads/documents"),
    ]

    seen = set()
    for candidate in candidate_dirs:
        normalized = str(candidate)
        if normalized in seen:
            continue
        seen.add(normalized)

        if _is_directory_writable(candidate):
            if candidate != configured_dir:
                logger.warning(
                    f"Upload dir '{configured_dir}' is not writable. Falling back to '{candidate}'."
                )
            return candidate.resolve()

    raise RuntimeError("Khong co thu muc luu tru nao co quyen ghi cho knowledge upload")


ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB - Hỗ trợ PDF lớn (300+ trang)


def get_rag_engine():
    """Lazy import RAG engine to avoid circular imports - Full LlamaIndex"""
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
    Max file size: 50MB (phù hợp cho PDF 300+ trang)
    
    After upload, document needs to be processed to create vector embeddings.
    """,
)
async def upload_document(
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form("admin"),
    db: AsyncSession = Depends(get_db),
    _Subscription: bool = Depends(check_active_subscription),
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
                detail=f"File type '{extension}' not allowed. Allowed: {list(ALLOWED_EXTENSIONS)}",
            )

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Check file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB",
            )

        # Upload to Cloudinary
        cloudinary_service = get_cloudinary_service()
        upload_result = await cloudinary_service.upload_file(
            content, 
            filename, 
            folder="knowledge_base",
            resource_type="auto"
        )

        if not upload_result:
            raise HTTPException(
                status_code=500,
                detail="Khong the tai tai lieu len Cloudinary"
            )

        file_url = upload_result.get("secure_url")

        # Create database record
        document = KnowledgeDocument(
            filename=filename,
            file_path=file_url,  # Store Cloudinary URL instead of local path
            file_type=extension,
            file_size=file_size,
            processed=False,
            vector_count=0,
            uploaded_by=uploaded_by,
            notes=notes,
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)

        logger.info(f"Uploaded document: {filename} (ID: {document.id})")

        return UploadDocumentResponse(
            success=True,
            message=f"Tài liệu '{filename}' tải lên thành công",
            document_id=document.id,
            filename=filename,
            file_size=file_size,
            file_type=extension,
            status="pending",
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
    status_code=202,
    summary="[KB-01] Process document for RAG (Async Queue)",
    description="""
    Add uploaded document to the background processing queue for vector indexing.

    This endpoint is now ASYNCHRONOUS:
    1. Validates document existence
    2. Enqueues the document for sequential processing
    3. Returns immediately with 'queued' status

    A background worker will then:
    - Index document using LlamaIndex + Cohere
    - Store vectors in Qdrant
    """,
)
async def process_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _Subscription: bool = Depends(check_active_subscription),
):
    """
    Enqueue document for processing

    Path params:
        - document_id: ID of the uploaded document

    Returns:
        - status: 'queued'
    """
    # Get document from database to verify existence
    result = await db.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=404, detail=f"Không tìm thấy tài liệu {document_id}"
        )

    # If already processed, return success
    if document.processed and document.vector_count > 0:
        return ProcessDocumentResponse(
            success=True,
            message=f"Tài liệu '{document.filename}' đã được xử lý trước đó",
            document_id=document_id,
            status="completed",
            chunks_created=document.vector_count,
            processing_time_ms=0,
        )

    # Enqueue for background processing
    queue_service = get_document_processing_service()
    enqueued = await queue_service.enqueue_document(document_id)

    if not enqueued:
        return ProcessDocumentResponse(
            success=True,
            message=f"Tài liệu '{document.filename}' đã nằm trong hàng đợi hoặc đang xử lý",
            document_id=document_id,
            status=document.status or "queued",
        )

    return ProcessDocumentResponse(
        success=True,
        message=f"Tài liệu '{document.filename}' đã được thêm vào hàng đợi xử lý",
        document_id=document_id,
        status="queued",
    )


# ===== LIST DOCUMENTS =====


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List all documents",
    description="Get all documents in knowledge base with processing status",
)
async def list_documents(
    processed: Optional[bool] = Query(None, description="Filter by processed status"),
    file_type: Optional[str] = Query(None, description="Filter by file type"),
    db: AsyncSession = Depends(get_db),
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
            documents=[DocumentResponse.model_validate(d) for d in documents],
        )

    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GET DOCUMENT =====


@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Get document detail",
    description="Get document details with chunks preview",
)
async def get_document(document_id: int, db: AsyncSession = Depends(get_db)):
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
            raise HTTPException(
                status_code=404, detail=f"Không tìm thấy tài liệu {document_id}"
            )

        # Pending: Get chunks from Qdrant when implemented
        chunks_preview = []

        return DocumentDetailResponse(
            document=DocumentResponse.model_validate(document),
            chunks_preview=chunks_preview,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== DOWNLOAD DOCUMENT (SERVE FILE FOR PREVIEW) =====

# Content-type mapping
CONTENT_TYPE_MAP = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "md": "text/plain; charset=utf-8",
}


@router.get(
    "/documents/{document_id}/download",
    summary="Download/Preview document file",
    description="""
    Serve the original document file for preview in the frontend.
    
    Returns the raw file with appropriate content-type:
    - PDF → application/pdf (for PDF viewer)
    - DOCX → application/vnd.openxmlformats-officedocument.wordprocessingml.document
    - TXT/MD → text/plain (for text display)
    """,
)
async def download_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """
    Serve original document file for frontend preview (Cloudinary Redirect or Local File)
    """
    try:
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise HTTPException(
                status_code=404, detail=f"Khong tim thay tai lieu {document_id}"
            )

        file_url = document.file_path
        if not file_url:
            raise HTTPException(
                status_code=404,
                detail=f"Khong tim thay link tai lieu cho {document_id}",
            )

        # If it's a Cloudinary URL, redirect to it
        from fastapi.responses import RedirectResponse
        if file_url.startswith("http"):
            return RedirectResponse(url=file_url)

        # Fallback for old local files
        if not os.path.exists(file_url):
            raise HTTPException(
                status_code=404,
                detail=f"Khong tim thay file cho tai lieu {document_id}",
            )

        # Determine content type
        content_type = CONTENT_TYPE_MAP.get(
            document.file_type or "", "application/octet-stream"
        )

        return FileResponse(
            path=file_url,
            media_type=content_type,
            filename=document.filename,
            headers={
                "Content-Disposition": f'inline; filename="{document.filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== DELETE DOCUMENT =====


@router.delete(
    "/documents/{document_id}",
    response_model=DeleteDocumentResponse,
    summary="Delete document",
    description="Delete document and its vectors from knowledge base",
)
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """
    Delete document from Cloudinary and database
    """
    try:
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise HTTPException(
                status_code=404, detail=f"Khong tim thay tai lieu {document_id}"
            )

        filename = document.filename
        vector_count = document.vector_count
        file_path = document.file_path
        vectors_actually_deleted = 0

        # 1. Delete vectors from Qdrant
        if document.processed and vector_count > 0:
            try:
                rag = get_rag_engine()
                vectors_actually_deleted = await rag.delete_document(document_id)
                logger.info(f"Deleted {vectors_actually_deleted} vectors from Qdrant")
            except Exception as e:
                logger.error(f"Failed to delete vectors: {e}")

        # 2. Delete from Cloudinary if it's a URL
        if file_path and file_path.startswith("http"):
            try:
                parts = file_path.split("/")
                if "upload" in parts:
                    idx = parts.index("upload")
                    public_id_parts = parts[idx+2:] 
                    public_id_with_ext = "/".join(public_id_parts)
                    public_id = public_id_with_ext.rsplit(".", 1)[0]
                    
                    cloudinary_service = get_cloudinary_service()
                    await cloudinary_service.delete_file(public_id, resource_type="auto")
                    logger.info(f"Deleted from Cloudinary: {public_id}")
            except Exception as e:
                logger.error(f"Failed to delete from Cloudinary: {e}")

        # 3. Fallback: Delete local file if exists
        elif file_path and os.path.exists(file_path):
            os.remove(file_path)

        # 4. Delete database record
        await db.delete(document)
        await db.commit()

        return DeleteDocumentResponse(
            success=True,
            message=f"Tai lieu '{filename}' da xoa thanh cong",
            document_id=document_id,
            filename=filename,
            vectors_deleted=vectors_actually_deleted,
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
    """,
)
async def query_knowledge(
    request: QueryKnowledgeRequest,
    db: AsyncSession = Depends(get_db),
    _Subscription: bool = Depends(check_active_subscription),
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
            query=request.query, top_k=request.top_k, min_score=request.min_score
        )

        # Convert to response format
        chunks = [
            RetrievedChunk(
                document_id=r.document_id,
                document_name=r.document_name,
                chunk_index=r.chunk_index,
                content=r.content,
                score=r.score,
                metadata={"source": r.document_name},
            )
            for r in results
        ]

        # If no results, provide helpful message
        if not chunks:
            # Check if there are any processed documents
            result = await db.execute(
                select(func.count(KnowledgeDocument.id)).where(
                    KnowledgeDocument.processed
                )
            )
            processed_count = result.scalar() or 0

            if processed_count == 0:
                chunks.append(
                    RetrievedChunk(
                        document_id=0,
                        document_name="system",
                        chunk_index=0,
                        content=f"Chua co document nao duoc processed. Vui long upload va process document truoc khi query. Query: {request.query}",
                        score=0.0,
                        metadata={"type": "info"},
                    )
                )
            else:
                chunks.append(
                    RetrievedChunk(
                        document_id=0,
                        document_name="system",
                        chunk_index=0,
                        content=f"Khong tim thay ket qua phu hop voi min_score={request.min_score}. Thu giam min_score xuong 0.0 de xem tat ca ket qua. Neu van khong co ket qua, co the do: (1) Vector dimension mismatch - can recreate collection, (2) Query khong lien quan den noi dung document. Query: {request.query}",
                        score=0.0,
                        metadata={
                            "type": "info",
                            "suggestion": "Try lowering min_score to 0.0",
                        },
                    )
                )

        retrieval_time = int((time.time() - start_time) * 1000)

        return QueryKnowledgeResponse(
            success=True,
            query=request.query,
            total_chunks=len(chunks),
            chunks=chunks,
            retrieval_time_ms=retrieval_time,
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
    """,
)
async def recreate_collection(db: AsyncSession = Depends(get_db)):
    """
    Delete and recreate Qdrant collection

    Returns:
        Success message with collection info
    """
    try:
        from app.core.rag import get_rag_engine, COHERE_EMBED_DIMENSION

        # Use RAG engine to recreate collection (LlamaIndex handles Qdrant internally)
        rag = get_rag_engine()
        success = await rag.recreate_collection()

        if not success:
            raise HTTPException(status_code=500, detail="Failed to recreate collection")

        # Reset all documents to unprocessed
        result = await db.execute(select(KnowledgeDocument))
        documents = result.scalars().all()

        for doc in documents:
            doc.processed = False
            doc.status = "pending"
            doc.vector_count = 0
            doc.processed_at = None

        await db.commit()

        # Get collection info after recreation
        status = await rag.get_status()

        logger.info(f"Recreated collection with dimension {COHERE_EMBED_DIMENSION}")
        logger.info(f"Reset {len(documents)} documents to unprocessed")

        return {
            "success": True,
            "message": "Tái tạo collection thành công",
            "collection_name": status.get("collection_name"),
            "dimension": COHERE_EMBED_DIMENSION,
            "documents_reset": len(documents),
            "engine": "LlamaIndex",
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
    description="Debug endpoint to verify Qdrant collection configuration and contents",
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
        from app.core.rag import get_rag_engine, COHERE_EMBED_DIMENSION

        # Use RAG engine for debug info (LlamaIndex handles Qdrant internally)
        rag = get_rag_engine()
        debug_info = await rag.get_debug_info()

        # Check for error in debug_info
        if "error" in debug_info:
            return {
                "exists": False,
                "error": debug_info.get("error"),
                "collection_name": debug_info.get("collection_name"),
                "message": "Collection not accessible",
            }

        return {
            "exists": True,
            "collection_name": debug_info.get("collection_name"),
            "vectors_count": debug_info.get("vectors_count"),
            "status": debug_info.get("status"),
            "expected_dimension": COHERE_EMBED_DIMENSION,
            "sample_points": debug_info.get("sample_points", []),
            "engine": debug_info.get("engine"),
            "message": "Collection found and accessible",
        }

    except Exception as e:
        logger.error(f"Error debugging Qdrant: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== KNOWLEDGE BASE STATUS =====


@router.get(
    "/status",
    response_model=KnowledgeBaseStatusResponse,
    summary="Get knowledge base status",
    description="Overall status of the knowledge base including Qdrant info",
)
async def get_status(db: AsyncSession = Depends(get_db)):
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
        total_result = await db.execute(select(func.count(KnowledgeDocument.id)))
        total_documents = total_result.scalar() or 0

        # Count processed
        processed_result = await db.execute(
            select(func.count(KnowledgeDocument.id)).where(
                KnowledgeDocument.processed
            )
        )
        processed_documents = processed_result.scalar() or 0

        # Sum text vectors from database
        vectors_result = await db.execute(
            select(func.sum(KnowledgeDocument.vector_count))
        )
        total_vectors = vectors_result.scalar() or 0

        # Sum file sizes
        size_result = await db.execute(select(func.sum(KnowledgeDocument.file_size)))
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
            qdrant_info = await rag.get_status()
        except Exception as e:
            logger.warning(f"Could not get Qdrant status: {e}")
            qdrant_info = {"status": "unavailable", "error": str(e)}

        return KnowledgeBaseStatusResponse(
            total_documents=total_documents,
            processed_documents=processed_documents,
            pending_documents=total_documents - processed_documents,
            total_vectors=total_vectors,
            storage_size_bytes=storage_size,
            last_updated=last_updated,
            qdrant_info=qdrant_info,
        )

    except Exception as e:
        logger.error(f"Error getting knowledge base status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# CASE MEMORY ENDPOINTS  [KB-05]
# =============================================================


def get_cm_service():
    """Lazy import CaseMemoryService to avoid circular imports."""
    from app.core.rag.case_memory import get_case_memory_service

    return get_case_memory_service()


@router.get(
    "/case-memory/stats",
    summary="[KB-05] Thống kê Case Memory",
    description="Thông tin về Qdrant collection `petties_case_memory`: số cases, status.",
)
async def get_case_memory_stats():
    """Get Case Memory collection statistics."""
    try:
        cm = get_cm_service()
        stats = await cm.get_stats()
        return {"success": True, **stats}
    except Exception as e:
        logger.error(f"Error getting Case Memory stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/case-memory/prune",
    summary="[KB-05] Dọn dẹp Case Memory",
    description="""
    Xóa các cases cũ theo tuổi dữ liệu để giữ collection sạch.

    Chỉ xóa cases cũ hơn `older_than_days` ngày.
    """,
)
async def prune_case_memory(
    older_than_days: int = Query(
        default=90, ge=1, le=365, description="Chỉ xóa cases cũ hơn X ngày"
    ),
):
    """Prune stale cases from Case Memory."""
    try:
        cm = get_cm_service()
        pruned_count = await cm.prune_low_score_cases(older_than_days=older_than_days)
        return {
            "success": True,
            "message": f"Đã xóa {pruned_count} cases cũ",
            "pruned_count": pruned_count,
            "criteria": {
                "older_than_days": older_than_days,
            },
        }
    except Exception as e:
        logger.error(f"Error pruning Case Memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/case-memory",
    summary="[KB-05] Danh sách Cases",
    description="Lấy danh sách cases với pagination và filters (species, diagnosis, query)",
)
async def list_case_memory(
    query: Optional[str] = Query(
        default=None, description="Tìm kiếm trong nội dung case"
    ),
    species: Optional[str] = Query(
        default=None, description="Lọc theo loài (dog, cat, other)"
    ),
    diagnosis: Optional[str] = Query(
        default=None, description="Lọc theo từ khóa chẩn đoán"
    ),
    page: int = Query(default=1, ge=1, description="Số trang"),
    page_size: int = Query(default=20, ge=1, le=100, description="Số items mỗi trang"),
    _: dict = Depends(get_admin_user),
):
    """List cases with pagination and filters."""
    try:
        cm = get_cm_service()
        result = await cm.list_cases(
            query=query,
            species=species,
            diagnosis=diagnosis,
            page=page,
            page_size=page_size,
        )
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Error listing Case Memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/case-memory/{case_id}",
    summary="[KB-05] Chi tiết Case",
    description="Lấy chi tiết một case theo ID",
)
async def get_case_memory(
    case_id: str,
    _: dict = Depends(get_admin_user),
):
    """Get case detail by ID."""
    try:
        cm = get_cm_service()
        case = await cm.get_case(case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy case")
        return {"success": True, "case": case}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Case Memory {case_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/case-memory/{case_id}",
    summary="[KB-05] Xóa Case",
    description="Xóa một case khỏi Case Memory",
)
async def delete_case_memory(
    case_id: str,
    _: dict = Depends(get_admin_user),
):
    """Delete a case from Case Memory."""
    try:
        cm = get_cm_service()
        success = await cm.delete_case(case_id)
        if not success:
            raise HTTPException(
                status_code=404, detail="Không tìm thấy case hoặc xóa thất bại"
            )
        return {"success": True, "message": "Xóa case thành công"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting Case Memory {case_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/case-memory/sync-emr-confirmed",
    summary="[KB-05] Đồng bộ EMR confirmed vào Case Memory",
    description=(
        "Gọi Spring internal endpoint để lấy EMR confirmed và upsert vào Case Memory. "
        "Chỉ dành cho admin hoặc job vận hành nội bộ."
    ),
)
async def sync_emr_confirmed_into_case_memory(
    limit: int = Query(default=50, ge=1, le=200, description="Số EMR tối đa mỗi batch"),
    cursor: Optional[str] = Query(default=None, description="Cursor của batch trước"),
    updated_from: Optional[str] = Query(
        default=None, description="ISO datetime bắt đầu"
    ),
    updated_to: Optional[str] = Query(
        default=None, description="ISO datetime kết thúc"
    ),
    _: dict = Depends(get_admin_user),
):
    """Manually sync confirmed EMR records into Case Memory."""
    raise HTTPException(
        status_code=410,
        detail="Endpoint này đã ngưng sử dụng. Spring Boot sẽ push trực tiếp EMR sang AI service.",
    )


# ===== DISEASE CATALOG MONITORING APIs (NEW) =====


@router.get(
    "/disease-catalog/stats",
    summary="[DC-01] Disease Catalog Statistics",
    description="Thống kê disease catalog: tổng số bệnh, aliases, learning progress.",
)
async def get_disease_catalog_stats(
    _: dict = Depends(get_admin_user),
):
    """Get disease catalog statistics for admin monitoring."""
    try:
        from app.core.services.disease_mapping_service import (
            get_disease_mapping_service,
        )
        from app.core.services.disease_taxonomy_service import (
            get_disease_taxonomy_service,
        )

        mapper = get_disease_mapping_service()
        taxonomy = get_disease_taxonomy_service()

        # Get DB-backed catalog stats
        await mapper.refresh_from_db(force=True)

        catalog_count = len(mapper._catalog)
        alias_count = len(mapper._aliases)
        taxonomy_stats_data = taxonomy.get_taxonomy_stats()

        return {
            "success": True,
            "catalog": {
                "total_diseases": catalog_count,
                "total_aliases": alias_count,
            },
            "taxonomy": taxonomy_stats_data,
        }
    except Exception as e:
        logger.error(f"Error getting disease catalog stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/disease-catalog",
    summary="[DC-02] Disease Catalog List",
    description="Danh sách diseases với filters (species, system).",
)
async def list_disease_catalog(
    species: Optional[str] = Query(
        default=None, description="Lọc theo loài (dog, cat)"
    ),
    system: Optional[str] = Query(default=None, description="Lọc theo hệ cơ quan"),
    page: int = Query(default=1, ge=1, description="Số trang"),
    page_size: int = Query(default=50, ge=1, le=200, description="Số items mỗi trang"),
    _: dict = Depends(get_admin_user),
):
    """List diseases with pagination and filters."""
    try:
        from app.core.services.disease_mapping_service import (
            get_disease_mapping_service,
        )
        from app.core.services.disease_taxonomy_service import (
            get_disease_taxonomy_service,
        )

        mapper = get_disease_mapping_service()
        taxonomy = get_disease_taxonomy_service()

        await mapper.refresh_from_db(force=True)

        # Build runtime (self-learning) disease list from DB catalog + aliases.
        species_filter = (species or "").strip().lower()
        system_filter = (system or "").strip()

        alias_map: Dict[str, List[str]] = {}
        for alias_entry in mapper._alias_entries:
            alias_map.setdefault(alias_entry.canonical_code, []).append(
                alias_entry.alias_text
            )

        taxonomy_index: Dict[str, Dict[str, str]] = {}
        for item in taxonomy.list_diseases():
            taxonomy_index[item.canonical_code] = {
                "system": item.system,
                "subsystem": item.subsystem,
            }

        all_diseases: List[Dict[str, Any]] = []
        for code, catalog_entry in mapper._catalog.items():
            entry_species = (catalog_entry.species or "all").strip().lower()
            species_list = ["dog", "cat"] if entry_species == "all" else [entry_species]

            if species_filter and species_filter not in species_list:
                continue

            taxonomy_info = taxonomy_index.get(code, {})
            system_name = taxonomy_info.get("system", "Khác")
            subsystem_name = taxonomy_info.get("subsystem", "Không phân loại")

            if system_filter and system_name != system_filter:
                continue

            aliases = alias_map.get(code, [])
            dedup_aliases = sorted({a.strip() for a in aliases if str(a or "").strip()})

            all_diseases.append(
                {
                    "canonical_code": code,
                    "display_name_vi": catalog_entry.display_name_vi,
                    "system": system_name,
                    "subsystem": subsystem_name,
                    "aliases": dedup_aliases,
                    "species": species_list,
                }
            )

        all_diseases.sort(key=lambda item: item["display_name_vi"].lower())

        # Pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_diseases = all_diseases[start_idx:end_idx]

        return {
            "success": True,
            "items": paginated_diseases,
            "total": len(all_diseases),
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        logger.error(f"Error listing disease catalog: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/learning-metrics",
    summary="[DC-03] Learning Metrics",
    description="Metrics về self-learning: mapped rate, catalog growth.",
)
async def get_learning_metrics(
    _: dict = Depends(get_admin_user),
):
    """Get learning metrics for admin monitoring."""
    try:
        from app.core.services.disease_mapping_service import (
            get_disease_mapping_service,
        )
        from app.core.services.disease_taxonomy_service import (
            get_disease_taxonomy_service,
        )
        from app.core.rag.case_memory import get_case_memory_service

        mapper = get_disease_mapping_service()
        taxonomy = get_disease_taxonomy_service()
        case_memory = get_case_memory_service()

        await mapper.refresh_from_db(force=True)

        # Get case memory stats
        cm_stats = await case_memory.get_stats()

        # Get taxonomy stats
        taxonomy_stats = taxonomy.get_taxonomy_stats()

        return {
            "success": True,
            "catalog": {
                "total_diseases": len(mapper._catalog),
                "total_aliases": len(mapper._aliases),
            },
            "taxonomy": taxonomy_stats,
            "case_memory": {
                "total_cases": cm_stats.get("points_count", 0),
                "collection_name": cm_stats.get("collection", ""),
            },
            "learning_status": "active" if len(mapper._catalog) > 4 else "initializing",
        }
    except Exception as e:
        logger.error(f"Error getting learning metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
