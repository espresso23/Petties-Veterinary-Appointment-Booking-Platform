"""
PETTIES AGENT SERVICE - Single Agent with ReAct Pattern

Single Agent architecture su dung LangGraph StateGraph voi ReAct loop:
Thought -> Action (Tool Call) -> Observation -> Loop until done

Flow:
1. User Message -> Think (LLM reasoning)
2. Think -> Act (Execute @mcp.tool)
3. Act -> Observe (Process tool result)
4. Observe -> Think (Loop) OR End (Final answer)

Package: app.core.agents
Purpose: Single Agent with ReAct pattern for Petties AI Assistant
Version: v1.0.0
"""

from typing import Optional, List, Dict, Any, Literal
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from loguru import logger
import json
import uuid
import re

from app.core.agents.state import ReActState, ReActStep, create_initial_react_state


# ===== DEFAULT SYSTEM PROMPT =====
# 
# NGUYÊN TẮC PHÂN TÁCH PROMPT (Best Practice):
#
# DEFAULT_SYSTEM_PROMPT (Admin-editable via Dashboard/DB):
#   → Nhân cách, giọng điệu, nhiệm vụ, quy tắc nghiệp vụ
#   → Admin CÓ THỂ chỉnh sửa mà KHÔNG ảnh hưởng kỹ thuật
#
# _create_think_prompt() (Code-managed, hardcoded):
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
    Single Agent voi ReAct Pattern

    Su dung LangGraph StateGraph de implement ReAct loop:
    - Think: LLM reasoning ve user message
    - Act: Execute tool call
    - Observe: Process tool result
    - Loop cho den khi co final answer

    Attributes:
        llm_client: LLM client (OpenRouter/DeepSeek)
        system_prompt: System prompt tu DB hoac default
        temperature: Temperature cho LLM
        max_tokens: Max tokens cho response
        enabled_tools: Danh sach tools duoc phep su dung
        graph: Compiled LangGraph StateGraph
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
        max_iterations: int = 5  # Reduced from 10 to prevent excessive looping
    ):
        """
        Khoi tao Single Agent

        Args:
            llm_client: LLM client instance (OpenRouterClient hoac DeepSeekClient)
            name: Name of the agent
            agent_type: Type of the agent
            system_prompt: System prompt (load tu DB hoac dung default)
            temperature: Temperature parameter (0.0-1.0)
            max_tokens: Max tokens cho response
            top_p: Top-P parameter (0.0-1.0)
            enabled_tools: List of enabled tool names
            max_iterations: Max ReAct iterations truoc khi force stop
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

        # Build LangGraph
        self.graph = self._build_graph()

        logger.info(f"SingleAgent initialized with {len(self.enabled_tools)} enabled tools")

    def _build_graph(self) -> StateGraph:
        """
        Build LangGraph StateGraph voi ReAct pattern

        Graph structure:
            START -> think -> should_continue?
                            -> act (if tool needed) -> observe -> think
                            -> END (if final answer)

        Returns:
            Compiled StateGraph voi MemorySaver checkpointer
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
                "act": "act",       # Co tool call -> execute
                "end": END          # Khong co tool call -> final answer
            }
        )

        # Act -> Observe -> Think (loop)
        workflow.add_edge("act", "observe")
        workflow.add_edge("observe", "think")

        # Compile with memory checkpointer
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)

    async def _think_node(self, state: ReActState) -> Dict[str, Any]:
        """
        Think Node - LLM reasoning

        Analyze user message va quyet dinh:
        1. Can goi tool khong?
        2. Tool nao phu hop?
        3. Hoac tra loi truc tiep?

        Args:
            state: Current ReActState

        Returns:
            Updated state voi thought va possible tool_call
        """
        logger.debug("Entering THINK node")

        iteration = state.get("iteration", 0)
        react_steps = state.get("react_steps", [])
        messages = state.get("messages", [])
        logger.info(f"THINK Node: iteration={iteration}, max_iterations={self.max_iterations}")

        # Check max iterations
        if iteration >= self.max_iterations:
            logger.warning(f"Safety Break: Max iterations ({self.max_iterations}) reached.")
            return {
                "final_answer": "Rất tiếc, tôi đã đạt giới hạn suy luận tối đa mà chưa tìm được câu trả lời hoàn chỉnh. Vui lòng thử lại với câu hỏi cụ thể hơn.",
                "should_end": True
            }

        logger.debug(f"DEBUG: react_steps type: {type(react_steps)}")
        if not isinstance(react_steps, list):
            logger.error(f"react_steps is not a list: {react_steps}")
            react_steps = []

        # Build context from previous steps
        context = self._build_context(react_steps)

        last_tool_result = state.get("last_tool_result")

        # 3. Detect repetitive tool calls and inject warning
        last_action = next((s for s in reversed(react_steps) if s.get("step_type") == "action"), None)

        symptom_enrichment_call = self._build_symptom_enrichment_call(
            last_action=last_action,
            react_steps=react_steps,
            messages=messages,
        )
        if symptom_enrichment_call:
            enrichment_thought = "Tôi sẽ kiểm tra thêm phần triệu chứng trong knowledge base để đánh giá mức độ cần lưu ý trước khi gợi ý chăm sóc."
            logger.info("Auto enrich with symptom_search for symptom-care question")
            step = ReActStep(
                step_type="thought",
                content=enrichment_thought,
                tool_name="symptom_search",
                tool_params=symptom_enrichment_call["arguments"],
                tool_result=None,
            )
            return {
                "react_steps": [step],
                "current_thought": enrichment_thought,
                "pending_tool_call": symptom_enrichment_call,
                "should_end": False,
                "final_answer": None,
                "iteration": iteration + 1,
            }

        web_fallback_call = self._build_web_search_fallback_call(
            last_action=last_action,
            tool_result=last_tool_result,
            react_steps=react_steps,
            messages=messages,
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

        auto_final_answer = self._build_final_answer_from_tool_result(
            tool_name=last_action.get("tool_name") if last_action else None,
            tool_result=last_tool_result,
            react_steps=react_steps,
            messages=messages,
        )
        if auto_final_answer:
            logger.info(
                f"Auto-finalized response from tool result: {last_action.get('tool_name') if last_action else 'unknown'}"
            )
            step = ReActStep(
                step_type="thought",
                content=auto_final_answer,
                tool_name=None,
                tool_params={},
                tool_result=None
            )
            return {
                "react_steps": [step],
                "current_thought": auto_final_answer,
                "pending_tool_call": None,
                "should_end": True,
                "final_answer": auto_final_answer,
                "iteration": iteration + 1
            }
        
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

        # Create prompt for LLM
        think_prompt = self._create_think_prompt(messages, context) + warning_suffix

        try:
            # Call LLM
            response = await self.llm_client.generate(
                prompt=think_prompt,
                system_prompt=self.system_prompt,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            thought_content = response.content

            # 4. Parse response to determine action
            parsed = self._parse_thought(thought_content)
            parsed = self._apply_medical_tool_routing(parsed, messages)
            
            # 4.1. ACTIVE LOOP PREVENTION: Intercept if LLM repeats same tool/params
            if last_action and parsed.get("tool_name") == last_action.get("tool_name") and parsed.get("tool_params") == last_action.get("tool_params"):
                logger.warning(f"Loop prevention: Intercepted repetitive tool call to {parsed.get('tool_name')}")
                # Force end and use the last observation to build an answer if possible
                last_obs = next((s for s in reversed(react_steps) if s.get("step_type") == "observation"), None)
                obs_text = last_obs.get("content", "") if last_obs else ""
                
                parsed["should_end"] = True
                parsed["tool_name"] = None
                parsed["thought"] = f"Tôi đã tìm thấy thông tin cần thiết từ lần tra cứu trước: {obs_text[:200]}..."
                if "KẾT QUẢ TRA CỨU:" in obs_text:
                    parsed["thought"] = obs_text.split("\n\n")[0].replace("KẾT QUẢ TRA CỨU: ", "")
            
            if not isinstance(parsed, dict):
                logger.error(f"Parsed thought is not a dict: {type(parsed)} - {parsed}")
                parsed = {"thought": thought_content, "should_end": True}

            # 6. Create pending tool call if tool name is found AND params are valid
            pending_tool_call = None
            should_end = parsed.get("should_end", False)

            tool_name = parsed.get("tool_name")
            tool_params = parsed.get("tool_params", {})

            if tool_name:
                # Check if tool_params is empty - if so, don't make the call
                # because it will fail with "Missing required parameter"
                if not tool_params or len(tool_params) == 0:
                    logger.warning(f"Tool '{tool_name}' called with empty params - skipping to avoid error")
                    # Force end and provide helpful message
                    should_end = True
                    parsed["thought"] = f"Không thể gọi tool {tool_name} do thiếu tham số. Vui lòng đặt câu hỏi cụ thể hơn."
                else:
                    pending_tool_call = {
                        "name": tool_name,
                        "arguments": tool_params
                    }
                    # If there is a valid tool call, we MUST NOT end yet
                    should_end = False

            # 5. Determine final answer
            final_answer = None
            if should_end:
                final_answer = parsed.get("thought", thought_content)

            # 7. Log ReAct step AFTER final decision so trace matches actual response
            step = ReActStep(
                step_type="thought",
                content=parsed.get("thought", thought_content),
                tool_name=tool_name if pending_tool_call else None,
                tool_params=tool_params if pending_tool_call else {},
                tool_result=None
            )

            new_react_steps = [step]
            logger.info(f"THOUGHT: {parsed.get('thought', thought_content)[:100]}...")

            return {
                "react_steps": new_react_steps,
                "current_thought": parsed.get("thought", thought_content),
                "pending_tool_call": pending_tool_call,
                "should_end": should_end,
                "final_answer": final_answer,
                "iteration": iteration + 1
            }

        except Exception as e:
            logger.error(f"Error in THINK node: {e}")
            return {
                "error": str(e),
                "should_end": True,
                "final_answer": f"Loi ket noi LLM: {str(e)}. Vui long kiem tra lai cấu hình/số dư tài khoản."
            }

    def _build_final_answer_from_tool_result(
        self,
        tool_name: Optional[str],
        tool_result: Any,
        react_steps: Optional[List[Dict[str, Any]]] = None,
        messages: Optional[List[Any]] = None,
    ) -> Optional[str]:
        """Tạo câu trả lời cuối trực tiếp từ tool result.

        Chỉ auto-finalize khi:
        - Tool trả về error
        - Không có LLM client (test mode)

        Các trường hợp khác: return None để LLM tổng hợp answer
        từ tool context + kiến thức sẵn có.
        """
        if not tool_name or not isinstance(tool_result, dict):
            return None

        # Case 1: Tool error => auto-finalize error message
        if tool_result.get("success") is False:
            error_message = tool_result.get("error")
            if error_message:
                return f"Tôi chưa thể hoàn tất tra cứu do lỗi công cụ: {error_message}"
            return None

        # Case 2: Không có LLM client (test mode / fallback) => auto-finalize
        if self.llm_client is None:
            return self._build_fallback_answer_from_tool_result(
                tool_name, tool_result, react_steps, messages
            )

        # Case 3: Có LLM client => KHOONG auto-finalize, để LLM tổng hợp
        # Tool results đã được format trong observe node, LLM sẽ dùng làm context
        return None

    def _build_fallback_answer_from_tool_result(
        self,
        tool_name: str,
        tool_result: Dict[str, Any],
        react_steps: Optional[List[Dict[str, Any]]] = None,
        messages: Optional[List[Any]] = None,
    ) -> Optional[str]:
        """Fallback khi không có LLM: ghép answer từ tool results (test mode)."""
        data = tool_result.get("data")
        if not isinstance(data, dict):
            return None

        normalized_tool = tool_name.strip().lower()
        react_steps = react_steps or []
        user_message = self._extract_latest_user_message(messages or [])

        if normalized_tool == "pet_care_qa":
            if self._should_use_web_fallback(normalized_tool, data):
                return None
            answer = data.get("answer")
            if isinstance(answer, str) and answer.strip():
                return answer.strip()
            return None

        if normalized_tool == "symptom_search":
            if self._is_symptom_care_question(user_message) and "web_search" in {tool.lower() for tool in self.enabled_tools}:
                return None
            if self._should_use_web_fallback(normalized_tool, data):
                return None
            recommendations = data.get("recommendations")
            disclaimer = data.get("disclaimer")
            possible_conditions = data.get("possible_conditions", [])

            parts: List[str] = []
            if possible_conditions and isinstance(possible_conditions, list):
                top_conditions = []
                for condition in possible_conditions[:3]:
                    if not isinstance(condition, dict):
                        continue
                    name = condition.get("name") or "Chưa rõ chẩn đoán"
                    severity = condition.get("severity")
                    if severity:
                        top_conditions.append(f"- {name} (mức độ: {severity})")
                    else:
                        top_conditions.append(f"- {name}")
                if top_conditions:
                    parts.append("Các khả năng cần lưu ý:\n" + "\n".join(top_conditions))

            if isinstance(recommendations, str) and recommendations.strip():
                parts.append(recommendations.strip())
            if isinstance(disclaimer, str) and disclaimer.strip():
                parts.append(disclaimer.strip())
            return "\n\n".join(parts) if parts else None

        if normalized_tool == "web_search":
            answer = data.get("answer")
            if isinstance(answer, str) and answer.strip():
                symptom_data = self._get_latest_successful_tool_data(react_steps, "symptom_search")
                kb_data = self._get_latest_successful_tool_data(react_steps, "pet_care_qa")
                sources_used = int(data.get("sources_used", 0) or 0)

                parts: List[str] = []
                if kb_data:
                    kb_answer = str(kb_data.get("answer", "")).strip()
                    if kb_answer and "không tìm thấy thông tin phù hợp" not in kb_answer.lower():
                        parts.append(f"Theo knowledge base:\n{kb_answer}")

                if symptom_data:
                    symptom_summary = self._build_symptom_summary(symptom_data)
                    if symptom_summary:
                        parts.append(symptom_summary)

                is_empty_web_answer = sources_used == 0 and "chưa tìm thấy nguồn web phù hợp" in answer.lower()
                if (not is_empty_web_answer) or not parts:
                    parts.append(answer.strip())
                return "\n\n".join(part for part in parts if part)
            return None

        return None

    def _should_use_web_fallback(self, tool_name: str, data: Dict[str, Any]) -> bool:
        """Quyết định khi nào cần fallback từ KB sang web search."""
        if "web_search" not in {tool.lower() for tool in self.enabled_tools}:
            return False

        if tool_name == "pet_care_qa":
            sources_used = data.get("sources_used", 0)
            answer = str(data.get("answer", "")).lower()
            return sources_used == 0 or "không tìm thấy thông tin phù hợp" in answer

        if tool_name == "symptom_search":
            possible_conditions = data.get("possible_conditions") or []
            return isinstance(possible_conditions, list) and len(possible_conditions) == 0

        return False

    def _build_symptom_enrichment_call(
        self,
        last_action: Optional[Dict[str, Any]],
        react_steps: List[Dict[str, Any]],
        messages: List[Any],
    ) -> Optional[Dict[str, Any]]:
        if "symptom_search" not in {tool.lower() for tool in self.enabled_tools}:
            return None

        if not last_action:
            return None

        normalized_tool = str(last_action.get("tool_name") or "").strip().lower()
        if normalized_tool != "pet_care_qa":
            return None

        if any(
            step.get("step_type") == "action" and str(step.get("tool_name") or "").strip().lower() == "symptom_search"
            for step in react_steps
        ):
            return None

        user_message = self._extract_latest_user_message(messages)
        if not self._is_symptom_care_question(user_message):
            return None

        symptoms = self._extract_symptoms_from_text(user_message)
        if not symptoms:
            symptoms = [user_message]

        return {
            "name": "symptom_search",
            "arguments": {
                "symptoms": symptoms,
                "pet_type": self._infer_pet_type(user_message),
                "top_k": 5,
            },
        }

    def _build_web_search_fallback_call(
        self,
        last_action: Optional[Dict[str, Any]],
        tool_result: Any,
        react_steps: List[Dict[str, Any]],
        messages: List[Any],
    ) -> Optional[Dict[str, Any]]:
        """Tự động gọi `web_search` khi KB không đủ dữ liệu và chưa search web trong vòng hiện tại."""
        if not last_action or not isinstance(tool_result, dict):
            return None

        normalized_tool = str(last_action.get("tool_name") or "").strip().lower()
        if normalized_tool not in {"pet_care_qa", "symptom_search"}:
            return None

        if any(
            (step.get("step_type") == "action" and str(step.get("tool_name") or "").strip().lower() == "web_search")
            for step in react_steps
        ):
            return None

        user_message = self._extract_latest_user_message(messages)

        if normalized_tool == "pet_care_qa":
            if not self._should_use_web_fallback(normalized_tool, tool_result.get("data") or {}):
                return None
            if self._is_symptom_care_question(user_message) and any(
                step.get("step_type") == "action" and str(step.get("tool_name") or "").strip().lower() == "symptom_search"
                for step in react_steps
            ):
                return {
                    "name": "web_search",
                    "arguments": {
                        "query": user_message,
                        "max_results": 5,
                    }
                }
            if self._is_symptom_care_question(user_message):
                return None

        if normalized_tool == "symptom_search":
            if not self._is_symptom_care_question(user_message):
                return None

        if not user_message:
            return None

        return {
            "name": "web_search",
            "arguments": {
                "query": user_message,
                "max_results": 5,
            }
        }

    def _extract_latest_user_message(self, messages: List[Any]) -> str:
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                return str(msg.get("content", "")).strip()
        return ""

    def _is_symptom_care_question(self, user_message: str) -> bool:
        if not user_message:
            return False

        normalized_message = user_message.lower()
        care_keywords = [
            # Vietnamese
            "nên ăn gì", "ăn gì", "thức ăn", "chế độ ăn", "dinh dưỡng",
            "nên làm gì", "xử lý thế nào", "chăm sóc", "cách chữa", "điều trị",
            # English
            "what to feed", "what to eat", "diet", "nutrition", "food",
            "what should i do", "how to treat", "how to care", "remedy", "treatment",
        ]
        symptom_keywords = [
            # Vietnamese
            "tiêu chảy", "nôn", "ói", "sốt", "bỏ ăn", "mệt", "run", "ho",
            "khó thở", "máu", "đau bụng", "phân lỏng", "ngứa", "rụng lông",
            # English
            "diarrhea", "vomit", "vomiting", "fever", "not eating", "lethargy",
            "shaking", "cough", "coughing", "difficulty breathing", "blood",
            "stomach pain", "loose stool", "itching", "hair loss", "shedding",
        ]

        return any(keyword in normalized_message for keyword in care_keywords) and any(
            keyword in normalized_message for keyword in symptom_keywords
        )

    def _extract_symptoms_from_text(self, user_message: str) -> List[str]:
        normalized_message = (user_message or "").lower()
        known_symptoms = [
            # Vietnamese
            "tiêu chảy", "phân lỏng", "nôn", "ói", "bỏ ăn", "mệt mỏi",
            "sốt", "ho", "khó thở", "co giật", "có máu trong phân", "đau bụng",
            "ngứa", "rụng lông", "chảy nước mắt", "chảy nước mũi",
            # English
            "diarrhea", "loose stool", "vomiting", "vomit", "not eating",
            "lethargy", "fever", "cough", "difficulty breathing", "seizure",
            "blood in stool", "stomach pain", "itching", "hair loss",
            "watery eyes", "runny nose",
        ]
        detected = [symptom for symptom in known_symptoms if symptom in normalized_message]
        return detected

    def _infer_pet_type(self, user_message: str) -> str:
        normalized_message = (user_message or "").lower()
        if any(keyword in normalized_message for keyword in ["mèo", "meo", "cat", "kitten"]):
            return "cat"
        return "dog"

    def _get_latest_successful_tool_data(
        self,
        react_steps: List[Dict[str, Any]],
        tool_name: str,
    ) -> Optional[Dict[str, Any]]:
        for step in reversed(react_steps):
            if step.get("step_type") != "action":
                continue
            if str(step.get("tool_name") or "").strip().lower() != tool_name:
                continue
            tool_result = step.get("tool_result")
            if not isinstance(tool_result, dict):
                continue
            if tool_result.get("success") is False:
                continue
            data = tool_result.get("data")
            if isinstance(data, dict):
                return data
        return None

    def _build_symptom_summary(self, symptom_data: Dict[str, Any]) -> Optional[str]:
        possible_conditions = symptom_data.get("possible_conditions") or []
        recommendations = str(symptom_data.get("recommendations") or "").strip()
        urgent = bool(symptom_data.get("urgent"))

        parts: List[str] = []
        if possible_conditions:
            top_condition = possible_conditions[0]
            if isinstance(top_condition, dict):
                severity = top_condition.get("severity")
                description = str(top_condition.get("description") or "").strip()
                name = str(top_condition.get("name") or "").strip()
                summary = "Theo phần triệu chứng trong knowledge base:"
                if name:
                    summary += f" {name}."
                if severity:
                    summary += f" mức độ cần lưu ý là {severity}."
                if description:
                    summary += f" {description[:220]}"
                parts.append(summary.strip())

        if recommendations:
            prefix = "Cần ưu tiên:" if urgent else "Khuyến nghị thêm:"
            parts.append(f"{prefix} {recommendations}")

        return "\n".join(parts) if parts else None

    def _parse_thought(self, thought_content: str) -> Dict[str, Any]:
        """
        Parse thought content tu LLM de tim Tool call hoac Final Answer.
        Ho tro format Markdown (**Tool:**) va linh hoat hon.
        """
        if not thought_content:
            return {"thought": "", "should_end": True}

        # 1. Tim Tool name (Ho tro ca Markdown **Tool:** hoac Tool:)
        tool_name = None
        # Pattern bao quat hon: Tim sau tu khoa Tool hoac Action, bo qua các ky tu Markdown nhu *
        tool_match = re.search(r"(?:\*+|#|)\s*(?:Tool|Action)\s*(?:\*+|#|):\s*([\w_]+)", thought_content, re.IGNORECASE)
        if tool_match:
            extracted_name = tool_match.group(1).strip()
            # Validate tool name against enabled_tools to prevent hallucinated tool names
            # e.g., "Không" (Vietnamese for "No") being parsed as a tool name
            if extracted_name.upper() in [t.upper() for t in self.enabled_tools]:
                tool_name = extracted_name
            else:
                logger.warning(f"Extracted tool name '{extracted_name}' not in enabled_tools {self.enabled_tools}, ignoring")
        
        # 2. Tim Tool Input (JSON) - Multiple patterns for different LLM output formats
        tool_params = {}

        # Pattern 1: Standard format - Tool Input: {...} or Action Input: {...}
        input_match = re.search(
            r"(?:\*+|#|)\s*(?:Tool Input|Action Input|Input)\s*(?:\*+|#|):\s*(\{.*?\})",
            thought_content,
            re.DOTALL | re.IGNORECASE
        )

        # Pattern 2: JSON on new line after Tool Input:
        if not input_match:
            input_match = re.search(
                r"(?:Tool Input|Action Input|Input)\s*(?:\*+|#|)?:\s*\n\s*(\{.*?\})",
                thought_content,
                re.DOTALL | re.IGNORECASE
            )

        # Pattern 3: Fallback - find any JSON object in the content (only if tool_name found)
        if not input_match and tool_name:
            # Find the last JSON object in the content (more likely to be params)
            json_objects = re.findall(r"(\{[^{}]*\})", thought_content)
            if json_objects:
                # Try the last JSON object first (usually the params)
                for json_str in reversed(json_objects):
                    try:
                        potential_params = json.loads(json_str)
                        if isinstance(potential_params, dict) and len(potential_params) > 0:
                            tool_params = potential_params
                            logger.info(f"Extracted params from fallback JSON: {tool_params}")
                            break
                    except:
                        continue

        # Parse JSON if pattern matched
        if input_match:
            try:
                params_str = input_match.group(1).strip()
                tool_params = json.loads(params_str)
            except Exception as e:
                logger.warning(f"Failed to parse tool params JSON: {e}")
                # Try to extract just the JSON part
                json_match = re.search(r"(\{[^{}]*\})", params_str)
                if json_match:
                    try:
                        tool_params = json.loads(json_match.group(1))
                    except:
                        tool_params = {}

        # Normalize parameter keys: strip whitespace from keys
        # LLM sometimes outputs { "query ": "..." } with trailing space
        if tool_params and isinstance(tool_params, dict):
            tool_params = {k.strip(): v for k, v in tool_params.items()}
            logger.debug(f"Normalized tool params: {tool_params}")

        # 3. Clean thought content
        clean_thought = thought_content
        if tool_name:
            # Cut everything from "Tool:" or "Action:" onwards to get only reasoning
            parts = re.split(r"(?:\*+|#|)\s*(?:Tool|Action)\s*(?:\*+|#|):", thought_content, flags=re.IGNORECASE)
            if parts:
                clean_thought = parts[0].strip()
                # Loai bo tu "Thought:" neu co
                clean_thought = re.sub(r"^(?:\*+|#|)\s*Thought\s*(?:\*+|#|):\s*", "", clean_thought, flags=re.IGNORECASE).strip()

        # 4. Check if should end
        should_end = False
        if "Final Answer:" in thought_content or "final answer:" in thought_content.lower():
            should_end = True
            # Extract final answer content
            fa_parts = re.split(r"Final Answer:", thought_content, flags=re.IGNORECASE)
            if len(fa_parts) > 1:
                clean_thought = fa_parts[1].strip()
        elif not tool_name:
            # Neu ko co tool va ko co Final Answer keyword -> coi nhu Final Answer
            should_end = True

        return {
            "thought": clean_thought or thought_content,
            "tool_name": tool_name,
            "tool_params": tool_params,
            "should_end": should_end
        }

    def _apply_medical_tool_routing(
        self,
        parsed: Dict[str, Any],
        messages: List[Any],
    ) -> Dict[str, Any]:
        """Ổn định việc chọn tool giữa tư vấn chăm sóc và chẩn đoán triệu chứng."""
        tool_name = parsed.get("tool_name")
        if tool_name not in {"pet_care_qa", "symptom_search"}:
            return parsed

        enabled_tools_lower = {tool.lower() for tool in self.enabled_tools}
        if "pet_care_qa" not in enabled_tools_lower or "symptom_search" not in enabled_tools_lower:
            return parsed

        user_message = ""
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                user_message = str(msg.get("content", ""))
                break

        if not user_message:
            return parsed

        normalized_message = user_message.lower()

        care_keywords = [
            "nên ăn gì",
            "ăn gì",
            "thức ăn gì",
            "chế độ ăn",
            "dinh dưỡng",
            "nên uống gì",
            "chăm sóc",
            "kiêng",
            "nên làm gì",
            "xử lý thế nào",
        ]
        diagnosis_keywords = [
            "triệu chứng",
            "bệnh gì",
            "bị bệnh gì",
            "nguyên nhân",
            "có nguy hiểm không",
            "nguy hiểm không",
            "chẩn đoán",
            "có phải",
            "dấu hiệu",
        ]

        is_care_question = any(keyword in normalized_message for keyword in care_keywords)
        is_diagnosis_question = any(keyword in normalized_message for keyword in diagnosis_keywords)

        if is_care_question and not is_diagnosis_question and tool_name != "pet_care_qa":
            logger.info("Medical routing override: symptom_search -> pet_care_qa")
            normalized_params = dict(parsed.get("tool_params") or {})
            if "query" not in normalized_params:
                symptoms = normalized_params.get("symptoms")
                if isinstance(symptoms, list) and symptoms:
                    normalized_params = {
                        "query": user_message,
                        "top_k": normalized_params.get("top_k", 5),
                        "min_score": normalized_params.get("min_score", 0.5),
                    }

            return {
                **parsed,
                "tool_name": "pet_care_qa",
                "tool_params": normalized_params,
            }

        if is_diagnosis_question and not is_care_question and tool_name != "symptom_search":
            logger.info("Medical routing override: pet_care_qa -> symptom_search")
            normalized_params = dict(parsed.get("tool_params") or {})
            if "symptoms" not in normalized_params:
                normalized_params = {
                    "symptoms": [user_message],
                    "pet_type": "dog",
                    "top_k": normalized_params.get("top_k", 5),
                }

            return {
                **parsed,
                "tool_name": "symptom_search",
                "tool_params": normalized_params,
            }

        return parsed

    async def _act_node(self, state: ReActState) -> Dict[str, Any]:
        """
        Act Node - Execute tool call

        Execute tool duoc chon o Think node

        Args:
            state: Current ReActState voi pending_tool_call

        Returns:
            Updated state voi tool execution result
        """
        logger.debug("Entering ACT node")

        tool_call = state.get("pending_tool_call")
        react_steps = state.get("react_steps", [])

        if not tool_call:
            logger.warning("No pending tool call in ACT node")
            return {"pending_tool_call": None}

        # Safety check: ensure tool_call is a dictionary
        if not isinstance(tool_call, dict):
            logger.error(f"pending_tool_call is not a dict: {type(tool_call)} - {tool_call}")
            # Try to recover if it's a JSON string
            if isinstance(tool_call, str):
                try:
                    tool_call = json.loads(tool_call)
                except:
                    return {
                        "error": f"Invalid tool call format: {tool_call}",
                        "pending_tool_call": None
                    }
            else:
                return {"pending_tool_call": None}

        tool_name = tool_call.get("name")
        tool_params = tool_call.get("arguments", {})

        # Check if tool is enabled
        if tool_name not in self.enabled_tools:
            logger.warning(f"Tool '{tool_name}' is not enabled")
            error_result = {
                "error": f"Tool '{tool_name}' khong duoc enabled. Vui long lien he admin.",
                "available_tools": self.enabled_tools
            }

            step = ReActStep(
                step_type="action",
                content=f"Called {tool_name} (DISABLED)",
                tool_name=tool_name,
                tool_params=tool_params,
                tool_result=error_result
            )

            return {
                "react_steps": [step],
                "last_tool_result": error_result,
                "pending_tool_call": None
            }

        try:
            # Execute tool via MCP
            from app.core.tools.executor import execute_tool

            result = await execute_tool(tool_name, tool_params)

            # Log ReAct step
            step = ReActStep(
                step_type="action",
                content=f"Called {tool_name}",
                tool_name=tool_name,
                tool_params=tool_params,
                tool_result=result
            )

            logger.info(f"ACTION: Called {tool_name} with {tool_params}")

            return {
                "react_steps": [step],
                "last_tool_result": result,
                "pending_tool_call": None  # Clear pending
            }

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            error_result = {"error": str(e)}

            step = ReActStep(
                step_type="action",
                content=f"Error calling {tool_name}: {e}",
                tool_name=tool_name,
                tool_params=tool_params,
                tool_result=error_result
            )

            return {
                "react_steps": [step],
                "last_tool_result": error_result,
                "pending_tool_call": None
            }

    async def _observe_node(self, state: ReActState) -> Dict[str, Any]:
        """
        Observe Node - Process tool result

        Format tool result để LLM có thể tổng hợp câu trả lời từ context + kiến thức riêng.

        Args:
            state: Current ReActState với last_tool_result

        Returns:
            Updated state voi observation
        """
        logger.debug("Entering OBSERVE node")

        tool_result = state.get("last_tool_result", {})

        # Format observation - Smart extraction for different tool types
        observation = ""
        if isinstance(tool_result, dict):
            if "error" in tool_result:
                observation = f"Tool returned error: {tool_result['error']}"
            elif "data" in tool_result and isinstance(tool_result["data"], dict):
                observation = self._format_tool_observation(tool_result["data"])
            else:
                observation = json.dumps(tool_result, ensure_ascii=False, indent=2)
        else:
            observation = str(tool_result)

        # Log ReAct step
        step = ReActStep(
            step_type="observation",
            content=observation,
            tool_name=None,
            tool_params=None,
            tool_result=tool_result
        )

        logger.info(f"OBSERVATION: {observation[:100]}...")

        return {
            "react_steps": [step],
            "current_observation": observation
        }

    def _format_tool_observation(self, data: Dict[str, Any]) -> str:
        """Format tool result data thành observation text mà LLM có thể dùng như context.

        Cung cấp thông tin từ tool nhưng nhấn mạnh đây là CONTEXT để LLM tổng hợp,
        không phải answer cuối cùng.
        """
        parts: List[str] = []

        # KB/RAG answer
        answer = data.get("answer")
        sources_used = data.get("sources_used", 0)
        if isinstance(answer, str) and answer.strip():
            parts.append(f"KẾT QUẢ TRA CỨU: {answer.strip()}")
            if sources_used:
                parts.append(f"(Dựa trên {sources_used} nguồn tài liệu)")

        # Symptom data
        conditions = data.get("possible_conditions")
        if isinstance(conditions, list) and conditions:
            cond_lines = []
            for c in conditions[:3]:
                if isinstance(c, dict):
                    name = c.get("name", "")
                    sev = c.get("severity", "")
                    desc = c.get("description", "")
                    cond_lines.append(f"  - {name} (mức độ: {sev}): {desc}" if desc else f"  - {name} ({sev})")
            if cond_lines:
                parts.append("CÁC BỆNH CÓ THỂ:\n" + "\n".join(cond_lines))

        urgent = data.get("urgent")
        if urgent:
            parts.append("CẢNH BÁO: Triệu chứng có thể nghiêm trọng, cần khám ngay.")

        recommendations = data.get("recommendations")
        if isinstance(recommendations, str) and recommendations.strip():
            parts.append(f"KHUYẾN NGHỊ: {recommendations.strip()}")

        # Web search results
        results = data.get("results")
        if isinstance(results, list) and results:
            web_lines = []
            for r in results[:3]:
                if isinstance(r, dict):
                    title = r.get("title", "")
                    snippet = r.get("snippet", "")
                    url = r.get("url", "")
                    web_lines.append(f"  - {title}: {snippet} (Nguồn: {url})")
            if web_lines:
                parts.append("KẾT QUẢ WEB:\n" + "\n".join(web_lines))

        if not parts:
            return json.dumps(data, ensure_ascii=False, indent=2)

        return "\n".join(parts)

    def _should_continue(self, state: ReActState) -> Literal["act", "end"]:
        """Router - Quyet dinh tiep tuc hay ket thuc"""
        iteration = state.get("iteration", 0)
        
        # 1. Check safety break
        if iteration >= self.max_iterations:
            logger.warning(f"Should Continue: Max iterations {self.max_iterations} reached. Stopping.")
            return "end"

        # 2. Check explicit end flag
        if state.get("should_end", False):
            return "end"

        # 3. Check for pending tool call
        if state.get("pending_tool_call"):
            return "act"

        # 4. Check for final answer
        if state.get("final_answer"):
            return "end"

        return "end"

    def _build_context(self, react_steps: List[ReActStep]) -> str:
        """Build context string tu previous ReAct steps"""
        if not react_steps:
            return ""

        context_parts = []
        # Increase history to 10 steps to cover more reasoning cycles
        for step in react_steps[-10:]:
            # Safety check: ensure step is a dictionary
            if not isinstance(step, dict):
                logger.warning(f"ReActStep is not a dict: {type(step)} - {step}")
                continue

            step_type = step.get("step_type")
            content = step.get("content", "")
            
            if step_type == "thought":
                context_parts.append(f"Thought: {content}")
            elif step_type == "action":
                # Include tool params so the LLM knows WHAT it sent
                tool_name = step.get("tool_name", "Unknown")
                tool_params = step.get("tool_params", {})
                context_parts.append(f"Action: {tool_name} with parameters {json.dumps(tool_params, ensure_ascii=False)}")
            elif step_type == "observation":
                # Smart Truncation: keep more from the BEGINNING where we now put the answer
                if len(content) > 3000:
                    obs_content = content[:2500] + "\n... [Dữ liệu quá dài, đã bị lược bớt] ...\n" + content[-300:]
                else:
                    obs_content = content
                context_parts.append(f"Observation: {obs_content}")

        return "\n".join(context_parts)

    def _create_think_prompt(self, messages: List[Any], context: str) -> str:
        """Create prompt for THINK node với hướng dẫn ReAct nghiêm ngặt"""
        # Get last user message
        user_message = ""
        for msg in reversed(messages):
            # Safety check: msg must be a dict or have attributes
            content = ""
            role = "user"

            if isinstance(msg, dict):
                content = msg.get('content', '')
                role = msg.get('role', 'user')
            elif hasattr(msg, 'content'):
                content = getattr(msg, 'content', '')
                role = getattr(msg, 'role', 'user')
            elif isinstance(msg, str):
                content = msg
                role = "user"
            else:
                content = str(msg)
                role = "user"

            if role == 'user':
                user_message = content
                break

        # Build prompt parts
        # DB system_prompt = nhân cách, giọng điệu, nhiệm vụ (Admin-editable)
        # Hardcoded below = ReAct format, answer rules, typo detection (Code-managed)
        prompt_parts = [
            f"""Hệ thống: {self.name} ({self.agent_type})

=== NHÂN CÁCH & QUY TẮC NGHIỆP VỤ (Tùy chỉnh bởi Admin) ===
{self.system_prompt}

=== QUY TẮC REACT FORMAT (Bắt buộc) ===
Để gọi công cụ, bạn PHẢI viết theo định dạng CHÍNH XÁC:
Thought: [Giải thích tại sao bạn cần gọi công cụ này]
Tool: [Tên công cụ chính xác từ danh sách CÔNG CỤ CÓ SẴN]
Tool Input: {{ "param_name": "giá trị" }}

Sau khi nhận được kết quả (Observation), hãy TỔNG HỢP câu trả lời bằng định dạng:
Thought: [Tổng hợp thông tin thu thập được và kiến thức của bạn]
Final Answer: [Câu trả lời đầy đủ và thân thiện cho người dùng bằng tiếng Việt]

=== NGUYÊN TẮC TRẢ LỜI (Quan trọng) ===
- Tập trung vào CÂU HỎI CỦA NGƯỜI DÙNG, trả lời đúng trọng tâm hỏi gì đáp được đó.
  + Ví dụ: "nên ăn gì" → liệt kê CỤ THỂ các loại thức ăn (cháo gà loãng, cơm trắng nấu mềm, thức ăn ướt dễ tiêu, etc.)
  + Ví dụ: "làm gì" → liệt kê CỤ THỂ các bước xử lý
  + Ví dụ: "có sao không" → đánh giá mức độ nghiêm trọng cụ thể
- Dùng kết quả tool như THÔNG TIN THAM KHẢO bổ sung, KHÔNG copy nguyên văn.
- KẾT HỢP kiến thức chuyên môn SẴN CÓ của bạn về thú y/chăm sóc thú cưng với dữ liệu từ tools.
- Nếu tool không đủ thông tin, BẮT BUỘC bổ sung bằng kiến thức của bạn để trả lời đầy đủ.
- Trả lời bằng tiếng Việt (trừ khi người dùng hỏi bằng tiếng Anh), có cấu trúc rõ ràng, dễ đọc.
- Cuối câu trả lời luôn nhắc người dùng nên đưa thú cưng đi khám nếu tình trạng không cải thiện.

=== NHẬN DIỆN LỖI CHÍNH TẢ TIẾNG VIỆT (Quan trọng) ===
Người dùng thường gõ sai dấu tiếng Việt. TRƯỚC KHI trả lời, hãy kiểm tra:
1. Câu hỏi có từ nào VÔ NGHĨA trong ngữ cảnh thú cưng/thú y không?
2. Nếu có, thử thay đổi dấu thanh/dấu mũ xem có tạo thành từ hợp nghĩa không.

Các lỗi chính tả PHỔ BIẾN trong tiếng Việt:
- Nhầm dấu: đ↔d (đâu↔dâu, đau↔dau), ă↔a, ê↔e, ô↔o, ơ↔o, ư↔u
- Nhầm thanh: hỏi↔ngã (ẳ↔ẵ, ẻ↔ẽ), sắc↔nặng (á↔ạ), không dấu
- Thiếu dấu hoàn toàn: "cho bi tieu chay do dau" = "chó bị tiêu chảy do đâu"
Ví dụ: "chó bị tiêu chảy do dâu" → "dâu" (trái dâu) VÔ NGHĨA trong ngữ cảnh bệnh → có thể user muốn hỏi "do đâu" (nguyên nhân gì)

CÁCH XỬ LÝ khi phát hiện lỗi chính tả có thể:
- Nếu CÓ THỂ SUY LUẬN rõ ràng ý người dùng (chỉ có 1 cách hiểu hợp lý): Trả lời theo ý đúng, đầu câu ghi nhẹ "Mình hiểu bạn muốn hỏi '[câu đã sửa]' nhé!" rồi trả lời bình thường.
- Nếu MƠ HỒ (có thể hiểu nhiều cách): HỎI LẠI người dùng để xác nhận. Ví dụ: "Bạn muốn hỏi 'chó bị tiêu chảy do đâu' (nguyên nhân) hay 'chó bị tiêu chảy do ăn dâu' (do ăn trái dâu)? Mình cần xác nhận để trả lời chính xác nhé!"

LƯU Ý:
- Nếu không cần gọi công cụ, hãy đi thẳng đến Final Answer. TUYỆT ĐỐI KHÔNG viết "Tool: Không", "Tool: None" hoặc bất kỳ giá trị không hợp lệ nào.
- Chỉ sử dụng tên công cụ CHÍNH XÁC từ danh sách CÔNG CỤ CÓ SẴN bên dưới.

Bối cảnh hệ thống:
{context}
"""
        ]

        # Add available tools description
        tool_schemas = self.tool_schemas or []
        if tool_schemas:
            tool_descriptions = []
            for tool in tool_schemas:
                # Trích xuất mô tả chi tiết từ schema
                params = tool.get('input_schema') or tool.get('parameters') or {}
                tool_descriptions.append(
                    f"- {tool['name']}: {tool['description']} (Tham số cần có: {json.dumps(params)})"
                )
            prompt_parts.append(f"""CÔNG CỤ CÓ SẴN (Ưu tiên sử dụng):
{chr(10).join(tool_descriptions)}
"""
            )

        prompt_parts.append(f"""CÂU HỎI CỦA NGƯỜI DÙNG:
{user_message}

Bây giờ, hãy bắt đầu quy trình ReAct của bạn:
Thought:""")

        return "\n".join(prompt_parts)


    async def invoke(self, message: str, session_id: Optional[str] = None) -> str:
        """
        Invoke agent voi user message

        Args:
            message: User message
            session_id: Optional session ID for conversation tracking

        Returns:
            Agent response string
        """
        # Create initial state
        state = create_initial_react_state(
            user_message=message,
            context={"session_id": session_id or str(uuid.uuid4())}
        )

        # Run graph
        config = {"configurable": {"thread_id": session_id or "default"}}

        try:
            final_state = await self.graph.ainvoke(state, config)

            # Get final answer
            final_answer = final_state.get("final_answer", "")

            if not final_answer:
                # Try to construct answer from last thought
                react_steps = final_state.get("react_steps", [])
                if react_steps:
                    last_thought = next(
                        (s for s in reversed(react_steps) if s["step_type"] == "thought"),
                        None
                    )
                    if last_thought:
                        final_answer = last_thought["content"]

            if not final_answer:
                final_answer = "Xin lỗi, tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại."

            return final_answer

        except Exception as e:
            logger.error(f"Error invoking agent: {e}")
            return f"Loi khi xu ly yeu cau: {str(e)}"

    async def stream(self, message: str, session_id: Optional[str] = None):
        """
        Stream agent response

        Args:
            message: User message
            session_id: Optional session ID

        Yields:
            ReAct steps va final answer tokens
        """
        state = create_initial_react_state(
            user_message=message,
            context={"session_id": session_id or str(uuid.uuid4())}
        )

        config = {
            "configurable": {"thread_id": session_id or "default"},
            "recursion_limit": 100  # Increase from default 25 to allow 10+ iterations (10 * 3 nodes = 30)
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

                    # LangGraph yields state updates per node
                    for node_name, state_update in chunk.items():
                        if not isinstance(state_update, dict):
                            continue

                        # Yield ONLY the newest ReAct step (the last one in the update)
                        # This prevents quadratic duplication when using astream_events with reducers
                        steps = state_update.get("react_steps", [])
                        if isinstance(steps, list) and steps:
                            yield {
                                "type": "react_step",
                                "step": steps[-1]
                            }

                        # Yield final answer if present
                        final_ans = state_update.get("final_answer")
                        if final_ans:
                            yield {
                                "type": "final_answer",
                                "content": final_ans
                            }

                # 2. Handle Token streaming (from LLM)
                elif event_type == "on_chat_model_stream":
                    data = event.get("data", {})
                    chunk = data.get("chunk", {})
                    if hasattr(chunk, 'content') and chunk.content:
                        yield {
                            "type": "token",
                            "content": chunk.content
                        }

                # 3. Handle Final result
                elif event_type == "on_chain_end":
                    data = event.get("data", {})
                    output = data.get("output", {})
                    if isinstance(output, dict) and output.get("final_answer"):
                        yield {
                            "type": "final_answer",
                            "content": output["final_answer"]
                        }

        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"Error streaming agent: {e}\n{error_trace}")
            yield {
                "type": "error",
                "content": str(e)
            }

    def get_react_trace(self, state: ReActState) -> List[Dict[str, Any]]:
        """
        Get ReAct trace for debugging

        Args:
            state: Final ReActState

        Returns:
            List of trace steps for visualization
        """
        react_steps = state.get("react_steps", [])

        trace = []
        for i, step in enumerate(react_steps):
            trace.append({
                "step_index": i,
                "step_type": step["step_type"],
                "content": step["content"],
                "tool_name": step.get("tool_name"),
                "tool_params": step.get("tool_params"),
                "tool_result": step.get("tool_result")
            })

        return trace


# ===== BUILDER FUNCTION =====

def build_react_agent(
    llm_client,
    name: str = "petties_agent",
    agent_type: str = "single_agent",
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    top_p: float = 0.9,
    enabled_tools: Optional[List[str]] = None,
    tool_schemas: Optional[List[Dict[str, Any]]] = None
) -> SingleAgent:
    """
    Builder function de tao SingleAgent instance

    Args:
        llm_client: LLM client (OpenRouterClient)
        name: Name of the agent
        agent_type: Type of the agent
        system_prompt: System prompt tu DB
        temperature: Temperature parameter
        max_tokens: Max tokens
        top_p: Top-P parameter
        enabled_tools: List of enabled tool names

    Returns:
        Configured SingleAgent instance
    """
    return SingleAgent(
        llm_client=llm_client,
        name=name,
        agent_type=agent_type,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        enabled_tools=enabled_tools,
        tool_schemas=tool_schemas
    )
