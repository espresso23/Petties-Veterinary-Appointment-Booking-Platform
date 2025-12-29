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

DEFAULT_SYSTEM_PROMPT = """Bạn là Petties AI Assistant - trợ lý AI chuyên về chăm sóc thú cưng.

## NHIỆM VỤ
- Tư vấn sức khỏe thú cưng, chẩn đoán bệnh dựa trên triệu chứng
- Hỗ trợ đặt lịch khám tại phòng khám thú y
- Tìm kiếm thông tin về chăm sóc thú cưng, sản phẩm, dịch vụ
- Trả lời câu hỏi về thú cưng bằng tiếng Việt thân thiện

## QUY TẮC
1. Luôn trả lời bằng tiếng Việt, thân thiện và dễ hiểu
2. Khi cần thông tin, sử dụng tools được cung cấp
3. Không đưa ra chẩn đoán cuối cùng - luôn khuyến khích gặp bác sĩ thú y
4. Uu tiên an toàn và sức khỏe của thú cưng

## REACT PATTERN
Su dung patternThought -> Action -> Observation:
1.Thought: Suy nghĩ về câu hỏi của user và xác định cần làm gì
2.Action: Gọi tool phù hợp (nếu cần)
3.Observation: Xem kết quả từ tool
4. Repeat hoặc trả lời cuối cùng

## TOOLS
Ban có thể sử dụng các tools sau (chỉ khi enabled):
- search_symptoms: Tìm bệnh dựa trên triệu chứng
- RAG_search: Tìm kiếm kiến thức từ knowledge base
- check_slot: Kiểm tra slot trong tai phòng khám
- create_booking: Tạo lịch hẹn khám
- search_clinics: Tìm phòng khám gần vị trí user
"""


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

        # 3. Detect repetitive tool calls and inject warning
        last_action = next((s for s in reversed(react_steps) if s.get("step_type") == "action"), None)
        
        warning_suffix = ""
        if last_action and iteration > 0:
            warning_suffix = f"\n\nLƯU Ý: Bạn đã thực hiện hành động '{last_action.get('tool_name')}' ở bước trước. Nếu Observation đã có câu trả lời, hãy ưu tiên trả lời (Final Answer) thay vì gọi lại công cụ."

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

            # 5. Log ReAct step
            step = ReActStep(
                step_type="thought",
                content=parsed.get("thought", thought_content),
                tool_name=parsed.get("tool_name"),
                tool_params=parsed.get("tool_params"),
                tool_result=None
            )

            new_react_steps = [step]
            logger.info(f"THOUGHT: {parsed.get('thought', thought_content)[:100]}...")

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

        Format tool result de LLM co the hieu va su dung

        Args:
            state: Current ReActState voi last_tool_result

        Returns:
            Updated state voi observation
        """
        logger.debug("Entering OBSERVE node")

        tool_result = state.get("last_tool_result", {})
        
        # Format observation - SMARTER EXTRACTION
        observation = ""
        if isinstance(tool_result, dict):
            if "error" in tool_result:
                observation = f"Tool returned error: {tool_result['error']}"
            elif "data" in tool_result and isinstance(tool_result["data"], dict) and "answer" in tool_result["data"]:
                # If RAG tool already synthesized an answer, put it FIRST
                rag_data = tool_result["data"]
                observation = f"KẾT QUẢ TRA CỨU: {rag_data['answer']}\n\n"
                if "sources_used" in rag_data:
                    observation += f"(Dựa trên {rag_data['sources_used']} đoạn tài liệu)\n"
            else:
                # Fallback to JSON but cleaner
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

        # Build prompt parts - USE SYSTEM PROMPT FROM DATABASE
        prompt_parts = [
            f"""Hệ thống: {self.name} ({self.agent_type})

=== HƯỚNG DẪN TỪ ADMIN (Database) ===
{self.system_prompt}

=== QUY TẮC REACT FORMAT (Bắt buộc) ===
Để gọi công cụ, bạn PHẢI viết theo định dạng CHÍNH XÁC:
Thought: [Giải thích tại sao bạn cần gọi công cụ này]
Tool: [Tên công cụ chính xác từ danh sách CÔNG CỤ CÓ SẴN]
Tool Input: {{ "param_name": "giá trị" }}

Sau khi nhận được kết quả (Observation), nếu đã đủ thông tin, bạn trả lời bằng định dạng:
Thought: [Tổng hợp thông tin thu thập được]
Final Answer: [Câu trả lời đầy đủ và thân thiện cho người dùng bằng tiếng Việt]

LƯU Ý QUAN TRỌNG:
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
