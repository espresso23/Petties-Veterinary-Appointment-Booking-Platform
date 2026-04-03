from pathlib import Path
import sys
import types
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

import pytest

from app.core.agents.fast_path import (
    build_web_search_fallback_call,
    build_fast_pet_care_tool_call,
    infer_general_pet_type,
    should_auto_fallback_empty_kb_to_web_search,
    should_fast_finalize_simple_pet_care_answer,
    should_fast_finalize_pet_knowledge_answer,
    should_fast_path_pet_care_from_conversation,
    should_fast_path_pet_care_query,
)
from app.core.agents.single_agent import SingleAgent
from app.core.agents.state import create_initial_react_state


def test_infer_general_pet_type_detects_dog_and_cat():
    assert infer_general_pet_type("cho bi non mua") == "dog"
    assert infer_general_pet_type("meo bi tieu chay") == "cat"


def test_should_fast_path_simple_pet_owner_symptom_query():
    assert should_fast_path_pet_care_query(
        "Chó bị nôn mửa thì nên làm gì?",
        user_role="PET_OWNER",
        enabled_tools_lower={"pet_knowledge_search", "web_search"},
        has_active_booking=False,
        has_images=False,
    )


def test_should_fast_path_simple_admin_playground_symptom_query():
    assert should_fast_path_pet_care_query(
        "Chó bị nôn mửa thì nên làm gì?",
        user_role="ADMIN",
        enabled_tools_lower={"pet_knowledge_search", "web_search"},
        has_active_booking=False,
        has_images=False,
    )


def test_should_not_fast_path_booking_or_record_queries():
    assert not should_fast_path_pet_care_query(
        "Đặt lịch khám cho chó bị nôn",
        user_role="PET_OWNER",
        enabled_tools_lower={"pet_knowledge_search", "create_booking_for_user"},
        has_active_booking=False,
        has_images=False,
    )


def test_should_fast_path_from_conversation_when_latest_message_is_generic_follow_up():
    assert should_fast_path_pet_care_from_conversation(
        "tôi chỉ muốn biết nên làm gì thôi",
        "user: chó bị nôn mửa thì nên làm gì?\nassistant: ...",
        user_role="PET_OWNER",
        enabled_tools_lower={"pet_knowledge_search", "web_search"},
        has_active_booking=False,
        has_images=False,
    )
    assert not should_fast_path_pet_care_query(
        "Bé nhà tôi tiêm mũi nào tiếp theo?",
        user_role="PET_OWNER",
        enabled_tools_lower={"pet_knowledge_search", "get_user_pets"},
        has_active_booking=False,
        has_images=False,
    )


def test_build_fast_pet_care_tool_call_returns_pet_knowledge_search():
    tool_call = build_fast_pet_care_tool_call(
        "Chó bị nôn mửa thì nên làm gì?",
        user_role="PET_OWNER",
        enabled_tools_lower={"pet_knowledge_search"},
        has_active_booking=False,
        has_images=False,
    )

    assert tool_call is not None
    assert tool_call["name"] == "pet_knowledge_search"
    assert tool_call["arguments"]["pet_type"] == "dog"
    assert tool_call["arguments"]["enable_kg"] is False
    assert tool_call["arguments"]["enable_case_memory"] is False
    assert tool_call["arguments"]["enable_query_expansion"] is False


def test_should_fast_finalize_pet_knowledge_answer_for_simple_query():
    assert should_fast_finalize_pet_knowledge_answer(
        tool_name="pet_knowledge_search",
        tool_result={
            "success": True,
            "data": {
                "results": [
                    {"content": "Theo dõi mất nước và cho uống nước từng ít một."}
                ]
            },
        },
        latest_user_message="Chó bị nôn mửa thì nên làm gì?",
        user_role="PET_OWNER",
    )


def test_should_auto_fallback_empty_kb_to_web_search_for_simple_query():
    assert should_auto_fallback_empty_kb_to_web_search(
        tool_name="pet_knowledge_search",
        tool_result={
            "success": True,
            "data": {"results": [], "sources_used": 0},
        },
        latest_user_message="Chó bị nôn mửa thì nên làm gì?",
        user_role="PET_OWNER",
        enabled_tools_lower={"pet_knowledge_search", "web_search"},
        has_active_booking=False,
        has_images=False,
    )


