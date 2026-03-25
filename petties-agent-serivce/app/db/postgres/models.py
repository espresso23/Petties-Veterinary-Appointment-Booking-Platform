"""
PETTIES AGENT SERVICE - PostgreSQL Database Models
SQLAlchemy ORM models cho Agent configs, Tools, Prompts, Chat history

Package: app.db.postgres
Purpose: Define database schema cho Single Agent system
Version: v1.0.0 (Migrated from Multi-Agent to Single Agent)

Changes from v0.0.1:
- Removed AgentType enum (no longer Multi-Agent)
- Added top_p column to agents table
- Updated DEFAULT_SETTINGS with OpenRouter and Cohere keys
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    Float,
    DateTime,
    JSON,
    ForeignKey,
    Enum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()


# ===== ENUMS =====
class ToolType(str, enum.Enum):
    """Tool types"""

    CODE_BASED = "CODE_BASED"  # FastMCP @mcp.tool decorators
    API_BASED = "API_BASED"  # Spring Boot API calls


# ===== AGENTS TABLE =====
class Agent(Base):
    """
    Agents Table (Single Agent Architecture)

    Purpose: Luu tru cau hinh cua Single Agent (Petties AI Assistant)

    Note: Multi-Agent architecture da duoc migration sang Single Agent + ReAct.
    Chi can 1 agent entry voi dynamic system prompt va tools.

    Columns:
        - id: Primary key
        - name: Ten agent (unique) - "petties_agent"
        - description: Mo ta chuc nang
        - temperature: Temperature parameter (0.0-1.0)
        - max_tokens: Max tokens cho response
        - top_p: Top-P parameter (0.0-1.0) - NEW
        - model: LLM model name (OpenRouter model ID)
        - system_prompt: System prompt dinh nghia behavior
        - enabled: Agent co duoc enable khong
    """

    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)

    # LLM Configuration
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=2000)
    top_p = Column(Float, default=0.9)  # NEW: Top-P parameter
    model = Column(
        String(100), default="google/gemini-2.5-flash-lite"
    )  # OpenRouter model

    # NOTE: system_prompt column removed - prompt is now hardcoded in code
    # See: app/core/agents/single_agent.py DEFAULT_SYSTEM_PROMPT

    # Status
    enabled = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # NOTE: prompt_versions relationship removed - versioning no longer needed

    def __repr__(self):
        return f"<Agent(name={self.name}, model={self.model})>"


# ===== TOOLS TABLE =====
class Tool(Base):
    """
    Tools Table (Code-based only)

    Purpose: Luu tru metadata cua Code-based tools (@mcp.tool)

    Note: Tools duoc code thu cong voi FastMCP.
    Trong thuc te hien tai:
    - pet_knowledge_search va web_search co the bat/tat de test Playground
    - cac business tools duoc system-managed va auto-enable

    Columns:
        - id: Primary key
        - name: Tool name (unique, vi du: pet_knowledge_search, create_booking_for_user)
        - description: Mo ta chuc nang (semantic description cho LLM)
        - tool_type: Loai tool enum (CODE_BASED, API_BASED)
        - input_schema: JSON schema cho input parameters
        - output_schema: JSON schema cho output data
        - enabled: Tool co duoc enable khong
    """

    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)  # Semantic description cho LLM
    tool_type = Column(Enum(ToolType, name="tooltype"), default=ToolType.CODE_BASED)

    # Schema definition (JSON format)
    input_schema = Column(JSON)
    output_schema = Column(JSON)

    # Status
    enabled = Column(
        Boolean, default=False
    )  # Scanner/seed co the auto-enable theo policy

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Tool(name={self.name}, enabled={self.enabled})>"


# NOTE: PromptVersion table removed - prompt versioning no longer needed
# System prompt is now hardcoded in app/core/agents/single_agent.py
# Migration 005 removes prompt_versions table
# class PromptVersion(Base): ... (removed)


# ===== KNOWLEDGE BASE DOCUMENTS TABLE =====
class KnowledgeDocument(Base):
    """
    Knowledge Base Documents Table

    Purpose: Track uploaded documents cho RAG
    Columns:
        - id: Primary key
        - filename: Original filename
        - file_path: Path trong storage
        - file_type: PDF, DOCX, TXT, MD
        - file_size: Size in bytes
        - uploaded_by: Admin user upload
        - processed: Document da duoc chunked va embedded chua
        - vector_count: So vectors da tao
    """

    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(10))  # pdf, docx, txt, md
    file_size = Column(Integer)  # bytes

    # Processing status
    processed = Column(Boolean, default=False)
    vector_count = Column(Integer, default=0)  # Text vectors
    image_count = Column(Integer, default=0)  # Image vectors from PDF

    # Metadata
    uploaded_by = Column(String(100))
    notes = Column(Text)

    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))

    def __repr__(self):
        return (
            f"<KnowledgeDocument(filename={self.filename}, processed={self.processed})>"
        )


class DiseaseCatalog(Base):
    """
    Disease catalog for canonical diagnosis identities.

    Purpose:
    - Keep one canonical disease code shared by KB, KG, EMR and vision outputs
    - Attach protocol metadata for doctor diagnosis flow
    """

    __tablename__ = "disease_catalog"

    id = Column(Integer, primary_key=True, index=True)
    canonical_code = Column(String(100), unique=True, nullable=False, index=True)
    display_name_vi = Column(String(255), nullable=False)
    species = Column(String(50), default="all", nullable=False)
    body_system = Column(String(100))
    protocol_key = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    aliases = relationship(
        "DiseaseAlias",
        back_populates="disease",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<DiseaseCatalog(code={self.canonical_code}, active={self.is_active})>"


class DiseaseAlias(Base):
    """
    Alias table for disease mapping.

    Purpose:
    - Store per-source aliases that map back to one canonical disease code
    - Support DB-backed review and expansion without code deploy
    """

    __tablename__ = "disease_aliases"
    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "normalized_alias",
            "species",
            name="uq_disease_alias_source_normalized_species",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    canonical_code = Column(
        String(100),
        ForeignKey("disease_catalog.canonical_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type = Column(String(50), nullable=False, index=True)
    alias_text = Column(String(255), nullable=False)
    normalized_alias = Column(String(255), nullable=False, index=True)
    species = Column(String(50), default="all", nullable=False)
    review_status = Column(String(50), default="approved", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    disease = relationship("DiseaseCatalog", back_populates="aliases")

    def __repr__(self):
        return (
            f"<DiseaseAlias(source={self.source_type}, alias={self.alias_text}, "
            f"canonical_code={self.canonical_code})>"
        )


class DiseaseMappingReviewItem(Base):
    """
    Queue for unmapped diagnosis labels that need review.

    Purpose:
    - Persist labels from EMR/vision that cannot be mapped yet
    - Avoid silent skips during EMR -> case memory sync
    """

    __tablename__ = "disease_mapping_review_items"
    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "normalized_label",
            "species",
            name="uq_disease_mapping_review_source_normalized_species",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    raw_label = Column(String(255), nullable=False)
    normalized_label = Column(String(255), nullable=False, index=True)
    source_type = Column(String(50), nullable=False, index=True)
    species = Column(String(50), default="all", nullable=False)
    status = Column(String(50), default="pending", nullable=False)
    hit_count = Column(Integer, default=1, nullable=False)
    sample_payload = Column(JSON)

    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return (
            f"<DiseaseMappingReviewItem(raw_label={self.raw_label}, "
            f"source={self.source_type}, species={self.species})>"
        )


# ===== SYSTEM SETTINGS TABLE =====
class SettingCategory(str, enum.Enum):
    """Setting categories for admin dashboard"""

    LLM = "llm"  # OpenRouter settings
    RAG = "rag"  # Cohere + Qdrant settings
    EMBEDDINGS = "embeddings"  # Cohere embeddings
    VECTOR_DB = "vector_db"  # Qdrant settings
    GENERAL = "general"  # General settings
    WEB_SEARCH = "web_search"  # Web search (Tavily)


class SystemSetting(Base):
    """
    System Settings Table

    Purpose: Store configurable settings (API keys, URLs) that admin can edit via Dashboard
    instead of .env files. Sensitive values are encrypted.

    Categories:
        - llm: OpenRouter API key, model name
        - rag: Cohere API key for embeddings
        - vector_db: Qdrant URL and API key
    """

    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)  # Encrypted if is_sensitive=True
    category = Column(
        Enum(SettingCategory), default=SettingCategory.GENERAL
    )  # PostgreSQL enum type
    is_sensitive = Column(Boolean, default=False)  # Encrypt value if True
    description = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        masked = "***" if self.is_sensitive else self.value[:20]
        return f"<SystemSetting(key={self.key}, value={masked})>"


# ===== DEFAULT SETTINGS =====
# Updated for Single Agent + OpenRouter + Cohere

DEFAULT_SETTINGS = [
    # ===== LLM - OpenRouter Cloud (PRIMARY) =====
    {
        "key": "OPENROUTER_API_KEY",
        "value": "",
        "category": "llm",
        "is_sensitive": True,
        "description": "OpenRouter Cloud API Key (https://openrouter.ai/keys)",
    },
    {
        "key": "OPENROUTER_DEFAULT_MODEL",
        "value": "google/gemini-2.5-flash-lite",
        "category": "llm",
        "is_sensitive": False,
        "description": "Default LLM model (default stable model: google/gemini-2.5-flash-lite)",
    },
    {
        "key": "OPENROUTER_FALLBACK_MODEL",
        "value": "meta-llama/llama-3.3-70b-instruct",
        "category": "llm",
        "is_sensitive": False,
        "description": "Fallback model when primary fails",
    },
    # ===== RAG - Cohere Embeddings (RECOMMENDED) =====
    {
        "key": "COHERE_API_KEY",
        "value": "",
        "category": "rag",
        "is_sensitive": True,
        "description": "Cohere API Key for multilingual embeddings (https://dashboard.cohere.com/api-keys)",
    },
    {
        "key": "COHERE_EMBEDDING_MODEL",
        "value": "embed-multilingual-v3.0",
        "category": "rag",
        "is_sensitive": False,
        "description": "Cohere embedding model (multilingual for Vietnamese)",
    },
    # ===== Vector DB - Qdrant =====
    {
        "key": "QDRANT_URL",
        "value": "http://localhost:6333",
        "category": "vector_db",
        "is_sensitive": False,
        "description": "Qdrant server URL (local or Qdrant Cloud)",
    },
    {
        "key": "QDRANT_API_KEY",
        "value": "",
        "category": "vector_db",
        "is_sensitive": True,
        "description": "Qdrant API key (required for Qdrant Cloud)",
    },
    {
        "key": "QDRANT_COLLECTION_NAME",
        "value": "petties_knowledge_base",
        "category": "vector_db",
        "is_sensitive": False,
        "description": "Qdrant collection name for RAG",
    },
    # ===== Jina Embeddings (for Image Case Memory) =====
    {
        "key": "JINA_API_KEY",
        "value": "",
        "category": "embeddings",
        "is_sensitive": True,
        "description": "Jina AI API Key for image embeddings (https://jina.ai/)",
    },
    {
        "key": "JINA_IMAGE_EMBED_MODEL",
        "value": "jina-clip-v2",
        "category": "embeddings",
        "is_sensitive": False,
        "description": "Jina image embedding model (fixed: jina-clip-v2)",
    },
    # ===== Web Search - Tavily =====
    {
        "key": "TAVILY_API_KEY",
        "value": "",
        "category": "web_search",
        "is_sensitive": True,
        "description": "Tavily API Key for web search (https://tavily.com)",
    },
    {
        "key": "TAVILY_MAX_RESULTS",
        "value": "5",
        "category": "web_search",
        "is_sensitive": False,
        "description": "Max Tavily search results per query",
    },
    # ===== General Settings =====
    {
        "key": "JWT_SECRET",
        "value": "",
        "category": "general",
        "is_sensitive": True,
        "description": "JWT Secret Key for token verification (Must match Spring Boot)",
    },
]
