from pathlib import Path
import asyncio
import sys
import types
from unittest.mock import AsyncMock, Mock, patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from app.core.agents.single_agent import SingleAgent
from app.core.agents.enrichment_strategy import build_final_answer_from_tool_result
from app.core.agents.response_formatter import format_tool_observation
from app.core.tools.mcp_tools.medical_tools import pet_knowledge_search
from app.core.tools.mcp_tools.common_tools import web_search


class FakeHybridChunk:
    def __init__(
        self,
        content: str,
        score: float,
        source: str = "rag",
        metadata: dict = None,
    ):
        self.content = content
        self.score = score
        self.source = source
        self.metadata = metadata or {}


class FakeHybridResult:
    def __init__(self, chunks, expanded_query="", original_query=""):
        self.chunks = chunks
        self.expanded_query = expanded_query
        self.original_query = original_query
        self.sources_used = {"rag": len(chunks)}
        self.timings_ms = {"rag": 12, "total": 12}


class FakeHybridEngine:
    def __init__(self, result: FakeHybridResult):
        self._result = result

    async def query(self, **kwargs):
        return self._result


def test_web_search_rejects_non_pet_query():
    result = asyncio.run(web_search("thời tiết Hà Nội hôm nay", max_results=3))

    assert result["success"] is False
    assert result["error_code"] == "OUT_OF_SCOPE"
    assert "thú cưng" in result["message"].lower()


def test_web_search_formats_pet_results():
    mocked_results = {
        "results": [
            {
                "title": "Chó bị tiêu chảy nên ăn gì?",
                "snippet": "Ưu tiên thức ăn mềm, dễ tiêu và bổ sung nước điện giải.",
                "url": "https://example.com/dog-diarrhea-diet",
                "source": "https://example.com/dog-diarrhea-diet",
                "score": 5,
            },
        ],
        "images": [],
        "answer": None,
        "follow_up_questions": [],
    }

    with patch(
        "app.core.tools.mcp_tools.common_tools._perform_tavily_search",
        return_value=mocked_results,
    ):
        result = asyncio.run(web_search("chó bị tiêu chảy nên ăn gì", max_results=3))

    assert result["success"] is True
    assert result["data"]["sources_used"] == 1
    assert result["data"]["search_source"] == "web_search"
    assert "answer" in result["data"]
    assert len(result["data"]["results"]) == 1


def test_pet_knowledge_search_returns_raw_results():
    """pet_knowledge_search trả về raw data từ KB, không có classification."""
    fake_hybrid_result = FakeHybridResult(
        chunks=[
            FakeHybridChunk(
                content="Nên tắm thú cưng 1-2 lần mỗi tuần và dùng sữa tắm chuyên dụng.",
                score=0.85,
                source="rag",
                metadata={"document_name": "petcare-guide.pdf", "chunk_index": 0},
            )
        ],
        expanded_query="cách tắm rửa thú cưng đúng cách",
        original_query="cách tắm rửa thú cưng đúng cách",
    )

    with patch(
        "app.core.rag.hybrid_engine.get_hybrid_rag_engine",
        return_value=FakeHybridEngine(fake_hybrid_result),
    ):
        result = asyncio.run(
            pet_knowledge_search(
                "cách tắm rửa thú cưng đúng cách", pet_type="dog", top_k=3
            )
        )

    assert result["success"] is True
    assert result["data"]["search_source"] == "knowledge_base"
    assert result["data"]["sources_used"] == 1
    assert len(result["data"]["results"]) == 1
    assert result["data"]["results"][0]["source"] == "petcare-guide.pdf"
    assert result["data"]["results"][0]["score"] == 0.85
    assert "tắm" in result["data"]["results"][0]["content"]
    assert result["metadata"]["timing_ms"]["total"] == 12
    # Should NOT have old classification fields
    assert "possible_conditions" not in result["data"]
    assert "urgent" not in result["data"]
    assert "answer" not in result["data"]
    assert "recommendations" not in result["data"]
    assert "disclaimer" not in result["data"]


def test_pet_knowledge_search_returns_empty_when_no_match():
    """Khi KB không có kết quả, trả về empty results."""
    fake_hybrid_result = FakeHybridResult(
        chunks=[],
        expanded_query="rụng lông nhẹ ở mèo",
        original_query="rụng lông nhẹ ở mèo",
    )

    with patch(
        "app.core.rag.hybrid_engine.get_hybrid_rag_engine",
        return_value=FakeHybridEngine(fake_hybrid_result),
    ):
        result = asyncio.run(
            pet_knowledge_search("rụng lông nhẹ ở mèo", pet_type="cat", top_k=3)
        )

    assert result["success"] is True
    assert result["data"]["sources_used"] == 0
    assert result["data"]["results"] == []
    assert result["data"]["search_source"] == "knowledge_base"
    assert result["metadata"]["timing_ms"]["rag"] == 12
    # Should NOT have old classification fields
    assert "possible_conditions" not in result["data"]
    assert "urgent" not in result["data"]


