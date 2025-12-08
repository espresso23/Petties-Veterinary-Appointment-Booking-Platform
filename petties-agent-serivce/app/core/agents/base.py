"""
PETTIES AGENT SERVICE - Base Agent Class
Abstract base class cho tất cả AI Agents trong hệ thống

Package: app.core.agents
Purpose: Define interface chung cho Main Agent và Sub-Agents
Version: v0.0.1
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, AsyncIterator
from pydantic import BaseModel
from loguru import logger as loguru_logger

from app.core.agents.state import AgentState, Message


class AgentConfig(BaseModel):
    """
    Configuration cho Agent

    Purpose: Lưu trữ cấu hình của mỗi agent (temperature, model, prompts, etc.)
    """
    name: str
    description: str = ""
    agent_type: str = "main"  # main, booking, medical, research
    temperature: float = 0.5
    max_tokens: int = 2000
    model: str = "kimi-k2-thinking"  # Default to Ollama model
    system_prompt: str = ""
    tools: List[str] = []  # List of tool names mà agent có thể sử dụng
    enabled: bool = True


class AgentResponse(BaseModel):
    """
    Response từ Agent

    Purpose: Chuẩn hóa format response từ mọi agent
    """
    agent_name: str
    content: str
    metadata: Dict[str, Any] = {}
    tool_calls: List[Dict[str, Any]] = []  # Danh sách tools đã được gọi
    error: Optional[str] = None


class BaseAgent(ABC):
    """
    Abstract Base Agent Class

    Purpose:
        - Define interface chung cho tất cả agents
        - Main Agent (Supervisor) và Sub-Agents đều inherit từ class này
        - Enforce consistency trong cách agents xử lý requests

    Attributes:
        config: AgentConfig - Cấu hình của agent
        logger: Logger instance cho agent
    """

    def __init__(self, config: AgentConfig):
        """
        Initialize Base Agent

        Args:
            config: AgentConfig object với name, temperature, prompts, etc.
        """
        self.config = config
        self.logger = loguru_logger.bind(agent=config.name)
        self.logger.info(f"🤖 Initializing Agent: {config.name}")

    @abstractmethod
    async def process(self, user_input: str, context: Dict[str, Any] = {}) -> AgentResponse:
        """
        Process user input và trả về response

        Args:
            user_input: Input từ user hoặc từ Main Agent
            context: Context dictionary (chat history, session data, etc.)

        Returns:
            AgentResponse object với content, metadata, tool_calls

        Purpose:
            - Main Agent: Phân loại intent, routing đến Sub-Agent
            - Sub-Agent: Xử lý task cụ thể (booking, medical diagnosis, web research)

        Must be implemented by:
            - MainAgent (Supervisor/Orchestrator)
            - BookingAgent
            - MedicalAgent
            - ResearchAgent
        """
        pass

    @abstractmethod
    async def validate_input(self, user_input: str) -> bool:
        """
        Validate input trước khi process

        Args:
            user_input: Input cần validate

        Returns:
            True nếu input hợp lệ, False nếu không

        Purpose:
            - Kiểm tra input có đủ thông tin không
            - Prevent malicious input
            - Schema validation

        Example:
            BookingAgent: Check xem có pet_id, date, time không
            MedicalAgent: Check xem có symptoms description không
        """
        pass

    def get_system_prompt(self) -> str:
        """
        Get system prompt cho agent

        Returns:
            System prompt string

        Purpose:
            - Định nghĩa behavior và personality của agent
            - Cung cấp context về tools có sẵn
            - Instructions về cách format response
        """
        return self.config.system_prompt

    def update_config(self, **kwargs):
        """
        Update agent configuration dynamically

        Args:
            **kwargs: Key-value pairs để update config

        Purpose:
            - Admin có thể điều chỉnh temperature, prompts qua Dashboard
            - A/B testing với các configurations khác nhau
        """
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
                self.logger.info(f"Updated {key} = {value}")

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.config.name} temperature={self.config.temperature}>"

    # ===== LangGraph Integration Methods =====

    @abstractmethod
    async def process_state(self, state: AgentState) -> AgentState:
        """
        Process AgentState (LangGraph node function)

        Args:
            state: Current AgentState từ LangGraph workflow

        Returns:
            Updated AgentState

        Purpose:
            - Dùng cho LangGraph StateGraph nodes
            - Update state.messages với response
            - Set state.tool_calls nếu cần call tools
            - Set state.routing_suggestion nếu cần handoff

        Example:
            ```python
            async def process_state(self, state: AgentState) -> AgentState:
                # Get last user message
                user_msg = state["messages"][-1]["content"]

                # Process with LLM
                response = await self.llm.generate(user_msg)

                # Add to messages
                state["messages"].append(Message(
                    role="assistant",
                    content=response,
                    name=self.config.name
                ))

                return state
            ```
        """
        pass

    async def process_stream(
        self,
        state: AgentState
    ) -> AsyncIterator[str]:
        """
        Stream processing - Token by token streaming

        Args:
            state: Current AgentState

        Yields:
            Response tokens

        Purpose:
            - Real-time streaming qua WebSocket
            - Hiển thị thinking process cho user
        """
        # Default implementation - yield full response at once
        response = await self.process(
            user_input=state["messages"][-1]["content"],
            context=state.get("context", {})
        )
        yield response.content

    def _add_message_to_state(
        self,
        state: AgentState,
        content: str,
        role: str = "assistant"
    ) -> AgentState:
        """
        Helper: Add message to state

        Args:
            state: Current state
            content: Message content
            role: Message role

        Returns:
            Updated state
        """
        new_message = Message(
            role=role,
            content=content,
            name=self.config.name if role == "assistant" else None,
            tool_call_id=None
        )

        state["messages"].append(new_message)
        return state

    async def load_from_db(self, agent_id: int) -> None:
        """
        Load agent config từ database

        Args:
            agent_id: Database ID của agent

        Purpose:
            - Load config từ PostgreSQL agents table
            - Update self.config với loaded values
        """
        # NOTE: Use AgentFactory instead
        # This method is kept for compatibility but AgentFactory is the recommended approach
        loguru_logger.warning(f"load_from_db() not implemented. Use AgentFactory.create_agent() instead")
