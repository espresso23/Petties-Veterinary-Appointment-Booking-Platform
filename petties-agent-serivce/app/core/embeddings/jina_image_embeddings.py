"""
Jina Image Embeddings Client

Embed ảnh (URL hoặc base64) sang vector dùng Jina Embeddings API (jina-clip-v2).

Package: app.core.embeddings
Purpose: Cung cấp hàm tiện ích embed ảnh để dùng trong Case Memory.
Version: v1.1.0 (Optimized with Retry & Cache)
"""

from __future__ import annotations

import asyncio
import time
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from loguru import logger

from app.db.postgres.session import AsyncSessionLocal
from app.core.config_helper import get_setting

# ============================================================
# CONSTANTS
# ============================================================

JINA_EMBEDDINGS_ENDPOINT = "https://api.jina.ai/v1/embeddings"
DEFAULT_JINA_IMAGE_MODEL = "jina-clip-v2"
"""Jina CLIP v2 trả về 1024 dim. Phải khớp với Qdrant collection."""

EXPECTED_IMAGE_DIMENSION = 1024

"""Jina batch size - an toàn hơn ở mức 50 để tránh timeout/413 với ảnh thực tế."""
JINA_BATCH_SIZE = 50

"""TTL cho config cache (seconds)."""
CONFIG_CACHE_TTL = 300

# ============================================================
# STATE (CACHE)
# ============================================================

_config_cache: Optional[dict] = None
_config_cache_time: float = 0.0


# ============================================================
# INTERNAL HELPERS
# ============================================================


async def _get_jina_config() -> Optional[dict]:
    """Lấy API key và model từ system_settings với cơ chế caching."""
    global _config_cache, _config_cache_time

    # Trả về cache nếu chưa hết hạn
    if _config_cache and (time.monotonic() - _config_cache_time) < CONFIG_CACHE_TTL:
        return _config_cache

    try:
        async with AsyncSessionLocal() as db:
            api_key = await get_setting("JINA_API_KEY", db)
            model = (
                await get_setting("JINA_IMAGE_EMBED_MODEL", db)
                or DEFAULT_JINA_IMAGE_MODEL
            )

        if not api_key:
            logger.warning(
                "[jina_image_embeddings] JINA_API_KEY not configured. "
                "Image embeddings will be disabled."
            )
            return None

        # Cập nhật cache
        _config_cache = {"api_key": api_key, "model": model}
        _config_cache_time = time.monotonic()
        return _config_cache

    except Exception as e:
        logger.error(f"[jina_image_embeddings] Failed to fetch config from DB: {e}")
        return None


def _validate_embedding(emb: list, index: int) -> Optional[List[float]]:
    """Validate embedding dimension (1024). Trả về None nếu sai dim."""
    if not isinstance(emb, list):
        return None
    if len(emb) != EXPECTED_IMAGE_DIMENSION:
        logger.warning(
            "[jina_image_embeddings] Embedding index=%s has dim=%s, expected %s. Skipping.",
            index,
            len(emb),
            EXPECTED_IMAGE_DIMENSION,
        )
        return None
    return emb


# ============================================================
# PUBLIC API
# ============================================================


