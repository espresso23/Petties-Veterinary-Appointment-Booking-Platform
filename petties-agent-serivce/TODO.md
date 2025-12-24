# TODO: AI-Service Implementation Plan

**Project:** Petties Agent Service  
**Last Updated:** 2025-12-08  
**Status:** In Development

---

## 📋 Overview

This document tracks all pending tasks and features required to complete the AI Service according to the Technical Scope. Tasks are categorized by priority (Critical, High, Medium) and implementation status.

**Reference:** [Technical Scope - Agent Management](../docs-references/TECHNICAL%20SCOPE%20PETTIES%20-%20AGENT%20MANAGEMENT.md)

---

## ✅ Completed Features

| Category | Features |
|----------|----------|
| **System & Security** | SYS-01 ✅, SYS-02 ✅ |
| **Agent Orchestration** | AG-01 ✅, AG-02 ✅, AG-03 ✅ |
| **Tools & Integrations** | TL-01 ✅, TL-02 ✅, TL-03 ✅ |
| **Cloud AI Integration** | OpenRouter ✅, Cohere ✅, Qdrant Cloud ✅ |
| **Infrastructure** | Dynamic Config Loader ✅, Agent Factory ✅, Prompt Management ✅ |

---

## 🔴 Critical Priority (Must Have for MVP)

### AG-04: Routing Examples Manager

**Status:** 🔴 Not Started  
**Priority:** Critical  
**Description:** Giao diện CRUD các "Routing Pairs" cho kỹ thuật Few-Shot. Sync vector sang Qdrant. Thay thế cho việc training model.

**Tasks:**

- [ ] **Backend: Database Schema**
  - [ ] Create `routing_examples` table in PostgreSQL
    - Fields: `id`, `query` (text), `target_agent` (string), `language` (string, default: 'vi'), `embedding` (vector), `created_at`, `updated_at`
  - [ ] Create Alembic migration
  - [ ] Update models.py with `RoutingExample` model

- [ ] **Backend: API Endpoints**
  - [ ] `GET /api/v1/routing-examples` - List all routing examples
  - [ ] `POST /api/v1/routing-examples` - Create new routing example
  - [ ] `PUT /api/v1/routing-examples/{id}` - Update routing example
  - [ ] `DELETE /api/v1/routing-examples/{id}` - Delete routing example
  - [ ] `POST /api/v1/routing-examples/{id}/embed` - Generate embedding and sync to Qdrant

- [ ] **Backend: Qdrant Integration**
  - [ ] Create `routing_examples` collection in Qdrant Cloud
  - [ ] Generate embeddings cho mỗi routing example (dùng Cohere embed-multilingual-v3)
  - [ ] Upsert vectors vào Qdrant với payload: `{query, target_agent, language}`
  - [ ] Implement semantic search trong Main Agent để tìm similar routing examples

- [ ] **Backend: Main Agent Integration**
  - [ ] Update `main_agent.py` intent classification để sử dụng Few-Shot retrieval
  - [ ] Query Qdrant với user input → Tìm similar routing examples
  - [ ] Sử dụng kết quả để route đến đúng agent
  - [ ] Fallback to keyword-based routing nếu không tìm thấy

- [ ] **Frontend: UI Component**
  - [ ] Routing Examples Manager component (đã có skeleton trong `RoutingExamplesManager.tsx`)
  - [ ] Connect API endpoints
  - [ ] Multilingual support UI (vi, en, ko, ja)
  - [ ] Test semantic search accuracy

**Estimated Time:** 3-4 days  
**Files to Modify:**
- `app/db/postgres/models.py` (add RoutingExample model)
- `app/api/routes/agents.py` (add routing examples endpoints)
- `app/core/agents/main_agent.py` (integrate Few-Shot retrieval)
- `app/core/rag/qdrant_client.py` (routing examples collection)
- `alembic/versions/YYYYMMDD_add_routing_examples.py` (migration)

---

### KB-01: Cloud Vector Sync (RAG) - Complete Implementation

