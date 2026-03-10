from pathlib import Path
import asyncio
import sys
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.agents.single_agent import SingleAgent
from app.core.agents.enrichment_strategy import build_final_answer_from_tool_result
from app.core.agents.response_formatter import format_tool_observation
from app.core.tools.mcp_tools.medical_tools import pet_knowledge_search, web_search


class FakeRagResult:
    def __init__(
        self, content: str, score: float, document_name: str, chunk_index: int = 0
    ):
        self.content = content
        self.score = score
        self.document_name = document_name
        self.chunk_index = chunk_index


class FakeRagEngine:
    def __init__(self, results):
        self.results = results

    async def query(self, **kwargs):
        return self.results


def test_web_search_rejects_non_pet_query():
    result = asyncio.run(web_search("thời tiết Hà Nội hôm nay", max_results=3))

    assert result["sources_used"] == 0
    assert result["search_source"] == "web_search"
    assert result["results"] == []
    assert result["error"] == "Query ngoài phạm vi thú cưng/thú y"
    # Pure data: no "answer" field
    assert "answer" not in result


def test_web_search_formats_pet_results():
    mocked_results = [
        {
            "title": "Chó bị tiêu chảy nên ăn gì?",
            "snippet": "Ưu tiên thức ăn mềm, dễ tiêu và bổ sung nước điện giải.",
            "url": "https://example.com/dog-diarrhea-diet",
            "source": "https://example.com/dog-diarrhea-diet",
        },
        {
            "title": "Chăm sóc chó bị rối loạn tiêu hóa",
            "snippet": "Theo dõi nôn ói, bỏ ăn và đưa đi khám nếu có máu trong phân.",
            "url": "https://example.com/dog-digestive-care",
            "source": "https://example.com/dog-digestive-care",
        },
    ]

    with patch(
        "app.core.tools.mcp_tools.medical_tools._perform_duckduckgo_search",
        return_value=mocked_results,
    ):
        result = asyncio.run(web_search("chó bị tiêu chảy nên ăn gì", max_results=3))

    assert result["sources_used"] == 2
    assert result["search_source"] == "web_search"
    # Pure data: no "answer" field, raw results list instead
    assert "answer" not in result
    assert len(result["results"]) == 2
    assert result["results"][0]["title"] == "Chó bị tiêu chảy nên ăn gì?"
    assert result["results"][0]["url"] == "https://example.com/dog-diarrhea-diet"
    assert result["results"][1]["title"] == "Chăm sóc chó bị rối loạn tiêu hóa"


def test_pet_knowledge_search_returns_raw_results():
    """pet_knowledge_search trả về raw data từ KB, không có classification."""
    fake_results = [
        FakeRagResult(
            content="Nên tắm thú cưng 1-2 lần mỗi tuần và dùng sữa tắm chuyên dụng.",
            score=0.85,
            document_name="petcare-guide.pdf",
        )
    ]

    with patch(
        "app.core.rag.rag_engine.get_rag_engine",
        return_value=FakeRagEngine(fake_results),
    ):
        result = asyncio.run(
            pet_knowledge_search(
                "cách tắm rửa thú cưng đúng cách", pet_type="dog", top_k=3
            )
        )

    assert result["search_source"] == "knowledge_base"
    assert result["sources_used"] == 1
    assert len(result["results"]) == 1
    assert result["results"][0]["source"] == "petcare-guide.pdf"
    assert result["results"][0]["score"] == 0.85
    assert "tắm" in result["results"][0]["content"]
    # Should NOT have old classification fields
    assert "possible_conditions" not in result
    assert "urgent" not in result
    assert "answer" not in result
    assert "recommendations" not in result
    assert "disclaimer" not in result


def test_pet_knowledge_search_returns_empty_when_no_match():
    """Khi KB không có kết quả, trả về empty results."""
    with patch(
        "app.core.rag.rag_engine.get_rag_engine",
        return_value=FakeRagEngine([]),
    ):
        result = asyncio.run(
            pet_knowledge_search("rụng lông nhẹ ở mèo", pet_type="cat", top_k=3)
        )

    assert result["sources_used"] == 0
    assert result["results"] == []
    assert result["search_source"] == "knowledge_base"
    # Should NOT have old classification fields
    assert "possible_conditions" not in result
    assert "urgent" not in result