def test_pet_knowledge_search_symptom_query_returns_raw_data():
    """Symptom queries also return raw data — no tool-side analysis."""
    fake_hybrid_result = FakeHybridResult(
        chunks=[
            FakeHybridChunk(
                content="Bệnh parvo gây tiêu chảy ra máu, nôn và có thể rất nguy hiểm, cần cấp cứu ngay lập tức.",
                score=0.91,
                source="rag",
                metadata={"document_name": "parvo-guide.pdf", "chunk_index": 0},
            )
        ],
        expanded_query="chó bị tiêu chảy và nôn",
        original_query="chó bị tiêu chảy và nôn",
    )

    with patch(
        "app.core.rag.hybrid_engine.get_hybrid_rag_engine",
        return_value=FakeHybridEngine(fake_hybrid_result),
    ):
        result = asyncio.run(
            pet_knowledge_search("chó bị tiêu chảy và nôn", pet_type="dog", top_k=3)
        )

    assert result["success"] is True
    assert result["data"]["search_source"] == "knowledge_base"
    assert result["data"]["sources_used"] == 1
    assert len(result["data"]["results"]) == 1
    assert "parvo" in result["data"]["results"][0]["content"].lower()
    # Pure data — no classification
    assert "possible_conditions" not in result["data"]
    assert "urgent" not in result["data"]


def test_no_auto_web_fallback_when_kb_empty():
    """Policy mới: không auto fallback sang web_search khi KB rỗng."""
    answer = build_final_answer_from_tool_result(
        tool_name="pet_knowledge_search",
        tool_result={
            "success": True,
            "data": {
                "query": "mèo anh lông ngắn có đặc điểm gì",
                "pet_type": "cat",
                "results": [],
                "sources_used": 0,
                "search_source": "knowledge_base",
            },
        },
        react_steps=[],
        messages=[],
        llm_client=object(),
        enabled_tools_lower={"pet_knowledge_search", "web_search"},
    )

    assert answer is None


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
        tool_result={"success": False, "message": "Qdrant connection timeout"},
        react_steps=[],
        messages=[],
        llm_client=agent.llm_client,
        enabled_tools_lower=agent._enabled_tools_lower,
    )
    assert answer_err is not None
    assert "Qdrant connection timeout" in answer_err


def test_format_tool_observation_kb_results():
    """format_tool_observation trả về JSON compact chứa đầy đủ dữ liệu KB."""

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
    assert '"search_source":"knowledge_base"' in obs_kb
    assert "petcare.pdf" in obs_kb
    assert "0.85" in obs_kb
    assert "cháo loãng" in obs_kb


def test_format_tool_observation_web_results():
    """format_tool_observation trả về JSON compact cho kết quả web."""

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
    assert '"search_source":"web_search"' in obs_web
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
    """Fallback mode: web_search rỗng không tự sinh câu trả lời."""
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

    assert answer is None


def test_perform_duckduckgo_search_relaxed_fallback_works():
    """Khi không có kết quả score >= 4, relaxed fallback (score >= 1) phải trả về."""
    from app.core.tools.mcp_tools.common_tools import _perform_tavily_search
    import app.core.tools.mcp_tools.common_tools as common_tools

    fake_raw_results = [
        {
            "title": "Thông tin thú y tổng quát",
            "content": "Chó nên ăn thức ăn mềm khi bị tiêu chảy.",
            "url": "https://example.com/general-vet",
        },
    ]

    with patch.object(common_tools, "TAVILY_AVAILABLE", True):
        with patch(
            "app.core.tools.mcp_tools.common_tools._get_tavily_client",
            new_callable=AsyncMock,
        ) as mock_client:
            mock_instance = Mock()
            mock_instance.search.return_value = {"results": fake_raw_results}
            mock_client.return_value = mock_instance

            with patch(
                "app.core.tools.mcp_tools.common_tools._score_web_result",
                return_value=2,
            ):
                search_data = asyncio.run(
                    _perform_tavily_search("chó bị tiêu chảy nên ăn gì", max_results=3)
                )

    assert len(search_data["results"]) == 1
    assert search_data["results"][0]["score"] == 2


