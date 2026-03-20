# AI Service Architecture Presentation

> Lưu ý cập nhật ngày 2026-03-17: slide này có thể còn chứa tham chiếu lịch sử tới AI Diagnose cũ, thumbs feedback và visual case memory. Kiến trúc hiện hành là knowledge base + EMR xác nhận + Gemini Vision.
## Petties - Veterinary Appointment Booking Platform

---

## 1. AI Service as a Separate Component

### System Architecture Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │  API Gateway     │    │   Backend       │
│  (Web/Mobile)   │◄──►│  (NGINX)         │◄──►│ (Spring Boot)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │   AI Service     │
                        │  (FastAPI/Python)│
                        └──────────────────┘
                                   │
                                   ▼
                ┌─────────────────────────────┐
                │       Data Stores           │
                │  PostgreSQL • MongoDB •     │
                │   Qdrant • Redis • Cloudinary│
                └─────────────────────────────┘
```

### Key Points:
- AI Service is deployed as a separate microservice (FastAPI/Python 3.12)
- Communicates with backend via REST APIs
- Has independent access to data stores (PostgreSQL for config, Qdrant for vectors, MongoDB for chat history)
- Deployed on separate port (8000) vs Backend (8080)

---

## 2. Package Diagram - AI Service Layer

```
petties-agent-serivce (FastAPI + Python 3.12)
├── api/
│   ├── routes/          # REST Endpoint Layer
│   ├── websocket/       # Real-time Communication Layer  
│   ├── middleware/      # Request Interception Layer
│   ├── schemas/         # API Contract Layer
│   └── dependencies/    # Dependency Injection Layer
├── core/
│   ├── agents/          # AI Agent Orchestration (LangGraph + ReAct)
│   ├── tools/           # Tool Infrastructure (FastMCP @mcp.tool)
│   ├── rag/             # Knowledge Retrieval Layer (LlamaIndex)
│   ├── config_helper/   # Dynamic Configuration Layer
│   └── sentry/          # Error Monitoring Layer
├── services/            # External Integration Layer (OpenRouter, Cohere)
├── db/
│   └── postgres/        # ORM Models & Session Management
├── config/              # Environment Configuration
└── tests/               # Test Suite
```

### Dependencies:
- API Layer → Core Layer
- Core Layer → Services Layer + Database Layer
- Services Layer → Configuration Layer
- All layers depend on Configuration Layer

---

## 3. Sequence Diagrams: System ↔ AI Communication

### 3.1 Standard Request Flow
```mermaid
sequenceDiagram
    participant User as User (Mobile/Web)
    participant FE as Frontend (React/Flutter)
    participant BE as Backend (Spring Boot)
    participant GW as API Gateway (NGINX)
    participant AI as AI Service (FastAPI)
    participant DB as PostgreSQL
    participant QD as Qdrant Cloud
    participant MG as MongoDB
    participant OR as OpenRouter API
    participant CO as Cohere API

    User->>FE: Send message (e.g. "Cún có dấu hiệu gì?")
    FE->>GW: HTTP POST /api/v1/chat/message
    GW->>BE: Forward request
    BE->>GW: Return chat session ID
    GW->>FE: Session ID response
    FE->>GW: WebSocket connect /ws/chat/{sessionId}
    GW->>AI: WebSocket message
    AI->>DB: Load agent config & settings
    AI->>QD: Vector search (RAG)
    alt Knowledge insufficient
        AI->>OR: LLM request with expanded query
        OR-->>AI: LLM response
    end
    AI->>MG: Save chat message + ReAct trace
    AI->>GW: WebSocket stream response tokens
    GW->>FE: Stream tokens to user
    FE->>User: Display streaming response
```

### 3.2 Error Handling Flow
```mermaid
sequenceDiagram
    participant User as User
    participant FE as Frontend
    participant GW as API Gateway
    participant AI as AI Service
    participant OR as OpenRouter
    
    User->>FE: Send message
    FE->>GW: HTTP/WebSocket request
    GW->>AI: Forward to AI service
    
    alt AI Service Healthy
        AI->>OR: Call LLM
        OR-->>AI: Normal response
        AI->>FE: Stream response
    else AI Service Unhealthy
        AI-->>GW: HTTP 503 Service Unavailable
        GW-->>FE: Error response
        FE-->>User: Display "Trợ lý AI đang bảo trì" message
    end
    
    alt LLM API Failure
        AI->>OR: Call primary model (fails)
        AI->>OR: Auto-fallback to backup model
        OR-->>AI: Response from backup
        AI->>FE: Continue streaming
    end
