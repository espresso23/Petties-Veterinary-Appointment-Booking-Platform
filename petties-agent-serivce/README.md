# Petties Agent Service

**AI Agent Service cho Petties - Veterinary Appointment Booking Platform**

```
Version: v1.0.0 (Cloud-Only Ready)
Status:  ✅ Multi-Agent to Single Agent Migration Complete
Stack:   Python 3.12 | FastAPI | LangGraph | FastMCP | PostgreSQL | Qdrant Cloud | OpenRouter | Cohere
```

---

## Overview

**Petties Agent Service** là AI Chatbot sử dụng **Single Agent + ReAct Pattern** với nhiều tools được config bởi Admin.

> **Core Philosophy:** Thay vì xây dựng công cụ tạo Agent (No-code builder), hệ thống tập trung vào việc **Quản trị, Tinh chỉnh và Giám sát (Management, Tuning & Monitoring)**.
> - **Backend (Code-first):** Cấu trúc luồng Agent được lập trình viên code sẵn (LangGraph/Python)
> - **Frontend (Config-first):** Admin Dashboard dùng để cấu hình tham số, bật/tắt tools và kiểm thử

### Core Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| **Single Agent + ReAct** | Thought → Action → Observation → Loop | ✅ Implemented |
| **FastMCP Tools** | @mcp.tool decorator cho tools | ✅ Implemented |
| **Dynamic Configuration** | Load prompts & settings từ DB | ✅ Implemented |
| **System Prompt Management** | Quản lý prompts từ DB với versioning | ✅ Implemented |
| **Tool Management** | Bật/tắt tools qua Admin Dashboard | ✅ Implemented |
| **RAG Knowledge Base** | Veterinary knowledge retrieval (Qdrant Cloud) | ✅ Implemented |
| **Cloud LLM Integration** | OpenRouter API (Cloud-Only) | ✅ Implemented |
| **Cloud Embeddings** | Cohere embed-multilingual-v3 | ✅ Implemented |

---

## Architecture

### Single Agent + ReAct Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PETTIES AI AGENT (ReAct + LangGraph)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🧠 LLM Core (OpenRouter Cloud API)                                  │
│  ├── ReAct Pattern: Thought → Action → Observation → Loop          │
│  ├── Chain-of-Thought Reasoning                                     │
│  └── System Prompt (Admin Configurable via DB)                      │
│                                                                     │
│  🔧 Tools (FastMCP @mcp.tool)                                       │
│  ├── pet_care_qa       → RAG-based Q&A                             │
│  ├── symptom_search    → Symptom → Disease lookup                  │
│  ├── search_clinics    → Find nearby clinics                       │
│  ├── check_slots       → Check available slots                     │
│  └── create_booking    → Create booking via chat                   │
│                                                                     │
│  📚 RAG Engine (LlamaIndex + Qdrant Cloud)                          │
│  ├── LlamaIndex: Document processing, chunking, retrieval          │
│  ├── Qdrant Cloud: Vector storage với Binary Quantization          │
│  └── Cohere Embeddings (embed-multilingual-v3)                      │
│                                                                     │
│  ⚙️ Admin Config (Hot-reload)                                       │
│  ├── Enable/Disable Agent                                           │
│  ├── System Prompt (editable, versioned)                            │
│  ├── Parameters: Temperature, Max Tokens, Top-P                     │
│  ├── Tool Management: Enable/Disable individual tools              │
│  └── Knowledge Base: Upload/Remove documents                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### ReAct Flow (Reason + Act)

```
User: "Mèo bị sổ mũi nên làm gì?"
           │
           ▼
┌─────────────────────────────────────────────┐
│ THOUGHT: User hỏi về triệu chứng sổ mũi    │
│ Cần gọi tool pet_care_qa để tìm thông tin │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ ACTION: Call pet_care_qa("mèo sổ mũi")     │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ OBSERVATION: RAG trả về 3 chunks...       │
│ "Mèo sổ mũi có thể do cảm lạnh, dị ứng..." │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ THOUGHT: Có đủ thông tin để trả lời        │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│ ANSWER: "Mèo sổ mũi có thể do..."          │
└─────────────────────────────────────────────┘
```

