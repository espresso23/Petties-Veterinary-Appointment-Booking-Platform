"""
PETTIES AGENT SERVICE - Pet Care RAG Tools (FastMCP)

Code-based tools for Single Agent - RAG-based Q&A and symptom checking.
Uses Cohere embeddings + Qdrant vector search.

Package: app.core.tools.mcp_tools
Purpose:
    - RAG-based Q&A for pet care knowledge
    - Symptom search using knowledge base
    - Vietnamese language support via Cohere multilingual

Tools:
    - pet_care_qa: RAG-based Q&A for pet care questions
    - symptom_search: Search diseases based on symptoms using RAG

Reference: Technical Scope - Single Agent with ReAct pattern
Version: v1.0.0 (Migrated from Multi-Agent medical_tools)

Changes:
- Removed API-based tools (booking, history, vaccine) - not for RAG
- Implemented real RAG search using Qdrant + Cohere
- Added pet_care_qa tool
- Renamed to focus on RAG functionality
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
    "là", "và", "của", "cho", "với", "khi", "nên", "cần", "được", "đến",
    "trong", "những", "các", "một", "này", "kia", "thì", "có", "bị", "gì",
    "sao", "thế", "nào", "hay", "rằng", "đang", "về", "từ", "theo",
    # English function words
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "it", "its", "this", "that", "or", "and", "but", "if", "do", "does",
    "did", "has", "have", "had", "will", "would", "can", "could", "should",
    "what", "how", "when", "where", "why", "which", "who", "whom",
    "my", "your", "his", "her", "our", "their", "i", "you", "he", "she",
    "we", "they", "me", "him", "us", "them",
}

# --- PET GUARD (bilingual - chỉ dùng cho safety check, không scoring) ---
PET_GUARD_KEYWORDS = {
    # Vietnamese
    "chó", "cho", "cún", "cun", "mèo", "meo", "thú cưng", "thu cung",
    "thú y", "thu y", "thú nuôi", "thu nuoi",
    "tiêu chảy", "tieu chay", "nôn", "ăn", "dinh dưỡng",
    "ký sinh trùng", "triệu chứng", "bệnh",
    # English
    "dog", "cat", "pet", "puppy", "kitten", "vet", "veterinary",
    "veterinarian", "animal", "parvo", "distemper", "diarrhea",
    "vomit", "vaccine", "vaccination", "grooming", "clinic",
    "symptom", "disease", "treatment", "nutrition", "diet", "feed",
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

# --- RED FLAG SYMPTOMS (bilingual) ---
RED_FLAG_SYMPTOMS = {
    # Vietnamese
    "co giật", "bất tỉnh", "khó thở", "thở gấp", "suy hô hấp", "liệt",
    "tiêu chảy ra máu", "nôn ra máu", "có máu trong phân", "xuất huyết",
    "mất nước nặng", "bỏ ăn nhiều ngày", "sốc", "ngộ độc",
    # English
    "seizure", "unconscious", "difficulty breathing", "respiratory failure",
    "bloody diarrhea", "bloody vomit", "blood in stool", "hemorrhage",
    "severe dehydration", "poisoning", "collapse", "paralysis",
}


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


def _format_web_search_answer(query: str, results: List[Dict[str, Any]]) -> str:
    if not results:
        return (
            "Tôi chưa tìm thấy nguồn web phù hợp cho câu hỏi này trong phạm vi thú cưng/thú y. "
            "Bạn hãy hỏi cụ thể hơn hoặc liên hệ bác sĩ thú y để được tư vấn chính xác."
        )

    bullet_points = []
    for item in results[:3]:
        title = _clean_rag_text(str(item.get("title", "")))
        snippet = _clean_rag_text(str(item.get("snippet", "")))
        source = item.get("source") or item.get("url") or "nguồn web"

        if snippet:
            bullet_points.append(f"- {title}: {snippet} (Nguồn: {source})")
        else:
            bullet_points.append(f"- {title} (Nguồn: {source})")

    return (
        "Tôi không thấy đủ thông tin trong knowledge base nên đã tìm thêm từ nguồn web liên quan thú cưng/thú y:\n"
        f"{"\n".join(bullet_points)}\n\n"
        "Lưu ý: Thông tin web chỉ mang tính tham khảo. Nếu thú cưng có dấu hiệu nặng hoặc kéo dài, nên đưa đi khám bác sĩ thú y."
    )


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
        "thú y", "thu y", "vet", "veterinary",
        "chó", "cho", "mèo", "meo", "pet", "cún", "cun",
        "dog", "cat", "puppy", "kitten", "animal",
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


def _has_red_flag_symptom(symptoms: List[str]) -> bool:
    normalized_symptoms = " ".join(symptoms).lower()
    return any(keyword in normalized_symptoms for keyword in RED_FLAG_SYMPTOMS)


def _build_symptom_query(symptoms: List[str], pet_type: str) -> str:
    symptoms_text = ", ".join(symptoms)
    return f"{pet_type} triệu chứng {symptoms_text} bệnh chẩn đoán xử lý"


def _summarize_symptom_result(content: str, symptoms: List[str]) -> str:
    cleaned_content = _clean_rag_text(content)
    formatted_results = [{"content": cleaned_content, "score": 1.0, "source": "knowledge base"}]
    symptom_query = " ".join(symptoms)
    relevant_sentences = _select_relevant_sentences(symptom_query, formatted_results, limit=2)

    if relevant_sentences:
        if len(relevant_sentences) == 1:
            all_sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", cleaned_content) if sentence.strip()]
            for sentence in all_sentences:
                if sentence not in relevant_sentences:
                    relevant_sentences.append(sentence)
                    break
        return " ".join(relevant_sentences[:2])[:240]

    fallback = cleaned_content[:240].strip()
    return fallback + ("..." if len(cleaned_content) > 240 else "")


def _infer_condition_name(content: str, source: str, index: int) -> str:
    cleaned_content = _clean_rag_text(content)
    heading_match = re.search(r"(?:^|\s)([A-ZÀ-Ỵ][^.!?:]{4,80})", cleaned_content)
    if heading_match:
        candidate = heading_match.group(1).strip(" -•:")
        if len(candidate.split()) <= 10:
            return candidate
    return f"Khả năng #{index} từ {source}"


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
        logger.info(f"web_search: returning {len(strict_results[:max_results])} strict results")
        return strict_results[:max_results]

    # Fallback: dùng relaxed results nếu strict rỗng
    relaxed_results.sort(key=lambda x: x.get("score", 0), reverse=True)
    relaxed_results = _deduplicate_scored_results(relaxed_results)
    logger.info(f"web_search: strict=0, returning {len(relaxed_results[:max_results])} relaxed results")
    return relaxed_results[:max_results]


def _select_relevant_sentences(query: str, results: List[Dict[str, Any]], limit: int = 3) -> List[str]:
    keywords = _extract_query_keywords(query)
    scored_sentences: List[tuple[float, str]] = []
    seen = set()

    for result in results[:5]:
        content = _clean_rag_text(str(result.get("content", "")))
        base_score = float(result.get("score", 0.0) or 0.0)
        sentences = re.split(r"(?<=[.!?])\s+|\s{2,}|\n+", content)

        for sentence in sentences:
            sentence = _clean_rag_text(sentence)
            if len(sentence) < 35:
                continue

            normalized_sentence = sentence.lower()
            if normalized_sentence in seen:
                continue
            seen.add(normalized_sentence)

            overlap = sum(1 for keyword in keywords if keyword in normalized_sentence)
            score = base_score + overlap

            if overlap == 0 and keywords:
                continue

            scored_sentences.append((score, sentence))

    scored_sentences.sort(key=lambda item: item[0], reverse=True)
    return [sentence for _, sentence in scored_sentences[:limit]]


def _build_pet_care_answer(query: str, formatted_results: List[Dict[str, Any]]) -> str:
    if not formatted_results:
        return "Không tìm thấy thông tin phù hợp trong knowledge base. Vui lòng hỏi cụ thể hơn hoặc liên hệ bác sĩ thú y."

    relevant_sentences = _select_relevant_sentences(query, formatted_results, limit=3)
    source_name = formatted_results[0].get("source") or "knowledge base"

    if not relevant_sentences:
        return (
            "Tôi đã tìm thấy tài liệu liên quan nhưng chưa đủ chắc chắn để tóm tắt ngắn gọn. "
            "Bạn hãy hỏi cụ thể hơn về chế độ ăn, cách chăm sóc hoặc dấu hiệu cần theo dõi."
        )

    bullet_points = "\n".join(f"- {sentence}" for sentence in relevant_sentences)
    return (
        "Gợi ý ngắn cho bạn:\n"
        f"{bullet_points}\n\n"
        "Lưu ý: Nếu thú cưng tiêu chảy kéo dài, bỏ ăn, nôn nhiều hoặc có máu trong phân thì nên đưa đi khám sớm.\n"
        f"Nguồn tham khảo: {source_name}."
    )


# ===== RAG TOOLS =====

@mcp_server.tool
async def pet_care_qa(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5
) -> Dict[str, Any]:
    """
    Tìm kiếm kiến thức chăm sóc thú cưng từ Knowledge Base (RAG Q&A)

    Sử dụng tool này khi người dùng hỏi các câu hỏi về:
    - Cách chăm sóc thú cưng (cho ăn, tắm rửa, tập luyện)
    - Thông tin về giống loài
    - Điều trị bệnh thường gặp
    - Dinh dưỡng và thực phẩm

    Args:
        query: Câu hỏi hoặc từ khóa tìm kiếm (tiếng Việt hoặc English)
        top_k: Số lượng kết quả trả về (mặc định: 5)
        min_score: Điểm tương đồng tối thiểu (mặc định: 0.5)

    Returns:
        Dict chứa:
            - query: str - Câu hỏi gốc
            - results: List[Dict] - Danh sách tài liệu tìm được
            - answer: str - Câu trả lời tổng hợp
            - sources_used: int - Số tài liệu được sử dụng
    """
    try:
        from app.core.rag.rag_engine import get_rag_engine

        # Get RAG engine
        rag = get_rag_engine()

        # Query knowledge base
        results = await rag.query(
            query=query,
            top_k=top_k,
            min_score=min_score
        )

        # Format results
        formatted_results = [
            {
                "content": r.content,
                "score": r.score,
                "source": r.document_name,
                "chunk_index": r.chunk_index
            }
            for r in results
        ]

        answer = _build_pet_care_answer(query, formatted_results)

        logger.info(f"pet_care_qa: Found {len(results)} results for query: {query[:50]}...")

        return {
            "query": query,
            "results": formatted_results,
            "answer": answer,
            "sources_used": len(formatted_results),
            "search_source": "knowledge_base",
        }

    except Exception as e:
        logger.error(f"Lỗi trong pet_care_qa: {e}")
        return {
            "query": query,
            "results": [],
            "answer": "Rất tiếc, hiện tại tôi không thể truy cập kho kiến thức (Knowledge Base) do lỗi cấu hình hệ thống (Thiếu API Key). Vui lòng liên hệ Admin hoặc thử câu hỏi khác.",
            "sources_used": 0,
            "error": str(e)
        }


@mcp_server.tool
async def symptom_search(
    symptoms: List[str],
    pet_type: str = "dog",
    top_k: int = 5
) -> Dict[str, Any]:
    """
    Tìm bệnh dựa trên triệu chứng sử dụng RAG (Kiểm tra triệu chứng)

    Sử dụng tool này khi người dùng mô tả triệu chứng của thú cưng:
    - Thú cưng bị sốt, nôn, tiêu chảy
    - Thú cưng bỏ ăn, mệt mỏi
    - Các vấn đề về da, lông
    - Vấn đề hô hấp, mắt

    Args:
        symptoms: Danh sách triệu chứng (ví dụ: ["sốt", "nôn mửa", "mệt mỏi"])
        pet_type: Loại thú cưng (dog, cat, bird, rabbit, hamster)
        top_k: Số lượng kết quả (mặc định: 5)

    Returns:
        Dict chứa:
            - symptoms: List[str] - Triệu chứng đã nhập
            - pet_type: str - Loại thú cưng
            - possible_conditions: List[Dict] - Các bệnh có thể
            - urgent: bool - Cần khám gấp không
            - recommendations: str - Khuyến nghị

    LƯU Ý: Tool này chỉ cung cấp thông tin tham khảo.
    Luôn khuyên người dùng đến phòng khám thú y để được chẩn đoán chính xác.
    """
    try:
        from app.core.rag.rag_engine import get_rag_engine

        # Lấy RAG engine
        rag = get_rag_engine()

        # Xây dựng câu truy vấn từ triệu chứng
        query = _build_symptom_query(symptoms, pet_type)

        # Truy vấn knowledge base
        results = await rag.query(
            query=query,
            top_k=top_k,
            min_score=0.4  # Ngưỡng thấp hơn cho tìm kiếm triệu chứng
        )

        # Phân tích kết quả tìm các bệnh có thể
        possible_conditions = []
        urgent = _has_red_flag_symptom(symptoms)
        seen_descriptions = set()

        for index, r in enumerate(results, start=1):
            content_lower = r.content.lower()

            severity = "nhẹ"
            if _has_red_flag_symptom(symptoms):
                severity = "nghiêm trọng"
            elif any(kw in content_lower for kw in ["nặng", "nguy hiểm", "cấp cứu"]):
                severity = "vừa"
            elif any(kw in content_lower for kw in ["vừa", "cần theo dõi", "mất nước"]):
                severity = "vừa"

            if len(symptoms) >= 2 and any(kw in content_lower for kw in ["nguy hiểm", "cấp cứu", "ngay lập tức", "parvo", "distemper"]):
                urgent = True
                severity = "nghiêm trọng"

            description = _summarize_symptom_result(r.content, symptoms)
            normalized_description = description.lower()
            if normalized_description in seen_descriptions:
                continue
            seen_descriptions.add(normalized_description)

            possible_conditions.append({
                "name": _infer_condition_name(r.content, r.document_name, index),
                "description": description,
                "severity": severity,
                "source": r.document_name,
                "score": r.score
            })

            if len(possible_conditions) >= 3:
                break

        # Tạo khuyến nghị
        if urgent:
            recommendations = "CẢNH BÁO: Các triệu chứng này có thể nghiêm trọng. Cần đến phòng khám thú y NGAY LẬP TỨC để được khám và điều trị kịp thời."
        elif possible_conditions:
            recommendations = "Nên theo dõi nước uống, tình trạng bỏ ăn, nôn hoặc máu trong phân. Nếu tiêu chảy kéo dài trên 24 giờ hoặc nặng lên, nên đưa đi khám thú y."
        else:
            recommendations = "Không tìm thấy thông tin phù hợp. Nếu triệu chứng nghiêm trọng, nên đến phòng khám thú y để được tư vấn."

        logger.info(f"symptom_search: Tìm thấy {len(possible_conditions)} bệnh có thể cho triệu chứng: {symptoms}")

        return {
            "symptoms": symptoms,
            "pet_type": pet_type,
            "possible_conditions": possible_conditions,
            "urgent": urgent,
            "recommendations": recommendations,
            "disclaimer": "Thông tin này chỉ mang tính chất tham khảo. Vui lòng đến phòng khám thú y để được chẩn đoán và điều trị chính xác.",
            "search_source": "knowledge_base",
        }

    except Exception as e:
        logger.error(f"Lỗi trong symptom_search: {e}")
        return {
            "symptoms": symptoms,
            "pet_type": pet_type,
            "possible_conditions": [],
            "urgent": False,
            "recommendations": f"Lỗi khi tìm kiếm: {str(e)}. Nên đến phòng khám thú y để được tư vấn.",
            "error": str(e)
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

    Args:
        query: Câu hỏi cần tìm trên web
        max_results: Số lượng kết quả tối đa (mặc định lấy từ config)

    Returns:
        Dict chứa query, danh sách kết quả web, answer tóm tắt và số nguồn đã dùng.
    """
    effective_max_results = max_results or settings.DUCKDUCKGO_MAX_RESULTS

    if not _is_pet_related_query(query):
        return {
            "query": query,
            "results": [],
            "answer": "Tôi chỉ được phép tìm kiếm web cho các nội dung liên quan đến thú cưng hoặc thú y.",
            "sources_used": 0,
            "search_source": "web_search",
            "error": "Query ngoài phạm vi thú cưng/thú y",
        }

    try:
        results = await asyncio.to_thread(_perform_duckduckgo_search, query, effective_max_results)
        answer = _format_web_search_answer(query, results)

        logger.info(f"web_search: Found {len(results)} results for query: {query[:50]}...")

        return {
            "query": query,
            "results": results,
            "answer": answer,
            "sources_used": len(results),
            "search_source": "web_search",
        }
    except Exception as e:
        logger.error(f"Lỗi trong web_search: {e}")
        return {
            "query": query,
            "results": [],
            "answer": "Tôi chưa thể tìm thêm thông tin từ web vào lúc này. Vui lòng thử lại sau hoặc liên hệ bác sĩ thú y.",
            "sources_used": 0,
            "search_source": "web_search",
            "error": str(e),
        }


# ===== TOOL METADATA =====
if __name__ == "__main__":
    print("Pet Care RAG Tools registered in FastMCP:")
    print("  - pet_care_qa: RAG-based Q&A for pet care knowledge")
    print("  - symptom_search: Search diseases based on symptoms")
    print("  - web_search: Web fallback for pet/vet questions")
    print("\nThese tools use:")
    print("  - Cohere embed-multilingual-v3.0 for Vietnamese support")
    print("  - Qdrant vector database for similarity search")
    print("  - LlamaIndex for document processing")
