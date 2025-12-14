# PETTIES AGENT SERVICE - IMPLEMENTATION CHECKLIST

**Version:** 1.0
**Last Updated:** December 13, 2025
**Overall Completion:** ~65-70%

---

## PHASE 1: CRITICAL PATH (Must Complete for MVP)

### 1.1 LLM Client Implementation
**Priority:** CRITICAL | **Status:** 40% | **Est. Effort:** 2-3 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement `OllamaClient.generate()` | `services/llm_client.py` | ~63 | TODO |
| [ ] Implement `OllamaClient.stream()` | `services/llm_client.py` | ~73 | TODO |
| [ ] Implement `OllamaClient.chat()` | `services/llm_client.py` | ~83 | TODO |
| [ ] Add timeout and retry logic | `services/llm_client.py` | - | TODO |
| [ ] Test với Ollama local mode | - | - | TODO |
| [ ] Test với Ollama Cloud mode | - | - | TODO |

**Notes:**
```python
# Expected implementation for OllamaClient.generate():
async def generate(self, prompt: str, **kwargs) -> LLMResponse:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{self.base_url}/api/generate",
            json={"model": self.model, "prompt": prompt, **kwargs},
            timeout=120.0
        )
        return LLMResponse(content=response.json()["response"], ...)
```

---

### 1.2 Agent Node Functions (LangGraph)
**Priority:** CRITICAL | **Status:** 30% | **Est. Effort:** 3-4 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Complete `booking_node()` implementation | `core/agents/main_agent.py` | 116 | TODO |
| [ ] Complete `medical_node()` with RAG | `core/agents/main_agent.py` | 124 | TODO |
| [ ] Complete `research_node()` with web search | `core/agents/main_agent.py` | - | TODO |
| [ ] Implement `response_node()` for synthesis | `core/agents/main_agent.py` | - | TODO |
| [ ] Add proper state transitions | `core/agents/main_agent.py` | - | TODO |
| [ ] Integrate tool calling in each node | - | - | TODO |

**Notes:**
```python
# Expected flow for booking_node():
async def booking_node(state: AgentState) -> Dict:
    # 1. Get booking agent from factory
    booking_agent = await AgentFactory.create_agent("booking_agent", db_session)

    # 2. Process with tools
    result = await booking_agent.process(state["messages"][-1])

    # 3. Return state update
    return {"messages": state["messages"] + [result], "current_agent": "booking"}
```

---

### 1.3 WebSocket Chat Handler
**Priority:** CRITICAL | **Status:** 20% | **Est. Effort:** 2-3 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement `handle_chat_message()` | `api/websocket/chat.py` | 69-79 | TODO |
| [ ] Connect to Main Agent graph | `api/websocket/chat.py` | - | TODO |
| [ ] Implement streaming responses | `api/websocket/chat.py` | - | TODO |
| [ ] Add connection state management | `api/websocket/chat.py` | - | TODO |
| [ ] Handle disconnection gracefully | `api/websocket/chat.py` | - | TODO |

---

### 1.4 Chat Persistence (Database)
**Priority:** CRITICAL | **Status:** 0% | **Est. Effort:** 1-2 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Create ChatSession model | `db/postgres/models.py` | - | TODO |
| [ ] Create ChatMessage model | `db/postgres/models.py` | - | TODO |
| [ ] Replace in-memory dict with DB | `api/routes/chat.py` | 82 | TODO |
| [ ] Add migration for new tables | `alembic/versions/` | - | TODO |
| [ ] Implement message history retrieval | `api/routes/chat.py` | - | TODO |

