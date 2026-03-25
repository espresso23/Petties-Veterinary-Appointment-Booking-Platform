"""
PETTIES AGENT SERVICE - Database Seeding
Logic to initialize default agents, tools, and settings.
"""

import logging
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres.models import (
    Agent,
    Tool,
    ToolType,
    SystemSetting,
    DEFAULT_SETTINGS,
)

logger = logging.getLogger(__name__)


async def seed_data(db: AsyncSession, force: bool = False):
    """
    Seed database with Single Agent architecture.
    """
    try:
        results = {"system_settings": 0, "agents": 0, "tools": 0}

        # 1. Seed system settings - add NEW settings only (don't overwrite existing)
        if force:
            await db.execute(delete(SystemSetting))

        existing_settings = await db.execute(select(SystemSetting))
        existing_keys = set()
        if existing_settings.scalars().first():
            all_settings = await db.execute(select(SystemSetting.key))
            existing_keys = {s for s in all_settings.scalars()}

        settings_to_add = []
        for setting_data in DEFAULT_SETTINGS:
            if setting_data["key"] not in existing_keys:
                setting = SystemSetting(
                    key=setting_data["key"],
                    value=setting_data["value"],
                    category=setting_data["category"],
                    is_sensitive=setting_data["is_sensitive"],
                    description=setting_data["description"],
                )
                settings_to_add.append(setting)

        if settings_to_add:
            db.add_all(settings_to_add)
            results["system_settings"] = len(settings_to_add)
            logger.info(f"Seeded {len(settings_to_add)} new system settings")

        # 2. Seed Single Agent
        if force:
            await db.execute(delete(Agent))

        existing_agents = await db.execute(select(Agent))
        if not existing_agents.scalars().first() or force:
            # Create Single Agent
            single_agent = Agent(
                name="petties_agent",
                description="Petties AI Assistant - Single Agent voi ReAct pattern",
                temperature=0.7,
                max_tokens=2000,
                top_p=0.9,
                model="google/gemini-2.5-flash-lite",
                enabled=True,
            )

            db.add(single_agent)
            results["agents"] = 1
            logger.info("Seeded 1 Single Agent (petties_agent)")

        # 3. Seed tools
        existing_tools = await db.execute(select(Tool))
        if not existing_tools.scalars().first() or force:
            if force:
                await db.execute(delete(Tool))

            tools = [
                Tool(
                    name="pet_knowledge_search",
                    description="""Tìm kiếm kiến thức chăm sóc thú cưng từ Knowledge Base (RAG). Trả về dữ liệu thô để LLM tự phân tích.""",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Câu hỏi hoặc mô tả triệu chứng",
                            },
                            "pet_type": {
                                "type": "string",
                                "default": "dog",
                                "description": "Loại thú cưng",
                            },
                            "top_k": {"type": "integer", "default": 5},
                            "min_score": {"type": "number", "default": 0.4},
                        },
                        "required": ["query"],
                    },
                    enabled=True,
                ),
                Tool(
                    name="web_search",
                    description="Tìm kiếm thông tin trên web khi knowledge base chưa đủ dữ liệu. Chỉ dùng cho nội dung liên quan đến thú cưng, thú y, chăm sóc, dinh dưỡng, triệu chứng.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Câu hỏi tìm trên web",
                            },
                            "max_results": {"type": "integer", "default": 5},
                        },
                        "required": ["query"],
                    },
                    enabled=False,
                ),
                Tool(
                    name="get_user_pets",
                    description="Lấy danh sách thú cưng của pet owner hiện tại để phục vụ quy trình đặt lịch.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "User ID được tự động inject từ session",
                            }
                        },
                        "required": [],
                    },
                    enabled=True,
                ),
                Tool(
                    name="search_clinics_nearby",
                    description="Tim phong kham gan vi tri user de goi y dat lich.",
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
                    enabled=True,
                ),
                Tool(
                    name="get_clinic_services",
                    description="Lay danh sach dich vu dang hoat dong cua phong kham.",
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
                    enabled=True,
                ),
                Tool(
                    name="check_vaccination_status",
                    description="Lay lich su tiem va goi y mui sap toi cua pet de ho tro tu van booking tientrung trong flow binh thuong.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pet_id": {"type": "string"},
                            "vaccine_template_id": {"type": "string"},
                        },
                        "required": ["pet_id"],
                    },
                    enabled=True,
                ),
                Tool(
                    name="check_available_slots",
                    description="Kiem tra khung gio trong cua phong kham cho danh sach dich vu.",
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
                    enabled=True,
                ),
                Tool(
                    name="create_booking_for_user",
                    description="Tao booking that cho pet owner sau khi da xac nhan day du thong tin.",
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
                            "confirmed": {"type": "boolean", "default": False},
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
                    enabled=True,
                ),
                Tool(
                    name="get_staff_patients",
                    description="Lấy danh sách thú cưng của staff hiện tại để tìm kiếm nhanh theo tên.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query_name": {
                                "type": "string",
                                "description": "Tên thú cưng cần tìm (tùy chọn)",
                            },
                            "limit": {
                                "type": "integer",
                                "default": 10,
                                "description": "Số lượng kết quả tối đa",
                            },
                        },
                    },
                    enabled=True,
                ),
                Tool(
                    name="get_patient_summary",
                    description="Lấy tóm tắt nhanh hồ sơ y tế của một thú cưng.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pet_id": {
                                "type": "string",
                                "description": "ID của thú cưng",
                            },
                        },
                        "required": ["pet_id"],
                    },
                    enabled=True,
                ),
                Tool(
                    name="get_emr_history",
                    description="Lấy lịch sử bệnh án đầy đủ của một thú cưng.",
                    tool_type=ToolType.CODE_BASED,
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pet_id": {
                                "type": "string",
                                "description": "ID của thú cưng",
                            },
                            "limit": {
                                "type": "integer",
                                "default": 5,
                                "description": "Số lượng lần khám tối đa",
                            },
                        },
                        "required": ["pet_id"],
                    },
                    enabled=True,
                ),
            ]

            db.add_all(tools)
            results["tools"] = len(tools)
            logger.info(f"Seeded {len(tools)} RAG tools")

        await db.commit()

        # Không seed legacy disease classes trong giai đoạn này.

        await db.commit()
        return results

    except Exception as e:
        logger.error(f"Seed error: {e}")
        await db.rollback()
        raise e





