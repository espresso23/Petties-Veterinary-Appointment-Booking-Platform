"""
PETTIES AGENT SERVICE - Pet Care RAG Tools (FastMCP)

Code-based tools for Single Agent - RAG-based Q&A and symptom checking.
Uses Cohere embeddings + Qdrant vector search.

Package: app.core.tools.mcp_tools
Purpose:
    - RAG-based knowledge search for pet care & symptom analysis
    - Vietnamese language support via Cohere multilingual

Tools:
    - pet_knowledge_search: Unified RAG tool for pet care Q&A + symptom analysis
    - get_staff_patients: Get staff's patients list for quick lookup
    - get_patient_summary: Get quick summary of pet's medical record
    - get_emr_history: Get full EMR history of a pet

Reference: Technical Scope - Single Agent with ReAct pattern
Version: v2.0.0 (Merged pet_care_qa + symptom_search into pet_knowledge_search)
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List, Optional
from loguru import logger
import re

from app.config.settings import settings


def _clean_rag_text(text: str) -> str:
    cleaned = text.replace("", " ").replace("•", " ").replace("□", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    return cleaned.strip()


# ===== RAG TOOLS =====


@mcp_server.tool
async def pet_knowledge_search(
    query: str,
    pet_type: str = "dog",
    top_k: int = 5,
    min_score: float = 0.4,
) -> Dict[str, Any]:
    """
    Tìm kiếm kiến thức chăm sóc thú cưng từ Knowledge Base (RAG).

    Sử dụng tool này khi người dùng:
    - Hỏi cách chăm sóc thú cưng (cho ăn, tắm rửa, tập luyện, vệ sinh)
    - Hỏi về thông tin giống loài, dinh dưỡng, thực phẩm
    - Mô tả triệu chứng (sốt, nôn, tiêu chảy, bỏ ăn, ngứa, rụng lông)
    - Hỏi về bệnh, chẩn đoán, điều trị tham khảo

    Tool này trả về raw data từ Knowledge Base. LLM sẽ tự phân tích
    nội dung, đánh giá mức độ nghiêm trọng và format câu trả lời.

    Args:
        query: Câu hỏi hoặc mô tả triệu chứng (tiếng Việt hoặc English)
        pet_type: Loại thú cưng (dog, cat, bird, rabbit, hamster)
        top_k: Số lượng kết quả trả về (mặc định: 5)
        min_score: Điểm tương đồng tối thiểu (mặc định: 0.4)

    Returns:
        Dict chứa:
            - query: str - Câu hỏi gốc
            - pet_type: str - Loại thú cưng
            - results: List[Dict] - Danh sách tài liệu tìm được ({content, score, source, chunk_index})
            - sources_used: int - Số tài liệu được sử dụng
            - search_source: str - "knowledge_base"
    """
    try:
        from app.core.rag.hybrid_engine import get_hybrid_rag_engine

        hybrid = get_hybrid_rag_engine()

        # Hybrid query (RAG + KG + Case Memory)
        # NOTE: hybrid.query() đã gọi QueryExpander bên trong,
        #       KHÔNG expand ở đây để tránh duplicate expansion.
        hybrid_result = await hybrid.query(
            query=query,
            top_k=top_k,
            min_score=min_score,
            pet_type=pet_type,
            enable_rag=True,
            enable_kg=True,
            enable_case_memory=True,
        )
        query_expanded = hybrid_result.expanded_query != hybrid_result.original_query

        # Map HybridChunk -> tool schema (backward-compatible)
        formatted_results = []
        for c in hybrid_result.chunks or []:
            meta = c.metadata or {}
            if c.source == "rag":
                source_label = meta.get("document_name") or "Knowledge Base"
                chunk_index = meta.get("chunk_index")
            elif c.source == "kg":
                source_label = "Knowledge Graph"
                chunk_index = None
            elif c.source == "case_memory":
                source_label = "Case Memory"
                chunk_index = None
            else:
                source_label = str(c.source or "knowledge_base")
                chunk_index = None

            formatted_results.append(
                {
                    "content": _clean_rag_text(c.content),
                    "score": c.score,
                    "source": source_label,
                    "chunk_index": chunk_index,
                }
            )

        logger.info(
            f"pet_knowledge_search: Found {len(formatted_results)} results "
            f"(expanded={query_expanded}) for query: {query[:50]}..."
        )

        return {
            "query": query,
            "expanded_query": hybrid_result.expanded_query if query_expanded else None,
            "pet_type": pet_type,
            "results": formatted_results,
            "sources_used": len(formatted_results),
            "search_source": "knowledge_base",
        }

    except Exception as e:
        logger.error(f"Lỗi trong pet_knowledge_search: {e}")
        return {
            "query": query,
            "pet_type": pet_type,
            "results": [],
            "sources_used": 0,
            "search_source": "knowledge_base",
            "error": str(e),
        }


# ===== STAFF DIAGNOSTIC SUPPORT TOOLS =====
@mcp_server.tool
async def get_staff_patients(
    query_name: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Lấy danh sách thú cưng của staff hiện tại để tìm kiếm nhanh theo tên.
    Dùng khi staff muốn tìm thú cưng để xem chi tiết bệnh án.

    Args:
        query_name: Tên thú cưng cần tìm (tùy chọn)
        limit: Số lượng kết quả tối đa (mặc định: 10)

    Returns:
        {
            "pets": [
                {
                    "pet_id": "uuid",
                    "pet_name": "Tên thú cưng",
                    "species": "chó/mèo",
                    "breed": "giống",
                    "owner_name": "Tên chủ",
                    "last_visit": "YYYY-MM-DD"
                }
            ],
            "total": int
        }
    """
    from app.core.tool_runtime_context import get_tool_runtime_context
    from app.services.backend_client import get_backend_client

    try:
        # Lấy context từ tool execution
        context = get_tool_runtime_context()
        if not context:
            return {
                "error": "Không thể xác định thông tin staff. Vui lòng đăng nhập lại.",
                "pets": [],
                "total": 0,
            }

        user_id = context.user_id  # Staff ID
        clinic_id = context.clinic_id

        if not user_id or not clinic_id:
            return {
                "error": "Thiếu thông tin staff hoặc clinic. Vui lòng liên hệ admin.",
                "pets": [],
                "total": 0,
            }

        # Gọi backend API
        backend_client = get_backend_client()
        # Pending implementation - requires backend endpoint
        pets = [
            {
                "pet_id": "PET_001",
                "pet_name": "Cún",
                "species": "chó",
                "breed": "Golden Retriever",
                "owner_name": "Anh A",
                "last_visit": "2026-03-10",
            }
        ]

        # Filter by query_name if provided
        if query_name:
            pets = [
                pet for pet in pets if query_name.lower() in pet["pet_name"].lower()
            ]

        # Limit results
        pets = pets[:limit]

        return {"pets": pets, "total": len(pets)}

    except Exception as e:
        logger.error(f"Lỗi trong get_staff_patients: {e}")
        return {
            "error": f"Không thể lấy danh sách bệnh nhân: {str(e)}",
            "pets": [],
            "total": 0,
        }