def test_pet_knowledge_search_symptom_query_returns_raw_data():
    """Symptom queries also return raw data — no tool-side analysis."""
    fake_results = [
        FakeRagResult(
            content="Bệnh parvo gây tiêu chảy ra máu, nôn và có thể rất nguy hiểm, cần cấp cứu ngay lập tức.",
            score=0.91,
            document_name="parvo-guide.pdf",
        )
    ]

    with patch(
        "app.core.rag.rag_engine.get_rag_engine",
        return_value=FakeRagEngine(fake_results),
    ):
        result = asyncio.run(
            pet_knowledge_search("chó bị tiêu chảy và nôn", pet_type="dog", top_k=3)
        )

    assert result["search_source"] == "knowledge_base"
    assert result["sources_used"] == 1
    assert len(result["results"]) == 1
    assert "parvo" in result["results"][0]["content"].lower()
    # Pure data — no classification
    assert "possible_conditions" not in result
    assert "urgent" not in result


def test_single_agent_falls_back_to_web_search_when_kb_empty():
    """Khi pet_knowledge_search trả về 0 results, agent fallback sang web_search."""
    agent = SingleAgent(
        llm_client=None,
        enabled_tools=["pet_knowledge_search", "web_search"],
    )

    state = {
        "iteration": 1,
        "react_steps": [
            {
                "step_type": "action",
                "content": "Called pet_knowledge_search",
                "tool_name": "pet_knowledge_search",
                "tool_params": {"query": "mèo anh lông ngắn có đặc điểm gì"},
                "tool_result": {
                    "success": True,
                    "data": {
                        "query": "mèo anh lông ngắn có đặc điểm gì",
                        "pet_type": "cat",
                        "results": [],
                        "sources_used": 0,
                        "search_source": "knowledge_base",
                    },
                },
            }
        ],
        "messages": [
            {
                "role": "user",
                "content": "mèo anh lông ngắn có đặc điểm gì",
                "name": None,
                "tool_call_id": None,
            }
        ],
        "last_tool_result": {
            "success": True,
            "data": {
                "query": "mèo anh lông ngắn có đặc điểm gì",
                "pet_type": "cat",
                "results": [],
                "sources_used": 0,
                "search_source": "knowledge_base",
            },
        },
    }

    result = asyncio.run(agent._think_node(state))

    assert result["should_end"] is False
    assert result["pending_tool_call"]["name"] == "web_search"
    assert result["pending_tool_call"]["arguments"] == {
        "query": "mèo anh lông ngắn có đặc điểm gì",
        "max_results": 5,
    }


def test_build_final_answer_returns_none_when_llm_client_present():
    """Khi có LLM client, build_final_answer_from_tool_result PHẢI return None
    để LLM tổng hợp answer thay vì auto-finalize."""

    class FakeLLMClient:
        pass

    agent = SingleAgent(
        llm_client=FakeLLMClient(), enabled_tools=["pet_knowledge_search", "web_search"]
    )

    # pet_knowledge_search result → should NOT auto-finalize (LLM will synthesize)
    answer_kb = build_final_answer_from_tool_result(
        tool_name="pet_knowledge_search",
        tool_result={
            "success": True,
            "data": {
                "results": [
                    {
                        "content": "Cho chó ăn cháo loãng.",
                        "score": 0.8,
                        "source": "guide.pdf",
                        "chunk_index": 0,
                    }
                ],
                "sources_used": 1,
                "search_source": "knowledge_base",
            },
        },
        react_steps=[],
        messages=[],
        llm_client=agent.llm_client,
        enabled_tools_lower=agent._enabled_tools_lower,
    )
    assert answer_kb is None

    # web_search result → should NOT auto-finalize
    answer_web = build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "results": [
                    {
                        "title": "Cho ăn thức ăn mềm",
                        "snippet": "Từ web: cho ăn thức ăn mềm.",
                        "url": "https://example.com",
                        "source": "https://example.com",
                        "score": 5,
                    }
                ],
                "sources_used": 1,
                "search_source": "web_search",
            },
        },
        react_steps=[],
        messages=[],
        llm_client=agent.llm_client,
        enabled_tools_lower=agent._enabled_tools_lower,
    )
    assert answer_web is None

    # Error result → SHOULD auto-finalize even with LLM
    answer_err = build_final_answer_from_tool_result(
        tool_name="pet_knowledge_search",
        tool_result={"success": False, "error": "Qdrant connection timeout"},
        react_steps=[],
        messages=[],
        llm_client=agent.llm_client,
        enabled_tools_lower=agent._enabled_tools_lower,
    )
    assert answer_err is not None
    assert "Qdrant connection timeout" in answer_err


def test_format_tool_observation_kb_results():
    """format_tool_observation formats KB raw results correctly."""

    obs_kb = format_tool_observation(
        {
            "results": [
                {
                    "content": "Cho chó ăn cháo loãng khi bị tiêu chảy.",
                    "score": 0.85,
                    "source": "petcare.pdf",
                    "chunk_index": 0,
                }
            ],
            "sources_used": 1,
            "search_source": "knowledge_base",
        }
    )
    assert "TÀI LIỆU TỪ KNOWLEDGE BASE" in obs_kb
    assert "petcare.pdf" in obs_kb
    assert "0.85" in obs_kb
    assert "cháo loãng" in obs_kb


