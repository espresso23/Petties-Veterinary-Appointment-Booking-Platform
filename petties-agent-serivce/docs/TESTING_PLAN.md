# PETTIES AI-SERVICE - TESTING & DEBUG PLAN

## Tổng quan

Tài liệu này định nghĩa kế hoạch Unit Test và Debug cho AI-Service của Petties.

**Mục tiêu:**
- Đảm bảo các components hoạt động đúng
- Dễ dàng debug khi có lỗi
- Phù hợp quy mô đồ án (không over-engineering)

---

## 1. Components cần Test

### Tổng quan Architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI-SERVICE COMPONENTS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   Agents    │     │    Tools    │     │     RAG     │      │
│   │  (LangGraph)│     │   (MCP)     │     │  (Qdrant)   │      │
│   └─────────────┘     └─────────────┘     └─────────────┘      │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │ LLM Client  │     │  Executor   │     │  Embeddings │      │
│   │  (Ollama)   │     │  (HTTP)     │     │  (nomic)    │      │
│   └─────────────┘     └─────────────┘     └─────────────┘      │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    Database (PostgreSQL)                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Priority Test:

| Component | Priority | Lý do |
|-----------|----------|-------|
| LLM Client | HIGH | Core dependency, mọi thứ phụ thuộc vào đây |
| Tools (MCP) | HIGH | Business logic chính |
| Agents | MEDIUM | Phụ thuộc vào LLM + Tools |
| RAG Engine | MEDIUM | Chỉ dùng cho Medical Agent |
| API Routes | LOW | FastAPI tự handle validation |
| Database Models | LOW | SQLAlchemy ORM ổn định |

---

## 2. Unit Test Plan

### 2.1 LLM Client Tests (`tests/test_services/test_llm_client.py`)

```python
"""
Test LLM Client - Ollama integration
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.llm_client import (
    OllamaClient,
    LLMConfig,
    LLMResponse,
    create_llm_client
)


class TestLLMConfig:
    """Test LLMConfig validation"""

    def test_default_config(self):
        """Test default config values"""
        config = LLMConfig()
        assert config.provider == "ollama"
        assert config.model == "kimi-k2-thinking"
        assert config.temperature == 0.5
        assert config.max_tokens == 2000

    def test_custom_config(self):
        """Test custom config values"""
        config = LLMConfig(
            model="llama3",
            temperature=0.7,
            max_tokens=1000
        )
        assert config.model == "llama3"
        assert config.temperature == 0.7


class TestOllamaClient:
    """Test OllamaClient methods"""

    @pytest.fixture
    def config(self):
        return LLMConfig(
            model="kimi-k2",
            base_url="http://localhost:11434"
        )

    @pytest.fixture
    def client(self, config):
        return OllamaClient(config)

    @pytest.mark.asyncio
    async def test_generate_success(self, client):
        """Test successful generation"""
        # Mock HTTP response
        mock_response = {
            "message": {"content": "Hello! How can I help?"},
            "prompt_eval_count": 10,
            "eval_count": 20
        }

        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value.json.return_value = mock_response
            mock_post.return_value.raise_for_status = MagicMock()

            result = await client.generate("Hello")

            assert result.content == "Hello! How can I help?"
            assert result.model == "kimi-k2"

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self, client):
        """Test generation with system prompt"""
        mock_response = {
            "message": {"content": "I am Petties assistant"},
        }

        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value.json.return_value = mock_response
            mock_post.return_value.raise_for_status = MagicMock()

            result = await client.generate(
                prompt="Who are you?",
                system_prompt="You are Petties AI assistant"
            )

            # Verify system prompt was included
            call_args = mock_post.call_args
            messages = call_args[1]["json"]["messages"]
            assert messages[0]["role"] == "system"

    @pytest.mark.asyncio
    async def test_generate_http_error(self, client):
        """Test handling HTTP errors"""
        import httpx

        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.HTTPError("Connection failed")

            with pytest.raises(httpx.HTTPError):
                await client.generate("Hello")

    @pytest.mark.asyncio
    async def test_chat_with_history(self, client):
        """Test chat with message history"""
        mock_response = {
            "message": {"content": "Based on our conversation..."},
        }

        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value.json.return_value = mock_response
            mock_post.return_value.raise_for_status = MagicMock()

            messages = [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"},
                {"role": "user", "content": "Tell me more"}
            ]

            result = await client.chat(messages)

            # Verify all messages were sent
            call_args = mock_post.call_args
            sent_messages = call_args[1]["json"]["messages"]
            assert len(sent_messages) == 3


class TestCreateLLMClient:
    """Test factory function"""

    def test_create_ollama_client(self):
        """Test creating Ollama client"""
        with patch('app.services.llm_client.settings') as mock_settings:
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_API_KEY = None
            mock_settings.OLLAMA_MODEL = "kimi-k2"

            client = create_llm_client()

            assert isinstance(client, OllamaClient)
```

