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
        for c in (hybrid_result.chunks or []):
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
            asyncio.to_thread(
                _perform_duckduckgo_search, query, effective_max_results
            ),
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


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Pet Care RAG Tools registered in FastMCP:")
    print(
        "  - pet_knowledge_search: Unified RAG tool for pet care Q&A + symptom analysis"
    )
    print("  - web_search: Web fallback for pet/vet questions")
    print("\nThese tools use:")
    print("  - Cohere embed-multilingual-v3.0 for Vietnamese support")
    print("  - Qdrant vector database for similarity search")
    print("  - LlamaIndex for document processing")