**Schema:**
```python
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(UUID, primary_key=True)
    user_id = Column(String(100))
    agent_id = Column(Integer, ForeignKey("agents.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(UUID, primary_key=True)
    session_id = Column(UUID, ForeignKey("chat_sessions.id"))
    role = Column(String(20))  # user, assistant, system
    content = Column(Text)
    metadata = Column(JSON)  # tool_calls, routing info, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## PHASE 2: CORE FUNCTIONALITY (Required for Working System)

### 2.1 Spring Boot API Integration (Booking Tools)
**Priority:** HIGH | **Status:** 0% | **Est. Effort:** 2-3 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement `check_slot()` API call | `core/tools/mcp_tools/booking_tools.py` | 57 | TODO |
| [ ] Implement `create_booking()` API call | `core/tools/mcp_tools/booking_tools.py` | 61 | TODO |
| [ ] Implement `cancel_booking()` API call | `core/tools/mcp_tools/booking_tools.py` | - | TODO |
| [ ] Add authentication header (JWT) | - | - | TODO |
| [ ] Handle API errors gracefully | - | - | TODO |
| [ ] Add response parsing for LLM | - | - | TODO |

**Notes:**
```python
# Expected implementation:
@tool
async def check_slot(clinic_id: str, date: str) -> str:
    """Kiểm tra slot trống của phòng khám."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SPRING_BACKEND_URL}/api/v1/bookings/slots",
            params={"clinic_id": clinic_id, "date": date},
            headers={"Authorization": f"Bearer {get_service_token()}"}
        )
        slots = response.json()
        return format_slots_for_llm(slots)
```

---

### 2.2 RAG Integration (Medical Agent)
**Priority:** HIGH | **Status:** 40% | **Est. Effort:** 3-4 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Complete `RAGEngine.index_document()` | `core/rag/rag_engine.py` | - | Partial |
| [ ] Complete `RAGEngine.query()` | `core/rag/rag_engine.py` | - | Partial |
| [ ] Integrate Ollama embeddings (nomic-embed) | `core/rag/document_processor.py` | - | TODO |
| [ ] Implement `search_medical_knowledge()` | `core/tools/mcp_tools/medical_tools.py` | 147 | TODO |
| [ ] Connect RAG to Medical Agent | `core/agents/medical_agent.py` | - | TODO |
| [ ] Test với Qdrant Cloud | - | - | TODO |

**Knowledge Base endpoints to complete:**

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement RAG query endpoint | `api/routes/knowledge.py` | 217 | TODO |
| [ ] Implement vector deletion | `api/routes/knowledge.py` | 268 | TODO |
| [ ] Implement retrieval endpoint | `api/routes/knowledge.py` | 329 | TODO |

---

### 2.3 Research Agent (Web Search)
**Priority:** HIGH | **Status:** 30% | **Est. Effort:** 2-3 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement `web_search()` with DuckDuckGo | `core/tools/mcp_tools/research_tools.py` | - | Partial |
| [ ] Implement `extract_web_content()` | `core/tools/mcp_tools/research_tools.py` | 129 | TODO |
| [ ] Add source citation formatting | `core/tools/mcp_tools/research_tools.py` | - | TODO |
| [ ] Add result caching (Redis optional) | - | - | TODO |

**YouTube integration (Optional - can defer):**

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement `search_youtube_videos()` | `core/tools/mcp_tools/research_tools.py` | 184 | TODO |
| [ ] Add YouTube Data API v3 integration | - | - | TODO |

---

### 2.4 Tool Executor Improvements
**Priority:** HIGH | **Status:** 60% | **Est. Effort:** 1-2 days

| Task | File | Line | Status |
|------|------|------|--------|
| [ ] Implement JSON schema validation | `core/tools/executor.py` | 127 | TODO |
| [ ] Add timeout handling | `core/tools/executor.py` | - | TODO |
| [ ] Improve error messages for LLM | `core/tools/executor.py` | - | TODO |
| [ ] Add execution logging | `core/tools/executor.py` | - | TODO |

---

## PHASE 3: QUALITY & POLISH

### 3.1 Error Handling
**Priority:** MEDIUM | **Est. Effort:** 1-2 days

| Task | Status |
|------|--------|
| [ ] Add global exception handler in main.py | TODO |
| [ ] Create custom exceptions (AgentError, ToolError, RAGError) | TODO |
| [ ] Add retry logic for transient failures | TODO |
| [ ] Implement graceful degradation when services unavailable | TODO |
| [ ] Add detailed error logging | TODO |

---

### 3.2 Testing
**Priority:** MEDIUM | **Est. Effort:** 3-5 days

| Task | Status |
|------|--------|
| [ ] Unit tests for LLM Client | TODO |
| [ ] Unit tests for Tool Executor | TODO |
| [ ] Unit tests for RAG Engine | TODO |
| [ ] Integration tests for Agent workflow | TODO |
| [ ] Load testing for WebSocket | TODO |
| [ ] Create test fixtures and mocks | TODO |

---

### 3.3 Documentation
**Priority:** MEDIUM | **Est. Effort:** 1-2 days

| Task | Status |
|------|--------|
| [ ] API documentation (OpenAPI/Swagger) | Partial |
| [ ] Code docstrings completion | TODO |
| [ ] Architecture diagram update | TODO |
| [ ] Deployment guide | TODO |

---

## PHASE 4: FUTURE ENHANCEMENTS (Post-MVP)

### 4.1 Agent Intelligence Improvements
See separate section below: "AI/Agent Improvements Roadmap"

### 4.2 Performance Optimizations
| Task | Priority |
|------|----------|
| [ ] Add Redis caching layer | Low |
| [ ] Implement connection pooling | Low |
| [ ] Add request batching for embeddings | Low |
| [ ] Optimize vector search with HNSW tuning | Low |

### 4.3 Monitoring & Observability
| Task | Priority |
|------|----------|
| [ ] Add Prometheus metrics | Low |
| [ ] Implement distributed tracing (Jaeger/Zipkin) | Low |
| [ ] Create Grafana dashboards | Low |
| [ ] Add alerting rules | Low |

---

## SUMMARY TABLE

| Phase | Tasks | Completed | Remaining | Est. Days |
|-------|-------|-----------|-----------|-----------|
| Phase 1 (Critical) | 25 | 5 | 20 | 8-12 |
| Phase 2 (Core) | 22 | 6 | 16 | 8-12 |
| Phase 3 (Quality) | 15 | 2 | 13 | 5-9 |
| Phase 4 (Future) | 10 | 0 | 10 | TBD |
| **TOTAL** | **72** | **13** | **59** | **21-33** |

---

## DEPENDENCY GRAPH

```
Phase 1.1 (LLM Client)
    └── Phase 1.2 (Agent Nodes)
        └── Phase 1.3 (WebSocket Handler)
            └── Phase 1.4 (Chat Persistence)

Phase 2.1 (Spring Boot Integration)
    └── Phase 1.2 (Agent Nodes - Booking)

Phase 2.2 (RAG Integration)
    └── Phase 1.2 (Agent Nodes - Medical)

Phase 2.3 (Web Search)
    └── Phase 1.2 (Agent Nodes - Research)
```

**Critical Path:** 1.1 → 1.2 → 1.3 → 1.4 (Must complete in order)

---

## QUICK START FOR DEVELOPMENT

### Recommended Development Order:

1. **Day 1-2:** Complete LLM Client (Phase 1.1)
2. **Day 3-5:** Complete Agent Nodes (Phase 1.2)
3. **Day 6-7:** Complete WebSocket Handler (Phase 1.3)
4. **Day 8-9:** Complete Chat Persistence (Phase 1.4)
5. **Day 10-12:** Spring Boot Integration (Phase 2.1)
6. **Day 13-16:** RAG Integration (Phase 2.2)
7. **Day 17-19:** Web Search (Phase 2.3)
8. **Day 20+:** Quality & Polish (Phase 3)

### To Start Development:

```bash
# 1. Start databases
docker-compose -f docker-compose.db-only.yml up -d

# 2. Run migrations
cd petties-agent-serivce
alembic upgrade head

# 3. Start development server
uvicorn app.main:app --reload --port 8000

# 4. Open API docs
# http://localhost:8000/docs
```

---

**Document Maintained By:** Petties Dev Team
**Next Review:** After Phase 1 completion
