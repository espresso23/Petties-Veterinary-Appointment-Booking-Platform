"""
PETTIES AGENT SERVICE - Application Settings
Pydantic Settings cho environment variables và configuration

Package: app.config
Purpose: Centralized configuration management, load từ .env file
Version: v0.0.1
"""

from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List, Union
import os


class Settings(BaseSettings):
    """
    Application Settings
    Load từ environment variables hoặc .env file
    """

    # ==================== Application Settings ====================
    APP_NAME: str = Field(default="Petties Agent Service", description="Tên ứng dụng")
    APP_ENV: str = Field(default="development", description="Environment: development, staging, production")
    APP_VERSION: str = Field(default="0.0.1", description="Version của service")
    APP_DEBUG: bool = Field(default=True, description="Debug mode")

    # Environment flag (Render sẽ set ENVIRONMENT=production)
    ENVIRONMENT: str = Field(default="development", description="Environment name")

    # ==================== Server Configuration ====================
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    WORKERS: int = Field(default=2, description="Số workers cho Uvicorn")
    # Dùng Union[str, List[str]] để tránh Pydantic parse như JSON
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="CORS allowed origins (comma-separated string or JSON array)"
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
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return ["http://localhost:3000", "http://localhost:5173"]

    # ==================== Database - PostgreSQL (Supabase) ====================
    # Option 1: Dùng DATABASE_URL trực tiếp (khuyến nghị cho production)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/petties_db",
        description="Database connection URL (Supabase)"
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
        description="Qdrant Cloud cluster URL"
    )
    QDRANT_API_KEY: str = Field(
        default="",
        description="Qdrant Cloud API key (bắt buộc)"
    )
    QDRANT_COLLECTION_NAME: str = Field(
        default="petties_knowledge_base",
        description="Collection name cho knowledge base vectors"
    )

    # ==================== AI/LLM Configuration ====================
    LLM_PROVIDER: str = Field(default="openai", description="LLM provider: openai, ollama")

    # OpenAI
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    OPENAI_EMBEDDING_MODEL: str = Field(
        default="text-embedding-3-small",
        description="OpenAI embedding model"
    )
    OPENAI_CHAT_MODEL: str = Field(default="gpt-4-turbo", description="OpenAI chat model")

    # Ollama (Self-hosted or Cloud) - Primary: kimi-k2 for Vietnamese reasoning & tool calling
    OLLAMA_BASE_URL: str = Field(
        default="http://localhost:11434",
        description="Ollama server URL (Local: http://localhost:11434 | Cloud: https://ollama.com)"
    )
    OLLAMA_API_KEY: str = Field(
        default="",
        description="Ollama Cloud API key (leave empty for local mode, set for cloud mode)"
    )
    OLLAMA_MODEL: str = Field(
        default="kimi-k2",
        description="Ollama LLM model (Local: kimi-k2 | Cloud: kimi-k2:1t-cloud | Alternatives: llama3, mistral, gemma, qwen2.5:7b)"
    )
    OLLAMA_EMBEDDING_MODEL: str = Field(
        default="nomic-embed-text",
        description="Ollama embedding model for RAG (nomic-embed-text recommended)"
    )

    # ==================== Agent Configuration ====================
    MAIN_AGENT_TEMPERATURE: float = Field(
        default=0.0,
        description="Main Agent temperature (0.0 = deterministic)"
    )
    MEDICAL_AGENT_TEMPERATURE: float = Field(
        default=0.5,
        description="Medical Agent temperature (0.5 = balanced)"
    )
    BOOKING_AGENT_TEMPERATURE: float = Field(
        default=0.0,
        description="Booking Agent temperature (0.0 = deterministic)"
    )
    RESEARCH_AGENT_TEMPERATURE: float = Field(
        default=0.3,
        description="Research Agent temperature"
    )
    MAX_TOKENS: int = Field(default=2000, description="Max tokens cho response")

    # ==================== RAG Configuration ====================
    CHUNK_SIZE: int = Field(default=1000, description="Document chunk size (characters)")
    CHUNK_OVERLAP: int = Field(default=200, description="Chunk overlap (characters)")
    TOP_K_RETRIEVAL: int = Field(default=5, description="Số documents retrieve từ vector store")
    SIMILARITY_THRESHOLD: float = Field(default=0.7, description="Similarity score threshold")

    # ==================== Web Search Configuration ====================
    DUCKDUCKGO_MAX_RESULTS: int = Field(default=5, description="Max DuckDuckGo search results")
    YOUTUBE_API_KEY: str = Field(default="", description="YouTube Data API key (optional)")

    # ==================== MCP Integration ====================
    SPRING_BACKEND_URL: str = Field(
        default="http://localhost:8080/api/v1",
        description="Spring Boot backend URL"
    )
    MCP_TIMEOUT: int = Field(default=30, description="MCP request timeout (seconds)")

    # ==================== Authentication & Security ====================
    SECRET_KEY: str = Field(
        default="your_super_secret_key_change_this_in_production",
        description="Secret key cho JWT signing"
    )
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expire time")

    # ==================== File Upload Configuration ====================
    UPLOAD_DIR: str = Field(default="./uploads", description="Upload directory")
    MAX_UPLOAD_SIZE: int = Field(default=10485760, description="Max upload size (10MB)")
    # Dùng Union[str, List[str]] để tránh Pydantic parse như JSON
    ALLOWED_EXTENSIONS: Union[str, List[str]] = Field(
        default=".pdf,.docx,.txt,.md",
        description="Allowed file extensions (comma-separated string or JSON array)"
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
            return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",") if ext.strip()]
        return [".pdf", ".docx", ".txt", ".md"]

    # ==================== Logging & Monitoring ====================
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FILE: str = Field(default="./logs/agent_service.log", description="Log file path")
    ENABLE_PROMETHEUS: bool = Field(default=True, description="Enable Prometheus metrics")

    # ==================== Redis (Optional) ====================
    REDIS_HOST: str = Field(default="localhost", description="Redis host")
    REDIS_PORT: int = Field(default=6379, description="Redis port")
    REDIS_PASSWORD: str = Field(default="", description="Redis password")
    REDIS_DB: int = Field(default=0, description="Redis database number")

    # ==================== Testing & Development ====================
    TEST_MODE: bool = Field(default=False, description="Test mode")
    MOCK_LLM_RESPONSES: bool = Field(default=False, description="Mock LLM responses")

    class Config:
        """Pydantic Config"""
        env_file = ".env"
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
    print(f"  OLLAMA_MODEL: {settings.OLLAMA_MODEL}")
    print("✅ Settings loaded successfully!")
