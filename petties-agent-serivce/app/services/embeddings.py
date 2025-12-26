"""
PETTIES AGENT SERVICE - Embeddings Service

Cohere Embeddings cho RAG pipeline.
Su dung embed-multilingual-v3.0 cho Vietnamese + English support.

Package: app.services
Purpose: Vector embeddings cho RAG (Retrieval-Augmented Generation)
Version: v1.0.0

Models:
- embed-multilingual-v3.0: 1024 dimensions, multilingual (Vietnamese + English)
- embed-english-v3.0: 1024 dimensions, English only (backup)

Reference: https://docs.cohere.com/docs/embeddings
"""

from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
import httpx
from loguru import logger
from pydantic import BaseModel


# ============================================================
# CONFIG MODELS
# ============================================================

class EmbeddingConfig(BaseModel):
    """Configuration cho Embedding client"""
    provider: str = "cohere"  # cohere | openai
    model: str = "embed-multilingual-v3.0"
    api_key: Optional[str] = None
    dimension: int = 1024  # Cohere v3 = 1024 dimensions


class EmbeddingResult(BaseModel):
    """Result tu Embedding request"""
    embeddings: List[List[float]]
    model: str
    usage: Optional[Dict[str, int]] = None


# ============================================================
# BASE CLASS
# ============================================================

class BaseEmbeddingClient(ABC):
    """Abstract base class cho Embedding clients"""

    def __init__(self, config: EmbeddingConfig):
        self.config = config

    @abstractmethod
    async def embed_documents(self, texts: List[str]) -> EmbeddingResult:
        """Embed multiple documents"""
        pass

    @abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """Embed single query"""
        pass


# ============================================================
# COHERE EMBEDDINGS (RECOMMENDED)
# ============================================================

