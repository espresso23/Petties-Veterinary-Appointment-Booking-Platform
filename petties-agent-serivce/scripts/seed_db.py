"""
PETTIES AGENT SERVICE - Database Seeding Script
Seed initial data cho Agents và Tools vào PostgreSQL

Usage:
    python scripts/seed_db.py

Purpose: Tạo data mẫu cho development và testing
Version: v0.0.1

Theo Technical Scope:
- Load prompts từ templates để seed vào DB
- Database là Single Source of Truth sau khi seed
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path để import app modules
sys.path.append(str(Path(__file__).parent.parent))

from app.db.postgres.session import AsyncSessionLocal, init_db
from app.db.postgres.models import Agent, Tool, AgentType, ToolTypeEnum, SystemSetting, SettingCategory, DEFAULT_SETTINGS
from sqlalchemy import select
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Templates directory
TEMPLATES_DIR = Path(__file__).parent.parent / "app" / "core" / "prompts" / "templates"


def load_template_for_seed(agent_name: str) -> str:
    """
    Load template để seed ban đầu vào DB
    
    Args:
        agent_name: Tên agent (main_agent, booking_agent, etc.)
    
    Returns:
        Prompt string từ template file, empty string nếu không tìm thấy
    """
    template_path = TEMPLATES_DIR / f"{agent_name}.txt"
    try:
        if template_path.exists():
            prompt = template_path.read_text(encoding="utf-8").strip()
            logger.debug(f"✅ Loaded template for {agent_name} ({len(prompt)} chars)")
            return prompt
        else:
            logger.warning(f"⚠️  Template not found: {template_path}")
    except Exception as e:
        logger.warning(f"Failed to load template for {agent_name}: {e}")
    return ""


async def seed_agents():
    """
    Seed Main Agent và Sub-Agents vào database

    Purpose: Tạo 4 agents ban đầu
    """
    async with AsyncSessionLocal() as session:
        # Check if agents already exist
        result = await session.execute(select(Agent))
        existing_agents = result.scalars().all()

        if existing_agents:
            logger.info("⚠️  Agents already exist. Skipping seed.")
            return

        logger.info("📝 Seeding agents from templates...")

        # ===== MAIN AGENT (SUPERVISOR) =====
        main_prompt = load_template_for_seed("main_agent")
        if not main_prompt:
            main_prompt = """Bạn là Main Agent của hệ thống Petties.
Nhiệm vụ của bạn:
1. Phân loại ý định người dùng (Intent Classification)
2. Điều phối đến Sub-Agent phù hợp (Routing)
3. Tổng hợp kết quả và trả lời user (Synthesis)

Các Sub-Agent:
- Booking Agent: Đặt lịch khám
- Medical Agent: Tư vấn y tế
- Research Agent: Tìm kiếm thông tin trên web (general-purpose)

Hãy phân tích user input và chuyển đến đúng agent."""
        
        main_agent = Agent(
            name="main_agent",
            agent_type=AgentType.MAIN,
            description="Main Agent - Supervisor/Orchestrator cho intent classification và routing",
            temperature=0.0,
            max_tokens=2000,
            model="kimi-k2",
            system_prompt=main_prompt,  # Từ template
            enabled=True
        )

        # ===== BOOKING AGENT =====
        booking_prompt = load_template_for_seed("booking_agent")
        if not booking_prompt:
            booking_prompt = """Bạn là Booking Agent của Petties.
Nhiệm vụ: Giúp user đặt lịch khám cho thú cưng.

Tools:
- check_slot: Kiểm tra slot trống
- create_booking: Tạo booking mới

Hãy hỏi thông tin cần thiết: pet_id, doctor_id, date, time."""
        
        booking_agent = Agent(
            name="booking_agent",
            agent_type=AgentType.BOOKING,
            description="Booking Agent - Xử lý đặt lịch khám thú cưng tại nhà/phòng khám",
            temperature=0.0,
            max_tokens=1500,
            model="kimi-k2",
            system_prompt=booking_prompt,  # Từ template
            enabled=True
        )

        # ===== MEDICAL AGENT =====
        medical_prompt = load_template_for_seed("medical_agent")
        if not medical_prompt:
            medical_prompt = """Bạn là Medical Agent - Bác sĩ thú y AI của Petties.
Nhiệm vụ: Tư vấn y tế, chẩn đoán sơ bộ.

Tools:
- search_symptoms: Tìm bệnh dựa trên triệu chứng
- RAG_search: Tra cứu knowledge base

