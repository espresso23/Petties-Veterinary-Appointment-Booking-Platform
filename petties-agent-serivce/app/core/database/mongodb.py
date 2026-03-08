"""
PETTIES AGENT SERVICE - MongoDB Connection Module

Purpose:
    - Kết nối MongoDB để lưu chat history, ReAct traces, proactive notifications
    - Singleton pattern để tái sử dụng connection
    - Health check và connection testing

Collections:
    - ai_chat_sessions: Session metadata (user_id, role, timestamps)
    - ai_chat_messages: Messages + ReAct traces
    - ai_proactive_notifications: Proactive notification logs
    - chat_feedback: User feedback (thumbs up/down)

Usage:
    from app.core.database.mongodb import get_mongodb_client, get_mongodb_database

    db = await get_mongodb_database()
    sessions = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]
    await sessions.insert_one({"session_id": "uuid", ...})
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone
from loguru import logger
from app.config.settings import settings


# ===== GLOBAL MONGODB CLIENT (Singleton) =====
_mongodb_client: Optional[AsyncIOMotorClient] = None


async def get_mongodb_client() -> AsyncIOMotorClient:
    """
    Lấy MongoDB client (Singleton pattern)

    Returns:
        AsyncIOMotorClient instance

    Raises:
        ConnectionError: Nếu không kết nối được MongoDB
    """
    global _mongodb_client

    if _mongodb_client is None:
        try:
            logger.info(f"🔌 Connecting to MongoDB: {settings.MONGODB_URL}")

            _mongodb_client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=5000,  # 5s timeout
                maxPoolSize=50,  # Max 50 connections
                minPoolSize=10,  # Min 10 connections
            )

            # Test connection bằng ping
            await _mongodb_client.admin.command('ping')

            logger.success(f"✅ MongoDB connected successfully: {settings.MONGODB_DATABASE}")

        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            _mongodb_client = None
            raise ConnectionError(f"Không thể kết nối MongoDB: {e}")

    return _mongodb_client


async def get_mongodb_database() -> AsyncIOMotorDatabase:
    """
    Lấy MongoDB database instance

    Returns:
        AsyncIOMotorDatabase instance
    """
    client = await get_mongodb_client()
    return client[settings.MONGODB_DATABASE]


async def close_mongodb_connection():
    """
    Đóng MongoDB connection (gọi khi shutdown app)
    """
    global _mongodb_client

    if _mongodb_client is not None:
        logger.info("🔌 Closing MongoDB connection...")
        _mongodb_client.close()
        _mongodb_client = None
        logger.success("✅ MongoDB connection closed")


async def mongodb_health_check() -> dict:
    """
    Kiểm tra MongoDB connection status

    Returns:
        dict: {
            "status": "healthy" | "unhealthy",
            "database": str,
            "collections": List[str],
            "error": Optional[str]
        }
    """
    try:
        client = await get_mongodb_client()
        db = client[settings.MONGODB_DATABASE]

        # Ping to test connection
        await client.admin.command('ping')

        # List collections
        collections = await db.list_collection_names()

        return {
            "status": "healthy",
            "database": settings.MONGODB_DATABASE,
            "collections": collections,
            "url": settings.MONGODB_URL.split('@')[-1] if '@' in settings.MONGODB_URL else settings.MONGODB_URL,  # Hide credentials
            "error": None
        }

    except Exception as e:
        logger.error(f"❌ MongoDB health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": settings.MONGODB_DATABASE,
            "collections": [],
            "url": settings.MONGODB_URL.split('@')[-1] if '@' in settings.MONGODB_URL else settings.MONGODB_URL,
            "error": str(e)
        }


async def create_mongodb_indexes():
    """
    Tạo indexes cho MongoDB collections để tối ưu query performance

    Indexes:
        - ai_chat_sessions: session_id (unique), user_id, context_type, updated_at
        - ai_chat_messages: session_id, timestamp, message_id (unique)
        - ai_proactive_notifications: user_id, timestamp, read_status
    """
    try:
        db = await get_mongodb_database()

        # ===== ai_chat_sessions indexes =====
        sessions_collection = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]
        await sessions_collection.create_index("session_id", unique=True)
        await sessions_collection.create_index("user_id")
        await sessions_collection.create_index("context_type")
        await sessions_collection.create_index("updated_at")
        await sessions_collection.create_index([("user_id", 1), ("context_type", 1), ("updated_at", -1)])
        logger.success(f"✅ Created indexes for {settings.MONGODB_CHAT_SESSIONS_COLLECTION}")

        # ===== ai_chat_messages indexes =====
        messages_collection = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]
        await messages_collection.create_index("message_id", unique=True)
        await messages_collection.create_index("session_id")
        await messages_collection.create_index("timestamp")
        await messages_collection.create_index("user_id")
        await messages_collection.create_index("context_type")
        await messages_collection.create_index([("session_id", 1), ("timestamp", 1)])  # Compound index
        await messages_collection.create_index([("user_id", 1), ("context_type", 1)])
        await messages_collection.create_index("tool_calls.tool_name")
        logger.success(f"✅ Created indexes for {settings.MONGODB_CHAT_MESSAGES_COLLECTION}")

        # ===== ai_proactive_notifications indexes =====
        notifications_collection = db[settings.MONGODB_PROACTIVE_NOTIFICATIONS_COLLECTION]
        await notifications_collection.create_index("user_id")
        await notifications_collection.create_index("timestamp")
        await notifications_collection.create_index("read_status")
        await notifications_collection.create_index([("user_id", 1), ("read_status", 1)])  # Unread notifications
        logger.success(f"✅ Created indexes for {settings.MONGODB_PROACTIVE_NOTIFICATIONS_COLLECTION}")

        # ===== chat_feedback indexes =====
        feedback_collection = db[settings.MONGODB_FEEDBACK_COLLECTION]
        await feedback_collection.create_index("message_id")
        await feedback_collection.create_index("user_id")
        await feedback_collection.create_index("timestamp")
        logger.success(f"✅ Created indexes for {settings.MONGODB_FEEDBACK_COLLECTION}")

        logger.success("✅ All MongoDB indexes created successfully!")

    except Exception as e:
        logger.error(f"❌ Failed to create MongoDB indexes: {e}")
        raise


# ===== UTILITY FUNCTIONS =====

async def save_chat_session(session_data: dict) -> str:
    """
    Lưu chat session vào MongoDB

    Args:
        session_data: Dict chứa session metadata

    Returns:
        session_id: UUID của session vừa tạo
    """
    try:
        db = await get_mongodb_database()
        sessions = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]

        result = await sessions.insert_one(session_data)
        logger.info(f"💾 Saved chat session: {session_data.get('session_id')}")

        return session_data.get('session_id')

    except Exception as e:
        logger.error(f"❌ Failed to save chat session: {e}")
        raise


async def save_chat_message(message_data: dict) -> str:
    """
    Lưu chat message vào MongoDB

    Args:
        message_data: Dict chứa message + metadata + ReAct trace

    Returns:
        message_id: UUID của message vừa tạo
    """
    try:
        db = await get_mongodb_database()
        messages = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]

        result = await messages.insert_one(message_data)
        logger.info(f"💾 Saved chat message: {message_data.get('message_id')}")

        return message_data.get('message_id')

    except Exception as e:
        logger.error(f"❌ Failed to save chat message: {e}")
        raise


async def get_chat_history(session_id: str, limit: int = 50) -> list:
    """
    Lấy chat history của session

    Args:
        session_id: UUID của session
        limit: Số message tối đa (default: 50)

    Returns:
        List[dict]: Danh sách messages sorted by timestamp
    """
    try:
        db = await get_mongodb_database()
        messages = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]

        cursor = messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).limit(limit)

        history = await cursor.to_list(length=limit)
        logger.info(f"📜 Retrieved {len(history)} messages for session {session_id}")

        return history

    except Exception as e:
        logger.error(f"❌ Failed to get chat history: {e}")
        return []


async def get_chat_session(session_id: str) -> Optional[dict]:
    """Lấy metadata của một chat session theo session_id."""
    try:
        db = await get_mongodb_database()
        sessions = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]
        return await sessions.find_one({"session_id": session_id})
    except Exception as e:
        logger.error(f"❌ Failed to get chat session: {e}")
        return None


async def list_chat_sessions_by_owner(user_id: str, context_type: Optional[str] = None, limit: int = 20) -> list:
    """Lấy danh sách sessions theo owner và context."""
    try:
        db = await get_mongodb_database()
        sessions = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]

        query = {"user_id": user_id}
        if context_type:
            query["context_type"] = context_type

        cursor = sessions.find(query).sort("updated_at", -1).limit(limit)
        return await cursor.to_list(length=limit)
    except Exception as e:
        logger.error(f"❌ Failed to list chat sessions: {e}")
        return []


async def touch_chat_session(session_id: str, extra_updates: Optional[dict] = None) -> bool:
    """Cập nhật updated_at của session sau mỗi message."""
    try:
        db = await get_mongodb_database()
        sessions = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]

        updates = {
            "updated_at": datetime.now(timezone.utc)
        }
        if extra_updates:
            updates.update(extra_updates)

        result = await sessions.update_one({"session_id": session_id}, {"$set": updates})
        return result.matched_count > 0
    except Exception as e:
        logger.error(f"❌ Failed to touch chat session: {e}")
        return False


async def delete_chat_session(session_id: str) -> bool:
    """Xóa session và toàn bộ messages liên quan."""
    try:
        db = await get_mongodb_database()
        sessions = db[settings.MONGODB_CHAT_SESSIONS_COLLECTION]
        messages = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]

        await messages.delete_many({"session_id": session_id})
        result = await sessions.delete_one({"session_id": session_id})
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"❌ Failed to delete chat session: {e}")
        return False


if __name__ == "__main__":
    import asyncio

    async def test_connection():
        """Test MongoDB connection"""
        print("🧪 Testing MongoDB connection...")

        # Test health check
        health = await mongodb_health_check()
        print(f"\n📊 Health Check Result:")
        print(f"  Status: {health['status']}")
        print(f"  Database: {health['database']}")
        print(f"  URL: {health['url']}")
        print(f"  Collections: {health['collections']}")
        if health['error']:
            print(f"  ❌ Error: {health['error']}")

        # Create indexes nếu connection healthy
        if health['status'] == 'healthy':
            print("\n🔧 Creating indexes...")
            await create_mongodb_indexes()

        # Close connection
        await close_mongodb_connection()

    asyncio.run(test_connection())
