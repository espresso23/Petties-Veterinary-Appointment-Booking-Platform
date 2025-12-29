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
from app.db.postgres.models import SystemSetting, SettingCategory, DEFAULT_SETTINGS
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
                category=SettingCategory(setting_data["category"]),
                is_sensitive=setting_data["is_sensitive"],
                description=setting_data.get("description")
            )
            db.add(setting)
    await db.commit()


# ===== ROUTES =====

@router.get("", response_model=List[SettingResponse])
async def list_settings(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """List all settings (admin only). Sensitive values are masked."""
    query = select(SystemSetting)
    if category:
        query = query.where(SystemSetting.category == category)
    
    result = await db.execute(query)
    settings = result.scalars().all()
    
    return [
        SettingResponse(
            key=s.key,
            value=mask_value(s.value, s.is_sensitive),
            category=s.category.value if s.category else "general",
            is_sensitive=s.is_sensitive,
            description=s.description
        )
        for s in settings
    ]


@router.get("/{key}", response_model=SettingResponse)
async def get_setting_by_key(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """Get single setting by key"""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    
    return SettingResponse(
        key=setting.key,
        value=mask_value(setting.value, setting.is_sensitive),
        category=setting.category.value if setting.category else "general",
        is_sensitive=setting.is_sensitive,
        description=setting.description
    )


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """Update setting value (admin only)"""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    
    setting.value = data.value
    await db.commit()
    await db.refresh(setting)
    
    logger.info(f"Setting '{key}' updated")
    
    return SettingResponse(
        key=setting.key,
        value=mask_value(setting.value, setting.is_sensitive),
        category=setting.category.value if setting.category else "general",
        is_sensitive=setting.is_sensitive,
        description=setting.description
    )


@router.post("/init")
async def initialize_settings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """Initialize default settings"""
    await init_default_settings(db)
    return {"status": "success", "message": "Default settings initialized"}


@router.post("/seed", summary="Seed database (Single Agent, tools, settings)")
async def seed_database(
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """
    Seed database voi Single Agent architecture

    Changes from Multi-Agent:
    - Chi tao 1 agent (petties_agent) thay vi 4 agents
    - Su dung OpenRouter model thay vi Ollama
    - Tools duoc assign cho petties_agent

    Args:
        force: Neu True, seed lai du da co data

    Returns:
        Status message voi so luong agents/tools da seed
    """
    try:
        from app.db.postgres.models import (
            Agent, Tool, SystemSetting,
            SettingCategory, DEFAULT_SETTINGS, PromptVersion
        )
        from sqlalchemy import select, delete
        from pathlib import Path

        # Templates directory
        templates_dir = Path(__file__).parent.parent.parent / "core" / "prompts" / "templates"

        def load_template(agent_name: str) -> str:
            """Load template file"""
            template_path = templates_dir / f"{agent_name}.txt"
            try:
                if template_path.exists():
                    return template_path.read_text(encoding="utf-8").strip()
            except Exception as e:
                logger.warning(f"Failed to load template {agent_name}: {e}")
            return ""

        results = {
            "system_settings": 0,
            "agents": 0,
            "tools": 0
        }

        # 1. Seed system settings
        if force:
            await db.execute(delete(SystemSetting))

        existing_settings = await db.execute(select(SystemSetting))
        if not existing_settings.scalars().first() or force:
            settings = []
            for setting_data in DEFAULT_SETTINGS:
                setting = SystemSetting(
                    key=setting_data["key"],
                    value=setting_data["value"],
                    category=SettingCategory(setting_data["category"]),
                    is_sensitive=setting_data["is_sensitive"],
                    description=setting_data["description"]
                )
                settings.append(setting)
            db.add_all(settings)
            results["system_settings"] = len(settings)
            logger.info(f"Seeded {len(settings)} system settings")

        # 2. Seed Single Agent (thay vi 4 Multi-Agents)
        if force:
            await db.execute(delete(PromptVersion))
            await db.execute(delete(Agent))

        existing_agents = await db.execute(select(Agent))
        if not existing_agents.scalars().first() or force:
            # Load prompt tu template hoac dung default
            single_agent_prompt = load_template("single_agent") or load_template("main_agent")

            # Fallback prompt cho Single Agent + ReAct
            if not single_agent_prompt:
                single_agent_prompt = """Ban la Petties AI Assistant - tro ly AI chuyen ve cham soc thu cung.

## NHIEM VU
- Tu van suc khoe thu cung, chan doan so bo dua tren trieu chung
- Ho tro dat lich kham tai phong kham thu y
- Tim kiem thong tin ve cham soc thu cung, san pham, dich vu
- Tra loi cac cau hoi ve thu cung bang tieng Viet than thien

## QUY TAC CHINH
1. Luon tra loi bang tieng Viet, than thien va de hieu
2. Khi can thong tin y te, PHAI su dung tool tra cuu knowledge base
3. Khong dua ra chan doan cuoi cung - luon khuyen khich gap bac si thu y
4. Uu tien an toan va suc khoe cua thu cung

## NGUYEN TAC DUNG (CRITICAL)
- CHI GOI TOOL TOI DA 1-2 LAN cho moi cau hoi
- Sau khi nhan Observation co thong tin huu ich, PHAI chuyen sang Final Answer
- KHONG tim kiem them neu da co ket qua tot. Mot ket qua co thong tin la DU de tra loi
- KHONG su dung nhieu tool khac nhau cho cung mot cau hoi. Chon MOT tool phu hop nhat
- Neu tool tra ve loi, DUNG LAI va thong bao cho user, KHONG thu lai voi tool khac

## QUY TAC VANG
- Tuyet doi khong goi cung mot tool voi tham so tuong tu qua 1 lan
- Neu Observation da co thong tin, DU KHONG HOAN HAO, van phai dung no de tra loi
- KHONG lap lai hanh dong cu hoac thu nhieu cach khac nhau

## LUU Y VE TOOL INPUT
- KHONG duoc viet "Tool: Khong" hoac "Tool: None"
- Neu khong can goi tool, di thang den Final Answer
- Tool Input PHAI la JSON hop le voi day du tham so required"""

            # Create Single Agent
            single_agent = Agent(
                name="petties_agent",
                description="Petties AI Assistant - Single Agent voi ReAct pattern",
                temperature=0.7,
                max_tokens=2000,
                top_p=0.9,
                model="google/gemini-2.0-flash-exp:free",  # OpenRouter model
                system_prompt=single_agent_prompt,
                enabled=True
            )

            db.add(single_agent)
            results["agents"] = 1
            logger.info("Seeded 1 Single Agent (petties_agent)")

        # 3. Seed tools cho Single Agent (chi 2 RAG tools)
        existing_tools = await db.execute(select(Tool))
        if not existing_tools.scalars().first() or force:
            if force:
                await db.execute(delete(Tool))

            # Chi seed 2 RAG-based tools
            # Cac tools khac (booking, clinic search) se duoc add sau khi co API integration
            tools = [
                Tool(
                    name="pet_care_qa",
                    description="""Tim kiem kien thuc cham soc thu cung tu knowledge base (RAG Q&A).

Su dung tool nay khi user hoi cac cau hoi ve:
- Cach cham soc thu cung (cho an, tam rua, tap luyen)
- Thong tin ve giong loai
- Dieu tri benh thuong gap
- Dinh duong va thuc pham

Tool nay su dung Cohere embeddings + Qdrant vector search de tim kiem
trong knowledge base da duoc upload boi Admin.""",
                    tool_type="code_based",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Cau hoi hoac tu khoa tim kiem (tieng Viet hoac English)"
                            },
                            "top_k": {
                                "type": "integer",
                                "description": "So luong ket qua tra ve (default: 5)",
                                "default": 5
                            },
                            "min_score": {
                                "type": "number",
                                "description": "Diem tuong dong toi thieu (default: 0.5)",
                                "default": 0.5
                            }
                        },
                        "required": ["query"]
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "results": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "content": {"type": "string"},
                                        "score": {"type": "number"},
                                        "source": {"type": "string"},
                                        "chunk_index": {"type": "integer"}
                                    }
                                }
                            },
                            "answer": {"type": "string"},
                            "sources_used": {"type": "integer"}
                        }
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"]
                ),
                Tool(
                    name="symptom_search",
                    description="""Tim benh dua tren trieu chung su dung RAG (Symptom Checker).

Su dung tool nay khi user mo ta trieu chung cua thu cung:
- Thu cung bi sot, non, tieu chay
- Thu cung bo an, met moi
- Cac van de ve da, long
- Van de ho hap, mat

WARNING: Tool nay chi cung cap thong tin tham khao.
Luon khuyen nguoi dung den phong kham thu y de duoc chan doan chinh xac.""",
                    tool_type="code_based",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "symptoms": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Danh sach trieu chung (vi du: ['sot', 'non mua', 'met moi'])"
                            },
                            "pet_type": {
                                "type": "string",
                                "description": "Loai thu cung: dog, cat, bird, rabbit, hamster",
                                "default": "dog"
                            },
                            "top_k": {
                                "type": "integer",
                                "description": "So luong ket qua (default: 5)",
                                "default": 5
                            }
                        },
                        "required": ["symptoms"]
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "symptoms": {"type": "array", "items": {"type": "string"}},
                            "pet_type": {"type": "string"},
                            "possible_conditions": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "description": {"type": "string"},
                                        "severity": {"type": "string"},
                                        "source": {"type": "string"},
                                        "score": {"type": "number"}
                                    }
                                }
                            },
                            "urgent": {"type": "boolean"},
                            "recommendations": {"type": "string"},
                            "disclaimer": {"type": "string"}
                        }
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"]
                ),
            ]

            db.add_all(tools)
            results["tools"] = len(tools)
            logger.info(f"Seeded {len(tools)} RAG tools for Single Agent")

        await db.commit()

        return {
            "status": "success",
            "message": "Database seeded successfully with Single Agent architecture",
            "results": results
        }

    except Exception as e:
        logger.error(f"Seed error: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ===== TEST ENDPOINTS =====

@router.post("/test-ollama", response_model=TestResult)
async def test_ollama_connection(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """Test Ollama connection"""
    base_url = await get_setting("OLLAMA_BASE_URL", db) or "http://localhost:11434"
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{base_url}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return TestResult(
                    status="success",
                    message="Connected to Ollama",
                    details={"models": models[:5]}
                )
            return TestResult(status="error", message=f"HTTP {response.status_code}")
    except Exception as e:
        return TestResult(status="error", message=str(e))


@router.post("/test-embeddings", response_model=TestResult)
async def test_openai_embeddings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """Test OpenAI embeddings connection"""
    api_key = await get_setting("OPENAI_API_KEY", db)
    
    if not api_key:
        return TestResult(status="error", message="OpenAI API key not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"input": "test", "model": "text-embedding-ada-002"}
            )
            if response.status_code == 200:
                data = response.json()
                dim = len(data["data"][0]["embedding"])
                return TestResult(
                    status="success",
                    message="OpenAI embeddings working",
                    details={"dimension": dim, "model": "text-embedding-ada-002"}
                )
            return TestResult(status="error", message=response.json().get("error", {}).get("message", "Unknown error"))
    except Exception as e:
        return TestResult(status="error", message=str(e))


@router.post("/test-qdrant", response_model=TestResult)
async def test_qdrant_connection(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
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
                collections = [c["name"] for c in data.get("result", {}).get("collections", [])]
                return TestResult(
                    status="success",
                    message="Connected to Qdrant",
                    details={"collections": collections}
                )
            return TestResult(status="error", message=f"HTTP {response.status_code}")
    except Exception as e:
        return TestResult(status="error", message=str(e))


@router.post("/test-openrouter", response_model=TestResult)
async def test_openrouter_connection(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
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
            message="OpenRouter API key not configured. Set OPENROUTER_API_KEY in settings."
        )

    # Get configured model or fallback default
    model = await get_setting("OPENROUTER_MODEL", db) or "google/gemini-2.0-flash-exp:free"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://petties.world",
                    "X-Title": "Petties AI"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 10
                }
            )

            if response.status_code == 200:
                data = response.json()
                model = data.get("model", "unknown")
                return TestResult(
                    status="success",
                    message="OpenRouter API connected successfully",
                    details={
                        "model": model,
                        "provider": "openrouter"
                    }
                )
            else:
                try:
                    error_data = response.json()
                    # OpenRouter error structure can vary
                    if "error" in error_data:
                        if isinstance(error_data["error"], dict):
                            error_msg = error_data["error"].get("message", str(error_data["error"]))
                        else:
                            error_msg = str(error_data["error"])
                    else:
                        error_msg = str(error_data)
                except:
                    error_msg = response.text

                return TestResult(
                    status="error",
                    message=f"OpenRouter Error ({response.status_code}): {error_msg}",
                    details={"status_code": response.status_code}
                )

    except Exception as e:
        logger.error(f"OpenRouter test error: {e}")
        return TestResult(status="error", message=str(e))


@router.post("/test-cohere", response_model=TestResult)
async def test_cohere_embeddings(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
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
            message="Cohere API key not configured. Set COHERE_API_KEY in settings."
        )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.cohere.ai/v1/embed",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "embed-multilingual-v3.0",
                    "texts": ["Xin chao, day la test embedding tieng Viet"],
                    "input_type": "search_query"
                }
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
                        "provider": "cohere"
                    }
                )
            else:
                error_data = response.json()
                error_msg = error_data.get("message", "Unknown error")
                return TestResult(
                    status="error",
                    message=f"Cohere API error: {error_msg}",
                    details={"status_code": response.status_code}
                )

    except Exception as e:
        logger.error(f"Cohere test error: {e}")
        return TestResult(status="error", message=str(e))


@router.post("/test-deepseek", response_model=TestResult)
async def test_deepseek_connection(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """
    Test DeepSeek API connection

    Verifies:
    - API key is valid
    - Can connect to DeepSeek API
    - Can generate simple completion
    """
    api_key = await get_setting("DEEPSEEK_API_KEY", db)

    if not api_key:
        return TestResult(
            status="error",
            message="DeepSeek API key not configured. Set DEEPSEEK_API_KEY in settings."
        )

    base_url = await get_setting("DEEPSEEK_BASE_URL", db) or "https://api.deepseek.com"
    model = await get_setting("DEEPSEEK_MODEL", db) or "deepseek-chat"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 10
                }
            )

            if response.status_code == 200:
                data = response.json()
                used_model = data.get("model", model)
                return TestResult(
                    status="success",
                    message="DeepSeek API connected successfully",
                    details={
                        "model": used_model,
                        "provider": "deepseek",
                        "base_url": base_url
                    }
                )
            else:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                return TestResult(
                    status="error",
                    message=f"DeepSeek API error: {error_msg}",
                    details={"status_code": response.status_code}
                )

    except Exception as e:
        logger.error(f"DeepSeek test error: {e}")
        return TestResult(status="error", message=str(e))
