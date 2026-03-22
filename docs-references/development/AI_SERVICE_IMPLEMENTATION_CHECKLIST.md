# Petties AI Service - Sprint 13 Audit & Improvement Checklist

**Version:** 3.1
**Last Updated:** 2026-03-11
**Sprint:** 13 (Final - Stabilization & Bug Fix)
**Auditor:** Architecture Review Session
**Previous Version:** v3.0 (2026-03-09) - Sprint 13 Audit

---

## 1. Current State Overview

### Architecture Summary

| Component | Technology | Status |
|-----------|-----------|--------|
| **Agent Pattern** | Single Agent + ReAct (LangGraph) | Production-ready |
| **LLM Provider** | OpenRouter Cloud API (gemini-2.0-flash, llama-3.3-70b, claude-3.5-sonnet) | Working |
| **RAG Pipeline** | LlamaIndex + Qdrant Cloud + Cohere embed-multilingual-v3 | Working |
| **Chat Transport** | WebSocket (real-time) + REST (fallback) | WebSocket working, REST placeholder |
| **Chat Storage** | MongoDB (chat_sessions, chat_messages) | Working |
| **Agent Config** | PostgreSQL (agents, tools, prompt_versions, knowledge_documents, system_settings) | Working |
| **Web Admin** | React 19 - 8 pages, 15+ components | Functional |
| **Mobile Chat** | Flutter - 6 screens, Dio + IOWebSocketChannel | Structural issues |

### What Changed Since v2.1

- **8 MCP tools** implemented in current architecture: pet_knowledge_search, web_search, get_user_pets, search_clinics_nearby, get_clinic_services, check_available_slots, create_booking_for_user, check_vaccination_status
- **MongoDB integration** added for chat persistence (was PostgreSQL-only)
- **Backend integration** via httpx AsyncClient with retry logic
- **WebSocket streaming** fully implemented with ReAct trace
- **Context policy** added for role-based tool access control
- **Web Admin** fully built with 8 AI management pages
- **Mobile chat** screen built but has structural corruption
- **AI Accuracy Improvement** (Sprint 13): Query Expansion, Knowledge Graph, Case Memory, Feedback Loop, Hybrid RAG Engine

### API Endpoints (43+)

| Route Group | File | Endpoints | Description |
|-------------|------|-----------|-------------|
| `/api/v1/agents` | `agents.py` | 7 | Agent CRUD, prompt versioning, test playground |
| `/api/v1/tools` | `tools.py` | 5 | Tool management, enable/disable |
| `/api/v1/knowledge` | `knowledge.py` | 14 | Document upload, process, query, debug, KG build/stats, case memory stats/prune |
| `/api/v1/settings` | `settings.py` | 12 | System settings, seed, connection tests |
| `/api/v1/chat` | `chat.py` | 5+ | Chat sessions, messages (REST fallback), feedback submit/stats |
| `/ws/chat/{session_id}` | `websocket/chat.py` | 1 | Real-time WebSocket chat |

#### New Endpoints (Sprint 13 - AI Accuracy Improvement)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/chat/feedback` | All roles | Submit feedback for analytics, audit, and monitoring |
| `GET` | `/api/v1/chat/feedback/stats` | All roles | Feedback statistics (admin=all, others=own) |
| `POST` | `/api/v1/knowledge/build-kg` | Admin | Build Knowledge Graph from existing documents |
| `GET` | `/api/v1/knowledge/kg-stats` | Admin | Knowledge Graph statistics (nodes, edges) |
| `GET` | `/api/v1/knowledge/case-memory/stats` | Admin | Case Memory statistics for EMR-driven records |
| `POST` | `/api/v1/knowledge/case-memory/prune` | Admin | Prune stale or low-value EMR-driven case-memory records |

### MCP Tools (9 total)

| Tool | File | Description | Backend API Required |
|------|------|-------------|---------------------|
| `pet_knowledge_search` | `medical_tools.py` | Knowledge base retrieval for pet care and symptom questions | No (Qdrant) |
| `web_search` | `medical_tools.py` | Web search fallback | No (external) |
| `get_user_pets` | `booking_tools.py` | Get user's pet list | Yes |
| `search_clinics_nearby` | `booking_tools.py` | Find nearby clinics | Yes |
| `get_clinic_services` | `booking_tools.py` | Get clinic services & prices | Yes |
| `check_available_slots` | `booking_tools.py` | Check booking availability | Yes |
| `create_booking_for_user` | `booking_tools.py` | Create actual booking | Yes |
| `check_vaccination_status` | `booking_tools.py` | Check pet vaccination records | Yes |