def test_build_search_query_returns_original():
    """Pet-health query được enrich nhẹ để Tavily bám đúng domain hơn."""
    from app.core.tools.mcp_tools.common_tools import _build_search_query

    dog_query = _build_search_query("chó bị tiêu chảy nên ăn gì")
    assert "chó bị tiêu chảy nên ăn gì" in dog_query
    assert "veterinary" in dog_query
    assert "dog canine" in dog_query

    symptom_query = _build_search_query("tiêu chảy nên ăn gì")
    assert "tiêu chảy nên ăn gì" in symptom_query
    assert "veterinary" in symptom_query
    assert "veterinary" in _build_search_query("dog diarrhea what to feed")
    assert "veterinary" in _build_search_query("diarrhea treatment")


def test_perform_tavily_search_accepts_pet_relevant_vet_result_without_literal_guard_keyword():
    from app.core.tools.mcp_tools.common_tools import _perform_tavily_search
    import app.core.tools.mcp_tools.common_tools as common_tools

    fake_raw_results = [
        {
            "title": "Managing canine vomiting at home",
            "content": "Veterinary first aid steps and warning signs before visiting the clinic.",
            "url": "https://example.com/vet/canine-vomiting",
        },
    ]

    with patch.object(common_tools, "TAVILY_AVAILABLE", True):
        with patch(
            "app.core.tools.mcp_tools.common_tools._get_tavily_client",
            new_callable=AsyncMock,
        ) as mock_client:
            mock_instance = Mock()
            mock_instance.search.return_value = {
                "results": fake_raw_results,
                "images": [],
                "answer": None,
                "follow_up_questions": [],
            }
            mock_client.return_value = mock_instance

            search_data = asyncio.run(
                _perform_tavily_search("chó bị nôn mửa nên làm gì", max_results=3)
            )

    assert len(search_data["results"]) == 1
    assert "canine vomiting" in search_data["results"][0]["title"].lower()


def test_perform_tavily_search_accepts_string_images():
    from app.core.tools.mcp_tools.common_tools import _perform_tavily_search
    import app.core.tools.mcp_tools.common_tools as common_tools

    with patch.object(common_tools, "TAVILY_AVAILABLE", True):
        with patch(
            "app.core.tools.mcp_tools.common_tools._get_tavily_client",
            new_callable=AsyncMock,
        ) as mock_client:
            mock_instance = Mock()
            mock_instance.search.return_value = {
                "results": [],
                "images": ["https://example.com/image.jpg"],
                "answer": None,
                "follow_up_questions": [],
            }
            mock_client.return_value = mock_instance

            search_data = asyncio.run(
                _perform_tavily_search("chó bị nôn mửa nên làm gì", max_results=3)
            )

    assert search_data["images"][0]["url"] == "https://example.com/image.jpg"


def test_extract_query_keywords_bilingual():
    """Keywords phải được extract cho cả tiếng Việt và tiếng Anh."""
    from app.core.tools.mcp_tools.common_tools import _tokenize

    # Vietnamese
    vn_keywords = _tokenize("chó bị tiêu chảy nên ăn gì")
    assert "tiêu" in vn_keywords
    assert "chảy" in vn_keywords
    assert "ăn" in vn_keywords
    assert "nên" in vn_keywords
    assert "chó" in vn_keywords

    # English
    en_keywords = _tokenize("dog diarrhea what to feed")
    assert "dog" in en_keywords
    assert "diarrhea" in en_keywords
    assert "feed" in en_keywords
    assert "what" in en_keywords
    assert "to" in en_keywords


def test_score_web_result_domain_based():
    """Scoring dựa trên domain penalty — không dùng keyword matching."""
    from app.core.tools.mcp_tools.common_tools import _score_web_result

    # Nguồn bình thường: base score = 5
    score_normal = _score_web_result(
        "chó bị tiêu chảy nên ăn gì",
        "Chó bị tiêu chảy nên ăn gì? Hướng dẫn chế độ ăn",
        "Cho chó ăn thức ăn mềm, dễ tiêu khi bị tiêu chảy.",
        "https://example.com/dog-care",
    )
    assert score_normal == 5  # Base score, no penalty

    # English cũng base score = 5
    score_en = _score_web_result(
        "dog diarrhea what to feed",
        "What to Feed a Dog with Diarrhea",
        "Feed bland diet like boiled chicken and rice for dogs with diarrhea.",
        "https://example.com/dog-diet",
    )
    assert score_en == 5

    # Wikipedia phải bị penalty
    score_wiki = _score_web_result(
        "dog diarrhea",
        "Dog - Wikipedia",
        "The dog is a domesticated descendant of the wolf.",
        "https://en.wikipedia.org/wiki/Dog",
    )
    assert score_wiki < score_en
    assert score_wiki <= 2  # Base 5 - penalty 3 = 2