### 2.2 Tools Tests (`tests/test_tools/`)

#### 2.2.1 Booking Tools (`test_booking_tools.py`)

```python
"""
Test Booking Tools - MCP tools for booking
"""
import pytest
from unittest.mock import AsyncMock, patch
from app.core.tools.mcp_tools.booking_tools import (
    check_slot,
    create_booking,
    cancel_booking,
    get_booking_history
)


class TestCheckSlot:
    """Test check_slot tool"""

    @pytest.mark.asyncio
    async def test_check_slot_available(self):
        """Test checking available slots"""
        mock_response = {
            "available": True,
            "slots": ["09:00", "10:00", "14:00"],
            "doctor_name": "Dr. Nguyen",
            "date": "2024-01-15"
        }

        with patch('httpx.AsyncClient') as MockClient:
            mock_client = AsyncMock()
            mock_client.get.return_value.json.return_value = mock_response
            mock_client.get.return_value.raise_for_status = AsyncMock()
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await check_slot("DOC_123", "2024-01-15")

            assert result["available"] == True
            assert len(result["slots"]) == 3

    @pytest.mark.asyncio
    async def test_check_slot_unavailable(self):
        """Test when no slots available"""
        mock_response = {
            "available": False,
            "slots": [],
            "doctor_name": "Dr. Nguyen",
            "date": "2024-01-15"
        }

        with patch('httpx.AsyncClient') as MockClient:
            mock_client = AsyncMock()
            mock_client.get.return_value.json.return_value = mock_response
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await check_slot("DOC_123", "2024-01-15")

            assert result["available"] == False
            assert result["slots"] == []

    @pytest.mark.asyncio
    async def test_check_slot_http_error(self):
        """Test handling HTTP errors"""
        import httpx

        with patch('httpx.AsyncClient') as MockClient:
            mock_client = AsyncMock()
            mock_client.get.side_effect = httpx.HTTPError("Server error")
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await check_slot("DOC_123", "2024-01-15")

            assert result["available"] == False
            assert "error" in result


class TestCreateBooking:
    """Test create_booking tool"""

    @pytest.mark.asyncio
    async def test_create_booking_success(self):
        """Test successful booking creation"""
        mock_response = {
            "booking_id": "BK_123456",
            "status": "confirmed",
            "pet_name": "Milo",
            "doctor_name": "Dr. Nguyen",
            "appointment_time": "2024-01-15 10:00"
        }

        with patch('httpx.AsyncClient') as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value.json.return_value = mock_response
            mock_client.post.return_value.raise_for_status = AsyncMock()
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await create_booking(
                pet_id="PET_123",
                doctor_id="DOC_456",
                date="2024-01-15",
                time="10:00",
                service_type="general_checkup"
            )

            assert result["status"] == "confirmed"
            assert result["booking_id"] == "BK_123456"

    @pytest.mark.asyncio
    async def test_create_booking_conflict(self):
        """Test booking when slot is taken"""
        mock_response = {
            "booking_id": None,
            "status": "failed",
            "error": "Slot already booked"
        }

        with patch('httpx.AsyncClient') as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value.json.return_value = mock_response
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await create_booking(
                pet_id="PET_123",
                doctor_id="DOC_456",
                date="2024-01-15",
                time="10:00"
            )

            assert result["status"] == "failed"
```

#### 2.2.2 Research Tools (`test_research_tools.py`)