### Key Architectural Components

1. **Single Agent + ReAct Pattern**
   - LangGraph implement ReAct loop: Think → Act → Observe
   - StateGraph với AgentState lưu messages, tool_calls, observations
   - Agent tự động chọn tool phù hợp dựa trên context

2. **FastMCP Tool Framework**
   - Tools được define với @mcp.tool decorator
   - Agent gọi trực tiếp hàm Python thông qua ReAct loop
   - Admin bật/tắt từng tool qua Dashboard

3. **Dynamic Configuration Loader**
   - Module thay thế `python-dotenv`
   - Load API Keys và settings từ PostgreSQL `system_settings` table
   - Inject vào Runtime Context của Agent khi khởi tạo
   - Không cần restart server khi thay đổi config

4. **Cloud AI Services (Cloud-Only Architecture)**
   - **LLM Provider:** OpenRouter API (gateway đến nhiều LLM providers)
   - **Models:** gemini-2.0-flash, llama-3.3-70b, claude-3.5-sonnet
   - **Embeddings:** Cohere embed-multilingual-v3
   - Zero infrastructure - không cần GPU/RAM local

---

## Quick Start

### Prerequisites

- **Python 3.12+**
- **PostgreSQL 16+** (from root docker-compose)
- **Qdrant Cloud account** (for vector storage)
- **Cloud API Keys:**
  - OpenRouter API Key (LLM) - https://openrouter.ai/keys
  - Cohere API Key (Embeddings) - https://dashboard.cohere.com/api-keys
  - Tavily API Key (Web Search) - https://tavily.com

### Installation

```bash
# Navigate to service directory
cd petties-agent-serivce

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
# Edit .env with your credentials
```

### Configuration

#### Environment Variables (`.env` - Fallback)

Key environment variables (chỉ dùng khi chưa config trong DB):

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/petties_agent_db

# LLM Provider (OpenRouter - Cloud Only)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-your-openrouter-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
PRIMARY_MODEL=google/gemini-2.0-flash-exp:free
FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct

# Embeddings (Cohere - Cloud Only)
EMBEDDING_PROVIDER=cohere
COHERE_API_KEY=your-cohere-key
EMBEDDING_MODEL=embed-multilingual-v3

# Qdrant Cloud
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_api_key

# Web Search (Tavily)
TAVILY_API_KEY=your-tavily-key

# Spring Boot Backend
SPRING_BACKEND_URL=http://localhost:8080

# JWT
SECRET_KEY=your_secret_key
ALGORITHM=HS256
```

#### System Settings (Database - Recommended)

**Sau khi chạy service lần đầu, nên config qua Dashboard:**

1. **Seed Database:**
   ```bash
   # Via API (requires admin auth)
   POST /api/v1/settings/seed?force=true
   ```

2. **Configure via Dashboard:**
   - Vào `System Settings` → `API Keys`
   - Nhập OpenRouter API Key (LLM)
   - Nhập Cohere API Key (Embeddings)
   - Nhập Qdrant URL & API Key
   - Nhập Tavily API Key (Web Search)
   - Save → Backend tự động reload context

### Database Setup

Hệ thống tự động tạo bảng (Database Tables) khi khởi chạy lần đầu thông qua hàm `init_db()`.

```bash
# Seed initial data (agents, tools, settings) sau khi tables đã được tạo
# Option 1: Via API
curl -X POST http://localhost:8000/api/v1/settings/seed?force=true \
  -H "Authorization: Bearer <admin_token>"

