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
Purpose: Lean orchestrator — delegates domain logic to extracted modules
Version: v2.0.0 (Refactored from 1710-line god class)
"""

from typing import Optional, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from loguru import logger
import json
import uuid

from app.core.agents.state import ReActState, ReActStep, create_initial_react_state

# Extracted modules
from app.core.agents.text_utils import extract_latest_user_message
from app.core.agents.thought_parser import parse_thought
from app.core.agents.response_formatter import format_tool_observation
from app.core.agents.tool_routing import (
    apply_booking_tool_routing,
)
from app.core.agents.enrichment_strategy import (
    build_web_search_fallback_call,
    build_final_answer_from_tool_result,
)
from app.core.agents.prompt_builder import build_context, create_think_prompt


# ===== DEFAULT SYSTEM PROMPT =====
#
# NGUYÊN TẮC PHÂN TÁCH PROMPT (Best Practice):
#
# DEFAULT_SYSTEM_PROMPT (Admin-editable via Dashboard/DB):
#   → Nhân cách, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ
#   → Admin CÓ THỂ chỉnh sửa mà KHÔNG ảnh hưởng kỹ thuật
#
# create_think_prompt() (Code-managed, hardcoded in prompt_builder.py):
#   → ReAct format, công cụ có sẵn (auto từ tool_schemas)
#   → Nguyên tắc trả lời, nhận diện lỗi chính tả
#   → KHÔNG NÊN thay đổi qua Dashboard
#
# Admin chỉ cần chỉnh: vai trò, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ.
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
- Ưu tiên an toàn & sức khỏe của thú cưng
- Khi triệu chứng nguy hiểm (co giật, nôn ra máu, khó thở), nhấn mạnh cần đi khám NGAY
- Chỉ tư vấn trong phạm vi chăm sóc thú cưng, từ chối lịch sự nếu hỏi ngoài phạm vi
"""
# NOTE cho Admin: Prompt này chỉ nên chứa nhân cách, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ.
# KHÔNG thêm: ReAct pattern, danh sách tools, quy tắc format kỹ thuật (code đã quản lý).


