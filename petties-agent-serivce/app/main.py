"""
PETTIES AGENT SERVICE - Main Application
FastAPI entry point với LangGraph AI Agent system

Version: v0.0.1
Author: Petties Team
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config.settings import settings
from app.config.logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager cho FastAPI app

    Chạy khi:
    - Startup: Initialize database connections, load models, etc.
    - Shutdown: Cleanup resources
    """
    # ===== STARTUP =====
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Debug mode: {settings.APP_DEBUG}")

    # Initialize Sentry (error monitoring) - FIRST
    try:
        from app.core.sentry import init_sentry
        init_sentry()
    except Exception as e:
        logger.warning(f"⚠️ Sentry init skipped: {e}")

    # Initialize database
    try:
        from app.db.postgres.session import init_db
        await init_db()
        logger.info("✅ PostgreSQL database initialized")
        
        # Initialize Qdrant Collection
        from app.core.init_db import init_qdrant
        await init_qdrant()
        logger.info("✅ Qdrant vector database initialized")

        # Auto-seed PostgreSQL data if empty
        from app.db.postgres.seed import seed_data
        from app.db.postgres.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await seed_data(db)
            logger.info("✅ Database auto-seeding check complete")
    except Exception as e:
        logger.warning(f"⚠️ Database init skipped: {e}")

    logger.info("✅ Application startup complete")

    yield

    # ===== SHUTDOWN =====
    logger.info("🛑 Shutting down application")

    # Cleanup database connections
    try:
        from app.db.postgres.session import close_db
        await close_db()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.warning(f"⚠️ Database cleanup error: {e}")

    logger.info("✅ Application shutdown complete")


# ===== CREATE FASTAPI APP =====
app = FastAPI(
    title=settings.APP_NAME,
    description="AI Agent Service cho Petties - Veterinary Appointment Booking Platform",
    version=settings.APP_VERSION,
    debug=settings.APP_DEBUG,
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
)


# ===== CORS MIDDLEWARE =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # Use property to get List[str]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== HEALTH CHECK ENDPOINT =====
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint cho Docker healthcheck và monitoring
    """
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
        }
    )


# ===== ROOT ENDPOINT =====
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API information
    """
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.APP_DEBUG else "Documentation disabled in production",
        "health": "/health",
        "websocket": "/ws/chat/{session_id}",
    }


# ===== IMPORT ROUTERS =====
from app.api.routes import tools, agents, knowledge, chat
from app.api.routes import settings as settings_routes

# Tool Management Routes (TL-02, TL-03)
app.include_router(tools.router, prefix="/api/v1")

# Agent Management Routes (AG-01, AG-02, AG-03)
app.include_router(agents.router, prefix="/api/v1")

# Knowledge Base Routes (KB-01)
app.include_router(knowledge.router, prefix="/api/v1")

# Chat Session Routes
app.include_router(chat.router, prefix="/api/v1")

# System Settings Routes (API keys, LLM config, seed)
app.include_router(settings_routes.router, prefix="/api/v1")


# ===== WEBSOCKET ENDPOINT =====
from fastapi import WebSocket
from app.api.websocket import websocket_chat_endpoint

@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat"""
    logger.info(f"🔌 WebSocket request received: session_id={session_id}")
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
