import asyncio
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.services.feedback_service import get_feedback_service
from app.core.database.mongodb import get_mongodb_database
from app.config.settings import settings


async def test_auto_update_kg():
    # 1. Connect to MongoDB
    db = await get_mongodb_database()
    messages_col = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]

    msg_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())

    # 2. Insert fake message
    await messages_col.insert_one(
        {
            "message_id": msg_id,
            "session_id": session_id,
            "role": "assistant",
            "content": "Chó của bạn có vẻ bị bệnh Parvo. Triệu chứng bao gồm nôn mửa và tiêu chảy máu. Nên điều trị bằng truyền dịch.",
            "metadata": {
                "diagnosis": "Bệnh Parvo",
                "species": "Chó",
                "symptoms": ["Nôn mửa", "Tiêu chảy máu"],
                "treatment": "Truyền dịch",
            },
        }
    )
    print(f"Inserted fake message: {msg_id}")

    # 3. Process positive feedback (as STAFF)
    feedback_data = {
        "feedback_id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_role": "STAFF",
        "weight": 1.0,
        "feedback_type": "confirmed",
        "feedback_category": "medical",
    }

    service = get_feedback_service()
    success = await service.process_positive_feedback(msg_id, feedback_data)
    print(f"Auto-update success: {success}")

    # Let background task finish (add_text_to_graph)
    print("Waiting 15 seconds for KG to build and persist...")
    await asyncio.sleep(15)
    print("Done waiting.")


if __name__ == "__main__":
    asyncio.run(test_auto_update_kg())
