"""
Jina Image Embeddings Client

Embed áº£nh (URL hoáº·c base64) sang vector dÃ¹ng Jina Embeddings API (jina-clip-v2).

Package: app.core.embeddings
Purpose: Cung cáº¥p hÃ m tiá»‡n Ã­ch embed áº£nh Ä‘á»ƒ dÃ¹ng trong Case Memory.
Version: v1.1.0 (Optimized with Retry & Cache)
"""

from __future__ import annotations

import asyncio
import base64
import binascii
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
"""Jina CLIP v2 tráº£ vá» 1024 dim. Pháº£i khá»›p vá»›i Qdrant collection."""

EXPECTED_IMAGE_DIMENSION = 1024

"""Jina batch size - an toÃ n hÆ¡n á»Ÿ má»©c 50 Ä‘á»ƒ trÃ¡nh timeout/413 vá»›i áº£nh thá»±c táº¿."""
JINA_BATCH_SIZE = 50

"""TTL cho config cache (seconds)."""
CONFIG_CACHE_TTL = 300
JINA_BASE64_BATCH_SIZE = 10

# ============================================================
# STATE (CACHE)
# ============================================================

_config_cache: Optional[dict] = None
_config_cache_time: float = 0.0


# ============================================================
# INTERNAL HELPERS
# ============================================================


async def _get_jina_config() -> Optional[dict]:
    """Láº¥y API key vÃ  model tá»« system_settings vá»›i cÆ¡ cháº¿ caching."""
    global _config_cache, _config_cache_time

    # Tráº£ vá» cache náº¿u chÆ°a háº¿t háº¡n
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

        # Cáº­p nháº­t cache
        _config_cache = {"api_key": api_key, "model": model}
        _config_cache_time = time.monotonic()
        return _config_cache

    except Exception as e:
        logger.error(f"[jina_image_embeddings] Failed to fetch config from DB: {e}")
        return None


def _validate_embedding(emb: list, index: int) -> Optional[List[float]]:
    """Validate embedding dimension (1024). Tráº£ vá» None náº¿u sai dim."""
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


def _normalize_base64_input(value: str) -> Optional[str]:
    """Normalize base64 input to data URL format and validate payload."""
    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None

    if raw.startswith("data:"):
        if "," not in raw:
            return None
        header, payload = raw.split(",", 1)
        header = header.strip()
        payload = "".join(payload.split())
        if ";base64" not in header.lower():
            return None
        try:
            base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError):
            return None
        return f"{header},{payload}"

    payload = "".join(raw.split())
    try:
        base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None
    return f"data:image/jpeg;base64,{payload}"


# ============================================================
# PUBLIC API
# ============================================================


async def embed_image_urls(urls: List[str]) -> List[List[float]]:
    """
    Embed danh sÃ¡ch URL áº£nh sang vector báº±ng Jina API.
    Há»— trá»£ retry 429/503 vÃ  caching config.
    """
    if not urls:
        return []

    config = await _get_jina_config()
    if not config:
        return []

    # Filter vÃ  validate URLs (há»— trá»£ cáº£ http vÃ  https cho dev)
    inputs: List[str] = []
    for url in urls:
        if not isinstance(url, str):
            continue
        url = url.strip()
        if not url:
            continue
        parsed = urlparse(url)
        if parsed.scheme.lower() not in ("https", "http", "data"):
            continue
        inputs.append(url)

    if not inputs:
        logger.debug(
            "[jina_image_embeddings] No valid URLs after filtering (%s input)",
            len(urls),
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
                }

                # Retry vá»›i exponential backoff cho 429/503
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

    inputs: List[str] = []
    invalid_count = 0
    for bs in base64_strings:
        normalized = _normalize_base64_input(bs)
        if normalized is None:
            invalid_count += 1
            continue
        inputs.append(normalized)

    if invalid_count > 0:
        logger.warning(
            "[jina_image_embeddings] Dropped %s invalid base64 inputs before API call",
            invalid_count,
        )

    if not inputs:
        return []

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    all_embeddings: List[List[float]] = []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for batch_start in range(0, len(inputs), JINA_BASE64_BATCH_SIZE):
                batch = inputs[batch_start : batch_start + JINA_BASE64_BATCH_SIZE]
                payload = {
                    "model": config["model"],
                    "input": batch,
                }

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
                        logger.error(
                            "[jina_image_embeddings] HTTP error: %s - %s",
                            e.response.status_code,
                            (e.response.text or "")[:500],
                        )

                        if e.response.status_code == 400:
                            logger.warning(
                                "[jina_image_embeddings] Batch 400 at [%s..%s], fallback to single-item mode",
                                batch_start,
                                batch_start + len(batch) - 1,
                            )
                            for offset, single_input in enumerate(batch):
                                single_payload = {
                                    "model": config["model"],
                                    "input": [single_input],
                                }
                                try:
                                    single_resp = await client.post(
                                        JINA_EMBEDDINGS_ENDPOINT,
                                        json=single_payload,
                                        headers=headers,
                                    )
                                    single_resp.raise_for_status()
                                    single_data = single_resp.json()
                                    data_items = single_data.get("data", [])
                                    if not data_items:
                                        continue
                                    validated = _validate_embedding(
                                        data_items[0].get("embedding"),
                                        batch_start + offset,
                                    )
                                    if validated is not None:
                                        all_embeddings.append(validated)
                                except Exception as single_error:
                                    logger.warning(
                                        "[jina_image_embeddings] Skip invalid base64 item index=%s: %s",
                                        batch_start + offset,
                                        single_error,
                                    )
                            last_resp = None
                            break

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
            "[jina_image_embeddings] Created %s base64 embeddings from %s valid inputs",
            len(all_embeddings),
            len(inputs),
        )
        return all_embeddings

    except Exception as e:
        logger.error(f"[jina_image_embeddings] Base64 failure: {e}")
        try:
            resp = getattr(e, "response", None)
            if resp:
                logger.error(
                    f"[jina_image_embeddings] Response: {resp.status_code} - {resp.text[:500]}"
                )
        except Exception:
            pass
        return []


__all__ = [
    "embed_image_urls",
    "embed_image_base64",
    "JINA_EMBEDDINGS_ENDPOINT",
    "DEFAULT_JINA_IMAGE_MODEL",
    "EXPECTED_IMAGE_DIMENSION",
    "JINA_BATCH_SIZE",
    "JINA_BASE64_BATCH_SIZE",
]

