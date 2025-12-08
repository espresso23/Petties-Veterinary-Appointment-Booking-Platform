"""
PETTIES AGENT SERVICE - LLM Client Wrapper
Unified interface cho Ollama và OpenAI

Package: app.services
Purpose: Abstract LLM calls với support cho streaming
Version: v0.0.1
"""

from typing import Optional, Dict, Any, List, AsyncIterator
from abc import ABC, abstractmethod
import httpx
from loguru import logger
from pydantic import BaseModel

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None
    logger.warning("langchain_openai not installed, OpenAI support disabled")

try:
    from langchain_ollama import ChatOllama
except ImportError:
    ChatOllama = None
    logger.warning("langchain_ollama not installed, Ollama support may be limited")

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage


class LLMConfig(BaseModel):
    """Configuration cho LLM client"""
    provider: str = "ollama"  # ollama | openai
    model: str = "kimi-k2-thinking"
    temperature: float = 0.5
    max_tokens: int = 2000
    base_url: Optional[str] = "http://localhost:11434"  # Ollama default
    api_key: Optional[str] = None  # For OpenAI


class LLMResponse(BaseModel):
    """Response từ LLM"""
    content: str
    model: str
    usage: Optional[Dict[str, int]] = None
    finish_reason: Optional[str] = None


