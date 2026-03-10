# AI Service Testing Strategy

Chiến lược kiểm thử AI Service dựa trên yêu cầu kỹ thuật từ [TECHNICAL SCOPE - AGENT MANAGEMENT](../documentation/TECHNICAL%20SCOPE%20PETTIES%20-%20AGENT%20MANAGEMENT.md).

---

## 1. Tổng quan Kiến trúc AI Service

```
User Query
    ↓
Single Agent (ReAct Pattern - LangGraph)
    ├── Thought: Phân tích query
    ├── Action: Chọn và gọi Tool phù hợp
    ├── Observation: Nhận kết quả từ Tool
    └── Answer: Tổng hợp và trả lời
           ↓
    ┌──────┴──────────────┐
    ↓                     ↓
FastMCP Tools        RAG Engine
(Code-based)         (LlamaIndex + Qdrant)
    ↓
[pet_knowledge_search]    → Knowledge base retrieval
[web_search]              → Web fallback lookup
[search_clinics_nearby]   → Find nearby clinics
[check_available_slots]   → Check available slots
[create_booking_for_user] → Create booking
```

---

## 2. Các Loại Test cho AI Service

### 2.1 Unit Testing (API Endpoints)

Kiểm tra từng API endpoint hoạt động đúng.

| Endpoint | Method | Test Cases |
|----------|--------|------------|
| `/api/v1/chat` | POST | ✅ Chat request with valid message |
| | | ✅ Chat request with context history |
| | | ❌ Empty message → 400 |
| | | ❌ Invalid session_id → 400 |
| `/api/v1/agents` | GET | ✅ Get agent config |
| `/api/v1/agents/{id}/config` | PUT | ✅ Update agent config |
| `/api/v1/tools` | GET | ✅ List available tools |
| `/api/v1/knowledge/upload` | POST | ✅ Upload document to RAG |
| `/api/v1/knowledge/query` | POST | ✅ Query RAG retrieval |

**Tools:** pytest, httpx (async), FastAPI TestClient

### 2.2 Agent Behavior Testing (Core)

Kiểm tra hành vi của Single Agent theo ReAct pattern.

#### A. ReAct Flow Test

| Input Query | Expected Tool | Priority |
|-------------|---------------|----------|
| "Con chó bị nôn" | `pet_knowledge_search` (RAG) | ⭐ Critical |
| "Mèo bị tiêu chảy từ hôm qua" | `pet_knowledge_search` | ⭐ Critical |
| "Đặt lịch khám thứ 2" | `check_available_slots` → `create_booking_for_user` | ⭐ Critical |
| "Tìm phòng khám gần đây" | `search_clinics_nearby` | High |
| "Xin chào" | No tool (direct response) | Medium |

**Test Method:**
```python
@pytest.mark.parametrize("query,expected_tool", [
    ("Con chó bị nôn", "pet_knowledge_search"),
    ("Đặt lịch khám thứ 2", "check_available_slots"),
    ("Tìm phòng khám gần đây", "search_clinics_nearby"),
])
async def test_react_tool_selection(query: str, expected_tool: str):
    response = await agent.process(query)
    assert expected_tool in response.tool_calls
```

#### B. Context Passing Test

Đảm bảo Agent giữ context qua nhiều lượt chat.

| Scenario | Test |
|----------|------|
| User nói "Con chó nhà tôi 5 tuổi" → Sau đó hỏi "Nó bị sao vậy?" | Single Agent giữ context: `pet_type=dog, age=5` |
| User hỏi nhiều lượt | Context history được giữ nguyên |

#### C. Tool Calling Test

Kiểm tra Agent gọi đúng Tool khi cần.

| Capability | Tool | Test Scenario |
|-----------|------|---------------|
| Booking | `check_available_slots` | "Thứ 2 có slot không?" → Tool được gọi |
| Booking | `create_booking_for_user` | "Đặt lịch 9h thứ 2" → Tool được gọi |
| Knowledge | `pet_knowledge_search` | Hỏi về bệnh → Knowledge base được query |
| Fallback | `web_search` | Knowledge base không đủ dữ liệu → Web search được gọi |

#### D. Low Confidence Fallback Flow Test

```
Scenario: Bệnh lạ không có trong RAG

Input: "Chó bị bệnh Parvo"

Expected Flow:
1. Single Agent query internal RAG bằng `pet_knowledge_search`
2. Confidence thấp / không có kết quả → gọi `web_search`
3. Single Agent tổng hợp câu trả lời từ web
4. Medical Agent tổng hợp kết quả
5. Main Agent format response

Assertions:
- Research Agent được gọi ít nhất 1 lần
- Response có nguồn trích dẫn (URL)
```