@mcp_server.tool
async def get_patient_summary(
    pet_id: str,
) -> Dict[str, Any]:
    """
    Lấy tóm tắt nhanh hồ sơ y tế của một thú cưng: thông tin cơ bản, 2 lần khám gần nhất, và đường link hình ảnh y tế.

    Args:
        pet_id: ID của thú cưng

    Returns:
        {
            "pet_info": {
                "pet_id": "uuid",
                "pet_name": "Tên",
                "species": "chó/mèo",
                "breed": "giống",
                "weight_kg": 25.5,
                "allergies": ["thức ăn x"],
                "owner_name": "Tên chủ"
            },
            "recent_exams": [
                {
                    "exam_date": "YYYY-MM-DD",
                    "assessment": "Chẩn đoán",
                    "prescriptions": ["thuốc A", "thuốc B"],
                    "images": [{"url": "...", "description": "..."}]
                }
            ],
            "total_exams": int
        }
    """
    from app.core.tool_runtime_context import get_tool_runtime_context
    from app.services.backend_client import get_backend_client

    try:
        # Lấy context từ tool execution
        context = get_tool_runtime_context()
        if not context:
            return {
                "error": "Không thể xác định thông tin staff. Vui lòng đăng nhập lại.",
                "pet_info": {},
                "recent_exams": [],
                "total_exams": 0,
            }

        user_id = context.user_id  # Staff ID
        clinic_id = context.clinic_id

        if not user_id or not clinic_id:
            return {
                "error": "Thiếu thông tin staff hoặc clinic. Vui lòng liên hệ admin.",
                "pet_info": {},
                "recent_exams": [],
                "total_exams": 0,
            }

        # Gọi backend API
        backend_client = get_backend_client()
        # Pending implementation - requires backend endpoint
        pet_info = {
            "pet_id": pet_id,
            "pet_name": "Cún",
            "species": "chó",
            "breed": "Golden Retriever",
            "weight_kg": 28.0,
            "allergies": ["Gà"],
            "owner_name": "Anh A",
        }

        recent_exams = [
            {
                "exam_date": "2026-03-10",
                "assessment": "Viêm da dị ứng cấp",
                "prescriptions": ["Cortisone 5mg x7 ngày", "Dép thuốc Betadine"],
                "images": [
                    {
                        "url": "https://res.cloudinary.com/demo/image/upload/emr_PET_001_20260310_001.jpg",
                        "description": "Vùng da bị đỏ, ngứa ở bên tai trái",
                    }
                ],
            },
            {
                "exam_date": "2026-02-15",
                "assessment": "Tiêu ch양 légère",
                "prescriptions": ["Smecta 1 gói x3 ngày"],
                "images": [],
            },
        ]

        return {
            "pet_info": pet_info,
            "recent_exams": recent_exams,
            "total_exams": len(recent_exams),
        }

    except Exception as e:
        logger.error(f"Lỗi trong get_patient_summary: {e}")
        return {
            "error": f"Không thể lấy tóm tắt bệnh nhân: {str(e)}",
            "pet_info": {},
            "recent_exams": [],
            "total_exams": 0,
        }


