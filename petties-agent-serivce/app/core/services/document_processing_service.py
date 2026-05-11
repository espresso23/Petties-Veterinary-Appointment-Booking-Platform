"""
Document Processing Service - Async Task Queue for Indexing.

Purpose:
- Sequential processing of uploaded documents to avoid Qdrant/LLM conflicts.
- Real-time status tracking for large batch uploads.
"""

import asyncio
import os
import time
from pathlib import Path
from typing import Optional, Set

from loguru import logger
from sqlalchemy import select

from app.db.postgres.models import KnowledgeDocument
from app.db.postgres.session import AsyncSessionLocal

def file_url_masked(url: str) -> str:
    """Mask sensitive parts of URL for logging"""
    if not url or "http" not in url:
        return url
    try:
        # Keep only domain and last part of path
        parts = url.split("/")
        if len(parts) > 4:
            return f"{parts[0]}//{parts[2]}/.../{parts[-1]}"
    except:
        pass
    return url[:30] + "..."


class DocumentProcessingService:
    """Singleton service for sequential document indexing via Task Queue."""

    _instance: Optional["DocumentProcessingService"] = None
    _queue: asyncio.Queue[int] = asyncio.Queue()
    _processing_set: Set[int] = set()  # Track IDs currently in queue or processing

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DocumentProcessingService, cls).__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls) -> "DocumentProcessingService":
        if cls._instance is None:
            cls._instance = DocumentProcessingService()
        return cls._instance

    async def enqueue_document(self, document_id: int) -> bool:
        """Add a document to the processing queue."""
        if document_id in self._processing_set:
            logger.info(f"Document {document_id} is already queued or processing")
            return False

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return False

            # Update status to queued
            doc.status = "queued"
            await db.commit()

        self._processing_set.add(document_id)
        await self._queue.put(document_id)
        logger.info(f"Enqueued document {document_id} for processing")
        return True

    async def worker(self):
        """Infinite loop worker that processes one document at a time."""
        logger.info("Document Processing Worker started")
        try:
            while True:
                document_id = await self._queue.get()
                try:
                    await self._process_single_document(document_id)
                    # Add a small cool-down period between documents to avoid hitting rate limits
                    await asyncio.sleep(2)
                except Exception as e:
                    logger.error(f"Worker failed processing document {document_id}: {e}")
                finally:
                    self._queue.task_done()
                    if document_id in self._processing_set:
                        self._processing_set.remove(document_id)
        except asyncio.CancelledError:
            logger.info("Document Processing Worker cancelled")

    async def _process_single_document(self, document_id: int):
        """Core indexing logic with retry mechanism for rate limits."""
        max_retries = 3
        retry_delay = 5  # seconds
        
        for attempt in range(max_retries + 1):
            start_time = time.time()
            logger.info(f"Starting background processing for document {document_id} (Attempt {attempt + 1})")

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
                )
                doc = result.scalar_one_or_none()

                if not doc:
                    return

                # Update status to processing
                doc.status = "processing"
                await db.commit()

                try:
                    # Lazy import RAG engine
                    from app.core.rag.rag_engine import get_rag_engine
                    rag = get_rag_engine()

                    file_path_str = doc.file_path
                    is_url = file_path_str.startswith("http")
                    temp_file_path = None

                    if is_url:
                        # Download file from URL to temporary location
                        import httpx
                        import tempfile
                        
                        logger.info(f"Downloading document from URL: {file_url_masked(file_path_str)}")
                        suffix = f".{doc.file_type}" if doc.file_type else ""
                        
                        fd, temp_file_path = tempfile.mkstemp(suffix=suffix)
                        os.close(fd)
                        
                        async with httpx.AsyncClient() as client:
                            response = await client.get(file_path_str)
                            response.raise_for_status()
                            with open(temp_file_path, "wb") as f:
                                f.write(response.content)
                        
                        file_path = Path(temp_file_path)
                    else:
                        file_path = Path(file_path_str)
                        if not file_path.exists():
                            raise FileNotFoundError(f"File not found: {file_path}")

                    # Execute Indexing
                    index_result = await rag.index_document(
                        file_path=file_path,
                        filename=doc.filename,
                        document_id=doc.id,
                        metadata={
                            "file_type": doc.file_type,
                            "uploaded_by": doc.uploaded_by,
                            "notes": doc.notes,
                        },
                    )

                    # Cleanup temp file if created
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.remove(temp_file_path)

                    # Validate
                    if index_result.text_chunks == 0:
                        raise RuntimeError("No chunks created. Check API keys or file content.")

                    # Success Update
                    doc.processed = True
                    doc.status = "completed"
                    doc.vector_count = index_result.text_chunks
                    from datetime import datetime, timezone
                    doc.processed_at = datetime.now(timezone.utc)
                    
                    processing_time = int((time.time() - start_time) * 1000)
                    logger.info(f"Background process success for {doc.filename}: {doc.vector_count} chunks in {processing_time}ms")
                    await db.commit()
                    return # SUCCESS - exit attempt loop

                except Exception as e:
                    error_msg = str(e).lower()
                    
                    # Handle Rate Limit (429) specifically
                    if "429" in error_msg or "too many requests" in error_msg:
                        if attempt < max_retries:
                            wait_time = retry_delay * (2 ** attempt) # Exponential backoff: 5, 10, 20...
                            logger.warning(f"Rate limit hit for document {document_id}. Waiting {wait_time}s before retry...")
                            doc.status = "queued" # Set back to queued while waiting
                            await db.commit()
                            await asyncio.sleep(wait_time)
                            continue # Try next attempt
                    
                    # Auto-retry logic for specific Qdrant errors
                    if "text-sparse-new" in error_msg or ("vector" in error_msg and "not existing" in error_msg):
                        try:
                            logger.warning("Vector mismatch detected in worker, recreating collection...")
                            from app.core.rag.rag_engine import get_rag_engine
                            rag = get_rag_engine()
                            await rag.recreate_collection()
                            # Re-run same attempt (immediately) or let loop handle it? 
                            # Better to continue loop and let it retry with fresh collection
                            continue 
                        except Exception as retry_err:
                            logger.error(f"Failed to recreate collection: {retry_err}")

                    # Final failure for this document
                    doc.status = "failed"
                    doc.notes = f"{doc.notes or ''} [Error: {e}]".strip()
                    await db.commit()
                    logger.error(f"Background indexing failed for {document_id}: {e}")
                    return # Give up after failure or all retries


def get_document_processing_service() -> DocumentProcessingService:
    return DocumentProcessingService.get_instance()