def test_format_tool_observation_web_results():
    """format_tool_observation formats web search results correctly (pure data, no answer)."""

    obs_web = format_tool_observation(
        {
            "sources_used": 2,
            "search_source": "web_search",
            "results": [
                {
                    "title": "Chó bị tiêu chảy",
                    "snippet": "Ưu tiên thức ăn mềm.",
                    "url": "https://example.com",
                }
            ],
        }
    )
    assert "KẾT QUẢ WEB:" in obs_web
    assert "Chó bị tiêu chảy" in obs_web
    assert "thức ăn mềm" in obs_web
    assert "example.com" in obs_web


def test_single_agent_combines_kb_and_web_answers():
    """Fallback mode (llm_client=None): ghép content từ pet_knowledge_search + web_search."""
    agent = SingleAgent(
        llm_client=None, enabled_tools=["pet_knowledge_search", "web_search"]
    )

    answer = build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "query": "chó bị tiêu chảy nên ăn gì",
                "results": [
                    {
                        "title": "Chó bị tiêu chảy nên ăn gì?",
                        "snippet": "Cho ăn cháo loãng và bổ sung nước.",
                        "url": "https://example.com/dog-diet",
                        "source": "https://example.com/dog-diet",
                        "score": 5,
                    }
                ],
                "sources_used": 1,
                "search_source": "web_search",
            },
        },
        react_steps=[
            {
                "step_type": "action",
                "content": "Called pet_knowledge_search",
                "tool_name": "pet_knowledge_search",
                "tool_params": {"query": "chó bị tiêu chảy nên ăn gì"},
                "tool_result": {
                    "success": True,
                    "data": {
                        "results": [
                            {
                                "content": "Cho chó ăn cháo loãng khi bị tiêu chảy. Cần theo dõi mất nước và phân lỏng.",
                                "score": 0.82,
                                "source": "petcare.pdf",
                                "chunk_index": 0,
                            }
                        ],
                        "sources_used": 1,
                        "search_source": "knowledge_base",
                    },
                },
            }
        ],
        messages=[
            {
                "role": "user",
                "content": "chó bị tiêu chảy nên ăn gì",
                "name": None,
                "tool_call_id": None,
            }
        ],
        llm_client=None,
        enabled_tools_lower=agent._enabled_tools_lower,
    )

    assert answer is not None
    # Should include KB content
    assert "cháo loãng" in answer
    # Should include web content
    assert "Chó bị tiêu chảy" in answer or "bổ sung nước" in answer


def test_single_agent_returns_web_search_answer_as_final_answer():
    """Fallback mode (llm_client=None): web_search results trả trực tiếp."""
    agent = SingleAgent(llm_client=None, enabled_tools=["web_search"])

    answer = build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "query": "chó bị nôn",
                "results": [
                    {
                        "title": "Chó bị nôn - Nguyên nhân và cách xử lý",
                        "snippet": "Đây là câu trả lời đã được tổng hợp từ web.",
                        "url": "https://example.com/dog-vomit",
                        "source": "https://example.com/dog-vomit",
                        "score": 5,
                    }
                ],
                "sources_used": 1,
                "search_source": "web_search",
            },
        },
        react_steps=[],
        messages=[],
        llm_client=None,
        enabled_tools_lower=agent._enabled_tools_lower,
    )

    assert answer is not None
    assert "Chó bị nôn" in answer
    assert "tổng hợp từ web" in answer


def test_single_agent_omits_empty_web_message_when_kb_has_results():
    """Fallback mode (llm_client=None): khi web_search trả 0 results nhưng KB có, chỉ dùng KB."""
    agent = SingleAgent(
        llm_client=None, enabled_tools=["pet_knowledge_search", "web_search"]
    )

    answer = build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "query": "chó bị tiêu chảy thì nên ăn gì",
                "results": [],
                "sources_used": 0,
                "search_source": "web_search",
            },
        },
        react_steps=[
            {
                "step_type": "action",
                "content": "Called pet_knowledge_search",
                "tool_name": "pet_knowledge_search",
                "tool_params": {"query": "chó bị tiêu chảy thì nên ăn gì"},
                "tool_result": {
                    "success": True,
                    "data": {
                        "results": [
                            {
                                "content": "Cho chó ăn cháo loãng. Rối loạn tiêu hóa - theo dõi nước uống và phân trong 24 giờ.",
                                "score": 0.78,
                                "source": "petcare.pdf",
                                "chunk_index": 0,
                            }
                        ],
                        "sources_used": 1,
                        "search_source": "knowledge_base",
                    },
                },
            }
        ],
        messages=[
            {
                "role": "user",
                "content": "chó bị tiêu chảy thì nên ăn gì",
                "name": None,
                "tool_call_id": None,
            }
        ],
        llm_client=None,
        enabled_tools_lower=agent._enabled_tools_lower,
    )

    assert answer is not None
    assert "cháo loãng" in answer