# Option 2: Via script (nếu chạy trong container)
docker-compose exec ai-service python scripts/seed_db.py
```

### Run Application

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Access API docs
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

---

## Project Structure

```
petties-agent-serivce/
├── alembic/                    # Database migrations
│   ├── versions/
│   └── env.py
│
├── app/
│   ├── main.py                 # FastAPI entry point
│   │
│   ├── config/                 # Configuration
│   │   ├── settings.py         # Pydantic Settings (fallback)
│   │   ├── dynamic_loader.py   # ⭐ Dynamic Config Loader (DB → Runtime)
│   │   └── logging_config.py   # Loguru setup
│   │
│   ├── api/                    # REST API Layer
│   │   ├── routes/
│   │   │   ├── agents.py       # Agent Management (AG-01, AG-02)
│   │   │   ├── tools.py        # Tool Management (TL-01, TL-03)
│   │   │   ├── settings.py     # ⭐ System Settings & Seed (SYS-01)
│   │   │   ├── knowledge.py    # Knowledge Base (KB-01)
│   │   │   └── chat.py         # Chat API
│   │   ├── middleware/
│   │   │   └── auth.py         # JWT Authentication
│   │   └── schemas/
│   │       ├── agent_schemas.py
│   │       └── tool_schemas.py
│   │
│   ├── core/                   # Business Logic
│   │   ├── agents/             # ⭐ LangGraph Agents
│   │   │   ├── base.py         # Base Agent class
│   │   │   ├── factory.py      # ⭐ Agent Factory (Dynamic Loading)
│   │   │   ├── main_agent.py   # Supervisor/Orchestrator
│   │   │   ├── booking_agent.py
│   │   │   ├── medical_agent.py
│   │   │   └── research_agent.py
│   │   │
│   │   ├── tools/              # Tool System (Code-based only)
│   │   │   ├── mcp_server.py   # FastMCP server
│   │   │   ├── scanner.py      # Tool scanner (TL-01)
│   │   │   ├── executor.py     # Dynamic executor
│   │   │   └── mcp_tools/
│   │   │       ├── booking_tools.py
│   │   │       ├── medical_tools.py
│   │   │       └── research_tools.py
│   │   │
│   │   ├── rag/                # RAG System
│   │   │   ├── document_processor.py
│   │   │   ├── qdrant_client.py
│   │   │   └── rag_engine.py
│   │   │
│   │   └── prompts/            # Prompt Templates (seed only)
│   │       ├── templates/
│   │       │   ├── main_agent.txt
│   │       │   ├── booking_agent.txt
│   │       │   ├── medical_agent.txt
│   │       │   └── research_agent.txt
│   │       └── loader.py
│   │
│   ├── db/                     # Database Layer
│   │   └── postgres/
│   │       ├── models.py       # SQLAlchemy models
│   │       └── session.py      # Async session
│   │
│   └── services/               # Services
│       └── llm_client.py       # Ollama/OpenAI client wrapper
│
├── scripts/
│   └── seed_db.py              # ⭐ Database seeding (loads templates → DB)
│
├── tests/
│
├── .env.example
├── requirements.txt
├── Dockerfile
├── alembic.ini
└── README.md
```

---

## API Endpoints

### Health Check

```http
GET /health
GET /api/actuator/health
```

### System Settings (SYS-01) - **⭐ New**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/settings` | List all settings (admin only) |
| `GET` | `/api/v1/settings/{key}` | Get setting by key |
| `PUT` | `/api/v1/settings/{key}` | Update setting value |
| `POST` | `/api/v1/settings/init` | Initialize default settings |
| `POST` | `/api/v1/settings/seed` | ⭐ Seed database (agents, tools, settings) |
| `POST` | `/api/v1/settings/test-ollama` | Test Ollama connection |
| `POST` | `/api/v1/settings/test-qdrant` | Test Qdrant connection |

**Example: Seed Database**

```bash
curl -X POST "http://localhost:8000/api/v1/settings/seed?force=true" \
  -H "Authorization: Bearer <admin_token>"
```

Response:
```json
{
  "status": "success",
  "message": "Database seeded successfully",
  "results": {
    "system_settings": 7,
    "agents": 4,
    "tools": 2
  }
}
```

