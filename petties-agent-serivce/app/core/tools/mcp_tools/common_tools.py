"""
PETTIES AGENT SERVICE - Common Tools (FastMCP)

Code-based tools for Single Agent - Web search and utilities.

Package: app.core.tools.mcp_tools
Purpose:
    - Web search using Tavily for pet-related queries
    - General-purpose tools for agent

Tools:
    - web_search: Web search using Tavily (for pet owner general questions)

Reference: Technical Scope - Single Agent with ReAct pattern
Version: v1.0.0
"""

from app.core.tools.mcp_server import mcp_server
from typing import Dict, Any, List, Optional
from loguru import logger
import re
import asyncio
import time
import unicodedata

from app.config.settings import settings
from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
    classify_error_code,
)

try:
    from tavily import TavilyClient as TavilyClientType

    TAVILY_AVAILABLE = True
except ImportError:
    TAVILY_AVAILABLE = False
    TavilyClientType = None
    logger.warning("tavily-python not installed, web_search will use fallback")


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

PET_TYPE_TERMS = {
    "dog": {"cho", "chó", "dog", "dogs", "canine", "puppy", "puppies"},
    "cat": {"meo", "mèo", "cat", "cats", "feline", "kitten", "kittens"},
}

SYMPTOM_HINTS = {
    "non",
    "non mua",
    "vomit",
    "vomiting",
    "emesis",
    "tieu chay",
    "diarrhea",
    "bo an",
    "an kem",
    "fever",
    "sot",
    "ho",
    "cough",
}

VET_CONTEXT_TERMS = {
    "thu y",
    "veterinary",
    "vet",
    "pet",
    "animal",
    "clinic",
    "hospital",
}


