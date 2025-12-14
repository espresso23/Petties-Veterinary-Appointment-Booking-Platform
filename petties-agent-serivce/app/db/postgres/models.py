"""
PETTIES AGENT SERVICE - PostgreSQL Database Models
SQLAlchemy ORM models cho Agent configs, Tools, Prompts, Chat history

Package: app.db.postgres
Purpose: Define database schema cho Agent system
Version: v0.0.1
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()


# ===== ENUMS =====
class AgentType(str, enum.Enum):
    """Agent types"""
    MAIN = "main"           # Main Agent (Supervisor)
    BOOKING = "booking"     # Booking Agent
    MEDICAL = "medical"     # Medical/Triage Agent
    RESEARCH = "research"   # Research Agent (Web search general-purpose)


# ===== AGENTS TABLE =====
class Agent(Base):
    """
    Agents Table

    Purpose: Lưu trữ cấu hình của Main Agent và Sub-Agents
    Columns:
        - id: Primary key
        - name: Tên agent (unique)
        - agent_type: Loại agent (main, booking, medical, research)
        - description: Mô tả chức năng
        - temperature: Temperature parameter (0.0-1.0)
        - max_tokens: Max tokens cho response
        - model: LLM model name (kimi-k2-thinking, llama, mistral, gemma2:9b, qwen2.5:7b, etc.)
        - system_prompt: System prompt định nghĩa behavior
        - enabled: Agent có được enable không
    """
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    agent_type = Column(Enum(AgentType), nullable=False)
    description = Column(Text)

    # LLM Configuration
    temperature = Column(Float, default=0.5)
    max_tokens = Column(Integer, default=2000)
    model = Column(String(100), default="gpt-4-turbo")

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
        return f"<Agent(name={self.name}, type={self.agent_type})>"


# ===== TOOLS TABLE =====
class Tool(Base):
    """
    Tools Table (Code-based only - v0.0.2)

    Purpose: Lưu trữ metadata của Code-based tools

    Note: Swagger/OpenAPI auto-import đã bị remove (xem TECHNICAL SCOPE v4.0)
    Tất cả tools được code thủ công với semantic descriptions cho LLM.

    Columns:
        - id: Primary key
        - name: Tool name (unique, ví dụ: check_slot, create_booking)
        - description: Mô tả chức năng (semantic description cho LLM)
        - input_schema: JSON schema cho input parameters
        - output_schema: JSON schema cho output data
        - enabled: Tool có được enable không
        - assigned_agents: JSON array với agent names được phép dùng
    """
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)  # Semantic description cho LLM

    # Schema definition (JSON format)
    input_schema = Column(JSON)
    output_schema = Column(JSON)

    # Status & Assignment
    enabled = Column(Boolean, default=False)  # Default false, admin enable sau
    assigned_agents = Column(JSON)  # List of agent names: ["booking_agent", "medical_agent"]

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
        - agent_id: Foreign key đến agents table
        - version: Version number (1, 2, 3, ...)
        - prompt_text: Nội dung prompt
        - is_active: Version này có đang active không
        - created_by: Admin user tạo version này
        - notes: Ghi chú về thay đổi
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

    Purpose: Lưu trữ chat sessions giữa users và agents
    Columns:
        - id: Primary key (UUID)
        - agent_id: Foreign key đến agents table (Main Agent)
        - user_id: User ID từ Spring Boot backend (MCP)
        - session_id: Session identifier
        - started_at: Thời gian bắt đầu session
        - ended_at: Thời gian kết thúc session
    """
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    user_id = Column(String(100), index=True)  # User ID từ backend
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

    Purpose: Lưu trữ từng message trong chat session
    Columns:
        - id: Primary key
        - session_id: Foreign key đến chat_sessions
        - role: Role của message (user, assistant, system)
        - content: Nội dung message
        - metadata: JSON metadata (tool calls, thinking process, etc.)
        - timestamp: Thời gian message
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    message_metadata = Column(JSON)  # Tool calls, routing path, etc.

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
        - processed: Document đã được chunked và embedded chưa
        - vector_count: Số vectors đã tạo
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
    LLM = "llm"                    # Ollama/Kimi settings
    EMBEDDINGS = "embeddings"      # OpenAI for embeddings
    VECTOR_DB = "vector_db"        # Qdrant settings
    GENERAL = "general"            # General settings


class SystemSetting(Base):
    """
    System Settings Table
    
    Purpose: Store configurable settings (API keys, URLs) that admin can edit via Dashboard
    instead of .env files. Sensitive values are encrypted.
    
    Categories:
        - llm: Ollama base URL, model name
        - embeddings: OpenAI API key for embeddings only
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
DEFAULT_SETTINGS = [
    # LLM - Ollama (Hybrid: Local or Cloud)
    {"key": "OLLAMA_BASE_URL", "value": "http://localhost:11434", "category": "llm", "is_sensitive": False, "description": "Ollama server URL (Local: http://localhost:11434 | Cloud: https://ollama.com)"},
    {"key": "OLLAMA_API_KEY", "value": "", "category": "llm", "is_sensitive": True, "description": "Ollama Cloud API key (empty = local mode, set = cloud mode)"},
    {"key": "OLLAMA_MODEL", "value": "kimi-k2", "category": "llm", "is_sensitive": False, "description": "Ollama model name (Local: kimi-k2 | Cloud: kimi-k2:1t-cloud)"},
    
    # Embeddings - OpenAI (ONLY for embeddings, not reasoning)
    {"key": "OPENAI_API_KEY", "value": "", "category": "embeddings", "is_sensitive": True, "description": "OpenAI API key for embeddings only"},
    {"key": "OPENAI_EMBEDDING_MODEL", "value": "text-embedding-ada-002", "category": "embeddings", "is_sensitive": False, "description": "OpenAI embedding model"},
    
    # Vector DB - Qdrant
    {"key": "QDRANT_URL", "value": "http://localhost:6333", "category": "vector_db", "is_sensitive": False, "description": "Qdrant server URL"},
    {"key": "QDRANT_API_KEY", "value": "", "category": "vector_db", "is_sensitive": True, "description": "Qdrant API key (optional for local)"},
]

