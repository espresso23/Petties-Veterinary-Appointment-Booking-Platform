> Legacy Note (2026-03-25): This document may contain historical references to `prompt_versions`, editable system-prompt versioning, or older AI schema/ERD counts. It is retained for historical or presentation context only. For current database truth and active AI storage architecture, use `docs-references/database/PETTIES_DBML.dbml`, `docs-references/documentation/PETTIES_ERD_DIAGRAM.md`, `docs-references/documentation/DATABASE_SCHEMA_ANALYSIS.md`, `docs-references/documentation/SRS/PETTIES_SRS.md`, and `docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md`.
# **TECHNICAL SCOPE: PETTIES - AGENT MANAGEMENT**

> **Lưu ý cập nhật ngày 2026-03-22:** 
> - **Tool Self-Contained UI Cards (v2.0):** Tools định nghĩa `ui_card` trong return value, chat.py dùng generic dispatcher. Không còn hardcoded extraction logic.
> - Các đoạn về Visual Case Memory, thumbs up/down và AI Diagnose cũ chỉ còn giá trị lịch sử.
> - Kiến trúc hiện hành ưu tiên knowledge base nội bộ, EMR đã xác nhận và Gemini Vision.
> - Xem thêm [AI_SERVICE_TECHNICAL_SPECIFICATION.md](D:/SEP490/petties/docs-references/documentation/AI_SERVICE_TECHNICAL_SPECIFICATION.md).

## **1. Định hướng cốt lõi (Core Philosophy)**

Thay vì xây dựng một công cụ tạo Agent (No-code builder), hệ thống sẽ tập trung vào việc **Quản trị, Tinh chỉnh và Giám sát (Management, Tuning & Monitoring)**.

* **Backend (Code-first):** Cấu trúc luồng đi của Agent (Workflow/Graph) được lập trình viên code sẵn dưới Backend (sử dụng LangGraph/Python).  
* **Frontend (Config-first):** Admin Dashboard chỉ dùng để cấu hình tham số, chọn công cụ và kiểm thử.

## **2. Kiến trúc Agent (Single Agent + ReAct + LangGraph) - QUAN TRỌNG**

> **MVP Architecture:** Single Agent với ReAct pattern, implemented bằng LangGraph.
> 
> **Lý do:** Đơn giản hóa cho MVP 1 tháng, dễ debug, dễ maintain, đủ capability cho use cases hiện tại.

### **A. Single Agent Architecture (ReAct Pattern)**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PETTIES AI AGENT (ReAct + LangGraph)             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🧠 LLM Core (OpenRouter / Cohere)                                  │
│  ├── ReAct Pattern: Thought → Action → Observation → Loop          │
│  ├── Chain-of-Thought Reasoning                                     │
│  └── System Prompt (Admin Configurable)                             │
│                                                                     │
│  🔧 Skills/Tools (FastMCP @mcp.tool)                                │
│  ├── @mcp.tool: pet_knowledge_search  → RAG knowledge retrieval    │
│  ├── @mcp.tool: web_search            → Web fallback search        │
│  ├── @mcp.tool: search_clinics_nearby → Find nearby clinics        │
│  ├── @mcp.tool: check_available_slots → Check available slots      │
│  ├── @mcp.tool: create_booking_for_user → Create booking via chat  │
│  └── (Extensible: Add more tools via @mcp.tool)                    │
│                                                                     │
│  📚 RAG Engine (LlamaIndex + Qdrant)                                │
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
└─────────────────────────────────────────────────────────────────────┘
```

### **B. ReAct Pattern với LangGraph**

LangGraph được sử dụng để implement ReAct loop:

```python
# LangGraph State Graph for ReAct Agent
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    messages: list
    tool_calls: list
    observations: list

graph = StateGraph(AgentState)

# Nodes
graph.add_node("think", think_node)      # LLM reasoning
graph.add_node("act", act_node)          # Execute tool
graph.add_node("observe", observe_node)  # Process result

# Edges (ReAct Loop)
graph.add_edge("think", "act")
graph.add_conditional_edges("act", should_continue, {
    "continue": "observe",
    "end": END
})
graph.add_edge("observe", "think")
```

**ReAct Flow:**
1. **Thought**: Agent suy luận về câu hỏi/yêu cầu của user
2. **Action**: Gọi tool phù hợp (@mcp.tool)
3. **Observation**: Nhận và xử lý kết quả từ tool
4. **Loop**: Lặp lại nếu cần thêm thông tin
5. **Answer**: Tổng hợp và trả lời user

### **B2. Tool Self-Contained UI Cards (v2.0)**

> **Design Principle:** Tool tự định nghĩa UI card trong return value. chat.py dùng generic dispatcher. Không hardcoded extraction logic.

**Mục đích:** Trước đây, `chat.py` chứa logic extraction cứng cho từng tool (if/elif blocks). Nay tools tự define `ui_card` để:
- chat.py generic, không cần biết tool names
- Thêm tool mới không cần sửa chat.py
- UI logic gần data hơn, dễ maintain

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool (MCP)                                │
│  @mcp_server.tool                                            │
│  - name: "search_clinics_nearby"                             │
│  - returns: {clinics: [...], ui_card: {type, data...}}      │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Generic Dispatcher (chat.py)                    │
│                                                              │
│  def extract_ui_card(step):                                 │
│      return step.tool_result.get("ui_card")                  │
│                                                              │
│  # KHÔNG if/elif tool names                                 │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              WebSocket → Client                               │
│  {"type": "clinic_suggestion", "clinics": [...]}           │
└─────────────────────────────────────────────────────────────┘
```

