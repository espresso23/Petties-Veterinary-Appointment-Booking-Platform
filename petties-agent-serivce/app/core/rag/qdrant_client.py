"""
PETTIES AGENT SERVICE - Qdrant Client Manager

Manages connection to Qdrant vector database.
Supports both Qdrant Cloud and local instances.
Updated for Cohere embeddings (1024 dimensions).

Package: app.core.rag
Purpose: Vector database operations
Version: v1.0.0 (Updated for Cohere embeddings)

Changes from v0.x:
- Default dimension changed from 1536 to 1024 (Cohere)
- Added async methods
- Improved error handling
"""

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from typing import List, Optional, Dict, Any
from loguru import logger
import uuid

from app.config.settings import settings


# Cohere embed-multilingual-v3.0 dimension
COHERE_EMBED_DIMENSION = 1024


class QdrantManager:
    """
    Qdrant Vector Database Manager

    Usage:
        manager = QdrantManager()
        manager.create_collection("knowledge", dimension=1024)
        manager.upsert_vectors("knowledge", vectors, payloads)
        results = manager.search("knowledge", query_vector, top_k=5)
    """

    _instance: Optional["QdrantManager"] = None
    _client: Optional[QdrantClient] = None

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self._client = self._create_client()

    def _create_client(self) -> QdrantClient:
        """Create Qdrant client from settings"""
        qdrant_url = settings.QDRANT_URL
        qdrant_api_key = settings.QDRANT_API_KEY

        if qdrant_url and qdrant_api_key:
            # Qdrant Cloud
            logger.info(f"Connecting to Qdrant Cloud: {qdrant_url}")
            return QdrantClient(
                url=qdrant_url,
                api_key=qdrant_api_key,
            )
        elif qdrant_url:
            # Self-hosted with URL
            logger.info(f"Connecting to Qdrant: {qdrant_url}")
            return QdrantClient(url=qdrant_url)
        else:
            # Local Qdrant
            logger.info("Using local Qdrant instance at localhost:6333")
            return QdrantClient(
                host="localhost",
                port=6333,
            )

    @property
    def client(self) -> QdrantClient:
        """Get Qdrant client"""
        return self._client

    def create_collection(
        self,
        collection_name: str,
        dimension: int = COHERE_EMBED_DIMENSION,
        distance: Distance = Distance.COSINE,
        recreate_on_mismatch: bool = True
    ) -> bool:
        """
        Create a new collection if not exists, with dimension validation

        Args:
            collection_name: Name of the collection
            dimension: Vector dimension (1024 for Cohere multilingual)
            distance: Distance metric
            recreate_on_mismatch: If True, delete and recreate on dimension mismatch

        Returns:
            True if collection is ready with correct dimension
        """
        try:
            collections = self._client.get_collections().collections
            existing = [c.name for c in collections]

            if collection_name in existing:
                # Collection exists - verify dimension
                collection_info = self._client.get_collection(collection_name)

                # Extract current dimension from VectorParams
                current_dimension = collection_info.config.params.vectors.size

                if current_dimension == dimension:
                    logger.info(f"Collection '{collection_name}' exists with correct dimension {dimension}")
                    return True

                # Dimension mismatch detected
                logger.warning(
                    f"Collection '{collection_name}' has wrong dimension: "
                    f"expected {dimension}, got {current_dimension}"
                )

                if recreate_on_mismatch:
                    logger.info(f"Deleting and recreating collection '{collection_name}' with dimension {dimension}")
                    self._client.delete_collection(collection_name)
                else:
                    logger.error(f"Dimension mismatch and recreate_on_mismatch=False")
                    return False

            # Create new collection
            self._client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=dimension,
                    distance=distance,
                )
            )
            logger.info(f"Created collection '{collection_name}' with dimension {dimension}")
            return True

        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            return False

    def upsert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: List[dict],
        ids: Optional[List[str]] = None
    ) -> bool:
        """
        Insert or update vectors in collection

        Args:
            collection_name: Target collection
            vectors: List of embedding vectors
            payloads: List of metadata dicts
            ids: Optional list of point IDs (UUIDs)

        Returns:
            True if successful

        Raises:
            Exception: If upsert fails (propagates for proper error handling)
        """
        try:
            if ids is None:
                # Generate UUIDs
                ids = [str(uuid.uuid4()) for _ in vectors]

            points = [
                PointStruct(id=i, vector=v, payload=p)
                for i, v, p in zip(ids, vectors, payloads)
            ]

            self._client.upsert(
                collection_name=collection_name,
                points=points
            )
            logger.info(f"Upserted {len(points)} vectors to '{collection_name}'")
            return True

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to upsert vectors: {error_msg}")

            # Check for common errors and provide helpful messages
            if "dimension" in error_msg.lower():
                raise RuntimeError(
                    "Vector dimension mismatch detected. The Qdrant collection was created with a different "
                    "embedding model. The collection will be recreated automatically on the next upload attempt."
                ) from e
            else:
                raise RuntimeError(f"Failed to upsert vectors to Qdrant: {error_msg}") from e

    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        top_k: int = 5,
        score_threshold: float = 0.1,  # Lowered for Vietnamese Cohere embeddings
        filter_conditions: Optional[Dict[str, Any]] = None
    ) -> List[dict]:
        """
        Search for similar vectors

        Args:
            collection_name: Collection to search
            query_vector: Query embedding
            top_k: Number of results
            score_threshold: Minimum similarity score (default 0.1 for Vietnamese)
            filter_conditions: Optional filter dict (e.g., {"document_id": 123})

        Returns:
            List of results with payload and score
        """
        logger.info(f"Search: query_vector dim={len(query_vector)}, top_k={top_k}, score_threshold={score_threshold}")
        try:
            # Build filter if provided
            qdrant_filter = None
            if filter_conditions:
                must_conditions = [
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter_conditions.items()
                ]
                qdrant_filter = Filter(must=must_conditions)

            # Try new API first (qdrant-client >= 1.7.0), then fallback to old API
            try:
                # New API: query_points (qdrant-client >= 1.7.0)
                from qdrant_client.models import QueryResponse
                response = self._client.query_points(
                    collection_name=collection_name,
                    query=query_vector,
                    limit=top_k,
                    score_threshold=score_threshold,
                    query_filter=qdrant_filter
                )
                # query_points returns QueryResponse with .points
                results = response.points if hasattr(response, 'points') else response
                logger.info(f"Search (query_points API) returned {len(results)} results")
            except (AttributeError, TypeError, ImportError):
                # Old API: search (qdrant-client < 1.7.0)
                results = self._client.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=top_k,
                    score_threshold=score_threshold,
                    query_filter=qdrant_filter
                )
                logger.info(f"Search (old API) returned {len(results)} results")
            
            for i, r in enumerate(results[:3]):
                logger.info(f"  Result {i}: score={r.score}, content_len={len(r.payload.get('content', ''))}")

            return [
                {
                    "id": str(r.id),
                    "score": r.score,
                    **r.payload
                }
                for r in results
            ]

        except Exception as e:
            logger.error(f"Search failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    def delete_by_filter(
        self,
        collection_name: str,
        filter_conditions: Dict[str, Any]
    ) -> bool:
        """
        Delete points by filter

        Args:
            collection_name: Collection name
            filter_conditions: Filter dict (e.g., {"document_id": 123})
        """
        try:
            must_conditions = [
                FieldCondition(key=k, match=MatchValue(value=v))
                for k, v in filter_conditions.items()
            ]

            self._client.delete(
                collection_name=collection_name,
                points_selector=Filter(must=must_conditions)
            )
            logger.info(f"Deleted points matching filter: {filter_conditions}")
            return True

        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return False

    def delete_collection(self, collection_name: str) -> bool:
        """Delete a collection"""
        try:
            self._client.delete_collection(collection_name)
            logger.info(f"Deleted collection '{collection_name}'")
            return True
        except Exception as e:
            logger.error(f"Failed to delete collection: {e}")
            return False

    def get_collection_info(self, collection_name: str) -> dict:
        """Get collection info"""
        try:
            info = self._client.get_collection(collection_name)
            return {
                "name": collection_name,
                "points_count": info.points_count,
                "vectors_config": str(info.config.params.vectors),
                "status": info.status.value if info.status else "unknown"
            }
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return {}

    def list_collections(self) -> List[str]:
        """List all collection names"""
        try:
            collections = self._client.get_collections().collections
            return [c.name for c in collections]
        except Exception as e:
            logger.error(f"Failed to list collections: {e}")
            return []


# Singleton instance
def get_qdrant_manager() -> QdrantManager:
    """Get singleton QdrantManager instance"""
    return QdrantManager()