async def embed_image_urls(urls: List[str]) -> List[List[float]]:
    """
    Embed danh sách URL ảnh sang vector bằng Jina API.
    Hỗ trợ retry 429/503 và caching config.
    """
    if not urls:
        return []

    config = await _get_jina_config()
    if not config:
        return []

    # Filter và validate URLs (hỗ trợ cả http và https cho dev)
    inputs: List[dict] = []
    for url in urls:
        if not isinstance(url, str):
            continue
        url = url.strip()
        if not url:
            continue
        parsed = urlparse(url)
        if parsed.scheme.lower() not in ("https", "http"):
            continue
        inputs.append({"url": url})

    if not inputs:
        logger.debug(
            "[jina_image_embeddings] No valid URLs after filtering (%s input)", len(urls)
        )
        return []

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    all_embeddings: List[List[float]] = []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for batch_start in range(0, len(inputs), JINA_BATCH_SIZE):
                batch = inputs[batch_start : batch_start + JINA_BATCH_SIZE]
                payload = {
                    "model": config["model"],
                    "input": batch,
                    "normalized": True,
                    "embedding_type": "float",
                }

                # Retry với exponential backoff cho 429/503
                last_resp = None
                for attempt in range(3):
                    try:
                        resp = await client.post(
                            JINA_EMBEDDINGS_ENDPOINT, json=payload, headers=headers
                        )
                        resp.raise_for_status()
                        last_resp = resp
                        break
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code in (429, 503) and attempt < 2:
                            wait = 2**attempt
                            logger.warning(
                                "[jina_image_embeddings] Rate limited (status=%s), retry in %ss",
                                e.response.status_code,
                                wait,
                            )
                            await asyncio.sleep(wait)
                            continue
                        raise

                if not last_resp:
                    continue

                data = last_resp.json()
                for i, item in enumerate(data.get("data", [])):
                    validated = _validate_embedding(
                        item.get("embedding"), batch_start + i
                    )
                    if validated is not None:
                        all_embeddings.append(validated)

        logger.info(
            "[jina_image_embeddings] Created %s embeddings from %s URLs (batches=%s)",
            len(all_embeddings),
            len(inputs),
            (len(inputs) + JINA_BATCH_SIZE - 1) // JINA_BATCH_SIZE,
        )
        return all_embeddings

    except httpx.HTTPStatusError as e:
        logger.error(
            "[jina_image_embeddings] HTTP error: status=%s body=%s",
            e.response.status_code,
            (e.response.text or "")[:200],
        )
        return []
    except Exception as e:
        logger.error("[jina_image_embeddings] Failed: %s", e, exc_info=True)
        return []


async def embed_image_base64(base64_strings: List[str]) -> List[List[float]]:
    """
    Embed danh sách base64 ảnh sang vector bằng Jina API.
    Giống embed_image_urls nhưng truyền data URL format.
    """
    if not base64_strings:
        return []

    config = await _get_jina_config()
    if not config:
        return []

    # Chuẩn hóa input thành data URL format
    inputs: List[dict] = []
    for bs in base64_strings:
        if not isinstance(bs, str):
            continue
        bs = bs.strip()
        if not bs:
            continue

        if bs.startswith("data:"):
            inputs.append({"url": bs})
        else:
            inputs.append({"url": f"data:image/jpeg;base64,{bs}"})

    if not inputs:
        return []

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    all_embeddings: List[List[float]] = []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for batch_start in range(0, len(inputs), JINA_BATCH_SIZE):
                batch = inputs[batch_start : batch_start + JINA_BATCH_SIZE]
                payload = {
                    "model": config["model"],
                    "input": batch,
                    "normalized": True,
                    "embedding_type": "float",
                }

                # Retry logic
                last_resp = None
                for attempt in range(3):
                    try:
                        resp = await client.post(
                            JINA_EMBEDDINGS_ENDPOINT, json=payload, headers=headers
                        )
                        resp.raise_for_status()
                        last_resp = resp
                        break
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code in (429, 503) and attempt < 2:
                            wait = 2**attempt
                            await asyncio.sleep(wait)
                            continue
                        raise

                if not last_resp:
                    continue

                data = last_resp.json()
                for i, item in enumerate(data.get("data", [])):
                    validated = _validate_embedding(
                        item.get("embedding"), batch_start + i
                    )
                    if validated is not None:
                        all_embeddings.append(validated)

        logger.info(
            "[jina_image_embeddings] Created %s base64 embeddings", len(all_embeddings)
        )
        return all_embeddings

    except Exception as e:
        logger.error(f"[jina_image_embeddings] Base64 failure: {e}")
        return []


__all__ = [
    "embed_image_urls",
    "embed_image_base64",
    "JINA_EMBEDDINGS_ENDPOINT",
    "DEFAULT_JINA_IMAGE_MODEL",
    "EXPECTED_IMAGE_DIMENSION",
    "JINA_BATCH_SIZE",
]