### 2.3 RAG Testing

Kiểm tra hệ thống Retrieval-Augmented Generation.

| Test Case | Expected Result |
|-----------|-----------------|
| Upload PDF → Query keyword | Đúng chunks được trả về |
| Query tiếng Việt | Chunks tiếng Việt được trả về |
| Query tiếng Anh (Cross-lingual) | Chunks tiếng Việt tương đương được trả về |
| Query không liên quan | Không có chunks hoặc low score |

**Metrics:**
- Retrieval Precision ≥ 80%
- Retrieval Recall ≥ 70%
- Latency < 500ms

### 2.4 Citation & Attribution Test

Đảm bảo mọi thông tin từ web đều có nguồn.

```python
async def test_citation_required():
    response = await chat("Tìm nơi bán thức ăn cho mèo")
    
    # Response phải có URLs
    assert response.citations is not None
    assert len(response.citations) > 0
    
    # Mỗi citation phải có URL hợp lệ
    for citation in response.citations:
        assert citation.url.startswith("http")
        assert citation.title is not None
```

### 2.5 Response Quality Test

Đánh giá chất lượng câu trả lời.

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Relevance | ≥ 80% | LLM-as-Judge hoặc Human Evaluation |
| Completeness | ≥ 70% | Có đủ thông tin user cần |
| Tone/Voice | Đúng | Thân thiện, chuyên nghiệp, đồng cảm |
| Hallucination | < 5% | So sánh với source documents |
| Response Time | < 5s | Average latency |

### 2.6 Error Handling Test

| Scenario | Expected Behavior |
|----------|-------------------|
| OpenRouter API down | Graceful error message, retry logic, fallback model |
| Qdrant connection failed | Fallback hoặc error message |
| Tool call timeout | Retry + timeout message |
| Invalid user input | Validation error message |
| Rate limiting | 429 response with retry-after |

---

## 3. Test Environments

> **✅ Trạng thái:** Tất cả environments đã được deploy và hoạt động.

| Environment | AI Service URL | Port | Qdrant | LLM Provider | Trạng thái |
|-------------|----------------|------|--------|--------------|------------|
| **Development** | `http://localhost:8000` | 8000 | Qdrant Cloud | OpenRouter API | ✅ Có |
| **Test/Staging** | `https://api-test.petties.world/ai` | 8001 | Qdrant Cloud | OpenRouter API | ✅ Đã deploy |
| **Production** | `https://ai.petties.world` | 8000 | Qdrant Cloud | OpenRouter API | ✅ Có |

### Test AI Service tại Production:

```bash
# Health check
curl https://ai.petties.world/health

# WebSocket test
wscat -c wss://ai.petties.world/ws/chat/test-session
```

### Test AI Service tại Local:

```bash
# Start AI service
cd petties-agent-serivce
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Health check
curl http://localhost:8000/health

# WebSocket test
wscat -c ws://localhost:8000/ws/chat/test-session
```

### Khi Test/Staging được deploy:

```bash
# Health check (AI Service qua api-test domain)
curl https://api-test.petties.world/ai/health

# WebSocket test
wscat -c wss://api-test.petties.world/ai/ws/chat/test-session
```

---

## 4. Test Execution Process

### 4.1 Automated Testing (CI)

```yaml
# .github/workflows/ai-service-test.yml
name: AI Service Tests

on:
  push:
    paths:
      - 'backend/petcare_agent/**'
  pull_request:
    paths:
      - 'backend/petcare_agent/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          
      - name: Install dependencies
        run: pip install -r requirements.txt
        
      - name: Run Unit Tests
        run: pytest tests/unit/ -v
        
      - name: Run Agent Behavior Tests
        run: pytest tests/agent/ -v --timeout=60
```

### 4.2 Manual Testing (Playground)

Admin Dashboard cung cấp:
- **Interactive Chat Simulator**: Test chat trực tiếp
- **Glass Box Visualization**: Xem luồng routing real-time
- **Response Feedback**: Đánh giá Good/Bad

---

## 5. Test Cases Template

### TC-AI-001: Intent Classification - Medical Query

| Field | Value |
|-------|-------|
| **Test ID** | TC-AI-001 |
| **Category** | Agent Behavior |
| **Priority** | Critical |
| **Input** | "Con chó nhà em bị nôn ra máu" |
| **Expected** | Call `pet_knowledge_search` |
| **Assertions** | 1. `tool_called == "pet_knowledge_search"` |
| | 2. `confidence >= 0.9` |
| | 3. `context.pet_type == "dog"` |

### TC-AI-002: Tool Calling - Booking

