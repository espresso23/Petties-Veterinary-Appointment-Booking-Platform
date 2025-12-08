"""
PETTIES AGENT SERVICE - Document Processor

Uses LlamaIndex for document parsing, chunking, and embedding.
Supports PDF, DOCX, TXT files.
"""

from llama_index.core import Document, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from typing import List, Optional
import logging
import io

from app.config.settings import settings

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """
    Document processing pipeline using LlamaIndex
    
    Usage:
        processor = DocumentProcessor()
        chunks = processor.process_file(file_bytes, "doc.pdf")
        embeddings = processor.embed_chunks(chunks)
    """
    
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = SentenceSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        self.embeddings = self._get_embeddings()
    
    def _get_embeddings(self) -> OpenAIEmbedding:
        """Get embedding model"""
        return OpenAIEmbedding(
            api_key=settings.OPENAI_API_KEY,
            model="text-embedding-ada-002"
        )
    
    def process_file(
        self,
        file_content: bytes,
        filename: str,
        metadata: Optional[dict] = None
    ) -> List[dict]:
        """
        Process file into chunks
        
        Args:
            file_content: Raw file bytes
            filename: Original filename
            metadata: Additional metadata
            
        Returns:
            List of chunk dicts with text and metadata
        """
        # Detect file type
        ext = filename.lower().split('.')[-1]
        
        text = self._extract_text(file_content, ext)
        if not text:
            logger.warning(f"No text extracted from {filename}")
            return []
        
        # Create LlamaIndex document
        doc = Document(
            text=text,
            metadata={
                "filename": filename,
                "file_type": ext,
                **(metadata or {})
            }
        )
        
        # Split into nodes/chunks
        nodes = self.splitter.get_nodes_from_documents([doc])
        
        chunks = []
        for i, node in enumerate(nodes):
            chunks.append({
                "chunk_index": i,
                "content": node.text,
                "metadata": {
                    **node.metadata,
                    "chunk_index": i,
                    "total_chunks": len(nodes)
                }
            })
        
        logger.info(f"Processed {filename}: {len(chunks)} chunks")
        return chunks
    
    def _extract_text(self, content: bytes, ext: str) -> str:
        """Extract text from file based on extension"""
        try:
            if ext == "txt":
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
                    logger.warning("PyMuPDF not installed, trying pypdf")
                    from pypdf import PdfReader
                    reader = PdfReader(io.BytesIO(content))
                    return "\n".join(page.extract_text() or "" for page in reader.pages)
            
            elif ext in ["doc", "docx"]:
                from docx import Document as DocxDocument
                doc = DocxDocument(io.BytesIO(content))
                return "\n".join(p.text for p in doc.paragraphs)
            
            else:
                # Try as plain text
                return content.decode("utf-8", errors="ignore")
                
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return ""
    
    async def embed_chunks(self, chunks: List[dict]) -> List[List[float]]:
        """
        Generate embeddings for chunks
        
        Args:
            chunks: List of chunk dicts with 'content' key
            
        Returns:
            List of embedding vectors
        """
        texts = [c["content"] for c in chunks]
        
        # LlamaIndex embedding with batching
        embeddings = []
        batch_size = 100
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = await self.embeddings.aget_text_embedding_batch(batch)
            embeddings.extend(batch_embeddings)
        
        logger.info(f"Generated {len(embeddings)} embeddings")
        return embeddings
    
    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a query"""
        return await self.embeddings.aget_query_embedding(query)