### Agent Management (AG-01, AG-02, AG-03)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/agents` | List all agents (hierarchy view) |
| `GET` | `/api/v1/agents/{id}` | Get agent detail + tools |
| `PUT` | `/api/v1/agents/{id}` | Update agent config (temp, model) |
| `PUT` | `/api/v1/agents/{id}/prompt` | ⭐ Update system prompt (versioned, from DB) |
| `GET` | `/api/v1/agents/{id}/prompt-history` | Get prompt versions |
| `POST` | `/api/v1/agents/{id}/test` | ⭐ Test agent (loads from DB via Factory) |

**Example: Test Agent**

```bash
curl -X POST http://localhost:8000/api/v1/agents/1/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Xin chào, tôi muốn đặt lịch khám"}'
```

Response:
```json
{
  "success": true,
  "agent_name": "main_agent",
  "message": "Xin chào, tôi muốn đặt lịch khám",
  "response": "[Agent response với prompt từ DB]",
  "thinking_process": [
    "1. Loaded agent 'main_agent' from DB",
    "2. Using system prompt from database",
    "3. Processing user message...",
    "4. Generating response..."
  ]
}
```

### Tool Management (TL-01)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/tools/scan` | Scan FastMCP code-based tools |
| `GET` | `/api/v1/tools` | List all tools |
| `GET` | `/api/v1/tools/{id}` | Get tool detail |
| `PUT` | `/api/v1/tools/{id}/enable` | Enable/disable tool |
| `POST` | `/api/v1/tools/{id}/assign` | Assign tool to agent |
| `POST` | `/api/v1/tools/{name}/execute` | Test execute tool |

### Knowledge Base (KB-01)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/knowledge/upload` | Upload PDF/DOCX document |
| `GET` | `/api/v1/knowledge/documents` | List all documents |
| `GET` | `/api/v1/knowledge/documents/{id}` | Get document detail |
| `DELETE` | `/api/v1/knowledge/documents/{id}` | Delete document |
| `POST` | `/api/v1/knowledge/query` | Test RAG query |
| `GET` | `/api/v1/knowledge/status` | Knowledge base stats |

---

## Database Schema

### Core Tables

**agents** (Agent Configuration)
```sql
- id: Integer (PK)
- name: String(100) UNIQUE (main_agent, booking_agent, medical_agent, research_agent)
- agent_type: Enum (main, booking, medical, research)
- description: Text
- temperature: Float (0.0-1.0)
- max_tokens: Integer
- model: String(100) (kimi-k2, kimi-k2:1t-cloud, etc.)
- system_prompt: Text ⭐ (Single Source of Truth, editable via Dashboard)
- enabled: Boolean
- created_at: Timestamp
- updated_at: Timestamp
```

**system_settings** (⭐ Dynamic Configuration)
```sql
- id: Integer (PK)
- key: String(100) UNIQUE (OLLAMA_API_KEY, QDRANT_URL, etc.)
- value: Text (Encrypted if is_sensitive=True)
- category: Enum (llm, embeddings, vector_db, general)
- is_sensitive: Boolean
- description: Text
- created_at: Timestamp
- updated_at: Timestamp
```

**prompt_versions** (Prompt Versioning)
```sql
- id: Integer (PK)
- agent_id: Integer (FK → agents.id)
- version: Integer
- system_prompt: Text
- updated_by: String(100)
- created_at: Timestamp
```

**tools** (Tool Registry - Code-based only)
```sql
- id: Integer (PK)
- name: String(100) UNIQUE
- description: Text
- input_schema: JSON
- output_schema: JSON
- enabled: Boolean
- assigned_agents: JSON Array
```

---

## Tech Stack

### Core

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Python 3.12 | Primary language |
| Framework | FastAPI 0.115 | REST API + WebSocket |
| Agent Orchestration | LangGraph 0.2.60 | ⭐ Single Agent + ReAct pattern |
| Tool Protocol | FastMCP 0.2.0 | @mcp.tool decorator |

### AI Layer (Cloud-Only)