**Status:** 🔄 In Progress (50%)  
**Priority:** Critical  
**Description:** Pipeline sử dụng LlamaIndex để đọc file (PDF/Docx), thực hiện Chunking và đẩy Vector vào Qdrant Cloud.

**Completed:**
- ✅ Qdrant client implementation
- ✅ Knowledge documents upload endpoint
- ✅ Database schema (knowledge_documents table)

**Remaining Tasks:**

- [ ] **Document Processing Pipeline**
  - [ ] Implement LlamaIndex document loader (PDF, DOCX, TXT, MD)
  - [ ] Text chunking strategy (overlap, chunk size)
  - [ ] Generate embeddings với Cohere embed-multilingual-v3 (Cloud API)
  - [ ] Batch upsert vectors vào Qdrant Cloud

- [ ] **RAG Engine Implementation**
  - [ ] Complete `rag_engine.py` implementation
  - [ ] Query Qdrant với user question embedding
  - [ ] Return top-k chunks với metadata (filename, page, score)
  - [ ] Implement re-ranking nếu cần

- [ ] **Medical Agent Integration**
  - [ ] Update `medical_tools.py` line 147 - Implement actual RAG search
  - [ ] Load RAG context vào Medical Agent prompt
  - [ ] Confidence threshold check (Low Conf → Auto-escalate to Research Agent)

- [ ] **API Endpoints Completion**
  - [ ] `POST /api/v1/knowledge/process/{id}` - Process document (chunk + embed)
  - [ ] `POST /api/v1/knowledge/query` - Complete RAG query (line 329 in knowledge.py)
  - [ ] `DELETE /api/v1/knowledge/documents/{id}` - Delete vectors from Qdrant (line 268)

- [ ] **Binary Quantization (PERF-01)**
  - [ ] Enable Binary Quantization khi tạo collection
  - [ ] Configure trong QdrantManager.create_collection()

**Estimated Time:** 3-4 days  
**Files to Modify:**
- `app/core/rag/document_processor.py` (complete implementation)
- `app/core/rag/rag_engine.py` (complete implementation)
- `app/core/tools/mcp_tools/medical_tools.py` (RAG search)
- `app/api/routes/knowledge.py` (complete endpoints)

---

### PG-01: Real-time Chat Simulator

**Status:** 🔄 In Progress (30%)  
**Priority:** Critical  
**Description:** Giao diện Chat kết nối qua WebSocket. Hiển thị Streaming Response từ FastAPI backend.

**Completed:**
- ✅ WebSocket endpoint structure (`/ws/chat/{session_id}`)
- ✅ ConnectionManager class
- ✅ Basic message handling

**Remaining Tasks:**

- [ ] **WebSocket Integration với LangGraph**
  - [ ] Load agent từ DB via AgentFactory
  - [ ] Create LangGraph workflow với agent
  - [ ] Stream thinking process steps (intent classification, routing, tool calls)
  - [ ] Stream final response tokens

- [ ] **Thinking Process Streaming**
  - [ ] Stream intent classification result
  - [ ] Stream routing decision (Main Agent → Sub-Agent)
  - [ ] Stream tool calls (tool name, input, output)
  - [ ] Stream sub-agent responses

- [ ] **Chat History Integration**
  - [ ] Load previous messages từ PostgreSQL (migrate from in-memory)
  - [ ] Pass context to LangGraph
  - [ ] Save new messages to DB after response

- [ ] **Error Handling & Reconnection**
  - [ ] Handle WebSocket disconnections gracefully
  - [ ] Retry mechanism
  - [ ] Error messages to client

**Estimated Time:** 4-5 days  
**Files to Modify:**
- `app/api/websocket/chat.py` (complete implementation)
- `app/core/agents/main_agent.py` (streaming support)
- `app/api/routes/chat.py` (migrate to PostgreSQL)

---

### PG-02: Thinking Process Visualization

**Status:** 🔄 In Progress (40%)  
**Priority:** Critical  
**Description:** Hiển thị quá trình suy luận (Chain of Thought) và các bước gọi Tool (Tool Calls) của LangGraph.

**Completed:**
- ✅ Logging structure
- ✅ Metadata storage in chat_messages.message_metadata

**Remaining Tasks:**