def _clean_rag_text(text: str) -> str:
    cleaned = text.replace("", " ").replace("•", " ").replace("□", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    return cleaned.strip()


def _normalize_text(text: str) -> str:
    value = str(text or "").strip().lower().replace("đ", "d")
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = re.sub(r"[^a-z0-9\s:/._-]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _infer_query_pet_types(query: str) -> List[str]:
    normalized = _normalize_text(query)
    detected: List[str] = []
    for pet_type, terms in PET_TYPE_TERMS.items():
        if any(term in normalized for term in terms):
            detected.append(pet_type)
    return detected


def _has_symptom_signal(query: str) -> bool:
    normalized = _normalize_text(query)
    return any(token in normalized for token in SYMPTOM_HINTS)


def _result_has_pet_relevance(query: str, title: str, snippet: str, url: str) -> bool:
    combined_text = _normalize_text(f"{title} {snippet} {url}")
    if any(keyword in combined_text for keyword in PET_GUARD_KEYWORDS):
        return True

    query_pet_types = _infer_query_pet_types(query)
    if query_pet_types:
        for pet_type in query_pet_types:
            if any(
                term in combined_text for term in PET_TYPE_TERMS.get(pet_type, set())
            ):
                return True

    if _has_symptom_signal(query):
        has_symptom_overlap = any(token in combined_text for token in SYMPTOM_HINTS)
        has_vet_context = any(token in combined_text for token in VET_CONTEXT_TERMS)
        if has_symptom_overlap and has_vet_context:
            return True

    return False


def _tokenize(text: str) -> List[str]:
    """Language-agnostic tokenizer: tách thành tokens (>= 2 ký tự)."""
    tokens = re.findall(r"[\wÀ-ỹ]+", text.lower())
    return [t for t in tokens if len(t) >= 2]


def _is_pet_related_query(query: str) -> bool:
    """Check xem query có liên quan pet/vet không (bilingual guard)."""
    normalized_query = query.lower().strip()
    return any(keyword in normalized_query for keyword in PET_GUARD_KEYWORDS)


def _extract_domain(url: str) -> str:
    """Trích domain từ URL."""
    match = re.search(r"https?://(?:www\.)?([^/]+)", url.lower())
    return match.group(1) if match else ""


def _score_web_result(query: str, title: str, snippet: str, url: str) -> int:
    """Scoring dựa trên domain penalties.

    Scoring chỉ penalize nguồn kém chất lượng (Wikipedia, social media, etc.).
    """
    score = 5

    domain = _extract_domain(url)
    for penalty_domain, penalty_score in PENALTY_DOMAINS.items():
        if penalty_domain in domain:
            score -= penalty_score
            break

    combined_text = f"{title} {snippet}".lower()
    for pattern in GENERIC_CONTENT_PATTERNS:
        if pattern.search(combined_text):
            score -= 3
            break

    return score


def _build_search_query(query: str) -> str:
    """Enrich pet-health queries nhẹ để Tavily bám đúng domain thú y hơn."""
    base = query.strip()
    normalized = _normalize_text(base)
    if not base:
        return base

    extras: List[str] = []
    pet_types = _infer_query_pet_types(base)
    if "dog" in pet_types:
        extras.append("dog canine chó")
    if "cat" in pet_types:
        extras.append("cat feline mèo")

    if _has_symptom_signal(base):
        extras.append("thú y veterinary pet health first aid when to see vet")
    elif any(
        keyword in normalized
        for keyword in ["cham soc", "dinh duong", "nutrition", "care"]
    ):
        extras.append("thú y pet care veterinary")

    if not extras:
        return base

    return f"{base} {' '.join(extras)}".strip()


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


async def _get_tavily_client(db=None) -> Optional["TavilyClientType"]:
    """Get Tavily client with DB-first priority, fallback to env."""
    if not TAVILY_AVAILABLE:
        return None

    api_key = None

    if db:
        try:
            from app.core.config_helper import get_setting

            api_key = await get_setting("TAVILY_API_KEY", db)
        except Exception as e:
            logger.warning(f"Failed to get TAVILY_API_KEY from DB: {e}")

    if not api_key:
        api_key = settings.TAVILY_API_KEY

    if not api_key:
        logger.warning("TAVILY_API_KEY not configured (DB + env)")
        return None

    from tavily import TavilyClient

    return TavilyClient(api_key=api_key)


async def _perform_tavily_search(
    query: str, max_results: int, db=None
) -> Dict[str, Any]:
    """Perform web search using Tavily API with DB-first priority."""
    search_query = _build_search_query(query)
    logger.info(f"web_search: Tavily query = '{search_query}'")

    client = await _get_tavily_client(db)

    if not client:
        logger.warning("web_search: Tavily not available, returning empty results")
        return {
            "results": [],
            "images": [],
            "answer": None,
            "follow_up_questions": [],
        }

    try:
        response = await asyncio.to_thread(
            client.search,
            query=search_query,
            max_results=max(max_results, 8),
            include_answer="basic",
            include_images=True,
            include_raw_content=False,
        )

        raw_results = response.get("results", [])
        raw_images = response.get("images", [])
        ai_answer = response.get("answer")
        follow_up_questions = response.get("follow_up_questions", []) or []

        logger.info(
            f"web_search: Tavily returned {len(raw_results)} results, {len(raw_images)} images"
        )

        # Process images - filter for pet-related images
        processed_images: List[Dict[str, Any]] = []
        for img in raw_images[:6]:  # Limit to 6 images
            if isinstance(img, str):
                processed_images.append(
                    {
                        "url": img,
                        "title": "",
                        "description": "",
                    }
                )
                continue
            if not isinstance(img, dict):
                continue

            img_title = str(img.get("title", "")).lower()
            img_desc = str(img.get("description", "")).lower()
            combined = f"{img_title} {img_desc}"

            # Filter for pet-related images
            if any(keyword in combined for keyword in PET_GUARD_KEYWORDS):
                processed_images.append(
                    {
                        "url": img.get("url", ""),
                        "title": img.get("title", ""),
                        "description": img.get("description", ""),
                    }
                )

        strict_results: List[Dict[str, Any]] = []
        relaxed_results: List[Dict[str, Any]] = []

        for item in raw_results:
            title = _clean_rag_text(str(item.get("title", "")))
            snippet = _clean_rag_text(str(item.get("content", "")))
            url = str(item.get("url", ""))
            f"{title} {snippet}".lower()

            if not _result_has_pet_relevance(query, title, snippet, url):
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

            if score >= 1:
                relaxed_results.append(result_dict)

            if score >= 4:
                strict_results.append(result_dict)

        strict_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        strict_results = _deduplicate_scored_results(strict_results)

        final_results = (
            strict_results[:max_results]
            if strict_results
            else relaxed_results[:max_results]
        )

        return {
            "results": final_results,
            "images": processed_images,
            "answer": ai_answer if ai_answer else None,
            "follow_up_questions": follow_up_questions[:3]
            if follow_up_questions
            else [],
        }

    except Exception as e:
        logger.error(f"web_search: Tavily API error: {e}")
        return {
            "results": [],
            "images": [],
            "answer": None,
            "follow_up_questions": [],
        }


@mcp_server.tool
async def web_search(
    query: str,
    max_results: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Tim kiem thong tin tu web khi can thong tin them.

    Su dung tool nay cho cac cau hoi ve:
    - Tin tuc, bai viet lien quan thu cung
    - San pham, dich vu cham soc thu cung
    - Thong tin chung ve cham soc thu cưng

    Tuyet doi KHONG su dung tool nay de tim phong kham Petties.
    Dung search_clinics_nearby de tim phong kham.

    Args:
        query: Cau hoi can tim tren web
        max_results: So luong ket qua toi da (mac dinh: 5)

    Returns:
        Dict chua:
            - query: str - Cau hoi goc
            - results: List[Dict] - Danh sach ket qua web ({title, snippet, url, source, score})
            - images: List[Dict] - Hình ảnh minh họa ({url, title, description})
            - answer: str - AI-generated summary từ Tavily
            - follow_up_questions: List[str] - Các câu hỏi gợi ý
            - sources_used: int - So nguon tim duoc
            - search_source: str - "web_search"
    """
    effective_max_results = max_results or settings.TAVILY_MAX_RESULTS

    if not _is_pet_related_query(query):
        return build_tool_error_response(
            error_code="OUT_OF_SCOPE",
            message="Câu hỏi không thuộc phạm vi thú cưng/thú y.",
            recoverable=True,
            suggestion="Vui lòng đặt câu hỏi liên quan đến thú cưng hoặc chăm sóc thú y.",
            metadata={"query": query, "search_source": "web_search"},
        )

    try:
        started = time.perf_counter()
        from app.db.postgres.session import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            tavily_started = time.perf_counter()
            search_data = await asyncio.wait_for(
                _perform_tavily_search(query, effective_max_results, session),
                timeout=20.0,
            )
            tavily_ms = int((time.perf_counter() - tavily_started) * 1000)

        # Extract data from new dict format
        results = search_data.get("results", [])
        images = search_data.get("images", [])
        answer = search_data.get("answer")
        follow_up_questions = search_data.get("follow_up_questions", [])

        logger.info(
            f"web_search: Found {len(results)} results, {len(images)} images for query: {query[:50]}... "
            f"in {int((time.perf_counter() - started) * 1000)}ms"
        )

        return build_tool_success_response(
            {
                "query": query,
                "results": results,
                "images": images,
                "answer": answer,
                "follow_up_questions": follow_up_questions,
                "sources_used": len(results),
                "search_source": "web_search",
            },
            metadata={
                "timing_ms": {
                    "tavily": tavily_ms,
                    "total": int((time.perf_counter() - started) * 1000),
                },
                "max_results": effective_max_results,
            },
        )
    except asyncio.TimeoutError:
        logger.warning("web_search: Tavily timed out after 20s")
        return build_tool_error_response(
            error_code="RATE_LIMITED",
            message="Tìm kiếm web bị timeout sau 20 giây.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút hoặc rút gọn câu hỏi.",
            metadata={"query": query, "search_source": "web_search"},
        )
    except Exception as e:
        logger.error(f"Lỗi trong web_search: {e}")
        return build_tool_error_response(
            error_code=classify_error_code(str(e)),
            message="Không thể tìm kiếm thông tin web lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau ít phút.",
            metadata={
                "query": query,
                "search_source": "web_search",
                "root_error": str(e),
            },
        )


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Common Tools registered in FastMCP:")
    print("  - web_search: Web search using Tavily (for pet owner general questions)")
    print("\nThis tool uses:")
    print("  - Tavily Search API for web search")
    print("  - Bilingual pet keyword guard (Vietnamese + English)")
