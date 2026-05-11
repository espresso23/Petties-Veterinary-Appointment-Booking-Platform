"""


PETTIES AGENT SERVICE - Single Agent with ReAct Pattern





Single Agent architecture using LangGraph StateGraph with ReAct loop:


Thought -> Action (Tool Call) -> Observation -> Loop until done





Flow:


1. User Message -> Think (LLM reasoning)


2. Think -> Act (Execute @mcp.tool)


3. Act -> Observe (Process tool result)


4. Observe -> Think (Loop) OR End (Final answer)





Package: app.core.agents


Purpose: Lean orchestrator - delegates domain logic to extracted modules


Version: v2.0.0 (Refactored from 1710-line god class)


"""

from typing import Optional, List, Dict, Any, Literal
import asyncio
from datetime import datetime


from langgraph.graph import StateGraph, END
from loguru import logger


import json
import time


import uuid


import re


from zoneinfo import ZoneInfo


from app.core.agents.state import ReActState, ReActStep, create_initial_react_state


# Extracted modules


from app.core.agents.text_utils import (
    build_recent_dialogue,
    extract_latest_user_message,
)


from app.core.agents.thought_parser import parse_thought


from app.core.agents.response_formatter import format_tool_observation


from app.core.agents.tool_routing import apply_booking_tool_routing


from app.core.agents.fast_path import (
    build_fast_product_web_search_call,
    build_web_search_fallback_call,
    build_fast_pet_care_tool_call,
    should_prefer_web_search_for_product_query,
    should_auto_fallback_empty_kb_to_web_search,
    should_fast_path_pet_care_from_conversation,
    should_fast_finalize_simple_pet_care_answer,
)


from app.core.agents.prompt_builder import build_context, create_think_prompt
from app.core.tool_runtime_context import get_tool_runtime_context


_FINALIZER_MAX_JSON_CHARS = 3500


_BOOKING_RUNTIME_TZ = "Asia/Ho_Chi_Minh"


# ===== DEFAULT SYSTEM PROMPT =====


#


# Nguyên tắc tách prompt:


#


# DEFAULT_SYSTEM_PROMPT (Admin-editable via Dashboard/DB):


#   -> Nhân cách, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ


#   -> Admin có thể chỉnh sửa mà không ảnh hưởng kỹ thuật


#


# create_think_prompt() (Code-managed, hardcoded in prompt_builder.py):


#   -> ReAct format, công cụ có sẵn (auto từ tool_schemas)


#   -> Nguyên tắc trả lời, nhận diện lỗi chính tả


#   -> Không nên thay đổi qua Dashboard


#


# Admin chỉ nên chỉnh: vai trò, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ.


# Các quy tắc kỹ thuật (ReAct, tools, cách trả lời) do code quản lý.


#


DEFAULT_SYSTEM_PROMPT = """Bạn là Petties AI Assistant - trợ lý AI chuyên về chăm sóc thú cưng.





## VAI TRÒ & GIỌNG ĐIỆU


- Xưng "mình", gọi người dùng là "bạn"


- Thân thiện, dễ hiểu, không dùng thuật ngữ quá chuyên môn


- Trả lời bằng tiếng Việt (trừ khi người dùng hỏi bằng tiếng Anh)





## NHIỆM VỤ


- Tư vấn sức khỏe thú cưng, nhận diện triệu chứng bệnh


- Hướng dẫn chăm sóc thú cưng (dinh dưỡng, vệ sinh, huấn luyện)


- Hỗ trợ đặt lịch khám tại phòng khám thú y


- Tìm kiếm phòng khám gần người dùng





## QUY TẮC NGHIỆP VỤ


- Không đưa ra chẩn đoán cuối cùng - luôn khuyến khích đưa thú cưng đi khám bác sĩ


- Ưu tiên an toàn và sức khỏe của thú cưng


- Khi triệu chứng nguy hiểm (co giật, nôn ra máu, khó thở), nhấn mạnh cần đi khám NGAY


- Chỉ tư vấn trong phạm vi chăm sóc thú cưng, từ chối lịch sự nếu hỏi ngoài phạm vi


"""


# NOTE cho Admin: Prompt này chỉ nên chứa nhân cách, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ.


# KHÔNG thêm: ReAct pattern, danh sách tools, quy tắc format kỹ thuật (code đã quản lý).


from app.core.config_loader import AgentConfigLoader


