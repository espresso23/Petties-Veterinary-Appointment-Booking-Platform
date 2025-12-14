# DATABASE DATA FLOW - PETTIES AGENT SERVICE

**Version:** 1.0
**Last Updated:** December 13, 2025

---

## TỔNG QUAN DATABASE SCHEMA

Agent Service sử dụng PostgreSQL với 7 tables chính:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     POSTGRESQL DATABASE                              │
│                                                                      │
│  ┌───────────────┐     ┌──────────────────┐     ┌───────────────┐  │
│  │    agents     │────▶│  prompt_versions │     │     tools     │  │
│  └───────────────┘     └──────────────────┘     └───────────────┘  │
│         │                                                           │
│         ▼                                                           │
│  ┌───────────────┐     ┌──────────────────┐                        │
│  │ chat_sessions │────▶│  chat_messages   │                        │
│  └───────────────┘     └──────────────────┘                        │
│                                                                      │
│  ┌───────────────────┐     ┌──────────────────┐                    │
│  │ knowledge_documents│     │ system_settings  │                    │
│  └───────────────────┘     └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DATA ĐƯỢC LƯU KHI HỆ THỐNG CHẠY

### 1. SYSTEM_SETTINGS (Seeded lần đầu + Admin cập nhật)

**Khi nào được tạo:** Khi chạy `seed_db.py` hoặc gọi API `POST /api/v1/settings/seed`

**Data mặc định:**
```
| key                    | value                      | category    | is_sensitive |
|------------------------|----------------------------|-------------|--------------|
| OLLAMA_BASE_URL        | http://localhost:11434     | llm         | false        |
| OLLAMA_API_KEY         | (empty - local mode)       | llm         | true         |
| OLLAMA_MODEL           | kimi-k2                    | llm         | false        |
| OPENAI_API_KEY         | (empty)                    | embeddings  | true         |
| OPENAI_EMBEDDING_MODEL | text-embedding-ada-002     | embeddings  | false        |
| QDRANT_URL             | http://localhost:6333      | vector_db   | false        |
| QDRANT_API_KEY         | (empty)                    | vector_db   | true         |
```

**Khi nào được cập nhật:**
- Admin vào Dashboard → System Settings → Update value
- API: `PUT /api/v1/settings/{key}`

---

### 2. AGENTS (Seeded lần đầu + Admin cấu hình)

**Khi nào được tạo:** Khi chạy `seed_db.py` hoặc gọi API `POST /api/v1/settings/seed`

**Data mặc định (4 agents):**
```
| name           | agent_type | temperature | max_tokens | model   | enabled |
|----------------|------------|-------------|------------|---------|---------|
| main_agent     | MAIN       | 0.0         | 2000       | kimi-k2 | true    |
| booking_agent  | BOOKING    | 0.0         | 1500       | kimi-k2 | true    |
| medical_agent  | MEDICAL    | 0.5         | 2000       | kimi-k2 | true    |
| research_agent | RESEARCH   | 0.3         | 1500       | kimi-k2 | true    |
```

**System Prompt được load từ:**
1. `app/core/prompts/templates/{agent_name}.txt` (nếu tồn tại)
2. Fallback prompt hardcoded trong `seed_db.py`

**Khi nào được cập nhật:**
- Admin vào Dashboard → Agent Configuration → Edit prompt/temperature/model
- API: `PUT /api/v1/agents/{id}` hoặc `PUT /api/v1/agents/{id}/prompt`

---

### 3. PROMPT_VERSIONS (Tự động tạo khi update prompt)

**Khi nào được tạo:** Mỗi khi Admin update system_prompt của agent

**Data lưu:**
```
| id | agent_id | version | prompt_text          | is_active | created_by | notes        |
|----|----------|---------|----------------------|-----------|------------|--------------|
| 1  | 1        | 1       | "Original prompt..." | false     | admin      | Initial      |
| 2  | 1        | 2       | "Updated prompt..."  | true      | admin      | Fix routing  |
```

**Mục đích:** Version control để có thể rollback prompt về version cũ nếu cần.

---

### 4. TOOLS (Seeded lần đầu + Tool Scanner)

**Khi nào được tạo:**
1. Khi chạy `seed_db.py` (2 tools mẫu)
2. Khi Admin chạy Tool Scanner: `POST /api/v1/tools/scan`

**Data mặc định (2 tools):**
```
| name           | description                      | enabled | assigned_agents    |
|----------------|----------------------------------|---------|-------------------|
| check_slot     | Kiểm tra slot trống cho booking  | true    | ["booking_agent"] |
| create_booking | Tạo booking mới                  | true    | ["booking_agent"] |
```

**Khi Tool Scanner chạy:**
- Quét các files trong `app/core/tools/mcp_tools/*.py`
- Tìm các functions có decorator `@tool` hoặc `@mcp.tool`
- Tự động insert/update vào bảng `tools`

**Note:** All swagger-related fields have been removed in v0.0.2.

---

### 5. CHAT_SESSIONS (Tạo khi user bắt đầu chat)

**Khi nào được tạo:** Mỗi khi user bắt đầu một cuộc hội thoại mới

**Data lưu:**
```
| id | agent_id | user_id    | session_id                           | started_at          | ended_at |
|----|----------|------------|--------------------------------------|---------------------|----------|
| 1  | 1        | user_123   | 550e8400-e29b-41d4-a716-446655440000 | 2025-12-13 10:00:00 | NULL     |
```

**Tạo qua:**
- API: `POST /api/v1/chat/sessions`
- WebSocket connection: `/ws/chat/{session_id}`

