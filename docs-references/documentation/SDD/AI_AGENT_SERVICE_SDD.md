# SOFTWARE DESIGN DOCUMENT (SDD)
# PETTIES AI AGENT SERVICE

**Document Version:** 1.6.0
**Last Updated:** 2026-02-02
**Project:** Petties - Veterinary Appointment Booking Platform
**Component:** AI Agent Service (FastAPI + LangGraph + ReAct Pattern)

---

## TABLE OF CONTENTS

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Agent Architecture Design](#2-agent-architecture-design)
3. [RAG Pipeline Architecture](#3-rag-pipeline-architecture)
4. [API Design Specification](#4-api-design-specification)
5. [Database Design](#5-database-design)
6. [Sequence Diagrams](#6-sequence-diagrams)
7. [Class Diagrams](#7-class-diagrams)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level Architecture

Petties AI Agent Service được xây dựng theo kiến trúc **Single Agent với ReAct Pattern**, sử dụng **LangGraph** để orchestrate agent workflow và **FastMCP** để quản lý tools. Hệ thống không chỉ là chatbot đơn thuần mà là **trợ lý AI toàn diện** phục vụ Pet Owners (Mobile), Clinic Staff & Managers (Web), và Administrators.

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        WebApp["React Web App<br/>(Admin Dashboard)"]
        MobileApp["Flutter Mobile App<br/>(Pet Owner Chat)"]
    end

    subgraph APIGateway["API Gateway"]
        REST["REST Endpoints<br/>FastAPI"]
        WS["WebSocket<br/>Streaming Chat"]
    end

    subgraph AgentCore["Agent Core Layer"]
        SingleAgent["Single Agent<br/>(LangGraph + ReAct)"]
        ToolRegistry["Tool Registry<br/>(FastMCP)"]
        RAGEngine["RAG Engine<br/>(LlamaIndex)"]
    end

    subgraph LLMLayer["LLM Layer (Cloud)"]
        OpenRouter["OpenRouter API<br/>(Gemini/Llama/Claude)"]
        Cohere["Cohere API<br/>(Embeddings)"]
    end

    subgraph DataLayer["Data Layer"]
        PostgreSQL["PostgreSQL<br/>(Agent Config)"]
        Qdrant["Qdrant Cloud<br/>(Vector Store)"]
        MongoDB["MongoDB<br/>(Chat History)"]
    end

    subgraph BackendAPI["Backend API"]
        SpringBoot["Spring Boot<br/>(Business Logic)"]
    end

    WebApp --> REST
    MobileApp --> WS
    REST --> SingleAgent
    WS --> SingleAgent

    SingleAgent --> ToolRegistry
    SingleAgent --> RAGEngine
    SingleAgent --> OpenRouter

    RAGEngine --> Cohere
    RAGEngine --> Qdrant

    ToolRegistry --> SpringBoot
    ToolRegistry --> PostgreSQL

    SingleAgent --> PostgreSQL
    SingleAgent --> MongoDB
```

### 1.2 Service Layers

AI Agent Service được chia thành 5 layers chính:

```mermaid
flowchart TB
    subgraph Layer1["API Layer"]
        Routes["FastAPI Routes<br/>app/api/routes/"]
        Middleware["Auth Middleware<br/>JWT Verification"]
        Schemas["Pydantic Schemas<br/>Request/Response DTOs"]
    end

    subgraph Layer2["Core Layer"]
        Agent["Single Agent<br/>LangGraph ReAct"]
        Tools["MCP Tools<br/>FastMCP @tool"]
        RAG["RAG Engine<br/>LlamaIndex"]
    end

    subgraph Layer3["Service Layer"]
        LLMClient["LLM Client<br/>OpenRouter/DeepSeek"]
        EmbedService["Embedding Service<br/>Cohere"]
        ConfigLoader["Config Loader<br/>Database-first"]
    end

    subgraph Layer4["Data Layer"]
        PostgresDB["PostgreSQL<br/>SQLAlchemy Async"]
        VectorDB["Qdrant Cloud<br/>Vector Storage"]
        ChatDB["MongoDB<br/>Chat History"]
    end

    subgraph Layer5["External APIs"]
        BackendAPI["Spring Boot API<br/>Booking/Clinic/Pet"]
        CloudAPI["Cloud APIs<br/>OpenRouter/Cohere"]
    end

    Layer1 --> Layer2
    Layer2 --> Layer3
    Layer3 --> Layer4
    Layer2 --> Layer5
```

### 1.3 Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | FastAPI | 0.115+ | REST API và WebSocket server |
| **Agent Framework** | LangGraph | 0.2+ | ReAct pattern orchestration |
| **Tool Framework** | FastMCP | 2.x | Code-based tools với @mcp.tool |
| **RAG Framework** | LlamaIndex | 0.11+ | Document indexing và retrieval |
| **LLM Provider** | OpenRouter | Cloud API | Multi-model gateway (Gemini/Llama/Claude) |
| **Embeddings** | Cohere | embed-multilingual-v3.0 | Vietnamese multilingual embeddings |
| **Vector DB** | Qdrant Cloud | Managed | Vector storage với binary quantization |
| **Relational DB** | PostgreSQL | 16 | Agent config, tools, prompts |
| **Document DB** | MongoDB | 7 | Chat history và sessions |
| **Auth** | JWT | - | Spring Boot token verification |

---

## 2. AGENT ARCHITECTURE DESIGN

### 2.1 Single Agent + ReAct Pattern

Petties sử dụng **Single Agent architecture** thay vì Multi-Agent để đơn giản hóa cho MVP. Agent được implement với **ReAct pattern** (Reasoning + Acting) sử dụng LangGraph.

```mermaid
flowchart LR
    Start([User Query]) --> Think[Think Node<br/>LLM Reasoning]
    Think --> Decide{Need Tool?}

    Decide -->|Yes| Act[Act Node<br/>Execute Tool]
    Decide -->|No| Answer[Generate Answer]

    Act --> Observe[Observe Node<br/>Process Result]
    Observe --> Think

    Answer --> End([Return to User])

    style Think fill:#e1f5ff
    style Act fill:#fff4e1
    style Observe fill:#f0fff4
    style Answer fill:#ffe1f5
```

### 2.2 ReActState Structure

```python
from typing import TypedDict, List, Dict, Any

class ReActState(TypedDict):
    """
    State object cho LangGraph ReAct Agent
    Lưu trữ messages, tool_calls, observations trong suốt agent loop
    """
    # Input/Output
    messages: List[Dict[str, str]]  # Chat messages: [{"role": "user", "content": "..."}]

    # ReAct Loop Data
    thoughts: List[str]             # Agent reasoning process
    tool_calls: List[Dict[str, Any]]  # Tools đã gọi: [{"tool": "pet_care_qa", "params": {...}}]
    observations: List[str]         # Kết quả từ tools

    # Control Flow
    iteration: int                  # Số lần loop (prevent infinite loop)
    should_continue: bool           # Continue hoặc finish
    final_answer: str               # Câu trả lời cuối cùng
```

### 2.3 LangGraph StateGraph Flow

```mermaid
stateDiagram-v2
    [*] --> Initialize: User Query

    Initialize --> Think: Create ReActState

    Think --> DecideAction: LLM Reasoning

    DecideAction --> ExecuteTool: Need Tool
    DecideAction --> GenerateAnswer: No Tool Needed

    ExecuteTool --> Observe: Tool Result
    Observe --> Think: Add to Observations

    GenerateAnswer --> [*]: Return Final Answer

    note right of Think
        LLM analyzes:
        - User query
        - Previous observations
        - Available tools
    end note

    note right of ExecuteTool
        FastMCP executes:
        - pet_care_qa
        - symptom_search
        - search_clinics
        - check_slots
        - create_booking
        - analyze_pet_image (Vision)
    end note

    note right of Observe
        Parse tool result
        Update observations
        Check iteration limit
    end note
```

### 2.4 Agent Configuration

Agent được config động từ PostgreSQL database:

```python
class AgentConfig:
    """
    Dynamic Agent Configuration (loaded from PostgreSQL)
    """
    # Identity
    agent_name: str = "petties_agent"
    description: str = "Petties AI Assistant - Single Agent với ReAct pattern"

    # LLM Parameters
    model: str = "google/gemini-2.0-flash-exp:free"  # OpenRouter model
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9

    # System Prompt (versioned)
    system_prompt: str = """
    Bạn là trợ lý AI Petties, chuyên về chăm sóc thú cưng.

    Nhiệm vụ của bạn:
    1. Trả lời câu hỏi về chăm sóc thú cưng
    2. Chẩn đoán triệu chứng sơ bộ (sử dụng RAG)
    3. Hỗ trợ tìm phòng khám và đặt lịch

    Tools có sẵn:
    - pet_care_qa: Tìm kiếm kiến thức từ Knowledge Base
    - symptom_search: Tra cứu bệnh theo triệu chứng
    - search_clinics: Tìm phòng khám gần đây
    - check_slots: Kiểm tra slot trống
    - create_booking: Đặt lịch khám
    - analyze_pet_image: Phân tích hình ảnh sức khỏe thú cưng (Vision)

    Luôn:
    - Trích dẫn nguồn khi dùng RAG
    - Khuyên người dùng đến nhân viên thú y nếu triệu chứng nghiêm trọng
    - Sử dụng tool khi cần (không tự bịa thông tin)
    """

    # ReAct Control
    max_iterations: int = 5  # Prevent infinite loop

    # Status
    enabled: bool = True
```

### 2.5 Tool Execution Flow

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Single Agent
    participant Registry as Tool Registry
    participant MCP as FastMCP Server
    participant Tool as Tool Function
    participant External as External API/RAG

    Agent->>Registry: Get enabled tools
    Registry-->>Agent: List[Tool]

    Agent->>Agent: LLM decides tool + params

    Agent->>MCP: call_mcp_tool(name, params)
    MCP->>Tool: Execute @mcp.tool function

    Tool->>External: Call RAG/API/DB
    External-->>Tool: Return data

    Tool-->>MCP: Return result
    MCP-->>Agent: Tool result

    Agent->>Agent: Add to observations
    Agent->>Agent: Continue or finish?
```

---

## 3. RAG PIPELINE ARCHITECTURE

### 3.1 RAG Component Diagram

```mermaid
flowchart TB
    subgraph AdminUpload["Document Upload Flow"]
        Upload[Admin Upload PDF/DOCX]
        Extract[Text Extraction<br/>PyMuPDF/python-docx]
        Chunk[Chunking<br/>SentenceSplitter]
    end

    subgraph Indexing["LlamaIndex Indexing"]
        Embed[Cohere Embeddings<br/>embed-multilingual-v3.0]
        Store[Qdrant Cloud<br/>Vector Store]
        Meta[Metadata Storage<br/>PostgreSQL]
    end

    subgraph Retrieval["RAG Retrieval"]
        Query[User Query]
        QueryEmbed[Query Embedding]
        Search[Vector Search<br/>Cosine Similarity]
        Rerank[Score Filtering<br/>min_score threshold]
    end

    subgraph AgentUse["Agent Usage"]
        ToolCall[Tool: pet_care_qa]
        Context[Build Context]
        LLM[LLM Generation<br/>with Context]
    end

    Upload --> Extract
    Extract --> Chunk
    Chunk --> Embed
    Embed --> Store
    Store --> Meta

    Query --> QueryEmbed
    QueryEmbed --> Search
    Search --> Rerank
    Rerank --> ToolCall
    ToolCall --> Context
    Context --> LLM
```

### 3.2 LlamaIndex RAG Engine

```python
class LlamaIndexRAGEngine:
    """
    Full LlamaIndex integration for RAG

    Components:
    - VectorStoreIndex: Document indexing
    - SentenceSplitter: Chunking with overlap
    - CohereEmbedding: Multilingual embeddings
    - QdrantVectorStore: Cloud vector storage
    """

    def __init__(self):
        self.index: VectorStoreIndex = None
        self.vector_store: QdrantVectorStore = None
        self.qdrant_client: QdrantClient = None

    async def initialize(self):
        """
        Initialize LlamaIndex components

        Steps:
        1. Load Cohere API key from PostgreSQL
        2. Configure global Settings (embed_model, node_parser)
        3. Connect to Qdrant Cloud
        4. Create/load VectorStoreIndex
        """
        # Load API keys from database
        cohere_api_key = await get_setting("COHERE_API_KEY")
        qdrant_url = await get_setting("QDRANT_URL")
        qdrant_api_key = await get_setting("QDRANT_API_KEY")

        # Configure LlamaIndex Settings
        Settings.embed_model = CohereEmbedding(
            api_key=cohere_api_key,
            model_name="embed-multilingual-v3.0",
            input_type="search_document"
        )

        Settings.node_parser = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=50
        )

        # Connect to Qdrant Cloud
        self.qdrant_client = QdrantClient(
            url=qdrant_url,
            api_key=qdrant_api_key
        )

        # Create vector store
        self.vector_store = QdrantVectorStore(
            client=self.qdrant_client,
            collection_name="petties_knowledge_base"
        )

        # Create/load index
        storage_context = StorageContext.from_defaults(
            vector_store=self.vector_store
        )
        self.index = VectorStoreIndex.from_vector_store(
            self.vector_store,
            storage_context=storage_context
        )

    async def index_document(
        self,
        file_content: bytes,
        filename: str,
        document_id: int
    ) -> int:
        """
        Index document into knowledge base

        Returns: Number of chunks created
        """
        # Extract text
        text = self._extract_text(file_content, filename)

        # Create LlamaIndex Document
        doc = Document(
            text=text,
            metadata={
                "document_id": document_id,
                "filename": filename,
                "file_type": filename.split('.')[-1]
            }
        )

        # Index (LlamaIndex handles chunking + embedding + storage)
        self.index.refresh_ref_docs([doc])

        # Count chunks
        nodes = Settings.node_parser.get_nodes_from_documents([doc])
        return len(nodes)

    async def query(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.5
    ) -> List[RetrievedChunk]:
        """
        Query knowledge base

        Returns: List of relevant chunks with scores
        """
        # Create retriever
        retriever = self.index.as_retriever(
            similarity_top_k=top_k
        )

        # Retrieve nodes
        nodes = await asyncio.to_thread(retriever.retrieve, query)

        # Filter by score and format
        chunks = []
        for node in nodes:
            if node.score >= min_score:
                chunks.append(RetrievedChunk(
                    document_id=node.metadata.get("document_id"),
                    document_name=node.metadata.get("filename"),
                    content=node.text,
                    score=node.score
                ))

        return chunks
```

### 3.3 Document Processing Flow

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant API as Knowledge API
    participant RAG as RAG Engine
    participant Cohere as Cohere API
    participant Qdrant as Qdrant Cloud
    participant DB as PostgreSQL

    Admin->>API: POST /knowledge/upload (PDF file)
    API->>DB: Create KnowledgeDocument record
    DB-->>API: document_id

    API->>RAG: index_document(content, filename, doc_id)

    RAG->>RAG: Extract text (PyMuPDF)
    RAG->>RAG: Chunk text (SentenceSplitter 512 chars)

    loop For each chunk
        RAG->>Cohere: Embed chunk (embed-multilingual-v3.0)
        Cohere-->>RAG: Vector (1024 dim)
        RAG->>Qdrant: Upsert vector + metadata
    end

    Qdrant-->>RAG: Success
    RAG-->>API: chunks_count

    API->>DB: Update processed=True, vector_count
    API-->>Admin: Success response
```

### 3.4 RAG Query Flow

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Agent as Single Agent
    participant Tool as pet_care_qa Tool
    participant RAG as RAG Engine
    participant Cohere as Cohere API
    participant Qdrant as Qdrant Cloud

    User->>Agent: "Cách chăm sóc chó Poodle?"
    Agent->>Agent: Think: Cần tìm kiếm kiến thức
    Agent->>Tool: call_tool("pet_care_qa", query="chăm sóc chó Poodle")

    Tool->>RAG: query("chăm sóc chó Poodle", top_k=5)

    RAG->>Cohere: Embed query
    Cohere-->>RAG: Query vector

    RAG->>Qdrant: Search similar vectors (cosine)
    Qdrant-->>RAG: Top 5 chunks with scores

    RAG->>RAG: Filter by min_score=0.5
    RAG-->>Tool: List[RetrievedChunk]

    Tool->>Tool: Format results + build context
    Tool-->>Agent: Tool result with sources

    Agent->>Agent: Observe: Đã tìm thấy kiến thức
    Agent->>Agent: Generate answer với context
    Agent-->>User: Câu trả lời + citations
```

---

## 4. API DESIGN SPECIFICATION

### 4.1 REST API Endpoints

#### 4.1.1 Agent Management APIs

**GET /api/v1/agents**

**Description:** Lấy danh sách tất cả agents (hiện tại chỉ có 1 Single Agent)

**Authentication:** Bearer Token (ADMIN)

**Response (200 OK):**
```json
{
  "success": true,
  "agents": [
    {
      "id": 1,
      "name": "petties_agent",
      "description": "Petties AI Assistant - Single Agent với ReAct pattern",
      "model": "google/gemini-2.0-flash-exp:free",
      "temperature": 0.7,
      "max_tokens": 2000,
      "top_p": 0.9,
      "enabled": true,
      "system_prompt": "Bạn là trợ lý AI Petties...",
      "created_at": "2025-12-27T10:00:00Z",
      "updated_at": "2025-12-27T10:00:00Z"
    }
  ]
}
```

---

**PUT /api/v1/agents/{agent_id}**

**Description:** Cập nhật cấu hình agent (system prompt, model, parameters)

**Authentication:** Bearer Token (ADMIN)

**Request Body:**
```json
{
  "system_prompt": "Bạn là trợ lý AI Petties, chuyên về chăm sóc thú cưng...",
  "model": "meta-llama/llama-3.3-70b-instruct",
  "temperature": 0.8,
  "max_tokens": 2500,
  "top_p": 0.95,
  "enabled": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Agent cấu hình đã được cập nhật",
  "agent": {
    "id": 1,
    "name": "petties_agent",
    "model": "meta-llama/llama-3.3-70b-instruct",
    "temperature": 0.8,
    "updated_at": "2025-12-27T11:00:00Z"
  }
}
```

---

#### 4.1.2 Tool Management APIs

**GET /api/v1/tools**

**Description:** Lấy danh sách tất cả code-based tools

**Authentication:** Bearer Token (ADMIN)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| enabled | boolean | Filter theo enabled status |
| agent_name | string | Filter theo agent được assign |

**Response (200 OK):**
```json
{
  "total": 5,
  "tools": [
    {
      "id": 1,
      "name": "pet_care_qa",
      "description": "Tìm kiếm kiến thức chăm sóc thú cưng từ Knowledge Base (RAG Q&A)",
      "tool_type": "code_based",
      "enabled": true,
      "assigned_agents": ["petties_agent"],
      "created_at": "2025-12-27T10:00:00Z"
    },
    {
      "id": 2,
      "name": "symptom_search",
      "description": "Tìm bệnh dựa trên triệu chứng sử dụng RAG",
      "tool_type": "code_based",
      "enabled": true,
      "assigned_agents": ["petties_agent"],
      "created_at": "2025-12-27T10:00:00Z"
    }
  ]
}
```

---

**POST /api/v1/tools/scan**

**Description:** Scan FastMCP server để phát hiện code-based tools mới

**Authentication:** Bearer Token (ADMIN)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Code-based tools scanned successfully",
  "total_tools": 5,
  "new_tools": 2,
  "updated_tools": 0
}
```

---

**PUT /api/v1/tools/{tool_id}/enable**

**Description:** Bật/tắt tool (agent chỉ gọi được tools đang enabled)

**Authentication:** Bearer Token (ADMIN)

**Request Body:**
```json
{
  "enabled": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Tool enabled successfully",
  "tool_id": 1,
  "tool_name": "pet_care_qa",
  "enabled": true
}
```

---

#### 4.1.3 Knowledge Base APIs

**POST /api/v1/knowledge/upload**

**Description:** Upload tài liệu vào knowledge base (PDF, DOCX, TXT, MD)

**Authentication:** Bearer Token (ADMIN)

**Request:** multipart/form-data
```
file: [binary file]
notes: "Tài liệu về chăm sóc chó Poodle" (optional)
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document uploaded and indexed successfully",
  "document": {
    "id": 10,
    "filename": "cham_soc_poodle.pdf",
    "file_type": "pdf",
    "file_size": 1048576,
    "processed": true,
    "vector_count": 23,
    "uploaded_at": "2025-12-27T12:00:00Z"
  }
}
```

---

**GET /api/v1/knowledge/documents**

**Description:** Lấy danh sách tất cả documents trong knowledge base

**Authentication:** Bearer Token (ADMIN)

**Response (200 OK):**
```json
{
  "total": 15,
  "documents": [
    {
      "id": 10,
      "filename": "cham_soc_poodle.pdf",
      "file_type": "pdf",
      "file_size": 1048576,
      "processed": true,
      "vector_count": 23,
      "uploaded_by": "admin",
      "uploaded_at": "2025-12-27T12:00:00Z"
    }
  ]
}
```

---

**POST /api/v1/knowledge/query-test**

**Description:** Test RAG retrieval (Admin testing)

**Authentication:** Bearer Token (ADMIN)

**Request Body:**
```json
{
  "query": "cách chăm sóc chó Poodle",
  "top_k": 5,
  "min_score": 0.5
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "query": "cách chăm sóc chó Poodle",
  "results": [
    {
      "document_id": 10,
      "document_name": "cham_soc_poodle.pdf",
      "chunk_index": 2,
      "content": "Chó Poodle cần tắm rửa định kỳ 2-3 tuần/lần...",
      "score": 0.87
    }
  ],
  "total_results": 5
}
```

---

**DELETE /api/v1/knowledge/documents/{document_id}**

**Description:** Xóa document khỏi knowledge base (xóa cả vectors trong Qdrant)

**Authentication:** Bearer Token (ADMIN)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document deleted successfully",
  "document_id": 10,
  "vectors_deleted": 23
}
```

---

#### 4.1.4 System Settings APIs

**GET /api/v1/settings**

**Description:** Lấy tất cả system settings (API keys, config)

**Authentication:** Bearer Token (ADMIN)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter theo category (llm, rag, vector_db, general) |

**Response (200 OK):**
```json
{
  "total": 12,
  "settings": [
    {
      "key": "OPENROUTER_API_KEY",
      "value": "***",
      "category": "llm",
      "is_sensitive": true,
      "description": "OpenRouter Cloud API Key"
    },
    {
      "key": "OPENROUTER_DEFAULT_MODEL",
      "value": "google/gemini-2.0-flash-exp:free",
      "category": "llm",
      "is_sensitive": false,
      "description": "Default LLM model"
    }
  ]
}
```

---

**PUT /api/v1/settings/{key}**

**Description:** Cập nhật system setting (API keys, URLs, model configs)

**Authentication:** Bearer Token (ADMIN)

**Request Body:**
```json
{
  "value": "sk-or-v1-xxxxx"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Setting updated successfully",
  "key": "OPENROUTER_API_KEY",
  "updated_at": "2025-12-27T13:00:00Z"
}
```

---

### 4.2 WebSocket Protocol

**WS /ws/chat/{session_id}**

**Description:** WebSocket endpoint cho real-time streaming chat với Single Agent

**Authentication:** Query parameter `token` (JWT)

**Connection:**
```
ws://localhost:8000/ws/chat/abc-123?token=eyJhbGciOiJIUzI1NiIs...
```

**Client → Server Messages:**

```json
{
  "type": "message",
  "content": "Chó nhà tôi bị nôn, cần làm gì?"
}
```

**Server → Client Messages:**

**1. Thinking Event:**
```json
{
  "type": "thinking",
  "thought": "User hỏi về triệu chứng nôn ở chó. Tôi nên dùng tool symptom_search để tìm bệnh có thể."
}
```

**2. Tool Call Event:**
```json
{
  "type": "tool_call",
  "tool_name": "symptom_search",
  "parameters": {
    "symptoms": ["nôn"],
    "pet_type": "dog"
  }
}
```

**3. Observation Event:**
```json
{
  "type": "observation",
  "tool_name": "symptom_search",
  "result": {
    "possible_conditions": [
      {
        "name": "Viêm dạ dày",
        "severity": "vừa",
        "description": "..."
      }
    ],
    "urgent": false
  }
}
```

**4. Streaming Response:**
```json
{
  "type": "response",
  "content": "Dựa trên",
  "delta": true
}
```

```json
{
  "type": "response",
  "content": " triệu chứng nôn,",
  "delta": true
}
```

**5. Final Response:**
```json
{
  "type": "done",
  "content": "Dựa trên triệu chứng nôn, chó nhà bạn có thể bị viêm dạ dày. Nên đặt lịch khám trong 24-48 giờ để nhân viên thú y chẩn đoán chính xác.",
  "sources": [
    {
      "type": "knowledge_base",
      "document_name": "benh_tieu_hoa_cho.pdf"
    }
  ]
}
```

**6. Error Event:**
```json
{
  "type": "error",
  "error": "Failed to connect to LLM service",
  "code": "LLM_ERROR"
}
```

---

## 5. DATABASE DESIGN

### 5.1 PostgreSQL Schema

```mermaid
erDiagram
    AGENTS ||--o{ PROMPT_VERSIONS : has
    AGENTS ||--o{ CHAT_SESSIONS : handles
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
    KNOWLEDGE_DOCUMENTS }o--|| AGENTS : "used_by"
    TOOLS }o--o{ AGENTS : "assigned_to"

    AGENTS {
        int id PK
        string name UK "petties_agent"
        text description
        float temperature "0.7"
        int max_tokens "2000"
        float top_p "0.9"
        string model "google/gemini-2.0-flash-exp:free"
        text system_prompt
        boolean enabled "true"
        timestamp created_at
        timestamp updated_at
    }

    TOOLS {
        int id PK
        string name UK "pet_care_qa"
        text description
        enum tool_type "code_based/api_based"
        json input_schema
        json output_schema
        boolean enabled "false"
        json assigned_agents "['petties_agent']"
        timestamp created_at
        timestamp updated_at
    }

    PROMPT_VERSIONS {
        int id PK
        int agent_id FK
        int version "1,2,3..."
        text prompt_text
        boolean is_active "false"
        string created_by "admin"
        text notes
        timestamp created_at
    }

    CHAT_SESSIONS {
        int id PK
        int agent_id FK
        string user_id "from Spring Boot"
        string session_id UK
        timestamp started_at
        timestamp ended_at
    }

    CHAT_MESSAGES {
        int id PK
        int session_id FK
        string role "user/assistant/system"
        text content
        json message_metadata "tool_calls, ReAct steps"
        timestamp timestamp
    }

    KNOWLEDGE_DOCUMENTS {
        int id PK
        string filename
        string file_path
        string file_type "pdf/docx/txt/md"
        int file_size
        boolean processed "false"
        int vector_count "0"
        string uploaded_by
        text notes
        timestamp uploaded_at
        timestamp processed_at
    }

    SYSTEM_SETTINGS {
        int id PK
        string key UK "OPENROUTER_API_KEY"
        text value "encrypted if sensitive"
        enum category "llm/rag/vector_db/general"
        boolean is_sensitive "true/false"
        text description
        timestamp created_at
        timestamp updated_at
    }
```

### 5.2 Table Specifications

#### Table: `agents`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | auto | Primary key |
| name | VARCHAR(100) | NO | - | Tên agent (unique) |
| description | TEXT | YES | - | Mô tả chức năng |
| temperature | FLOAT | YES | 0.7 | Temperature parameter (0.0-1.0) |
| max_tokens | INTEGER | YES | 2000 | Max tokens cho response |
| top_p | FLOAT | YES | 0.9 | Top-P parameter (0.0-1.0) |
| model | VARCHAR(100) | YES | gemini-2.0-flash-exp:free | OpenRouter model ID |
| system_prompt | TEXT | YES | - | System prompt định nghĩa behavior |
| enabled | BOOLEAN | YES | true | Agent có được enable không |
| created_at | TIMESTAMP | NO | now() | Thời gian tạo |
| updated_at | TIMESTAMP | YES | - | Thời gian cập nhật |

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `name`

---

#### Table: `tools`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | auto | Primary key |
| name | VARCHAR(100) | NO | - | Tool name (unique) |
| description | TEXT | YES | - | Semantic description cho LLM |
| tool_type | ENUM | YES | code_based | Tool type (code_based, api_based) |
| input_schema | JSON | YES | - | JSON schema cho input parameters |
| output_schema | JSON | YES | - | JSON schema cho output data |
| enabled | BOOLEAN | YES | false | Tool có được enable không |
| assigned_agents | JSON | YES | - | List of agent names: ["petties_agent"] |
| created_at | TIMESTAMP | NO | now() | Thời gian tạo |
| updated_at | TIMESTAMP | YES | - | Thời gian cập nhật |

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `name`

---

#### Table: `system_settings`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | NO | auto | Primary key |
| key | VARCHAR(100) | NO | - | Setting key (unique) |
| value | TEXT | NO | - | Setting value (encrypted if is_sensitive=true) |
| category | ENUM | YES | general | Category (llm, rag, vector_db, general) |
| is_sensitive | BOOLEAN | YES | false | Encrypt value if true |
| description | TEXT | YES | - | Mô tả setting |
| created_at | TIMESTAMP | NO | now() | Thời gian tạo |
| updated_at | TIMESTAMP | YES | now() | Thời gian cập nhật |

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE: `key`

**Sample Data:**
```sql
INSERT INTO system_settings (key, value, category, is_sensitive, description) VALUES
('OPENROUTER_API_KEY', '', 'llm', true, 'OpenRouter Cloud API Key'),
('OPENROUTER_DEFAULT_MODEL', 'google/gemini-2.0-flash-exp:free', 'llm', false, 'Default LLM model'),
('COHERE_API_KEY', '', 'rag', true, 'Cohere API Key for embeddings'),
('QDRANT_URL', 'https://xxx.qdrant.io', 'vector_db', false, 'Qdrant Cloud URL'),
('QDRANT_API_KEY', '', 'vector_db', true, 'Qdrant Cloud API Key');
```

---

### 5.3 Qdrant Vector Database Schema

**Collection Name:** `petties_knowledge_base`

**Vector Config:**
- **Dimension:** 1024 (Cohere embed-multilingual-v3.0)
- **Distance:** Cosine
- **Optimization:** Binary Quantization enabled

**Point Structure:**
```json
{
  "id": "uuid-string",
  "vector": [0.123, 0.456, ...],  // 1024 dimensions
  "payload": {
    "document_id": 10,
    "document_name": "cham_soc_poodle.pdf",
    "filename": "cham_soc_poodle.pdf",
    "file_type": "pdf",
    "chunk_index": 2,
    "text": "Chó Poodle cần tắm rửa định kỳ 2-3 tuần/lần..."
  }
}
```

**Indexes:**
- Vector index: HNSW (Hierarchical Navigable Small World)
- Payload index: `document_id`, `filename` (for filtering)

---

### 5.4 MongoDB Schema (Chat History)

**Collection Name:** `chat_history`

**Document Structure:**
```javascript
{
  "_id": ObjectId("..."),
  "session_id": "abc-123",
  "user_id": "USER_456",
  "agent_id": 1,
  "messages": [
    {
      "role": "user",
      "content": "Chó nhà tôi bị nôn, cần làm gì?",
      "timestamp": ISODate("2025-12-27T14:00:00Z")
    },
    {
      "role": "assistant",
      "content": "Dựa trên triệu chứng nôn...",
      "timestamp": ISODate("2025-12-27T14:00:05Z"),
      "metadata": {
        "thoughts": ["User hỏi về triệu chứng nôn..."],
        "tool_calls": [
          {
            "tool": "symptom_search",
            "params": {"symptoms": ["nôn"], "pet_type": "dog"},
            "result": {...}
          }
        ],
        "sources": [
          {"type": "knowledge_base", "document": "benh_tieu_hoa_cho.pdf"}
        ]
      }
    }
  ],
  "created_at": ISODate("2025-12-27T14:00:00Z"),
  "updated_at": ISODate("2025-12-27T14:00:05Z")
}
```

**Indexes:**
- `session_id` (unique)
- `user_id`
- `created_at` (TTL index: 90 days)

---

## 6. SEQUENCE DIAGRAMS

### 6.1 Agent Invocation Flow (REST)

```mermaid
sequenceDiagram
    autonumber
    participant User as Pet Owner
    participant Mobile as Flutter Mobile
    participant API as FastAPI
    participant Auth as Auth Middleware
    participant Agent as Single Agent
    participant LLM as OpenRouter
    participant DB as PostgreSQL

    User->>Mobile: Nhập câu hỏi
    Mobile->>API: POST /api/v1/chat/sessions/{id}/messages
    API->>Auth: Verify JWT token
    Auth-->>API: User authenticated

    API->>DB: Load agent config
    DB-->>API: AgentConfig

    API->>Agent: invoke(user_query, config)

    Agent->>Agent: Initialize ReActState
    Agent->>LLM: Generate thoughts (system_prompt + user_query)
    LLM-->>Agent: Thought: "Cần dùng tool symptom_search"

    Agent->>Agent: Extract tool_name + params
    Agent->>Agent: call_mcp_tool("symptom_search", params)
    Agent->>Agent: Add observation to state

    Agent->>LLM: Generate final answer (with observations)
    LLM-->>Agent: Final answer

    Agent-->>API: Response + metadata
    API->>DB: Save chat message
    API-->>Mobile: JSON Response
    Mobile-->>User: Hiển thị câu trả lời
```

---

### 6.2 WebSocket Chat Flow với ReAct Streaming

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Mobile as Mobile App
    participant WS as WebSocket /ws/chat
    participant Agent as Single Agent
    participant Tools as Tool Registry
    participant LLM as OpenRouter
    participant RAG as RAG Engine

    User->>Mobile: Nhập: "Cách chăm sóc chó Poodle?"
    Mobile->>WS: Connect + send message

    WS->>Agent: Start ReAct loop

    Agent->>LLM: Generate thought
    LLM-->>Agent: "Cần tìm kiếm kiến thức về Poodle"
    Agent->>WS: emit("thinking", thought)
    WS-->>Mobile: Display thinking

    Agent->>Tools: call_tool("pet_care_qa", query="chăm sóc chó Poodle")
    Agent->>WS: emit("tool_call", tool_name + params)
    WS-->>Mobile: Display tool execution

    Tools->>RAG: query("chăm sóc chó Poodle")
    RAG-->>Tools: Retrieved chunks + sources
    Tools-->>Agent: Tool result

    Agent->>WS: emit("observation", result)
    WS-->>Mobile: Display observation

    Agent->>LLM: Generate answer (streaming)

    loop Streaming tokens
        LLM-->>Agent: Token chunk
        Agent->>WS: emit("response", delta=true)
        WS-->>Mobile: Display token
    end

    Agent->>WS: emit("done", final_response + sources)
    WS-->>Mobile: Show sources
    Mobile-->>User: Hiển thị câu trả lời hoàn chỉnh
```

---

### 6.3 Tool Execution Flow (pet_care_qa)

```mermaid
sequenceDiagram
    autonumber
    participant Agent
    participant MCP as FastMCP Server
    participant Tool as pet_care_qa
    participant RAG as RAG Engine
    participant Cohere as Cohere API
    participant Qdrant as Qdrant Cloud

    Agent->>MCP: call_mcp_tool("pet_care_qa", {"query": "chăm sóc chó Poodle"})
    MCP->>Tool: Execute @mcp.tool function

    Tool->>RAG: query("chăm sóc chó Poodle", top_k=5)

    RAG->>Cohere: POST /embed (query text)
    Cohere-->>RAG: Query vector [1024 dim]

    RAG->>Qdrant: Search similar vectors (cosine)
    Qdrant-->>RAG: Top 5 chunks with scores

    RAG->>RAG: Filter by min_score=0.5
    RAG-->>Tool: List[RetrievedChunk]

    Tool->>Tool: Build context from chunks
    Tool->>Tool: Format result with sources

    Tool-->>MCP: Return result dict
    MCP-->>Agent: Tool execution result

    Agent->>Agent: Add to observations
    Agent->>Agent: Continue ReAct loop or finish
```

---

### 6.4 Document Upload and Indexing Flow

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant WebApp as Admin Dashboard
    participant API as Knowledge API
    participant DB as PostgreSQL
    participant RAG as RAG Engine
    participant Cohere as Cohere API
    participant Qdrant as Qdrant Cloud

    Admin->>WebApp: Upload PDF file
    WebApp->>API: POST /knowledge/upload (multipart)

    API->>DB: INSERT KnowledgeDocument (processed=false)
    DB-->>API: document_id

    API->>RAG: index_document(file_content, filename, doc_id)

    RAG->>RAG: Extract text (PyMuPDF)
    RAG->>RAG: Chunk text (SentenceSplitter 512 chars)

    Note over RAG: 23 chunks created

    loop For each chunk (23 chunks)
        RAG->>Cohere: POST /embed (chunk text)
        Cohere-->>RAG: Vector [1024 dim]

        RAG->>Qdrant: Upsert point (vector + metadata)
        Qdrant-->>RAG: Success
    end

    RAG-->>API: chunks_count = 23

    API->>DB: UPDATE processed=true, vector_count=23
    API-->>WebApp: Success response
    WebApp-->>Admin: Upload successful
```

---

### 6.5 RAG Query Test Flow (Admin Testing)

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant WebApp as Admin Dashboard
    participant API as Knowledge API
    participant RAG as RAG Engine
    participant Cohere as Cohere API
    participant Qdrant as Qdrant Cloud

    Admin->>WebApp: Nhập query test: "cách chăm sóc chó Poodle"
    WebApp->>API: POST /knowledge/query-test

    API->>RAG: query("cách chăm sóc chó Poodle", top_k=5)

    RAG->>Cohere: POST /embed (query)
    Cohere-->>RAG: Query vector

    RAG->>Qdrant: Search (cosine similarity)
    Qdrant-->>RAG: Top 5 results with scores

    RAG->>RAG: Filter by min_score=0.5
    RAG-->>API: List[RetrievedChunk] (3 results)

    API-->>WebApp: JSON response with chunks
    WebApp-->>Admin: Display results with sources

    Note over Admin: Admin verifies:<br/>- Relevant chunks returned<br/>- Scores > threshold<br/>- Correct document sources
```

---

## 7. CLASS DIAGRAMS

### 7.1 Agent Core Classes

```mermaid
classDiagram
    class SingleAgent {
        +str agent_name
        +AgentConfig config
        +StateGraph graph
        +ToolRegistry tool_registry
        +invoke(query: str) Response
        -_think_node(state: ReActState) ReActState
        -_act_node(state: ReActState) ReActState
        -_observe_node(state: ReActState) ReActState
        -_should_continue(state: ReActState) str
    }

    class AgentConfig {
        +str agent_name
        +str model
        +float temperature
        +int max_tokens
        +float top_p
        +str system_prompt
        +int max_iterations
        +bool enabled
        +from_database(agent_id: int) AgentConfig
    }

    class ReActState {
        +List~Message~ messages
        +List~str~ thoughts
        +List~ToolCall~ tool_calls
        +List~str~ observations
        +int iteration
        +bool should_continue
        +str final_answer
    }

    class ToolRegistry {
        +Dict~str, Tool~ tools
        +get_enabled_tools() List~Tool~
        +call_tool(name: str, params: dict) Any
        +scan_tools() ScanResult
    }

    class ToolCall {
        +str tool_name
        +dict parameters
        +Any result
        +float execution_time
    }

    class LLMClient {
        +str provider
        +str model
        +generate(prompt: str, config: dict) str
        +stream(prompt: str, config: dict) Iterator~str~
    }

    SingleAgent --> AgentConfig : uses
    SingleAgent --> ReActState : manages
    SingleAgent --> ToolRegistry : uses
    SingleAgent --> LLMClient : uses
    ReActState --> ToolCall : contains
```

---

### 7.2 RAG Engine Classes

```mermaid
classDiagram
    class LlamaIndexRAGEngine {
        +VectorStoreIndex index
        +QdrantVectorStore vector_store
        +QdrantClient qdrant_client
        +str collection_name
        +initialize() void
        +index_document(content: bytes, filename: str, doc_id: int) int
        +query(query: str, top_k: int, min_score: float) List~RetrievedChunk~
        +delete_document(doc_id: int) int
        +get_status() dict
        -_extract_text(content: bytes, filename: str) str
    }

    class VectorStoreIndex {
        +QdrantVectorStore vector_store
        +as_retriever(top_k: int) Retriever
        +refresh_ref_docs(docs: List~Document~) void
    }

    class QdrantVectorStore {
        +QdrantClient client
        +str collection_name
        +add(nodes: List~Node~) void
        +query(embedding: List~float~, top_k: int) List~Node~
    }

    class CohereEmbedding {
        +str api_key
        +str model_name
        +embed_text(text: str) List~float~
        +embed_batch(texts: List~str~) List~List~float~~
    }

    class RetrievedChunk {
        +int document_id
        +str document_name
        +int chunk_index
        +str content
        +float score
    }

    class SentenceSplitter {
        +int chunk_size
        +int chunk_overlap
        +get_nodes_from_documents(docs: List~Document~) List~Node~
    }

    LlamaIndexRAGEngine --> VectorStoreIndex : uses
    LlamaIndexRAGEngine --> QdrantVectorStore : uses
    LlamaIndexRAGEngine --> CohereEmbedding : uses
    LlamaIndexRAGEngine --> RetrievedChunk : returns
    VectorStoreIndex --> QdrantVectorStore : contains
    VectorStoreIndex --> SentenceSplitter : uses
```

---

### 7.3 Tool System Classes

```mermaid
classDiagram
    class FastMCP {
        +str server_name
        +Dict~str, MCPTool~ tools
        +tool(func: Callable) Callable
        +get_tools() Dict~str, MCPTool~
        +run() void
    }

    class MCPTool {
        +str name
        +str description
        +Callable fn
        +dict input_schema
        +dict output_schema
        +execute(**kwargs) Any
    }

    class ToolScanner {
        +scan_and_sync_tools() ScanResult
        -_get_mcp_tools() List~MCPTool~
        -_sync_to_database(tools: List~MCPTool~) void
    }

    class Tool {
        +int id
        +str name
        +str description
        +ToolType tool_type
        +json input_schema
        +json output_schema
        +bool enabled
        +List~str~ assigned_agents
    }

    class PetCareQATool {
        +query(query: str, top_k: int, min_score: float) dict
        -_format_results(chunks: List~RetrievedChunk~) dict
    }

    class SymptomSearchTool {
        +search(symptoms: List~str~, pet_type: str, top_k: int) dict
        -_analyze_severity(chunks: List~RetrievedChunk~) str
    }

    FastMCP --> MCPTool : manages
    ToolScanner --> FastMCP : scans
    ToolScanner --> Tool : syncs
    PetCareQATool --|> MCPTool : implements
    SymptomSearchTool --|> MCPTool : implements
```

---

### 7.4 Database Models

```mermaid
classDiagram
    class Agent {
        +int id
        +str name
        +str description
        +float temperature
        +int max_tokens
        +float top_p
        +str model
        +str system_prompt
        +bool enabled
        +datetime created_at
        +datetime updated_at
        +List~PromptVersion~ prompt_versions
        +List~ChatSession~ chat_sessions
    }

    class Tool {
        +int id
        +str name
        +str description
        +ToolType tool_type
        +json input_schema
        +json output_schema
        +bool enabled
        +List~str~ assigned_agents
        +datetime created_at
        +datetime updated_at
    }

    class PromptVersion {
        +int id
        +int agent_id
        +int version
        +str prompt_text
        +bool is_active
        +str created_by
        +str notes
        +datetime created_at
    }

    class ChatSession {
        +int id
        +int agent_id
        +str user_id
        +str session_id
        +datetime started_at
        +datetime ended_at
        +List~ChatMessage~ messages
    }

    class ChatMessage {
        +int id
        +int session_id
        +str role
        +str content
        +json message_metadata
        +datetime timestamp
    }

    class KnowledgeDocument {
        +int id
        +str filename
        +str file_path
        +str file_type
        +int file_size
        +bool processed
        +int vector_count
        +str uploaded_by
        +str notes
        +datetime uploaded_at
        +datetime processed_at
    }

    class SystemSetting {
        +int id
        +str key
        +str value
        +SettingCategory category
        +bool is_sensitive
        +str description
        +datetime created_at
        +datetime updated_at
    }

    Agent "1" --> "*" PromptVersion : has
    Agent "1" --> "*" ChatSession : handles
    ChatSession "1" --> "*" ChatMessage : contains
```

---

## 8. DEPLOYMENT ARCHITECTURE

### 8.1 Production Deployment (AWS EC2)

```mermaid
flowchart TB
    subgraph Internet
        Users[Users<br/>Pet Owners/Admins]
    end

    subgraph CloudFlare["Cloudflare"]
        DNS[DNS<br/>ai.petties.world]
    end

    subgraph EC2["AWS EC2 Instance"]
        subgraph Docker["Docker Compose"]
            Nginx[Nginx Reverse Proxy<br/>SSL Termination]

            subgraph AIService["AI Service Container"]
                FastAPI[FastAPI<br/>Port 8000]
                Uvicorn[Uvicorn Workers<br/>4 workers]
            end

            subgraph DB["Database Container"]
                Postgres[PostgreSQL 16<br/>Port 5432]
            end
        end
    end

    subgraph CloudServices["Cloud Services"]
        OpenRouter[OpenRouter API<br/>LLM Provider]
        Cohere[Cohere API<br/>Embeddings]
        Qdrant[Qdrant Cloud<br/>Vector DB]
        Neon[Neon PostgreSQL<br/>Production DB]
    end

    subgraph Backend["Backend API"]
        SpringBoot[Spring Boot<br/>api.petties.world]
    end

    Users --> DNS
    DNS --> Nginx

    Nginx --> FastAPI
    FastAPI --> Uvicorn

    Uvicorn --> Postgres
    Uvicorn --> OpenRouter
    Uvicorn --> Cohere
    Uvicorn --> Qdrant
    Uvicorn --> Neon
    Uvicorn --> SpringBoot
```

### 8.2 Docker Compose Structure

**File:** `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  ai-service:
    build:
      context: ./petties-agent-serivce
      dockerfile: Dockerfile
    container_name: petties-ai-service
    ports:
      - "8000:8000"
    environment:
      - ENV=prod
      - DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/petties_agent
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./knowledge_base:/app/knowledge_base
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: petties-ai-db
    environment:
      - POSTGRES_USER=petties_agent
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=petties_agent
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: petties-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - ai-service
    restart: unless-stopped

volumes:
  postgres_data:
```

### 8.3 CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/deploy-ai-service.yml`

```yaml
name: Deploy AI Service

on:
  push:
    branches: [main]
    paths:
      - 'petties-agent-serivce/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run tests
        run: |
          cd petties-agent-serivce
          python -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt
          pytest

      - name: Deploy to EC2
        env:
          SSH_PRIVATE_KEY: ${{ secrets.EC2_SSH_KEY }}
          EC2_HOST: ${{ secrets.EC2_HOST }}
        run: |
          echo "$SSH_PRIVATE_KEY" > key.pem
          chmod 600 key.pem

          scp -i key.pem -r petties-agent-serivce ubuntu@$EC2_HOST:/home/ubuntu/petties/

          ssh -i key.pem ubuntu@$EC2_HOST << 'EOF'
            cd /home/ubuntu/petties
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml up -d --build
          EOF
```

### 8.4 Environment Configuration

**Development (.env.dev):**
```bash
ENV=dev
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/petties_agent
JWT_SECRET=dev-secret-key

# Cloud APIs (loaded from database after first run)
OPENROUTER_API_KEY=
COHERE_API_KEY=
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

**Production (.env.prod):**
```bash
ENV=prod
DATABASE_URL=postgresql+asyncpg://user:pass@neon.tech:5432/petties_agent_prod
JWT_SECRET=${JWT_SECRET}

# Cloud APIs (configured via Admin Dashboard)
# OPENROUTER_API_KEY = loaded from PostgreSQL system_settings
# COHERE_API_KEY = loaded from PostgreSQL system_settings
# QDRANT_URL = loaded from PostgreSQL system_settings
# QDRANT_API_KEY = loaded from PostgreSQL system_settings
```

---

## APPENDIX A: API Error Codes

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `AGENT_DISABLED` | 503 | Agent bị tắt bởi Admin | Bật lại agent trong Admin Dashboard |
| `TOOL_NOT_FOUND` | 404 | Tool không tồn tại | Kiểm tra tool name |
| `TOOL_DISABLED` | 400 | Tool bị tắt | Bật tool trong Admin Dashboard |
| `LLM_ERROR` | 500 | Lỗi khi gọi LLM API | Kiểm tra API key và quota |
| `RAG_ERROR` | 500 | Lỗi khi query RAG | Kiểm tra Qdrant/Cohere connection |
| `INVALID_TOKEN` | 401 | JWT token không hợp lệ | Login lại |
| `QUOTA_EXCEEDED` | 429 | Vượt quá quota LLM | Chờ hoặc nâng cấp plan |
| `DOCUMENT_NOT_FOUND` | 404 | Document không tồn tại | Kiểm tra document_id |

---

## APPENDIX B: Performance Metrics

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| **Agent Response Time** | < 3s | ~2.5s | Với Gemini 2.0 Flash |
| **RAG Query Latency** | < 500ms | ~300ms | Qdrant Cloud + Cohere |
| **WebSocket Latency** | < 100ms | ~80ms | First token time |
| **Document Indexing** | < 10s/MB | ~8s/MB | PDF with PyMuPDF |
| **Concurrent Users** | 100 | - | 4 Uvicorn workers |
| **Uptime SLA** | 99.5% | - | EC2 + Neon + Qdrant Cloud |

---

## APPENDIX C: Security Considerations

1. **API Key Encryption:**
   - Tất cả sensitive settings (API keys) được mã hóa trong PostgreSQL
   - Sử dụng Fernet symmetric encryption (cryptography library)
   - Encryption key lưu trong environment variable, KHÔNG commit vào Git

2. **JWT Authentication:**
   - JWT tokens được verify với shared secret từ Spring Boot
   - Token expiry: 24 hours (access token), 7 days (refresh token)
   - Middleware kiểm tra token trước khi access agent endpoints

3. **Rate Limiting:**
   - Admin endpoints: 60 requests/minute
   - Chat endpoints: 20 requests/minute
   - Knowledge upload: 5 files/hour

4. **Input Validation:**
   - Pydantic schemas validate tất cả request bodies
   - File upload: Max 10MB, only PDF/DOCX/TXT/MD
   - SQL injection prevention: SQLAlchemy parameterized queries

5. **HTTPS Only:**
   - Nginx reverse proxy với Let's Encrypt SSL
   - Redirect HTTP → HTTPS
   - HSTS header enabled

---

**Document End**

---

**Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-27 | AI Documentation Team | Initial SDD for AI Agent Service |
| 1.4.0 | 2026-01-22 | Petties Development Team | Bổ sung thiết kế cho AI Vision Analysis và đồng bộ Version |