class SingleAgent:
    """


    Single Agent with ReAct Pattern - Lean Orchestrator.





    Delegates domain logic to extracted modules:


    - text_utils: message extraction, pet type inference


    - thought_parser: LLM output parsing


    - response_formatter: tool result formatting


    - tool_routing: post-parse tool selection overrides


    - booking_flow: booking domain logic


    - enrichment_strategy: auto-chain & fallback decisions


    - prompt_builder: LLM prompt assembly





    Uses LangGraph StateGraph to implement ReAct loop:


    - Think: LLM reasoning about user message


    - Act: Execute tool call


    - Observe: Process tool result


    - Loop until final answer


    """

    def __init__(
        self,
        llm_client,
        name: str = "petties_agent",
        agent_type: str = "single_agent",
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        enabled_tools: Optional[List[str]] = None,
        tool_schemas: Optional[List[Dict[str, Any]]] = None,
        max_iterations: int = 7,
    ):
        """


        Initialize Single Agent.





        Args:


            llm_client: LLM client instance (OpenRouterClient)


            name: Name of the agent


            agent_type: Type of the agent


            system_prompt: System prompt (loaded from DB or default)


            temperature: Temperature parameter (0.0-1.0)


            max_tokens: Max tokens for response


            top_p: Top-P parameter (0.0-1.0)


            enabled_tools: List of enabled tool names


            tool_schemas: List of tool schema dicts


            max_iterations: Max ReAct iterations before force stop


        """

        self.llm_client = llm_client

        self.name = name

        self.agent_type = agent_type

        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT

        self.temperature = temperature

        self.max_tokens = max_tokens

        self.top_p = top_p

        self.enabled_tools = enabled_tools or []

        self.tool_schemas = tool_schemas or []

        self.max_iterations = max_iterations

        # Pre-compute lowercase set for module functions (computed once, reused everywhere)

        self._enabled_tools_lower = {t.lower() for t in self.enabled_tools}

        # Build LangGraph

        self.graph = self._build_graph()

        logger.info(
            f"SingleAgent initialized with {len(self.enabled_tools)} enabled tools, "
            f"temperature={self.temperature}, max_tokens={self.max_tokens}"
        )

    @classmethod
    async def create(
        cls,
        llm_client,
        name: str = "petties_agent",
        agent_type: str = "single_agent",
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        top_p: Optional[float] = None,
        enabled_tools: Optional[List[str]] = None,
        tool_schemas: Optional[List[Dict[str, Any]]] = None,
        max_iterations: int = 8,
    ) -> "SingleAgent":
        """


        Factory method to create SingleAgent with config loaded from database.





        If system_prompt, temperature, max_tokens, top_p are not provided,


        they will be loaded from DB via AgentConfigLoader.





        Args:


            llm_client: LLM client instance


            name: Agent name (default: petties_agent)


            agent_type: Agent type


            system_prompt: Override system prompt (optional)


            temperature: Override temperature (optional)


            max_tokens: Override max_tokens (optional)


            top_p: Override top_p (optional)


            enabled_tools: List of enabled tool names


            tool_schemas: List of tool schema dicts


            max_iterations: Max iterations before force stop





        Returns:


            SingleAgent instance with config from DB


        """

        # Load config from DB for model/temperature parameters only

        # System prompt is now hardcoded - no longer loaded from DB

        config = await AgentConfigLoader.get_config(name)

        # Use provided values, fallback to DB config, then to defaults

        # System prompt is always from DEFAULT_SYSTEM_PROMPT (hardcoded)

        final_system_prompt = (
            system_prompt if system_prompt is not None else DEFAULT_SYSTEM_PROMPT
        )

        final_temperature = (
            temperature if temperature is not None else config.temperature
        )

        final_max_tokens = max_tokens if max_tokens is not None else config.max_tokens

        final_top_p = top_p if top_p is not None else config.top_p

        logger.info(
            f"Creating SingleAgent with config: "
            f"system_prompt=hardcoded, "
            f"temperature={final_temperature}, max_tokens={final_max_tokens}, top_p={final_top_p}"
        )

        return cls(
            llm_client=llm_client,
            name=name,
            agent_type=agent_type,
            system_prompt=final_system_prompt,
            temperature=final_temperature,
            max_tokens=final_max_tokens,
            top_p=final_top_p,
            enabled_tools=enabled_tools,
            tool_schemas=tool_schemas,
            max_iterations=max_iterations,
        )

    def _build_graph(self) -> StateGraph:
        """


        Build LangGraph StateGraph with ReAct pattern.





        Graph structure:


            START -> think -> should_continue?


                            -> act (if tool needed) -> observe -> think


                            -> END (if final answer)





        Returns:


            Compiled StateGraph with persistent checkpointer when available


        """

        workflow = StateGraph(ReActState)

        # Add nodes

        workflow.add_node("think", self._think_node)

        workflow.add_node("act", self._act_node)

        workflow.add_node("observe", self._observe_node)

        # Set entry point

        workflow.set_entry_point("think")

        # Add conditional edges

        workflow.add_conditional_edges(
            "think",
            self._should_continue,
            {
                "act": "act",  # Tool call needed -> execute
                "end": END,  # No tool call -> final answer
            },
        )

        # Act -> Observe -> Think (loop)
        workflow.add_edge("act", "observe")
        workflow.add_edge("observe", "think")

        # NOTE: No persistent checkpointer — conversation state is stored in MongoDB.
        # MemorySaver would retain state in-memory across requests, causing:
        #   1. Memory leaks with long-running service
        #   2. Stale state after restart
        #   3. Cross-session contamination if thread_id collides
        # Chat history is restored from MongoDB on each request via chat_history param.
        return workflow.compile()

    # ===== HELPERS =====

    def _build_schema_clarification(self, tool_name: str) -> str:
        """


        Build clarification message from tool schema required fields.





        Policy: LLM-first. No hardcoded per-tool messages.


        Reads required fields from tool_schemas and generates a generic ask.





        Returns:


            A natural Vietnamese clarification string.


        """

        schema = next(
            (
                t
                for t in self.tool_schemas
                if str(t.get("name") or "").strip() == tool_name
            ),
            None,
        )

        if schema:
            input_schema = schema.get("input_schema") or schema.get("parameters") or {}

            required_fields = (
                input_schema.get("required", [])
                if isinstance(input_schema, dict)
                else []
            )

            if required_fields:
                fields_text = ", ".join(str(f) for f in required_fields)

                return (
                    f"Mình chưa thể gọi công cụ `{tool_name}` vì còn thiếu: **{fields_text}**. "
                    "Bạn nói rõ thêm giúp mình nhé."
                )

        return (
            f"Mình chưa thể gọi công cụ `{tool_name}` vì thiếu tham số cần thiết. "
            "Bạn nói rõ thêm giúp mình nhé."
        )

    # ===== GRAPH NODES =====

    async def _think_node(self, state: ReActState) -> Dict[str, Any]:
        """


        Think Node - LLM reasoning.





        Analyzes user message and decides:


        1. Should a tool be called?


        2. Which tool is appropriate?


        3. Or should we answer directly?


        """

        logger.debug("Entering THINK node")

        iteration = state.get("iteration", 0)

        react_steps = state.get("react_steps", [])

        messages = state.get("messages", [])

        # Runtime context from client/session (images, location, ...)

        runtime_context = state.get("context", {}) or {}

        images = runtime_context.get("images", [])

        logger.info(
            f"THINK Node: iteration={iteration}, max_iterations={self.max_iterations}, has_images={len(images) > 0}"
        )

        if state.get("should_end") and state.get("final_answer"):
            return {
                "should_end": True,
                "final_answer": state.get("final_answer"),
                "iteration": iteration,
            }

        # Check max iterations

        if iteration >= self.max_iterations:
            logger.warning(
                f"Safety Break: Max iterations ({self.max_iterations}) reached."
            )

            return {
                "final_answer": "Rất tiếc, tôi đã đạt giới hạn suy luận tối đa mà chưa tìm được câu trả lời hoàn chỉnh. Vui lòng thử lại với câu hỏi cụ thể hơn.",
                "should_end": True,
            }

        if not isinstance(react_steps, list):
            logger.error(f"react_steps is not a list: {react_steps}")

            react_steps = []

        def build_context_with_runtime(steps):
            base = build_context(steps)

            runtime_parts: List[str] = []

            now_local = datetime.now(ZoneInfo(_BOOKING_RUNTIME_TZ))

            runtime_parts.append(
                "Runtime datetime: "
                f"current_datetime={now_local.isoformat(timespec='minutes')}, "
                f"current_date={now_local.date().isoformat()}, "
                f"timezone={_BOOKING_RUNTIME_TZ}"
            )

            loc = runtime_context.get("location")

            if loc:
                extra = None

                if isinstance(loc, dict):
                    lat = loc.get("latitude", None)

                    if lat is None:
                        lat = loc.get("lat", None)

                    lng = loc.get("longitude", None)

                    if lng is None:
                        lng = loc.get("lng", None)

                    addr = loc.get("address") or loc.get("formatted_address")

                    if lat is not None and lng is not None:
                        extra = f"Runtime location: latitude={lat}, longitude={lng}"

                        if isinstance(addr, str) and addr.strip():
                            extra += f", address={addr.strip()}"

                if extra is None:
                    try:
                        extra = (
                            f"Runtime location: {json.dumps(loc, ensure_ascii=False)}"
                        )

                    except Exception:
                        extra = f"Runtime location: {str(loc)}"

                runtime_parts.append(extra)

            runtime_context_block = "\n".join(runtime_parts)

            if not base:
                return runtime_context_block

            return (
                base + ("\n" if runtime_context_block else "") + runtime_context_block
            )

        # Build context from previous steps (delegated to prompt_builder)

        context = build_context_with_runtime(react_steps)

        latest_user_message = extract_latest_user_message(messages)
        runtime_tool_context = get_tool_runtime_context()
        booking_state = (
            runtime_tool_context.booking_state if runtime_tool_context else None
        )
        has_active_booking = bool(
            isinstance(booking_state, dict) and booking_state.get("active")
        )
        user_role = runtime_context.get("user_role")

        if iteration == 0:
            product_search_call = None
            if should_prefer_web_search_for_product_query(
                latest_user_message,
                user_role=user_role,
                enabled_tools_lower=self._enabled_tools_lower,
                has_active_booking=has_active_booking,
                has_images=bool(images),
            ):
                product_search_call = build_fast_product_web_search_call(
                    latest_user_message
                )
            if product_search_call:
                thought = str(
                    product_search_call.get("thought")
                    or "Mình sẽ tìm thêm nguồn web để gợi ý sản phẩm phù hợp cho bạn."
                ).strip()
                pending_tool_call = {
                    "name": product_search_call["name"],
                    "arguments": product_search_call["arguments"],
                }
                step = ReActStep(
                    step_type="thought",
                    content=thought,
                    tool_name=pending_tool_call["name"],
                    tool_params=pending_tool_call["arguments"],
                    tool_result=None,
                )
                return {
                    "react_steps": [step],
                    "current_thought": thought,
                    "pending_tool_call": pending_tool_call,
                    "should_end": False,
                    "final_answer": None,
                    "iteration": iteration + 1,
                }

            fast_tool_call = build_fast_pet_care_tool_call(
                latest_user_message,
                user_role=user_role,
                enabled_tools_lower=self._enabled_tools_lower,
                has_active_booking=has_active_booking,
                has_images=bool(images),
            )
            if fast_tool_call:
                thought = str(
                    fast_tool_call.get("thought")
                    or "Mình sẽ tra cứu nhanh hướng dẫn an toàn phù hợp trước."
                ).strip()
                pending_tool_call = {
                    "name": fast_tool_call["name"],
                    "arguments": fast_tool_call["arguments"],
                }
                step = ReActStep(
                    step_type="thought",
                    content=thought,
                    tool_name=pending_tool_call["name"],
                    tool_params=pending_tool_call["arguments"],
                    tool_result=None,
                )
                return {
                    "react_steps": [step],
                    "current_thought": thought,
                    "pending_tool_call": pending_tool_call,
                    "should_end": False,
                    "final_answer": None,
                    "iteration": iteration + 1,
                }

        last_tool_result = state.get("last_tool_result")

        # Find the last action step

        last_action = next(
            (s for s in reversed(react_steps) if s.get("step_type") == "action"),
            None,
        )

        fallback_web_tool_call = None
        if should_auto_fallback_empty_kb_to_web_search(
            tool_name=last_action.get("tool_name") if last_action else None,
            tool_result=last_tool_result,
            latest_user_message=latest_user_message,
            user_role=user_role,
            enabled_tools_lower=self._enabled_tools_lower,
            has_active_booking=has_active_booking,
            has_images=bool(images),
        ):
            fallback_web_tool_call = build_web_search_fallback_call(latest_user_message)

        if fallback_web_tool_call:
            thought = str(
                fallback_web_tool_call.get("thought")
                or "Nguồn nội bộ chưa đủ, mình tìm thêm nguồn web liên quan."
            ).strip()
            pending_tool_call = {
                "name": fallback_web_tool_call["name"],
                "arguments": fallback_web_tool_call["arguments"],
            }
            step = ReActStep(
                step_type="thought",
                content=thought,
                tool_name=pending_tool_call["name"],
                tool_params=pending_tool_call["arguments"],
                tool_result=None,
            )
            return {
                "react_steps": [step],
                "current_thought": thought,
                "pending_tool_call": pending_tool_call,
                "should_end": False,
                "final_answer": None,
                "iteration": iteration + 1,
            }

        # --- Call LLM ---
        # LLM will now naturally synthesize the answer from tools like quick_booking_search.
        # Manual fast-path builders are removed to favor LLM's personality consistency.

        warning_suffix = ""
        if last_action and iteration > 0:
            remaining = self.max_iterations - iteration
            warning_suffix = (
                f"\n\nBạn vừa gọi '{last_action.get('tool_name')}'. "
                f"Nếu còn thiếu thông tin thì gọi thêm tool phù hợp (còn {remaining} lượt), "
                f"nếu đã đủ thì viết Final Answer."
            )

        think_prompt = (
            create_think_prompt(
                messages,
                context,
                agent_name=self.name,
                agent_type=self.agent_type,
                system_prompt=self.system_prompt,
                tool_schemas=self.tool_schemas,
                enabled_tools_lower=self._enabled_tools_lower,
            )
            + warning_suffix
        )


        try:
            response = await asyncio.wait_for(
                self.llm_client.generate(
                    prompt=think_prompt,
                    system_prompt=self.system_prompt,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    images=images if images else None,
                ),
                timeout=90.0,
            )

            thought_content = response.content

            # Parse response (delegated to thought_parser)

            parsed = parse_thought(thought_content, self.enabled_tools)

            # Thin post-parse validation: sanitize params and fill shared context fields.

            parsed = apply_booking_tool_routing(
                parsed,
                messages,
                react_steps,
                self._enabled_tools_lower,
                build_context_with_runtime,
            )

            # Active loop prevention: intercept if LLM repeats same tool/params

            if (
                last_action
                and parsed.get("tool_name") == last_action.get("tool_name")
                and parsed.get("tool_params") == last_action.get("tool_params")
            ):
                logger.warning(
                    f"Loop prevention: Intercepted repetitive EXACT tool call to {parsed.get('tool_name')}"
                )

                last_obs = next(
                    (
                        s
                        for s in reversed(react_steps)
                        if s.get("step_type") == "observation"
                    ),
                    None,
                )

                obs_text = last_obs.get("content", "") if last_obs else ""

                parsed["should_end"] = True

                parsed["tool_name"] = None

                cleaned_observation = str(obs_text or "").strip()

                if cleaned_observation:
                    parsed["thought"] = cleaned_observation

                else:
                    parsed["thought"] = (
                        "Mình đang tránh lặp lại cùng một bước xử lý. "
                        "Bạn có thể bổ sung thêm thông tin nếu muốn mình tiếp tục."
                    )

            if not isinstance(parsed, dict):
                logger.error(f"Parsed thought is not a dict: {type(parsed)} - {parsed}")

                parsed = {"thought": thought_content, "should_end": True}

            # Create pending tool call if tool name is found AND params are valid

            pending_tool_call = None

            should_end = parsed.get("should_end", False)

            tool_name = parsed.get("tool_name")

            tool_params = parsed.get("tool_params", {})

            # If the LLM did not pick any tool (and is about to end) on the first iteration,

            # run a strict JSON "router" prompt to recover the intended tool call.

            # This avoids hardcoded keyword matching for intent detection.

            if (
                self.llm_client is not None
                and iteration == 0
                and should_end
                and (not tool_name)
            ):
                recovered = await self._recover_tool_call(
                    messages=messages, context=context
                )

                if recovered and recovered.get("tool_name"):
                    tool_name = recovered.get("tool_name")

                    tool_params = recovered.get("tool_params") or {}

                    parsed["tool_name"] = tool_name

                    parsed["tool_params"] = tool_params

                    parsed["should_end"] = False

                    should_end = False

            if tool_name:
                normalized_tool = str(tool_name).strip().lower()

                # Use policy system to check if empty params are allowed

                from app.core.tools.tool_policy import allow_empty_params

                tool_allows_empty = allow_empty_params(normalized_tool)

                if (not tool_params or len(tool_params) == 0) and not tool_allows_empty:
                    logger.warning(
                        f"Tool '{tool_name}' called with empty params - skipping to avoid error"
                    )

                    clarification = self._build_schema_clarification(normalized_tool)

                    parsed["thought"] = clarification

                else:
                    if tool_params is None or not isinstance(tool_params, dict):
                        tool_params = {}

                    pending_tool_call = {
                        "name": tool_name,
                        "arguments": tool_params,
                    }

                    should_end = False

            # Determine final answer

            final_answer = None

            if should_end:
                final_answer = parsed.get("thought", thought_content)

            # Log ReAct step

            step = ReActStep(
                step_type="thought",
                content=parsed.get("thought", thought_content),
                tool_name=tool_name if pending_tool_call else None,
                tool_params=tool_params if pending_tool_call else {},
                tool_result=None,
            )

            logger.info(f"THOUGHT: {parsed.get('thought', thought_content)[:100]}...")

            return {
                "react_steps": [step],
                "current_thought": parsed.get("thought", thought_content),
                "pending_tool_call": pending_tool_call,
                "should_end": should_end,
                "final_answer": final_answer,
                "iteration": iteration + 1,
            }

        except asyncio.TimeoutError:
            logger.error(f"LLM call timed out in THINK node (iteration {iteration})")
            return {
                "error": "LLM_TIMEOUT",
                "should_end": True,
                "final_answer": "Xin lỗi, trợ lý AI đã hết thời gian phản hồi. Vui lòng thử lại với câu hỏi ngắn gọn hơn.",
            }
        except Exception as e:
            logger.error(f"Error in THINK node: {e}")
            return {
                "error": str(e),
                "should_end": True,
                "final_answer": f"Lỗi kết nối LLM: {str(e)}. Vui lòng kiểm tra lại cấu hình/số dư tài khoản.",
            }

    async def _act_node(self, state: ReActState) -> Dict[str, Any]:
        """


        Act Node - Execute tool call.





        Executes the tool selected by the Think node via MCP.


        """

        logger.debug("Entering ACT node")

        tool_call = state.get("pending_tool_call")

        if not tool_call:
            logger.warning("No pending tool call in ACT node")

            return {"pending_tool_call": None}

        # Safety check: ensure tool_call is a dictionary

        if not isinstance(tool_call, dict):
            logger.error(
                f"pending_tool_call is not a dict: {type(tool_call)} - {tool_call}"
            )

            if isinstance(tool_call, str):
                try:
                    tool_call = json.loads(tool_call)

                except (json.JSONDecodeError, ValueError):
                    return {
                        "error": f"Invalid tool call format: {tool_call}",
                        "pending_tool_call": None,
                    }

            else:
                return {"pending_tool_call": None}

        tool_name = tool_call.get("name")

        tool_params = tool_call.get("arguments", {})

        # Check if tool is enabled

        if tool_name not in self.enabled_tools:
            logger.warning(f"Tool '{tool_name}' is not enabled")

            error_result = {
                "success": False,
                "error_code": "TOOL_NOT_AVAILABLE",
                "message": f"Tool '{tool_name}' không được bật. Vui lòng liên hệ admin.",
                "recoverable": False,
                "suggestion": "Vui lòng thử lại với công cụ khác phù hợp.",
                "metadata": {"available_tools": self.enabled_tools},
            }

            step = ReActStep(
                step_type="action",
                content=f"Called {tool_name} (DISABLED)",
                tool_name=tool_name,
                tool_params=tool_params,
                tool_result=error_result,
            )

            return {
                "react_steps": [step],
                "last_tool_result": error_result,
                "pending_tool_call": None,
            }

        try:
            from app.core.tools.executor import execute_tool

            result = await execute_tool(tool_name, tool_params)

            step = ReActStep(
                step_type="action",
                content=f"Called {tool_name}",
                tool_name=tool_name,
                tool_params=tool_params,
                tool_result=result,
            )

            logger.info(f"ACTION: Called {tool_name}")

            return {
                "react_steps": [step],
                "last_tool_result": result,
                "pending_tool_call": None,
            }

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")

            error_result = {
                "success": False,
                "error_code": "INTERNAL_ERROR",
                "message": "Không thể thực thi công cụ lúc này.",
                "recoverable": True,
                "suggestion": "Vui lòng thử lại sau ít phút.",
                "metadata": {"root_error": str(e)},
            }

            step = ReActStep(
                step_type="action",
                content=f"Error calling {tool_name}: {e}",
                tool_name=tool_name,
                tool_params=tool_params,
                tool_result=error_result,
            )

            return {
                "react_steps": [step],
                "last_tool_result": error_result,
                "pending_tool_call": None,
            }

    async def _observe_node(self, state: ReActState) -> Dict[str, Any]:
        """


        Observe Node - Process tool result.





        Formats tool result so the LLM can synthesize a final answer


        from context + its own knowledge.


        """

        logger.debug("Entering OBSERVE node")

        tool_result = state.get("last_tool_result", {})

        react_steps = state.get("react_steps", []) or []

        # Preserve which tool produced this observation so the client can render

        # tool-specific UI (e.g., clinic cards for search_clinics_nearby).

        last_action = next(
            (
                s
                for s in reversed(react_steps)
                if isinstance(s, dict) and s.get("step_type") == "action"
            ),
            None,
        )

        observed_tool_name = (
            last_action.get("tool_name") if isinstance(last_action, dict) else None
        )

        observed_tool_params = (
            last_action.get("tool_params") if isinstance(last_action, dict) else None
        )

        # Format observation (delegated to response_formatter)

        observation = ""

        if isinstance(tool_result, dict):
            if tool_result.get("success") is False:
                error_payload = {
                    "error_code": tool_result.get("error_code") or "INTERNAL_ERROR",
                    "message": tool_result.get("message")
                    or tool_result.get("error")
                    or "Đã xảy ra lỗi khi thực thi công cụ.",
                    "recoverable": tool_result.get("recoverable", True),
                    "suggestion": tool_result.get("suggestion"),
                }
                observation = format_tool_observation(error_payload)

            elif "error" in tool_result:
                observation = f"Tool returned error: {tool_result['error']}"

            elif "data" in tool_result and isinstance(tool_result["data"], dict):
                data_payload = tool_result["data"]
                if data_payload:
                    observation = format_tool_observation(data_payload)
                else:
                    fallback_payload = {
                        key: value
                        for key, value in tool_result.items()
                        if key
                        not in {
                            "success",
                            "data",
                            "metadata",
                            "tool_name",
                            "is_final",
                            "_warning",
                            "_dropped_params",
                        }
                    }
                    observation = format_tool_observation(fallback_payload)

            elif (
                tool_result.get("pets")
                or tool_result.get("clinics")
                or tool_result.get("services")
                or tool_result.get("slots")
            ):
                observation = format_tool_observation(tool_result)

            else:
                observation = json.dumps(tool_result, ensure_ascii=False, indent=2)

        else:
            observation = str(tool_result)

        step = ReActStep(
            step_type="observation",
            content=observation,
            tool_name=observed_tool_name,
            tool_params=observed_tool_params,
            tool_result=tool_result,
        )

        logger.info("OBSERVATION: Tool result processed")

        latest_user_message = extract_latest_user_message(
            state.get("messages", []) or []
        )
        user_role = (state.get("context", {}) or {}).get("user_role")
        if should_fast_finalize_simple_pet_care_answer(
            tool_name=observed_tool_name,
            tool_result=tool_result,
            latest_user_message=latest_user_message,
            user_role=user_role,
        ):
            fast_final_answer = self._build_fast_pet_owner_answer_from_tool_result(
                tool_name=observed_tool_name,
                tool_result=tool_result,
                latest_user_message=latest_user_message,
                user_role=user_role,
            )
            if not fast_final_answer:
                fast_final_answer = await self._finalize_if_missing(
                    {
                        **state,
                        "last_tool_result": tool_result,
                        "current_observation": observation,
                    }
                )
            if fast_final_answer:
                return {
                    "react_steps": [step],
                    "current_observation": observation,
                    "final_answer": fast_final_answer,
                    "should_end": True,
                }

        return {
            "react_steps": [step],
            "current_observation": observation,
        }

    def _build_fast_pet_owner_answer_from_tool_result(
        self,
        *,
        tool_name: Optional[str],
        tool_result: Any,
        latest_user_message: str,
        user_role: Optional[str],
    ) -> Optional[str]:
        normalized_role = str(user_role or "PET_OWNER").strip().upper()
        if normalized_role not in {"PET_OWNER", "ADMIN"}:
            return None

        normalized_tool = str(tool_name or "").strip().lower()
        if normalized_tool not in {"pet_knowledge_search", "web_search"}:
            return None

        if not isinstance(tool_result, dict) or tool_result.get("success") is False:
            return None

        data_payload = tool_result.get("data")
        if not isinstance(data_payload, dict):
            return None

        results = data_payload.get("results")
        if not isinstance(results, list) or not results:
            return None

        normalized_message = (latest_user_message or "").strip()
        if not normalized_message:
            return None

        advice_lines: List[str] = []
        seen: set[str] = set()
        for item in results:
            if not isinstance(item, dict):
                continue
            raw = item.get("content") or item.get("snippet") or item.get("title")
            text = str(raw or "").strip()
            if not text:
                continue

            text = re.sub(r"\s+", " ", text)
            text = text[:220].strip()
            if not text:
                continue

            key = text.lower()
            if key in seen:
                continue
            seen.add(key)

            if text[-1] not in ".!?":
                text = f"{text}."

            advice_lines.append(f"- {text}")
            if len(advice_lines) >= 2:
                break

        if not advice_lines:
            return None

        return (
            "Mình đã tra cứu nhanh cho bạn. Bạn có thể làm trước như sau:\n"
            + "\n".join(advice_lines)
            + "\nNếu bé không cải thiện hoặc có dấu hiệu nặng "
            + "(nôn/tiêu chảy lặp lại, mệt lả, bỏ ăn kéo dài, khó thở), "
            + "bạn nên đưa bé đi khám thú y sớm."
        )

    def _should_continue(self, state: ReActState) -> Literal["act", "end"]:
        """Router — decide whether to continue or end the ReAct loop."""

        iteration = state.get("iteration", 0)

        # 1. Safety break

        if iteration >= self.max_iterations:
            logger.warning(
                f"Should Continue: Max iterations {self.max_iterations} reached. Stopping."
            )

            return "end"

        # 2. Explicit end flag

        if state.get("should_end", False):
            return "end"

        # 3. Pending tool call

        if state.get("pending_tool_call"):
            return "act"

        # 4. Final answer present

        if state.get("final_answer"):
            return "end"

        return "end"

    # ===== PUBLIC API =====

    async def _finalize_if_missing(self, state: Dict[str, Any]) -> Optional[str]:
        """Synthesize a user-facing final answer when the graph ends without final_answer.





        This is a safety net for format drift / parser misses. It must NEVER output


        Thought/Tool/JSON; only a natural Vietnamese reply (or a short clarification question).


        """

        if self.llm_client is None or not isinstance(state, dict):
            return None

        messages = state.get("messages", []) or []

        last_tool_result = state.get("last_tool_result")

        current_observation = state.get("current_observation")
        user_msg = extract_latest_user_message(messages) or ""
        recent_dialogue = build_recent_dialogue(messages, limit=10) or "(không có)"
        ctx = state.get("context", {}) or {}
        fast_symptom_finalize = should_fast_path_pet_care_from_conversation(
            user_msg,
            recent_dialogue,
            user_role=ctx.get("user_role"),
            enabled_tools_lower=self._enabled_tools_lower,
            has_active_booking=False,
            has_images=False,
        )

        # Prefer structured tool result data; cap size to keep prompt small.

        tool_blob = ""

        try:
            if isinstance(last_tool_result, dict):
                if fast_symptom_finalize:
                    compact_result = dict(last_tool_result)
                    compact_data = (
                        dict(last_tool_result.get("data"))
                        if isinstance(last_tool_result.get("data"), dict)
                        else {}
                    )
                    raw_results = compact_data.get("results")
                    if isinstance(raw_results, list):
                        compact_results: List[Dict[str, Any]] = []
                        for item in raw_results[:2]:
                            if not isinstance(item, dict):
                                continue
                            compact_results.append(
                                {
                                    "content": str(
                                        item.get("content") or item.get("snippet") or ""
                                    ).strip()[:220],
                                    "source": item.get("source") or item.get("url"),
                                    "score": item.get("score"),
                                }
                            )
                        compact_data["results"] = compact_results
                    compact_result["data"] = compact_data
                    tool_blob = json.dumps(compact_result, ensure_ascii=False)
                else:
                    tool_blob = json.dumps(last_tool_result, ensure_ascii=False)

            elif last_tool_result is not None:
                tool_blob = str(last_tool_result)

        except Exception:
            tool_blob = str(last_tool_result)

        if len(tool_blob) > _FINALIZER_MAX_JSON_CHARS:
            tool_blob = tool_blob[:_FINALIZER_MAX_JSON_CHARS] + "..."

        obs_blob = ""

        if isinstance(current_observation, str) and current_observation.strip():
            obs_blob = current_observation.strip()

            if len(obs_blob) > 1200:
                obs_blob = obs_blob[:1200] + "..."

        prompt = (
            "Bạn là trợ lý AI của Petties.\n"
            "Nhiệm vụ: tạo một câu trả lời tự nhiên bằng tiếng Việt cho người dùng.\n"
            "Không trả về JSON, không trả về Thought/Tool, không chào lại nếu hội thoại đang tiếp diễn.\n"
            + (
                "Với câu hỏi triệu chứng/chăm sóc đơn giản, hãy ưu tiên trả lời ngay người dùng nên làm gì trước. "
                "Đưa ra 3-5 bước xử lý an toàn ban đầu thật ngắn gọn, sau đó nêu 2-4 dấu hiệu cần đi khám gấp. "
                "KHÔNG mở đầu bằng việc hỏi thêm thông tin. Chỉ hỏi thêm tối đa 1 câu ở CUỐI nếu thật sự cần để cá nhân hóa sâu hơn.\n\n"
                if fast_symptom_finalize
                else "Nếu dữ liệu hiện có chưa đủ, hãy hỏi lại đúng 1 câu ngắn gọn để lấy phần còn thiếu.\n\n"
            )
            + "Hội thoại gần đây:\n"
            + recent_dialogue
            + "\n\nCâu hỏi mới nhất của người dùng:\n"
            + (user_msg or "(không có)")
            + "\n\nObservation gần nhất:\n"
            + (obs_blob or "(không có)")
            + "\n\nDữ liệu công cụ gần nhất:\n"
            + (tool_blob or "(không có)")
            + "\n\n"
            + (
                "Hãy trả lời đúng trọng tâm yêu cầu hiện tại theo format tự nhiên: "
                "(1) nên làm gì ngay bây giờ, (2) khi nào cần đi khám, (3) lưu ý ngắn."
                if fast_symptom_finalize
                else "Hãy trả lời đúng trọng tâm yêu cầu hiện tại."
            )
        )

        try:
            finalize_started = time.perf_counter()
            resp = await asyncio.wait_for(
                self.llm_client.generate(
                    prompt=prompt,
                    system_prompt=self.system_prompt,
                    temperature=(
                        min(0.25, float(self.temperature or 0.2))
                        if fast_symptom_finalize
                        else min(0.4, float(self.temperature or 0.2))
                    ),
                    max_tokens=(
                        min(320, int(self.max_tokens or 320))
                        if fast_symptom_finalize
                        else min(700, int(self.max_tokens or 700))
                    ),
                    images=None,
                ),
                timeout=12.0 if fast_symptom_finalize else 30.0,
            )

            text = (resp.content or "").strip()

            logger.info(
                "Finalizer completed in {}ms (fast_symptom_finalize={})",
                int((time.perf_counter() - finalize_started) * 1000),
                fast_symptom_finalize,
            )

            return text or None

        except Exception as e:
            logger.error(f"Finalizer failed: {e}")

            return None

    async def _recover_tool_call(
        self,
        *,
        messages: List[Any],
        context: str,
    ) -> Optional[Dict[str, Any]]:
        """Recover tool routing using a strict JSON-only prompt (LLM-based).





        This is used only when the main ReAct output fails to select a tool.


        """

        if self.llm_client is None:
            return None

        user_msg = extract_latest_user_message(messages) or ""

        if not user_msg:
            return None

        # Keep a short window of dialogue for routing.

        history_lines: List[str] = []

        for msg in messages[-8:]:
            if isinstance(msg, dict):
                role = str(msg.get("role") or "").strip()

                content = str(msg.get("content") or "").strip()

            else:
                role = str(getattr(msg, "role", "") or "").strip()

                content = str(getattr(msg, "content", "") or "").strip()

            if not content:
                continue

            history_lines.append(f"- {role}: {content}")

        tools_desc: List[str] = []

        for tool in self.tool_schemas or []:
            name = str(tool.get("name") or "").strip()

            if not name:
                continue

            if name.lower() not in self._enabled_tools_lower:
                continue

            schema = tool.get("input_schema") or tool.get("parameters") or {}

            required = []

            properties = {}

            if isinstance(schema, dict):
                required = schema.get("required", []) or []

                properties = schema.get("properties") or {}

            req_txt = ", ".join(str(x) for x in required) if required else "none"

            desc = str(tool.get("description") or "").strip() or "No description"

            semantic_fields: List[str] = []

            if isinstance(properties, dict):
                for field_name, field_meta in properties.items():
                    if not isinstance(field_meta, dict):
                        semantic_fields.append(str(field_name))

                        continue

                    field_type = str(field_meta.get("type") or "any")

                    semantic_fields.append(f"{field_name}:{field_type}")

            schema_txt = (
                ", ".join(semantic_fields) if semantic_fields else "no-properties"
            )

            tools_desc.append(
                f"- {name}: {desc} | required=({req_txt}) | fields=({schema_txt})"
            )

        prompt = (
            "You are the tool router for the Petties AI assistant.\n"
            "Task: choose 0 or 1 best next tool call based on the user's question and available tools.\n"
            "Return exactly 1 JSON object and nothing else.\n"
            "Schema JSON:\n"
            '{ "tool_name": string|null, "tool_params": object, "reason": string }\n'
            "Rules:\n"
            "- Read each tool's description carefully to choose the right tool\n"
            "- Fill tool_params from the full conversation context, not only the last message\n"
            "- Prefer semantic fields like date_expression, time_preference when available\n"
            "- If no tool call is needed, return tool_name=null\n\n"
            "Enabled tools:\n"
            + ("\n".join(tools_desc) if tools_desc else "(empty)")
            + "\n\n"
            "Recent conversation:\n"
            + ("\n".join(history_lines) if history_lines else "(empty)")
            + "\n\n"
            "Runtime context:\n" + (context or "(empty)") + "\n"
        )

        try:
            resp = await asyncio.wait_for(
                self.llm_client.generate(
                    prompt=prompt,
                    system_prompt="Return valid JSON only, following the schema.",
                    temperature=0.0,
                    max_tokens=220,
                    images=None,
                ),
                timeout=15.0,
            )

            raw = (resp.content or "").strip()

            if not raw:
                return None

            m = re.search(r"\{[\s\S]*\}", raw)

            if not m:
                return None

            obj = json.loads(m.group(0))

            if not isinstance(obj, dict):
                return None

            tool_name = obj.get("tool_name")

            if tool_name is not None:
                tool_name = str(tool_name).strip()

            tool_params = obj.get("tool_params") or {}

            if not isinstance(tool_params, dict):
                tool_params = {}

            if tool_name and tool_name.lower() not in self._enabled_tools_lower:
                return None

            return {"tool_name": tool_name, "tool_params": tool_params}

        except Exception as e:
            logger.warning(f"Router recovery failed: {e}")

            return None

    async def invoke(
        self,
        message: str,
        session_id: Optional[str] = None,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        user_role: Optional[str] = None,
    ) -> str:
        """


        Invoke agent with user message.





        Args:


            message: User message


            session_id: Optional session ID for conversation tracking


            chat_history: Optional previous chat messages for context


            user_role: Optional user role for role-based guidance





        Returns:


            Agent response string


        """

        state = create_initial_react_state(
            user_message=message,
            context={"session_id": session_id or str(uuid.uuid4())},
            chat_history=chat_history,
            user_role=user_role,
        )

        config = {"configurable": {"thread_id": session_id or "default"}}

        try:
            final_state = await self.graph.ainvoke(state, config)

            final_answer = final_state.get("final_answer", "")

            if not final_answer:
                synthesized = await self._finalize_if_missing(final_state)

                if synthesized:
                    final_answer = synthesized

            if not final_answer:
                final_answer = (
                    "Xin lỗi, tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại."
                )

            return final_answer

        except Exception as e:
            logger.error(f"Error invoking agent: {e}")

            return f"Lỗi khi xử lý yêu cầu: {str(e)}"

    async def stream(
        self,
        message: str,
        session_id: Optional[str] = None,
        images: Optional[List[str]] = None,
        location: Optional[Dict[str, Any]] = None,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        user_role: Optional[str] = None,
    ):
        """


        Stream agent response.





        Args:


            message: User message


            session_id: Optional session ID


            images: Optional list of base64 images for multimodal input


            chat_history: Optional previous chat messages for context


            user_role: Optional user role for role-based guidance





        Yields:


            ReAct steps and final answer tokens


        """

        state = create_initial_react_state(
            user_message=message,
            context={
                "session_id": session_id or str(uuid.uuid4()),
                "images": images or [],  # Pass images through context
                "location": location or None,
            },
            chat_history=chat_history,
            user_role=user_role,
        )

        config = {
            "configurable": {"thread_id": session_id or "default"},
            "recursion_limit": 100,  # Allow 10+ iterations (10 * 3 nodes = 30)
        }

        final_answer_emitted = False

        last_state_output: Optional[Dict[str, Any]] = None

        try:
            async for event in self.graph.astream_events(state, config, version="v2"):
                event_type = event.get("event", "")

                # 1. Handle ReAct steps

                if event_type == "on_chain_stream":
                    data = event.get("data", {})

                    chunk = data.get("chunk", {})

                    if not isinstance(chunk, dict):
                        continue

                    for node_name, state_update in chunk.items():
                        if not isinstance(state_update, dict):
                            continue

                        # Yield ONLY the newest ReAct step (prevents quadratic duplication)

                        steps = state_update.get("react_steps", [])

                        if isinstance(steps, list) and steps:
                            yield {
                                "type": "react_step",
                                "step": steps[-1],
                            }

                        final_ans = state_update.get("final_answer")

                        if final_ans and not final_answer_emitted:
                            final_answer_emitted = True

                            yield {
                                "type": "final_answer",
                                "content": final_ans,
                            }

                # 2. Handle Final result

                elif event_type == "on_chain_end":
                    data = event.get("data", {})
                    output = data.get("output", {})
                    if isinstance(output, dict):
                        last_state_output = output
                        # Sync booking state from tool runtime context
                        ctx = get_tool_runtime_context()
                        if ctx and ctx.booking_state:
                            last_state_output["booking_state"] = ctx.booking_state
            if not final_answer_emitted and isinstance(last_state_output, dict):
                final_text = (last_state_output.get("final_answer") or "").strip()

                if not final_text:
                    synthesized = await self._finalize_if_missing(last_state_output)

                    final_text = (synthesized or "").strip()

                if final_text:
                    final_answer_emitted = True

                    yield {"type": "final_answer", "content": final_text}

        except Exception as e:
            import traceback

            error_trace = traceback.format_exc()

            logger.error(f"Error streaming agent: {e}\n{error_trace}")

            yield {
                "type": "error",
                "content": str(e),
            }
