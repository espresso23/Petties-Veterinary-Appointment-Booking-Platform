# Petties AI Service - QA Checklist

**Version:** v2.1.0
**Date:** 2026-03-24
**Service:** petties-agent-serivce

> For architecture-layer audit and migration compliance, use:
> [AI_SERVICE_AUDIT_CHECKLIST.md](./AI_SERVICE_AUDIT_CHECKLIST.md)

---

## 1. Infrastructure Requirements

### 1.1 Database Connectivity

| # | Check Item | Expected | Status |
|---|------------|----------|--------|
| 1.1.1 | PostgreSQL connection | Connected, tables created | [ ] |
| 1.1.2 | MongoDB connection | Connected, indexes created | [ ] |
| 1.1.3 | Qdrant Cloud connection | Connected, collections exist | [ ] |

### 1.2 API Keys Configuration

| # | Check Item | Expected | Status |
|---|------------|----------|--------|
| 1.2.1 | OpenRouter API Key | Valid, sufficient credits | [ ] |
| 1.2.2 | Cohere API Key | Valid for embeddings | [ ] |
| 1.2.3 | JWT_SECRET | Set, min 32 characters | [ ] |

### 1.3 Environment Variables

| # | Check Item | Expected | Status |
|---|------------|----------|--------|
| 1.3.1 | APP_ENV | development/staging/production | [ ] |
| 1.3.2 | CORS_ORIGINS | Configured for allowed domains | [ ] |

---

## 2. Agent Stability Criteria

### 2.1 Error Handling

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 2.1.1 | Global exception handler | Test invalid tool call | [ ] |
| 2.1.2 | Fallback LLM when primary fails | Mock primary failure | [ ] |
| 2.1.3 | Timeout handling | Test with slow tool | [ ] |

### 2.2 ReAct Loop Safety

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 2.2.1 | Max iterations limit | Send complex query | [ ] |
| 2.2.2 | Loop prevention | Repeat same query | [ ] |
| 2.2.3 | Graceful termination | Test max iterations | [ ] |

### 2.3 Session Management

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 2.3.1 | WebSocket session cleanup | Disconnect client | [ ] |
| 2.3.2 | Chat history storage | Send messages, check DB | [ ] |
| 2.3.3 | Session isolation | Multiple sessions | [ ] |

---

## 3. Tool Execution

### 3.1 MCP Tools

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 3.1.1 | Tool registration | GET /api/v1/tools | [ ] |
| 3.1.2 | Tool enable/disable | Toggle tool, test | [ ] |
| 3.1.3 | Parameter validation | Invalid params | [ ] |
| 3.1.4 | Dropped params warning | Extra params | [ ] |

### 3.2 Tool Policies

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 3.2.1 | Empty params for allowed tools | get_user_pets() | [ ] |
| 3.2.2 | Context injection | Verify user_id injected | [ ] |
| 3.2.3 | Role-based access | Test with different roles | [ ] |

### 3.3 Error Recovery

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 3.3.1 | Tool fails gracefully | Mock tool error | [ ] |
| 3.3.2 | Error message to user | Invalid tool call | [ ] |
| 3.3.3 | Tool retry logic | Test max_retries | [ ] |

---

## 4. RAG & Knowledge Base

### 4.1 Vector Store

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 4.1.1 | Qdrant connection | GET /api/v1/settings/test-qdrant | [ ] |
| 4.1.2 | Collection exists | Check petties_knowledge_base | [ ] |
| 4.1.3 | Index loaded | Query test | [ ] |

### 4.2 Embeddings

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 4.2.1 | Cohere API works | Upload document | [ ] |
| 4.2.2 | Dimension matches (1024) | Check collection config | [ ] |

### 4.3 Query Pipeline

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 4.3.1 | RAG search | POST /api/v1/knowledge/query | [ ] |
| 4.3.2 | Hybrid search | Test with KG enabled | [ ] |
| 4.3.3 | Case Memory search | Test with image query | [ ] |

---

## 5. Security

### 5.1 Authentication

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 5.1.1 | JWT validation | Protected routes | [ ] |
| 5.1.2 | Role extraction | Check user.role | [ ] |
| 5.1.3 | Token expiration | Expired token | [ ] |

### 5.2 Input Validation

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 5.2.1 | Pydantic models | Invalid request body | [ ] |
| 5.2.2 | SQL injection | Special chars in params | [ ] |
| 5.2.3 | XSS prevention | HTML in messages | [ ] |