| Field | Value |
|-------|-------|
| **Test ID** | TC-AI-002 |
| **Category** | Tool Integration |
| **Priority** | Critical |
| **Input** | "Tôi muốn đặt lịch khám lúc 9h sáng thứ 2" |
| **Expected** | Call `check_available_slots` → `create_booking_for_user` |
| **Assertions** | 1. `check_available_slots` được gọi với đúng params |
| | 2. `create_booking_for_user` được gọi nếu slot available |
| | 3. Response chứa booking confirmation |

### TC-AI-003: Low Confidence Escalation

| Field | Value |
|-------|-------|
| **Test ID** | TC-AI-003 |
| **Category** | Agent Collaboration |
| **Priority** | High |
| **Input** | "Chó bị bệnh Addison" (rare disease) |
| **Expected** | `pet_knowledge_search` → `web_search` |
| **Assertions** | 1. Internal RAG returns low confidence |
| | 2. `web_search` được gọi |
| | 3. Response có citations từ web |

### TC-AI-004: Multilingual Support

| Field | Value |
|-------|-------|
| **Test ID** | TC-AI-004 |
| **Category** | Cross-lingual |
| **Priority** | Medium |
| **Input** | "My dog is vomiting" (English) |
| **Expected** | Call `pet_knowledge_search` (same as Vietnamese) |
| **Assertions** | 1. Correct routing despite language |
| | 2. Response in same language as query |

### TC-AI-005: Citation Requirement

| Field | Value |
|-------|-------|
| **Test ID** | TC-AI-005 |
| **Category** | Attribution |
| **Priority** | High |
| **Input** | "Tìm nơi bán vaccine cho chó" |
| **Expected** | Response với URLs nguồn |
| **Assertions** | 1. `citations` array không rỗng |
| | 2. Mỗi citation có valid URL |
| | 3. URLs accessible (status 200) |

---

## 6. Metrics & Reporting

### 6.1 Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Intent Accuracy** | ≥ 95% | Correct routing / Total queries |
| **Tool Call Success** | ≥ 98% | Successful calls / Total calls |
| **RAG Precision** | ≥ 80% | Relevant chunks / Retrieved chunks |
| **Response Latency (P95)** | < 5s | 95th percentile response time |
| **Citation Coverage** | 100% | Web responses with URLs |
| **Hallucination Rate** | < 5% | Inaccurate claims / Total claims |

### 6.2 Test Report Template

```markdown
# AI Service Test Report
**Date:** 2024-XX-XX
**Environment:** Staging
**Tester:** [Name]

## Summary
- Total Tests: XX
- Passed: XX (XX%)
- Failed: XX (XX%)

## Failed Tests
| Test ID | Description | Error |
|---------|-------------|-------|
| TC-AI-XXX | ... | ... |

## Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Intent Accuracy | XX% | ≥95% | ✅/❌ |
| ... | ... | ... | ... |

## Issues Found
1. [Issue description]
2. ...

## Recommendations
1. [Recommendation]
2. ...
```

---

## 7. Tools & Resources

| Tool | Purpose | Link |
|------|---------|------|
| **pytest** | Python testing framework | https://pytest.org |
| **httpx** | Async HTTP client for testing | https://httpx.org |
| **Postman** | Manual API testing | https://postman.com |
| **Admin Dashboard (Playground)** | Interactive testing | Local: `http://localhost:8000/playground` hoặc Production |
| **LangSmith** (optional) | LLM observability & tracing | https://langsmith.com |

---

## 8. Appendix: Test Data

### A. Sample Medical Queries

```json
[
  {"query": "Con chó bị nôn", "expected_tool": "pet_knowledge_search"},
  {"query": "Mèo không chịu ăn 2 ngày rồi", "expected_tool": "pet_knowledge_search"},
  {"query": "Chó bị tiêu chảy ra máu", "expected_tool": "pet_knowledge_search"},
  {"query": "Thú cưng bị ho", "expected_tool": "pet_knowledge_search"}
]
```

### B. Sample Booking Queries

```json
[
  {"query": "Đặt lịch khám thứ 2", "expected_tool": "check_available_slots"},
  {"query": "Tôi muốn hẹn nhân viên", "expected_tool": "create_booking_for_user"},
  {"query": "Có slot nào trống không?", "expected_tool": "check_available_slots"}
]
```

### C. Sample Research Queries

```json
[
  {"query": "Có bán Royal Canin không?", "expected_tool": "web_search"},
  {"query": "Cách huấn luyện chó", "expected_tool": "pet_knowledge_search"},
  {"query": "Review thức ăn cho mèo", "expected_tool": "web_search"}
]
```