```python
"""
Test Research Tools - Web search tools
"""
import pytest
from unittest.mock import patch, MagicMock
from app.core.tools.mcp_tools.research_tools import (
    web_search,
    search_youtube_videos
)


class TestWebSearch:
    """Test web_search tool"""

    @pytest.mark.asyncio
    async def test_web_search_success(self):
        """Test successful web search"""
        mock_results = [
            {"title": "Cách chăm sóc chó", "href": "https://example.com/1", "body": "..."},
            {"title": "Thức ăn cho chó", "href": "https://example.com/2", "body": "..."}
        ]

        with patch('app.core.tools.mcp_tools.research_tools.DDGS') as MockDDGS:
            mock_ddgs = MagicMock()
            mock_ddgs.text.return_value = mock_results
            MockDDGS.return_value.__enter__.return_value = mock_ddgs

            result = await web_search("chăm sóc chó")

            assert result["query"] == "chăm sóc chó"
            assert len(result["results"]) == 2

    @pytest.mark.asyncio
    async def test_web_search_no_results(self):
        """Test search with no results"""
        with patch('app.core.tools.mcp_tools.research_tools.DDGS') as MockDDGS:
            mock_ddgs = MagicMock()
            mock_ddgs.text.return_value = []
            MockDDGS.return_value.__enter__.return_value = mock_ddgs

            result = await web_search("very specific query xyz123")

            assert result["results"] == []

    @pytest.mark.asyncio
    async def test_web_search_error(self):
        """Test handling search errors"""
        with patch('app.core.tools.mcp_tools.research_tools.DDGS') as MockDDGS:
            MockDDGS.return_value.__enter__.side_effect = Exception("Rate limited")

            result = await web_search("test query")

            assert "error" in result
```

### 2.3 Agent Tests (`tests/test_agents/`)

#### 2.3.1 Main Agent (`test_main_agent.py`)

```python
"""
Test Main Agent - Intent classification and routing
"""
import pytest
from unittest.mock import AsyncMock, patch
from app.core.agents.main_agent import MainAgent


class TestMainAgent:
    """Test Main Agent functionality"""

    @pytest.fixture
    def agent(self):
        return MainAgent()

    def test_classify_intent_booking(self, agent):
        """Test booking intent classification"""
        test_cases = [
            ("Tôi muốn đặt lịch khám", "booking", "booking_agent"),
            ("Book appointment for my dog", "booking", "booking_agent"),
            ("Xem slot trống ngày mai", "booking", "booking_agent"),
            ("Hủy lịch hẹn", "booking", "booking_agent"),
        ]

        for message, expected_intent, expected_agent in test_cases:
            intent, next_agent = agent.classify_intent(message)
            assert intent == expected_intent, f"Failed for: {message}"
            assert next_agent == expected_agent

    def test_classify_intent_medical(self, agent):
        """Test medical intent classification"""
        test_cases = [
            ("Con chó nhà tôi bị nôn", "medical", "medical_agent"),
            ("Mèo bị tiêu chảy phải làm sao", "medical", "medical_agent"),
            ("My cat has symptoms of fever", "medical", "medical_agent"),
        ]

        for message, expected_intent, expected_agent in test_cases:
            intent, next_agent = agent.classify_intent(message)
            assert intent == expected_intent, f"Failed for: {message}"

    def test_classify_intent_research(self, agent):
        """Test research intent classification"""
        test_cases = [
            ("Tìm thức ăn cho chó con", "research", "research_agent"),
            ("Mẹo chăm sóc mèo", "research", "research_agent"),
            ("Review sản phẩm dinh dưỡng", "research", "research_agent"),
        ]

        for message, expected_intent, expected_agent in test_cases:
            intent, next_agent = agent.classify_intent(message)
            assert intent == expected_intent, f"Failed for: {message}"

    def test_classify_intent_general(self, agent):
        """Test general/greeting intent"""
        test_cases = [
            ("Xin chào", "general", "main_agent"),
            ("Hello", "general", "main_agent"),
            ("Cảm ơn", "general", "main_agent"),
        ]

        for message, expected_intent, expected_agent in test_cases:
            intent, next_agent = agent.classify_intent(message)
            assert intent == expected_intent, f"Failed for: {message}"

    @pytest.mark.asyncio
    async def test_invoke_general_greeting(self, agent):
        """Test invoke with general greeting"""
        with patch.object(agent, 'llm') as mock_llm:
            mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Xin chào!"))

            response = await agent.invoke("Hello")

            assert "Xin chào" in response or "routing" not in response.lower()
```

### 2.4 RAG Tests (`tests/test_rag/`)

