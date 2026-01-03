"""
PETTIES AGENT SERVICE - Database Seeding
Logic to initialize default agents, tools, and settings.
"""

import logging
from pathlib import Path
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres.models import (
    Agent, Tool, SystemSetting,
    DEFAULT_SETTINGS, PromptVersion
)

logger = logging.getLogger(__name__)

async def seed_data(db: AsyncSession, force: bool = False):
    """
    Seed database with Single Agent architecture.
    """
    try:
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
            settings_list = []
            for setting_data in DEFAULT_SETTINGS:
                setting = SystemSetting(
                    key=setting_data["key"],
                    value=setting_data["value"],
                    category=setting_data["category"],  # Now a simple string
                    is_sensitive=setting_data["is_sensitive"],
                    description=setting_data["description"]
                )
                settings_list.append(setting)
            db.add_all(settings_list)
            results["system_settings"] = len(settings_list)
            logger.info(f"Seeded {len(settings_list)} system settings")

        # 2. Seed Single Agent
        if force:
            await db.execute(delete(PromptVersion))
            await db.execute(delete(Agent))

        existing_agents = await db.execute(select(Agent))
        if not existing_agents.scalars().first() or force:
            single_agent_prompt = load_template("single_agent") or load_template("main_agent")

            if not single_agent_prompt:
                single_agent_prompt = """Bạn là Petties AI Assistant - trợ lý AI chuyên về chăm sóc thú cưng.

## NHIỆM VỤ
- Tư vấn sức khỏe thú cưng, chẩn đoán bệnh dựa trên triệu chứng
- Hỗ trợ đặt lịch khám tại phòng khám thú y
- Tìm kiếm thông tin về chăm sóc thú cưng, sản phẩm, dịch vụ
- Trả lời các câu hỏi về thú cưng bằng tiếng Việt thân thiện

## QUY TẮC CHÍNH
1. Luôn trả lời bằng tiếng Việt thân thiện và dễ hiểu
2. Khi cần thông tin y tế, PHẢI sử dụng tool tra cứu knowledge base
3. Không đưa ra chẩn đoán cuối cùng - luôn khuyến khích gặp bác sĩ thú y
4. Ưu tiên an toàn và sức khỏe của thú cưng

## NGUYÊN TẮC ĐỨNG (CRITICAL)
- CHỈ GỌI TOOL TỐI ĐA 1-2 LẦN cho mỗi câu hỏi
- Sau khi nhận Observation có thông tin hữu ích, PHẢI chuyển sang Final Answer

## QUY TẮC VẮNG
- Tuyệt đối không gọi cùng một tool với tham số tương tự qua 1 lần
- Nếu Observation đã có thông tin, DÙ KHÔNG HOÀN HẢO, vẫn phải dùng nó để trả lời"""

            # Create Single Agent
            single_agent = Agent(
                name="petties_agent",
                description="Petties AI Assistant - Single Agent voi ReAct pattern",
                temperature=0.7,
                max_tokens=2000,
                top_p=0.9,
                model="google/gemini-2.0-flash-exp:free",
                system_prompt=single_agent_prompt,
                enabled=True
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
                    name="pet_care_qa",
                    description="""Tim kiếm kiến thức chăm sóc thú cưng từ knowledge base (RAG Q&A).""",
                    tool_type="code_based",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Câu hỏi khóa tìm kiếm"},
                            "top_k": {"type": "integer", "default": 5}
                        },
                        "required": ["query"]
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"]
                ),
                Tool(
                    name="symptom_search",
                    description="""Tim bệnh dựa trên triệu chứng su dung RAG (Symptom Checker).""",
                    tool_type="code_based",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "symptoms": {"type": "array", "items": {"type": "string"}},
                            "pet_type": {"type": "string", "default": "dog"}
                        },
                        "required": ["symptoms"]
                    },
                    enabled=True,
                    assigned_agents=["petties_agent"]
                ),
            ]

            db.add_all(tools)
            results["tools"] = len(tools)
            logger.info(f"Seeded {len(tools)} RAG tools")

        await db.commit()
        return results

    except Exception as e:
        logger.error(f"Seed error: {e}")
        await db.rollback()
        raise e
