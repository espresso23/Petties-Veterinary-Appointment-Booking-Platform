"""
PETTIES AGENT SERVICE - Settings API Routes

Endpoints for admin to configure API keys and settings via Dashboard.
Settings are stored in PostgreSQL system_settings table.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
import logging

from app.db.postgres.session import get_db
from app.db.postgres.models import (
    SystemSetting,
    DEFAULT_SETTINGS,
    SettingCategory,
    normalize_setting_category,
)
from app.api.middleware.auth import get_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


# ===== SCHEMAS =====


class SettingResponse(BaseModel):
    key: str
    value: str  # Masked if sensitive
    category: str
    is_sensitive: bool
    description: Optional[str]


class SettingUpdate(BaseModel):
    value: str


class SettingCreate(BaseModel):
    key: str
    value: str
    category: str = "general"
    is_sensitive: bool = False
    description: Optional[str] = None


class TestResult(BaseModel):
    status: str
    message: str
    details: Optional[dict] = None


# ===== HELPER FUNCTIONS =====


def mask_value(value: str, is_sensitive: bool) -> str:
    """Mask sensitive values, show only last 4 chars"""
    if not is_sensitive or not value:
        return value
    if len(value) <= 4:
        return "****"
    return f"****{value[-4:]}"


from app.core.config_helper import get_setting as _get_setting
from app.core.embeddings.jina_image_embeddings import (
    JINA_EMBEDDINGS_ENDPOINT,
    DEFAULT_JINA_IMAGE_MODEL,
    EXPECTED_IMAGE_DIMENSION,
)


# Keep the same signature for compatibility within this file
async def get_setting(key: str, db: AsyncSession = None) -> Optional[str]:
    return await _get_setting(key, db)


async def init_default_settings(db: AsyncSession):
    """Initialize default settings if not exist"""
    for setting_data in DEFAULT_SETTINGS:
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == setting_data["key"])
        )
        if not result.scalar_one_or_none():
            setting = SystemSetting(
                key=setting_data["key"],
                value=setting_data["value"],
                category=normalize_setting_category(setting_data["category"]),
                is_sensitive=setting_data["is_sensitive"],
                description=setting_data.get("description"),
            )
            db.add(setting)
    await db.commit()


# ===== ROUTES =====


@router.get("", response_model=List[SettingResponse])
async def list_settings(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    """List all settings (admin only). Sensitive values are masked."""
    query = select(SystemSetting)
    if category:
        query = query.where(
            SystemSetting.category == normalize_setting_category(category)
        )

    result = await db.execute(query)
    settings = result.scalars().all()

    return [
        SettingResponse(
            key=s.key,
            value=mask_value(s.value, s.is_sensitive),
            category=s.category or "general",
            is_sensitive=s.is_sensitive,
            description=s.description,
        )
        for s in settings
    ]


@router.get("/{key}", response_model=SettingResponse)
async def get_setting_by_key(
    key: str, db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """Get single setting by key"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()

    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

    return SettingResponse(
        key=setting.key,
        value=mask_value(setting.value, setting.is_sensitive),
        category=setting.category or "general",
        is_sensitive=setting.is_sensitive,
        description=setting.description,
    )


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    """Update setting value (admin only) - auto-create if not exists"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()

    if not setting:
        setting = SystemSetting(
            key=key,
            value=data.value,
            category=SettingCategory.GENERAL,
            is_sensitive=True,
            description=f"Auto-created setting: {key}",
        )
        db.add(setting)
        logger.info(f"Setting '{key}' auto-created")
    else:
        setting.value = data.value
        logger.info(f"Setting '{key}' updated")

    await db.commit()
    await db.refresh(setting)

    return SettingResponse(
        key=setting.key,
        value=mask_value(setting.value, setting.is_sensitive),
        category=setting.category or "general",
        is_sensitive=setting.is_sensitive,
        description=setting.description,
    )


@router.post("/init")
async def initialize_settings(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """Initialize default settings"""
    await init_default_settings(db)
    return {"status": "success", "message": "Default settings initialized"}


@router.post("/seed", summary="Seed database (Single Agent, tools, settings)")
async def seed_database(
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    """
    Seed database voi Single Agent architecture

    Changes from Multi-Agent:
    - Chi tao 1 agent (petties_agent) thay vi 4 agents
    - Su dung OpenRouter Cloud API
    - Tools duoc quan ly toan cuc cho single agent

    Args:
        force: Neu True, seed lai du da co data

    Returns:
        Status message voi so luong agents/tools da seed
    """
    try:
        from app.core.tools.scanner import tool_scanner
        from app.db.postgres.seed import seed_data

        results = await seed_data(db, force=force)
        scan_result = await tool_scanner.scan_and_sync_tools()

        return {
            "status": "success",
            "message": "Database seeded successfully with Single Agent architecture",
            "results": results,
            "tool_scan": scan_result,
        }

    except Exception as e:
        logger.error(f"Seed error: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ===== TEST ENDPOINTS =====


@router.post("/test-qdrant", response_model=TestResult)
async def test_qdrant_connection(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """Test Qdrant connection"""
    qdrant_url = await get_setting("QDRANT_URL", db) or "http://localhost:6333"
    api_key = await get_setting("QDRANT_API_KEY", db)

    try:
        headers = {"api-key": api_key} if api_key else {}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{qdrant_url}/collections", headers=headers)
            if response.status_code == 200:
                data = response.json()
                collections = [
                    c["name"] for c in data.get("result", {}).get("collections", [])
                ]
                return TestResult(
                    status="success",
                    message="Connected to Qdrant",
                    details={"collections": collections},
                )
            return TestResult(status="error", message=f"HTTP {response.status_code}")
    except Exception as e:
        return TestResult(status="error", message=str(e))


@router.post("/test-openrouter", response_model=TestResult)
async def test_openrouter_connection(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """
    Test OpenRouter Cloud API connection

    Verifies:
    - API key is valid
    - Can connect to OpenRouter
    - Can generate simple completion
    """
    api_key = await get_setting("OPENROUTER_API_KEY", db)

    if not api_key:
        return TestResult(
            status="error",
            message="OpenRouter API key not configured. Set OPENROUTER_API_KEY in settings.",
        )

    # Get configured model or fallback default
    model = (
        await get_setting("OPENROUTER_DEFAULT_MODEL", db)
        or "google/gemini-2.5-flash-lite"
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://petties.world",
                    "X-Title": "Petties AI",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 10,
                },
            )

            if response.status_code == 200:
                data = response.json()
                model = data.get("model", "unknown")
                return TestResult(
                    status="success",
                    message="OpenRouter API connected successfully",
                    details={"model": model, "provider": "openrouter"},
                )
            else:
                try:
                    error_data = response.json()
                    # OpenRouter error structure can vary
                    if "error" in error_data:
                        if isinstance(error_data["error"], dict):
                            error_msg = error_data["error"].get(
                                "message", str(error_data["error"])
                            )
                        else:
                            error_msg = str(error_data["error"])
                    else:
                        error_msg = str(error_data)
                except:
                    error_msg = response.text

                return TestResult(
                    status="error",
                    message=f"OpenRouter Error ({response.status_code}): {error_msg}",
                    details={"status_code": response.status_code},
                )

    except Exception as e:
        logger.error(f"OpenRouter test error: {e}")
        return TestResult(status="error", message=str(e))


@router.post("/test-cohere", response_model=TestResult)
async def test_cohere_embeddings(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """
    Test Cohere Embeddings API connection

    Verifies:
    - API key is valid
    - Can generate embeddings with embed-multilingual-v3.0
    - Returns embedding dimension (1024)
    """
    api_key = await get_setting("COHERE_API_KEY", db)

    if not api_key:
        return TestResult(
            status="error",
            message="Cohere API key not configured. Set COHERE_API_KEY in settings.",
        )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.cohere.ai/v1/embed",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "embed-multilingual-v3.0",
                    "texts": ["Xin chao, day la test embedding tieng Viet"],
                    "input_type": "search_query",
                },
            )

            if response.status_code == 200:
                data = response.json()
                embeddings = data.get("embeddings", [])
                dimension = len(embeddings[0]) if embeddings else 0
                return TestResult(
                    status="success",
                    message="Cohere embeddings working",
                    details={
                        "model": "embed-multilingual-v3.0",
                        "dimension": dimension,
                        "provider": "cohere",
                    },
                )
            else:
                error_data = response.json()
                error_msg = error_data.get("message", "Unknown error")
                return TestResult(
                    status="error",
                    message=f"Cohere API error: {error_msg}",
                    details={"status_code": response.status_code},
                )

    except Exception as e:
        logger.error(f"Cohere test error: {e}")
        return TestResult(status="error", message=str(e))


@router.post("/test-jina", response_model=TestResult)
async def test_jina_image_embeddings(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """
    Test Jina Image Embeddings API connection (jina-clip-v2).

    Verifies:
    - JINA_API_KEY is configured
    - Can call Jina embeddings endpoint
    - Embedding dimension khớp EXPECTED_IMAGE_DIMENSION (1024)
    """
    api_key = await get_setting("JINA_API_KEY", db)
    if not api_key:
        return TestResult(
            status="error",
            message="JINA_API_KEY chưa được cấu hình. Hãy thiết lập trong Admin Settings.",
        )

    model = await get_setting("JINA_IMAGE_EMBED_MODEL", db) or DEFAULT_JINA_IMAGE_MODEL

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            payload = {
                "model": model,
                "input": ["test"],
                "normalized": True,
                "embedding_type": "float",
            }
            response = await client.post(
                JINA_EMBEDDINGS_ENDPOINT,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )

            if response.status_code == 200:
                data = response.json()
                embeddings = data.get("data", [])
                dim = (
                    len(embeddings[0].get("embedding", []))
                    if embeddings and isinstance(embeddings[0].get("embedding"), list)
                    else 0
                )
                if dim != EXPECTED_IMAGE_DIMENSION:
                    return TestResult(
                        status="error",
                        message=(
                            f"Jina embeddings trả về dim={dim}, "
                            f"nhưng Case Memory đang cấu hình {EXPECTED_IMAGE_DIMENSION}. "
                            "Hãy kiểm tra lại model JINA_IMAGE_EMBED_MODEL."
                        ),
                        details={
                            "dimension": dim,
                            "expected": EXPECTED_IMAGE_DIMENSION,
                        },
                    )

                return TestResult(
                    status="success",
                    message="Kết nối Jina Image Embeddings thành công",
                    details={"model": model, "dimension": dim},
                )

            try:
                error_data = response.json()
                error_msg = error_data.get("message") or str(error_data)
            except Exception:
                error_msg = response.text

            return TestResult(
                status="error",
                message=f"Jina API error ({response.status_code}): {error_msg}",
                details={"status_code": response.status_code},
            )

    except Exception as e:
        logger.error(f"Jina test error: {e}")
        return TestResult(status="error", message=str(e))


@router.post("/test-tavily", response_model=TestResult)
async def test_tavily_connection(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
):
    """
    Test Tavily Web Search API connection.

    Verifies:
    - TAVILY_API_KEY is configured
    - Can connect to Tavily API
    - Can perform search query
    """
    api_key = await get_setting("TAVILY_API_KEY", db)

    if not api_key:
        return TestResult(
            status="error",
            message="TAVILY_API_KEY chưa được cấu hình. Hãy thiết lập trong Admin Settings.",
        )

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=api_key)
        response = client.search(
            query="dog health",
            max_results=3,
            include_answer=False,
            include_raw_content=False,
        )

        results = response.get("results", [])

        if results:
            return TestResult(
                status="success",
                message=f"Kết nối Tavily thành công! Tìm thấy {len(results)} kết quả.",
                details={
                    "results_count": len(results),
                    "sample_title": results[0].get("title", "")[:50],
                },
            )
        else:
            return TestResult(
                status="warning",
                message="Kết nối Tavily thành công nhưng không tìm thấy kết quả nào.",
            )

    except Exception as e:
        logger.error(f"Tavily test error: {e}")
        return TestResult(status="error", message=str(e))