---

## 2. Issues Found (21 Items)

### CRITICAL (5 items - Must fix before production)

| ID | Issue | File:Line | Impact | Fix |
|----|-------|-----------|--------|-----|
| **C1** | Hardcoded JWT secret default `"petties-agent-service-secret-key-change-in-production"` | `app/config/settings.py:227-228` | Anyone can forge JWT tokens | Remove default, require env var `JWT_SECRET`, fail fast on startup if missing |
| **C2** | REST `POST /chat/sessions/{id}/messages` returns placeholder `"Đang xử lý tin nhắn..."` without invoking AI | `app/api/routes/chat.py:246-291` | REST chat completely broken | Either invoke agent or remove endpoint and document WebSocket-only |
| **C3** | Web Admin `createChatWebSocket(sessionId)` creates WebSocket without JWT token | `petties-web/src/services/agentService.ts:430-438` | AI Service rejects with code 1008 | Add `?token=` query param from auth store |
| **C4** | Missing `SPRING_BACKEND_URL` in docker-compose.dev.yml and docker-compose.prod.yml | `docker-compose.dev.yml`, `docker-compose.prod.yml` | All 6 booking tools fail in containers (default is `localhost:8080/api` which doesn't resolve) | Add `SPRING_BACKEND_URL=http://backend:8080/api` to AI service env |
| **C5** | Missing `MONGODB_URL` and `MONGODB_DATABASE` in docker-compose.prod.yml | `docker-compose.prod.yml:93-118` | AI chat fails entirely in production | Add MongoDB env vars to production compose |

### HIGH (4 items)

| ID | Issue | File:Line | Impact | Fix |
|----|-------|-----------|--------|-----|
| **H1** | Debug endpoint `/knowledge/debug/qdrant` has no production guard | `app/api/routes/knowledge.py:573` | Exposes internal Qdrant state in production | Add `if settings.DEBUG` guard or admin-only auth |
| **H2** | JWT token passed in WebSocket URL query param (visible in server logs, browser history) | `app/api/websocket/chat.py:73-100`, `ai_chat_service.dart:246` | Token leakage risk | Accept token in first WebSocket message instead of URL, or ensure server logs redact query params |
| **H3** | Test coverage gaps - 43 tests exist but missing: routes HTTP tests, LLM client, RAG engine with real Qdrant, MongoDB operations, auth middleware, AgentFactory, tool scanner | `tests/` | Regressions go undetected | Add integration tests for critical paths (see Section 4) |
| **H4** | `SingleAgent` is a god class at 1710 lines | `app/core/agents/single_agent.py` | Hard to maintain, test, or modify | Extract into: message formatting, tool execution, history management, ReAct loop |

### MEDIUM (9 items)

| ID | Issue | File:Line | Impact | Fix |
|----|-------|-----------|--------|-----|
| **M1** | Duplicate seed logic - `seed.py` AND `settings.py` both define seed data | `app/db/postgres/seed.py`, `app/api/routes/settings.py` | Data inconsistency if one is updated without the other | Single source of truth in `seed.py`, settings route calls it |
| **M2** | Dead code - Legacy `AgentState` class still exists alongside `ReActState` | `app/core/agents/state.py` | Confusion about which state class to use | Remove `AgentState`, keep only `ReActState` |
| **M3** | Dead code - Unused PostgreSQL chat models (`ChatSession`, `ChatMessage`) | `app/db/postgres/models.py` | Chat is MongoDB-only now, PG models confuse | Remove PG chat models and related Alembic migration |
| **M4** | Mixed logging - some files use `logging.getLogger`, others use `loguru`, some use `print()` | Various files | Inconsistent log format, hard to grep | Standardize on `loguru` throughout |
| **M5** | httpx AsyncClient in `llm_client.py` is created per-request, never explicitly closed | `app/services/llm_client.py` | Connection leak under load | Use `async with` context manager or singleton with lifecycle |
| **M6** | No WebSocket auto-reconnect in mobile app | `petties_mobile/lib/data/services/ai_chat_service.dart` | User sees "connection lost" without recovery | Add exponential backoff reconnect logic |
| **M7** | No connection pooling for httpx backend client | `app/services/backend_client.py` | Performance under concurrent requests | Use `httpx.AsyncClient` with connection pool limits |
| **M8** | No shared API contract between AI Service and Backend | N/A | Manual camelCase/snake_case conversion, easy to drift | Consider shared OpenAPI spec or at minimum document expected formats |
| **M9** | `output_schema` field on tools is stored but never used at runtime | `app/core/tools/executor.py` | Schema validation of tool outputs not enforced | Either implement validation or document it as future enhancement |

### LOW (3 items)

| ID | Issue | File:Line | Impact | Fix |
|----|-------|-----------|--------|-----|
| **L1** | Deprecated `datetime.utcnow()` used in multiple files | Various | Python 3.12 deprecation warning | Replace with `datetime.now(timezone.utc)` |
| **L2** | Missing loading/skeleton states for some Web Admin pages | `petties-web/src/pages/ai-management/` | Blank page flash on slow connections | Add loading skeletons |
| **L3** | No offline support or message queue in mobile chat | `petties_mobile/` | Messages lost if sent while disconnected | Queue messages locally, send when reconnected |

---

## 3. Improvement Plan (3 Phases)

### Phase 1: Critical Fixes (1-2 days) - Sprint 13

**Goal:** Make the system safe and functional for demo/deployment.

| Task | Issues Addressed | Effort |
|------|-----------------|--------|
| Fix JWT secret - require env var, fail fast | C1 | 30min |
| Fix REST chat endpoint - either implement or remove | C2 | 1-2h |
| Fix Web Admin WebSocket auth - add JWT token | C3 | 30min |
| Fix Docker Compose env vars (dev + prod) | C4, C5 | 30min |
| Add production guard to debug endpoint | H1 | 15min |
| Fix `ai_chat_screen.dart` structural corruption | Mobile | 2-3h |

### Phase 2: Stabilization (3-5 days) - Post Sprint 13

**Goal:** Reduce technical debt and improve reliability.

| Task | Issues Addressed | Effort |
|------|-----------------|--------|
| Improve WebSocket token handling (first-message auth) | H2 | 2h |
| Add critical path integration tests | H3 | 2-3 days |
| Remove dead code (AgentState, PG chat models) | M2, M3 | 1h |
| Consolidate seed logic to single source | M1 | 1h |
| Standardize logging on loguru | M4 | 2h |
| Fix httpx client lifecycle | M5, M7 | 2h |
| Add mobile WebSocket auto-reconnect | M6 | 2-3h |
| Fix deprecated datetime.utcnow() | L1 | 30min |

### Phase 3: Quality (Post-sprint, if time allows)

**Goal:** Architecture improvements for long-term maintainability.

| Task | Issues Addressed | Effort |
|------|-----------------|--------|
| Refactor SingleAgent god class | H4 | 1-2 days |
| Implement output_schema validation | M9 | 1 day |
| Add shared API contract documentation | M8 | 1 day |
| Add loading skeletons to Web Admin | L2 | 1 day |
| Add offline message queue to mobile | L3 | 2-3 days |

---

## 4. Test Coverage Matrix

### Currently Tested (43 tests in 8 files)

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `test_agents.py` | Agent CRUD operations | Agent create/read/update |
| `test_booking_tools.py` | Booking tool logic | Tool input validation, mock API calls |
| `test_chat.py` | Chat session/message CRUD | MongoDB operations |
| `test_medical_tools.py` | Medical tool logic | RAG query formatting |
| `test_rag.py` | RAG engine | Document processing, query |
| `test_react_agent.py` | ReAct loop | Thought-Action-Observation cycle |
| `test_tools.py` | Tool scanning/execution | MCP tool discovery |
| `test_websocket.py` | WebSocket events | Event parsing |

### NOT Tested (Priority Order)

| Area | Priority | Why Critical |
|------|----------|-------------|
| **HTTP route handlers** (actual FastAPI endpoints) | P0 | No tests verify HTTP status codes, auth, validation |
| **Auth middleware** | P0 | JWT validation, role extraction untested |
| **LLM client** (OpenRouter integration) | P1 | Mock vs real API behavior differs |
| **MongoDB operations** (production queries) | P1 | Connection handling, query correctness |
| **AgentFactory** | P1 | Agent initialization with config |
| **Tool scanner** (MCP discovery) | P2 | Tool registration correctness |
| **WebSocket full flow** (connect → send → receive) | P1 | End-to-end WebSocket untested |
| **RAG with real Qdrant** | P2 | Only mock Qdrant tested |
| **Context policy** (role-based tool filtering) | P1 | Tool access control correctness |
| **Error recovery** (LLM timeout, Qdrant down) | P2 | Graceful degradation |

---

## 5. Deployment Checklist

### Required Environment Variables

| Variable | docker-compose.dev.yml | docker-compose.prod.yml | Required |
|----------|----------------------|------------------------|----------|
| `DATABASE_URL` | Present | Present | Yes |
| `MONGODB_URL` | Present | **MISSING (C5)** | Yes |
| `MONGODB_DATABASE` | Present | **MISSING (C5)** | Yes |
| `JWT_SECRET` | Present | Present | Yes |
| `SPRING_BACKEND_URL` | **MISSING (C4)** | **MISSING (C4)** | Yes (for booking tools) |
| `OPENROUTER_API_KEY` | DB-managed | DB-managed | Yes (via Admin UI) |
| `COHERE_API_KEY` | DB-managed | DB-managed | Yes (via Admin UI) |
| `QDRANT_URL` | DB-managed | DB-managed | Yes (via Admin UI) |
| `QDRANT_API_KEY` | DB-managed | DB-managed | Yes for Cloud |
| `REDIS_URL` | N/A | N/A | No (AI service doesn't use Redis) |

### Pre-Production Verification

- [ ] All CRITICAL issues (C1-C5) fixed
- [ ] `JWT_SECRET` is NOT the default hardcoded value
- [ ] Docker Compose has all required env vars
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Seed data loaded (`POST /api/v1/settings/seed`)
- [ ] OpenRouter API key configured and tested
- [ ] Cohere API key configured and tested
- [ ] Qdrant Cloud connection verified
- [ ] Knowledge base has documents uploaded and processed
- [ ] WebSocket chat tested end-to-end (mobile + web)
- [ ] REST fallback endpoint either works or is removed
- [ ] Debug endpoint (`/knowledge/debug/qdrant`) protected

### Post-Production Verification

- [ ] Booking tools can reach Spring Boot backend from container
- [ ] MongoDB chat persistence works (create session, send messages, reload)
- [ ] Agent responds correctly to pet care questions (RAG)
- [ ] Agent can search clinics and create bookings (backend tools)
- [ ] WebSocket reconnects after network interruption
- [ ] Error messages display in Vietnamese to end users

---

## 6. Security Summary

| Area | Current State | Risk | Action |
|------|--------------|------|--------|
| **JWT Secret** | Hardcoded default | CRITICAL | Require env var, fail fast |
| **WebSocket Auth** | Token in URL query param | HIGH | Move to first-message auth |
| **Debug Endpoints** | No production guard | HIGH | Add `DEBUG` check or admin auth |
| **API Keys** | Stored in PostgreSQL system_settings | OK | Acceptable for server-side storage |
| **CORS** | Configured per environment | OK | Verify production whitelist |
| **Rate Limiting** | Not implemented | MEDIUM | Add per-user rate limiting |
| **Input Sanitization** | Basic validation on DTOs | OK | Monitor for injection attempts |

---

## 7. Architecture Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Single Agent + ReAct | Simpler to maintain, sufficient for current use cases, LangGraph ReAct handles tool routing | 2025-12 |
| MongoDB for chat (not PostgreSQL) | Document-oriented storage fits nested message/trace structure better | 2026-01 |
| OpenRouter (not direct LLM APIs) | Single API key for multiple models, easy model switching, cost management | 2025-12 |
| WebSocket-primary chat (REST fallback) | Real-time streaming essential for UX, REST as degraded fallback | 2026-01 |
| DB-based config (not env vars for API keys) | Admin can change API keys, models, prompts without redeployment | 2025-12 |
| Cohere embeddings (not OpenAI) | Better Vietnamese language support with embed-multilingual-v3 | 2025-12 |
| Qdrant Cloud (not self-hosted) | Managed service, no infrastructure overhead, free tier sufficient | 2025-12 |
| AI Accuracy Improvement (4 mechanisms) | Query Expansion + Knowledge Graph + Case Memory + Feedback Loop for continuous learning without retraining LLM | 2026-03 |
| SimpleGraphStore (not Neo4j) | Lightweight file-based graph storage sufficient for MVP, avoids extra infrastructure | 2026-03 |
| Text-based Case Memory (not CLIP/SigLIP) | LLM Vision describes images as text → embed text into Qdrant, simpler than multimodal embeddings | 2026-03 |
| HybridRAGEngine (parallel search) | Combines RAG + KG + Case Memory with graceful degradation, asyncio.gather for performance | 2026-03 |

---

## 8. File Structure (Actual - March 2026)

```
petties-agent-serivce/
├── .gitignore
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── alembic/
│   ├── env.py
│   └── versions/                    # 4 migration files
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── middleware/
│   │   │   └── auth.py              # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── agents.py            # Agent CRUD + test playground
│   │   │   ├── chat.py              # REST chat (C2: placeholder issue)
│   │   │   ├── knowledge.py         # RAG document management (H1: debug endpoint)
│   │   │   ├── settings.py          # System settings + seed (M1: duplicate seed)
│   │   │   └── tools.py             # Tool management
│   │   ├── schemas/
│   │   │   ├── agent_schemas.py
│   │   │   ├── feedback_schemas.py     # Pydantic schemas for feedback API
│   │   │   ├── knowledge_schemas.py
│   │   │   └── tool_schemas.py
│   │   └── websocket/
│   │       └── chat.py              # WebSocket streaming (H2: token in URL)
│   ├── config/
│   │   ├── config_helper.py
│   │   └── settings.py              # (C1: hardcoded JWT default)
│   ├── core/
│   │   ├── agents/
│   │   │   ├── factory.py           # AgentFactory
│   │   │   ├── single_agent.py      # 1710 lines (H4: god class)
│   │   │   └── state.py             # ReActState + legacy AgentState (M2)
│   │   ├── context_policy.py        # Role-based tool access
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── feedback_service.py  # Feedback handling for analytics and monitoring
│   │   ├── rag/
│   │   │   ├── __init__.py             # v3.0.0 - exports all RAG modules
│   │   │   ├── rag_engine.py           # LlamaIndex RAG engine
│   │   │   ├── query_expander.py       # LLM-based short query expansion
│   │   │   ├── knowledge_graph.py      # LlamaIndex KGIndex + SimpleGraphStore
│   │   │   ├── case_memory.py          # Confirmed case storage + feedback re-ranking
│   │   │   └── hybrid_engine.py        # Combines RAG + KG + Case Memory (parallel search)
│   │   └── tools/
│   │       ├── executor.py           # Tool execution (M9: output_schema unused)
│   │       ├── mcp_server.py
│   │       ├── scanner.py
│   │       └── mcp_tools/
│   │           ├── booking_tools.py  # 6 booking tools (556 lines)
│   │           └── medical_tools.py  # 3 medical tools (646 lines)
│   ├── db/
│   │   ├── mongo/
│   │   │   ├── client.py            # MongoDB connection
│   │   │   └── models.py            # Chat session/message models
│   │   └── postgres/
│   │       ├── models.py            # 7 models (5 active + 2 legacy M3)
│   │       ├── seed.py              # Seed data (M1: duplicate)
│   │       └── session.py
│   └── services/
│       ├── backend_client.py         # httpx to Spring Boot (M7: no pooling)
│       └── llm_client.py             # OpenRouter client (M5: never closed)
├── storage/
│   └── documents/                    # Uploaded knowledge docs
└── tests/
    ├── __init__.py
    ├── test_agents.py
    ├── test_booking_tools.py
    ├── test_chat.py
    ├── test_medical_tools.py
    ├── test_rag.py
    ├── test_react_agent.py
    ├── test_tools.py
    └── test_websocket.py
```

**Stats:** 59 app files, 8 test files (43 tests), 43+ REST endpoints, 1 WebSocket endpoint, 9 MCP tools

---

## 9. Mobile Chat Issues (`ai_chat_screen.dart`)

**File:** `petties_mobile/lib/ui/chat/ai_chat_screen.dart` (2121 lines)

**Structural corruption at lines 640-883:**
- `_buildContent()` method's error state widget has orphaned code from `_buildMessageBubble` spliced into its `BoxDecoration` (line 647)
- Booking-related variables (`isBookingReady`, `bookingDraft`), animation builders, and full message bubble UI are inserted in the middle of the error widget's Container
- Broken bracket nesting - error widget never properly closes
- Duplicate `_QuickPromptCard` inline widget (lines 833-878) vs standalone class (line 1661)
- Missing `ListView.builder` in `_buildContent()` - messages never rendered
- A second clean `_buildMessageBubble` exists at lines 885-1033 but lacks booking-ready features

**Fix:** Remove corrupted code block (lines 647-882), properly close error state widget, add `ListView.builder` that calls the clean `_buildMessageBubble`, merge booking-ready features into clean version.

**Other issues:**
- `AnimatedBuilder` at lines 1958, 2065 - should be `AnimatedBuilder` (verify Flutter API - may be correct or may need `AnimatedWidget`)
- No WebSocket auto-reconnect (M6)

---

**Document Version:** 3.1
**Status:** Sprint 13 - AI Accuracy Improvement Complete
**Next Review:** After Critical fixes (C1-C5) are implemented