def test_build_web_search_fallback_call_uses_original_question():
    fallback = build_web_search_fallback_call("Chó bị nôn mửa thì nên làm gì?")

    assert fallback is not None
    assert fallback["name"] == "web_search"
    assert fallback["arguments"]["query"] == "Chó bị nôn mửa thì nên làm gì?"


def test_should_fast_finalize_simple_pet_care_answer_after_web_search():
    assert should_fast_finalize_simple_pet_care_answer(
        tool_name="web_search",
        tool_result={
            "success": True,
            "data": {
                "results": [
                    {
                        "title": "Cho bi non mua",
                        "snippet": "Cho uong nuoc tung it mot.",
                    }
                ]
            },
        },
        latest_user_message="Chó bị nôn mửa thì nên làm gì?",
        user_role="PET_OWNER",
    )


@pytest.mark.asyncio
async def test_single_agent_uses_fast_path_without_initial_llm_call():
    class ExplodingLLM:
        async def generate(self, *args, **kwargs):
            raise AssertionError("LLM should not be called for fast-path routing")

    agent = SingleAgent(
        llm_client=ExplodingLLM(),
        enabled_tools=["pet_knowledge_search"],
    )
    state = create_initial_react_state(
        user_message="Chó bị nôn mửa thì nên làm gì?",
        context={"user_role": "PET_OWNER"},
    )

    result = await agent._think_node(state)

    assert result["pending_tool_call"]["name"] == "pet_knowledge_search"
    assert result["pending_tool_call"]["arguments"]["pet_type"] == "dog"


@pytest.mark.asyncio
async def test_single_agent_admin_also_uses_fast_path_without_initial_llm_call():
    class ExplodingLLM:
        async def generate(self, *args, **kwargs):
            raise AssertionError("LLM should not be called for fast-path routing")

    agent = SingleAgent(
        llm_client=ExplodingLLM(),
        enabled_tools=["pet_knowledge_search", "web_search"],
    )
    state = create_initial_react_state(
        user_message="Chó bị nôn mửa thì nên làm gì?",
        context={"user_role": "ADMIN"},
    )

    result = await agent._think_node(state)

    assert result["pending_tool_call"]["name"] == "pet_knowledge_search"
    assert result["pending_tool_call"]["arguments"]["pet_type"] == "dog"


@pytest.mark.asyncio
async def test_single_agent_fast_finalize_after_pet_knowledge_search():
    class FakeLLM:
        async def generate(self, *args, **kwargs):
            return SimpleNamespace(
                content="Bạn nên cho chó nghỉ ăn ngắn hạn, uống nước từng ít một và đi khám nếu nôn lặp lại hoặc có dấu hiệu mệt."
            )

    agent = SingleAgent(
        llm_client=FakeLLM(),
        enabled_tools=["pet_knowledge_search"],
    )
    state = create_initial_react_state(
        user_message="Chó bị nôn mửa thì nên làm gì?",
        context={"user_role": "PET_OWNER"},
    )
    state["last_tool_result"] = {
        "success": True,
        "data": {
            "results": [
                {
                    "content": "Cho chó uống nước từng ít một, theo dõi tình trạng mất nước và đi khám nếu nôn kéo dài.",
                    "score": 0.82,
                    "source": "petcare.pdf",
                    "chunk_index": 0,
                }
            ],
            "sources_used": 1,
            "search_source": "knowledge_base",
        },
    }
    state["react_steps"] = [
        {
            "step_type": "action",
            "content": "Called pet_knowledge_search",
            "tool_name": "pet_knowledge_search",
            "tool_params": {
                "query": "Chó bị nôn mửa thì nên làm gì?",
                "pet_type": "dog",
            },
            "tool_result": state["last_tool_result"],
        }
    ]

    result = await agent._observe_node(state)

    assert result["should_end"] is True
    assert "đi khám" in result["final_answer"].lower()


