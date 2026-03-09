from pathlib import Path
import asyncio
import sys
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.agents.single_agent import SingleAgent
from app.core.tools.mcp_tools.medical_tools import symptom_search, web_search


class FakeRagResult:
    def __init__(self, content: str, score: float, document_name: str, chunk_index: int = 0):
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
    assert "thú cưng hoặc thú y" in result["answer"]
    assert result["error"] == "Query ngoài phạm vi thú cưng/thú y"


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
    assert "Tôi không thấy đủ thông tin trong knowledge base" in result["answer"]
    assert "https://example.com/dog-diarrhea-diet" in result["answer"]


def test_single_agent_enriches_symptom_care_question_before_web_search():
    agent = SingleAgent(
        llm_client=None,
        enabled_tools=["pet_care_qa", "symptom_search", "web_search"],
    )

    state = {
        "iteration": 1,
        "react_steps": [
            {
                "step_type": "action",
                "content": "Called pet_care_qa",
                "tool_name": "pet_care_qa",
                "tool_params": {"query": "chó bị tiêu chảy nên ăn gì"},
                "tool_result": {
                    "success": True,
                    "data": {
                        "query": "chó bị tiêu chảy nên ăn gì",
                        "results": [],
                        "answer": "Không tìm thấy thông tin phù hợp trong knowledge base.",
                        "sources_used": 0,
                    },
                },
            }
        ],
        "messages": [
            {
                "role": "user",
                "content": "chó bị tiêu chảy nên ăn gì",
                "name": None,
                "tool_call_id": None,
            }
        ],
        "last_tool_result": {
            "success": True,
            "data": {
                "query": "chó bị tiêu chảy nên ăn gì",
                "results": [],
                "answer": "Không tìm thấy thông tin phù hợp trong knowledge base.",
                "sources_used": 0,
            },
        },
    }

    result = asyncio.run(agent._think_node(state))

    assert result["should_end"] is False
    assert result["pending_tool_call"]["name"] == "symptom_search"
    assert result["pending_tool_call"]["arguments"]["symptoms"] == ["tiêu chảy"]


def test_single_agent_uses_web_search_after_symptom_enrichment_for_care_question():
    agent = SingleAgent(
        llm_client=None,
        enabled_tools=["pet_care_qa", "symptom_search", "web_search"],
    )

    state = {
        "iteration": 2,
        "react_steps": [
            {
                "step_type": "action",
                "content": "Called pet_care_qa",
                "tool_name": "pet_care_qa",
                "tool_params": {"query": "chó bị tiêu chảy nên ăn gì"},
                "tool_result": {
                    "success": True,
                    "data": {
                        "query": "chó bị tiêu chảy nên ăn gì",
                        "results": [],
                        "answer": "Không tìm thấy thông tin phù hợp trong knowledge base.",
                        "sources_used": 0,
                    },
                },
            },
            {
                "step_type": "action",
                "content": "Called symptom_search",
                "tool_name": "symptom_search",
                "tool_params": {"symptoms": ["tiêu chảy"], "pet_type": "dog", "top_k": 5},
                "tool_result": {
                    "success": True,
                    "data": {
                        "symptoms": ["tiêu chảy"],
                        "pet_type": "dog",
                        "possible_conditions": [
                            {"name": "Viêm đường ruột", "severity": "vừa", "description": "Cần theo dõi mất nước."}
                        ],
                        "urgent": False,
                        "recommendations": "Theo dõi mất nước và đi khám nếu kéo dài.",
                    },
                },
            },
        ],
        "messages": [
            {
                "role": "user",
                "content": "chó bị tiêu chảy nên ăn gì",
                "name": None,
                "tool_call_id": None,
            }
        ],
        "last_tool_result": {
            "success": True,
            "data": {
                "symptoms": ["tiêu chảy"],
                "pet_type": "dog",
                "possible_conditions": [
                    {"name": "Viêm đường ruột", "severity": "vừa", "description": "Cần theo dõi mất nước."}
                ],
                "urgent": False,
                "recommendations": "Theo dõi mất nước và đi khám nếu kéo dài.",
            },
        },
    }

    result = asyncio.run(agent._think_node(state))

    assert result["should_end"] is False
    assert result["pending_tool_call"]["name"] == "web_search"