| Component | Technology | Purpose |
|-----------|------------|---------|
| **LLM Provider** | **OpenRouter API** | ⭐ Gateway đến nhiều LLM providers (Cloud) |
| **Primary Models** | **gemini-2.0-flash, llama-3.3-70b** | ⭐ Free tier + Vietnamese support |
| **Fallback** | **claude-3.5-sonnet** | Best quality khi cần |
| **Embeddings** | **Cohere embed-multilingual-v3** | ⭐ Best for Vietnamese (Cloud API) |
| **RAG Framework** | LlamaIndex 0.11.20 | Document processing |
| **Web Search** | Tavily API | Web research |

> **✅ Cloud-Only Architecture:** Hệ thống sử dụng Cloud APIs - **KHÔNG cần GPU/RAM local**. Phù hợp Render/Railway free tier.

### Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Relational DB | PostgreSQL 16 | ⭐ Configs, prompts, chat history, encrypted API keys |
| Vector DB | ⭐ **Qdrant Cloud** | RAG knowledge base (SaaS) |
| ORM | SQLAlchemy 2.0 (AsyncIO) | Async database access |
| Migrations | Alembic 1.13 | Schema versioning |
| Optimization | ⭐ **Binary Quantization** | 20-30x faster search, 32x storage reduction |

---

## Feature Implementation Status

### System & Security

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **SYS-01** | Dynamic Secrets Management | ✅ Done | `/api/v1/settings` - DB encrypted storage |
| **SYS-02** | Ollama Integration Manager | ✅ Done | Hybrid Local/Cloud mode, auto-switching |

### Agent Orchestration

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **AG-01** | Hierarchical Agent Management | ✅ Done | `/api/v1/agents` - CRUD |
| **AG-02** | System Prompt Editor | ✅ Done | ⭐ DB-based, versioned, editable via Dashboard |
| **AG-03** | Model Parameter Tuning | ✅ Done | `/api/v1/agents/{id}` - temp, model, max_tokens, top_p |
| **AG-04** | LLM Intent Classification | ✅ Done | ReAct pattern with Tool descriptions |

### Tools & Integrations

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **TL-01** | Automated Tool Scanner | ✅ Done | `/api/v1/tools/scan` - FastMCP code-based |
| **TL-02** | Tool Assignment & Routing | ✅ Done | `/api/v1/tools/{id}/assign` |

### Knowledge Base & RAG

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **KB-01** | Cloud Vector Sync (RAG) | ✅ Done | Qdrant Cloud integration (LlamaIndex) |
| **KB-02** | Knowledge Graph Integration | 🔴 TODO | Petagraph integration (Post-MVP) |

### Playground & Monitoring

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **PG-01** | Real-time Chat Simulator | ✅ Done | WebSocket + REST test endpoints |
| **PG-02** | Thinking Process Visualization | ✅ Done | ReAct trace logs implemented |
| **PG-03** | Traceability & Citation View | 🔄 In Progress | Link citation for Research Agent |

---

## Key Concepts

### Dynamic Configuration Loader

Module thay thế `python-dotenv`, load configuration từ PostgreSQL thay vì environment variables:

- **API Keys:** Encrypted storage trong `system_settings` table
- **Agent Prompts:** Load từ `agents.system_prompt` khi runtime
- **System Settings:** OLLAMA_BASE_URL, QDRANT_URL, etc. từ DB
- **Runtime Injection:** Backend tự động refresh context khi DB thay đổi

**Usage:**
```python
from app.core.config.dynamic_loader import DynamicConfigLoader

# Load agent config from DB
config = await DynamicConfigLoader.load_agent_config(session, "main_agent")

# Load system settings
settings = await DynamicConfigLoader.load_system_settings(session)
```

### Agent Factory Pattern

Tạo Agent instances với configuration từ Database:

```python
from app.core.agents.factory import AgentFactory

# Create agent với prompt từ DB
agent = await AgentFactory.create_agent(
    agent_name="main_agent",
    db_session=session
)

# Agent sẽ có:
# - system_prompt từ DB (agents.system_prompt)
# - LLM config từ DB (system_settings: OLLAMA_API_KEY, OLLAMA_BASE_URL)
```

