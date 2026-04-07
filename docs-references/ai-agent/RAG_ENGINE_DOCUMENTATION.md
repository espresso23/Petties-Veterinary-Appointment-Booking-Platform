# RAG Engine — Petties AI Assistant

## Tổng quan

RAG (Retrieval-Augmented Generation) Engine của Petties là hệ thống tìm kiếm và truy xuất tri thức từ tài liệu thú y đã được index, sử dụng **LlamaIndex** làm framework chính, **Cohere** cho embeddings tiếng Việt, và **Qdrant Cloud** cho vector storage.

---

## Kiến trúc

```
User Query (tiếng Việt)
    │
    ▼
┌─────────────────────────────────────────┐
│  HybridRAGEngine (hybrid_engine.py)     │
│                                         │
│  Query → Expand → Parallel Search       │
│         → Merge → Re-rank → Dedup       │
│                                         │
│  ┌────────────────┐ ┌────────────────┐  │
│  │  RAG Engine    │ │  Case Memory   │  │
│  │  (Knowledge    │ │  (EMR cases)   │  │
│  │   Base)        │ │                │  │
│  └───────┬────────┘ └───────┬────────┘  │
│          │                  │           │
│          ▼                  ▼           │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ Qdrant: KB   │  │ Qdrant: Cases│    │
│  │ petties_     │  │ petties_     │    │
│  │ knowledge_   │  │ case_memory  │    │
│  │ base         │  │ _v2          │    │
│  └──────┬───────┘  └──────┬───────┘    │
│         │                 │            │
│         ▼                 ▼            │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Cohere:      │  │ Cohere:      │   │
│  │ embed-multi  │  │ embed-multi  │   │
│  │ lingual-v3.0 │  │ lingual-v3.0 │   │
│  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────┘
```

---

## Components

### 1. HybridRAGEngine

**File:** `petties-agent-serivce/app/core/rag/hybrid_engine.py`

Lớp giao diện truy vấn thống nhất, kết hợp 2 nguồn tri thức:

| Nguồn | Collection | Weight | Mô tả |
|-------|-----------|--------|-------|
| **RAG** | `petties_knowledge_base` | 1.0x | Tài liệu PDF/DOCX/TXT đã index |
| **Case Memory** | `petties_case_memory_v2` | 1.2x | Ca bệnh đã xác nhận từ EMR |

#### Pipeline

```
User Query
    │
    ├─ Step 1: Query Expansion (nếu query < 5 từ)
    │     └─ QueryExpander.expand_query() → thêm từ đồng nghĩa, thuật ngữ y khoa
    │
    ├─ Step 2: Parallel Search (asyncio.gather)
    │     ├─ RAG Search → Qdrant petties_knowledge_base
    │     └─ Case Memory Search → Qdrant petties_case_memory_v2
    │
    ├─ Step 3: Merge kết quả từ 2 nguồn
    │
    ├─ Step 4: Re-rank theo weighted score
    │     └─ Case Memory được nhân weight 1.2x
    │
    ├─ Step 5: Deduplicate (theo content)
    │
    └─ Step 6: Trim về top_k
```

#### API

```python
async def query(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5,
    image_urls: Optional[List[str]] = None,
    pet_type: Optional[str] = None,
    enable_rag: bool = True,
    enable_case_memory: bool = True,
    enable_query_expansion: bool = True,
) -> HybridResult
```

#### Data Classes

```python
@dataclass
class HybridChunk:
    content: str          # Nội dung chunk
    score: float          # Điểm similarity (đã nhân weight)
    source: str           # "rag" hoặc "case_memory"
    metadata: Dict        # document_id, document_name, chunk_index, case_id...

@dataclass
class HybridResult:
    chunks: List[HybridChunk]  # Danh sách kết quả
    expanded_query: str        # Query sau khi mở rộng
    original_query: str        # Query gốc
    sources_used: Dict         # {"rag": 3, "case_memory": 2}
    timings_ms: Dict           # Thời gian từng bước (ms)
```

---

### 2. Query Expander

**File:** `petties-agent-serivce/app/core/rag/query_expander.py`

Tự động mở rộng query ngắn (< 5 từ) bằng LLM:

| Thuộc tính | Giá trị |
|-----------|---------|
| **Ngưỡng** | < 5 từ mới expand |
| **LLM** | OpenRouter (model từ DB config) |
| **Temperature** | 0.3 |
| **Max tokens** | 150 |
| **Output** | Thêm từ đồng nghĩa thú y, thuật ngữ y khoa, triệu chứng liên quan |