```

### 3.3 Timeout Handling
```mermaid
sequenceDiagram
    participant FE as Frontend
    participant GW as API Gateway
    participant AI as AI Service
    participant OR as OpenRouter
    
    FE->>GW: WebSocket message
    GW->>AI: Forward request
    
    alt Response within timeout (<30s)
        AI->>OR: Normal LLM call
        OR-->>AI: Response
        AI->>FE: Stream response
    else Timeout (>30s)
        AI-->>GW: HTTP 408 Request Timeout
        GW-->>FE: Timeout error
        FE-->>User: Display "Yêu cầu mất quá nhiều thời gian, vui lòng thử lại"
    end
```

---

## 4. Database Design for AI Data Storage

### 4.1 What Gets Stored & Where

| Data Type | Storage Location | Purpose | Retention |
|-----------|------------------|---------|-----------|
| **Agent Config** | PostgreSQL (`agents`, `tools`, `prompt_versions`) | Runtime configuration, tool management, prompt versioning | Persistent (until changed) |
| **Encrypted API Keys** | PostgreSQL (`system_settings`) | Secure storage of OpenRouter, Cohere, Qdrant keys | Persistent (encrypted) |
| **Chat Sessions** | MongoDB (`ai_chat_sessions`) | Session metadata, user_id, timestamps | 30 days (configurable) |
| **Chat Messages** | MongoDB (`ai_chat_messages`) | Full conversation history with ReAct traces (thought/action/observation) | 30 days (configurable) |
| **User Feedback** | MongoDB (`chat_feedback`) | Thumbs up/down, reports, feedback text (chỉ dùng cho UX analysis, không dùng làm nguồn học) | 90 days (for analysis) |
| **Knowledge Base** | PostgreSQL (`knowledge_documents`) + Qdrant (`petties_knowledge`) | Document metadata + vector embeddings | Persistent |
| **Case Memory** | Qdrant (`petties_case_memory_v2`) | **EMR-confirmed cases** (thay thế feedback-driven): text + image vectors | Persistent (with pruning) |
| **Tool Usage Logs** | MongoDB (implicit in chat_messages) | Audit trail of tool calls with parameters/results | 30 days |

### 4.2 AI-Related Tables in PostgreSQL
```sql
-- Core AI Configuration Tables
agents                 -- Single agent configuration
tools                  -- Tool registry (@mcp.tool metadata)
prompt_versions        -- System prompt version control (FK to agents)
knowledge_documents    -- RAG document metadata
system_settings        -- Encrypted API keys & runtime config
```

### 4.3 AI-Related Collections in MongoDB
```javascript
// Chat History Storage
ai_chat_sessions       // { sessionId, userId, createdAt, lastActive }
ai_chat_messages       // { sessionId, messageId, role, content, reactTrace, timestamp }
chat_feedback          // { messageId, sessionId, userRole, feedbackType, category, ... }
```

### 4.4 Qdrant Collections for AI
```json
// Vector Stores
petties_knowledge      // RAG knowledge base (Cohere embeddings, 1024-dim)
petties_case_memory_v2 // Case memory with named vectors:
//                      //   - text: Cohere embed-multilingual-v3 (1024-dim)
//                      //   - image: Jina CLIP v2 (1024-dim)
```

---

## 5. Class Diagram: AI Processing Components

### 5.1 Core AI Component Structure
```mermaid
classDiagram
    %% === MAIN AI AGENT ===
    class AgentOrchestrator {
        -langgraph: StateGraph
        -agent_state: AgentState
        -system_prompt: str
        -tools: List[mcp.tool]
        +process_message(user_input: str, session_id: str) AsyncGenerator[str]
        +_think_node(state: AgentState) AgentState
        +_act_node(state: AgentState) AgentState
        +_observe_node(state: AgentState) AgentState
    }
    
    %% === TOOL LAYER ===
    class ToolExecutor {
        -mcp_server: FastMCP
        -available_tools: Dict[str, mcp.tool]
        +execute_tool(tool_name: str, params: Dict) ToolResult
        +validate_tool_params(tool_name: str, params: Dict) bool
    }
    
    %% === RAG LAYER ===
    class HybridRAGEngine {
        -llama_index: LlamaIndexRAGEngine
        -knowledge_graph: KnowledgeGraphService
        -case_memory: CaseMemoryService
        -query_expander: QueryExpander
        +query(user_query: str, pet_type: str) HybridResult
    }
    
    %% === EMBEDDING LAYER ===
    class EmbeddingService {
        -cohere_client: CohereClient
        -jina_client: JinaImageEmbeddings
        +embed_text(text: str) List[float]
        +embed_image_url(urls: List[str]) List[List[float]]
        +embed_image_base64(base64: List[str]) List[List[float]]
    }
    
    %% === CONFIGURATION LAYER ===
    class ConfigService {
        -db_session: AsyncSession
        +get_agent_config() AgentConfig
        +get_tool_config(tool_name: str) ToolConfig
        +get_system_setting(key: str) str
        +update_system_setting(key: str, value: str) bool
    }
    
    %% === RELATIONSHIPS ===
    AgentOrchestrator --> ToolExecutor : uses
    AgentOrchestrator --> HybridRAGEngine : uses
    AgentOrchestrator --> ConfigService : uses
    HybridRAGEngine --> EmbeddingService : uses
    HybridRAGEngine --> ConfigService : uses
    ToolExecutor --> ConfigService : uses