### Cloud AI Services Configuration

**Cloud-Only Architecture (Recommended):**

| Service | Provider | Free Tier | Dashboard Config |
|---------|----------|-----------|------------------|
| **LLM** | OpenRouter | Free models | System Settings → LLM |
| **Embeddings** | Cohere | 1,000/month | System Settings → Embeddings |
| **Vector DB** | Qdrant Cloud | 1GB | System Settings → Vector DB |
| **Web Search** | Tavily | 1,000/month | System Settings → Search |

**Configuration:**
```bash
# Via Dashboard: System Settings → API Keys
# Hoặc via API:
PUT /api/v1/settings/OPENROUTER_API_KEY
{
  "value": "your_openrouter_api_key"
}
```

**Lợi ích:**
- ✅ Zero infrastructure (không cần GPU/RAM local)
- ✅ Deploy đơn giản trên Render/Railway free tier
- ✅ Free tiers đủ cho MVP
- ✅ Thay đổi config không cần restart server

### Prompt Management Flow

1. **Initial Seed:**
   - Templates trong `app/core/prompts/templates/*.txt`
   - Script `seed_db.py` load templates → Seed vào DB
   - Templates chỉ dùng lần đầu

2. **Runtime:**
   - Agents load prompts từ DB (`agents.system_prompt`)
   - Admin chỉnh sửa qua Dashboard → Update DB
   - Agent Factory load lại khi tạo instance

3. **Versioning:**
   - Mỗi lần update prompt → Tạo version mới trong `prompt_versions`
   - Admin có thể rollback về version cũ

---

## Development

### Database Management

Hệ thống sử dụng `sqlalchemy.run_sync(Base.metadata.create_all)` để tự động tạo bảng tại Startup. Nếu có thay đổi về Schema (thêm cột, đổi kiểu dữ liệu), bạn cần thực hiện ALTER TABLE thủ công hoặc xóa và tạo lại Database trong giai đoạn phát triển.

### Testing

```bash
# All tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific module
pytest tests/test_agents/
```

### Code Quality

```bash
# Format code
black app/

# Lint
flake8 app/

# Type checking
mypy app/
```

---

## Docker Deployment

### Build Image

```bash
docker build -t petties-agent-service:v0.0.1 .
```

### Run with Docker Compose

Service được định nghĩa trong root `docker-compose.dev.yml`:

```yaml
services:
  ai-service:
    build:
      context: ./petties-agent-serivce
      dockerfile: Dockerfile
      args:
        BUILD_ENV: dev
    container_name: petties-dev-ai-service
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://...
      # ... other env vars
    volumes:
      - ./petties-agent-serivce/app:/app/app:ro
    depends_on:
      - postgres
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Technical Scope](../docs-references/TECHNICAL%20SCOPE%20PETTIES%20-%20AGENT%20MANAGEMENT.md) | ⭐ Complete technical specification |
| [TODO List](./TODO.md) | ⭐ Implementation plan & remaining tasks |
| [Setup Guide](../docs-references/SETUP_GUIDE.md) | Development environment setup |
| [Development Workflow](../docs-references/DEVELOPMENT_WORKFLOW.md) | Git workflow & best practices |

---

## Team

**Project:** Petties - Veterinary Appointment Booking Platform (SEP490)

| Role | Name | Student ID |
|------|------|------------|
| Leader | Pham Le Quoc Tan | SE181717 |
| Member | Nguyen Duc Tuan | DE180807 |
| Member | Vu Minh Triet | DE180687 |
| Member | Luu Dang Dieu Huyen | DE180773 |
| Member | Le Phuong Uyen | DE180893 |

**Supervisor:** Nguyen Xuan Long (longnx6@fe.edu.vn)

---

## License

2024-2025 Petties Team - FPT University Da Nang

---

## Links

- **API Docs:** http://localhost:8000/docs (development)
- **Health Check:** http://localhost:8000/health
- **Project Repository:** [GitHub](https://github.com/your-repo)

---

**Last Updated:** 2025-12-26