@mcp_server.tool
async def get_emr_history(
    pet_id: str,
    limit: int = 5,
) -> Dict[str, Any]:
    """
    Lấy lịch sử bệnh án đầy đủ của một thú cưng với giới hạn số lượng lần khám.

    Args:
        pet_id: ID của thú cưng
        limit: Số lượng lần khám tối đa để trả về (mặc định: 5)

    Returns:
        {
            "emr_history": [
                {
                    "exam_date": "YYYY-MM-DD",
                    "doctor_name": "Tên bác sĩ",
                    "subjective": "Triệu chứng chủ quan",
                    "objective": "Các chỉ số khách quan",
                    "assessment": "Chẩn đoán",
                    "plan": "Kế hoạch điều trị",
                    "prescriptions": [{"name": "...", "dosage": "..."}],
                    "images": [{"url": "...", "description": "..."}]
                }
            ],
            "total": int
        }
    """
    from app.core.tool_runtime_context import get_tool_runtime_context
    from app.services.backend_client import get_backend_client

    try:
        # Lấy context từ tool execution
        context = get_tool_runtime_context()
        if not context:
            return {
                "error": "Không thể xác định thông tin staff. Vui lòng đăng nhập lại.",
                "emr_history": [],
                "total": 0,
            }

        user_id = context.user_id  # Staff ID
        clinic_id = context.clinic_id

        if not user_id or not clinic_id:
            return {
                "error": "Thiếu thông tin staff hoặc clinic. Vui lòng liên hệ admin.",
                "emr_history": [],
                "total": 0,
            }

        # Gọi backend API
        backend_client = get_backend_client()
        # Pending implementation - requires backend endpoint
        emr_history = [
            {
                "exam_date": "2026-03-10",
                "doctor_name": "BS. Nguyễn Văn A",
                "subjective": "Chủ quan: Cún ngứa liên tục 3 ngày, chủ quan thấy đỏ da tai",
                "objective": "Khách quan: Cân nặng 28kg, Nhiệt độ 38.5°C, Tai sinistra hyperemia",
                "assessment": "Viêm da dị ứng cấp do gà",
                "plan": "Ngừng ăn gà, uống cortisone 5mg x7 ngày, dùng Betadine lau vết",
                "prescriptions": [
                    {"name": "Cortisone", "dosage": "5mg x1/ngày x7 ngày"},
                    {"name": "Betadine Solution", "dosage": "Lau vết 2x/ngày"},
                ],
                "images": [
                    {
                        "url": "https://res.cloudinary.com/demo/image/upload/emr_PET_001_20260310_001.jpg",
                        "description": "Vùng da bị đỏ, ngứa ở bên tai trái",
                    },
                    {
                        "url": "https://res.cloudinary.com/demo/image/upload/emr_PET_001_20260310_002.jpg",
                        "description": "Tàiwane tai trái",
                    },
                ],
            },
            {
                "exam_date": "2026-02-15",
                "doctor_name": "BS. Trần Thị B",
                "subjective": "Chủ quan: Cún đi ngoài phân lỏng 4 lần/ngày 2 ngày",
                "objective": "Khách quan: Cân nặng 27.5kg, Nhiệt độ 38.2°C",
                "assessment": "Tiêu ch양 léger có thể do thay đổi thức ăn",
                "plan": "Uống Smecta 1 gói x3/ngày, ăn chè cháo 2 ngày",
                "prescriptions": [
                    {"name": "Smecta", "dosage": "1 gói x3/ngày x3 ngày"}
                ],
                "images": [],
            },
        ]

        # Limit results
        emr_history = emr_history[:limit]

        return {"emr_history": emr_history, "total": len(emr_history)}

    except Exception as e:
        logger.error(f"Lỗi trong get_emr_history: {e}")
        return {
            "error": f"Không thể lấy lịch sử bệnh án: {str(e)}",
            "emr_history": [],
            "total": 0,
        }