**Ví dụ:**
- Input: `"chó nôn"`
- Output: `"chó nôn tiêu chảy triệu chứng viêm ruột nhiễm khuẩn"`

Nếu query ≥ 5 từ hoặc expansion thất bại → giữ nguyên query gốc.

---

### 3. RAG Engine (Knowledge Base)

**File:** `petties-agent-serivce/app/core/rag/rag_engine.py`

#### Indexing (Upload & Process PDF)

```
PDF/DOCX/TXT File
    │
    ▼
┌──────────────────────────────────┐
│  LlamaIndexRAGEngine             │
│                                  │
│  1. Đọc file (PyMuPDF cho PDF)  │
│  2. SentenceSplitter             │
│     → chunk ~500 tokens          │
│     → overlap 50 tokens          │
│  3. Cohere embed                 │
│     → 1024-dim vector            │
│  4. Qdrant upsert                │
│     → petties_knowledge_base     │
│  5. Update DB status             │
│     → processed=True             │
└──────────────────────────────────┘
```

#### Querying

```
Query Text
    │
    ▼
┌──────────────────────────────────┐
│  LlamaIndexRAGEngine.query()     │
│                                  │
│  1. Cohere embed query           │
│     (input_type="search_query")  │
│     → 1024-dim vector            │
│                                  │
│  2. Qdrant similarity search     │
│     (COSINE distance)            │
│     → similarity_top_k=top_k     │
│                                  │
│  3. Filter by min_score          │
│  4. Deduplicate content          │
│  5. Filter by document_ids (opt) │
│  6. Return List[RetrievedChunk]  │
└──────────────────────────────────┘
```

#### API

```python
async def query(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5,
    document_ids: Optional[List[int]] = None,
) -> List[RetrievedChunk]
```

#### RetrievedChunk

```python
@dataclass
class RetrievedChunk:
    document_id: int      # ID tài liệu trong PostgreSQL
    document_name: str    # Tên file gốc
    chunk_index: int      # Vị trí chunk
    content: str          # Nội dung text
    score: float          # Cosine similarity score
```

---

### 4. Case Memory

**File:** `petties-agent-serivce/app/core/rag/case_memory.py`

Tìm kiếm các ca bệnh đã xác nhận từ EMR, hỗ trợ cả text và image.

#### Search Pipeline

```
Query (+ optional image URLs)
    │
    ├─ Text Branch
    │   ├─ Cohere embed query → 1024-dim vector
    │   └─ Qdrant search (named vector "text")
    │
    ├─ Image Branch (nếu có image_urls)
    │   ├─ Jina CLIP v2 embed → 1024-dim vector
    │   └─ Qdrant search (named vector "image")
    │
    ├─ Merge: gộp text + image hits, giữ max score theo case_id
    │
    ├─ Re-rank:
    │   ├─ Text-only: final_score = 1.0 * text_score
    │   └─ Có ảnh: final_score = 0.3 * text_score + 0.7 * image_score
    │
    └─ Trim về top_k
```

#### API

```python
async def search_similar(
    query: str,
    top_k: int = 5,
    min_score: float = 0.7,
    image_urls: Optional[List[str]] = None,
) -> List[CaseResult]
```

#### CaseResult

```python
@dataclass
class CaseResult:
    case_id: str           # ID case trong Qdrant
    content: str           # Mô tả case
    score: float           # Text similarity score
    final_score: float     # Score sau re-rank (text + image)
    payload: Dict          # species, diagnosis, exam_at, image_url...
```

---

## External Services

| Service | Vai trò | Endpoint/Collection | Dimension |
|---------|---------|---------------------|-----------|
| **Cohere** | Text embeddings (tiếng Việt) | `embed-multilingual-v3.0` | 1024 |
| **Qdrant Cloud** | Vector storage & search | `petties_knowledge_base`, `petties_case_memory_v2` | 1024 (COSINE) |
| **Jina API** | Image embeddings (Case Memory) | `jina-clip-v2` | 1024 |
| **OpenRouter** | Query expansion LLM | `/chat/completions` | N/A |