class BaseLLMClient(ABC):
    """Abstract base class cho LLM clients"""

    def __init__(self, config: LLMConfig):
        self.config = config

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate response từ LLM"""
        pass

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response tokens"""
        pass

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Chat với message history"""
        pass


class OllamaClient(BaseLLMClient):
    """
    Ollama LLM Client (Hybrid: Local or Cloud)

    Purpose:
        - Connect to local Ollama instance OR Ollama Cloud
        - Support streaming cho real-time responses
        - Dùng cho kimi-k2 model (local: kimi-k2, cloud: kimi-k2:1t-cloud)

    Usage:
        ```python
        # Local mode
        client = OllamaClient(LLMConfig(model="kimi-k2"))
        
        # Cloud mode
        client = OllamaClient(LLMConfig(
            model="kimi-k2:1t-cloud",
            base_url="https://ollama.com",
            api_key="your_api_key"
        ))
        ```
    """

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        
        # Cloud mode: Nếu có API key → dùng Ollama Cloud
        if config.api_key:
            self.base_url = "https://ollama.com"
            headers = {"Authorization": f"Bearer {config.api_key}"}
            mode = "☁️ Cloud"
        else:
            # Local mode
            self.base_url = config.base_url or "http://localhost:11434"
            headers = {}
            mode = "🦙 Local"
        
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=120.0,
            headers=headers
        )
        
        logger.info(f"{mode} OllamaClient initialized: {config.model} @ {self.base_url}")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Generate response from Ollama

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            **kwargs: Additional params (temperature, etc.)

        Returns:
            LLMResponse với content và metadata
        """
        logger.debug(f"Generating with {self.config.model}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.config.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
            }
        }

        try:
            response = await self.client.post("/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()

            return LLMResponse(
                content=data.get("message", {}).get("content", ""),
                model=self.config.model,
                usage={
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                },
                finish_reason="stop"
            )

        except httpx.HTTPError as e:
            logger.error(f"Ollama HTTP error: {e}")
            raise

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """
        Stream response tokens from Ollama

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)

        Yields:
            Token strings
        """
        logger.debug(f"Streaming with {self.config.model}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.config.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
            }
        }

        try:
            async with self.client.stream("POST", "/api/chat", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        import json
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content

        except httpx.HTTPError as e:
            logger.error(f"Ollama stream error: {e}")
            raise

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Chat với full message history

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."}
            system_prompt: System prompt (optional)

        Returns:
            LLMResponse
        """
        formatted_messages = []

        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

        payload = {
            "model": self.config.model,
            "messages": formatted_messages,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
            }
        }

        try:
            response = await self.client.post("/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()

            return LLMResponse(
                content=data.get("message", {}).get("content", ""),
                model=self.config.model,
                usage={
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                },
                finish_reason="stop"
            )

        except httpx.HTTPError as e:
            logger.error(f"Ollama chat error: {e}")
            raise

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


class OpenAIClient(BaseLLMClient):
    """
    OpenAI LLM Client (for embeddings or backup)

    Purpose:
        - Fallback to OpenAI API
        - Used for embeddings (text-embedding-3-small)
    """

    def __init__(self, config: LLMConfig):
        super().__init__(config)

        if ChatOpenAI is None:
            raise ImportError("langchain_openai is not installed. Install with: pip install langchain-openai")

        if not config.api_key:
            logger.warning("OpenAI API key not provided")

        self.llm = ChatOpenAI(
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            api_key=config.api_key,
        )

        logger.info(f"🤖 OpenAIClient initialized: {config.model}")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate response from OpenAI"""
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        try:
            response = await self.llm.ainvoke(messages)

            return LLMResponse(
                content=response.content,
                model=self.config.model,
                usage=response.response_metadata.get("token_usage"),
                finish_reason=response.response_metadata.get("finish_reason")
            )

        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            raise

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response from OpenAI"""
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        try:
            async for chunk in self.llm.astream(messages):
                if chunk.content:
                    yield chunk.content

        except Exception as e:
            logger.error(f"OpenAI stream error: {e}")
            raise

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Chat với message history"""
        formatted_messages = []

        if system_prompt:
            formatted_messages.append(SystemMessage(content=system_prompt))

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "user":
                formatted_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                formatted_messages.append(AIMessage(content=content))
            elif role == "system":
                formatted_messages.append(SystemMessage(content=content))

        try:
            response = await self.llm.ainvoke(formatted_messages)

            return LLMResponse(
                content=response.content,
                model=self.config.model,
                usage=response.response_metadata.get("token_usage"),
                finish_reason=response.response_metadata.get("finish_reason")
            )

        except Exception as e:
            logger.error(f"OpenAI chat error: {e}")
            raise


# ============================================================
# FACTORY FUNCTION
# ============================================================

def create_llm_client(config: Optional[LLMConfig] = None) -> BaseLLMClient:
    """
    Factory function to create LLM client
    
    Loads configuration from settings (env vars)
    For DB-loaded config, use async version or pass config directly

    Args:
        config: LLMConfig (optional, will load from settings if None)

    Returns:
        LLM client instance
    """
    from app.config.settings import settings
    
    if config is None:
        # Load from settings (env vars)
        base_url = settings.OLLAMA_BASE_URL
        api_key = settings.OLLAMA_API_KEY
        model = settings.OLLAMA_MODEL
        
        # Auto-detect Cloud mode: if API key set → Cloud mode
        if api_key:
            base_url = "https://ollama.com"
            # Auto-update model to cloud version if using kimi-k2
            if model in ["kimi-k2", "kimi-k2:latest"]:
                model = "kimi-k2:1t-cloud"
                logger.info(f"🌤️ Auto-switched to Cloud model: {model}")
        
        config = LLMConfig(
            provider="ollama",
            model=model,
            base_url=base_url,
            api_key=api_key if api_key else None
        )

    if config.provider == "openai":
        return OpenAIClient(config)
    else:
        return OllamaClient(config)


async def create_llm_client_from_db(db_session) -> BaseLLMClient:
    """
    Async factory function to create LLM client from DB settings
    
    Args:
        db_session: Async DB session to load settings from SystemSettings table

    Returns:
        LLM client instance
    """
    from app.config.settings import settings
    from app.api.routes.settings import get_setting
    
    # Load from env first
    base_url = settings.OLLAMA_BASE_URL
    api_key = settings.OLLAMA_API_KEY
    model = settings.OLLAMA_MODEL
    
    # Try to load from DB (higher priority than env)
    try:
        db_api_key = await get_setting("OLLAMA_API_KEY", db_session)
        if db_api_key:
            api_key = db_api_key
        
        db_model = await get_setting("OLLAMA_MODEL", db_session)
        if db_model:
            model = db_model
            
        db_base_url = await get_setting("OLLAMA_BASE_URL", db_session)
        if db_base_url:
            base_url = db_base_url
    except Exception as e:
        logger.warning(f"Could not load settings from DB: {e}, using env defaults")
    
    # Auto-detect Cloud mode: if API key set → Cloud mode
    if api_key:
        base_url = "https://ollama.com"
        # Auto-update model to cloud version if using kimi-k2
        if model in ["kimi-k2", "kimi-k2:latest"]:
            model = "kimi-k2:1t-cloud"
            logger.info(f"🌤️ Auto-switched to Cloud model: {model}")
    
    config = LLMConfig(
        provider="ollama",
        model=model,
        base_url=base_url,
        api_key=api_key if api_key else None
    )
    
    if config.provider == "openai":
        return OpenAIClient(config)
    else:
        return OllamaClient(config)


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_llm_client: Optional[BaseLLMClient] = None


def get_llm_client() -> BaseLLMClient:
    """
    Get singleton LLM client instance

    Returns:
        LLM client instance
    """
    global _llm_client

    if _llm_client is None:
        _llm_client = create_llm_client()

    return _llm_client


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "LLMConfig",
    "LLMResponse",
    "BaseLLMClient",
    "OllamaClient",
    "OpenAIClient",
    "create_llm_client",
    "create_llm_client_from_db",
    "get_llm_client",
]
