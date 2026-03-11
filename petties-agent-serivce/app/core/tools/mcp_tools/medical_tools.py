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


# --- MINIMAL STOP WORDS (bilingual, chỉ loại function words phổ biến) ---
STOP_WORDS = {
    # Vietnamese function words
    "là",
    "và",
    "của",
    "cho",
    "với",
    "khi",
    "nên",
    "cần",
    "được",
    "đến",
    "trong",
    "những",
    "các",
    "một",
    "này",
    "kia",
    "thì",
    "có",
    "bị",
    "gì",
    "sao",
    "thế",
    "nào",
    "hay",
    "rằng",
    "đang",
    "về",
    "từ",
    "theo",
    # English function words
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "it",
    "its",
    "this",
    "that",
    "or",
    "and",
    "but",
    "if",
    "do",
    "does",
    "did",
    "has",
    "have",
    "had",
    "will",
    "would",
    "can",
    "could",
    "should",
    "what",
    "how",
    "when",
    "where",
    "why",
    "which",
    "who",
    "whom",
    "my",
    "your",
    "his",
    "her",
    "our",
    "their",
    "i",
    "you",
    "he",
    "she",
    "we",
    "they",
    "me",
    "him",
    "us",
    "them",
}

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
    """Language-agnostic tokenizer: tách thành tokens, loại stop words."""
    tokens = re.findall(r"[\wÀ-ỹ]+", text.lower())
    return [t for t in tokens if t not in STOP_WORDS and len(t) >= 2]


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
    """Language-agnostic scoring dựa trên token overlap ratio + domain penalties."""
    query_tokens = set(_tokenize(query))
    if not query_tokens:
        return 0

    title_lower = title.lower()
    snippet_lower = snippet.lower()
    combined_text = f"{title_lower} {snippet_lower}"
    result_tokens = set(_tokenize(combined_text))

    # 1. Token overlap ratio (0-10 scale)
    overlap = query_tokens & result_tokens
    overlap_ratio = len(overlap) / len(query_tokens)
    score = int(overlap_ratio * 10)

    # 2. Title bonus: tokens xuất hiện trong title quan trọng hơn
    title_tokens = set(_tokenize(title_lower))
    title_overlap = query_tokens & title_tokens
    score += len(title_overlap) * 2

    # 3. Exact query match bonus
    if query.lower().strip() in combined_text:
        score += 5

    # 4. Domain-based penalties (language-agnostic)
    domain = _extract_domain(url)
    for penalty_domain, penalty_score in PENALTY_DOMAINS.items():
        if penalty_domain in domain:
            score -= penalty_score
            break

    # 5. Generic content patterns penalties (regex, language-agnostic)
    for pattern in GENERIC_CONTENT_PATTERNS:
        if pattern.search(combined_text):
            score -= 3
            break

    return score


def _build_search_query(query: str) -> str:
    """Expand query nhẹ nhàng - chỉ thêm context nếu chưa có pet/vet term (bilingual)."""
    normalized_query = query.strip()
    if not normalized_query:
        return query

    lower_query = normalized_query.lower()

    # Kiểm tra đã có pet/vet context chưa (bilingual)
    pet_context_words = [
        "thú y",
        "thu y",
        "vet",
        "veterinary",
        "chó",
        "cho",
        "mèo",
        "meo",
        "pet",
        "cún",
        "cun",
        "dog",
        "cat",
        "puppy",
        "kitten",
        "animal",
    ]
    has_pet_context = any(kw in lower_query for kw in pet_context_words)

    if not has_pet_context:
        # Detect language: nếu có Vietnamese chars thì thêm "thú y", không thì "pet veterinary"
        if re.search(r"[À-ỹ]", normalized_query):
            return f"{normalized_query} thú y"
        else:
            return f"{normalized_query} pet veterinary"

    return normalized_query


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
        from app.core.rag.rag_engine import get_rag_engine
        from app.core.rag.query_expander import get_query_expander

        rag = get_rag_engine()

        # Expand short queries for better RAG recall
        expander = get_query_expander()
        search_query = await expander.expand_query(query, pet_type=pet_type)
        query_expanded = search_query != query

        # Query knowledge base with (possibly expanded) query
        results = await rag.query(
            query=search_query,
            top_k=top_k,
            min_score=min_score,
        )

        # Format raw results for LLM consumption
        formatted_results = [
            {
                "content": _clean_rag_text(r.content),
                "score": r.score,
                "source": r.document_name,
                "chunk_index": r.chunk_index,
            }
            for r in results
        ]

        logger.info(
            f"pet_knowledge_search: Found {len(results)} results "
            f"(expanded={query_expanded}) for query: {query[:50]}..."
        )

        return {
            "query": query,
            "expanded_query": search_query if query_expanded else None,
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
        results = await asyncio.to_thread(
            _perform_duckduckgo_search, query, effective_max_results
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
