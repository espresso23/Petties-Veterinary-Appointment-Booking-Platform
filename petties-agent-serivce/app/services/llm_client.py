"""
PETTIES AGENT SERVICE - LLM Client Wrapper
Unified interface cho OpenRouter

Package: app.services
Purpose: Abstract LLM calls voi support cho streaming
Version: v1.3.0 (OpenRouter only)

Supported Providers:
- OpenRouter (RECOMMENDED): Cloud API voi multi-model routing

OpenRouter Models:
- google/gemini-2.5-flash-lite (1M context, FREE)
- meta-llama/llama-3.3-70b-instruct (Vietnamese good)
- anthropic/claude-3.7-sonnet (Best quality)
"""

from typing import Optional, Dict, Any, List, AsyncIterator
from abc import ABC, abstractmethod
import httpx
import json
import uuid
import re
from loguru import logger
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage


# ============================================================
# CONFIG MODELS
# ============================================================


class LLMConfig(BaseModel):
    """Configuration cho LLM client"""

    provider: str = "openrouter"  # openrouter
    model: str = "google/gemini-2.5-flash-lite"  # Default: Free Gemini
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
        self, prompt: str, system_prompt: Optional[str] = None, **kwargs
    ) -> LLMResponse:
        """Generate response tu LLM"""
        pass

    @abstractmethod
    async def stream(
        self, prompt: str, system_prompt: Optional[str] = None, **kwargs
    ) -> AsyncIterator[str]:
        """Stream response tokens"""
        pass

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        **kwargs,
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
    - Mistral, Qwen, etc.

    Usage:
        ```python
        client = OpenRouterClient(LLMConfig(
            api_key="sk-or-...",
            model="google/gemini-2.5-flash-lite"
        ))
        response = await client.generate("Hello, how are you?")
        ```

    Reference: https://openrouter.ai/docs
    """

    BASE_URL = "https://openrouter.ai/api/v1"
    LEGACY_MODEL_ALIASES = {
        "google/gemini-2.0-flash-exp:free": "google/gemini-2.5-flash-lite",
        "google/gemini-2.0-flash-lite-preview-02-05:free": "google/gemini-2.5-flash-lite",
        "google/gemini-2.0-flash-001": "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-flash-preview": "google/gemini-2.5-flash",
        "anthropic/claude-3.5-sonnet": "anthropic/claude-3.7-sonnet",
    }

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
                "Content-Type": "application/json",
            },
        )

        logger.info(f"OpenRouterClient initialized: {config.model}")

    def _normalize_model_name(self, model_name: Optional[str]) -> str:
        """Map stale OpenRouter model IDs to current stable IDs."""
        requested = model_name or self.model
        normalized = self.LEGACY_MODEL_ALIASES.get(requested, requested)
        if normalized != requested:
            logger.warning(
                "Remapping legacy OpenRouter model '{}' to '{}'",
                requested,
                normalized,
            )
        return normalized

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        **kwargs,
    ) -> LLMResponse:
        """
        Generate response from OpenRouter

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            images: Optional list ảnh (URL https, data URL, hoặc base64 raw)
            **kwargs: temperature, max_tokens, top_p

        Returns:
            LLMResponse voi content va metadata
        """
        model_to_use = self._normalize_model_name(kwargs.get("model", self.model))
        logger.debug(f"Generating with {model_to_use}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Build user message content (text + images for multimodal)
        if images:
            # Multimodal content: text + image_url parts
            user_content = [{"type": "text", "text": prompt}]
            for img_data in images:
                if not isinstance(img_data, str):
                    continue
                img_data = img_data.strip()
                # 1) data URL
                if img_data.startswith("data:"):
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": img_data}}
                    )
                # 2) URL trực tiếp (Cloudinary/S3/HTTPS)
                elif img_data.startswith("http://") or img_data.startswith("https://"):
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": img_data}}
                    )
                else:
                    # 3) raw base64 -> thêm data URL prefix
                    user_content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img_data}"},
                        }
                    )
            messages.append({"role": "user", "content": user_content})
        else:
            # Simple text-only content
            messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model_to_use,
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
                    "total_tokens": usage.get("total_tokens", 0),
                },
                finish_reason=data.get("choices", [{}])[0].get("finish_reason", "stop"),
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"OpenRouter HTTP error: {e.response.status_code} - {e.response.text}"
            )
            # Try fallback model
            if model_to_use != self.fallback_model:
                logger.info(f"Trying fallback model: {self.fallback_model}")
                return await self.generate(
                    prompt,
                    system_prompt,
                    images=images,
                    model=self.fallback_model,
                    **kwargs,
                )
            raise

        except httpx.HTTPError as e:
            logger.error(f"OpenRouter HTTP error: {e}")
            raise

    async def stream(
        self, prompt: str, system_prompt: Optional[str] = None, **kwargs
    ) -> AsyncIterator[str]:
        """
        Stream response tokens from OpenRouter

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)

        Yields:
            Token strings
        """
        model_to_use = self._normalize_model_name(kwargs.get("model", self.model))
        logger.debug(f"Streaming with {model_to_use}: {prompt[:50]}...")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Multimodal content support for streaming
        images = kwargs.get("images")
        if images:
            user_content = [{"type": "text", "text": prompt}]
            for img_data in images:
                if not isinstance(img_data, str):
                    continue
                img_data = img_data.strip()
                if img_data.startswith("data:"):
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": img_data}}
                    )
                elif img_data.startswith("http://") or img_data.startswith("https://"):
                    user_content.append(
                        {"type": "image_url", "image_url": {"url": img_data}}
                    )
                else:
                    user_content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img_data}"},
                        }
                    )
            messages.append({"role": "user", "content": user_content})
        else:
            messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model_to_use,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "top_p": kwargs.get("top_p", self.config.top_p),
            "stream": True,
        }

        try:
            async with self.client.stream(
                "POST", "/chat/completions", json=payload
            ) as response:
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
        **kwargs,
    ) -> LLMResponse:
        """
        Chat voi full message history

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."}
            system_prompt: System prompt (optional)

        Returns:
            LLMResponse
        """
        model_to_use = self._normalize_model_name(kwargs.get("model", self.model))
        formatted_messages = []

        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            formatted_messages.append(
                {"role": msg.get("role", "user"), "content": msg.get("content", "")}
            )

        payload = {
            "model": model_to_use,
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
                    "total_tokens": usage.get("total_tokens", 0),
                },
                finish_reason=data.get("choices", [{}])[0].get("finish_reason", "stop"),
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
            response = await self.generate(prompt="Hello", max_tokens=5)
            return {
                "status": "success",
                "model": self.model,
                "response_length": len(response.content),
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}


# ============================================================
# FACTORY FUNCTIONS
# ============================================================


def create_llm_client(config: Optional[LLMConfig] = None) -> BaseLLMClient:
    """
    Factory function to create LLM client

    Args:
        config: LLMConfig (optional, will load from settings if None)

    Returns:
        LLM client instance (OpenRouterClient)
    """
    from app.config.settings import settings

    if config is None:
        config = LLMConfig(
            provider="openrouter",
            model=getattr(settings, "OPENROUTER_MODEL", "google/gemini-2.5-flash-lite"),
            api_key=getattr(settings, "OPENROUTER_API_KEY", ""),
            temperature=0.7,
            max_tokens=2000,
        )

    provider = config.provider.lower()

    if provider == "openrouter":
        return OpenRouterClient(config)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}. Supported: openrouter")


async def create_llm_client_from_db(
    db_session,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> BaseLLMClient:
    """
    Async factory function to create LLM client from DB settings

    Args:
        db_session: Async DB session to load settings from SystemSettings table
        provider_override: Override provider selection ("openrouter")
        model_override: Override model selection

    Returns:
        LLM client instance (OpenRouterClient)
    """
    from app.api.routes.settings import get_setting

    provider = (provider_override or "openrouter").lower()
    logger.info(
        f"Creating LLM client: provider={provider}, model_override={model_override}"
    )

    openrouter_api_key = await get_setting("OPENROUTER_API_KEY", db_session)

    if not openrouter_api_key:
        raise ValueError(
            "Không tìm thấy OPENROUTER_API_KEY. "
            "Vui lòng cấu hình OPENROUTER_API_KEY trong Settings."
        )

    model = (
        model_override
        or await get_setting("OPENROUTER_DEFAULT_MODEL", db_session)
        or "google/gemini-2.5-flash-lite"
    )
    fallback_model = (
        await get_setting("OPENROUTER_FALLBACK_MODEL", db_session)
        or "meta-llama/llama-3.3-70b-instruct"
    )

    config = LLMConfig(
        provider="openrouter",
        model=model,
        fallback_model=fallback_model,
        api_key=openrouter_api_key,
        temperature=0.7,
        max_tokens=2000,
    )
    logger.info(f"Using OpenRouter: model={model}")
    return OpenRouterClient(config)


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_llm_client: Optional[BaseLLMClient] = None
_llm_client_from_db: Optional[BaseLLMClient] = None
_llm_client_db_key: Optional[str] = None


async def get_llm_client_from_db(db) -> BaseLLMClient:
    """Get LLM client from DB settings with caching."""
    global _llm_client_from_db, _llm_client_db_key

    from app.api.routes.settings import get_setting

    api_key = await get_setting("OPENROUTER_API_KEY", db)
    model = await get_setting("OPENROUTER_DEFAULT_MODEL", db)
    fallback = await get_setting("OPENROUTER_FALLBACK_MODEL", db)

    cache_key = f"{api_key}:{model}:{fallback}"

    if _llm_client_from_db is None or _llm_client_db_key != cache_key:
        _llm_client_from_db = create_llm_client(
            LLMConfig(
                provider="openrouter",
                model=model or "google/gemini-2.5-flash-lite",
                fallback_model=fallback or "meta-llama/llama-3.3-70b-instruct",
                api_key=api_key or "",
                temperature=0.7,
                max_tokens=2000,
            )
        )
        _llm_client_db_key = cache_key
        logger.info(f"LLM client (DB) cached: model={model}")

    return _llm_client_from_db


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


async def close_llm_client():
    """Cleanup LLM client resources during shutdown."""
    global _llm_client, _llm_client_from_db, _llm_client_db_key

    clients_to_close = []
    if _llm_client is not None:
        clients_to_close.append(("default", _llm_client))
    if _llm_client_from_db is not None and _llm_client_from_db is not _llm_client:
        clients_to_close.append(("db", _llm_client_from_db))

    for client_name, client in clients_to_close:
        close_method = getattr(client, "close", None)
        if close_method is None:
            continue
        try:
            logger.info(f"Cleaning up {client_name} LLM client resources...")
            await close_method()
        except Exception as e:
            logger.error(f"Error during {client_name} LLM client cleanup: {e}")

    _llm_client = None
    _llm_client_from_db = None
    _llm_client_db_key = None


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
    "create_llm_client",
    "create_llm_client_from_db",
    "get_llm_client",
    "get_llm_client_from_db",
    "reset_llm_client",
    "close_llm_client",
]