```python
"""
Test RAG Engine
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.core.rag.rag_engine import RAGEngine, RetrievedChunk


class TestRAGEngine:
    """Test RAG Engine functionality"""

    @pytest.fixture
    def engine(self):
        with patch('app.core.rag.rag_engine.QdrantManager'):
            with patch('app.core.rag.rag_engine.DocumentProcessor'):
                return RAGEngine()

    @pytest.mark.asyncio
    async def test_query_success(self, engine):
        """Test successful RAG query"""
        # Mock processor embed_query
        engine.processor.embed_query = AsyncMock(return_value=[0.1] * 1536)

        # Mock Qdrant search
        engine.qdrant.search = MagicMock(return_value=[
            {
                "document_id": 1,
                "document_name": "vet_guide.pdf",
                "chunk_index": 0,
                "content": "Nôn ở chó có thể do nhiều nguyên nhân...",
                "score": 0.85
            }
        ])

        results = await engine.query("chó bị nôn")

        assert len(results) == 1
        assert results[0].content == "Nôn ở chó có thể do nhiều nguyên nhân..."
        assert results[0].score == 0.85

    @pytest.mark.asyncio
    async def test_query_no_results(self, engine):
        """Test query with no matching results"""
        engine.processor.embed_query = AsyncMock(return_value=[0.1] * 1536)
        engine.qdrant.search = MagicMock(return_value=[])

        results = await engine.query("something very specific")

        assert results == []

    @pytest.mark.asyncio
    async def test_index_document(self, engine):
        """Test document indexing"""
        engine.processor.process_file = MagicMock(return_value=[
            {"chunk_index": 0, "content": "Chunk 1", "metadata": {}},
            {"chunk_index": 1, "content": "Chunk 2", "metadata": {}}
        ])
        engine.processor.embed_chunks = AsyncMock(return_value=[[0.1] * 1536] * 2)
        engine.qdrant.upsert_vectors = MagicMock(return_value=True)

        count = await engine.index_document(
            file_content=b"test content",
            filename="test.pdf",
            document_id=1
        )

        assert count == 2
```

### 2.5 Tool Scanner Tests (`tests/test_tools/test_scanner.py`)

```python
"""
Test Tool Scanner
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.core.tools.scanner import ToolScanner


class TestToolScanner:
    """Test Tool Scanner functionality"""

    @pytest.fixture
    def scanner(self):
        return ToolScanner()

    @pytest.mark.asyncio
    async def test_scan_and_sync_new_tools(self, scanner):
        """Test scanning and syncing new tools"""
        mock_tools = [
            {"name": "new_tool", "description": "A new tool", "input_schema": {}, "output_schema": {}}
        ]

        with patch('app.core.tools.scanner.get_mcp_tools_metadata', return_value=mock_tools):
            with patch('app.core.tools.scanner.AsyncSessionLocal') as MockSession:
                mock_session = AsyncMock()
                mock_session.execute.return_value.scalar_one_or_none.return_value = None
                MockSession.return_value.__aenter__.return_value = mock_session

                result = await scanner.scan_and_sync_tools()

                assert result["total_tools"] == 1
                assert result["new_tools"] == 1

    @pytest.mark.asyncio
    async def test_assign_tool_to_agent(self, scanner):
        """Test assigning tool to agent"""
        mock_tool = MagicMock()
        mock_tool.assigned_agents = []

        with patch('app.core.tools.scanner.AsyncSessionLocal') as MockSession:
            mock_session = AsyncMock()
            mock_session.execute.return_value.scalar_one_or_none.return_value = mock_tool
            MockSession.return_value.__aenter__.return_value = mock_session

            result = await scanner.assign_tool_to_agent("test_tool", "booking_agent")

            assert result["success"] == True
```

---

## 3. Integration Tests

### 3.1 End-to-End Flow Test

```python
"""
Integration Test - Full conversation flow
"""
import pytest
from httpx import AsyncClient
from app.main import app


class TestE2EConversation:
    """End-to-end conversation tests"""

    @pytest.fixture
    async def client(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    @pytest.mark.asyncio
    async def test_booking_flow(self, client):
        """Test complete booking conversation flow"""
        # Step 1: User asks about booking
        response = await client.post("/api/chat", json={
            "message": "Tôi muốn đặt lịch khám cho chó",
            "session_id": "test_session_1"
        })
        assert response.status_code == 200
        data = response.json()
        assert "booking" in data["response"].lower() or "lịch" in data["response"]

    @pytest.mark.asyncio
    async def test_medical_flow(self, client):
        """Test medical consultation flow"""
        response = await client.post("/api/chat", json={
            "message": "Con mèo nhà tôi bị nôn 2 ngày rồi",
            "session_id": "test_session_2"
        })
        assert response.status_code == 200
        data = response.json()
        # Should contain medical advice or booking suggestion
        assert len(data["response"]) > 50
```

---

## 4. Debug Strategies

### 4.1 Logging Configuration

