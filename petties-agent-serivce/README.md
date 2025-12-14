# Petties Agent Service

**AI Agent Service cho Petties - Veterinary Appointment Booking Platform**

```
Version: v0.0.1 (MVP Foundation)
Status:  In Development
Stack:   Python 3.12 | FastAPI | LangGraph | FastMCP | PostgreSQL | Qdrant Cloud | Ollama
```

---

## Overview

**Petties Agent Service** là hệ thống quản trị, tinh chỉnh và giám sát AI Agents theo mô hình **Supervisor-Worker (Chỉ huy - Nhân viên)** với **Delegation (Ủy quyền)**.

> **Core Philosophy:** Thay vì xây dựng công cụ tạo Agent (No-code builder), hệ thống tập trung vào việc **Quản trị, Tinh chỉnh và Giám sát (Management, Tuning & Monitoring)**.
> - **Backend (Code-first):** Cấu trúc luồng Agent được lập trình viên code sẵn (LangGraph/Python)
> - **Frontend (Config-first):** Admin Dashboard dùng để cấu hình tham số, chọn công cụ và kiểm thử

### Core Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| **Hierarchical Agent Architecture** | Supervisor-Worker pattern với LangGraph | ✅ Implemented |
| **Dynamic Configuration Loader** | Load prompts & settings từ DB (thay .env) | ✅ Implemented |
| **Intent Classification** | Phân loại user request (Booking/Medical/Research) | ✅ Implemented |
| **System Prompt Management** | Quản lý prompts từ DB với versioning | ✅ Implemented |
| **Tool Management** | Code-based tools với FastMCP | ✅ Implemented |
| **RAG Knowledge Base** | Veterinary knowledge retrieval (Qdrant Cloud) | 🔄 In Progress |
| **Ollama Hybrid Mode** | Local & Cloud mode support | ✅ Implemented |
| **Real-time Streaming** | WebSocket streaming responses | 🔄 In Progress |

---

## Architecture

### Hierarchical Agent Architecture (Supervisor-Worker Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Mobile/Web)                         │
│                    Single Point of Contact                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              MAIN AGENT (Supervisor/Orchestrator)                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Intent Classification (Semantic Router + LLM)            │  │
│  │  Context-Aware Routing (với tóm tắt ngữ cảnh)            │  │
│  │  Synthesis & Smoothing (Rewrite thành brand voice)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  State Manager: Giữ toàn bộ lịch sử cuộc hội thoại              │
│  Quality Controller: Đánh giá câu trả lời trước khi gửi user    │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ Context Summary    │ Context Summary    │ Context Summary
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Booking Agent  │  │  Medical Agent  │  │  Research Agent │
│  (Sub-Worker)   │  │  (Semi-Auto)    │  │  (Web Only)     │
│  ─────────────  │  │  ─────────────  │  │  ─────────────  │
│  • check_slot   │  │  • search_sympt │  │  • web_search   │
│  • create_book  │  │  • RAG_search   │  │  • youtube_srch │
│  • cancel_book  │  │  • get_vaccine  │  │  • extract_url  │
│                 │  │                 │  │                 │
│                 │  │  Auto-Escalate: │  │  Phục vụ:       │
│                 │  │  Low Conf →     │  │  • Main Agent   │
│                 │  │  Call Research  │  │  • Medical Agent│
│                 │  └────────┬────────┘  │                 │
│                 │           │           │  Bắt buộc:      │
│                 │           └───────────┼─ Trích dẫn URL │
│                 │                       │                 │
│                 └───────────────────────┴─────────────────┘
│                                   │
│                                   ▼
│                      ┌─────────────────────┐
│                      │   Spring Boot API   │
│                      │   (via Swagger)     │
│                      └─────────────────────┘
```

### Key Architectural Components

1. **Dynamic Configuration Loader**
   - Module thay thế `python-dotenv`
   - Load API Keys và settings từ PostgreSQL `system_settings` table
   - Inject vào Runtime Context của Agent khi khởi tạo
   - Không cần restart server khi thay đổi config

2. **Agent Factory Pattern**
   - Tạo Agent instances với prompts từ DB
   - Load system settings (API keys, URLs) từ DB
   - Database là **Single Source of Truth** cho prompts

3. **System Prompt Management**
   - Prompts được lưu trong PostgreSQL với versioning
   - Admin chỉnh sửa qua Dashboard → Cập nhật DB → Agent tự động load khi runtime
   - Template files chỉ dùng để seed ban đầu

4. **Ollama Hybrid Mode**
   - **Local Mode:** Ollama server local (http://localhost:11434)
   - **Cloud Mode:** Ollama Cloud API (https://ollama.com) với API key
   - Auto-switching: API key → Cloud mode, `kimi-k2` → `kimi-k2:1t-cloud`

---

## Quick Start

### Prerequisites

- **Python 3.12+**
- **PostgreSQL 16+** (from root docker-compose)
- **Qdrant Cloud account** (for vector storage)
- **Ollama** (for local mode) OR **Ollama Cloud API Key** (for cloud mode)

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

# Qdrant Cloud
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_api_key

# Ollama (Local Mode)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=kimi-k2

# Ollama Cloud (Cloud Mode)
# OLLAMA_API_KEY=your_ollama_cloud_api_key  # Set này → Auto switch to Cloud

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
   - Vào `System Settings` → `Secrets`
   - Nhập Qdrant URL & API Key
   - Nhập Ollama API Key (nếu dùng Cloud mode)
   - Save → Backend tự động reload context

### Database Setup

```bash
# Run database migrations
alembic upgrade head