```

### 5.2 Key Processing Classes
| Class | Responsibility | Location |
|-------|----------------|----------|
| **AgentOrchestrator** | Implements ReAct loop using LangGraph StateGraph | `app/core/agents/orchestrator.py` |
| **ToolExecutor** | Executes @mcp.tool decorated functions with parameter validation | `app/core/tools/executor.py` |
| **HybridRAGEngine** | Combines RAG + Knowledge Graph + Case Memory with re-ranking | `app/core/rag/hybrid_engine.py` |
| **EmbeddingService** | Handles text (Cohere) and image (Jina CLIP v2) embeddings | `app/core/embeddings/` |
| **ConfigService** | Loads dynamic configuration from PostgreSQL (hot-reload capable) | `app/core/config_helper.py` |
| **FeedbackService** | Processes user feedback and updates case memory | `app/core/services/feedback_service.py` |

---

## 6. Data Flow for AI Processing

### 6.1 Detailed Processing Pipeline
```mermaid
flowchart TD
    A[User Message] --> B[Frontend]
    B --> C[API Gateway]
    C --> D[Backend - Get/Create Session]
    C --> E[AI Service - WebSocket]
    
    E --> F[Load Agent Config]
    F --> G[Expand Query if Short]
    G --> H[Hybrid Search: RAG + KG + Case Memory]
    
    H --> I{Sufficient Context?}
    I -->|Yes| J[Generate Direct Response]
    I -->|No| K[Query Expansion + Web Search]
    K --> L[RAG Search on Expanded Results]
    L --> M[Synthesize with LLM]
    M --> N[Apply ReAct Pattern]
    
    N --> O[Stream Response Tokens]
    O --> P[Save to MongoDB with Trace]
    P --> Q[Check for Positive Feedback]
    Q -->|Thumbs Up| R[Extract Case → Embed in Case Memory]
    Q -->|Thumbs Down| S[Log for Review]
    Q -->|Report| T[Flag for Moderation]
    
    R --> U[Update Case Feedback Count]
    U --> V[Re-rank Similar Cases]
    
    style E fill:#ffe4b5,stroke:#f39c12,stroke-width:2px
    style H fill:#e8f8f5,stroke:#00b894,stroke-width:2px
    style N fill:#fdcb6e,stroke:#e17055,stroke-width:2px
```

### 6.2 ReAct Loop Implementation
```python
# Simplified ReAct loop in AgentOrchestrator
async def process_message(self, user_input: str, session_id: str):
    # Initialize state
    state = AgentState(
        messages=[{"role": "user", "content": user_input}],
        tool_calls=[],
        observations=[]
    )
    
    # ReAct Loop: Think → Act → Observe → (Repeat if needed)
    while not self._should_end(state):
        # THINK: LLM reasoning
        state = await self._think_node(state)
        
        # ACT: Execute tools if needed
        if state.get("tool_calls"):
            state = await self._act_node(state)
        
        # OBSERVE: Process tool results
        state = await self._observe_node(state)
    
    # FINALIZE: Generate and stream response
    async for token in self._generate_response(state):
        yield token
```

### 6.3 Error Handling & Fallbacks
```mermaid
stateDiagram-v2
    [*] --> NormalProcessing
    NormalProcessing --> LLMCall: Valid request
    LLMCall --> Success: Response received
    LLMCall --> Timeout: No response in 30s
    LLMCall --> RateLimit: HTTP 429/503
    LLMCall --> ServiceError: HTTP 5xx
    
    Timeout --> RetryWithBackoff: Attempt 1-3
    RateLimit --> RetryWithBackoff: Attempt 1-3
    ServiceError --> FallbackModel: Switch to backup LLM
    FallbackModel --> Success: Response received
    FallbackModel --> ServiceDegraded: All models failed
    
    Success --> StreamResponse: Token by token
    StreamResponse --> [*]: Complete
    
    ServiceDegraded --> ErrorResponse: "Trợ lý AI đang bảo trì"
    ErrorResponse --> [*]: Return to user
    
    RetryWithBackoff --> LLMCall: Retry attempt
    RetryWithBackoff --> ServiceDegraded: Max retries exceeded