- [ ] **Backend: Structured Logging**
  - [ ] Capture LangGraph execution steps
  - [ ] Log tool calls với input/output
  - [ ] Log routing decisions
  - [ ] Store in `message_metadata` JSON field

- [ ] **Frontend: Visualization Component**
  - [ ] Thinking process timeline/step-by-step view
  - [ ] Tool calls visualization (expandable cards)
  - [ ] Routing path diagram (Main Agent → Sub-Agent)
  - [ ] Execution time per step

- [ ] **WebSocket Integration**
  - [ ] Stream thinking steps in real-time
  - [ ] Update UI as steps complete
  - [ ] Highlight current step

**Estimated Time:** 3-4 days  
**Files to Modify:**
- `app/core/agents/main_agent.py` (structured logging)
- `app/core/agents/booking_agent.py` (tool call logging)
- `app/core/agents/medical_agent.py` (tool call logging)
- `petties-web/src/components/admin/ThinkingProcessView.tsx` (new component)

---

## 🟡 High Priority

### PG-03: Traceability & Citation View

**Status:** 🔴 Not Started  
**Priority:** High  
**Description:** Hiển thị nguồn trích dẫn từ Qdrant (Metadata: filename, page number) hoặc Web Search (URL) ngay trong log chat.

**Tasks:**

- [ ] **Backend: Citation Metadata**
  - [ ] Store citations trong `message_metadata.citations` array
  - [ ] RAG citations: `{source: "rag", filename: "...", page: 1, score: 0.95}`
  - [ ] Web search citations: `{source: "web", url: "...", title: "...", snippet: "..."}`

- [ ] **Research Agent: URL Citation**
  - [ ] Update `research_tools.py` - Trả về citations cho mọi web search
  - [ ] Format citations trong response (Research Agent line 58-65)
  - [ ] Ensure URLs are included in response

- [ ] **Frontend: Citation Component**
  - [ ] Display citations as expandable cards
  - [ ] Link to source URLs (open in new tab)
  - [ ] Show confidence score for RAG citations
  - [ ] Display snippet/preview

**Estimated Time:** 2-3 days  
**Files to Modify:**
- `app/core/tools/mcp_tools/research_tools.py` (citation format)
- `app/core/agents/research_agent.py` (citation in response)
- `petties-web/src/components/admin/CitationView.tsx` (new component)

---

### KB-02: Knowledge Graph Integration

**Status:** 🔴 Not Started  
**Priority:** High  
**Description:** Tích hợp truy vấn Petagraph để xác thực thông tin y tế, giảm thiểu hallucination.

**Tasks:**

- [ ] Research Petagraph API/documentation
- [ ] Create Petagraph client wrapper
- [ ] Integrate vào Medical Agent workflow
- [ ] Cross-validate RAG results với Knowledge Graph
- [ ] Display KG validation status trong citations

**Estimated Time:** 3-4 days  
**Dependencies:** Petagraph API access, documentation

---

### PERF-01: Binary Quantization Config

**Status:** 🔴 Not Started  
**Priority:** High  
**Description:** Cấu hình tự động bật Binary Quantization khi tạo Collection mới trên Qdrant.

**Tasks:**

- [ ] Update `QdrantManager.create_collection()` to enable Binary Quantization
- [ ] Configure quantization params trong Qdrant Cloud
- [ ] Test search performance (should be 20-30x faster)
- [ ] Verify accuracy (should be >95%)

**Estimated Time:** 1 day  
**Files to Modify:**
- `app/core/rag/qdrant_client.py` (create_collection method)

---

## 🟢 Additional TODOs (Not in Technical Scope but Required)

### Chat Messages Migration (PostgreSQL)

**Status:** 🔴 Not Started  
**Priority:** High (Blocks PG-01)  
**Description:** Migrate chat messages từ in-memory dictionary sang PostgreSQL.

**Tasks:**

- [ ] **Database Migration**
  - [ ] Verify `chat_sessions` và `chat_messages` tables exist (already in models.py)
  - [ ] Create Alembic migration nếu cần (check existing migrations)

