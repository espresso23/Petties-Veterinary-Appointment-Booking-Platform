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
from app.db.postgres.models import SystemSetting, DEFAULT_SETTINGS, ToolType
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
                category=setting_data["category"],  # Simple string now
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
        query = query.where(SystemSetting.category == category)

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
    """Update setting value (admin only)"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
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
    - Tools duoc assign cho petties_agent

    Args:
        force: Neu True, seed lai du da co data

    Returns:
        Status message voi so luong agents/tools da seed
    """
    try:
        from app.db.postgres.models import (
            Agent,
            Tool,
            SystemSetting,
            DEFAULT_SETTINGS,
            PromptVersion,
        )
        from sqlalchemy import select, delete
        from pathlib import Path

        # Templates directory
        templates_dir = (
            Path(__file__).parent.parent.parent / "core" / "prompts" / "templates"
        )

        def load_template(agent_name: str) -> str:
            """Load template file"""
            template_path = templates_dir / f"{agent_name}.txt"
            try:
                if template_path.exists():
                    return template_path.read_text(encoding="utf-8").strip()
            except Exception as e:
                logger.warning(f"Failed to load template {agent_name}: {e}")
            return ""

        results = {"system_settings": 0, "agents": 0, "tools": 0}

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
                    category=setting_data["category"],  # Simple string
                    is_sensitive=setting_data["is_sensitive"],
                    description=setting_data["description"],
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
            single_agent_prompt = load_template("single_agent") or load_template(
                "main_agent"
            )

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
                enabled=True,
            )

            db.add(single_agent)
            results["agents"] = 1
            logger.info("Seeded 1 Single Agent (petties_agent)")

        # 3. Seed tools cho Single Agent (chi 2 RAG tools)
        existing_tools = await db.execute(select(Tool))
        if not existing_tools.scalars().first() or force:
            if force:
                await db.execute(delete(Tool))

            # Chi seed 1 unified RAG tool + web fallback
            # Cac tools khac (booking, clinic search) se duoc add sau khi co API integration
            tools = [
                Tool(
                    name="pet_knowledge_search",
                    description="""Tim kiem kien thuc cham soc thu cung va phan tich trieu chung tu Knowledge Base (RAG).

Su dung tool nay khi user:
- Hoi cach cham soc thu cung (cho an, tam rua, tap luyen)
- Hoi ve thong tin giong loai, dinh duong, thuc pham
- Mo ta trieu chung (sot, non, tieu chay, bo an, ngua, rung long)
- Hoi ve benh, chan doan, dieu tri tham khao

Tool tra cuu kien thuc thu y (benh, trieu chung, cham soc) tu knowledge base va tra ve ket qua tho (raw data).
LLM se tu tong hop va format cau tra loi tu ket qua tool.

WARNING: Tool nay chi cung cap thong tin tham khao.
Luon khuyen nguoi dung den phong kham thu y de duoc chan doan chinh xac.""",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Cau hoi hoac mo ta trieu chung (tieng Viet hoac English)",
                            },
                            "pet_type": {
                                "type": "string",
                                "description": "Loai thu cung: dog, cat, bird, rabbit, hamster",
                                "default": "dog",
                            },
                            "top_k": {
                                "type": "integer",
                                "description": "So luong ket qua tra ve (default: 5)",
                                "default": 5,
                            },
                            "min_score": {
                                "type": "number",
                                "description": "Diem tuong dong toi thieu (default: 0.4)",
                                "default": 0.4,
                            },
                        },
                        "required": ["query"],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "pet_type": {"type": "string"},
                            "results": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "content": {"type": "string"},
                                        "score": {"type": "number"},
                                        "source": {"type": "string"},
                                        "chunk_index": {"type": "integer"},
                                    },
                                },
                            },
                            "sources_used": {"type": "integer"},
                            "search_source": {"type": "string"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="web_search",
                    description="""Tim thong tin tu web khi knowledge base chua du du lieu.

Chi su dung tool nay cho cau hoi lien quan den:
- Thu cung, thu y, dinh duong, cham soc
- Trieu chung, benh ly, huong dan xu ly tham khao

Tool nay dung DuckDuckGo search va tu dong loc ket qua theo pham vi thu cung/thu y.""",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Cau hoi can tim tren web (chi nhan noi dung lien quan thu cung/thu y)",
                            },
                            "max_results": {
                                "type": "integer",
                                "description": "So luong ket qua toi da (default: 5)",
                                "default": 5,
                            },
                        },
                        "required": ["query"],
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
                                        "title": {"type": "string"},
                                        "snippet": {"type": "string"},
                                        "url": {"type": "string"},
                                        "source": {"type": "string"},
                                    },
                                },
                            },
                            "sources_used": {"type": "integer"},
                            "search_source": {"type": "string"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="get_user_pets",
                    description="Lay danh sach thu cung cua pet owner hien tai de phuc vu booking flow.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "User ID duoc auto-inject tu business chat session",
                            }
                        },
                        "required": [],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "user_id": {"type": "string"},
                            "pets": {"type": "array", "items": {"type": "object"}},
                            "total_pets": {"type": "integer"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="search_clinics_nearby",
                    description="Tim phong kham gan vi tri user va loc theo dich vu neu can.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "latitude": {"type": "number"},
                            "longitude": {"type": "number"},
                            "radius_km": {"type": "number", "default": 5},
                            "service_names": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "top_k": {"type": "integer", "default": 5},
                        },
                        "required": ["latitude", "longitude"],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "clinics": {"type": "array", "items": {"type": "object"}},
                            "total_found": {"type": "integer"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="get_clinic_services",
                    description="Lay danh sach dich vu cua clinic de AI de xuat booking.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "clinic_id": {"type": "string"},
                            "pet_species": {"type": "string"},
                            "is_home_visit": {"type": "boolean"},
                        },
                        "required": ["clinic_id"],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "services": {"type": "array", "items": {"type": "object"}},
                            "total_services": {"type": "integer"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="check_vaccination_status",
                    description="Lay lich su tiem va goi y mui sap toi cua pet de ho tro tu van booking tiem chung trong flow binh thuong.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pet_id": {"type": "string"},
                            "vaccine_template_id": {"type": "string"},
                        },
                        "required": ["pet_id"],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "history": {"type": "array", "items": {"type": "object"}},
                            "upcoming": {"type": "array", "items": {"type": "object"}},
                            "recommended_next": {"type": "object"},
                            "message": {"type": "string"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="check_available_slots",
                    description="Kiem tra khung gio con trong cua clinic cho booking AI.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "clinic_id": {"type": "string"},
                            "date": {"type": "string"},
                            "service_ids": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                        },
                        "required": ["clinic_id", "date", "service_ids"],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "available_slots": {
                                "type": "array",
                                "items": {"type": "object"},
                            },
                            "total_slots": {"type": "integer"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
                Tool(
                    name="create_booking_for_user",
                    description="Tao booking cho pet owner sau khi da co human confirmation.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pet_id": {"type": "string"},
                            "clinic_id": {"type": "string"},
                            "booking_date": {"type": "string"},
                            "start_time": {"type": "string"},
                            "service_ids": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "booking_type": {
                                "type": "string",
                                "enum": ["IN_CLINIC", "HOME_VISIT"],
                            },
                            "notes": {"type": "string"},
                            "home_address": {"type": "string"},
                            "home_lat": {"type": "number"},
                            "home_long": {"type": "number"},
                            "distance_km": {"type": "number"},
                            "confirmed": {"type": "boolean", "default": false},
                        },
                        "required": [
                            "pet_id",
                            "clinic_id",
                            "booking_date",
                            "start_time",
                            "service_ids",
                            "confirmed",
                        ],
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "success": {"type": "boolean"},
                            "booking": {"type": "object"},
                            "message": {"type": "string"},
                        },
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"],
                ),
            ]

            db.add_all(tools)
            results["tools"] = len(tools)
            logger.info(f"Seeded {len(tools)} RAG tools for Single Agent")

        await db.commit()

        return {
            "status": "success",
            "message": "Database seeded successfully with Single Agent architecture",
            "results": results,
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
        await get_setting("OPENROUTER_MODEL", db) or "google/gemini-2.0-flash-exp:free"
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


@router.post("/test-deepseek", response_model=TestResult)
async def test_deepseek_connection(
    db: AsyncSession = Depends(get_db), _: dict = Depends(get_admin_user)
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
            message="DeepSeek API key not configured. Set DEEPSEEK_API_KEY in settings.",
        )

    base_url = await get_setting("DEEPSEEK_BASE_URL", db) or "https://api.deepseek.com"
    model = await get_setting("DEEPSEEK_MODEL", db) or "deepseek-chat"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 10,
                },
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
                        "base_url": base_url,
                    },
                )
            else:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                return TestResult(
                    status="error",
                    message=f"DeepSeek API error: {error_msg}",
                    details={"status_code": response.status_code},
                )

    except Exception as e:
        logger.error(f"DeepSeek test error: {e}")
        return TestResult(status="error", message=str(e))