def test_build_final_answer_returns_none_when_llm_client_present():
    """Khi có LLM client, _build_final_answer_from_tool_result PHẢI return None
    để LLM tổng hợp answer thay vì auto-finalize."""

    class FakeLLMClient:
        pass

    agent = SingleAgent(llm_client=FakeLLMClient(), enabled_tools=["pet_care_qa", "web_search"])

    # pet_care_qa result → should NOT auto-finalize (LLM will synthesize)
    answer_kb = agent._build_final_answer_from_tool_result(
        tool_name="pet_care_qa",
        tool_result={"success": True, "data": {"answer": "Cho chó ăn cháo loãng.", "sources_used": 2}},
    )
    assert answer_kb is None

    # web_search result → should NOT auto-finalize
    answer_web = agent._build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={"success": True, "data": {"answer": "Từ web: cho ăn thức ăn mềm.", "sources_used": 3}},
    )
    assert answer_web is None

    # Error result → SHOULD auto-finalize even with LLM
    answer_err = agent._build_final_answer_from_tool_result(
        tool_name="pet_care_qa",
        tool_result={"success": False, "error": "Qdrant connection timeout"},
    )
    assert answer_err is not None
    assert "Qdrant connection timeout" in answer_err


def test_format_tool_observation_structures_context():
    """_format_tool_observation phải format tool data thành context rõ ràng cho LLM."""
    agent = SingleAgent(llm_client=None, enabled_tools=["pet_care_qa"])

    # KB answer
    obs_kb = agent._format_tool_observation({
        "answer": "Cho chó ăn cháo loãng khi bị tiêu chảy.",
        "sources_used": 3,
    })
    assert "KẾT QUẢ TRA CỨU:" in obs_kb
    assert "3 nguồn tài liệu" in obs_kb

    # Symptom data
    obs_symptom = agent._format_tool_observation({
        "possible_conditions": [
            {"name": "Viêm ruột", "severity": "vừa", "description": "Cần theo dõi mất nước."}
        ],
        "urgent": False,
        "recommendations": "Theo dõi 24 giờ.",
    })
    assert "CÁC BỆNH CÓ THỂ:" in obs_symptom
    assert "Viêm ruột" in obs_symptom
    assert "KHUYẾN NGHỊ:" in obs_symptom

    # Urgent
    obs_urgent = agent._format_tool_observation({
        "urgent": True,
        "recommendations": "Đưa đi khám ngay.",
    })
    assert "CẢNH BÁO:" in obs_urgent


def test_single_agent_combines_symptom_and_web_answers():
    """Fallback mode (llm_client=None): ghép answer từ tool results."""
    agent = SingleAgent(llm_client=None, enabled_tools=["pet_care_qa", "symptom_search", "web_search"])

    answer = agent._build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "answer": "Tôi không thấy đủ thông tin trong knowledge base nên đã tìm thêm từ nguồn web liên quan thú cưng/thú y:\n- Cho ăn cháo loãng và bổ sung nước.",
            },
        },
        react_steps=[
            {
                "step_type": "action",
                "content": "Called symptom_search",
                "tool_name": "symptom_search",
                "tool_params": {"symptoms": ["tiêu chảy"]},
                "tool_result": {
                    "success": True,
                    "data": {
                        "possible_conditions": [
                            {"name": "Viêm đường ruột", "severity": "vừa", "description": "Cần theo dõi mất nước và phân lỏng."}
                        ],
                        "urgent": False,
                        "recommendations": "Theo dõi mất nước và đi khám nếu kéo dài.",
                    },
                },
            }
        ],
        messages=[{"role": "user", "content": "chó bị tiêu chảy nên ăn gì", "name": None, "tool_call_id": None}],
    )

    assert answer is not None
    assert "Theo phần triệu chứng trong knowledge base" in answer
    assert "Cho ăn cháo loãng" in answer


