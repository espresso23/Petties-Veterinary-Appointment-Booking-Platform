
import asyncio
from sqlalchemy import select
from app.db.postgres.session import AsyncSessionLocal
from app.db.postgres.models import Tool

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tool).where(Tool.name == 'analyze_revenue_trends'))
        tool = result.scalar_one_or_none()
        if tool:
            import json
            print(f"Tool: {tool.name}")
            print(f"Schema: {json.dumps(tool.input_schema, indent=2, ensure_ascii=False)}")
        else:
            print("Tool not found")

if __name__ == "__main__":
    asyncio.run(check())