@mcp_server.tool
async def get_pet_health_summary(
    pet_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Tổng hợp thông tin sức khỏe của pet cho Pet Owner.

    Tool này tự động tổng hợp:
    - Thông tin pet cơ bản
    - EMR gần nhất (chẩn đoán, điều trị)
    - Cảnh báo mức độ nghiêm trọng (nếu có)
    - Gợi ý hành động

    Args:
        pet_id: ID của thú cưng
        user_id: ID của Pet Owner (để verify ownership)

    Returns:
        {
            "pet_info": {...},
            "latest_emr": {...},
            "health_warnings": [...],
            "medication_reminders": [...],
            "suggested_actions": [...],
            "disclaimer": "..."
        }
    """
    from app.core.tool_runtime_context import get_tool_runtime_context
    from app.services.backend_client import get_backend_client

    try:
        context = get_tool_runtime_context()
        if not context:
            return {
                "error": "Không thể xác định thông tin người dùng. Vui lòng đăng nhập lại.",
                "pet_info": None,
                "latest_emr": None,
            }

        backend = get_backend_client()

        pet_response = await backend.get(f"/pets/{pet_id}")
        if pet_response.status_code != 200:
            return {
                "error": "Không tìm thấy thú cưng",
                "pet_info": None,
            }

        pet_data = pet_response.json()

        if context.user_id != user_id:
            return {
                "error": "Bạn không có quyền xem thông tin sức khỏe của thú cưng này.",
                "pet_info": None,
            }

        emr_response = await backend.get(f"/emr/pet/{pet_id}?limit=1")
        latest_emr = None
        if emr_response.status_code == 200:
            emr_list = emr_response.json()
            if emr_list and len(emr_list) > 0:
                latest_emr = emr_list[0]

        warnings = []
        suggested_actions = []
        medication_reminders = []

        if latest_emr:
            assessment = latest_emr.get("assessment", "")
            plan = latest_emr.get("plan", "")
            exam_date = latest_emr.get("examDate", "")

            if exam_date:
                from datetime import datetime, timedelta, timezone

                try:
                    exam_dt = datetime.fromisoformat(exam_date.replace("Z", "+00:00"))
                    days_ago = (datetime.now(timezone.utc) - exam_dt).days
                    if days_ago > 30:
                        warnings.append(
                            {
                                "type": "RECHECK_REQUIRED",
                                "message": f"Đã {days_ago} ngày kể từ lần khám gần nhất. Cần tái khám.",
                                "severity": "MEDIUM",
                            }
                        )
                except:
                    pass

            if "dị ứng" in assessment.lower() or "allergy" in assessment.lower():
                warnings.append(
                    {
                        "type": "ALLERGY_ALERT",
                        "message": "Pet có tiền sử dị ứng. Cần thông báo cho bác sĩ trước khi điều trị.",
                        "severity": "HIGH",
                    }
                )

            if latest_emr.get("prescriptions"):
                for rx in latest_emr["prescriptions"]:
                    medication_reminders.append(
                        {
                            "medication": rx.get("medicineName", ""),
                            "dosage": rx.get("dosage", ""),
                            "frequency": rx.get("frequency", ""),
                        }
                    )

            suggested_actions.append(
                {
                    "type": "BOOK_APPOINTMENT",
                    "label": "Đặt lịch tái khám",
                    "reason": "Kiểm tra tiến triển sau điều trị",
                }
            )

        if not latest_emr:
            suggested_actions.append(
                {
                    "type": "BOOK_FIRST_VISIT",
                    "label": "Đặt lịch khám lần đầu",
                    "reason": "Pet chưa có lịch sử khám",
                }
            )

        pet_info = {
            "pet_id": pet_data.get("id"),
            "name": pet_data.get("name"),
            "species": pet_data.get("species"),
            "breed": pet_data.get("breed"),
            "age_months": pet_data.get("ageMonths") or pet_data.get("age_months"),
            "weight_kg": pet_data.get("weight"),
        }

        latest_emr_summary = None
        if latest_emr:
            latest_emr_summary = {
                "exam_date": latest_emr.get("examDate", ""),
                "clinic_name": latest_emr.get("clinicName", ""),
                "diagnosis": latest_emr.get("assessment", ""),
                "treatment": latest_emr.get("plan", ""),
                "subjective": latest_emr.get("subjective", ""),
                "objective": latest_emr.get("objective", ""),
            }

        return {
            "pet_info": pet_info,
            "latest_emr": latest_emr_summary,
            "health_warnings": warnings,
            "medication_reminders": medication_reminders,
            "suggested_actions": suggested_actions,
            "disclaimer": "Thông tin chỉ mang tính tham khảo. Vui lòng consult bác sĩ để được tư vấn chính xác.",
        }

    except Exception as e:
        logger.error(f"Lỗi trong get_pet_health_summary: {e}")
        return {
            "error": f"Không thể lấy thông tin sức khỏe: {str(e)}",
            "pet_info": None,
            "latest_emr": None,
            "health_warnings": [],
            "medication_reminders": [],
            "suggested_actions": [],
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Pet Care RAG Tools registered in FastMCP:")
    print(
        "  - pet_knowledge_search: Unified RAG tool for pet care Q&A + symptom analysis"
    )
    print("  - get_staff_patients: Get staff's patients list for quick lookup")
    print("  - get_patient_summary: Get quick summary of pet's medical record")
    print("  - get_emr_history: Get full EMR history of a pet")
    print("\nThese tools use:")
    print("  - Cohere embed-multilingual-v3.0 for Vietnamese support")
    print("  - Qdrant vector database for similarity search")
    print("  - LlamaIndex for document processing")
