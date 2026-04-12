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
import time

from app.config.settings import settings
from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
    classify_error_code,
)
from app.core.tools.auth_deps import _require_auth_token


def _clean_rag_text(text: str) -> str:
    cleaned = text.replace("", " ").replace("•", " ").replace("□", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    return cleaned.strip()


def _normalize_pet_species(value: Any) -> str:
    if value is None:
        return "Không rõ"
    text = str(value).strip()
    lowered = text.lower()
    if lowered in {"dog", "cho", "chó"}:
        return "chó"
    if lowered in {"cat", "meo", "mèo"}:
        return "mèo"
    return text


def _normalize_allergies(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _format_exam_date(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return text.replace("T", " ")[:19]


def _map_emr_images(images: Any) -> List[Dict[str, Any]]:
    if not isinstance(images, list):
        return []
    mapped: List[Dict[str, Any]] = []
    for item in images:
        if not isinstance(item, dict):
            continue
        mapped.append(
            {
                "url": item.get("url"),
                "description": item.get("description") or "",
            }
        )
    return mapped


def _map_emr_prescriptions(prescriptions: Any) -> List[Dict[str, Any]]:
    if not isinstance(prescriptions, list):
        return []
    mapped: List[Dict[str, Any]] = []
    for item in prescriptions:
        if not isinstance(item, dict):
            continue
        mapped.append(
            {
                "name": item.get("medicineName") or item.get("name") or "",
                "dosage": item.get("dosage") or "",
                "frequency": item.get("frequency") or "",
                "duration_days": item.get("durationDays"),
                "instructions": item.get("instructions") or "",
            }
        )
    return mapped


def _build_auth_error_response(message: str) -> Dict[str, Any]:
    return build_tool_error_response(
        error_code="UNAUTHORIZED",
        message=message,
        recoverable=True,
        suggestion="Vui lòng đăng nhập lại rồi thử lại.",
    )


# ===== RAG TOOLS =====


@mcp_server.tool
async def pet_knowledge_search(
    query: str,
    pet_type: str = "dog",
    top_k: int = 5,
    min_score: float = 0.4,
    enable_case_memory: bool = True,
    enable_query_expansion: bool = True,
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
        started = time.perf_counter()

        # Hybrid query (RAG + KG + Case Memory)
        # NOTE: hybrid.query() đã gọi QueryExpander bên trong,
        #       KHÔNG expand ở đây để tránh duplicate expansion.
        hybrid_result = await hybrid.query(
            query=query,
            top_k=top_k,
            min_score=min_score,
            pet_type=pet_type,
            enable_rag=True,
            enable_case_memory=enable_case_memory,
            enable_query_expansion=enable_query_expansion,
        )
        query_expanded = hybrid_result.expanded_query != hybrid_result.original_query

        # Map HybridChunk -> tool schema (backward-compatible)
        formatted_results = []
        for c in hybrid_result.chunks or []:
            meta = c.metadata or {}
            if c.source == "rag":
                source_label = meta.get("document_name") or "Knowledge Base"
                chunk_index = meta.get("chunk_index")
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
            f"(expanded={query_expanded}, case_memory={enable_case_memory}) "
            f"for query: {query[:50]}... in {int((time.perf_counter() - started) * 1000)}ms"
        )

        total_ms = int((time.perf_counter() - started) * 1000)
        hybrid_timings = dict(hybrid_result.timings_ms or {})
        hybrid_timings["total"] = max(int(hybrid_timings.get("total", 0)), total_ms)

        return build_tool_success_response(
            {
                "query": query,
                "expanded_query": (
                    hybrid_result.expanded_query if query_expanded else None
                ),
                "pet_type": pet_type,
                "results": formatted_results,
                "sources_used": len(formatted_results),
                "search_source": "knowledge_base",
            },
            metadata={
                "timing_ms": {
                    **hybrid_timings,
                },
                "retrieval_profile": {
                    "enable_rag": True,
                    "enable_case_memory": enable_case_memory,
                    "enable_query_expansion": enable_query_expansion,
                    "top_k": top_k,
                    "min_score": min_score,
                },
                "sources_used": hybrid_result.sources_used,
            },
        )

    except Exception as e:
        logger.error(f"Lỗi trong pet_knowledge_search: {e}")
        return build_tool_error_response(
            error_code=classify_error_code(str(e)),
            message="Không thể tra cứu kiến thức thú cưng lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút.",
            metadata={
                "query": query,
                "pet_type": pet_type,
                "search_source": "knowledge_base",
                "root_error": str(e),
            },
        )


# ===== STAFF DIAGNOSTIC SUPPORT TOOLS =====
@mcp_server.tool
async def get_staff_patients(
    query_name: Optional[str] = None,
    limit: int = 10,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
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
            return _build_auth_error_response(
                "Không thể xác định thông tin staff. Vui lòng đăng nhập lại."
            )

        user_id = context.user_id  # Staff ID
        clinic_id = context.clinic_id
        token = context.auth_token

        if not user_id or not clinic_id or not token:
            return build_tool_error_response(
                error_code="INVALID_CONTEXT",
                message="Thiếu thông tin staff hoặc clinic. Vui lòng liên hệ admin.",
                recoverable=False,
                suggestion="Vui lòng kiểm tra cấu hình tài khoản và quyền truy cập.",
            )

        backend_client = get_backend_client()
        raw_patients = await backend_client.get_staff_patients(
            token=token,
            clinic_id=clinic_id,
            staff_id=user_id,
        )

        patients: List[Dict[str, Any]] = []
        normalized_query = (query_name or "").strip().lower()

        for item in raw_patients or []:
            if not isinstance(item, dict):
                continue
            pet_name = str(item.get("petName") or "").strip()
            owner_name = str(item.get("ownerName") or "").strip()
            if normalized_query and normalized_query not in pet_name.lower():
                continue

            patients.append(
                {
                    "pet_id": item.get("petId"),
                    "pet_name": pet_name,
                    "species": _normalize_pet_species(item.get("species")),
                    "breed": item.get("breed") or "Không rõ",
                    "gender": item.get("gender") or "Không rõ",
                    "age_years": item.get("ageYears"),
                    "age_months": item.get("ageMonths"),
                    "weight": item.get("weight"),
                    "owner_name": owner_name or "Không rõ",
                    "owner_phone": item.get("ownerPhone") or "",
                    "booking_id": item.get("bookingId"),
                    "booking_code": item.get("bookingCode") or "",
                    "booking_status": item.get("bookingStatus") or "",
                    "is_assigned_to_me": bool(item.get("isAssignedToMe")),
                    "next_appointment": _format_exam_date(item.get("nextAppointment")),
                    "last_visit": _format_exam_date(item.get("lastVisitDate")),
                }
            )

        patients = patients[:limit]
        return build_tool_success_response({"pets": patients, "total": len(patients)})

    except Exception as e:
        logger.error(f"Lỗi trong get_staff_patients: {e}")
        return build_tool_error_response(
            error_code=classify_error_code(str(e)),
            message="Không thể lấy danh sách bệnh nhân lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút.",
            metadata={"root_error": str(e)},
        )


@mcp_server.tool
async def get_patient_summary(
    pet_id: Optional[str] = None,
    pet_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lấy tóm tắt nhanh hồ sơ y tế của một thú cưng.
    Nếu không có pet_id, hãy truyền pet_name_hint để tool tự tra cứu.

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
            return _build_auth_error_response(
                "Không thể xác định thông tin staff. Vui lòng đăng nhập lại."
            )

        user_id = context.user_id  # Staff ID
        clinic_id = context.clinic_id
        token = context.auth_token

        if not user_id or not clinic_id or not token:
            return build_tool_error_response(
                error_code="INVALID_CONTEXT",
                message="Thiếu thông tin staff hoặc clinic. Vui lòng liên hệ admin.",
                recoverable=False,
                suggestion="Vui lòng kiểm tra cấu hình tài khoản và quyền truy cập.",
            )

        backend_client = get_backend_client()

        # Resolve pet_id from pet_name_hint if pet_id is missing
        if not pet_id and pet_name_hint:
            from app.core.agents.booking_context import fuzzy_match_pet_name

            # Staff search (clinic-wide)
            patients_data = await backend_client.get_staff_patients(
                token, clinic_id, user_id
            )
            # Map patients back to Pet objects for fuzzy_match (need id and name)
            pet_list = [
                {"id": p.get("petId"), "name": p.get("petName")}
                for p in (patients_data or [])
            ]
            matched = fuzzy_match_pet_name(pet_name_hint, pet_list)
            if matched:
                pet_id = matched.get("id")

        if not pet_id:
            return build_tool_error_response(
                error_code="PET_NOT_FOUND",
                message=f"Không tìm thấy thú cưng có tên '{pet_name_hint}'.",
                recoverable=True,
                suggestion="Vui lòng kiểm tra lại tên hoặc dùng tool 'get_staff_patients'.",
            )

        pet = await backend_client.get_pet(token, pet_id)
        emr_history = await backend_client.get_pet_emr_history(
            token=token, pet_id=pet_id
        )

        pet_info = {
            "pet_id": pet.get("id"),
            "pet_name": pet.get("name") or "Không rõ",
            "species": _normalize_pet_species(pet.get("species")),
            "breed": pet.get("breed") or "Không rõ",
            "weight_kg": pet.get("weight"),
            "allergies": _normalize_allergies(pet.get("allergies")),
            "owner_name": pet.get("ownerName") or "Không rõ",
            "owner_phone": pet.get("ownerPhone") or "",
            "gender": pet.get("gender") or "Không rõ",
            "color": pet.get("color") or "Không rõ",
        }

        recent_exams: List[Dict[str, Any]] = []
        for exam in (emr_history or [])[:3]:
            if not isinstance(exam, dict):
                continue
            prescriptions = _map_emr_prescriptions(exam.get("prescriptions"))
            recent_exams.append(
                {
                    "emr_id": exam.get("id"),
                    "exam_date": _format_exam_date(
                        exam.get("examinationDate") or exam.get("createdAt")
                    ),
                    "assessment": exam.get("assessment") or "",
                    "plan": exam.get("plan") or "",
                    "staff_name": exam.get("staffName") or "",
                    "booking_code": exam.get("bookingCode") or "",
                    "prescriptions": [
                        item["name"] for item in prescriptions if item.get("name")
                    ],
                    "images": _map_emr_images(exam.get("images")),
                }
            )

        return build_tool_success_response(
            {
                "pet_info": pet_info,
                "recent_exams": recent_exams,
                "total_exams": len(recent_exams),
            }
        )

    except Exception as e:
        logger.error(f"Lỗi trong get_patient_summary: {e}")
        return build_tool_error_response(
            error_code=classify_error_code(str(e)),
            message="Không thể lấy tóm tắt bệnh nhân lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút.",
            metadata={"pet_id": pet_id, "root_error": str(e)},
        )


@mcp_server.tool
async def get_emr_history(
    pet_id: Optional[str] = None,
    pet_name_hint: Optional[str] = None,
    limit: int = 5,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lấy lịch sử bệnh án đầy đủ của một thú cưng.
    Hỗ trợ tìm kiếm theo pet_name_hint nếu không có pet_id chính xác.

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
            return _build_auth_error_response(
                "Không thể xác định thông tin staff. Vui lòng đăng nhập lại."
            )

        user_id = context.user_id  # Staff ID
        clinic_id = context.clinic_id
        token = context.auth_token

        if not user_id or not clinic_id or not token:
            return build_tool_error_response(
                error_code="INVALID_CONTEXT",
                message="Thiếu thông tin staff hoặc clinic. Vui lòng liên hệ admin.",
                recoverable=False,
                suggestion="Vui lòng kiểm tra cấu hình tài khoản và quyền truy cập.",
            )

        backend_client = get_backend_client()

        # Resolve pet_id from pet_name_hint if pet_id is missing
        if not pet_id and pet_name_hint:
            from app.core.agents.booking_context import fuzzy_match_pet_name

            patients_data = await backend_client.get_staff_patients(
                token, clinic_id, user_id
            )
            pet_list = [
                {"id": p.get("petId"), "name": p.get("petName")}
                for p in (patients_data or [])
            ]
            matched = fuzzy_match_pet_name(pet_name_hint, pet_list)
            if matched:
                pet_id = matched.get("id")

        if not pet_id:
            return build_tool_error_response(
                error_code="PET_NOT_FOUND",
                message=f"Không tìm thấy thú cưng có tên '{pet_name_hint}'.",
                recoverable=True,
                suggestion="Vui lòng kiểm tra lại tên hoặc dùng tool 'get_staff_patients'.",
            )

        raw_history = await backend_client.get_pet_emr_history(
            token=token, pet_id=pet_id
        )
        emr_history: List[Dict[str, Any]] = []

        for exam in (raw_history or [])[:limit]:
            if not isinstance(exam, dict):
                continue
            emr_history.append(
                {
                    "emr_id": exam.get("id"),
                    "exam_date": _format_exam_date(
                        exam.get("examinationDate") or exam.get("createdAt")
                    ),
                    "doctor_name": exam.get("staffName") or "Không rõ",
                    "subjective": exam.get("subjective") or "",
                    "objective": exam.get("objective") or "",
                    "assessment": exam.get("assessment") or "",
                    "plan": exam.get("plan") or "",
                    "notes": exam.get("notes") or "",
                    "booking_code": exam.get("bookingCode") or "",
                    "weight_kg": exam.get("weightKg"),
                    "temperature_c": exam.get("temperatureC"),
                    "heart_rate": exam.get("heartRate"),
                    "bcs": exam.get("bcs"),
                    "prescriptions": _map_emr_prescriptions(exam.get("prescriptions")),
                    "images": _map_emr_images(exam.get("images")),
                }
            )

        return build_tool_success_response(
            {"emr_history": emr_history, "total": len(emr_history)}
        )

    except Exception as e:
        logger.error(f"Lỗi trong get_emr_history: {e}")
        return build_tool_error_response(
            error_code=classify_error_code(str(e)),
            message="Không thể lấy lịch sử bệnh án lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút.",
            metadata={"pet_id": pet_id, "root_error": str(e)},
        )


@mcp_server.tool
async def get_pet_health_summary(
    pet_id: Optional[str] = None,
    pet_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Tổng hợp thông tin sức khỏe của pet cho Pet Owner.
    Dễ dàng tra cứu bằng pet_name_hint thay vì pet_id.

    Sử dụng khi:
    - User muốn xem tổng quan sức khỏe của thú cưng
    - User hỏi về tình trạng sức khỏe gần đây của pet
    - User muốn biết có cần tái khám không

    Tool này tự động tổng hợp:
    - Thông tin pet cơ bản (tên, loài, giống, cân nặng)
    - EMR gần nhất (chẩn đoán, điều trị, thuốc đang dùng)
    - Cảnh báo mức độ nghiêm trọng (nếu có): dị ứng, cần tái khám
    - Gợi ý hành động tiếp theo

    Args:
        pet_id: ID của thú cưng cần xem
        user_id: ID của Pet Owner (để verify ownership - user chỉ xem được pet của mình)

    Examples:
        get_pet_health_summary(pet_id="xxx", user_id="yyy")
        # Trả về pet_info, latest_emr, health_warnings, suggested_actions

    Returns:
        pet_info: Thông tin cơ bản của pet
        latest_emr: Bệnh án gần nhất (chẩn đoán, điều trị, thuốc)
        health_warnings: Cảnh báo sức khỏe (dị ứng, cần tái khám)
        medication_reminders: Nhắc nhở thuốc đang dùng
        suggested_actions: Gợi ý hành động (đặt lịch tái khám)
        disclaimer: Thông tin chỉ mang tính tham khảo
    """
    from app.core.tool_runtime_context import get_tool_runtime_context
    from app.services.backend_client import get_backend_client

    try:
        context = get_tool_runtime_context()
        if not context:
            return _build_auth_error_response(
                "Không thể xác định thông tin người dùng. Vui lòng đăng nhập lại."
            )

        try:
            token = _require_auth_token()
        except Exception as exc:
            return _build_auth_error_response(str(exc))

        resolved_user_id = str(context.user_id).strip()
        requested_user_id = str(user_id or "").strip()
        if requested_user_id and requested_user_id != resolved_user_id:
            logger.warning(
                "Tu choi user_id tu tool input vi khong khop session trong get_pet_health_summary: "
                f"input={requested_user_id}, runtime={resolved_user_id}"
            )
            return _build_auth_error_response("User ID khong khop voi session hien tai")

        backend = get_backend_client()

        # Resolve pet_id from pet_name_hint if pet_id is missing
        if not pet_id and pet_name_hint:
            from app.core.agents.booking_context import fuzzy_match_pet_name

            pets_data = await backend.get_user_pets(token, resolved_user_id)
            matched = fuzzy_match_pet_name(pet_name_hint, pets_data)
            if matched:
                pet_id = matched.get("id")

        if not pet_id:
            return build_tool_error_response(
                error_code="PET_NOT_FOUND",
                message=f"Không tìm thấy thú cưng có tên '{pet_name_hint}'.",
                recoverable=True,
                suggestion="Vui lòng dùng 'get_user_pets' để xem danh sách bé nhà mình.",
            )

        pet_data = await backend.get_pet(token, pet_id)
        emr_list = await backend.get_pet_emr_history(token=token, pet_id=pet_id)
        latest_emr = emr_list[0] if isinstance(emr_list, list) and emr_list else None

        warnings = []
        suggested_actions = []
        medication_reminders = []

        if latest_emr:
            assessment = latest_emr.get("assessment", "")
            exam_date = (
                latest_emr.get("examDate") or latest_emr.get("examinationDate") or ""
            )

            if exam_date:
                from datetime import datetime, timezone

                try:
                    normalized_exam_date = str(exam_date).replace("Z", "+00:00")
                    exam_dt = datetime.fromisoformat(normalized_exam_date)
                    if exam_dt.tzinfo is None:
                        exam_dt = exam_dt.replace(tzinfo=timezone.utc)
                    days_ago = (datetime.now(timezone.utc) - exam_dt).days
                    if days_ago > 30:
                        warnings.append(
                            {
                                "type": "RECHECK_REQUIRED",
                                "message": f"Đã {days_ago} ngày kể từ lần khám gần nhất. Cần tái khám.",
                                "severity": "MEDIUM",
                            }
                        )
                except Exception:
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
                            "medication": rx.get("medicineName")
                            or rx.get("name")
                            or "",
                            "dosage": rx.get("dosage") or "",
                            "frequency": rx.get("frequency") or "",
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
            "species": _normalize_pet_species(pet_data.get("species")),
            "breed": pet_data.get("breed") or "Không rõ",
            "age_months": pet_data.get("ageMonths") or pet_data.get("age_months"),
            "weight_kg": pet_data.get("weight"),
            "allergies": _normalize_allergies(pet_data.get("allergies")),
        }

        latest_emr_summary = None
        if latest_emr:
            latest_emr_summary = {
                "exam_date": _format_exam_date(
                    latest_emr.get("examDate")
                    or latest_emr.get("examinationDate")
                    or latest_emr.get("createdAt")
                ),
                "clinic_name": latest_emr.get("clinicName", ""),
                "diagnosis": latest_emr.get("assessment", ""),
                "treatment": latest_emr.get("plan", ""),
                "subjective": latest_emr.get("subjective", ""),
                "objective": latest_emr.get("objective", ""),
                "images": _map_emr_images(latest_emr.get("images")),
                "prescriptions": _map_emr_prescriptions(
                    latest_emr.get("prescriptions")
                ),
            }

        return build_tool_success_response(
            {
                "pet_info": pet_info,
                "latest_emr": latest_emr_summary,
                "health_warnings": warnings,
                "medication_reminders": medication_reminders,
                "suggested_actions": suggested_actions,
                "disclaimer": "Thông tin chỉ mang tính tham khảo. Vui lòng tham vấn bác sĩ để được tư vấn chính xác.",
            }
        )

    except Exception as e:
        logger.error(f"Lỗi trong get_pet_health_summary: {e}")
        return build_tool_error_response(
            error_code=classify_error_code(str(e)),
            message="Không thể lấy thông tin sức khỏe thú cưng lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút.",
            metadata={"pet_id": pet_id, "root_error": str(e)},
        )


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
