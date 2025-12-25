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

from app.core.agents.state import ReActState, ReActStep, create_initial_react_state


# ===== DEFAULT SYSTEM PROMPT =====

DEFAULT_SYSTEM_PROMPT = """Ban la Petties AI Assistant - tro ly AI chuyen ve cham soc thu cung.

## NHIEM VU
- Tu van suc khoe thu cung, chan doan so bo dua tren trieu chung
- Ho tro dat lich kham tai phong kham thu y
- Tim kiem thong tin ve cham soc thu cung, san pham, dich vu
- Tra loi cac cau hoi ve thu cung bang tieng Viet than thien

## QUY TAC
1. Luon tra loi bang tieng Viet, than thien va de hieu
2. Khi can thong tin, su dung tools duoc cung cap
3. Khong dua ra chan doan cuoi cung - luon khuyen khich gap bac si thu y
4. Uu tien an toan va suc khoe cua thu cung

## REACT PATTERN
Su dung pattern Thought -> Action -> Observation:
1. Thought: Suy nghi ve cau hoi cua user va xac dinh can lam gi
2. Action: Goi tool phu hop (neu can)
3. Observation: Xem ket qua tu tool
4. Repeat hoac tra loi cuoi cung

## TOOLS
Ban co the su dung cac tools sau (chi khi enabled):
- search_symptoms: Tim benh dua tren trieu chung
- RAG_search: Tim kiem kien thuc tu knowledge base
- check_slot: Kiem tra slot trong tai phong kham
- create_booking: Tao lich hen kham
- search_clinics: Tim phong kham gan vi tri user
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
        llm_client: LLM client (OpenRouter/Ollama)
        system_prompt: System prompt tu DB hoac default
        temperature: Temperature cho LLM
        max_tokens: Max tokens cho response
        enabled_tools: Danh sach tools duoc phep su dung
        graph: Compiled LangGraph StateGraph
    """

    def __init__(
        self,
        llm_client,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        enabled_tools: Optional[List[str]] = None,
        max_iterations: int = 10
    ):
        """
        Khoi tao Single Agent

        Args:
            llm_client: LLM client instance (OpenRouterClient hoac OllamaClient)
            system_prompt: System prompt (load tu DB hoac dung default)
            temperature: Temperature parameter (0.0-1.0)
            max_tokens: Max tokens cho response
            top_p: Top-P parameter (0.0-1.0)
            enabled_tools: List of enabled tool names
            max_iterations: Max ReAct iterations truoc khi force stop
        """
        self.llm_client = llm_client
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        self.enabled_tools = enabled_tools or []
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

        messages = state.get("messages", [])
        react_steps = state.get("react_steps", [])
        iteration = state.get("iteration", 0)

        # Check max iterations
        if iteration >= self.max_iterations:
            logger.warning(f"Max iterations ({self.max_iterations}) reached, forcing end")
            return {
                **state,
                "final_answer": "Xin loi, toi khong the hoan thanh yeu cau. Vui long thu lai sau.",
                "should_end": True
            }

        # Build context from previous steps
        context = self._build_context(react_steps)

        # Create prompt for LLM
        think_prompt = self._create_think_prompt(messages, context)

        try:
            # Call LLM
            response = await self.llm_client.generate(
                prompt=think_prompt,
                system_prompt=self.system_prompt,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            thought_content = response.content

            # Parse response de xac dinh action
            parsed = self._parse_thought(thought_content)

            # Log ReAct step
            step = ReActStep(
                step_type="thought",
                content=parsed.get("thought", thought_content),
                tool_name=parsed.get("tool_name"),
                tool_params=parsed.get("tool_params"),
                tool_result=None
            )

            new_react_steps = react_steps + [step]

            logger.info(f"THOUGHT: {parsed.get('thought', thought_content)[:100]}...")

            return {
                **state,
                "react_steps": new_react_steps,
                "current_thought": parsed.get("thought", thought_content),
                "pending_tool_call": parsed.get("tool_call"),
                "should_end": parsed.get("should_end", False),
                "final_answer": parsed.get("final_answer"),
                "iteration": iteration + 1
            }

        except Exception as e:
            logger.error(f"Error in THINK node: {e}")
            return {
                **state,
                "error": str(e),
                "should_end": True
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
            return state

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
                **state,
                "react_steps": react_steps + [step],
                "last_tool_result": error_result
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
                **state,
                "react_steps": react_steps + [step],
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
                **state,
                "react_steps": react_steps + [step],
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
        react_steps = state.get("react_steps", [])

        # Format observation
        if isinstance(tool_result, dict):
            if "error" in tool_result:
                observation = f"Tool returned error: {tool_result['error']}"
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
            tool_result=None
        )

        logger.info(f"OBSERVATION: {observation[:100]}...")

        return {
            **state,
            "react_steps": react_steps + [step],
            "current_observation": observation
        }

    def _should_continue(self, state: ReActState) -> Literal["act", "end"]:
        """
        Router - Quyet dinh tiep tuc hay ket thuc

        Args:
            state: Current ReActState

        Returns:
            "act" neu co tool call, "end" neu da co final answer
        """
        # Check if should end
        if state.get("should_end", False):
            return "end"

        # Check if there's a pending tool call
        if state.get("pending_tool_call"):
            return "act"

        # Check if there's a final answer
        if state.get("final_answer"):
            return "end"

        # Check error
        if state.get("error"):
            return "end"

        # Default: end (no tool call)
        return "end"

    def _build_context(self, react_steps: List[ReActStep]) -> str:
        """Build context string tu previous ReAct steps"""
        if not react_steps:
            return ""

        context_parts = []
        for step in react_steps[-5:]:  # Last 5 steps
            if step["step_type"] == "thought":
                context_parts.append(f"Thought: {step['content']}")
            elif step["step_type"] == "action":
                context_parts.append(f"Action: {step['content']}")
            elif step["step_type"] == "observation":
                context_parts.append(f"Observation: {step['content']}")

        return "\n".join(context_parts)

    def _create_think_prompt(self, messages: List, context: str) -> str:
        """Create prompt cho Think node"""
        # Get last user message
        user_message = ""
        for msg in reversed(messages):
            if hasattr(msg, 'content'):
                content = msg.content
            elif isinstance(msg, dict):
                content = msg.get('content', '')
            else:
                content = str(msg)

            role = getattr(msg, 'role', None) or (msg.get('role') if isinstance(msg, dict) else 'user')
            if role == 'user':
                user_message = content
                break

        prompt = f"""User message: {user_message}

{f'Previous reasoning:{chr(10)}{context}' if context else ''}

Available tools: {', '.join(self.enabled_tools) if self.enabled_tools else 'None'}

Respond in this format:
1. If you need to use a tool:
   THOUGHT: [Your reasoning about what to do]
   ACTION: [tool_name]
   ACTION_INPUT: [JSON object with tool parameters]

2. If you can answer directly without a tool:
   THOUGHT: [Your reasoning]
   FINAL_ANSWER: [Your response to the user in Vietnamese]

Remember: Always respond in Vietnamese. Be helpful and friendly."""

        return prompt

    def _parse_thought(self, thought_content: str) -> Dict[str, Any]:
        """
        Parse LLM response de extract thought, action, final_answer

        Returns:
            Dict voi:
            - thought: str
            - tool_call: Optional[Dict] voi name, arguments
            - final_answer: Optional[str]
            - should_end: bool
        """
        result = {
            "thought": "",
            "tool_call": None,
            "tool_name": None,
            "tool_params": None,
            "final_answer": None,
            "should_end": False
        }

        lines = thought_content.strip().split('\n')

        current_section = None
        action_input_lines = []

        for line in lines:
            line = line.strip()

            if line.startswith('THOUGHT:'):
                current_section = 'thought'
                result["thought"] = line.replace('THOUGHT:', '').strip()
            elif line.startswith('ACTION:'):
                current_section = 'action'
                result["tool_name"] = line.replace('ACTION:', '').strip()
            elif line.startswith('ACTION_INPUT:'):
                current_section = 'action_input'
                action_input_lines.append(line.replace('ACTION_INPUT:', '').strip())
            elif line.startswith('FINAL_ANSWER:'):
                current_section = 'final_answer'
                result["final_answer"] = line.replace('FINAL_ANSWER:', '').strip()
                result["should_end"] = True
            elif current_section == 'action_input':
                action_input_lines.append(line)
            elif current_section == 'thought':
                result["thought"] += ' ' + line
            elif current_section == 'final_answer':
                result["final_answer"] += ' ' + line

        # Parse action input JSON
        if result["tool_name"] and action_input_lines:
            try:
                action_input = '\n'.join(action_input_lines)
                result["tool_params"] = json.loads(action_input)
                result["tool_call"] = {
                    "name": result["tool_name"],
                    "arguments": result["tool_params"]
                }
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse ACTION_INPUT as JSON: {action_input_lines}")
                result["tool_params"] = {"raw_input": ' '.join(action_input_lines)}
                result["tool_call"] = {
                    "name": result["tool_name"],
                    "arguments": result["tool_params"]
                }

        # If no structured output, treat entire response as final answer
        if not result["thought"] and not result["tool_call"] and not result["final_answer"]:
            result["final_answer"] = thought_content.strip()
            result["should_end"] = True

        return result

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
                final_answer = "Xin loi, toi khong the xu ly yeu cau cua ban. Vui long thu lai."

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

        config = {"configurable": {"thread_id": session_id or "default"}}

        try:
            async for event in self.graph.astream_events(state, config, version="v2"):
                event_type = event.get("event", "")

                if event_type == "on_chain_end":
                    output = event.get("data", {}).get("output", {})

                    # Yield ReAct steps
                    react_steps = output.get("react_steps", [])
                    if react_steps:
                        last_step = react_steps[-1]
                        yield {
                            "type": "react_step",
                            "step": last_step
                        }

                    # Yield final answer
                    if output.get("final_answer"):
                        yield {
                            "type": "final_answer",
                            "content": output["final_answer"]
                        }

                elif event_type == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk", {})
                    if hasattr(chunk, 'content') and chunk.content:
                        yield {
                            "type": "token",
                            "content": chunk.content
                        }

        except Exception as e:
            logger.error(f"Error streaming agent: {e}")
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
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    top_p: float = 0.9,
    enabled_tools: Optional[List[str]] = None
) -> SingleAgent:
    """
    Builder function de tao SingleAgent instance

    Args:
        llm_client: LLM client (OpenRouterClient)
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
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        enabled_tools=enabled_tools
    )