@pytest.mark.asyncio
async def test_finalizer_prompt_for_simple_symptom_query_prioritizes_direct_advice():
    captured = {}

    class CapturingLLM:
        async def generate(self, *args, **kwargs):
            captured["prompt"] = kwargs.get("prompt")
            return SimpleNamespace(
                content="Cho bé nghỉ ăn ngắn hạn, uống nước từng ít một và đi khám nếu nôn lặp lại."
            )

    agent = SingleAgent(
        llm_client=CapturingLLM(),
        enabled_tools=["pet_knowledge_search", "web_search"],
    )
    state = create_initial_react_state(
        user_message="tôi chỉ muốn biết nên làm gì thôi",
        context={"user_role": "PET_OWNER"},
        chat_history=[
            {"role": "user", "content": "Chó bị nôn mửa thì nên làm gì?"},
            {
                "role": "assistant",
                "content": "Bạn có thể cho mình biết thêm tình trạng của bé không?",
            },
        ],
    )
    state["last_tool_result"] = {
        "success": True,
        "data": {
            "results": [
                {
                    "content": "Cho chó nghỉ ăn ngắn hạn 6-12 giờ, cho uống nước từng ít một, theo dõi mất nước và đi khám nếu nôn lặp lại.",
                    "score": 0.8,
                    "source": "petcare.pdf",
                }
            ]
        },
    }
    state["current_observation"] = (
        "Có hướng dẫn xử lý ban đầu an toàn cho chó bị nôn mửa."
    )

    result = await agent._finalize_if_missing(state)

    assert result is not None
    assert "nghỉ ăn" in result.lower() or "uống nước" in result.lower()
    assert "không mở đầu bằng việc hỏi thêm thông tin" in captured["prompt"].lower()
    assert "nên làm gì ngay bây giờ" in captured["prompt"].lower()


@pytest.mark.asyncio
async def test_single_agent_auto_fallbacks_to_web_search_when_kb_empty():
    class FakeLLM:
        async def generate(self, *args, **kwargs):
            raise AssertionError("LLM should not be called before web fallback")

    agent = SingleAgent(
        llm_client=FakeLLM(),
        enabled_tools=["pet_knowledge_search", "web_search"],
    )
    state = create_initial_react_state(
        user_message="Chó bị nôn mửa thì nên làm gì?",
        context={"user_role": "PET_OWNER"},
    )
    state["iteration"] = 1
    state["last_tool_result"] = {
        "success": True,
        "data": {"results": [], "sources_used": 0, "search_source": "knowledge_base"},
    }
    state["react_steps"] = [
        {
            "step_type": "action",
            "content": "Called pet_knowledge_search",
            "tool_name": "pet_knowledge_search",
            "tool_params": {
                "query": "Chó bị nôn mửa thì nên làm gì?",
                "pet_type": "dog",
            },
            "tool_result": state["last_tool_result"],
        }
    ]

    result = await agent._think_node(state)

    assert result["pending_tool_call"]["name"] == "web_search"
    assert (
        result["pending_tool_call"]["arguments"]["query"]
        == "Chó bị nôn mửa thì nên làm gì?"
    )


@pytest.mark.asyncio
async def test_single_agent_fast_finalize_after_web_search_result():
    class FakeLLM:
        async def generate(self, *args, **kwargs):
            return SimpleNamespace(
                content="Bạn nên cho chó nghỉ ăn ngắn hạn, uống nước từng ít một và đưa đi khám nếu nôn lặp lại hoặc có dấu hiệu mất nước."
            )

    agent = SingleAgent(
        llm_client=FakeLLM(),
        enabled_tools=["pet_knowledge_search", "web_search"],
    )
    state = create_initial_react_state(
        user_message="Chó bị nôn mửa thì nên làm gì?",
        context={"user_role": "PET_OWNER"},
    )
    state["last_tool_result"] = {
        "success": True,
        "data": {
            "results": [
                {
                    "title": "Cho bi non mua",
                    "snippet": "Cho uống nước từng ít một và theo dõi mất nước.",
                    "url": "https://example.com/dog-vomit",
                }
            ],
            "sources_used": 1,
            "search_source": "web_search",
        },
    }
    state["react_steps"] = [
        {
            "step_type": "action",
            "content": "Called web_search",
            "tool_name": "web_search",
            "tool_params": {
                "query": "Chó bị nôn mửa thì nên làm gì?",
                "max_results": 3,
            },
            "tool_result": state["last_tool_result"],
        }
    ]

    result = await agent._observe_node(state)

    assert result["should_end"] is True
    assert "uống nước" in result["final_answer"].lower()
