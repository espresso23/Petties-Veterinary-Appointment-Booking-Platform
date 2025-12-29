"""
PETTIES AGENT SERVICE - PostgreSQL Database Session
SQLAlchemy session management với async support

Package: app.db.postgres
Purpose: Database connection pool và session factory
Version: v0.0.1
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


# ===== CREATE ASYNC ENGINE =====
# create_async_engine: Tạo async engine cho PostgreSQL
# - echo=True trong debug mode để log SQL queries
# - poolclass=NullPool: Disable connection pooling (có thể thay bằng QueuePool cho production)
# - Sử dụng ASYNC_DATABASE_URL để đảm bảo có +asyncpg:// prefix
engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=settings.APP_DEBUG,
    poolclass=NullPool,
    future=True,
)


# ===== CREATE ASYNC SESSION FACTORY =====
# async_sessionmaker: Factory để tạo async sessions
# - expire_on_commit=False: Không expire objects sau commit (giảm DB queries)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ===== DEPENDENCY INJECTION =====
async def get_db() -> AsyncSession:
    """
    Dependency injection cho FastAPI routes

    Yields:
        AsyncSession instance

    Usage:
        @app.get("/agents")
        async def get_agents(db: AsyncSession = Depends(get_db)):
            # Use db session here
            pass

    Purpose:
        - Tạo session cho mỗi request
        - Tự động commit hoặc rollback
        - Đảm bảo session được close sau request
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            await session.close()


# ===== DATABASE INITIALIZATION =====
async def init_db():
    """
    Initialize database - Tạo tất cả tables và apply migrations

    Purpose:
        - Tạo tables từ SQLAlchemy models
        - Apply pending schema migrations (add missing columns)
        - Chạy khi application startup
    """
    from app.db.postgres.models import Base

    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created successfully")

    # Apply schema migrations for existing tables
    await apply_schema_migrations()


async def apply_schema_migrations():
    """
    Apply schema migrations for columns that might be missing in existing tables.
    This handles cases where create_all() doesn't add new columns to existing tables.
    """
    from sqlalchemy import text

    migrations = [
        # Add tool_type column to tools table
        {
            "check": "SELECT column_name FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'tool_type'",
            "apply": "ALTER TABLE tools ADD COLUMN tool_type VARCHAR(20) DEFAULT 'code_based'",
            "name": "tools.tool_type"
        },
        # Add top_p column to agents table
        {
            "check": "SELECT column_name FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'top_p'",
            "apply": "ALTER TABLE agents ADD COLUMN top_p FLOAT DEFAULT 0.9",
            "name": "agents.top_p"
        },
    ]

    async with AsyncSessionLocal() as session:
        for migration in migrations:
            try:
                # Check if column exists
                result = await session.execute(text(migration["check"]))
                exists = result.fetchone()

                if not exists:
                    # Apply migration
                    await session.execute(text(migration["apply"]))
                    await session.commit()
                    logger.info(f"✅ Applied migration: {migration['name']}")
                else:
                    logger.debug(f"Migration already applied: {migration['name']}")

            except Exception as e:
                logger.warning(f"⚠️ Migration {migration['name']} skipped: {e}")
                await session.rollback()


async def close_db():
    """
    Close database connections

    Purpose:
        - Cleanup khi application shutdown
        - Đóng connection pool
    """
    await engine.dispose()
    logger.info("✅ Database connections closed")


# ===== TEST CONNECTION =====
async def test_db_connection():
    """
    Test database connection

    Returns:
        True nếu kết nối thành công, False nếu thất bại

    Purpose:
        - Health check cho database
        - Verify connection string đúng
    """
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            logger.info("✅ Database connection successful")
            return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False


if __name__ == "__main__":
    # Test database connection
    import asyncio

    async def main():
        logger.info("Testing database connection...")
        success = await test_db_connection()
        if success:
            logger.info("Creating database tables...")
            await init_db()

    asyncio.run(main())
