"""
PETTIES AGENT SERVICE - Application Settings
Pydantic Settings cho environment variables và configuration

Package: app.config
Purpose: Centralized configuration management, load từ .env file
Version: v0.0.1
"""

from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, model_validator
from typing import ClassVar, List, Set, Union
import os
import logging


class Settings(BaseSettings):
    """
    Application Settings
    Load từ environment variables hoặc .env file
    """

    # ==================== Application Settings ====================
    APP_NAME: str = Field(default="Petties Agent Service", description="Tên ứng dụng")
    APP_ENV: str = Field(
        default="development",
        description="Environment: development, staging, production",
    )
    APP_VERSION: str = Field(default="0.0.1", description="Version của service")
    APP_DEBUG: bool = Field(default=True, description="Debug mode")

    ENVIRONMENT: str = Field(default="development", description="Environment name")

    # ==================== Error Monitoring (Sentry) ====================
    SENTRY_DSN: str = Field(
        default="", description="Sentry DSN for error tracking (leave empty to disable)"
    )

    # ==================== Server Configuration ====================
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    WORKERS: int = Field(default=2, description="Số workers cho Uvicorn")
    # Dùng Union[str, List[str]] để tránh Pydantic parse như JSON
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="CORS allowed origins (comma-separated string or JSON array)",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS từ comma-separated string hoặc list"""
        if v is None:
            return "http://localhost:3000,http://localhost:5173"
        if isinstance(v, str):
            if v.strip() == "":
                return "http://localhost:3000,http://localhost:5173"
            return v  # Giữ nguyên string, sẽ convert trong property
        if isinstance(v, list):
            return ",".join(v)  # Convert list về string
        return "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS_ORIGINS as List[str]"""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            return [
                origin.strip()
                for origin in self.CORS_ORIGINS.split(",")
                if origin.strip()
            ]
        return ["http://localhost:3000", "http://localhost:5173"]

    # ==================== Database - PostgreSQL (Neon) ====================
    # Option 1: Dùng DATABASE_URL trực tiếp (khuyến nghị cho production)
    # IMPORTANT: Set DATABASE_URL in .env file, DO NOT hardcode credentials here
    DATABASE_URL: str = Field(
        default="",
        description="Database connection URL (Neon) - Must be set in .env file",
    )

    # Option 2: Dùng các biến riêng lẻ (cho development)
    DB_HOST: str = Field(default="localhost", description="PostgreSQL host")
    DB_PORT: int = Field(default=5432, description="PostgreSQL port")
    DB_NAME: str = Field(default="postgres", description="Database name")
    DB_USERNAME: str = Field(default="postgres", description="PostgreSQL user")
    DB_PASSWORD: str = Field(default="postgres", description="PostgreSQL password")

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        """
        Generate async DATABASE_URL với +asyncpg:// prefix
        Luôn đảm bảo URL có +asyncpg:// để dùng asyncpg driver
        """
        # Nếu DATABASE_URL đã có, convert nó thành async URL
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            # Convert postgresql:// to postgresql+asyncpg:// (nếu chưa có)
            if url.startswith("postgresql://") and "+asyncpg" not in url:
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            # Nếu đã có postgresql+asyncpg:// thì giữ nguyên
            elif url.startswith("postgresql+asyncpg://"):
                url = url  # Already correct
            # Remove sslmode từ URL cho asyncpg (xử lý khác)
            if "?sslmode" in url:
                url = url.split("?")[0]
            return url
        # Fallback: build từ các biến riêng lẻ
        return (
            f"postgresql+asyncpg://{self.DB_USERNAME}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # ==================== Vector Database - Qdrant Cloud ====================
    QDRANT_URL: str = Field(
        default="https://your-cluster-id.qdrant.io",
        description="Qdrant Cloud cluster URL",
    )
    QDRANT_API_KEY: str = Field(
        default="", description="Qdrant Cloud API key (bắt buộc)"
    )
    QDRANT_COLLECTION_NAME: str = Field(
        default="petties_knowledge_base",
        description="Collection name cho knowledge base vectors",
    )

    # ==================== MongoDB Configuration (Chat History & Audit Trail) ====================
    # MongoDB dùng để lưu chat history, ReAct traces, và proactive notifications
    MONGODB_URL: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URL (local hoặc MongoDB Atlas)",
    )
    MONGODB_DATABASE: str = Field(
        default="petties_ai", description="MongoDB database name cho AI service"
    )
    MONGODB_CHAT_SESSIONS_COLLECTION: str = Field(
        default="ai_chat_sessions",
        description="Collection name cho chat sessions metadata",
    )
    MONGODB_CHAT_MESSAGES_COLLECTION: str = Field(
        default="ai_chat_messages",
        description="Collection name cho chat messages + ReAct traces",
    )
    MONGODB_PROACTIVE_NOTIFICATIONS_COLLECTION: str = Field(
        default="ai_proactive_notifications",
        description="Collection name cho proactive notifications log",
    )
    MONGODB_FEEDBACK_COLLECTION: str = Field(
        default="chat_feedback",
        description="Collection name cho user feedback (thumbs up/down)",
    )
    MONGODB_KG_TRIPLETS_COLLECTION: str = Field(
        default="knowledge_graph_triplets",
        description="Collection name cho Knowledge Graph triplets (MongoDB)",
    )

    # ==================== AI/LLM Configuration ====================
    LLM_PROVIDER: str = Field(
        default="openrouter", description="LLM provider: openrouter"
    )

    # ===== OpenRouter (RECOMMENDED - Cloud API) =====
    OPENROUTER_API_KEY: str = Field(
        default="", description="OpenRouter Cloud API Key (https://openrouter.ai/keys)"
    )
    OPENROUTER_MODEL: str = Field(
        default="google/gemini-2.0-flash-lite-preview-02-05:free",
        description="OpenRouter LLM model (free tier: gemini-2.0-flash-lite-preview-02-05:free)",
    )
    OPENROUTER_FALLBACK_MODEL: str = Field(
        default="meta-llama/llama-3.3-70b-instruct",
        description="Fallback model when primary fails",
    )

    # ===== Cohere Embeddings (RECOMMENDED) =====
    COHERE_API_KEY: str = Field(
        default="",
        description="Cohere API Key for multilingual embeddings (https://dashboard.cohere.com/api-keys)",
    )
    COHERE_EMBEDDING_MODEL: str = Field(
        default="embed-multilingual-v3.0",
        description="Cohere embedding model (multilingual for Vietnamese)",
    )

    # ==================== Agent Configuration (Single Agent + ReAct) ====================
    AGENT_TEMPERATURE: float = Field(
        default=0.7, description="Single Agent temperature (0.7 = balanced creativity)"
    )
    AGENT_MAX_TOKENS: int = Field(
        default=2000, description="Max tokens cho agent response"
    )
    AGENT_TOP_P: float = Field(
        default=0.9, description="Top-P parameter for nucleus sampling"
    )
    REACT_MAX_ITERATIONS: int = Field(
        default=10, description="Max ReAct iterations before force stop"
    )
    MAX_TOKENS: int = Field(
        default=2000, description="Max tokens cho response (legacy)"
    )

    # ==================== RAG Configuration ====================
    CHUNK_SIZE: int = Field(
        default=1000, description="Document chunk size (characters)"
    )
    CHUNK_OVERLAP: int = Field(default=200, description="Chunk overlap (characters)")
    TOP_K_RETRIEVAL: int = Field(
        default=5, description="Số documents retrieve từ vector store"
    )
    SIMILARITY_THRESHOLD: float = Field(
        default=0.7, description="Similarity score threshold"
    )

    # ==================== Web Search Configuration ====================
    TAVILY_API_KEY: str = Field(default="", description="Tavily Search API key")
    TAVILY_MAX_RESULTS: int = Field(default=5, description="Max Tavily search results")
    YOUTUBE_API_KEY: str = Field(
        default="", description="YouTube Data API key (optional)"
    )
    DUCKDUCKGO_MAX_RESULTS: int = Field(
        default=5,
        description="Max DuckDuckGo search results (deprecated, use TAVILY_MAX_RESULTS)",
    )

    # ==================== MCP Integration ====================
    SPRING_BACKEND_URL: str = Field(
        default="http://localhost:8080/api", description="Spring Boot backend URL"
    )
    MCP_TIMEOUT: int = Field(default=30, description="MCP request timeout (seconds)")
    AI_INTERNAL_SYNC_KEY: str = Field(
        default="",
        description="Shared internal API key used by Spring Boot to push confirmed EMR into case memory",
    )

    # ==================== Authentication & Security ====================
    # CRITICAL: Must be set via environment variable (synced with Spring Boot)
    # Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
    JWT_SECRET: str = Field(
        default="",
        description="Secret key for JWT signing - synced with Spring Boot (REQUIRED in non-dev)",
    )
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30, description="Access token expire time"
    )

    @property
    def SECRET_KEY(self) -> str:
        """Backward compatibility property for code using settings.SECRET_KEY"""
        return self.JWT_SECRET

    # ==================== File Upload Configuration ====================
    UPLOAD_DIR: str = Field(default="./uploads", description="Upload directory")
    MAX_UPLOAD_SIZE: int = Field(default=10485760, description="Max upload size (10MB)")
    # Dùng Union[str, List[str]] để tránh Pydantic parse như JSON
    ALLOWED_EXTENSIONS: Union[str, List[str]] = Field(
        default=".pdf,.docx,.txt,.md",
        description="Allowed file extensions (comma-separated string or JSON array)",
    )

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v):
        """Parse ALLOWED_EXTENSIONS từ comma-separated string hoặc list"""
        if v is None:
            return ".pdf,.docx,.txt,.md"
        if isinstance(v, str):
            if v.strip() == "":
                return ".pdf,.docx,.txt,.md"
            return v  # Giữ nguyên string, sẽ convert trong property
        if isinstance(v, list):
            return ",".join(v)  # Convert list về string
        return ".pdf,.docx,.txt,.md"

    @property
    def allowed_extensions_list(self) -> List[str]:
        """Get ALLOWED_EXTENSIONS as List[str]"""
        if isinstance(self.ALLOWED_EXTENSIONS, list):
            return self.ALLOWED_EXTENSIONS
        if isinstance(self.ALLOWED_EXTENSIONS, str):
            return [
                ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",") if ext.strip()
            ]
        return [".pdf", ".docx", ".txt", ".md"]

    # ==================== Logging & Monitoring ====================
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FILE: str = Field(
        default="./logs/agent_service.log", description="Log file path"
    )
    ENABLE_PROMETHEUS: bool = Field(
        default=True, description="Enable Prometheus metrics"
    )

    # ==================== Redis (Optional) ====================
    REDIS_HOST: str = Field(default="localhost", description="Redis host")
    REDIS_PORT: int = Field(default=6379, description="Redis port")
    REDIS_PASSWORD: str = Field(default="", description="Redis password")
    REDIS_DB: int = Field(default=0, description="Redis database number")

    # ==================== Testing & Development ====================
    TEST_MODE: bool = Field(default=False, description="Test mode")
    MOCK_LLM_RESPONSES: bool = Field(default=False, description="Mock LLM responses")

    # ==================== Startup Validators ====================
    INSECURE_JWT_DEFAULTS: ClassVar[Set[str]] = {
        "",
        "petties-agent-service-secret-key-change-in-production",
        "change-me",
        "secret",
    }

    @model_validator(mode="after")
    def validate_jwt_secret_for_production(self) -> "Settings":
        """Prevent startup with insecure JWT secret in non-dev environments"""
        env = (self.ENVIRONMENT or self.APP_ENV or "development").lower()
        if env not in ("development", "test"):
            if self.JWT_SECRET in self.INSECURE_JWT_DEFAULTS:
                raise ValueError(
                    f"JWT_SECRET is empty or insecure for environment '{env}'. "
                    "Set a strong JWT_SECRET (min 32 chars) via environment variable."
                )
        elif not self.JWT_SECRET:
            _logger = logging.getLogger("app.config.settings")
            _logger.warning(
                "JWT_SECRET is empty in %s environment. "
                "Auth endpoints will reject all tokens until JWT_SECRET is configured.",
                env,
            )
        return self

    class Config:
        """Pydantic Config"""

        # Try loading from service .env AND root project .env
        env_file = [
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"
            ),
            os.path.join(
                os.path.dirname(
                    os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                ),
                ".env",
            ),
        ]
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields trong .env


# ===== CREATE GLOBAL SETTINGS INSTANCE =====
settings = Settings()


# ===== VALIDATE SETTINGS ON IMPORT =====
if __name__ == "__main__":
    print("🔧 Application Settings:")
    print(f"  APP_NAME: {settings.APP_NAME}")
    print(f"  APP_ENV: {settings.APP_ENV}")
    print(f"  APP_VERSION: {settings.APP_VERSION}")
    print(f"  DATABASE_URL: {settings.DATABASE_URL}")
    print(f"  QDRANT_URL: {settings.QDRANT_URL}")
    print(f"  LLM_PROVIDER: {settings.LLM_PROVIDER}")
    print("✅ Settings loaded successfully!")
