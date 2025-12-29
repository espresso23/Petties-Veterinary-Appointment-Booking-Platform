"""
Migration Script: Add tool_type column to tools table
Run this script to fix missing column error on test/prod environments

Usage:
    cd petties-agent-serivce
    python scripts/migrate_add_tool_type.py

Or with specific DATABASE_URL:
    DATABASE_URL=postgresql+asyncpg://... python scripts/migrate_add_tool_type.py
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


async def run_migration():
    """Add tool_type column to tools table if not exists"""

    # Get database URL from environment
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        print("Usage: DATABASE_URL=postgresql+asyncpg://... python scripts/migrate_add_tool_type.py")
        return False

    # Ensure asyncpg driver
    if "postgresql://" in database_url and "asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")

    print(f"Connecting to database...")

    engine = create_async_engine(database_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Check if column exists
            check_sql = text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tools' AND column_name = 'tool_type'
            """)
            result = await session.execute(check_sql)
            exists = result.fetchone()

            if exists:
                print("✅ Column 'tool_type' already exists in 'tools' table")
                return True

            # Add column if not exists
            print("Adding 'tool_type' column to 'tools' table...")

            alter_sql = text("""
                ALTER TABLE tools
                ADD COLUMN tool_type VARCHAR(20) DEFAULT 'code_based'
            """)
            await session.execute(alter_sql)
            await session.commit()

            print("✅ Successfully added 'tool_type' column")
            return True

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            await session.rollback()
            return False
        finally:
            await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)
