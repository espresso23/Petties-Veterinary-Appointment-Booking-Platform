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


async def get_setting(key: str, db: AsyncSession = None) -> Optional[str]:
    """
    Get setting value by key.
    Checks database first, falls back to environment variable.
    
    Usage:
        value = await get_setting("OLLAMA_BASE_URL", db)
    """
    import os
    
    if db:
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value:
            return setting.value
    
    # Fallback to env
    return os.getenv(key)


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


@router.post("/seed", summary="Seed database (agents, tools, settings)")
async def seed_database(
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    """
    Seed database với agents và settings từ templates
    
    Args:
        force: Nếu True, seed lại dù đã có data
    
    Returns:
        Status message với số lượng agents/tools đã seed
    """
    try:
        from app.db.postgres.models import (
            Agent, Tool, SystemSetting, AgentType, ToolTypeEnum,
            SettingCategory, DEFAULT_SETTINGS
        )
        from sqlalchemy import select
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
            # Delete existing
            await db.execute(select(SystemSetting).delete())
        
        existing_settings = await db.execute(select(SystemSetting))
        if not existing_settings.scalar_one_or_none() or force:
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
            logger.info(f"✅ Seeded {len(settings)} system settings")
        
        # 2. Seed agents từ templates
        if force:
            # Delete existing agents (cascade sẽ xóa prompt_versions)
            await db.execute(select(Agent).delete())
        
        existing_agents = await db.execute(select(Agent))
        if not existing_agents.scalar_one_or_none() or force:
            # Load prompts từ templates
            main_prompt = load_template("main_agent")
            booking_prompt = load_template("booking_agent")
            medical_prompt = load_template("medical_agent")
            research_prompt = load_template("research_agent")
            
            # Fallback prompts nếu template không có
            if not main_prompt:
                main_prompt = """Bạn là Main Agent của hệ thống Petties.
Nhiệm vụ: Phân loại ý định, điều phối đến Sub-Agent, tổng hợp kết quả."""
            if not booking_prompt:
                booking_prompt = """Bạn là Booking Agent của Petties.
Nhiệm vụ: Giúp user đặt lịch khám cho thú cưng."""
            if not medical_prompt:
                medical_prompt = """Bạn là Medical Agent của Petties.
Nhiệm vụ: Tư vấn y tế, chẩn đoán sơ bộ."""
            if not research_prompt:
                research_prompt = """Bạn là Research Agent của Petties.
Nhiệm vụ: Tìm kiếm thông tin trên web."""
            
            agents = [
                Agent(
                    name="main_agent",
                    agent_type=AgentType.MAIN,
                    description="Main Agent - Supervisor/Orchestrator",
                    temperature=0.0,
                    max_tokens=2000,
                    model="kimi-k2",
                    system_prompt=main_prompt,
                    enabled=True
                ),
                Agent(
                    name="booking_agent",
                    agent_type=AgentType.BOOKING,
                    description="Booking Agent - Xử lý đặt lịch",
                    temperature=0.0,
                    max_tokens=1500,
                    model="kimi-k2",
                    system_prompt=booking_prompt,
                    enabled=True
                ),
                Agent(
                    name="medical_agent",
                    agent_type=AgentType.MEDICAL,
                    description="Medical Agent - Tư vấn y tế",
                    temperature=0.5,
                    max_tokens=2000,
                    model="kimi-k2",
                    system_prompt=medical_prompt,
                    enabled=True
                ),
                Agent(
                    name="research_agent",
                    agent_type=AgentType.RESEARCH,
                    description="Research Agent - Tìm kiếm web",
                    temperature=0.3,
                    max_tokens=1500,
                    model="kimi-k2",
                    system_prompt=research_prompt,
                    enabled=True
                ),
            ]
            
            db.add_all(agents)
            results["agents"] = len(agents)
            logger.info(f"✅ Seeded {len(agents)} agents from templates")
        
        # 3. Seed tools (optional - giữ nguyên logic cũ nếu cần)
        existing_tools = await db.execute(select(Tool))
        if not existing_tools.scalar_one_or_none() or force:
            if force:
                await db.execute(select(Tool).delete())
            
            tools = [
                Tool(
                    name="check_slot",
                    tool_type=ToolTypeEnum.CODE_BASED,
                    description="Kiểm tra slot thời gian trống cho booking",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "doctor_id": {"type": "string"},
                            "date": {"type": "string", "format": "date"},
                        },
                        "required": ["doctor_id", "date"]
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "available": {"type": "boolean"},
                            "slots": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    enabled=True,
                    assigned_agents=["booking_agent"]
                ),
                Tool(
                    name="create_booking",
                    tool_type=ToolTypeEnum.CODE_BASED,
                    description="Tạo booking mới",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pet_id": {"type": "string"},
                            "doctor_id": {"type": "string"},
                            "date": {"type": "string"},
                            "time": {"type": "string"},
                        },
                        "required": ["pet_id", "doctor_id", "date", "time"]
                    },
                    output_schema={
                        "type": "object",
                        "properties": {
                            "booking_id": {"type": "string"},
                            "status": {"type": "string"}
                        }
                    },
                    enabled=True,
                    assigned_agents=["booking_agent"]
                ),
            ]
            
            db.add_all(tools)
            results["tools"] = len(tools)
            logger.info(f"✅ Seeded {len(tools)} tools")
        
        await db.commit()
        
        return {
            "status": "success",
            "message": "Database seeded successfully",
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