```python
# app/config/logging_config.py

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "detailed": {
            "format": "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "detailed",
            "level": "DEBUG"
        },
        "file": {
            "class": "logging.FileHandler",
            "filename": "logs/agent.log",
            "formatter": "detailed",
            "level": "DEBUG"
        }
    },
    "loggers": {
        "app.core.agents": {"level": "DEBUG"},
        "app.core.tools": {"level": "DEBUG"},
        "app.services.llm_client": {"level": "DEBUG"},
        "app.core.rag": {"level": "DEBUG"}
    }
}
```

### 4.2 Debug Endpoints

```python
# app/api/routes/debug.py (Development only)

from fastapi import APIRouter, Depends
from app.core.tools.scanner import tool_scanner
from app.services.llm_client import get_llm_client

router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/health")
async def health_check():
    """Check all services health"""
    return {
        "status": "ok",
        "ollama": await check_ollama_connection(),
        "qdrant": await check_qdrant_connection(),
        "database": await check_db_connection()
    }

@router.post("/test-llm")
async def test_llm(prompt: str = "Hello"):
    """Test LLM connection"""
    client = get_llm_client()
    response = await client.generate(prompt)
    return {"response": response.content, "model": response.model}

@router.post("/test-tool/{tool_name}")
async def test_tool(tool_name: str, params: dict = {}):
    """Test specific tool execution"""
    from app.core.tools.mcp_server import execute_tool
    result = await execute_tool(tool_name, params)
    return result

@router.get("/list-tools")
async def list_tools():
    """List all registered tools"""
    from app.core.tools.mcp_server import get_mcp_tools_metadata
    return get_mcp_tools_metadata()
```

### 4.3 Debug Middleware

```python
# app/api/middleware/debug.py

import time
import logging
from fastapi import Request

logger = logging.getLogger(__name__)

async def debug_middleware(request: Request, call_next):
    """Log request/response for debugging"""
    start_time = time.time()

    # Log request
    logger.debug(f"Request: {request.method} {request.url}")

    response = await call_next(request)

    # Log response time
    duration = time.time() - start_time
    logger.debug(f"Response: {response.status_code} in {duration:.2f}s")

    return response
```

---

## 5. Test Execution

### 5.1 Pytest Configuration (`pytest.ini`)

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts = -v --tb=short --cov=app --cov-report=html

# Markers
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow tests (LLM calls)
```

### 5.2 Run Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_services/test_llm_client.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run only unit tests
pytest -m unit

# Run with verbose output
pytest -v

# Run and stop on first failure
pytest -x
```

### 5.3 Test Fixtures (`tests/conftest.py`)

```python
"""
Shared test fixtures
"""
import pytest
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def mock_llm_client():
    """Mock LLM client for testing"""
    client = MagicMock()
    client.generate = AsyncMock(return_value=MagicMock(
        content="Mocked response",
        model="mock-model"
    ))
    return client


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = AsyncMock()
    return session


@pytest.fixture
def sample_booking_data():
    """Sample booking data for tests"""
    return {
        "pet_id": "PET_12345",
        "doctor_id": "DOC_67890",
        "date": "2024-01-15",
        "time": "10:00",
        "service_type": "general_checkup"
    }


@pytest.fixture
def sample_medical_query():
    """Sample medical queries for tests"""
    return [
        "Con chó nhà tôi bị nôn",
        "Mèo bị tiêu chảy",
        "Chó không ăn 2 ngày",
        "My cat has fever symptoms"
    ]
```

---

## 6. Checklist trước khi Test

### Pre-test Checklist:

- [ ] Ollama đang chạy (`ollama serve`)
- [ ] PostgreSQL đang chạy
- [ ] Qdrant đang chạy (nếu test RAG)
- [ ] Environment variables đã set
- [ ] Database migrations đã chạy

### Debug Checklist khi có lỗi:

1. **LLM không response:**
   - Check Ollama: `curl http://localhost:11434/api/tags`
   - Check model: `ollama list`
   - Check logs: `logs/agent.log`

2. **Tool không execute:**
   - Check tool registered: `/debug/list-tools`
   - Check tool enabled trong DB
   - Test tool trực tiếp: `/debug/test-tool/{name}`

3. **RAG không tìm được:**
   - Check Qdrant: `http://localhost:6333/dashboard`
   - Check collection có data
   - Test query trực tiếp: `engine.query("test")`

4. **Agent routing sai:**
   - Check intent classification logs
   - Test intent riêng: `agent.classify_intent("message")`
   - Check system prompt

---

**Version:** 1.0
**Phù hợp:** Quy mô đồ án khóa luận
**Nguyên tắc:** Test đủ dùng, không over-engineering