Lưu ý: Đây chỉ là tư vấn sơ bộ, khuyến nghị user đặt lịch khám nếu nghiêm trọng."""
        
        medical_agent = Agent(
            name="medical_agent",
            agent_type=AgentType.MEDICAL,
            description="Medical Agent - Tư vấn y tế, chẩn đoán sơ bộ, tra cứu lịch sử bệnh",
            temperature=0.5,
            max_tokens=2000,
            model="kimi-k2",
            system_prompt=medical_prompt,  # Từ template
            enabled=True
        )

        # ===== RESEARCH AGENT =====
        research_prompt = load_template_for_seed("research_agent")
        if not research_prompt:
            research_prompt = """Bạn là Research Agent của Petties - Web Researcher chuyên tìm kiếm thông tin Internet (general-purpose).

Vai trò: Tìm bất cứ thứ gì người dùng cần trên web khi được Main Agent giao phó.

Nhiệm vụ:
- Phục vụ Main Agent: Tìm sản phẩm, thông tin, tin tức, mẹo vặt
- Phục vụ Medical Agent: Tìm bệnh lạ, bài viết y khoa, video hướng dẫn, home remedies

⚠️ NGUYÊN TẮC:
- BẮT BUỘC trích dẫn nguồn (URL) cho mọi thông tin tìm được
- Ưu tiên nguồn uy tín và đáng tin cậy"""
        
        research_agent = Agent(
            name="research_agent",
            agent_type=AgentType.RESEARCH,
            description="Research Agent - Tìm kiếm thông tin trên web (sản phẩm, bài viết, video, mẹo vặt)",
            temperature=0.3,
            max_tokens=1500,
            model="kimi-k2",
            system_prompt=research_prompt,  # Từ template
            enabled=True
        )

        # Add all agents
        session.add_all([main_agent, booking_agent, medical_agent, research_agent])
        await session.commit()

        logger.info("✅ Seeded 4 agents successfully!")


async def seed_tools():
    """
    Seed Tools vào database

    Purpose: Tạo tools mẫu cho các agents
    """
    async with AsyncSessionLocal() as session:
        # Check if tools already exist
        result = await session.execute(select(Tool))
        existing_tools = result.scalars().all()

        if existing_tools:
            logger.info("⚠️  Tools already exist. Skipping seed.")
            return

        logger.info("📝 Seeding tools...")

        # ===== BOOKING TOOLS =====
        check_slot_tool = Tool(
            name="check_slot",
            tool_type=ToolTypeEnum.CODE_BASED,
            description="Kiểm tra slot thời gian trống cho booking",
            input_schema={
                "type": "object",
                "properties": {
                    "doctor_id": {"type": "string"},
                    "date": {"type": "string", "format": "date"},
                    "time": {"type": "string"}
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
        )

        create_booking_tool = Tool(
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
                    "service_type": {"type": "string"}
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
        )

        # ===== MEDICAL TOOLS =====
        search_symptoms_tool = Tool(
            name="search_symptoms",
            tool_type=ToolTypeEnum.CODE_BASED,
            description="Tìm bệnh dựa trên triệu chứng",
            input_schema={
                "type": "object",
                "properties": {
                    "symptoms": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["symptoms"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "diseases": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "probability": {"type": "number"}
                            }
                        }
                    }
                }
            },
            enabled=True,
            assigned_agents=["medical_agent"]
        )

        # Add all tools
        session.add_all([check_slot_tool, create_booking_tool, search_symptoms_tool])
        await session.commit()

        logger.info("✅ Seeded 3 tools successfully!")


async def seed_system_settings():
    """
    Seed system settings vào database
    
    Purpose: Tạo default settings (API keys, URLs) cho admin config sau
    """
    async with AsyncSessionLocal() as session:
        # Check if settings already exist
        result = await session.execute(select(SystemSetting))
        existing_settings = result.scalars().all()
        
        if existing_settings:
            logger.info("⚠️  System settings already exist. Skipping seed.")
            return
        
        logger.info("📝 Seeding system settings...")
        
        # Load từ DEFAULT_SETTINGS
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
        
        session.add_all(settings)
        await session.commit()
        
        logger.info(f"✅ Seeded {len(settings)} system settings successfully!")


async def main():
    """Main seeding function"""
    logger.info("🌱 Starting database seeding...")

    # Initialize database (create tables)
    await init_db()

    # Seed data
    await seed_system_settings()  # Seed settings first
    await seed_agents()           # Then agents (may depend on settings)
    await seed_tools()            # Then tools

    logger.info("🎉 Database seeding completed!")


if __name__ == "__main__":
    asyncio.run(main())
