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
# Default pooling (QueuePool) is used for development.
# NullPool is used for production/staging/test to allow Neon DB to go idle (zero connections).
if settings.APP_ENV == "development":
    engine = create_async_engine(
        settings.ASYNC_DATABASE_URL,
        echo=settings.APP_DEBUG,
        future=True,
        pool_size=settings.DB_POOL_SIZE if hasattr(settings, "DB_POOL_SIZE") else 5,
        max_overflow=settings.DB_MAX_OVERFLOW if hasattr(settings, "DB_MAX_OVERFLOW") else 10,
    )
else:
    engine = create_async_engine(
        settings.ASYNC_DATABASE_URL,
        echo=settings.APP_DEBUG,
        future=True,
        poolclass=NullPool,
    )

# ===== CREATE ASYNC SESSION FACTORY =====
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ===== DEPENDENCY INJECTION =====
async def get_db() -> AsyncSession:
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

# ===== DATABASE INITIALIZATION & MIGRATION =====
def run_alembic_migrations():
    """
    Chạy Alembic migrations lập trình qua Python API.
    Tránh dùng subprocess để ổn định hơn trong Docker.
    """
    try:
        from alembic.config import Config
        from alembic import command
        import os

        # Tìm file alembic.ini
        # Thường nằm ở root của petties-agent-serivce
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        ini_path = os.path.join(base_dir, "alembic.ini")
        
        if not os.path.exists(ini_path):
            logger.warning(f"⚠️ alembic.ini not found at {ini_path}")
            return

        logger.info("🔄 Running database migrations via Alembic API...")
        alembic_cfg = Config(ini_path)
        # Chạy đồng bộ vì Alembic mặc định là sync
        command.upgrade(alembic_cfg, "head")
        logger.info("✅ Alembic migrations applied successfully")
    except Exception as e:
        logger.error(f"❌ Alembic migration failed: {e}")

async def init_db():
    """
    Initialize database - Chỉ chạy migrations qua Alembic.
    Cơ chế an toàn: Nếu phát hiện bảng đã tồn tại, sẽ dùng 'stamp head' thay vì upgrade.
    """
    try:
        from alembic.config import Config
        from alembic import command
        from sqlalchemy import text
        import os

        # Tìm file alembic.ini linh hoạt hơn
        curr_file = os.path.abspath(__file__)
        # Thử tìm ở các cấp độ thư mục khác nhau
        possible_ini_paths = [
            os.path.join(os.path.dirname(curr_file), "../../../alembic.ini"), # Relative to session.py
            os.path.join(os.getcwd(), "alembic.ini"),                         # Relative to CWD
            "/app/alembic.ini",                                                # Docker default
        ]
        
        ini_path = None
        for p in possible_ini_paths:
            if os.path.exists(p):
                ini_path = os.path.abspath(p)
                break
        
        if not ini_path:
            logger.warning("⚠️ Could not find alembic.ini in possible paths.")
            return

        alembic_cfg = Config(ini_path)
        
        # Đảm bảo script_location là đường dẫn tuyệt đối
        # Lấy script_location từ ini và chuyển thành tuyệt đối dựa trên vị trí của ini
        script_location = alembic_cfg.get_main_option("script_location")
        if script_location and not os.path.isabs(script_location):
            abs_script_location = os.path.join(os.path.dirname(ini_path), script_location)
            alembic_cfg.set_main_option("script_location", abs_script_location)

        # Kiểm tra xem có bảng nào của AI chưa (vd: bảng agents)
        async with engine.connect() as conn:
            result = await conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agents')"
            ))
            table_exists = result.scalar()

        # Kiểm tra xem đã có bảng alembic_version chưa
        async with engine.connect() as conn:
            result = await conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')"
            ))
            version_exists = result.scalar()

        if table_exists and not version_exists:
            logger.info("⚠️ Detected existing tables but no Alembic history. Stamping as head...")
            command.stamp(alembic_cfg, "head")
        else:
            logger.info("🔄 Running database migrations via Alembic API...")
            command.upgrade(alembic_cfg, "head")
            
        logger.info("✅ Database migration check completed")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

    # 2. Kiểm tra kết nối cuối cùng
    await test_db_connection()

# ===== DATABASE TERMINATION =====
async def close_db():
    await engine.dispose()
    logger.info("✅ Database connections closed")

# ===== TEST CONNECTION =====
async def test_db_connection():
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
    import asyncio
    asyncio.run(init_db())