---

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client as MCP Tool<br/>pet_knowledge_search
    participant Hybrid as HybridRAGEngine
    participant Expander as QueryExpander
    participant RAG as RAG Engine
    participant CaseMem as Case Memory
    participant Cohere as Cohere API
    participant Jina as Jina API
    participant Qdrant as Qdrant Cloud

    Client->>Hybrid: query("chó nôn", top_k=5, min_score=0.4)

    Note over Hybrid: Step 1: Query Expansion
    Hybrid->>Expander: expand_query("chó nôn")
    Expander->>Expander: Check: 2 từ < 5 → cần expand
    Expander->>Expander: LLM expand với từ đồng nghĩa thú y
    Expander-->>Hybrid: "chó nôn tiêu chảy triệu chứng viêm ruột"

    Note over Hybrid: Step 2: Parallel Search
    par RAG Search
        Hybrid->>RAG: _search_rag(expanded_query, top_k=5, min_score=0.4)
        RAG->>Cohere: Embed query (search_query, 1024-dim)
        Cohere-->>RAG: Query embedding vector
        RAG->>Qdrant: Similarity search<br/>petties_knowledge_base (COSINE)
        Qdrant-->>RAG: Top-5 chunks với scores
        RAG-->>Hybrid: List[HybridChunk] (source="rag")
    and Case Memory Search
        Hybrid->>CaseMem: _search_case_memory(expanded_query, top_k=5, min_score=0.4)
        CaseMem->>Cohere: Embed query (search_query, 1024-dim)
        Cohere-->>CaseMem: Query embedding vector
        CaseMem->>Qdrant: Similarity search<br/>petties_case_memory_v2 (text vector)
        Qdrant-->>CaseMem: Top-5 cases với scores
        CaseMem-->>Hybrid: List[HybridChunk] (source="case_memory")
    end

    Note over Hybrid: Step 3: Merge & Re-rank
    Hybrid->>Hybrid: Gộp kết quả từ 2 nguồn
    Hybrid->>Hybrid: Sort theo score (CaseMemory weight 1.2x)
    Hybrid->>Hybrid: Deduplicate theo content
    Hybrid->>Hybrid: Trim về top_k=5

    Hybrid-->>Client: HybridResult {
        chunks: [HybridChunk, ...],
        expanded_query: "...",
        sources_used: {"rag": 3, "case_memory": 2},
        timings_ms: {...}
    }
```

---

## Data Flow

```
User Question: "chó nôn phải làm sao?"
    │
    ▼
[pet_knowledge_search tool]
    │
    ▼
[HybridRAGEngine.query()]
    │
    ├─ Query Expander: "chó nôn" → "chó nôn tiêu chảy viêm ruột..."
    │
    ├─ RAG Search
    │   ├─ Cohere: embed("chó nôn tiêu chảy viêm ruột...") → [1024 floats]
    │   └─ Qdrant: search(petties_knowledge_base) → 3 chunks
    │       ├─ "Khi chó bị nôn, cần ngừng cho ăn 12-24 giờ..." (score: 0.85)
    │       ├─ "Nguyên nhân chó nôn: viêm dạ dày, nhiễm khuẩn..." (score: 0.78)
    │       └─ "Chăm sóc chó nôn tại nhà: nước ấm, nghỉ ngơi..." (score: 0.72)
    │
    ├─ Case Memory Search
    │   ├─ Cohere: embed("chó nôn tiêu chảy viêm ruột...") → [1024 floats]
    │   └─ Qdrant: search(petties_case_memory_v2) → 2 cases
    │       ├─ Case #abc: Chó Poodle 3kg, nôn 2 ngày → viêm dạ dày (score: 0.78)
    │       └─ Case #def: Chó Golden 25kg, nôn máu → Parvo (score: 0.65)
    │
    ├─ Merge: 5 chunks từ 2 nguồn
    ├─ Re-rank: Case Memory weight 1.2x → Case #abc lên đầu
    ├─ Dedup: Loại content trùng
    └─ Trim: Giữ top 5
    │
    ▼
[HybridResult] → Tool trả về raw chunks → LLM tổng hợp câu trả lời tiếng Việt
```

---

## File Map

| Component | File Path |
|-----------|-----------|
| Hybrid RAG Engine | `petties-agent-serivce/app/core/rag/hybrid_engine.py` |
| RAG Engine | `petties-agent-serivce/app/core/rag/rag_engine.py` |
| Query Expander | `petties-agent-serivce/app/core/rag/query_expander.py` |
| Case Memory | `petties-agent-serivce/app/core/rag/case_memory.py` |
| RAG Module Init | `petties-agent-serivce/app/core/rag/__init__.py` |

---

*Document created: 2026-04-06*
*Based on actual codebase analysis (v2.0.0 — KG removed)*
