import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import os
import sys

# Đảm bảo PYTHONPATH bao gồm thư mục gốc
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__name__), ".")))

# Import settings and models for autogenerate
from app.config.settings import settings
from app.db.postgres.models import Base

# this is the Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for 'autogenerate' support
target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    """
    DYNAMIC ALLOWLIST:
    Chỉ cho phép Alembic quản lý các bảng được định nghĩa trong SQLAlchemy Base.metadata
    và bảng quản lý version của chính nó. 
    Bỏ qua toàn bộ các bảng khác (của Spring Boot Flyway quản lý).
    """
    if type_ == "table":
        # 1. Lấy danh sách các bảng do AI Service định nghĩa
        ai_managed_tables = list(target_metadata.tables.keys())
        # 2. Thêm bảng version của chính alembic
        ai_managed_tables.append("alembic_version")
        
        # Chỉ xử lý nếu bảng nằm trong danh sách AI quản lý
        return name in ai_managed_tables
    
    # Đối với các object khác (index, constraint), chỉ xử lý nếu nó thuộc bảng AI
    return True

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.ASYNC_DATABASE_URL.replace("+asyncpg", "") # Alembic sync driver
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True, # Phát hiện thay đổi kiểu dữ liệu
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Build sync and async configurations
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = settings.ASYNC_DATABASE_URL
    
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool, # Offline connection for migration tool only
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    # Handle the event loop properly
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # If running inside FastAPI or other async context
        asyncio.create_task(run_migrations_online())
    else:
        asyncio.run(run_migrations_online())