**Tool Implementation Example:**

```python
@mcp_server.tool
async def search_clinics_nearby(...) -> Dict[str, Any]:
    result = await _do_search(...)
    
    return {
        "success": True,
        "clinics": [...],
        "total_found": len(clinics),
        "location": {"lat": lat, "lng": lng},
        
        # Tool self-contains UI spec
        "ui_card": {
            "type": "clinic_suggestion",
            "clinics": clinics[:5],
            "total_found": len(clinics),
            "location": {"lat": lat, "lng": lng, "address": address},
        }
    }
```

**chat.py Generic Dispatcher:**

```python
def extract_ui_card(step: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Generic UI card extractor - reads ui_card from tool's return value."""
    tool_result = step.get("tool_result") or {}
    
    if isinstance(tool_result, dict) and isinstance(tool_result.get("data"), dict):
        tool_result = tool_result.get("data") or {}
    
    ui_card = tool_result.get("ui_card")
    if not ui_card or not isinstance(ui_card, dict):
        return None
    
    ui_type = ui_card.get("type")
    if not ui_type:
        return None
    
    # Return clean payload with type
    return {"type": ui_type, **{k: v for k, v in ui_card.items() if k != "type"}}


# In streaming loop - NO hardcoded tool names:
if step_type == "observation":
    ui_payload = extract_ui_card(safe_step)
    if ui_payload:
        ui_type = ui_payload.get("type")
        if not sent_ui_types.get(ui_type):
            sent_ui_types[ui_type] = True
            await manager.send_message(session_id, {
                **ui_payload,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
```

**Current UI Card Types:**

| UI Card Type | Tool | Purpose |
|--------------|------|---------|
| `clinic_suggestion` | `search_clinics_nearby` | Clinic carousel UI |
| `service_chips` | `get_clinic_services` | Service selection chips |
| `slot_grid` | `check_available_slots` | Time slot picker |
| `booking_summary` | `create_booking_for_user` | Booking preview |
| `booking_created` | `create_booking_for_user` | Success confirmation |
| `pet_list` | `get_user_pets` | Pet list for selection |
| `vaccination_card` | `check_vaccination_status` | Vaccination history |

**Adding a New Tool with UI Card:**

```python
@mcp_server.tool
async def my_new_tool(...) -> Dict[str, Any]:
    result = await do_something(...)
    
    return {
        "data": result,
        "ui_card": {
            "type": "my_new_card",
            "field1": result.value1,
            "field2": result.value2,
        }
    }
```

No changes needed to `chat.py` - UI card is automatically dispatched.

### **C. Khác biệt với kiến trúc legacy (Tham khảo)**

| Aspect | Legacy supervisor architecture | Single Agent + ReAct |
|--------|-----------------|---------------------------|
| **Complexity** | Cao (supervisor, handoffs) | Thấp |
| **Development** | 3-4 tuần | 1-2 tuần |
| **Debugging** | Khó (trace nhiều agents) | Dễ (1 agent) |
| **LangGraph Usage** | Supervisor pattern | ReAct pattern |
| **Capability** | Specialized agents | 1 agent với nhiều tools |
| **Extensibility** | Thêm agent mới | Thêm @mcp.tool mới |

## **3. Các module chức năng chi tiết cho Admin Dashboard**

### **A. Agent Configuration (Single Agent)**

Admin config một Single Agent với các tham số sau:

1. **Agent Status:**
   * Bật/tắt Agent (Enable/Disable)
   * Khi tắt, user sẽ thấy message "Trợ lý AI đang bảo trì"

2. **System Prompt:**
   * Admin điều chỉnh prompt để hướng dẫn Agent cách xử lý
   * Version control: Lưu lịch sử các phiên bản prompt
   * Ví dụ: "Bạn là trợ lý Petties, chuyên về chăm sóc thú cưng..."

3. **Model Hyperparameters:**
   * **Temperature Slider:** 0.0 - 1.0 (mặc định 0.7)
   * **Max Tokens:** Giới hạn độ dài response
   * **Top-P:** Nucleus sampling parameter
   * **Model Selection:** Chọn LLM model từ OpenRouter

### **B. System & Security Configuration**

Module này thay thế việc quản lý cấu hình bằng file .env truyền thống, cho phép Admin thay đổi key ngay trên giao diện mà không cần restart server thủ công.