```

---

## 7. Verification & Analysis Capabilities

### 7.1 Data Available for Later Analysis
From the storage mechanisms described above, the following data is available for verification and analysis:

1. **Conversation Analysis**
   - Full chat history with user/AI turns (MongoDB)
   - ReAct traces showing AI reasoning process (thought/action/observation)
   - Tool usage patterns and effectiveness

2. **Performance Metrics**
   - Response latency measurements
   - Token usage per request
   - Success/failure rates of tool calls
   - Feedback distribution by category and user role

3. **Knowledge Base Effectiveness**
   - RAG retrieval relevance scores
   - Case memory hit rates
   - Knowledge gap identification (queries requiring web search)

4. **User Satisfaction**
   - Feedback scores (thumbs up/down) by interaction type
   - Common complaint patterns from "report" feedback
   - Improvement tracking over time

### 7.2 Verification Queries Possible
```sql
-- Check AI response quality over time
SELECT 
    DATE(created_at) as date,
    AVG(CASE WHEN feedback_type = 'THUMBS_UP' THEN 1.0 ELSE 0.0 END) as satisfaction_rate,
    COUNT(*) as total_interactions
FROM mongodb.chat_feedback 
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date;

-- Analyze tool usage effectiveness
SELECT 
    tool_used,
    COUNT(*) as usage_count,
    SUM(CASE WHEN feedback_type = 'THUMBS_UP' THEN 1 ELSE 0 END) as positive_feedback,
    ROUND(SUM(CASE WHEN feedback_type = 'THUMBS_UP' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM mongodb.chat_feedback
WHERE tool_used IS NOT NULL
GROUP BY tool_used
ORDER BY success_rate DESC;

-- Identify knowledge gaps
SELECT 
    SUBSTRING(feedback_text, 1, 100) as query_preview,
    COUNT(*) as frequency
FROM mongodb.chat_feedback
WHERE feedback_category = 'KNOWLEDGE' 
  AND feedback_reason = 'INCORRECT_INFO'
GROUP BY SUBSTRING(feedback_text, 1, 100)
ORDER BY frequency DESC
LIMIT 10;
```

### 7.3 Real-time Monitoring Capabilities
- **WebSocket Message Tracing**: Full visibility into request/response flow
- **ReAct Trace Inspection**: See exactly how AI arrived at each conclusion
- **Tool Call Monitoring**: Track which tools are called, with what parameters, and what they returned
- **Performance Metrics**: Latency, token usage, error rates exposed via monitoring endpoints

---

## 8. Summary: AI Service Architecture Compliance

### ✅ Addresses All Requirements:

1. **System Architecture/Package Diagram** 
   - AI Service shown as separate microservice in architecture diagrams
   - Detailed package structure provided showing clear separation of concerns

2. **Sequence Diagrams for System-AI Communication**
   - Standard request/response flows with WebSocket streaming
   - Error handling and timeout scenarios clearly documented
   - Fallback mechanisms for LLM API failures shown

3. **Database Design for AI Data Storage**
   - PostgreSQL stores configuration, encrypted API keys, prompt versions
   - MongoDB stores complete chat history with ReAct traces for audit/analysis
   - Qdrant stores vector embeddings for knowledge base and case memory
   - All data required for later analysis and verification is preserved

4. **Class Diagram Shows Modular AI Processing**
   - Separate classes for: Agent Orchestration, Tool Execution, RAG Engine, Embedding Services
   - Clear separation between AI logic (core/) and integration (services/, db/)
   - Configuration is externalized and dynamically reloadable

### 🔧 Implementation Status:
- **Completed**: Core AI service with ReAct pattern, tool system, RAG pipeline
- **Completed**: Dynamic configuration, feedback loop, case memory with hybrid vectors
- **Completed**: Monitoring, error handling, and fallback mechanisms
- **In Progress**: Advanced analytics dashboard for AI performance metrics
- **Planned**: Knowledge Graph enhancement (Phase 2)

This architecture ensures the AI service is a well-integrated, separately deployable component with full observability, data persistence for verification, and robust error handling.
