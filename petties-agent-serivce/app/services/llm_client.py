"""
PETTIES AGENT SERVICE - LLM Client Wrapper
Unified interface cho OpenRouter, Ollama va OpenAI

Package: app.services
Purpose: Abstract LLM calls voi support cho streaming
Version: v1.0.0 (Added OpenRouter Cloud API)

Supported Providers:
- OpenRouter (RECOMMENDED): Cloud API voi multi-model routing
- Ollama: Local LLM (backup)
- OpenAI: Fallback

OpenRouter Models:
- google/gemini-2.0-flash-exp:free (1M context, FREE)
- meta-llama/llama-3.3-70b-instruct (Vietnamese good)
- anthropic/claude-3.5-sonnet (Best quality)
"""

from typing import Optional, Dict, Any, List, AsyncIterator
from abc import ABC, abstractmethod
import httpx
import json
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


# ============================================================
# CONFIG MODELS
# ============================================================

class LLMConfig(BaseModel):
    """Configuration cho LLM client"""
    provider: str = "openrouter"  # openrouter | ollama | openai
    model: str = "google/gemini-2.0-flash-exp:free"  # Default: Free Gemini
    fallback_model: str = "meta-llama/llama-3.3-70b-instruct"  # Fallback model
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9
    base_url: Optional[str] = None  # Auto-set based on provider
    api_key: Optional[str] = None


class LLMResponse(BaseModel):
    """Response tu LLM"""
    content: str
    model: str
    usage: Optional[Dict[str, int]] = None
    finish_reason: Optional[str] = None


# ============================================================
# BASE CLASS
# ============================================================

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
        """Generate response tu LLM"""
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
        """Chat voi message history"""
        pass


# ============================================================
# OPENROUTER CLIENT (RECOMMENDED)
# ============================================================

class OpenRouterClient(BaseLLMClient):
    """
    OpenRouter LLM Client (Cloud API)

    OpenRouter cho phep access nhieu models tu 1 API:
    - Google Gemini (free tier available)
    - Meta Llama 3.3
    - Anthropic Claude
    - Mistral, DeepSeek, Qwen, etc.

    Usage:
        ```python
        client = OpenRouterClient(LLMConfig(
            api_key="sk-or-...",
            model="google/gemini-2.0-flash-exp:free"
        ))
        response = await client.generate("Hello, how are you?")
        ```

    Reference: https://openrouter.ai/docs
    """

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, config: LLMConfig):
        super().__init__(config)

        if not config.api_key:
            raise ValueError("OpenRouter API key is required")

        self.api_key = config.api_key
        self.model = config.model
        self.fallback_model = config.fallback_model

        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=120.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": "https://petties.world",
                "X-Title": "Petties AI Agent",
                "Content-Type": "application/json"
            }
        )

        logger.info(f"OpenRouterClient initialized: {config.model}")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Generate response from OpenRouter

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            **kwargs: temperature, max_tokens, top_p

        Returns:
            LLMResponse voi content va metadata
        """
        logger.debug(f"Generating with {self.model}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
        }

        try:
            response = await self.client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return LLMResponse(
                content=content,
                model=data.get("model", self.model),
                usage={
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                },
                finish_reason=data.get("choices", [{}])[0].get("finish_reason", "stop")
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter HTTP error: {e.response.status_code} - {e.response.text}")
            # Try fallback model
            if kwargs.get("model") != self.fallback_model:
                logger.info(f"Trying fallback model: {self.fallback_model}")
                return await self.generate(
                    prompt, system_prompt,
                    model=self.fallback_model, **kwargs
                )
            raise

        except httpx.HTTPError as e:
            logger.error(f"OpenRouter HTTP error: {e}")
            raise

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """
        Stream response tokens from OpenRouter

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)

        Yields:
            Token strings
        """
        logger.debug(f"Streaming with {self.model}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
            "stream": True
        }

        try:
            async with self.client.stream("POST", "/chat/completions", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue

        except httpx.HTTPError as e:
            logger.error(f"OpenRouter stream error: {e}")
            raise

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Chat voi full message history

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
            "model": kwargs.get("model", self.model),
            "messages": formatted_messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
        }

        try:
            response = await self.client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return LLMResponse(
                content=content,
                model=data.get("model", self.model),
                usage={
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                },
                finish_reason=data.get("choices", [{}])[0].get("finish_reason", "stop")
            )

        except httpx.HTTPError as e:
            logger.error(f"OpenRouter chat error: {e}")
            raise

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test OpenRouter connection va list available models

        Returns:
            Dict voi status va model info
        """
        try:
            # Test with a simple completion
            response = await self.generate(
                prompt="Hello",
                max_tokens=5
            )
            return {
                "status": "success",
                "model": self.model,
                "response_length": len(response.content)
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }


# ============================================================
# OLLAMA CLIENT (BACKUP)
# ============================================================

class OllamaClient(BaseLLMClient):
    """
    Ollama LLM Client (Local or Cloud)

    Purpose:
        - Fallback to local Ollama instance
        - Support streaming cho real-time responses

    Usage:
        ```python
        # Local mode
        client = OllamaClient(LLMConfig(
            provider="ollama",
            model="llama3.2",
            base_url="http://localhost:11434"
        ))
        ```
    """

    def __init__(self, config: LLMConfig):
        super().__init__(config)

        self.base_url = config.base_url or "http://localhost:11434"
        headers = {}

        if config.api_key:
            headers["Authorization"] = f"Bearer {config.api_key}"

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=120.0,
            headers=headers
        )

        logger.info(f"OllamaClient initialized: {config.model} @ {self.base_url}")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate response from Ollama"""
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
        """Stream response tokens from Ollama"""
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
        """Chat voi full message history"""
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


# ============================================================
# DEEPSEEK CLIENT (FALLBACK)
# ============================================================

class DeepSeekClient(BaseLLMClient):
    """
    DeepSeek LLM Client (Cloud API)

    DeepSeek provides high-quality LLM with excellent Vietnamese support.
    API is compatible with OpenAI format.

    Models:
        - deepseek-chat: General conversation (recommended)
        - deepseek-coder: Code generation

    Usage:
        ```python
        client = DeepSeekClient(LLMConfig(
            api_key="sk-...",
            model="deepseek-chat",
            base_url="https://api.deepseek.com"
        ))
        response = await client.generate("Xin chào!")
        ```

    Reference: https://platform.deepseek.com/api-docs
    """

    DEFAULT_BASE_URL = "https://api.deepseek.com"

    def __init__(self, config: LLMConfig):
        super().__init__(config)

        if not config.api_key:
            raise ValueError("DeepSeek API key is required")

        self.api_key = config.api_key
        self.model = config.model or "deepseek-chat"
        self.base_url = config.base_url or self.DEFAULT_BASE_URL

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=120.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )

        logger.info(f"DeepSeekClient initialized: {self.model} @ {self.base_url}")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate response from DeepSeek"""
        logger.debug(f"Generating with DeepSeek {self.model}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
        }

        try:
            response = await self.client.post("/v1/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return LLMResponse(
                content=content,
                model=data.get("model", self.model),
                usage={
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                },
                finish_reason=data.get("choices", [{}])[0].get("finish_reason", "stop")
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"DeepSeek HTTP error: {e.response.status_code} - {e.response.text}")
            raise

        except httpx.HTTPError as e:
            logger.error(f"DeepSeek HTTP error: {e}")
            raise

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream response tokens from DeepSeek"""
        logger.debug(f"Streaming with DeepSeek {self.model}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
            "stream": True
        }

        try:
            async with self.client.stream("POST", "/v1/chat/completions", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue

        except httpx.HTTPError as e:
            logger.error(f"DeepSeek stream error: {e}")
            raise

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> LLMResponse:
        """Chat with full message history"""
        formatted_messages = []

        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

        payload = {
            "model": kwargs.get("model", self.model),
            "messages": formatted_messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
        }

        try:
            response = await self.client.post("/v1/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return LLMResponse(
                content=content,
                model=data.get("model", self.model),
                usage={
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                },
                finish_reason=data.get("choices", [{}])[0].get("finish_reason", "stop")
            )

        except httpx.HTTPError as e:
            logger.error(f"DeepSeek chat error: {e}")
            raise

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    async def test_connection(self) -> Dict[str, Any]:
        """Test DeepSeek connection"""
        try:
            response = await self.generate(
                prompt="Hello",
                max_tokens=5
            )
            return {
                "status": "success",
                "model": self.model,
                "response_length": len(response.content)
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }


# ============================================================
# OPENAI CLIENT (FALLBACK)
# ============================================================

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

        logger.info(f"OpenAIClient initialized: {config.model}")

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
        """Chat voi message history"""
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
# FACTORY FUNCTIONS
# ============================================================

def create_llm_client(config: Optional[LLMConfig] = None) -> BaseLLMClient:
    """
    Factory function to create LLM client

    Args:
        config: LLMConfig (optional, will load from settings if None)

    Returns:
        LLM client instance (OpenRouterClient, OllamaClient, or OpenAIClient)
    """
    from app.config.settings import settings

    if config is None:
        # Default to OpenRouter
        config = LLMConfig(
            provider="openrouter",
            model=getattr(settings, 'OPENROUTER_MODEL', 'google/gemini-2.0-flash-exp:free'),
            api_key=getattr(settings, 'OPENROUTER_API_KEY', ''),
            temperature=0.7,
            max_tokens=2000
        )

    provider = config.provider.lower()

    if provider == "openrouter":
        return OpenRouterClient(config)
    elif provider == "deepseek":
        return DeepSeekClient(config)
    elif provider == "ollama":
        return OllamaClient(config)
    elif provider == "openai":
        return OpenAIClient(config)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


async def create_llm_client_from_db(db_session) -> BaseLLMClient:
    """
    Async factory function to create LLM client from DB settings

    Args:
        db_session: Async DB session to load settings from SystemSettings table

    Returns:
        LLM client instance
    """
    from app.api.routes.settings import get_setting

    # Try to get OpenRouter settings first (preferred)
    openrouter_api_key = await get_setting("OPENROUTER_API_KEY", db_session)

    if openrouter_api_key:
        # Use OpenRouter
        model = await get_setting("OPENROUTER_DEFAULT_MODEL", db_session) or "google/gemini-2.0-flash-exp:free"
        fallback_model = await get_setting("OPENROUTER_FALLBACK_MODEL", db_session) or "meta-llama/llama-3.3-70b-instruct"

        config = LLMConfig(
            provider="openrouter",
            model=model,
            fallback_model=fallback_model,
            api_key=openrouter_api_key,
            temperature=0.7,
            max_tokens=2000
        )
        return OpenRouterClient(config)

    # Fallback to Ollama
    ollama_base_url = await get_setting("OLLAMA_BASE_URL", db_session) or "http://localhost:11434"
    ollama_model = await get_setting("OLLAMA_MODEL", db_session) or "llama3.2"
    ollama_api_key = await get_setting("OLLAMA_API_KEY", db_session)

    config = LLMConfig(
        provider="ollama",
        model=ollama_model,
        base_url=ollama_base_url,
        api_key=ollama_api_key if ollama_api_key else None,
        temperature=0.7,
        max_tokens=2000
    )
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


def reset_llm_client():
    """Reset singleton LLM client (for testing/reconfiguration)"""
    global _llm_client
    _llm_client = None


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "LLMConfig",
    "LLMResponse",
    "BaseLLMClient",
    "OpenRouterClient",
    "DeepSeekClient",
    "OllamaClient",
    "OpenAIClient",
    "create_llm_client",
    "create_llm_client_from_db",
    "get_llm_client",
    "reset_llm_client",
]