1. **API Key Management (Quản lý Key):**
   * Giao diện nhập liệu an toàn cho các dịch vụ bên thứ 3.
   * Các key bao gồm: QDRANT_API_KEY, QDRANT_URL, COHERE_API_KEY, v.v.
   * **Cơ chế:** Key được mã hóa và lưu trong Database (PostgreSQL). Khi Backend khởi động hoặc Runtime cần dùng, nó sẽ fetch trực tiếp từ DB thay vì đọc biến môi trường OS.

2. **LLM API Configuration (Cloud-Only):**
   * **Primary Provider:** OpenRouter API (https://openrouter.ai) - Gateway đến nhiều LLM providers.
   * **Model Selection:** Admin chọn model từ danh sách hỗ trợ:
     * `google/gemini-2.0-flash-exp:free` (Free, 1M context)
     * `meta-llama/llama-3.3-70b-instruct` (Cheap, Vietnamese good)
     * `anthropic/claude-3.5-sonnet` (Best quality, higher cost)
   * **Configuration:** API key được lưu encrypted trong PostgreSQL, admin config qua Dashboard.
   * **Fallback:** Nếu primary model fail → tự động switch sang model backup.

### **C. Tool Management (@mcp.tool)**

Module này đảm bảo tính nhất quán giữa Code và Cấu hình cho các Tools.

> **Triết lý Tool Design:** Tất cả Tools được code thủ công bằng Python với decorator `@mcp.tool`. KHÔNG sử dụng Swagger/OpenAPI auto-import vì:
> - API endpoints được thiết kế cho Frontend/Mobile, KHÔNG phải cho LLM consumption
> - Tools cần có mô tả ngữ nghĩa rõ ràng (semantic descriptions) để LLM hiểu khi nào nên dùng
> - Parameters cần được thiết kế natural language friendly

1. **Available Tools (Single Agent):**
   * `pet_knowledge_search` - Tra cứu kiến thức thú y và triệu chứng từ knowledge base
   * `web_search` - Tìm kiếm web khi knowledge base chưa đủ dữ liệu
   * `search_clinics_nearby` - Tìm phòng khám gần đây
   * `check_available_slots` - Kiểm tra slot trống
   * `create_booking_for_user` - Tạo lịch hẹn qua chat

2. **Schema Definition:** Mỗi tool hiển thị rõ Request/Response schema để Admin hiểu.

3. **Governance Dashboard:**
   * **Activation Control:** Admin có thể bật/tắt từng tool riêng lẻ.
   * Agent sẽ chỉ gọi được các tools đang được Enable.


### **D. Knowledge Base Management (RAG)**

Quản lý dữ liệu kiến thức thú y mà Agent sử dụng để trả lời (tránh hallucination).

1. **Data Ingestion:** Upload tài liệu (PDF, Docx) quy trình khám, thông tin thuốc.  
2. **Indexing Status:** Theo dõi trạng thái phân mảnh (chunking) và vector hóa vào **Qdrant Cloud**.  
3. **Testing Retrieval:** Admin nhập thử câu hỏi để xem hệ thống RAG trích xuất đoạn văn bản nào từ tài liệu (để đảm bảo Agent lấy đúng kiến thức).

### **E. Agent Testing & Debugging**

Đây là nơi Admin "duyệt" Agent trước khi cho end-user dùng.

1. **Interactive Chat Simulator:** Khung chat giả lập người dùng thật.  
2. **ReAct Flow Visualization:**  
   * Hiển thị rõ luồng ReAct: **Thought → Action → Observation → Loop**
   * *Log Ví dụ:* User → Agent (Thought: cần tìm thông tin triệu chứng) → Tool: pet_knowledge_search → Observation: kết quả → Answer
3. **Tool Call Inspector:** Xem chi tiết parameters và response của mỗi tool call.
4. **Response Feedback:** Admin đánh giá câu trả lời (Good/Bad).

## **4. Kiến trúc hệ thống (Single Agent Architecture)**

### **Backend (Python/FastAPI + LangGraph)**

* **LangGraph:** Sử dụng **ReAct pattern** với StateGraph. Single Agent với loop: Think → Act → Observe.
* **State Management:** ReActState lưu messages, react_steps, observations, final answer.
* **Dynamic Configuration Loader:** Module thay thế python-dotenv. Khi khởi tạo, module này truy vấn bảng system_configs trong Postgres để lấy API Keys và settings.
* **MCP Integration:** Tools được implement với @mcp.tool decorator.

### **Frontend (React + Tailwind CSS)**

* **Agent Config UI:** Form đơn giản để config System Prompt, Model, Parameters.
* **Playground:** Chat Interface với ReAct Debug Panel.
* **Settings UI:** Form quản lý API Key và System Settings.

### **Database & Storage**

* **PostgreSQL:** Lưu trữ cấu hình Agent, **Encrypted API Keys**, danh sách Tools, Prompt Versions (không lưu message chat AI-user).
* **MongoDB:** Lưu trữ lịch sử hội thoại AI-user (`ai_chat_sessions`, `ai_chat_messages`) và metadata để audit/phân tích.
* **Qdrant Cloud (Managed Service):** Lưu trữ vector cho RAG (documents & knowledge base).


## **5\. User Flow cho Admin (Người quản trị)**

1. **Trường hợp 1: Sửa lỗi Điều phối qua System Prompt**
   * **Vấn đề:** Main Agent điều hướng nhầm câu "Mua thuốc xổ giun" sang Medical Agent (vì nghĩ là chữa bệnh) thay vì Research Agent (vì đây là nhu cầu mua sắm/tìm kiếm).
   * **Hành động:**
     * Admin vào tab "Agent Configuration" → chọn Main Agent.
     * Chỉnh sửa System Prompt, thêm hướng dẫn rõ ràng hơn về routing rules.
     * Bấm **Save**.
   * **Kết quả:** Main Agent sử dụng LLM + Updated Prompt để điều hướng chính xác hơn.
2. **Trường hợp 2: Thêm Tool mới cho Agent**
   * **Actor:** Developer.
   * **Context:** Cần thêm tool `check_vaccine_history` cho Medical Agent.
   * **Process:**
     1. Developer tạo file Python với decorator `@tool` trong `mcp_tools/medical_tools.py`.
     2. Developer code logic gọi Spring Boot API bên trong function.
     3. Admin vào Dashboard → "Tool Management" → "Scan Tools".
     4. Hệ thống quét và hiển thị tool mới.
     5. Admin gán tool cho Medical Agent.
   * **Lưu ý:** Tool được thiết kế với mô tả semantic cho LLM, KHÔNG auto-import từ Swagger.
3. **Trường hợp 3: Thêm kiến thức mới vào Vector Store (RAG Update)**  
   * **Actor:** Admin.  
   * **Context:** Có phác đồ điều trị mới cần cập nhật cho Agent.  
   * **Process:**  
     1. Admin upload file phoc\_do\_2026.pdf lên Dashboard.  
     2. Hệ thống kích hoạt LlamaIndex Pipeline: Doc Parsing → Text Chunking → Embedding (**Cohere embed-multilingual-v3**) → Upsert vào **Qdrant Cloud**.  
     3. Admin vào mục "Retrieval Test", nhập từ khóa. Hệ thống query Qdrant và hiển thị các chunks.

## **6\. Các tính năng nghiệp vụ cốt lõi (Petties Core \- Updated)**

Các tính năng này được thực hiện thông qua các Tools của Single Agent:

1. **Booking Agent:** Đặt lịch khám tại nhà, tại phòng khám.  
2. **Medical Agent (Trọng tâm Y tế):**  
   * **Nhiệm vụ:** Chẩn đoán sơ bộ dựa trên triệu chứng.  
   * **Cơ chế Fallback (Quan trọng):**  
     * Ưu tiên sử dụng kiến thức nội bộ (Internal RAG) để đảm bảo độ chính xác theo protocol của phòng khám.  
     * **Auto-escalation:** Nếu model cảm thấy không chắc chắn (Low Confidence) hoặc không tìm thấy thông tin trong DB \-\> Tự động gọi **Research Agent** để tìm kiếm trên Web.  
     * **Enrichment:** Sau khi chẩn đoán ra bệnh, có thể gọi Research Agent để tìm kiếm: "Video hướng dẫn uống thuốc", "Mẹo chăm sóc tại nhà".  
3. **Research Agent (Web & Content):**  
   * **Nhiệm vụ:** Là chuyên gia tìm kiếm thông tin bên ngoài, bổ sung cho các Agent nội bộ.  
   * **Web Search Strategy:** Sử dụng Search Engine (Google/Tavily) để tìm kiếm realtime.  
   * **Các trường hợp sử dụng (Use Cases):**  
     * **Tìm sản phẩm:** Tìm nơi bán, so sánh giá, review sản phẩm từ các sàn TMĐT/website uy tín.  
     * **Giải pháp Y tế mở rộng:** Tìm kiếm các bài viết y khoa mới nhất, các biện pháp sơ cứu dân gian hoặc home remedies khi Medical Agent yêu cầu.  
     * **Mẹo vặt (Tips & Tricks):** Cách huấn luyện chó mèo, mẹo dọn vệ sinh, kinh nghiệm chăm sóc.  
   * **Video Integration:** Tự động tìm kiếm video liên quan trên YouTube và nhúng link video vào câu trả lời.  
   * **Attribution Requirement (Bắt buộc):** Mọi thông tin đưa ra đều phải kèm theo Link gốc.

## **7\. Citation & Attribution Protocol (Quy định Trích dẫn Nguồn)**

Để đảm bảo độ tin cậy và minh bạch, Agent (đặc biệt là **Research Agent**) bắt buộc phải tuân thủ quy chuẩn trích dẫn nghiêm ngặt cho mọi thông tin trả về từ Internet:

1. **Explicit Sources (Nguồn rõ ràng):** Mọi thông tin (văn bản, ảnh, video) đều phải có nguồn gốc cụ thể để người dùng có thể tự kiểm chứng.  
2. **Direct URLs Requirement (Bắt buộc link trực tiếp):**  
   * **Sản phẩm/Bài viết:** Phải cung cấp URL trực tiếp đến trang sản phẩm hoặc bài báo tham khảo.  
   * **Hình ảnh:** Cung cấp URL gốc của hình ảnh hoặc trang chứa hình ảnh đó.  
   * **Video:** Cung cấp URL trực tiếp (ví dụ: link YouTube) cho các video hướng dẫn hoặc review.  
3. **Format (Định dạng hiển thị):** Câu trả lời của Agent phải tách bạch rõ ràng, ví dụ: **Giải pháp tìm được:**  
   Bạn có thể cho chó uống nước đường loãng để cấp cứu hạ đường huyết...**Nguồn tham khảo & Mua sắm:**  
   * [Bài viết: Sơ cứu chó bị tụt đường huyết \- PetMart](https://example.com)  
   * \[liên kết đáng ngờ đã bị xóa\]

   **Video hướng dẫn:**

   * \[liên kết đáng ngờ đã bị xóa\]

## **8\. Tech Stack & Infrastructure Specifications**

Danh sách chi tiết các công nghệ được sử dụng để xây dựng hệ thống quản lý và vận hành Agent.

### **A. Backend (Core Engine)**

* **Language:** Python 3.12 (Phiên bản ổn định, tối ưu cho AI/Data).  
* **Framework:** FastAPI (High-performance API framework).  
* **Agent Orchestration:** LangGraph (Single Agent với ReAct Pattern)
  * **Pattern:** ReAct (Reason + Act) - Thought → Action → Observation → Loop
  * **State Management:** StateGraph với AgentState lưu messages, tool_calls, observations
  * **Kiến trúc hiện tại:** MVP sử dụng Single Agent với nhiều tools thay vì supervisor-worker flow
* **Data Framework:** LlamaIndex (Framework chính cho RAG Pipeline).  
* **Tool Framework:** FastMCP (Embedded Mode)
  * **Cơ chế:** FastMCP được nhúng trực tiếp vào AI Service (FastAPI) như một thư viện.
  * **Architecture:** In-process Execution. Agent gọi trực tiếp hàm Python thông qua ReAct loop.
  * **Deployment:** KHÔNG cần deploy MCP Server riêng biệt.
  * **Code-based Tools với @mcp.tool():**
    ```python
    from fastmcp import FastMCP
    
    mcp = FastMCP("PettiesToolServer")
    
    @mcp.tool()
    def pet_knowledge_search(query: str) -> dict:
        """Tra cứu kiến thức thú y và triệu chứng từ knowledge base."""
        # Implementation: Gọi RAG engine để lấy raw results
        return "..."
    
    @mcp.tool()
    def web_search(query: str) -> dict:
        """Tìm thêm nguồn web khi knowledge base chưa đủ dữ liệu."""
        # Implementation: DuckDuckGo search + filter pet/vet scope
        return "..."
    
    @mcp.tool()
    def search_clinics_nearby(latitude: float, longitude: float) -> dict:
        """Tìm phòng khám gần vị trí người dùng."""
        # Implementation: Gọi Spring Boot API
        return "..."
    
    @mcp.tool()
    def check_available_slots(clinic_id: str, date: str, service_ids: list[str]) -> dict:
        """Kiểm tra slot trống theo dịch vụ."""
        # Implementation: Gọi Spring Boot API
        return "..."
    
    @mcp.tool()
    def create_booking_for_user(pet_id: str, clinic_id: str, booking_date: str, start_time: str, service_ids: list[str]) -> dict:
        """Tạo lịch hẹn thú y cho thú cưng sau khi người dùng xác nhận."""
        # Implementation: Gọi Spring Boot API để tạo booking
        return {"success": True}
    ```
  * **Lưu ý:** 
    - Docstring sẽ được FastMCP dùng để sinh schema cho tool
    - Type hints giúp LLM biết kiểu dữ liệu cần truyền
    - Tất cả Tools được code thủ công với semantic descriptions cho LLM



### **B. Frontend (Admin Dashboard)**

* **Framework:** React \+ Vite (Build tool cực nhanh).  
* **Styling & Theming:**  
  * **Framework:** Tailwind CSS.  
  * **Color Palette:** "Warm Neutrals" (Stone/Amber).  
    * *Lý do:* Tạo cảm giác tin cậy, ấm áp (phù hợp với lĩnh vực thú y) nhưng vẫn giữ được sự chuyên nghiệp, sạch sẽ của một công cụ quản trị.  
    * *Mã màu:* Backgrounds (bg-stone-50), Text (text-stone-900), Accents (text-amber-600, border-amber-500).  
* **State Management:** Zustand (Quản lý trạng thái ứng dụng nhẹ và linh hoạt).  
* **UI Components:** Ant Design hoặc Material UI (MUI).  
* **Interactive Architecture Visualization (Glass Box):**  
  * **Công nghệ:** React Flow hoặc HTML/CSS Interactive Diagram.  
  * **Tính năng:**  
    * **Interactive Nodes:** Người dùng có thể bấm vào từng Node (User, Main Agent, Sub-Agents) để xem chi tiết nhiệm vụ (Responsibilities) và công cụ (Tools) của Agent đó ngay trên sơ đồ.  
    * **Flow Highlighting:** Hiển thị trực quan luồng đi của dữ liệu. Đặc biệt làm nổi bật logic **"Semi-Autonomous"**: Main Agent \-\> Medical Agent \-\> (Low Conf) \-\> Research Agent.  
* **Interaction:** React Beautiful DnD hoặc Dnd-kit (Dùng cho việc sắp xếp danh sách Tools, thứ tự ưu tiên, hoặc quản lý danh sách Agent \- List management).

### **C. AI & Intelligence Layer (Brain & Memory) - Cloud-Only Architecture**

* **LLM Provider (Cloud API Only):** **OpenRouter**
  * Hệ thống sử dụng **Cloud API** để gọi LLM, **KHÔNG** cần GPU/RAM local.
  * **Primary Provider:** OpenRouter (https://openrouter.ai) - Gateway đến nhiều LLM providers.
  * **Model Options:**
    * `google/gemini-2.0-flash-exp:free` - Free tier, 1M context, tốt cho prototype
    * `meta-llama/llama-3.3-70b-instruct` - $0.1/1M tokens, Vietnamese tốt
    * `anthropic/claude-3.5-sonnet` - $3/1M tokens, best quality
  * **Fallback Strategy:** Nếu primary model fail → auto-switch sang backup model.
  * **Configuration:** API key lưu encrypted trong PostgreSQL, admin config qua Dashboard.

* **Vector Database:** **Qdrant Cloud** (Managed SaaS)
  * Free tier: 1GB storage, 1M vectors
  * Kết nối qua HTTPS Endpoint + API Key
  * **Search Optimization:** Binary Quantization enabled
    * Nén vector 32x (float32 → bit)
    * Tốc độ search nhanh 20-30x
    * Độ chính xác vẫn > 95%

* **Embeddings (Cloud API):** **Cohere embed-multilingual-v3**
  * **Provider:** Cohere API (https://cohere.com)
  * **Free Tier:** 1,000 calls/month (đủ cho development)
  * **Paid:** $0.1/1M tokens (rẻ nhất thị trường)
  * **Multilingual:** Top-tier cho tiếng Việt, Anh, Hàn, Nhật
  * **Dimension:** 1024 (cân bằng quality/storage)
  * **Lợi ích so với nomic-embed-text:**
    * Không cần local LLM server
    * Chất lượng Vietnamese tốt hơn
    * Cloud-native, zero infrastructure

* **Web Search:** Tavily Search API
  * Free tier: 1,000 searches/month
  * Optimized cho AI agents (tra ve structured data)

* **Domain Knowledge & Intelligence:**

  * **RAG Knowledge Base:**
    * Vector-indexed veterinary documents via Qdrant Cloud + Cohere embeddings
    * Sentence-level chunking for accurate retrieval
    * Example: "Dry cough + runny nose" → RAG retrieves relevant veterinary guidance → "Antibiotics + keep warm"

  * **Case Memory từ EMR xác nhận:**
    * Vision LLM describes the image, then embeds the **textual description** actually used by retrieval together with metadata (species, canonical disease mapping, quality gate, image_url, etc.)
    * On similar future images, retrieves confirmed cases to increase accuracy and provide explanations such as "based on a previous case confirmed by Staff/Vet"
    * Quality-gated retrieval: ranking is boosted by `quality_gate.score` and by support metrics aggregated from multiple confirmed EMRs of the same disease/species
    * **Phase 2 (Done):** Add a layer of **CLIP-style image embeddings** in `petties_case_memory_v2` for confirmed EMR cases with named vectors (`text` + `image`). Implemented with Jina CLIP v2 (1024 dim) for image vectors and Cohere for text vectors.

  * **Query Expansion:**
    * LLM automatically expands short queries ("dog not eating" → synonyms, clinical terms, related symptoms)
    * Increases recall for RAG search

  * **Feedback Loop:**
* Chat feedback chỉ dùng cho audit trải nghiệm; case memory cho doctor flow ưu tiên EMR đã xác nhận
    * Prompt optimization based on patterns found in feedback data
    * Periodic prune: remove low-value cases, prioritize verified ones

  * **Details:** See `AI_AGENT_DATA_IMPROVEMENT_STRATEGY.md` Sections 7–11

### **D. Infrastructure & Real-time (AWS EC2 Production)**

* **Relational Database:** PostgreSQL (Neon/Supabase managed service)
* **AI Runtime:** Cloud APIs only (OpenRouter + Cohere + Qdrant Cloud)
  * **KHÔNG cần GPU/RAM local**
  * Deploy lên AWS EC2 với Docker
  * CI/CD tự động qua GitHub Actions
* **Real-time:** WebSocket (Streaming response lên Frontend)
* **Caching Layer:** Redis Cloud (Upstash)
* **Containerization:** Docker + Docker Compose
* **Reverse Proxy:** Nginx với SSL (Let's Encrypt)
* **Deployment:**
  * **Backend API:** `https://api.petties.world` (Port 8080)
  * **AI Service:** `https://ai.petties.world` (Port 8000)
  * **Frontend:** Vercel at `https://petties.world`

## **9. Detailed Feature List (Danh sách Tính năng Chi tiết)**

Các tính năng được phân nhóm theo chức năng và mức độ ưu tiên (Critical là bắt buộc phải có cho MVP).

### **System & Security (Hệ thống & Bảo mật)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **SYS-01** | **Dynamic Secrets Management** | Giao diện Frontend cho phép nhập/sửa/xóa API Keys (Qdrant, Cohere, OpenRouter...). Backend mã hóa và lưu vào DB. Agent runtime tự động load lại key khi có thay đổi mà không cần deploy lại. | **✅ Done** |
| **SYS-02** | **LLM Model Selection** | Chọn LLM model từ OpenRouter (gemini-2.0-flash, llama-3.3-70b, claude-3.5-sonnet). Config fallback model. | **✅ Done** |

### **Agent Configuration (Single Agent + ReAct)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **AG-01** | **Agent Enable/Disable** | Bật/tắt Agent. Khi tắt, user thấy message "Trợ lý AI đang bảo trì". | **✅ Done** |
| **AG-02** | **System Prompt Editor** | Giao diện chỉnh sửa System Prompt cho Single Agent. Dữ liệu được versioning và lưu trong PostgreSQL. | **✅ Done** |
| **AG-03** | **Model Parameter Tuning** | Cấu hình tham số: Temperature, Max Tokens, Top-P, Model selection. | **✅ Done** |

### **Tools Management (@mcp.tool)**

> **Current runtime note:** Trong code hiện tại, runtime tools đang được sync và sử dụng thực tế gồm `pet_knowledge_search`, `web_search`, `get_user_pets`, `get_clinic_services`, `check_vaccination_status`, `search_clinics_nearby`, `check_available_slots`, `create_booking_for_user`. Nếu tài liệu khác nhắc tới capability ngoài danh sách này thì xem là planned scope.

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **TL-01** | **Tool List View** | Hiển thị danh sách tools đã được code (@mcp.tool): pet_knowledge_search, web_search, search_clinics_nearby, check_available_slots, create_booking_for_user. | **✅ Done** |
| **TL-02** | **Tool Enable/Disable** | Bật/tắt từng tool riêng lẻ. Agent chỉ gọi được tools đang Enable. | **✅ Done** |
| **TL-03** | **Schema Viewer** | Xem Request/Response schema của mỗi tool để Admin hiểu tool làm gì. | **✅ Done** |

### **Knowledge Base & RAG (Kiến thức)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **KB-01** | **Document Upload** | Upload tài liệu (PDF, DOCX, TXT, MD) cho RAG. LlamaIndex xử lý chunking. | **✅ Done** |
| **KB-02** | **Indexing Status** | Theo dõi trạng thái indexing: parsing → chunking → embedding → Qdrant. | **✅ Done** |
| **KB-03** | **RAG Retrieval Test** | Admin nhập query test để xem RAG trả về chunks nào từ knowledge base. | **✅ Done** |
| **KB-04** | **Query Expansion** | LLM tu dong mo rong query ngan gon truoc khi RAG search. Tang recall cho cau hoi ngan cua Staff. | **✅ Done** |
| **KB-06** | **Case Memory từ EMR xác nhận** | Tái sử dụng EMR đã xác nhận làm nguồn case memory nội bộ để truy xuất ca tương tự. | **🔄 Redesigned** |
| **KB-07** | ~~**KB Image Embeddings**~~ | ~~Extract images from PDF documents and index with Jina CLIP v2. Support hybrid search (text + image similarity) via `/query-hybrid` endpoint.~~ | **❌ Removed (2026-04-03)** - Unused feature, no production usage |
| **KB-08** | **Feedback & dữ liệu học** | Chat feedback chỉ dùng cho audit/chất lượng UX; nguồn học chính của chẩn đoán là EMR xác nhận. | **🔄 Redesigned** |

### **Agent Testing & Debugging**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **PG-01** | **Interactive Chat Simulator** | Giao diện Chat kết nối qua WebSocket / REST. Hiển thị Streaming Response từ FastAPI backend. | **✅ Done** |
| **PG-02** | **ReAct Flow Visualization** | Hiển thị luồng ReAct: Thought → Action → Observation → Loop → Answer. | **✅ Done** |
| **PG-03** | **Tool Call Inspector** | Xem chi tiết parameters và response của mỗi tool call. | **✅ Done** |
| **PG-04** | **Citation View** | Hiển thị nguồn trích dẫn từ RAG (filename, chunks). | **🔄 In Progress** |
| **PG-05** | **Response Feedback** | User/Admin danh gia cau tra loi (Good/Bad) de improve prompt. Luu vao MongoDB `chat_feedback`. | **✅ Done** |


## **10\. Use Case Descriptions (Mô tả Kịch bản Sử dụng)**

Mô tả các tình huống thực tế gắn liền với công nghệ sử dụng.

### **UC-01: Tinh chỉnh System Prompt của Agent**

* **Actor:** Admin Hệ thống.  
* **Context:** Single Agent đang trả lời không đúng tone hoặc thiếu context.  
* **Process:**  
  1. Admin truy cập Dashboard → "Agent Configuration".  
  2. Admin chỉnh sửa System Prompt trong Editor: "Thêm quy tắc: Khi user hỏi về bệnh, hãy luôn hỏi thêm về tuổi và cân nặng của pet".  
  3. Admin nhấn Save → Backend cập nhật prompt vào PostgreSQL.  
  4. Tại Playground, Admin chat thử. Thấy Agent đã hỏi thêm thông tin như expected.

### **UC-02: Thêm Tool mới cho Agent (Code-based)**

* **Actor:** Developer + Admin.
* **Context:** Cần thêm tool `check_vaccine_history` để Agent tra cứu lịch sử tiêm chủng.
* **Process:**
  1. Developer tạo function trong `app/core/tools/medical_tools.py`:
     ```python
     from fastmcp import FastMCP
     
     mcp = FastMCP("PettiesToolServer")
     
     @mcp.tool()
     def check_vaccine_history(pet_name: str) -> str:
         """
         Tra cứu lịch sử tiêm chủng của thú cưng.
         Sử dụng khi user hỏi về vaccine, tiêm phòng, hoặc lịch sử tiêm.
         """
         # Gọi Spring Boot API
         response = requests.get(f"{BACKEND_URL}/api/v1/vaccines/by-pet/{pet_name}")
         return format_vaccine_history(response.json())
     ```
  2. Admin vào Dashboard → "Tool Management".
  3. Hệ thống tự động hiển thị tool mới `check_vaccine_history`.
  4. Admin bật Enable cho tool.
* **Lưu ý:** 
  - Docstring sẽ được FastMCP dùng để sinh schema cho tool
  - Type hints giúp LLM biết kiểu dữ liệu cần truyền


### **UC-03: Thêm kiến thức mới vào Vector Store (RAG Update)**

* **Actor:** Admin.  
* **Context:** Có phác đồ điều trị mới cần cập nhật cho Agent.  
* **Process:**  
  1. Admin upload file `phac_do_2026.pdf` lên Dashboard → "Knowledge Base".  
  2. Hệ thống kích hoạt LlamaIndex Pipeline: 
     - Doc Parsing → Text Chunking → Embedding (**Cohere embed-multilingual-v3**) → Upsert vào **Qdrant Cloud**.  
  3. Admin vào mục "RAG Retrieval Test", nhập query test.
  4. Hệ thống query Qdrant và hiển thị các chunks relevant.
  5. Admin verify Agent có thể trả lời câu hỏi dựa trên tài liệu mới.

### **UC-04: Cấu hình Hệ thống Cloud APIs (Dynamic System Config)**

* **Actor:** Admin (DevOps hoặc Lead Dev).
* **Context:** Hệ thống đã deploy lên AWS EC2 với Docker. Cần cấu hình Cloud APIs qua Dashboard thay vì SSH sửa file .env.
* **Process:**
  1. Admin truy cập Dashboard → **"System Settings"**.
  2. Tại tab **"API Keys"**, Admin nhập:
     * **OpenRouter API Key** (LLM provider)
     * **Cohere API Key** (Embeddings)
     * **Qdrant Cloud URL + API Key** (Vector DB)
  3. Tại tab **"Agent Configuration"**:
     * Chọn Primary LLM model (e.g., `google/gemini-2.0-flash-exp:free`)
     * Chọn Fallback model (e.g., `meta-llama/llama-3.3-70b-instruct`)
     * Set temperature, max_tokens cho Agent
  4. Admin nhấn **"Test Connections"** để verify tất cả APIs hoạt động.
  5. Admin nhấn **"Save"**.
  6. Backend cập nhật DB (mã hóa API keys), hot-reload config ngay lập tức.
* **Lợi ích:**
  * Cloud-native AI stack (không cần GPU local)
  * Deploy production-ready trên AWS EC2
  * CI/CD tự động qua GitHub Actions
  * Thay đổi config không cần restart server