def test_single_agent_falls_back_to_web_search_when_non_symptom_kb_query_is_empty():
    agent = SingleAgent(
        llm_client=None,
        enabled_tools=["pet_care_qa", "symptom_search", "web_search"],
    )

    state = {
        "iteration": 1,
        "react_steps": [
            {
                "step_type": "action",
                "content": "Called pet_care_qa",
                "tool_name": "pet_care_qa",
                "tool_params": {"query": "mèo anh lông ngắn có đặc điểm gì"},
                "tool_result": {
                    "success": True,
                    "data": {
                        "query": "mèo anh lông ngắn có đặc điểm gì",
                        "results": [],
                        "answer": "Không tìm thấy thông tin phù hợp trong knowledge base.",
                        "sources_used": 0,
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
                "results": [],
                "answer": "Không tìm thấy thông tin phù hợp trong knowledge base.",
                "sources_used": 0,
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


def test_single_agent_returns_web_search_answer_as_final_answer():
    """Fallback mode (llm_client=None): web_search result trả trực tiếp."""
    agent = SingleAgent(llm_client=None, enabled_tools=["web_search"])

    answer = agent._build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "answer": "Đây là câu trả lời đã được tổng hợp từ web.",
            },
        },
    )

    assert answer == "Đây là câu trả lời đã được tổng hợp từ web."


def test_symptom_search_marks_urgent_conditions():
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
        result = asyncio.run(symptom_search(["tiêu chảy", "nôn"], pet_type="dog", top_k=3))

    assert result["urgent"] is True
    assert len(result["possible_conditions"]) == 1
    assert result["possible_conditions"][0]["severity"] == "nghiêm trọng"
    assert "NGAY LẬP TỨC" in result["recommendations"]
    assert result["search_source"] == "knowledge_base"


def test_symptom_search_returns_safe_message_when_no_match():
    with patch(
        "app.core.rag.rag_engine.get_rag_engine",
        return_value=FakeRagEngine([]),
    ):
        result = asyncio.run(symptom_search(["rụng lông nhẹ"], pet_type="cat", top_k=3))

    assert result["urgent"] is False
    assert result["possible_conditions"] == []
    assert "Không tìm thấy thông tin phù hợp" in result["recommendations"]
    assert result["search_source"] == "knowledge_base"


def test_symptom_search_non_red_flag_diarrhea_is_not_urgent_and_is_summarized():
    fake_results = [
        FakeRagResult(
            content="Dấu hiệu thường thấy gồm tiêu chảy, tăng tần suất đi vệ sinh và có thể mất nước nhẹ. Theo dõi lượng nước uống và tình trạng phân trong 24 giờ.",
            score=0.82,
            document_name="petcare1.pdf",
        )
    ]

    with patch(
        "app.core.rag.rag_engine.get_rag_engine",
        return_value=FakeRagEngine(fake_results),
    ):
        result = asyncio.run(symptom_search(["tiêu chảy"], pet_type="dog", top_k=3))

    assert result["urgent"] is False
    assert len(result["possible_conditions"]) == 1
    assert "Theo dõi lượng nước uống" in result["possible_conditions"][0]["description"]
    assert "24 giờ" in result["recommendations"]


def test_single_agent_omits_empty_web_message_when_kb_summary_exists():
    """Fallback mode (llm_client=None): bỏ qua web empty message khi đã có KB summary."""
    agent = SingleAgent(llm_client=None, enabled_tools=["pet_care_qa", "symptom_search", "web_search"])

    answer = agent._build_final_answer_from_tool_result(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "answer": "Tôi chưa tìm thấy nguồn web phù hợp cho câu hỏi này trong phạm vi thú cưng/thú y.",
                "sources_used": 0,
            },
        },
        react_steps=[
            {
                "step_type": "action",
                "content": "Called symptom_search",
                "tool_name": "symptom_search",
                "tool_params": {"symptoms": ["tiêu chảy"]},
                "tool_result": {
                    "success": True,
                    "data": {
                        "possible_conditions": [
                            {"name": "Rối loạn tiêu hóa", "severity": "nhẹ", "description": "Theo dõi nước uống và phân trong 24 giờ."}
                        ],
                        "urgent": False,
                        "recommendations": "Nếu kéo dài quá 24 giờ thì nên đi khám.",
                    },
                },
            }
        ],
        messages=[{"role": "user", "content": "chó bị tiêu chảy thì nên ăn gì", "name": None, "tool_call_id": None}],
    )

    assert answer is not None
    assert "Rối loạn tiêu hóa" in answer
    assert "Tôi chưa tìm thấy nguồn web phù hợp" not in answer


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
            results = _perform_duckduckgo_search("chó bị tiêu chảy nên ăn gì", max_results=3)

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


def test_is_symptom_care_question_bilingual():
    """_is_symptom_care_question phải nhận diện cả tiếng Việt và tiếng Anh."""
    agent = SingleAgent(llm_client=None, enabled_tools=["pet_care_qa"])

    # Vietnamese
    assert agent._is_symptom_care_question("chó bị tiêu chảy nên ăn gì") is True
    assert agent._is_symptom_care_question("mèo bị nôn xử lý thế nào") is True

    # English
    assert agent._is_symptom_care_question("my dog has diarrhea what to feed") is True
    assert agent._is_symptom_care_question("cat vomiting how to treat") is True

    # Non-symptom questions
    assert agent._is_symptom_care_question("giống chó phổ biến") is False
    assert agent._is_symptom_care_question("popular dog breeds") is False


def test_extract_symptoms_bilingual():
    """_extract_symptoms_from_text phải detect symptoms cả 2 ngôn ngữ."""
    agent = SingleAgent(llm_client=None, enabled_tools=["pet_care_qa"])

    # Vietnamese
    vn_symptoms = agent._extract_symptoms_from_text("chó bị tiêu chảy và nôn")
    assert "tiêu chảy" in vn_symptoms
    assert "nôn" in vn_symptoms

    # English
    en_symptoms = agent._extract_symptoms_from_text("my dog has diarrhea and vomiting")
    assert "diarrhea" in en_symptoms
    assert "vomiting" in en_symptoms