# Seed initial data (agents, tools, settings)
# Option 1: Via API
curl -X POST http://localhost:8000/api/v1/settings/seed?force=true \
  -H "Authorization: Bearer <admin_token>"

# Option 2: Via script (if mounted in container)
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
| Agent Orchestration | LangGraph 0.2.60 | ⭐ Supervisor-Worker pattern |
| Tool Protocol | FastMCP 0.2.0 | MCP tool framework |

### AI Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Primary LLM** | **Kimi k2 (Ollama)** | ⭐ Deep reasoning, Vietnamese support |
| **LLM Provider** | **Ollama (Hybrid)** | ⭐ Local OR Cloud mode |
| **Cloud Model** | **kimi-k2:1t-cloud** | ⭐ 256K context window (Cloud only) |
| **Embeddings** | **nomic-embed-text-v1.5** | ⭐ Best balance (Multilingual, Fast) |
| **RAG Framework** | LlamaIndex 0.11.20 | Document processing |
| **Web Search** | DuckDuckGo / Tavily | Web research |

> **⚠️ Important:** Hệ thống **KHÔNG** sử dụng GPT-4o hoặc các model closed-source đắt đỏ. Toàn bộ LLM inference qua **Ollama** (Local hoặc Cloud).

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
| **AG-03** | Model Parameter Tuning | ✅ Done | `/api/v1/agents/{id}` - temp, model, max_tokens |
| **AG-04** | LLM Intent Classification | 🔄 In Progress | LLM + Prompt based routing |

### Tools & Integrations

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **TL-01** | Automated Tool Scanner | ✅ Done | `/api/v1/tools/scan` - FastMCP code-based |
| **TL-02** | Tool Assignment & Routing | ✅ Done | `/api/v1/tools/{id}/assign` |

### Knowledge Base & RAG

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **KB-01** | Cloud Vector Sync (RAG) | 🔄 In Progress | Qdrant Cloud integration |
| **KB-02** | Knowledge Graph Integration | 🔴 TODO | Petagraph integration |

### Playground & Monitoring

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| **PG-01** | Real-time Chat Simulator | 🔄 In Progress | WebSocket endpoint exists |
| **PG-02** | Thinking Process Visualization | 🔄 In Progress | Logging implemented |
| **PG-03** | Traceability & Citation View | 🔴 TODO | URL citation for Research Agent |

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

### Ollama Hybrid Mode

**Local Mode (Default):**
- Ollama server chạy local: `http://localhost:11434`
- Model: `kimi-k2`
- Không cần API key

**Cloud Mode (Auto-activated):**
- Khi set `OLLAMA_API_KEY` trong DB → Auto switch
- Base URL: `https://ollama.com`
- Model: `kimi-k2:1t-cloud` (256K context window)
- Admin config qua Dashboard → Không cần restart server

**Configuration:**
```bash
# Via Dashboard: System Settings → Ollama Configuration
# Hoặc via API:
PUT /api/v1/settings/OLLAMA_API_KEY
{
  "value": "your_ollama_cloud_api_key"
}
```

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

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

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

**Last Updated:** 2025-12-08
