"""
PETTIES AGENT SERVICE - Pet Care RAG Tools (FastMCP)

Code-based tools for Single Agent - RAG-based Q&A and symptom checking.
Uses Cohere embeddings + Qdrant vector search.

Package: app.core.tools.mcp_tools
Purpose:
    - RAG-based knowledge search for pet care & symptom analysis
    - Web search fallback for additional information
    - Vietnamese language support via Cohere multilingual

Tools:
    - pet_knowledge_search: Unified RAG tool for pet care Q&A + symptom analysis
    - web_search: Web fallback for pet/vet questions

Reference: Technical Scope - Single Agent with ReAct pattern
Version: v2.0.0 (Merged pet_care_qa + symptom_search into pet_knowledge_search)
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List, Optional
from loguru import logger
import re
import asyncio

from duckduckgo_search import DDGS

from app.config.settings import settings


# NOTE: Không dùng STOP_WORDS — để LLM tự xử lý ngữ nghĩa.
# Chỉ giữ PET_GUARD (safety), PENALTY_DOMAINS (scoring), GENERIC_CONTENT_PATTERNS.

# --- PET GUARD (bilingual - chỉ dùng cho safety check, không scoring) ---
PET_GUARD_KEYWORDS = {
    # Vietnamese
    "chó",
    "cho",
    "cún",
    "cun",
    "mèo",
    "meo",
    "thú cưng",
    "thu cung",
    "thú y",
    "thu y",
    "thú nuôi",
    "thu nuoi",
    "tiêu chảy",
    "tieu chay",
    "nôn",
    "ăn",
    "dinh dưỡng",
    "ký sinh trùng",
    "triệu chứng",
    "bệnh",
    # English
    "dog",
    "cat",
    "pet",
    "puppy",
    "kitten",
    "vet",
    "veterinary",
    "veterinarian",
    "animal",
    "parvo",
    "distemper",
    "diarrhea",
    "vomit",
    "vaccine",
    "vaccination",
    "grooming",
    "clinic",
    "symptom",
    "disease",
    "treatment",
    "nutrition",
    "diet",
    "feed",
}

# --- DOMAIN-BASED PENALTIES (language-agnostic) ---
PENALTY_DOMAINS = {
    "wikipedia.org": 4,
    "en.wikipedia.org": 4,
    "vi.wikipedia.org": 4,
    "fandom.com": 3,
    "pinterest.com": 3,
    "youtube.com": 2,
}

# Regex patterns cho generic content (language-agnostic)
GENERIC_CONTENT_PATTERNS = [
    re.compile(r"top\s*\d+", re.IGNORECASE),
    re.compile(r"\d+\s*(giống|breeds?|loại|types?|best)", re.IGNORECASE),
    re.compile(r"(most popular|phổ biến nhất|nổi tiếng nhất)", re.IGNORECASE),
]


def _clean_rag_text(text: str) -> str:
    cleaned = text.replace("", " ").replace("•", " ").replace("□", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    return cleaned.strip()


def _tokenize(text: str) -> List[str]:
    """Language-agnostic tokenizer: tách thành tokens (>= 2 ký tự)."""
    tokens = re.findall(r"[\wÀ-ỹ]+", text.lower())
    return [t for t in tokens if len(t) >= 2]


def _extract_query_keywords(query: str) -> List[str]:
    """Extract meaningful keywords từ query (bilingual)."""
    return _tokenize(query)


def _is_pet_related_query(query: str) -> bool:
    """Check xem query có liên quan pet/vet không (bilingual guard)."""
    normalized_query = query.lower().strip()
    return any(keyword in normalized_query for keyword in PET_GUARD_KEYWORDS)


def _extract_domain(url: str) -> str:
    """Trích domain từ URL."""
    match = re.search(r"https?://(?:www\.)?([^/]+)", url.lower())
    return match.group(1) if match else ""


def _score_web_result(query: str, title: str, snippet: str, url: str) -> int:
    """Scoring dựa trên domain penalties — DuckDuckGo đã xếp hạng relevance rồi.

    Không dùng keyword/token matching. LLM sẽ tự hiểu ngữ cảnh kết quả.
    Scoring chỉ penalize nguồn kém chất lượng (Wikipedia, social media, etc.).
    """
    # Base score: DuckDuckGo đã lọc relevance, mặc định tin tưởng
    score = 5

    # Domain-based penalties (không phải keyword matching — domain filtering)
    domain = _extract_domain(url)
    for penalty_domain, penalty_score in PENALTY_DOMAINS.items():
        if penalty_domain in domain:
            score -= penalty_score
            break

    # Generic content patterns penalties (regex, language-agnostic)
    combined_text = f"{title} {snippet}".lower()
    for pattern in GENERIC_CONTENT_PATTERNS:
        if pattern.search(combined_text):
            score -= 3
            break

    return score


def _build_search_query(query: str) -> str:
    """Trả về query nguyên gốc — không thêm context, để LLM tự xử lý."""
    return query.strip()


def _deduplicate_scored_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen = set()

    for item in results:
        title = _clean_rag_text(str(item.get("title", ""))).lower()
        snippet = _clean_rag_text(str(item.get("snippet", ""))).lower()
        url = str(item.get("url", "")).lower()
        fingerprint = (title[:120], snippet[:160], url)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        deduped.append(item)

    return deduped


def _perform_duckduckgo_search(query: str, max_results: int) -> List[Dict[str, Any]]:
    search_query = _build_search_query(query)
    logger.info(f"web_search: expanded query = '{search_query}'")

    with DDGS() as ddgs:
        raw_results = list(
            ddgs.text(
                search_query,
                max_results=max(max_results, 8),
                safesearch="moderate",
                region="wt-wt",
            )
        )

    logger.info(f"web_search: DuckDuckGo returned {len(raw_results)} raw results")

    strict_results: List[Dict[str, Any]] = []
    relaxed_results: List[Dict[str, Any]] = []
    for item in raw_results:
        title = _clean_rag_text(str(item.get("title", "")))
        snippet = _clean_rag_text(str(item.get("body", "")))
        url = str(item.get("href", ""))
        combined_text = f"{title} {snippet}".lower()

        if not any(keyword in combined_text for keyword in PET_GUARD_KEYWORDS):
            logger.debug(f"web_search: SKIP (no pet keyword): {title[:60]}")
            continue

        score = _score_web_result(query, title, snippet, url)
        logger.debug(f"web_search: score={score} | {title[:60]}")

        result_dict = {
            "title": title,
            "snippet": snippet[:280],
            "url": url,
            "source": url,
            "score": score,
        }

        # Relaxed: score >= 1 (fallback khi strict rỗng)
        if score >= 1:
            relaxed_results.append(result_dict)

        # Strict: score >= 4
        if score >= 4:
            strict_results.append(result_dict)

    strict_results.sort(key=lambda x: x.get("score", 0), reverse=True)
    strict_results = _deduplicate_scored_results(strict_results)
    if strict_results:
        logger.info(
            f"web_search: returning {len(strict_results[:max_results])} strict results"
        )
        return strict_results[:max_results]

    # Fallback: dùng relaxed results nếu strict rỗng
    relaxed_results.sort(key=lambda x: x.get("score", 0), reverse=True)
    relaxed_results = _deduplicate_scored_results(relaxed_results)
    logger.info(
        f"web_search: strict=0, returning {len(relaxed_results[:max_results])} relaxed results"
    )
    return relaxed_results[:max_results]


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


@mcp_server.tool
async def web_search(
    query: str,
    max_results: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Tìm kiếm thông tin từ web khi knowledge base chưa có đủ dữ liệu.

    Chỉ sử dụng tool này cho các câu hỏi liên quan đến thú cưng, thú y,
    chăm sóc, dinh dưỡng, triệu chứng hoặc điều trị tham khảo.

    Tool này trả về raw data từ web. LLM sẽ tự tổng hợp và format câu trả lời.

    Args:
        query: Câu hỏi cần tìm trên web
        max_results: Số lượng kết quả tối đa (mặc định lấy từ config)

    Returns:
        Dict chứa:
            - query: str - Câu hỏi gốc
            - results: List[Dict] - Danh sách kết quả web ({title, snippet, url, source, score})
            - sources_used: int - Số nguồn tìm được
            - search_source: str - "web_search"
    """
    effective_max_results = max_results or settings.DUCKDUCKGO_MAX_RESULTS

    if not _is_pet_related_query(query):
        return {
            "query": query,
            "results": [],
            "sources_used": 0,
            "search_source": "web_search",
            "error": "Query ngoài phạm vi thú cưng/thú y",
        }

    try:
        results = await asyncio.wait_for(
            asyncio.to_thread(_perform_duckduckgo_search, query, effective_max_results),
            timeout=15.0,
        )

        logger.info(
            f"web_search: Found {len(results)} results for query: {query[:50]}..."
        )

        return {
            "query": query,
            "results": results,
            "sources_used": len(results),
            "search_source": "web_search",
        }
    except asyncio.TimeoutError:
        logger.warning("web_search: DuckDuckGo timed out after 15s")
        return {
            "query": query,
            "results": [],
            "sources_used": 0,
            "search_source": "web_search",
            "error": "Tìm kiếm web bị timeout sau 15 giây",
        }
    except Exception as e:
        logger.error(f"Lỗi trong web_search: {e}")
        return {
            "query": query,
            "results": [],
            "sources_used": 0,
            "search_source": "web_search",
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
        # TODO: Implement actual API call once backend endpoint is available
        # For now, return mock data for development
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
        # TODO: Implement actual API call once backend endpoint is available
        # For now, return mock data for development
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
        # TODO: Implement actual API call once backend endpoint is available
        # For now, return mock data for development
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


# Hàm legacy đã bị vô hiệu hóa và giữ lại tạm thời để tránh lỗi import cũ.
# @mcp_server.tool
async def _legacy_disabled_image_analysis(
    image_url: str,
    context: str = "",
) -> Dict[str, Any]:
    """
    Phân tích hình ảnh y tế thú cưng để chẩn đoán sơ bộ.
    Tool này sẽ gọi LSTM với khả năng xử lý hình ảnh để đưa ra kết quả chuyên môn.

    Args:
        image_url: URL của hình ảnh cần phân tích (phải là đường link công khai)
        context: Mô tả thêm về tình hình thú cưng (tùy chọn)

    Returns:
        {
            "diagnosis": "Chẩn đoán chính",
            "differential_diagnoses": ["Chẩn đoán khác khả năng"],
            "confidence": 0.0-1.0,
            "severity": "mild|moderate|severe",
            "affected_areas": ["vùng cơ thể bị ảnh hưởng"],
            "possible_causes": ["nguyên nhân có thể"],
            "recommended_actions": ["hành động đề xuất"],
            "disclaimer": "Lưu ý pháp lý"
        }
    """
    return {
        "status": "disabled",
        "error": "Tính năng AI chẩn đoán qua ảnh cũ hiện đang được tạm dừng để chuyển sang kiến trúc mới.",
        "diagnosis": "",
        "confidence": 0.0,
    }

    try:
        # Validate image URL
        if not image_url or not isinstance(image_url, str):
            return {
                "error": "URL hình ảnh không hợp lệ",
                "diagnosis": "",
                "confidence": 0.0,
            }

        # Lấy LLM client
        llm_client = get_llm_client()

        # Tạo prompt chuyên sâu cho chẩn đoán hình ảnh thú y
        prompt = f"""
Bạn là bác sĩ thú y có 10 năm kinh nghiệm. Hãy phân tích hình ảnh y tế thú cưng này và đưa ra chẩn đoán sơ bộ.

YÊU CẦU:
1. Xác định rõ vùng cơ thể trong hình (tai, mắt, da, chân, miệng...)
2. Mô tả các biểu hiện lâm sàng thấy được (sưng, đỏ, phỏng, loét, xuất tiết...)
3. Đưa ra chẩn đoán chính nhất
4. Liệt kê 2-3 chẩn đoán phân biệt có khả năng
5. Đánh giá mức độ nghiêm trọng (mild/moderate/severe)
6. Gợi ý nguyên nhân có thể
7. Đề xuất các bước kiểm tra tiếp theo hoặc xử lý ban đầu

NGỮ CẦM THÊM (nếu có): {context}

HƯỚNG DẪN TRẢ LỜI:
Trả về DUY NHẤT một đối tượng JSON với cấu trúc sau:
{{
  "diagnosis": "Chẩn đoán chính",
  "differential_diagnoses": ["Chẩn đoán khác 1", "Chẩn đoán khác 2"],
  "confidence": 0.85,
  "severity": "mild|moderate|severe",
  "affected_areas": ["tai trái", "mắt phải"],
  "possible_causes": ["dị ứng thức ăn", "trùng nấm"],
  "recommended_actions": ["Xét� odp התחלה ф"],
  "disclaimer": "Kết quả này chỉ là tư vấn sơ bộ. Cần đến phòng khám để chẩn đoán xác định và điều trị."
}}

LƯU Ý:
- Giá trị confidence phải là số thực từ 0.0 đến 1.0
- severity chỉ được phép là một trong ba giá trị: "mild", "moderate", "severe"
- Mọi trường đều bắt buộc phải có trong JSON trả về
- KHÔNG được giải thích thêm ngoài JSON
        """.strip()

        # Xác định xem image_url là URL hay base64
        if image_url.startswith("http://") or image_url.startswith("https://"):
            # URL trực tiếp
            image_data = image_url
        elif image_url.startswith("data:"):
            # Data URL
            image_data = image_url
        else:
            # Giả sử là base64 thuần
            image_data = f"data:image/jpeg;base64,{image_url}"

        # Gọi LLM để phân tích hình ảnh
        try:
            # TODO: Integrate with actual multimodal LLM once available
            # For now, return mock analysis for development

            # Mock response for development
            result = {
                "diagnosis": "Viêm da dị ứng cấp",
                "differential_diagnoses": ["Trùng nấm da", "Viêm da do d kiến cắn"],
                "confidence": 0.82,
                "severity": "moderate",
                "affected_areas": ["tai trái", "vùng môi"],
                "possible_causes": [
                    "Dị ứng proteína gà trong thức ăn",
                    "Tiếp xúc với chất kích thích trong môi trường",
                ],
                "recommended_actions": [
                    "Ngay lập tức ngừng cho ăn gà và các sản phẩm từ gà",
                    "Rửa sạch vùng da bị ố bằng nước muối sinh lý 0.9%",
                    "Theo dõi trong 24h, nếu ngày càng ghi vàng hoặc ứ nước cần đến khám ngay",
                    "Đến khám lại sau 48h để đánh giá lại tình trạng",
                ],
                "disclaimer": "Kết quả này chỉ là tư vấn sơ bộ. Cần đến phòng khám để chẩn đoán xác định và điều trị.",
            }

            return result

        except Exception as llm_error:
            logger.error(f"Lỗi khi gọi LLM để phân tích hình ảnh: {llm_error}")
            return {
                "error": f"Không thể phân tích hình ảnh do lỗi hệ thống: {str(llm_error)}",
                "diagnosis": "Không thể xác định",
                "confidence": 0.0,
            }

    except Exception as e:
        logger.error(f"Lỗi trong _legacy_disabled_image_analysis: {e}")
        return {
            "error": f"Không thể xử lý yêu cầu phân tích hình ảnh: {str(e)}",
            "diagnosis": "",
            "confidence": 0.0,
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Pet Care RAG Tools registered in FastMCP:")
    print(
        "  - pet_knowledge_search: Unified RAG tool for pet care Q&A + symptom analysis"
    )
    print("  - web_search: Web fallback for pet/vet questions")
    print("  - get_staff_patients: Get staff's patients list for quick lookup")
    print("  - get_patient_summary: Get quick summary of pet's medical record")
    print("  - get_emr_history: Get full EMR history of a pet")
    # Legacy image-analysis entry đã bị gỡ khỏi runtime.
    print("\nThese tools use:")
    print("  - Cohere embed-multilingual-v3.0 for Vietnamese support")
    print("  - Qdrant vector database for similarity search")
    print("  - LlamaIndex for document processing")