def test_perform_duckduckgo_search_relaxed_fallback_works():
    """Khi không có kết quả score >= 4, relaxed fallback (score >= 1) phải trả về."""
    from app.core.tools.mcp_tools.medical_tools import _perform_duckduckgo_search

    fake_raw_results = [
        {
            "title": "Thông tin thú y tổng quát",
            "body": "Chó nên ăn thức ăn mềm khi bị tiêu chảy.",
            "href": "https://example.com/general-vet",
        },
    ]

    with patch("app.core.tools.mcp_tools.medical_tools.DDGS") as MockDDGS:
        mock_instance = MockDDGS.return_value.__enter__.return_value
        mock_instance.text.return_value = fake_raw_results

        # Patch _score_web_result để trả score = 2 (dưới strict threshold 4, nhưng trên relaxed 1)
        with patch(
            "app.core.tools.mcp_tools.medical_tools._score_web_result",
            return_value=2,
        ):
            results = _perform_duckduckgo_search(
                "chó bị tiêu chảy nên ăn gì", max_results=3
            )

    # Relaxed fallback PHẢI trả về kết quả score >= 1
    assert len(results) == 1
    assert results[0]["score"] == 2
    assert "thú y" in results[0]["title"].lower()


def test_build_search_query_does_not_over_expand():
    """Query đã có context pet thì không thêm extras."""
    from app.core.tools.mcp_tools.medical_tools import _build_search_query

    # Vietnamese query đã có "chó" → không thêm gì
    result = _build_search_query("chó bị tiêu chảy nên ăn gì")
    assert result == "chó bị tiêu chảy nên ăn gì"

    # Vietnamese query không có pet term → thêm "thú y"
    result2 = _build_search_query("tiêu chảy nên ăn gì")
    assert "thú y" in result2

    # English query đã có "dog" → không thêm gì
    result3 = _build_search_query("dog diarrhea what to feed")
    assert result3 == "dog diarrhea what to feed"

    # English query không có pet term → thêm "pet veterinary"
    result4 = _build_search_query("diarrhea treatment")
    assert "pet veterinary" in result4


def test_extract_query_keywords_bilingual():
    """Keywords phải được extract cho cả tiếng Việt và tiếng Anh."""
    from app.core.tools.mcp_tools.medical_tools import _extract_query_keywords

    # Vietnamese
    vn_keywords = _extract_query_keywords("chó bị tiêu chảy nên ăn gì")
    assert "tiêu" in vn_keywords
    assert "chảy" in vn_keywords
    assert "ăn" in vn_keywords
    # Stop words phải bị loại
    assert "nên" not in vn_keywords

    # English
    en_keywords = _extract_query_keywords("dog diarrhea what to feed")
    assert "dog" in en_keywords
    assert "diarrhea" in en_keywords
    assert "feed" in en_keywords
    # Stop words phải bị loại
    assert "what" not in en_keywords
    assert "to" not in en_keywords


def test_score_web_result_language_agnostic():
    """Scoring phải hoạt động cho cả tiếng Việt và tiếng Anh."""
    from app.core.tools.mcp_tools.medical_tools import _score_web_result

    # Vietnamese - kết quả phù hợp phải có score > 0
    score_vn = _score_web_result(
        "chó bị tiêu chảy nên ăn gì",
        "Chó bị tiêu chảy nên ăn gì? Hướng dẫn chế độ ăn",
        "Cho chó ăn thức ăn mềm, dễ tiêu khi bị tiêu chảy.",
        "https://example.com/dog-care",
    )
    assert score_vn >= 4

    # English - kết quả phù hợp phải có score > 0
    score_en = _score_web_result(
        "dog diarrhea what to feed",
        "What to Feed a Dog with Diarrhea",
        "Feed bland diet like boiled chicken and rice for dogs with diarrhea.",
        "https://example.com/dog-diet",
    )
    assert score_en >= 4

    # Wikipedia phải bị penalty
    score_wiki = _score_web_result(
        "dog diarrhea",
        "Dog - Wikipedia",
        "The dog is a domesticated descendant of the wolf.",
        "https://en.wikipedia.org/wiki/Dog",
    )
    assert score_wiki < score_en
