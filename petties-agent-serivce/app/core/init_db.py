import asyncio
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.config.settings import get_settings
from loguru import logger

async def init_qdrant():
    """
    Initialize Qdrant Collections based on ENV_DB_MIGRATION_STRATEGY.md
    This follows the 'Check-and-Init' pattern.
    """
    settings = get_settings()
    client = QdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
    )

    collection_name = settings.QDRANT_COLLECTION_NAME
    
    try:
        collections = client.get_collections().collections
        exists = any(c.name == collection_name for c in collections)
        
        if not exists:
            logger.info(f"🚀 Creating Qdrant collection: {collection_name}")
            # Vector size for cohere embed-multilingual-v3.0 is 1024
            client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=1024, 
                    distance=models.Distance.COSINE
                ),
            )
            logger.info(f"✅ Collection {collection_name} created successfully.")
        else:
            logger.info(f"📦 Qdrant collection {collection_name} already exists. Skipping initialization.")
            
    except Exception as e:
        logger.error(f"❌ Failed to initialize Qdrant: {str(e)}")

if __name__ == "__main__":
    asyncio.run(init_qdrant())
