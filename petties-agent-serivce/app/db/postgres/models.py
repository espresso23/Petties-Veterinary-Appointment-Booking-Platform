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

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()


# ===== ENUMS =====
class ToolType(str, enum.Enum):
    """Tool types"""
    CODE_BASED = "code_based"    # FastMCP @mcp.tool decorators
    API_BASED = "api_based"      # Spring Boot API calls


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
    model = Column(String(100), default="google/gemini-2.0-flash-exp:free")  # OpenRouter model

    # Prompts
    system_prompt = Column(Text)

    # Status
    enabled = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    prompt_versions = relationship("PromptVersion", back_populates="agent")
    chat_sessions = relationship("ChatSession", back_populates="agent")

    def __repr__(self):
        return f"<Agent(name={self.name}, model={self.model})>"


# ===== TOOLS TABLE =====
class Tool(Base):
    """
    Tools Table (Code-based only)

    Purpose: Luu tru metadata cua Code-based tools (@mcp.tool)

    Note: Tools duoc code thu cong voi FastMCP.
    Admin co the enable/disable individual tools.

    Columns:
        - id: Primary key
        - name: Tool name (unique, vi du: check_slot, create_booking)
        - description: Mo ta chuc nang (semantic description cho LLM)
        - tool_type: Loai tool (code_based, api_based)
        - input_schema: JSON schema cho input parameters
        - output_schema: JSON schema cho output data
        - enabled: Tool co duoc enable khong
        - assigned_agents: JSON array voi agent names duoc phep dung
    """
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)  # Semantic description cho LLM
    # Use String instead of Enum for easier migration compatibility
    tool_type = Column(String(20), default="code_based")

    # Schema definition (JSON format)
    input_schema = Column(JSON)
    output_schema = Column(JSON)

    # Status & Assignment
    enabled = Column(Boolean, default=False)  # Default false, admin enable sau
    assigned_agents = Column(JSON)  # List of agent names: ["petties_agent"]

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Tool(name={self.name}, enabled={self.enabled})>"


# ===== PROMPT VERSIONS TABLE =====
class PromptVersion(Base):
    """
    Prompt Versions Table

    Purpose: Version control cho System Prompts
    Columns:
        - id: Primary key
        - agent_id: Foreign key den agents table
        - version: Version number (1, 2, 3, ...)
        - prompt_text: Noi dung prompt
        - is_active: Version nay co dang active khong
        - created_by: Admin user tao version nay
        - notes: Ghi chu ve thay doi
    """
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    version = Column(Integer, nullable=False)
    prompt_text = Column(Text, nullable=False)
    is_active = Column(Boolean, default=False)

    # Metadata
    created_by = Column(String(100))  # Admin username
    notes = Column(Text)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    agent = relationship("Agent", back_populates="prompt_versions")

    def __repr__(self):
        return f"<PromptVersion(agent_id={self.agent_id}, version={self.version})>"