**HIỆN TẠI:** Chat sessions đang được lưu trong **in-memory dict** (chưa persist vào DB)
```python
# chat.py line 82
chat_sessions: Dict[str, dict] = {}  # TODO: Replace with PostgreSQL storage
```

---

### 6. CHAT_MESSAGES (Tạo với mỗi message)

**Khi nào được tạo:** Mỗi khi có message trong chat session

**Data lưu:**
```
| id | session_id | role      | content                    | message_metadata                          | timestamp           |
|----|------------|-----------|----------------------------|-------------------------------------------|---------------------|
| 1  | 1          | user      | "Mèo tôi bị nôn"           | NULL                                      | 2025-12-13 10:00:01 |
| 2  | 1          | assistant | "Mèo nôn bao nhiêu lần?" | {"routed_to": "medical_agent", "tools": []} | 2025-12-13 10:00:03 |
```

**message_metadata có thể chứa:**
```json
{
  "routed_to": "medical_agent",
  "tools_called": ["search_symptoms"],
  "thinking_process": ["Analyzing symptoms...", "Searching knowledge base..."],
  "confidence": 0.85,
  "sources": ["https://petmd.com/article"]
}
```

**HIỆN TẠI:** Messages cũng chưa được persist vào DB (in-memory)

---

### 7. KNOWLEDGE_DOCUMENTS (Admin upload tài liệu)

**Khi nào được tạo:** Admin upload file PDF/DOCX vào Knowledge Base

**Data lưu:**
```
| id | filename           | file_path                    | file_type | file_size | processed | vector_count | uploaded_by |
|----|--------------------|------------------------------|-----------|-----------|-----------|--------------|-------------|
| 1  | benh_cho_meo.pdf   | /storage/docs/benh_cho_meo.pdf | pdf       | 1048576   | true      | 150          | admin       |
| 2  | vaccine_guide.docx | /storage/docs/vaccine_guide.docx | docx      | 524288    | false     | 0            | admin       |
```

**Workflow:**
1. Admin upload file → `POST /api/v1/knowledge/upload`
2. File được lưu vào storage
3. Document record được tạo với `processed=false`
4. Background job: Parse → Chunk → Embed → Store vectors in Qdrant
5. Update `processed=true`, `vector_count=N`

**Vectors được lưu ở đâu:** Qdrant Cloud (KHÔNG phải PostgreSQL)

---

## DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW                                         │
│                                                                              │
│  [SEED DATABASE]                                                             │
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │ system_settings  │     │      agents      │     │      tools       │    │
│  │ (7 default rows) │     │ (4 default rows) │     │ (2 default rows) │    │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘    │
│                                  │                                          │
│                                  ▼                                          │
│  [ADMIN UPDATES PROMPT] ──▶ prompt_versions (new row each update)          │
│                                                                              │
│  [ADMIN UPLOADS DOCS] ──▶ knowledge_documents → [QDRANT VECTORS]           │
│                                                                              │
│  [USER STARTS CHAT]                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────────────┐                                                       │
│  │  chat_sessions   │  ← Currently IN-MEMORY (TODO: PostgreSQL)            │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                       │
│  │  chat_messages   │  ← Currently IN-MEMORY (TODO: PostgreSQL)            │
│  └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ISSUES ĐÃ FIX (v0.0.2)

### 1. Models.py - Swagger fields removed ✅
**Status:** COMPLETED
- Đã xóa `ToolTypeEnum`, `ToolSource` enums
- Đã simplify Tool model (chỉ giữ fields cần thiết cho code-based tools)
- Tool model hiện tại chỉ có: id, name, description, input_schema, output_schema, enabled, assigned_agents, timestamps

### 2. Swagger-related files removed ✅
**Status:** COMPLETED
- Đã xóa `app/core/tools/swagger_importer.py`
- Đã xóa `app/core/tools/openapi_parser.py`
- Đã cập nhật `tools.py`, `tool_schemas.py`, `executor.py` để chỉ support code-based tools

---

## ISSUES CÒN LẠI

### 1. Chat persistence chưa implement
**File:** `app/api/routes/chat.py`
**Line:** 82

```python
chat_sessions: Dict[str, dict] = {}  # TODO: Replace with PostgreSQL storage
```

**Action:** Implement DB persistence cho chat sessions và messages

### 2. Alembic migration cần tạo
**Action:** Tạo migration mới để:
- Drop các columns swagger-related từ tools table (nếu đã tồn tại trong DB production)
- Keep DB schema clean

---

## SUMMARY TABLE

| Table              | Seeded | Runtime Created | Admin Managed | Notes                    |
|--------------------|--------|-----------------|---------------|--------------------------|
| system_settings    | ✅ 7   | ❌              | ✅ Update     | API keys, URLs           |
| agents             | ✅ 4   | ❌              | ✅ Update     | Prompts, config          |
| prompt_versions    | ❌     | ✅ On update    | ❌            | Auto-created             |
| tools              | ✅ 2   | ✅ Scanner      | ✅ Assign     | Tool registry            |
| chat_sessions      | ❌     | ⚠️ In-memory   | ❌            | TODO: DB persist         |
| chat_messages      | ❌     | ⚠️ In-memory   | ❌            | TODO: DB persist         |
| knowledge_documents| ❌     | ✅ Upload       | ✅ CRUD       | Vectors in Qdrant        |

---

## COMMANDS

```bash
# Seed database
python scripts/seed_db.py

# Or via API (requires admin auth)
curl -X POST "http://localhost:8000/api/v1/settings/seed?force=true" \
  -H "Authorization: Bearer <admin_token>"

# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"
```

---

**Document Maintained By:** Petties Dev Team
