"""
PETTIES AGENT SERVICE - Response Formatter

Format tool results into human-readable observation text for the LLM.

Package: app.core.agents
Version: v3.0.0 (Pure data retrieval — removed symptom classification formatting)
"""

from typing import Dict, Any, List
import json


def format_tool_observation(data: Dict[str, Any]) -> str:
    """Format tool result data into observation text for the LLM.

    Provides structured context from tool output so the LLM can synthesize
    a final answer — NOT a copy-paste answer.

    Distinguishes between result types using ``search_source``:
      - ``"knowledge_base"`` → RAG/KB results from pet_knowledge_search
      - ``"web_search"``     → Web results
      - (absent)             → other tools
    """
    parts: List[str] = []

    search_source = data.get("search_source", "")

    # Results list — format depends on search_source
    results = data.get("results")
    if isinstance(results, list) and results:
        if search_source == "knowledge_base":
            # RAG/KB results from pet_knowledge_search: {content, score, source, chunk_index}
            kb_lines = []
            for r in results[:3]:
                if isinstance(r, dict):
                    content = str(r.get("content", "")).strip()
                    source = (
                        r.get("source") or r.get("document_name") or "knowledge base"
                    )
                    score = r.get("score", 0)
                    if content:
                        # Truncate long content to keep observation concise
                        snippet = (
                            content[:300] + "..." if len(content) > 300 else content
                        )
                        kb_lines.append(f"  - [{source} | score={score:.2f}] {snippet}")
            if kb_lines:
                sources_used = data.get("sources_used", len(kb_lines))
                parts.append(
                    f"TÀI LIỆU TỪ KNOWLEDGE BASE ({sources_used} nguồn):\n"
                    + "\n".join(kb_lines)
                )
        else:
            # Web search results: {title, snippet, url, source, score}
            web_lines = []
            for r in results[:3]:
                if isinstance(r, dict):
                    title = str(r.get("title", "")).strip()
                    snippet = str(r.get("snippet", "")).strip()
                    url = str(r.get("url", "")).strip()
                    # Skip items with no meaningful content
                    if not title and not snippet:
                        continue
                    label = (
                        f"{title}: {snippet}" if title and snippet else title or snippet
                    )
                    web_lines.append(
                        f"  - {label} (Nguồn: {url})" if url else f"  - {label}"
                    )
            if web_lines:
                parts.append("KẾT QUẢ WEB:\n" + "\n".join(web_lines))

    if not parts:
        return json.dumps(data, ensure_ascii=False, indent=2)

    return "\n".join(parts)