- [ ] **API Routes Update**
  - [ ] Update `POST /api/v1/chat/sessions` - Create session in DB
  - [ ] Update `GET /api/v1/chat/sessions` - Load from DB
  - [ ] Update `GET /api/v1/chat/sessions/{id}` - Load messages from DB
  - [ ] Update `POST /api/v1/chat/sessions/{id}/messages` - Save to DB
  - [ ] Update `DELETE /api/v1/chat/sessions/{id}` - Delete from DB
  - [ ] Remove in-memory `chat_sessions: dict = {}` (line 84)

- [ ] **Schema Updates**
  - [ ] Add `title` field to ChatSession model (if needed)
  - [ ] Ensure `message_metadata` JSON field supports thinking process

**Estimated Time:** 1-2 days  
**Files to Modify:**
- `app/api/routes/chat.py` (complete rewrite to use DB)
- `app/db/postgres/models.py` (verify ChatSession, ChatMessage models)

---

### Booking Agent: Spring Boot API Integration

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Description:** Implement actual booking logic bằng cách gọi Spring Boot API thực tế.

**Tasks:**

- [ ] **API Client**
  - [ ] Create HTTP client for Spring Boot backend
  - [ ] Implement authentication (JWT token từ user context)
  - [ ] Error handling & retries

- [ ] **Tool Implementation**
  - [ ] `check_slot` - Call `GET /api/v1/bookings/slots?doctor_id={id}&date={date}`
  - [ ] `create_booking` - Call `POST /api/v1/bookings` với payload
  - [ ] `cancel_booking` - Call `DELETE /api/v1/bookings/{id}`
  - [ ] `get_available_doctors` - Call `GET /api/v1/doctors/available`

- [ ] **Update Booking Agent**
  - [ ] Replace placeholder logic (line 57, 61 in booking_agent.py)
  - [ ] Handle API errors gracefully
  - [ ] Format response cho user

**Estimated Time:** 2-3 days  
**Files to Modify:**
- `app/core/tools/mcp_tools/booking_tools.py` (implement API calls)
- `app/core/agents/booking_agent.py` (use actual tools)

---

### Medical Agent: RAG Search Implementation

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Description:** Implement actual RAG search trong Medical Agent.

**Tasks:**

- [ ] **Complete RAG Integration**
  - [ ] Use RAGEngine to query knowledge base
  - [ ] Load context vào Medical Agent prompt
  - [ ] Implement confidence scoring

- [ ] **Auto-escalation Logic**
  - [ ] Check confidence threshold (< 80%)
  - [ ] Auto-call Research Agent nếu low confidence
  - [ ] Synthesize results từ RAG + Web search

**Estimated Time:** 2 days  
**Files to Modify:**
- `app/core/tools/mcp_tools/medical_tools.py` (line 147 - RAG search)
- `app/core/agents/medical_agent.py` (confidence check, escalation)

---

### Research Agent: Web Scraping Implementation

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Description:** Implement web scraping và YouTube integration cho Research Agent.

**Tasks:**

- [ ] **Web Scraping**
  - [ ] Implement `extract_web_content` tool (line 129 in research_tools.py)
  - [ ] Use BeautifulSoup or similar để parse HTML
  - [ ] Extract main content, remove ads/navigation
  - [ ] Handle errors (timeout, 404, etc.)

- [ ] **YouTube Integration**
  - [ ] Implement YouTube Data API v3 client (line 184)
  - [ ] Search videos với keywords
  - [ ] Return video metadata (title, URL, thumbnail, duration)
  - [ ] Handle API quota limits

- [ ] **Citation Format**
  - [ ] Ensure all web results include URL
  - [ ] Format citations trong response

**Estimated Time:** 3-4 days  
**Dependencies:** YouTube Data API v3 key, Tavily API key (optional)  
**Files to Modify:**
- `app/core/tools/mcp_tools/research_tools.py` (complete implementations)

---

### Tool System: JSON Schema Validation

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Description:** Implement JSON schema validation trong tool executor.

**Tasks:**

- [ ] **Schema Validation**
  - [ ] Validate tool input against `input_schema` (line 127 in executor.py)
  - [ ] Validate tool output against `output_schema`
  - [ ] Return clear error messages nếu validation fails

