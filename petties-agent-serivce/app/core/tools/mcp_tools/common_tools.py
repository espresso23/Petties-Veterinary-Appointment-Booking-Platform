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

from app.config.settings import settings

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


def _clean_rag_text(text: str) -> str:
    cleaned = text.replace("", " ").replace("•", " ").replace("□", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    return cleaned.strip()


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
    """Trả về query nguyên gốc — không thêm context."""
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


def _get_tavily_client() -> Optional["TavilyClientType"]:
    """Get Tavily client if API key is available."""
    if not TAVILY_AVAILABLE:
        return None

    api_key = settings.TAVILY_API_KEY
    if not api_key:
        logger.warning("TAVILY_API_KEY not configured")
        return None

    from tavily import TavilyClient

    return TavilyClient(api_key=api_key)


def _perform_tavily_search(query: str, max_results: int) -> List[Dict[str, Any]]:
    """Perform web search using Tavily API."""
    search_query = _build_search_query(query)
    logger.info(f"web_search: Tavily query = '{search_query}'")

    client = _get_tavily_client()

    if not client:
        logger.warning("web_search: Tavily not available, returning empty results")
        return []

    try:
        response = client.search(
            query=search_query,
            max_results=max(max_results, 8),
            include_answer=False,
            include_raw_content=False,
        )

        raw_results = response.get("results", [])
        logger.info(f"web_search: Tavily returned {len(raw_results)} raw results")

        strict_results: List[Dict[str, Any]] = []
        relaxed_results: List[Dict[str, Any]] = []

        for item in raw_results:
            title = _clean_rag_text(str(item.get("title", "")))
            snippet = _clean_rag_text(str(item.get("content", "")))
            url = str(item.get("url", ""))
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

            if score >= 1:
                relaxed_results.append(result_dict)

            if score >= 4:
                strict_results.append(result_dict)

        strict_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        strict_results = _deduplicate_scored_results(strict_results)
        if strict_results:
            logger.info(
                f"web_search: returning {len(strict_results[:max_results])} strict results"
            )
            return strict_results[:max_results]

        relaxed_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        relaxed_results = _deduplicate_scored_results(relaxed_results)
        logger.info(
            f"web_search: strict=0, returning {len(relaxed_results[:max_results])} relaxed results"
        )
        return relaxed_results[:max_results]

    except Exception as e:
        logger.error(f"web_search: Tavily API error: {e}")
        return []


# ===== COMMON TOOLS =====


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
            - sources_used: int - So nguon tim duoc
            - search_source: str - "web_search"
    """
    effective_max_results = max_results or settings.TAVILY_MAX_RESULTS

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
            asyncio.to_thread(_perform_tavily_search, query, effective_max_results),
            timeout=20.0,
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
        logger.warning("web_search: Tavily timed out after 20s")
        return {
            "query": query,
            "results": [],
            "sources_used": 0,
            "search_source": "web_search",
            "error": "Tìm kiếm web bị timeout sau 20 giây",
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


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Common Tools registered in FastMCP:")
    print("  - web_search: Web search using Tavily (for pet owner general questions)")
    print("\nThis tool uses:")
    print("  - Tavily Search API for web search")
    print("  - Bilingual pet keyword guard (Vietnamese + English)")