### 5.3 CORS

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 5.3.1 | Allowed origins | Cross-origin request | [ ] |
| 5.3.2 | Credentials | With credentials | [ ] |

---

## 6. Performance & Monitoring

### 6.1 Health Checks

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 6.1.1 | /health endpoint | curl localhost:8000/health | [ ] |
| 6.1.2 | DB status included | Check response | [ ] |
| 6.1.3 | MongoDB status | Check response | [ ] |

### 6.2 Logging

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 6.2.1 | Structured logs | Check log format | [ ] |
| 6.2.2 | Log levels | INFO/ERROR | [ ] |
| 6.2.3 | ReAct trace logging | Test chat | [ ] |

### 6.3 Rate Limiting (v2.1+)

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 6.3.1 | Request limit | 31 requests in 1 min | [ ] |
| 6.3.2 | Token limit | Large prompt | [ ] |
| 6.3.3 | 429 response | Check headers | [ ] |

---

## 7. API Endpoints

### 7.1 REST API

| # | Endpoint | Method | Test Command | Status |
|---|----------|--------|-------------|--------|
| 7.1.1 | /api/v1/agents | GET | List agents | [ ] |
| 7.1.2 | /api/v1/agents/{id}/test | POST | Test agent | [ ] |
| 7.1.3 | /api/v1/tools | GET | List tools | [ ] |
| 7.1.4 | /api/v1/knowledge/query | POST | Test RAG | [ ] |
| 7.1.5 | /api/v1/settings | GET | List settings | [ ] |

### 7.2 WebSocket

| # | Check Item | Test Command | Status |
|---|------------|-------------|--------|
| 7.2.1 | Connection | ws://localhost:8000/ws/chat/xxx | [ ] |
| 7.2.2 | Auth required | Without token | [ ] |
| 7.2.3 | Streaming | Send message | [ ] |
| 7.2.4 | History restore | Reconnect | [ ] |

---

## 8. Conversation Quality

### 8.1 Response Accuracy

| # | Check Item | Test Input | Expected | Status |
|---|------------|------------|----------|--------|
| 8.1.1 | Pet knowledge | "Chó bị tiêu chảy" | RAG result | [ ] |
| 8.1.2 | Booking flow | "Đặt lịch khám" | Tool call | [ ] |
| 8.1.3 | Clinic search | "Tìm phòng khám gần" | Clinic results | [ ] |

### 8.2 Vietnamese Language

| # | Check Item | Test Input | Expected | Status |
|---|------------|------------|----------|--------|
| 8.2.1 | Vietnamese response | Any query | Vietnamese | [ ] |
| 8.2.2 | Typo handling | "tieu chay" | Understood | [ ] |
| 8.2.3 | Role-based style | As PET_OWNER | Friendly | [ ] |

### 8.3 Context Awareness

| # | Check Item | Test Input | Expected | Status |
|---|------------|------------|----------|--------|
| 8.3.1 | Pet identification | "thú cưng của tôi" | get_user_pets called | [ ] |
| 8.3.2 | Conversation continuity | Multi-turn | Context preserved | [ ] |
| 8.3.3 | Booking context | Multi-step booking | State preserved | [ ] |

---

## 9. Test Commands Reference

```bash
# Health check
curl http://localhost:8000/health

# List agents
curl http://localhost:8000/api/v1/agents

# Test agent
curl -X POST http://localhost:8000/api/v1/agents/1/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Chó bị nôn"}'

# Test RAG
curl -X POST http://localhost:8000/api/v1/knowledge/query \
  -H "Content-Type: application/json" \
  -d '{"query": "cách chăm sóc chó con"}'

# List tools
curl http://localhost:8000/api/v1/tools

# Test WebSocket
wscat -c ws://localhost:8000/ws/chat/test123?token=<JWT>
```

---

## 10. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Tech Lead | | | |

---

## Appendix: Known Issues

| Issue | Severity | Workaround | Ticket |
|-------|----------|------------|--------|
| None | - | - | - |

---

## Appendix: Configuration Reference

```bash
# Environment Variables
APP_ENV=development
MAX_CONTEXT_STEPS=5
OBSERVATION_MAX_LENGTH=1500
REQUESTS_PER_MINUTE=30
TOKENS_PER_MINUTE=10000
```