**Estimated Time:** 1 day  
**Files to Modify:**
- `app/core/tools/executor.py` (schema validation)

---

### Tool System: OpenAPI Conversion Logic

**Status:** 🔴 Not Started  
**Priority:** Medium  
**Description:** Complete OpenAPI to MCP tool conversion logic.

**Tasks:**

- [ ] **Conversion Implementation**
  - [ ] Convert OpenAPI schema → MCP tool format (line 369 in openapi_parser.py)
  - [ ] Map request body schemas
  - [ ] Map response schemas
  - [ ] Handle complex nested schemas

**Estimated Time:** 2 days  
**Files to Modify:**
- `app/core/tools/openapi_parser.py` (complete conversion logic)

---

### Feedback Collection System

**Status:** 🔴 Not Started  
**Priority:** Low  
**Description:** Send feedback từ Playground để training/improvement.

**Tasks:**

- [ ] **Backend: Feedback API**
  - [ ] Create `feedback` table (user_id, message_id, rating, comment, created_at)
  - [ ] `POST /api/v1/feedback` endpoint

- [ ] **Frontend: Feedback UI**
  - [ ] Connect feedback button (line 135 in PlaygroundPage.tsx)
  - [ ] Send to backend API

**Estimated Time:** 1 day

---

## 📊 Progress Summary

### By Priority

| Priority | Total | Completed | In Progress | Not Started |
|----------|-------|-----------|-------------|-------------|
| **Critical** | 4 | 0 | 3 | 1 |
| **High** | 3 | 0 | 0 | 3 |
| **Additional** | 7 | 0 | 0 | 7 |
| **Total** | 14 | 0 | 3 | 11 |

### By Category

| Category | Completed | In Progress | Not Started |
|----------|-----------|-------------|-------------|
| System & Security | 2 | 0 | 0 |
| Agent Orchestration | 3 | 0 | 1 |
| Tools & Integrations | 3 | 0 | 0 |
| Knowledge Base & RAG | 0 | 1 | 1 |
| Playground & Monitoring | 0 | 2 | 1 |
| Performance | 0 | 0 | 1 |
| Additional TODOs | 0 | 0 | 7 |

---

## 🎯 Recommended Implementation Order

### Phase 1: Critical Foundation (Week 1)
1. **Chat Messages Migration** (1-2 days) - Blocks PG-01
2. **KB-01: Complete RAG Pipeline** (3-4 days) - Required for Medical Agent
3. **PG-01: WebSocket Real-time Chat** (4-5 days) - Core feature

### Phase 2: Critical Completion (Week 2)
4. **AG-04: Routing Examples Manager** (3-4 days)
5. **PG-02: Thinking Process Visualization** (3-4 days)

### Phase 3: High Priority (Week 3)
6. **PERF-01: Binary Quantization** (1 day)
7. **PG-03: Citation View** (2-3 days)
8. **KB-02: Knowledge Graph** (3-4 days) - Nếu có API access

### Phase 4: Additional Features (Week 4+)
9. **Booking Agent API Integration** (2-3 days)
10. **Research Agent Web Scraping** (3-4 days)
11. **Medical Agent RAG** (2 days)
12. **Tool System Improvements** (3 days)
13. **Feedback Collection** (1 day)

---

## 📝 Notes

### Dependencies

- **AG-04** requires Qdrant Cloud account và Cohere API key (for embeddings)
- **KB-01** requires Qdrant Cloud và Cohere API key
- **KB-02** requires Petagraph API access
- **Research Agent** requires Tavily API key (for web search)

### Testing Requirements

Mỗi feature cần:
- Unit tests cho core logic
- Integration tests cho API endpoints
- Manual testing trong Playground
- Performance testing cho RAG/Qdrant queries

### Documentation Updates

Sau mỗi feature completion:
- Update README.md implementation status
- Update API documentation (Swagger)
- Add examples trong Technical Scope document (nếu cần)

---

**Last Updated:** 2025-12-18  
**Next Review:** 2025-12-25

