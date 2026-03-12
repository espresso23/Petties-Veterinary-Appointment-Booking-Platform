"""
PETTIES AI SERVICE - Feedback Service

Xử lý feedback từ TẤT CẢ roles (PET_OWNER, STAFF, CLINIC_MANAGER,
CLINIC_OWNER, ADMIN) trên TẤT CẢ loại tương tác AI.

Package: app.core.services
Purpose: Save feedback, auto-classify, process positive -> embed case memory
Version: v1.0.0

Flow:
    1. User gửi feedback (thumbs_up/down/report) qua POST /chat/feedback
    2. FeedbackService.save_feedback() -> lưu vào MongoDB
    3. Nếu positive -> process_positive_feedback():
       a. Lấy message gốc từ MongoDB
       b. Auto-classify category (medical/booking/clinic_ops/general)
       c. Extract case info theo category
       d. Tính weight theo role
       e. Embed vào Case Memory (Qdrant) nếu weight > 0

Trọng số feedback theo role:
    VET/STAFF confirmed     = 1.0 (chuyên gia xác nhận)
    CLINIC_MANAGER positive = 0.7
    CLINIC_OWNER positive   = 0.7
    PET_OWNER thumbs_up     = 0.6
    ADMIN playground        = 0.0 (chỉ debug, không embed)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from loguru import logger


# ============================================================
# CONSTANTS
# ============================================================

# Trọng số feedback theo role
ROLE_FEEDBACK_WEIGHTS: Dict[str, float] = {
    "VET": 1.0,
    "STAFF": 1.0,
    "CLINIC_MANAGER": 0.7,
    "CLINIC_OWNER": 0.7,
    "PET_OWNER": 0.6,
    "ADMIN": 0.0,  # Playground debug, không bao giờ embed
}

# Ánh xạ tool -> category cho auto-classification
MEDICAL_TOOLS: Set[str] = {
    "pet_knowledge_search",
    "analyze_pet_image",
    "check_vaccination_status",
}

BOOKING_TOOLS: Set[str] = {
    "search_clinics_nearby",
    "check_available_slots",
    "create_booking_for_user",
    "get_clinic_services",
}

CLINIC_OPS_TOOLS: Set[str] = {
    "analyze_revenue_trends",
    "suggest_staff_assignments",
    "create_staff_shifts",
    "optimize_schedules",
    "accept_sos_booking",
    "generate_clinic_services",
    "compose_clinic_description",
    "suggest_service_pricing",
    "analyze_vet_workload",
}

# Loại feedback positive kích hoạt case embedding
POSITIVE_FEEDBACK_TYPES: Set[str] = {"thumbs_up", "confirmed", "vet_confirmed"}


# ============================================================
# FEEDBACK SERVICE
# ============================================================


class FeedbackService:
    """
    Điều phối xử lý feedback cho tất cả roles và loại tương tác.

    Trách nhiệm:
        - Lưu feedback vào MongoDB
        - Tự động phân loại interaction category từ react_trace
        - Xử lý positive feedback -> embed vào Case Memory
        - Tính trọng số feedback theo role
        - Cung cấp thống kê feedback

    Cách dùng:
        service = FeedbackService()
        result = await service.save_feedback(feedback_data)
    """

    _instance: Optional["FeedbackService"] = None

    def __new__(cls) -> "FeedbackService":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ----------------------------------------------------------
    # Public API
    # ----------------------------------------------------------

    async def save_feedback(self, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Lưu feedback của người dùng vào MongoDB và kích hoạt case embedding nếu positive.

        Args:
            feedback_data: Dict chứa:
                - message_id (bắt buộc): UUID của tin nhắn AI được đánh giá
                - session_id (bắt buộc): UUID phiên chat
                - user_id (bắt buộc): Người gửi feedback
                - user_role: PET_OWNER | STAFF | CLINIC_MANAGER | CLINIC_OWNER | ADMIN
                - feedback_type: thumbs_up | thumbs_down | report | confirmed | vet_confirmed
                - feedback_category: medical | booking | clinic_ops | knowledge | general (tùy chọn, tự phân loại)
                - feedback_reason: incorrect_info | unhelpful | offensive | wrong_tool | slow_response | other
                - feedback_text: Nhận xét chi tiết (tùy chọn)

        Returns:
            Dict với status, cờ case_embedded, và category.
        """
        # Lazy import to avoid circular deps
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        message_id = feedback_data.get("message_id", "")
        feedback_type = feedback_data.get("feedback_type", "thumbs_up")
        user_role = feedback_data.get("user_role", "PET_OWNER")

        # Tự động phân loại category nếu không được cung cấp
        category = feedback_data.get("feedback_category")
        if not category:
            category = await self._auto_classify(message_id)
            feedback_data["feedback_category"] = category

        # Xây dựng document
        now = datetime.now(timezone.utc)
        doc = {
            "feedback_id": str(uuid.uuid4()),
            "message_id": message_id,
            "session_id": feedback_data.get("session_id", ""),
            "user_id": feedback_data.get("user_id", ""),
            "user_role": user_role,
            "feedback_type": feedback_type,
            "feedback_category": category,
            "feedback_reason": feedback_data.get("feedback_reason", ""),
            "feedback_text": feedback_data.get("feedback_text", ""),
            "tool_used": feedback_data.get("tool_used", ""),
            "weight": self._calculate_feedback_weight(user_role, feedback_type),
            "timestamp": now,
            "created_at": now.isoformat(),
        }

        # Lưu vào MongoDB
        try:
            db = await get_mongodb_database()
            collection = db[settings.MONGODB_FEEDBACK_COLLECTION]
            await collection.insert_one(doc)
            logger.info(
                f"Saved feedback {doc['feedback_id']} "
                f"(type={feedback_type}, role={user_role}, category={category})"
            )
        except Exception as e:
            logger.error(f"Failed to save feedback to MongoDB: {e}")
            return {"status": "error", "error": str(e)}

        # Xử lý positive feedback -> embed case nếu phù hợp
        case_embedded = False
        if feedback_type in POSITIVE_FEEDBACK_TYPES:
            case_embedded = await self.process_positive_feedback(
                message_id=message_id,
                feedback=doc,
            )

        return {
            "status": "saved",
            "feedback_id": doc["feedback_id"],
            "case_embedded": case_embedded,
            "category": category,
            "weight": doc["weight"],
        }

    async def process_positive_feedback(
        self,
        message_id: str,
        feedback: Dict[str, Any],
    ) -> bool:
        """
        Xử lý positive feedback: trích xuất case info và embed vào Case Memory.

        Bỏ qua embedding cho ADMIN role (weight=0) và category không hỗ trợ.

        Args:
            message_id: Tin nhắn AI được xác nhận.
            feedback: Document feedback đầy đủ.

        Returns:
            True nếu case được embed thành công.
        """
        weight = feedback.get("weight", 0.0)
        if weight <= 0:
            logger.info(
                f"Skipping case embedding for role={feedback.get('user_role')} "
                f"(weight={weight})"
            )
            return False

        # Lấy tin nhắn gốc từ MongoDB
        message = await self._get_message(message_id)
        if not message:
            logger.warning(f"Message {message_id} not found, cannot embed case")
            return False

        # Feedback thường gắn trên assistant message; ảnh nằm ở user message trước đó.
        metadata = message.get("metadata", {}) or {}
        if not metadata.get("images"):
            session_id = feedback.get("session_id", "")
            if session_id:
                latest_user_images = await self._get_latest_user_images(session_id)
                if latest_user_images:
                    metadata["images"] = latest_user_images
                    message["metadata"] = metadata

        category = feedback.get("feedback_category", "general")
        user_role = feedback.get("user_role", "PET_OWNER")

        # Trích xuất thông tin case dựa trên category
        case_data = self._extract_case_by_category(message, category)
        if not case_data or not case_data.get("text_to_embed"):
            logger.info(f"No embeddable content for category={category}")
            return False

        # Thêm metadata feedback
        case_data["feedback_type"] = "confirmed"
        case_data["feedback_category"] = category
        case_data["user_role"] = user_role
        case_data["vet_verified"] = user_role in ("VET", "STAFF")
        case_data["session_id"] = feedback.get("session_id", "")
        case_data["message_id"] = message_id

        # Embed vào Case Memory
        try:
            from app.core.rag.case_memory import get_case_memory_service

            cm = get_case_memory_service()
            text_to_embed = case_data.pop("text_to_embed")

            # Phân tách URL và base64
            image_urls = None
            image_base64 = None
            all_images = case_data.pop("image_urls", None)

            if all_images:
                urls = [
                    img
                    for img in all_images
                    if isinstance(img, str) and img.startswith("http")
                ]
                base64s = [
                    img
                    for img in all_images
                    if isinstance(img, str)
                    and (img.startswith("data:") or not img.startswith("http"))
                ]
                if urls:
                    image_urls = urls
                if base64s:
                    image_base64 = base64s

            case_id = await cm.upsert_case(
                text_to_embed=text_to_embed,
                payload=case_data,
                image_urls=image_urls,
                image_base64=image_base64,
            )

            if case_id:
                logger.info(
                    f"Embedded case {case_id} from feedback "
                    f"(category={category}, role={user_role})"
                )
                return True
            return False

        except Exception as e:
            logger.error(f"Failed to embed case from feedback: {e}")
            return False

    async def get_feedback_stats(
        self,
        user_id: Optional[str] = None,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Lấy thống kê feedback tổng hợp.

        Args:
            user_id: Lọc theo người dùng (None = tất cả).
            days: Khoảng thời gian lookback (ngày).

        Returns:
            Dict chứa số lượng theo type, category, role, và dữ liệu xu hướng.
        """
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings
        from datetime import timedelta

        try:
            db = await get_mongodb_database()
            collection = db[settings.MONGODB_FEEDBACK_COLLECTION]

            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            query: Dict[str, Any] = {"timestamp": {"$gte": cutoff}}
            if user_id:
                query["user_id"] = user_id

            # Đếm theo type
            pipeline = [
                {"$match": query},
                {
                    "$group": {
                        "_id": {
                            "type": "$feedback_type",
                            "category": "$feedback_category",
                        },
                        "count": {"$sum": 1},
                    }
                },
            ]

            cursor = collection.aggregate(pipeline)
            groups = await cursor.to_list(length=100)

            # Xây dựng thống kê
            by_type: Dict[str, int] = {}
            by_category: Dict[str, int] = {}
            total = 0

            for group in groups:
                key = group["_id"]
                count = group["count"]
                total += count

                fb_type = key.get("type", "unknown")
                fb_cat = key.get("category", "unknown")

                by_type[fb_type] = by_type.get(fb_type, 0) + count
                by_category[fb_cat] = by_category.get(fb_cat, 0) + count

            # Tổng số feedback
            total_count = await collection.count_documents(query)

            return {
                "total": total_count,
                "period_days": days,
                "by_type": by_type,
                "by_category": by_category,
                "positive_rate": (
                    round(
                        by_type.get("thumbs_up", 0)
                        + by_type.get("confirmed", 0)
                        + by_type.get("vet_confirmed", 0)
                    )
                    / total_count
                    if total_count > 0
                    else 0
                ),
            }

        except Exception as e:
            logger.error(f"Failed to get feedback stats: {e}")
            return {"total": 0, "error": str(e)}

    async def list_feedback(
        self,
        page: int = 1,
        page_size: int = 20,
        feedback_type: Optional[str] = None,
        feedback_category: Optional[str] = None,
        user_role: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lấy danh sách feedback chi tiết với bộ lọc và phân trang."""
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        try:
            db = await get_mongodb_database()
            collection = db[settings.MONGODB_FEEDBACK_COLLECTION]

            query: Dict[str, Any] = {}
            if feedback_type:
                query["feedback_type"] = feedback_type
            if feedback_category:
                query["feedback_category"] = feedback_category
            if user_role:
                query["user_role"] = user_role

            if date_from or date_to:
                date_filter: Dict[str, Any] = {}
                if date_from:
                    try:
                        from_dt = datetime.fromisoformat(date_from).replace(
                            tzinfo=timezone.utc
                        )
                        date_filter["$gte"] = from_dt
                    except ValueError:
                        pass
                if date_to:
                    try:
                        to_dt = datetime.fromisoformat(date_to).replace(
                            hour=23, minute=59, second=59, tzinfo=timezone.utc
                        )
                        date_filter["$lte"] = to_dt
                    except ValueError:
                        pass
                if date_filter:
                    query["timestamp"] = date_filter

            total = await collection.count_documents(query)
            skip = (page - 1) * page_size
            cursor = (
                collection.find(query, {"_id": 0})
                .sort("timestamp", -1)
                .skip(skip)
                .limit(page_size)
            )
            docs = await cursor.to_list(length=page_size)

            items = []
            for doc in docs:
                items.append(
                    {
                        "feedback_id": doc.get("feedback_id", ""),
                        "message_id": doc.get("message_id", ""),
                        "session_id": doc.get("session_id", ""),
                        "user_id": doc.get("user_id", ""),
                        "user_role": doc.get("user_role", ""),
                        "feedback_type": doc.get("feedback_type", ""),
                        "feedback_category": doc.get("feedback_category", "general"),
                        "feedback_reason": doc.get("feedback_reason", ""),
                        "feedback_text": doc.get("feedback_text", ""),
                        "tool_used": doc.get("tool_used", ""),
                        "message_content": doc.get("message_content", ""),
                        "weight": doc.get("weight", 0.0),
                        "created_at": doc.get("created_at", ""),
                    }
                )

            return {
                "total": total,
                "page": page,
                "page_size": page_size,
                "items": items,
            }
        except Exception as e:
            logger.error(f"Failed to list feedback: {e}")
            return {"total": 0, "page": page, "page_size": page_size, "items": []}

    async def get_feedback_by_id(self, feedback_id: str) -> Optional[Dict[str, Any]]:
        """Lấy feedback document từ MongoDB theo feedback_id."""
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        try:
            db = await get_mongodb_database()
            collection = db[settings.MONGODB_FEEDBACK_COLLECTION]
            return await collection.find_one({"feedback_id": feedback_id}, {"_id": 0})
        except Exception as e:
            logger.error(f"Failed to get feedback {feedback_id}: {e}")
            return None

    async def update_feedback(
        self,
        feedback_id: str,
        update_data: Dict[str, Any],
        user_id: str,
        is_admin: bool = False,
    ) -> Dict[str, Any]:
        """Cập nhật feedback và xử lý cascade."""
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        existing = await self.get_feedback_by_id(feedback_id)
        if not existing:
            return {"status": "error", "error": "Không tìm thấy feedback"}
        if existing.get("user_id") != user_id and not is_admin:
            return {"status": "error", "error": "Không có quyền"}

        # Cập nhật MongoDB
        try:
            db = await get_mongodb_database()
            collection = db[settings.MONGODB_FEEDBACK_COLLECTION]
            update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            await collection.update_one(
                {"feedback_id": feedback_id}, {"$set": update_data}
            )
            return {"status": "updated", "feedback_id": feedback_id}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def delete_feedback(
        self, feedback_id: str, user_id: str, is_admin: bool = False
    ) -> Dict[str, Any]:
        """Xóa feedback và cascade xóa case khỏi Qdrant."""
        from app.core.database.mongodb import get_mongodb_database
        from app.config.settings import settings

        existing = await self.get_feedback_by_id(feedback_id)
        if not existing:
            return {"status": "error", "error": "Không tìm thấy feedback"}
        if existing.get("user_id") != user_id and not is_admin:
            return {"status": "error", "error": "Không có quyền"}

        case_deleted = False
        case_id = existing.get("case_id")
        if case_id:
            case_deleted = await self._delete_case_from_qdrant(case_id)

        try:
            db = await get_mongodb_database()
            collection = db[settings.MONGODB_FEEDBACK_COLLECTION]
            await collection.delete_one({"feedback_id": feedback_id})
            return {
                "status": "deleted",
                "feedback_id": feedback_id,
                "case_deleted": case_deleted,
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _delete_case_from_qdrant(self, case_id: str) -> bool:
        """Xóa case khỏi Qdrant."""
        try:
            from app.core.rag.case_memory import get_case_memory_service

            cm = get_case_memory_service()
            return await cm.delete_case(case_id)
        except Exception as e:
            logger.error(f"Failed to delete case {case_id}: {e}")
            return False

    # ----------------------------------------------------------
    # Nội bộ: Helper functions
    # ----------------------------------------------------------

    def _calculate_feedback_weight(self, role: str, feedback_type: str) -> float:
        """
        Tính trọng số feedback dựa trên role.

        VET/STAFF = 1.0, CLINIC_MANAGER/OWNER = 0.7, PET_OWNER = 0.6, ADMIN = 0.0
        """
        base_weight = ROLE_FEEDBACK_WEIGHTS.get(role, 0.5)

        # Negative feedback vẫn có trọng số để theo dõi, nhưng dấu âm
        if feedback_type in ("thumbs_down", "report"):
            return -base_weight

        return base_weight

    async def _auto_classify(self, message_id: str) -> str:
        """
        Tự động phân loại interaction category từ react_trace tools.

        Trả về "general" nếu không tìm thấy message hoặc không phát hiện tool.
        """
        message = await self._get_message(message_id)
        if not message:
            return "general"

        return self.classify_interaction(message)

    @staticmethod
    def classify_interaction(message: Dict[str, Any]) -> str:
        """
        Phân loại tương tác dựa trên tools đã dùng trong react_trace.

        Args:
            message: Document tin nhắn MongoDB với metadata.react_trace tùy chọn.

        Returns:
            Chuỗi category: medical | booking | clinic_ops | knowledge | general
        """
        # Trích xuất tools từ react_trace hoặc tool_calls
        tools_used: Set[str] = set()

        # Từ mảng tool_calls
        tool_calls = message.get("tool_calls", [])
        for tc in tool_calls:
            if isinstance(tc, dict):
                tools_used.add(tc.get("tool_name", ""))

        # Từ metadata.react_trace
        metadata = message.get("metadata", {})
        if isinstance(metadata, dict):
            react_trace = metadata.get("react_trace", [])
            if isinstance(react_trace, list):
                for step in react_trace:
                    if isinstance(step, dict):
                        tools_used.add(step.get("tool", ""))
                        tools_used.add(step.get("tool_name", ""))

        tools_used.discard("")

        if tools_used & MEDICAL_TOOLS:
            return "medical"
        elif tools_used & BOOKING_TOOLS:
            return "booking"
        elif tools_used & CLINIC_OPS_TOOLS:
            return "clinic_ops"
        elif "pet_knowledge_search" in tools_used:
            return "knowledge"
        else:
            return "general"

    def _extract_case_by_category(
        self, message: Dict[str, Any], category: str
    ) -> Dict[str, Any]:
        """
        Trích xuất thông tin case từ message dựa trên category.

        Trả về dict với key ``text_to_embed`` và các trường theo category.
        """
        content = message.get("content", "")
        user_query = message.get("user_query", message.get("query", ""))
        metadata = message.get("metadata", {}) or {}

        if category == "medical":
            return self._extract_medical_case(message, content, user_query, metadata)
        elif category == "booking":
            return self._extract_booking_case(message, content, user_query, metadata)
        elif category == "clinic_ops":
            return self._extract_clinic_ops_case(message, content, user_query, metadata)
        else:
            return self._extract_general_case(message, content, user_query, metadata)

    def _extract_medical_case(
        self,
        message: Dict[str, Any],
        content: str,
        user_query: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trích xuất case y khoa (chẩn đoán, triệu chứng, loài, điều trị)."""
        visual_desc = metadata.get("visual_description", "")
        diagnosis = metadata.get("diagnosis", "")
        species = metadata.get("species", "")
        symptoms = metadata.get("symptoms", [])
        treatment = metadata.get("treatment", "")

        image_urls: List[str] = []
        raw_images = metadata.get("images", [])
        if isinstance(raw_images, list):
            for item in raw_images:
                if isinstance(item, str) and item.strip().startswith("http"):
                    image_urls.append(item.strip())

        attachments = metadata.get("attachments", [])
        if isinstance(attachments, list):
            for att in attachments:
                if (
                    isinstance(att, dict)
                    and att.get("type") == "image"
                    and isinstance(att.get("url"), str)
                    and att.get("url").strip().startswith("http")
                ):
                    image_urls.append(att.get("url").strip())

        # Xây dựng text để embed: kết hợp tất cả thông tin có sẵn
        parts = [p for p in [visual_desc, diagnosis, user_query, content[:300]] if p]
        text_to_embed = " ".join(parts)

        if not text_to_embed.strip():
            return {}

        return {
            "text_to_embed": text_to_embed,
            "visual_description": visual_desc,
            "diagnosis": diagnosis,
            "species": species,
            "symptoms": symptoms if isinstance(symptoms, list) else [],
            "treatment": treatment,
            "user_description": user_query,
            "image_urls": image_urls,
        }

    def _extract_booking_case(
        self,
        message: Dict[str, Any],
        content: str,
        user_query: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trích xuất case đặt lịch (phòng khám, dịch vụ, slot)."""
        clinic = metadata.get("clinic_matched", metadata.get("clinic_name", ""))
        service_type = metadata.get("service_type", "")
        slot = metadata.get("slot_selected", "")

        text_to_embed = (
            f"Booking: {user_query} -> {clinic} {service_type} {slot}".strip()
        )
        if not text_to_embed or text_to_embed == "Booking:  ":
            text_to_embed = f"Booking: {content[:300]}"

        return {
            "text_to_embed": text_to_embed,
            "clinic_matched": clinic,
            "service_type": service_type,
            "slot_selected": slot,
            "user_query": user_query,
        }

    def _extract_clinic_ops_case(
        self,
        message: Dict[str, Any],
        content: str,
        user_query: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trích xuất case vận hành phòng khám (doanh thu, lịch làm việc, v.v.)."""
        tool_used = metadata.get("tool_used", "")
        result_summary = content[:300] if content else ""

        text_to_embed = f"Clinic ops: {user_query} -> {result_summary}".strip()

        return {
            "text_to_embed": text_to_embed,
            "tool_used": tool_used,
            "user_query": user_query,
            "result_summary": result_summary,
        }

    def _extract_general_case(
        self,
        message: Dict[str, Any],
        content: str,
        user_query: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trích xuất case hỏi đáp chung."""
        response_summary = content[:300] if content else ""

        text_to_embed = f"Q&A: {user_query} -> {response_summary}".strip()
        if not text_to_embed or text_to_embed == "Q&A:  ->":
            return {}

        return {
            "text_to_embed": text_to_embed,
            "user_query": user_query,
            "ai_response_summary": response_summary,
        }

    async def _get_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Lấy document tin nhắn từ MongoDB theo message_id."""
        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings

            db = await get_mongodb_database()
            collection = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]
            return await collection.find_one({"message_id": message_id})
        except Exception as e:
            logger.error(f"Failed to get message {message_id}: {e}")
            return None

    async def _get_latest_user_images(self, session_id: str) -> List[str]:
        """Lấy ảnh (URL hoặc base64) từ user message gần nhất trong session."""
        try:
            from app.core.database.mongodb import get_mongodb_database
            from app.config.settings import settings

            db = await get_mongodb_database()
            collection = db[settings.MONGODB_CHAT_MESSAGES_COLLECTION]
            latest_user_msg = await collection.find_one(
                {"session_id": session_id, "role": "user"},
                sort=[("timestamp", -1)],
            )
            if not latest_user_msg:
                return []
            metadata = latest_user_msg.get("metadata", {}) or {}
            images = metadata.get("images", [])
            if not isinstance(images, list):
                return []

            # Lấy cả URL (http) và base64 images
            result = []
            for u in images:
                if not isinstance(u, str):
                    continue
                u = u.strip()
                if not u:
                    continue
                # URL https hoặc base64 (raw hoặc data URL)
                if u.startswith("http://") or u.startswith("https://"):
                    result.append(u)
                elif u.startswith("data:") or len(u) > 100:  # Data URL hoặc raw base64
                    result.append(u)
            return result
        except Exception as e:
            logger.error(
                f"Failed to get latest user images for session {session_id}: {e}"
            )
            return []


# ============================================================
# SINGLETON - Quản lý instance duy nhất
# ============================================================

_feedback_service: Optional[FeedbackService] = None


def get_feedback_service() -> FeedbackService:
    """Lấy singleton FeedbackService instance."""
    global _feedback_service
    if _feedback_service is None:
        _feedback_service = FeedbackService()
    return _feedback_service


def reset_feedback_service() -> None:
    """Reset singleton (dùng cho testing)."""
    global _feedback_service
    _feedback_service = None


__all__ = [
    "FeedbackService",
    "get_feedback_service",
    "reset_feedback_service",
    "ROLE_FEEDBACK_WEIGHTS",
    "POSITIVE_FEEDBACK_TYPES",
]