class CohereEmbeddings(BaseEmbeddingClient):
    """
    Cohere Embeddings Client

    Su dung embed-multilingual-v3.0 cho:
    - Vietnamese support tot
    - 1024 dimensions
    - Toi uu cho RAG (search_document, search_query input types)

    Usage:
        ```python
        client = CohereEmbeddings(EmbeddingConfig(
            api_key="your-cohere-api-key"
        ))

        # Embed documents (for indexing)
        docs = ["Con cho bi sot", "Meo hay non mua"]
        result = await client.embed_documents(docs)

        # Embed query (for searching)
        query_embedding = await client.embed_query("thu cung bi sot phai lam gi?")
        ```

    Reference: https://docs.cohere.com/reference/embed
    """

    BASE_URL = "https://api.cohere.ai/v1"

    def __init__(self, config: EmbeddingConfig):
        super().__init__(config)

        if not config.api_key:
            raise ValueError("Cohere API key is required")

        self.api_key = config.api_key
        self.model = config.model

        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=httpx.Timeout(120.0, connect=30.0),  # Longer timeout for cold start
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )

        logger.info(f"CohereEmbeddings initialized: {config.model}")

    async def embed_documents(self, texts: List[str]) -> EmbeddingResult:
        """
        Embed multiple documents for indexing

        Args:
            texts: List of text documents

        Returns:
            EmbeddingResult voi list embeddings

        Note:
            - Su dung input_type="search_document" cho documents
            - Max 96 texts per request
        """
        if not texts:
            return EmbeddingResult(embeddings=[], model=self.model)

        # Cohere limit: 96 texts per request
        # Chunk if needed
        all_embeddings = []
        batch_size = 96

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            payload = {
                "model": self.model,
                "texts": batch,
                "input_type": "search_document",  # For indexing
                "truncate": "END"  # Truncate long texts at the end
            }

            # Retry logic for cold start issues
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = await self.client.post("/embed", json=payload)
                    response.raise_for_status()
                    data = response.json()

                    embeddings = data.get("embeddings", [])
                    all_embeddings.extend(embeddings)
                    break  # Success, exit retry loop

                except (httpx.ConnectError, httpx.TimeoutException) as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Cohere connection attempt {attempt + 1} failed: {e}. Retrying...")
                        import asyncio
                        await asyncio.sleep(1)  # Wait before retry
                        continue
                    logger.error(f"Cohere embed failed after {max_retries} attempts: {e}")
                    raise

                except httpx.HTTPError as e:
                    logger.error(f"Cohere embed error: {e}")
                    raise

        return EmbeddingResult(
            embeddings=all_embeddings,
            model=self.model,
            usage={"total_texts": len(texts)}
        )

    async def embed_query(self, text: str) -> List[float]:
        """
        Embed single query for searching

        Args:
            text: Query text

        Returns:
            Embedding vector (List[float])

        Note:
            - Su dung input_type="search_query" cho queries
            - Optimized cho semantic search
        """
        payload = {
            "model": self.model,
            "texts": [text],
            "input_type": "search_query",  # For searching
            "truncate": "END"
        }

        # Retry logic for cold start issues (same as embed_documents)
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = await self.client.post("/embed", json=payload)
                response.raise_for_status()
                data = response.json()

                embeddings = data.get("embeddings", [])
                if embeddings:
                    return embeddings[0]
                return []

            except (httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Cohere query embed attempt {attempt + 1} failed: {e}. Retrying...")
                    import asyncio
                    await asyncio.sleep(1)  # Wait before retry
                    continue
                logger.error(f"Cohere embed query failed after {max_retries} attempts: {e}")
                raise

            except httpx.HTTPError as e:
                logger.error(f"Cohere embed query error: {e}")
                raise
        
        return []  # Fallback

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test Cohere connection

        Returns:
            Dict voi status va model info
        """
        try:
            # Test with simple embed
            embedding = await self.embed_query("test")
            return {
                "status": "success",
                "model": self.model,
                "dimension": len(embedding)
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }


# ============================================================
# OPENAI EMBEDDINGS (FALLBACK)
# ============================================================

class OpenAIEmbeddings(BaseEmbeddingClient):
    """
    OpenAI Embeddings Client (Fallback)

    Su dung text-embedding-3-small cho:
    - 1536 dimensions
    - Good quality embeddings

    Note: Khong tot cho Vietnamese bang Cohere multilingual
    """

    BASE_URL = "https://api.openai.com/v1"

    def __init__(self, config: EmbeddingConfig):
        super().__init__(config)

        if not config.api_key:
            raise ValueError("OpenAI API key is required")

        self.api_key = config.api_key
        self.model = config.model or "text-embedding-3-small"

        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )

        logger.info(f"OpenAIEmbeddings initialized: {self.model}")

    async def embed_documents(self, texts: List[str]) -> EmbeddingResult:
        """Embed multiple documents"""
        if not texts:
            return EmbeddingResult(embeddings=[], model=self.model)

        payload = {
            "model": self.model,
            "input": texts
        }

        try:
            response = await self.client.post("/embeddings", json=payload)
            response.raise_for_status()
            data = response.json()

            embeddings = [item["embedding"] for item in data.get("data", [])]
            usage = data.get("usage", {})

            return EmbeddingResult(
                embeddings=embeddings,
                model=self.model,
                usage={
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                }
            )

        except httpx.HTTPError as e:
            logger.error(f"OpenAI embed error: {e}")
            raise

    async def embed_query(self, text: str) -> List[float]:
        """Embed single query"""
        payload = {
            "model": self.model,
            "input": [text]
        }

        try:
            response = await self.client.post("/embeddings", json=payload)
            response.raise_for_status()
            data = response.json()

            embeddings = data.get("data", [])
            if embeddings:
                return embeddings[0]["embedding"]
            return []

        except httpx.HTTPError as e:
            logger.error(f"OpenAI embed query error: {e}")
            raise

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# ============================================================
# FACTORY FUNCTIONS
# ============================================================

def create_embedding_client(config: Optional[EmbeddingConfig] = None) -> BaseEmbeddingClient:
    """
    Factory function to create Embedding client

    Args:
        config: EmbeddingConfig (optional)

    Returns:
        Embedding client instance (CohereEmbeddings or OpenAIEmbeddings)
    """
    if config is None:
        from app.config.settings import settings

        config = EmbeddingConfig(
            provider="cohere",
            model="embed-multilingual-v3.0",
            api_key=getattr(settings, 'COHERE_API_KEY', '')
        )

    provider = config.provider.lower()

    if provider == "cohere":
        return CohereEmbeddings(config)
    elif provider == "openai":
        return OpenAIEmbeddings(config)
    else:
        raise ValueError(f"Unknown embedding provider: {provider}")


async def create_embedding_client_from_db(db_session) -> BaseEmbeddingClient:
    """
    Async factory function to create Embedding client from DB settings

    Args:
        db_session: Async DB session

    Returns:
        Embedding client instance
    """
    from app.core.config_helper import get_setting

    # Try Cohere first (preferred)
    cohere_api_key = await get_setting("COHERE_API_KEY", db_session)

    if cohere_api_key:
        model = await get_setting("COHERE_EMBEDDING_MODEL", db_session) or "embed-multilingual-v3.0"
        config = EmbeddingConfig(
            provider="cohere",
            model=model,
            api_key=cohere_api_key
        )
        return CohereEmbeddings(config)

    # Fallback to OpenAI
    openai_api_key = await get_setting("OPENAI_API_KEY", db_session)
    if openai_api_key:
        model = await get_setting("OPENAI_EMBEDDING_MODEL", db_session) or "text-embedding-3-small"
        config = EmbeddingConfig(
            provider="openai",
            model=model,
            api_key=openai_api_key
        )
        return OpenAIEmbeddings(config)

    raise ValueError("No embedding API key configured. Set COHERE_API_KEY or OPENAI_API_KEY.")


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_embedding_client: Optional[BaseEmbeddingClient] = None


def get_embedding_client() -> BaseEmbeddingClient:
    """
    Get singleton Embedding client instance

    Returns:
        Embedding client instance
    """
    global _embedding_client

    if _embedding_client is None:
        _embedding_client = create_embedding_client()

    return _embedding_client


def reset_embedding_client():
    """Reset singleton Embedding client"""
    global _embedding_client
    _embedding_client = None


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "EmbeddingConfig",
    "EmbeddingResult",
    "BaseEmbeddingClient",
    "CohereEmbeddings",
    "OpenAIEmbeddings",
    "create_embedding_client",
    "create_embedding_client_from_db",
    "get_embedding_client",
    "reset_embedding_client",
]
