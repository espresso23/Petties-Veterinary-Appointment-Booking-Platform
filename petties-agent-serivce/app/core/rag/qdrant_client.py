"""
PETTIES AGENT SERVICE - Qdrant Client Manager

Manages connection to Qdrant vector database.
Supports both Qdrant Cloud and local instances.
"""

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from typing import List, Optional
import logging
import os

from app.config.settings import settings

logger = logging.getLogger(__name__)


class QdrantManager:
    """
    Qdrant Vector Database Manager
    
    Usage:
        manager = QdrantManager()
        manager.create_collection("knowledge", dimension=1536)
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
        if settings.QDRANT_URL and settings.QDRANT_API_KEY:
            # Qdrant Cloud
            logger.info(f"Connecting to Qdrant Cloud: {settings.QDRANT_URL}")
            return QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
            )
        else:
            # Local Qdrant
            logger.info("Using local Qdrant instance")
            return QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
            )
    
    @property
    def client(self) -> QdrantClient:
        """Get Qdrant client"""
        return self._client
    
    def create_collection(
        self, 
        collection_name: str, 
        dimension: int = 1536,
        distance: Distance = Distance.COSINE
    ) -> bool:
        """
        Create a new collection if not exists
        
        Args:
            collection_name: Name of the collection
            dimension: Vector dimension (1536 for OpenAI ada-002)
            distance: Distance metric
        """
        try:
            collections = self._client.get_collections().collections
            existing = [c.name for c in collections]
            
            if collection_name in existing:
                logger.info(f"Collection '{collection_name}' already exists")
                return True
            
            self._client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=dimension,
                    distance=distance,
                )
            )
            logger.info(f"Created collection '{collection_name}'")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            return False
    
    def upsert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: List[dict],
        ids: Optional[List[int]] = None
    ) -> bool:
        """
        Insert or update vectors in collection
        
        Args:
            collection_name: Target collection
            vectors: List of embedding vectors
            payloads: List of metadata dicts
            ids: Optional list of point IDs
        """
        try:
            if ids is None:
                # Get current count and generate IDs
                info = self._client.get_collection(collection_name)
                start_id = info.points_count + 1
                ids = list(range(start_id, start_id + len(vectors)))
            
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
            logger.error(f"Failed to upsert vectors: {e}")
            return False
    
    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        top_k: int = 5,
        score_threshold: float = 0.5
    ) -> List[dict]:
        """
        Search for similar vectors
        
        Args:
            collection_name: Collection to search
            query_vector: Query embedding
            top_k: Number of results
            score_threshold: Minimum similarity score
            
        Returns:
            List of results with payload and score
        """
        try:
            results = self._client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=top_k,
                score_threshold=score_threshold,
            )
            
            return [
                {
                    "id": r.id,
                    "score": r.score,
                    **r.payload
                }
                for r in results
            ]
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
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
