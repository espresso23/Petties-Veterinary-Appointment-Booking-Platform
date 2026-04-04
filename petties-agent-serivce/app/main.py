"""
PETTIES AGENT SERVICE - Main Application

FastAPI entry point for the Petties AI service.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.logging_config import get_logger, setup_logging
from app.config.settings import settings
from app.middleware.logging_middleware import LoggingMiddleware


setup_logging(
    log_level=settings.LOG_LEVEL,
    log_file=settings.LOG_FILE,
    sentry_dsn=settings.SENTRY_DSN,
    environment=settings.APP_ENV,
    enable_json_logging=(settings.APP_ENV == "production"),
)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Debug mode: {settings.APP_DEBUG}")

    try:
        from app.core.sentry import init_sentry

        init_sentry()
    except Exception as exc:
        logger.warning(f"Sentry init skipped: {exc}")

    try:
        from app.db.postgres.session import AsyncSessionLocal, init_db

        await init_db()
        logger.info("PostgreSQL database initialized")

        from app.core.init_db import init_qdrant

        await init_qdrant()
        logger.info("Qdrant vector database initialized")

        try:
            from app.core.rag.case_memory import get_case_memory_service

            await get_case_memory_service().initialize()
            logger.info("Case Memory collection initialized")
        except Exception as cm_err:
            logger.warning(f"Case Memory init skipped: {cm_err}")

        from app.db.postgres.seed import seed_data

        async with AsyncSessionLocal() as db:
            await seed_data(db)
            logger.info("Database auto-seeding check complete")

        try:
            from app.core.tools.scanner import tool_scanner

            scan_result = await tool_scanner.scan_and_sync_tools()
            logger.info(
                f"Tool auto-scan complete: {scan_result['total_tools']} tools, "
                f"{scan_result['new_tools']} new, {scan_result['updated_tools']} updated"
            )
        except Exception as scan_err:
            logger.warning(f"Tool auto-scan skipped: {scan_err}")

    except Exception as exc:
        logger.warning(f"PostgreSQL/Qdrant init skipped: {exc}")

    try:
        from app.core.database.mongodb import (
            create_mongodb_indexes,
            mongodb_health_check,
        )

        health = await mongodb_health_check()
        if health["status"] == "healthy":
            logger.info(
                f"MongoDB connected: {health['database']} ({len(health['collections'])} collections)"
            )
            await create_mongodb_indexes()
            logger.info("MongoDB indexes created")
        else:
            logger.warning(f"MongoDB unhealthy: {health['error']}")
    except Exception as exc:
        logger.warning(f"MongoDB init skipped: {exc}")

    logger.info("Application startup complete")
    yield

    logger.info("Shutting down application")

    try:
        from app.db.postgres.session import close_db

        await close_db()
        logger.info("PostgreSQL connections closed")
    except Exception as exc:
        logger.warning(f"PostgreSQL cleanup error: {exc}")

    try:
        from app.core.database.mongodb import close_mongodb_connection

        await close_mongodb_connection()
    except Exception as exc:
        logger.warning(f"MongoDB cleanup error: {exc}")

    try:
        from app.services.llm_client import close_llm_client

        await close_llm_client()
    except Exception as exc:
        logger.warning(f"LLM client cleanup error: {exc}")

    logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI Agent Service cho Petties - Veterinary Appointment Booking Platform",
    version=settings.APP_VERSION,
    debug=settings.APP_DEBUG,
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
)

app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    health_status = {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "databases": {},
    }

    try:
        from app.core.database.mongodb import mongodb_health_check

        mongo_health = await mongodb_health_check()
        health_status["databases"]["mongodb"] = {
            "status": mongo_health["status"],
            "database": mongo_health["database"],
            "collections_count": len(mongo_health["collections"]),
        }
    except Exception as exc:
        health_status["databases"]["mongodb"] = {"status": "error", "error": str(exc)}
        health_status["status"] = "degraded"

    return JSONResponse(status_code=200, content=health_status)


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs"
        if settings.APP_DEBUG
        else "Documentation disabled in production",
        "health": "/health",
        "websocket": "/ws/chat/{session_id}",
    }


from app.api.routes import (
    agents,
    chat,
    internal_case_memory,
    knowledge,
    staff_diagnosis,
    tools,
)
from app.api.routes import pet_health_summary
from app.api.routes import settings as settings_routes
from app.api.websocket import websocket_chat_endpoint

app.include_router(tools.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(settings_routes.router, prefix="/api/v1")
app.include_router(staff_diagnosis.router, prefix="/api/v1")
app.include_router(pet_health_summary.router, prefix="/api/v1")
app.include_router(internal_case_memory.router, prefix="/api/v1")


@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    logger.info(f"WebSocket request received: session_id={session_id}")
    await websocket_chat_endpoint(websocket, session_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.APP_DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