class SingleAgent:
    """
    Single Agent with ReAct Pattern — Lean Orchestrator.

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
        max_iterations: int = 5,
    ):
        """
        Initialize Single Agent.

        Args:
            llm_client: LLM client instance (OpenRouterClient or DeepSeekClient)
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
            f"SingleAgent initialized with {len(self.enabled_tools)} enabled tools"
        )

    def _build_graph(self) -> StateGraph:
        """
        Build LangGraph StateGraph with ReAct pattern.

        Graph structure:
            START -> think -> should_continue?
                            -> act (if tool needed) -> observe -> think
                            -> END (if final answer)

        Returns:
            Compiled StateGraph with MemorySaver checkpointer
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

        # Compile with memory checkpointer
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)

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
        logger.info(
            f"THINK Node: iteration={iteration}, max_iterations={self.max_iterations}"
        )

        # Check max iterations
        if iteration >= self.max_iterations:
            logger.warning(
                f"Safety Break: Max iterations ({self.max_iterations}) reached."
            )
            return {
                "final_answer": "Rất tiếc, tôi đã đạt giới hạn suy luận tối đa mà chưa tìm được câu trả lời hoàn chỉnh. Vui lòng thử lại với câu hỏi cụ thể hơn.",
                "should_end": True,
            }

        logger.debug(f"DEBUG: react_steps type: {type(react_steps)}")
        if not isinstance(react_steps, list):
            logger.error(f"react_steps is not a list: {react_steps}")
            react_steps = []

        # Build context from previous steps (delegated to prompt_builder)
        context = build_context(react_steps)

        last_tool_result = state.get("last_tool_result")

        # Find the last action step
        last_action = next(
            (s for s in reversed(react_steps) if s.get("step_type") == "action"),
            None,
        )

        # --- Pre-LLM enrichment checks (delegated to enrichment_strategy) ---

        # 1. Auto-chain web_search when KB returns insufficient results
        web_fallback_call = build_web_search_fallback_call(
            last_action=last_action,
            tool_result=last_tool_result,
            react_steps=react_steps,
            messages=messages,
            enabled_tools_lower=self._enabled_tools_lower,
        )
        if web_fallback_call:
            fallback_thought = "Knowledge base chưa đủ thông tin, tôi sẽ tìm thêm trên web từ các nguồn liên quan thú cưng/thú y."
            logger.info("Auto fallback to web_search after insufficient KB result")
            step = ReActStep(
                step_type="thought",
                content=fallback_thought,
                tool_name="web_search",
                tool_params=web_fallback_call["arguments"],
                tool_result=None,
            )
            return {
                "react_steps": [step],
                "current_thought": fallback_thought,
                "pending_tool_call": web_fallback_call,
                "should_end": False,
                "final_answer": None,
                "iteration": iteration + 1,
            }

        # 3. Auto-finalize from tool result (error or no-LLM mode)
        auto_final_answer = build_final_answer_from_tool_result(
            tool_name=last_action.get("tool_name") if last_action else None,
            tool_result=last_tool_result,
            react_steps=react_steps,
            messages=messages,
            llm_client=self.llm_client,
            enabled_tools_lower=self._enabled_tools_lower,
        )
        if auto_final_answer:
            logger.info(
                f"Auto-finalized response from tool result: "
                f"{last_action.get('tool_name') if last_action else 'unknown'}"
            )
            step = ReActStep(
                step_type="thought",
                content=auto_final_answer,
                tool_name=None,
                tool_params={},
                tool_result=None,
            )
            return {
                "react_steps": [step],
                "current_thought": auto_final_answer,
                "pending_tool_call": None,
                "should_end": True,
                "final_answer": auto_final_answer,
                "iteration": iteration + 1,
            }

        # --- Post-observation warning suffix ---
        warning_suffix = ""
        if last_action and iteration > 0:
            warning_suffix = (
                f"\n\nLƯU Ý QUAN TRỌNG: Bạn đã gọi '{last_action.get('tool_name')}' và nhận Observation ở trên."
                f"\nBây giờ hãy TỔNG HỢP câu trả lời Final Answer theo các bước:"
                f"\n1. Đọc lại CÂU HỎI của người dùng — họ hỏi CỤ THỂ điều gì? (ví dụ: 'nên ăn gì' = liệt kê thức ăn cụ thể)"
                f"\n2. Lấy thông tin liên quan từ Observation + kiến thức thú y của bạn"
                f"\n3. Trả lời ĐÚNG TRỌNG TÂM câu hỏi (hỏi 'ăn gì' → liệt kê cụ thể thức ăn, hỏi 'làm gì' → liệt kê việc cần làm)"
                f"\n4. Bổ sung lời khuyên thêm nếu cần"
                f"\nKHÔNG chỉ nói chung chung, PHẢI trả lời CỤ THỂ theo câu hỏi."
            )

        # --- Call LLM ---
        # Prompt assembly delegated to prompt_builder
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
            response = await self.llm_client.generate(
                prompt=think_prompt,
                system_prompt=self.system_prompt,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )

            thought_content = response.content

            # Parse response (delegated to thought_parser)
            parsed = parse_thought(thought_content, self.enabled_tools)

            # Post-parse routing overrides (delegated to tool_routing)
            parsed = apply_booking_tool_routing(
                parsed,
                messages,
                react_steps,
                self._enabled_tools_lower,
                build_context,
            )

            # Active loop prevention: intercept if LLM repeats same tool/params
            if (
                last_action
                and parsed.get("tool_name") == last_action.get("tool_name")
                and parsed.get("tool_params") == last_action.get("tool_params")
            ):
                logger.warning(
                    f"Loop prevention: Intercepted repetitive tool call to {parsed.get('tool_name')}"
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
                parsed["thought"] = (
                    f"Tôi đã tìm thấy thông tin cần thiết từ lần tra cứu trước: {obs_text[:200]}..."
                )
                if "KẾT QUẢ TRA CỨU:" in obs_text:
                    parsed["thought"] = obs_text.split("\n\n")[0].replace(
                        "KẾT QUẢ TRA CỨU: ", ""
                    )

            if not isinstance(parsed, dict):
                logger.error(f"Parsed thought is not a dict: {type(parsed)} - {parsed}")
                parsed = {"thought": thought_content, "should_end": True}

            # Create pending tool call if tool name is found AND params are valid
            pending_tool_call = None
            should_end = parsed.get("should_end", False)
            tool_name = parsed.get("tool_name")
            tool_params = parsed.get("tool_params", {})

            if tool_name:
                if not tool_params or len(tool_params) == 0:
                    logger.warning(
                        f"Tool '{tool_name}' called with empty params - skipping to avoid error"
                    )
                    should_end = True
                    parsed["thought"] = (
                        f"Không thể gọi tool {tool_name} do thiếu tham số. Vui lòng đặt câu hỏi cụ thể hơn."
                    )
                else:
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
                "error": f"Tool '{tool_name}' không được enabled. Vui lòng liên hệ admin.",
                "available_tools": self.enabled_tools,
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
            logger.info(f"ACTION: Called {tool_name} with {tool_params}")

            return {
                "react_steps": [step],
                "last_tool_result": result,
                "pending_tool_call": None,
            }

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            error_result = {"error": str(e)}
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

        # Format observation (delegated to response_formatter)
        observation = ""
        if isinstance(tool_result, dict):
            if "error" in tool_result:
                observation = f"Tool returned error: {tool_result['error']}"
            elif "data" in tool_result and isinstance(tool_result["data"], dict):
                observation = format_tool_observation(tool_result["data"])
            else:
                observation = json.dumps(tool_result, ensure_ascii=False, indent=2)
        else:
            observation = str(tool_result)

        step = ReActStep(
            step_type="observation",
            content=observation,
            tool_name=None,
            tool_params=None,
            tool_result=tool_result,
        )

        logger.info(f"OBSERVATION: {observation[:100]}...")

        return {
            "react_steps": [step],
            "current_observation": observation,
        }

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

    async def invoke(self, message: str, session_id: Optional[str] = None) -> str:
        """
        Invoke agent with user message.

        Args:
            message: User message
            session_id: Optional session ID for conversation tracking

        Returns:
            Agent response string
        """
        state = create_initial_react_state(
            user_message=message,
            context={"session_id": session_id or str(uuid.uuid4())},
        )

        config = {"configurable": {"thread_id": session_id or "default"}}

        try:
            final_state = await self.graph.ainvoke(state, config)

            final_answer = final_state.get("final_answer", "")

            if not final_answer:
                react_steps = final_state.get("react_steps", [])
                if react_steps:
                    last_thought = next(
                        (
                            s
                            for s in reversed(react_steps)
                            if s["step_type"] == "thought"
                        ),
                        None,
                    )
                    if last_thought:
                        final_answer = last_thought["content"]

            if not final_answer:
                final_answer = (
                    "Xin lỗi, tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại."
                )

            return final_answer

        except Exception as e:
            logger.error(f"Error invoking agent: {e}")
            return f"Lỗi khi xử lý yêu cầu: {str(e)}"

    async def stream(self, message: str, session_id: Optional[str] = None):
        """
        Stream agent response.

        Args:
            message: User message
            session_id: Optional session ID

        Yields:
            ReAct steps and final answer tokens
        """
        state = create_initial_react_state(
            user_message=message,
            context={"session_id": session_id or str(uuid.uuid4())},
        )

        config = {
            "configurable": {"thread_id": session_id or "default"},
            "recursion_limit": 100,  # Allow 10+ iterations (10 * 3 nodes = 30)
        }

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
                        if final_ans:
                            yield {
                                "type": "final_answer",
                                "content": final_ans,
                            }

                # 2. Handle Token streaming (from LLM)
                elif event_type == "on_chat_model_stream":
                    data = event.get("data", {})
                    chunk = data.get("chunk", {})
                    if hasattr(chunk, "content") and chunk.content:
                        yield {
                            "type": "token",
                            "content": chunk.content,
                        }

                # 3. Handle Final result
                elif event_type == "on_chain_end":
                    data = event.get("data", {})
                    output = data.get("output", {})
                    if isinstance(output, dict) and output.get("final_answer"):
                        yield {
                            "type": "final_answer",
                            "content": output["final_answer"],
                        }

        except Exception as e:
            import traceback

            error_trace = traceback.format_exc()
            logger.error(f"Error streaming agent: {e}\n{error_trace}")
            yield {
                "type": "error",
                "content": str(e),
            }