# ===== CHAT SESSIONS TABLE =====
class ChatSession(Base):
    """
    Chat Sessions Table

    Purpose: Luu tru chat sessions giua users va agents
    Columns:
        - id: Primary key
        - agent_id: Foreign key den agents table
        - user_id: User ID tu Spring Boot backend
        - session_id: Session identifier
        - started_at: Thoi gian bat dau session
        - ended_at: Thoi gian ket thuc session
    """
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    user_id = Column(String(100), index=True)  # User ID tu backend
    session_id = Column(String(100), unique=True, nullable=False, index=True)

    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))

    # Relationships
    agent = relationship("Agent", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")

    def __repr__(self):
        return f"<ChatSession(session_id={self.session_id}, user_id={self.user_id})>"


# ===== CHAT MESSAGES TABLE =====
class ChatMessage(Base):
    """
    Chat Messages Table

    Purpose: Luu tru tung message trong chat session
    Columns:
        - id: Primary key
        - session_id: Foreign key den chat_sessions
        - role: Role cua message (user, assistant, system)
        - content: Noi dung message
        - metadata: JSON metadata (tool calls, thinking process, etc.)
        - timestamp: Thoi gian message
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    message_metadata = Column(JSON)  # Tool calls, ReAct steps, etc.

    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage(session_id={self.session_id}, role={self.role})>"


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
    file_size = Column(Integer)     # bytes

    # Processing status
    processed = Column(Boolean, default=False)
    vector_count = Column(Integer, default=0)

    # Metadata
    uploaded_by = Column(String(100))
    notes = Column(Text)

    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))

    def __repr__(self):
        return f"<KnowledgeDocument(filename={self.filename}, processed={self.processed})>"


# ===== SYSTEM SETTINGS TABLE =====
class SettingCategory(str, enum.Enum):
    """Setting categories for admin dashboard"""
    LLM = "llm"                    # OpenRouter settings
    RAG = "rag"                    # Cohere + Qdrant settings
    EMBEDDINGS = "embeddings"      # Cohere embeddings
    VECTOR_DB = "vector_db"        # Qdrant settings
    GENERAL = "general"            # General settings


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
    category = Column(Enum(SettingCategory), default=SettingCategory.GENERAL)
    is_sensitive = Column(Boolean, default=False)  # Encrypt value if True
    description = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        masked = "***" if self.is_sensitive else self.value[:20]
        return f"<SystemSetting(key={self.key}, value={masked})>"


# ===== DEFAULT SETTINGS =====
# Updated for Single Agent + OpenRouter + Cohere

DEFAULT_SETTINGS = [
    # ===== LLM - OpenRouter Cloud (PRIMARY) =====
    {"key": "OPENROUTER_API_KEY", "value": "", "category": "llm", "is_sensitive": True, "description": "OpenRouter Cloud API Key (https://openrouter.ai/keys)"},
    {"key": "OPENROUTER_DEFAULT_MODEL", "value": "google/gemini-2.0-flash-exp:free", "category": "llm", "is_sensitive": False, "description": "Default LLM model (free tier: gemini-2.0-flash-exp:free)"},
    {"key": "OPENROUTER_FALLBACK_MODEL", "value": "meta-llama/llama-3.3-70b-instruct", "category": "llm", "is_sensitive": False, "description": "Fallback model when primary fails"},

    # ===== LLM - DeepSeek (FALLBACK) =====
    {"key": "DEEPSEEK_API_KEY", "value": "", "category": "llm", "is_sensitive": True, "description": "DeepSeek API Key (https://platform.deepseek.com/api_keys)"},
    {"key": "DEEPSEEK_MODEL", "value": "deepseek-chat", "category": "llm", "is_sensitive": False, "description": "DeepSeek model (deepseek-chat for general, deepseek-coder for code)"},
    {"key": "DEEPSEEK_BASE_URL", "value": "https://api.deepseek.com", "category": "llm", "is_sensitive": False, "description": "DeepSeek API base URL"},

    # ===== RAG - Cohere Embeddings (RECOMMENDED) =====
    {"key": "COHERE_API_KEY", "value": "", "category": "rag", "is_sensitive": True, "description": "Cohere API Key for multilingual embeddings (https://dashboard.cohere.com/api-keys)"},
    {"key": "COHERE_EMBEDDING_MODEL", "value": "embed-multilingual-v3.0", "category": "rag", "is_sensitive": False, "description": "Cohere embedding model (multilingual for Vietnamese)"},

    # ===== RAG - OpenAI Embeddings (Backup) =====
    {"key": "OPENAI_API_KEY", "value": "", "category": "embeddings", "is_sensitive": True, "description": "OpenAI API key (backup for embeddings)"},
    {"key": "OPENAI_EMBEDDING_MODEL", "value": "text-embedding-3-small", "category": "embeddings", "is_sensitive": False, "description": "OpenAI embedding model"},

    # ===== Vector DB - Qdrant =====
    {"key": "QDRANT_URL", "value": "http://localhost:6333", "category": "vector_db", "is_sensitive": False, "description": "Qdrant server URL (local or Qdrant Cloud)"},
    {"key": "QDRANT_API_KEY", "value": "", "category": "vector_db", "is_sensitive": True, "description": "Qdrant API key (required for Qdrant Cloud)"},
    {"key": "QDRANT_COLLECTION_NAME", "value": "petties_knowledge_base", "category": "vector_db", "is_sensitive": False, "description": "Qdrant collection name for RAG"},
    
    # ===== General Settings =====
    {"key": "JWT_SECRET", "value": "", "category": "general", "is_sensitive": True, "description": "JWT Secret Key for token verification (Must match Spring Boot)"},
]



# ===== LEGACY SUPPORT =====
# Keep AgentType for backward compatibility during migration
# Will be removed in future version

class AgentType(str, enum.Enum):
    """
    [DEPRECATED] Agent types for Multi-Agent architecture

    Migrated to Single Agent architecture.
    Kept for backward compatibility during migration.
    Will be removed in v2.0.0
    """
    MAIN = "main"           # Main Agent (now: Single Agent)
    BOOKING = "booking"     # Deprecated
    MEDICAL = "medical"     # Deprecated
    RESEARCH = "research"   # Deprecated
