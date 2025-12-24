# **TECHNICAL SCOPE: PETTIES \- AGENT MANAGEMENT**

## **1\. Định hướng cốt lõi (Core Philosophy)**

Thay vì xây dựng một công cụ tạo Agent (No-code builder), hệ thống sẽ tập trung vào việc **Quản trị, Tinh chỉnh và Giám sát (Management, Tuning & Monitoring)**.

* **Backend (Code-first):** Cấu trúc luồng đi của Agent (Workflow/Graph) được lập trình viên code sẵn dưới Backend (sử dụng LangGraph/Python).  
* **Frontend (Config-first):** Admin Dashboard chỉ dùng để cấu hình tham số, chọn công cụ và kiểm thử.

## **2\. Kiến trúc Agent Phân tầng (Hierarchical Agent Architecture) \- QUAN TRỌNG**

Hệ thống bắt buộc tuân theo mô hình **Supervisor-Worker (Chỉ huy \- Nhân viên)** kết hợp với **Delegation (Ủy quyền)** để xử lý các tác vụ phức tạp.

### **A. Main Agent (The Supervisor / Orchestrator)**

* **Vai trò:**  
  * **Single Point of Contact (Điểm tiếp nhận duy nhất):** Mọi tương tác của người dùng đều bắt đầu và kết thúc tại đây.  
  * **State Manager (Quản lý trạng thái):** Nắm giữ toàn bộ lịch sử cuộc hội thoại (Context) để đảm bảo các Sub-Agent không bị "mất trí nhớ" giữa chừng.  
  * **Quality Controller (Kiểm soát chất lượng):** Đánh giá câu trả lời của Sub-Agent trước khi gửi cho user (đảm bảo đúng tone giọng, đủ thông tin).  
* **Nhiệm vụ chi tiết:**  
  1. **Intent Classification (Phân loại ý định):**  
     * **Cơ chế Hybrid:** Kết hợp Semantic Router (Ví dụ mẫu từ Qdrant) và LLM Structured Output.  
     * **Mục tiêu:** Phân định rõ ràng nhu cầu user (Tư vấn bệnh? Đặt lịch? Mua sắm? Hay chỉ tán gẫu?).  
  2. **Context-Aware Routing (Điều phối theo ngữ cảnh):**  
     * Chuyển yêu cầu đến đúng Sub-Agent.  
     * *Quan trọng:* Kèm theo tóm tắt ngữ cảnh cũ. Ví dụ: Nếu trước đó user nói "Con chó nhà tôi 5 tuổi", khi route sang Medical Agent, Main Agent phải gửi kèm thông tin "Subject: Dog, Age: 5".  
  3. **Synthesis & Smoothing (Tổng hợp & Làm mượt):**  
     * Nhận kết quả thô (Raw Data/JSON) từ Sub-Agent.  
     * Viết lại (Rewrite) thành câu trả lời tự nhiên, đồng cảm, đúng văn phong thương hiệu (Brand Voice).  
* **Quyền hạn:** Điều phối toàn quyền. Có thể từ chối câu trả lời của Sub-Agent và yêu cầu làm lại nếu thấy chưa đạt (Reflection).

### **B. Sub-Agents (The Specialized Workers)**

Các Agent chuyên biệt, hoạt động độc lập dưới sự chỉ đạo của Main Agent:

1. **Booking Agent:** Chuyên xử lý đặt lịch, kiểm tra slot trống, hủy lịch. (Có quyền gọi Tool: check\_slot, create\_booking).  
2. **Medical/Triage Agent (Semi-Autonomous):**  
   * **Vai trò:** Chuyên gia chẩn đoán và tư vấn y tế.  
   * **Luồng xử lý nâng cao (Advanced Flow):**  
     * Bước 1: Tra cứu kiến thức nội bộ (Internal RAG).  
     * Bước 2: **Confidence Check (Kiểm tra độ tin cậy):**  
       * Nếu độ tự tin \> 80%: Trả lời luôn.  
       * Nếu độ tự tin \< 80% (Bệnh lạ, thông tin thiếu): **Tự động gọi Research Agent** (Tool call) để tìm kiếm thêm thông tin y khoa uy tín trên mạng.  
     * Bước 3: **Solution Expansion (Mở rộng giải pháp):** Sau khi chẩn đoán xong, có thể gọi Research Agent để tìm kiếm các mẹo chăm sóc hoặc video hướng dẫn cụ thể.  
3. **Research Agent (Web & Content):**  
   * **Vai trò:** Chuyên gia tìm kiếm thông tin Internet (Web Researcher).  
   * **Phục vụ:**  
     * Phục vụ Main Agent (khi user hỏi mua sắm, tin tức chung).  
     * Phục vụ Medical Agent (khi cần tra cứu bệnh lạ, tìm video hướng dẫn).  
   * **Nguyên tắc:** Bắt buộc trích dẫn nguồn (URL) cho mọi thông tin tìm được.

## **3\. Các module chức năng chi tiết cho Admin Dashboard**

### **A. Agent Configuration (Quản lý Cấu hình Agent)**

Admin sẽ thấy danh sách phân cấp: Main Agent ở trên cùng, và các Sub-Agents bên dưới.

1. **Supervisor Routing Config (Cấu hình Điều phối & Câu mẫu):**  
   * **System Prompt:** Admin điều chỉnh lời dẫn để dạy Main Agent cách tư duy.  
   * **Dynamic Few-Shot Routing (Cấu hình Routing dựa trên Ví dụ \- RAG Approach):**  
     * **Triết lý:** Không sử dụng training model. Sử dụng kỹ thuật **In-Context Learning** kết hợp RAG. Hệ thống sẽ tìm các tình huống tương tự trong quá khứ để "mớm" (prompt) cho Supervisor ngay tại thời điểm xử lý.  
     * **Cơ chế hoạt động:**  
       * Admin duy trì một danh sách các **"Cặp mẫu" (Routing Pairs):** User Query \-\> Target Agent.  
       * Ví dụ:  
         * "Con này bị sao vậy?" \-\> Medical Agent  
         * "Có bán hạt Royal Canin không?" \-\> Research Agent  
       * **Hỗ trợ Đa ngôn ngữ (Multilingual Support \- MỚI):**  
         * Hệ thống sử dụng Cross-lingual Embeddings. Nếu User hỏi tiếng Anh "My cat is vomiting", hệ thống vẫn tự động khớp với ví dụ tiếng Việt "Mèo bị nôn" và điều hướng đúng.  
         * Tuy nhiên, Admin **có thể (không bắt buộc)** nhập thêm ví dụ tiếng Hàn/Nhật nếu muốn tăng độ chính xác đặc thù cho các thị trường này.  
     * **Lợi ích:**  
       * **Zero Training:** Cập nhật có hiệu lực ngay lập tức.  
       * **Global Scale:** Chỉ cần bộ ví dụ cốt lõi (Core Examples), hệ thống tự hiểu đa ngôn ngữ.  
2. **Worker Instruction Config (Cấu hình Chuyên môn):**  
   * Dành cho Sub-Agents: Admin chỉnh sửa System Prompt chuyên sâu cho từng nghiệp vụ.  
   * *Ví dụ (Medical Agent):* "Bạn là bác sĩ thú y ảo. Hãy hỏi kỹ về cân nặng, tuổi trước khi đưa ra lời khuyên. Nếu không tìm thấy bệnh trong cơ sở dữ liệu, hãy sử dụng công cụ call\_research\_agent để tìm kiếm trên web."  
3. **Model Hyperparameters:**  
   * **Temperature Slider:** Main Agent nên để thấp (0.0 \- 0.2) để điều phối chính xác. Medical Agent nên để trung bình (0.5) để tư vấn tự nhiên.

### **B. System & Security Configuration (MỚI \- Cấu hình Hệ thống & Bảo mật)**

Module này thay thế việc quản lý cấu hình bằng file .env truyền thống, cho phép Admin thay đổi key ngay trên giao diện mà không cần restart server thủ công.

1.  **API Key Management (Quản lý Key):**
    *   Giao diện nhập liệu an toàn cho các dịch vụ bên thứ 3\.
    *   Các key bao gồm: QDRANT\_API\_KEY, QDRANT\_URL, TAVILY\_API\_KEY (hoặc Search API khác), v.v.
    *   **Cơ chế:** Key được mã hóa và lưu trong Database (PostgreSQL). Khi Backend khởi động hoặc Runtime cần dùng, nó sẽ fetch trực tiếp từ DB thay vì đọc biến môi trường OS.
2.  **LLM API Configuration (Cloud-Only):**
    *   **Primary Provider:** OpenRouter API (https://openrouter.ai) - Gateway đến nhiều LLM providers.
    *   **Model Selection:** Admin chọn model từ danh sách hỗ trợ:
        *   `google/gemini-2.0-flash-exp:free` (Free, 1M context)
        *   `meta-llama/llama-3.3-70b-instruct` (Cheap, Vietnamese good)
        *   `anthropic/claude-3.5-sonnet` (Best quality, higher cost)
    *   **Configuration:** API key được lưu encrypted trong PostgreSQL, admin config qua Dashboard.
    *   **Fallback:** Nếu primary model fail → tự động switch sang model backup.

### **C. Tool Management (Quản lý Công cụ - Code-based Only)**

Module này đảm bảo tính nhất quán giữa Code và Cấu hình cho các Tools được code thủ công.

> **Triết lý Tool Design:** Tất cả Tools được code thủ công bằng Python với decorator `@tool` hoặc `@mcp.tool`. KHÔNG sử dụng Swagger/OpenAPI auto-import vì:
> - API endpoints được thiết kế cho Frontend/Mobile, KHÔNG phải cho LLM consumption
> - Tools cần có mô tả ngữ nghĩa rõ ràng (semantic descriptions) để LLM hiểu khi nào nên dùng
> - Parameters cần được thiết kế natural language friendly (VD: `date="hôm nay"` thay vì `date="2024-01-15"`)

1. **Code-based Tools (Python Functions):**
   * Là các hàm Python thuần túy được viết thủ công cho LLM consumption.
   * Được quét tự động từ mã nguồn Python (Tool Scanner).
   * Mỗi tool có mô tả semantic rõ ràng để LLM biết khi nào nên gọi.
2. **Schema Definition (Định nghĩa Cấu trúc Dữ liệu):** Mỗi tool bắt buộc phải hiển thị rõ 2 loại schema JSON để Agent hiểu:  
   * **Request Schema (Input):**  
     * Định nghĩa: Agent cần gửi tham số gì? Kiểu dữ liệu là gì? (String, Int, Enum).  
     * Mục đích: Giúp hệ thống validate dữ liệu Agent sinh ra trước khi thực thi thực tế.  
     * *Ví dụ:* {"pet\_type": "string", "symptoms": \["string"\]}  
   * **Response Schema (Output):**  
     * Định nghĩa: Tool sẽ trả về dữ liệu dạng gì?  
     * Mục đích: Giúp Agent biết trường nào chứa thông tin quan trọng để trích xuất trả lời user.  
     * *Ví dụ:* {"status": "success", "clinics": \[{ "name": "ABC", "distance": "2km" }\]}  
3. **Governance Dashboard (Giao diện Quản trị):**  
   * **Activation Control:** Admin có thể bật/tắt (Enable/Disable) một tool cụ thể cho từng Agent.  
   * *Lưu ý:* Thường chỉ gán Tool cho Sub-Agent, Main Agent ít khi dùng Tool trực tiếp trừ khi là Tool tra cứu thông tin chung.

### **D. Knowledge Base Management (RAG)**

Quản lý dữ liệu kiến thức thú y mà Agent sử dụng để trả lời (tránh hallucination).

1. **Data Ingestion:** Upload tài liệu (PDF, Docx) quy trình khám, thông tin thuốc.  
2. **Indexing Status:** Theo dõi trạng thái phân mảnh (chunking) và vector hóa vào **Qdrant Cloud**.  
3. **Testing Retrieval:** Admin nhập thử câu hỏi để xem hệ thống RAG trích xuất đoạn văn bản nào từ tài liệu (để đảm bảo Agent lấy đúng kiến thức).

### **E. Agent Playground & Debugging (Quan trọng nhất)**

Đây là nơi Admin "duyệt" Agent trước khi cho end-user dùng.

1. **Interactive Chat Simulator:** Khung chat giả lập người dùng thật.  
2. **Hierarchical Visualization (Glass Box):**  
   * Hiển thị rõ Luồng chuyển giao (Handoff) và **Luồng gọi nhau giữa các Sub-Agents**.  
   * *Log Ví dụ:* User \-\> Main Agent \-\> Medical Agent (Internal RAG: Low Conf) \-\> **Calling Research Agent** \-\> Medical Agent \-\> Main Agent.  
3. **Response Feedback:** Admin đánh giá câu trả lời (Good/Bad).

## **4\. Kiến trúc hệ thống (Updated Architecture)**

### **Backend (Python/FastAPI \+ LangGraph)**

* **LangGraph:** Sử dụng pattern Supervisor của LangGraph. State của cuộc hội thoại sẽ được truyền giữa các Node (Agents). Main Agent là Node điều hướng.  
* **Nested Graph Execution:** Hỗ trợ Medical Agent gọi Research Agent như một Node con hoặc Tool để thực hiện tác vụ phụ (Sub-tasking).  
* **Dynamic Configuration Loader:** Module thay thế python-dotenv. Khi khởi tạo, module này truy vấn bảng system\_configs trong Postgres để lấy API Keys và settings, sau đó inject vào Runtime Context của Agent.  
* **Dynamic Tool Loading:** Hệ thống có service "Tool Scanner" để quét và update Code-based Tools từ mã nguồn Python.  
* **MCP Integration:** Các module xử lý logic nghiệp vụ tuân thủ chuẩn MCP.

### **Frontend (React \+ Ant Design/MUI)**

* **Agent Manager UI:** Cây thư mục hiển thị Main Agent và các nhánh Sub-Agent.  
* **Playground:** Chat Interface với Debug Panel hiển thị routing path.  
* **Settings UI:** Form quản lý API Key và System Settings được bảo vệ (yêu cầu quyền Admin cao nhất).

### **Database & Storage**

* **PostgreSQL:** Lưu trữ cấu hình Agent, **Encrypted API Keys**, danh sách Tools, Prompt Versions, Logs chat. **Bảng routing\_examples lưu trữ các cặp (query, target\_agent).**  
* **Qdrant Cloud (Managed Service):** Lưu trữ vector của các routing\_examples để thực hiện Few-Shot Retrieval.

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
     2. Hệ thống kích hoạt LlamaIndex Pipeline: Doc Parsing \-\> Text Chunking \-\> Embedding (**Ollama/Nomic**) \-\> Upsert vào **Qdrant Cloud**.  
     3. Admin vào mục "Retrieval Test", nhập từ khóa. Hệ thống query Qdrant và hiển thị các chunks.

## **6\. Các tính năng nghiệp vụ cốt lõi (Petties Core \- Updated)**

Các tính năng này được thực hiện bởi các Sub-Agent chuyên trách:

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
* **Agent Orchestration:** LangGraph (Xây dựng luồng xử lý Agent có trạng thái \- Stateful Multi-Agent Orchestrator).  
* **Data Framework:** LlamaIndex (Framework chính cho RAG Pipeline và Web Scraping/Indexing dữ liệu phi cấu trúc).  
* **Tool Framework:** FastMCP (Embedded Mode)
  * **Cơ chế:** FastMCP được nhúng trực tiếp vào AI Service (FastAPI) như một thư viện.
  * **Architecture:** In-process Execution. Agent gọi trực tiếp hàm Python thông qua `call_mcp_tool`.
  * **Deployment:** KHÔNG cần deploy MCP Server riêng biệt. `AI Agent Service` bao gồm cả Agent Logic và Tool Runtime.
  * **Code-based Tools:** Viết trực tiếp bằng Python (@mcp.tool) trong folder `mcp_tools/`.
  * **Lưu ý:** Tất cả Tools được code thủ công để đảm bảo semantic descriptions tốt nhất cho LLM. KHÔNG sử dụng Swagger auto-import.

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
    * Không cần Ollama server
    * Chất lượng Vietnamese tốt hơn
    * Cloud-native, zero infrastructure

* **Web Search:** Tavily Search API
  * Free tier: 1,000 searches/month
  * Optimized cho AI agents (trả về structured data)

* **Domain Knowledge:** Veterinary Knowledge Graph (future enhancement)

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

## **9\. Detailed Feature List (Danh sách Tính năng Chi tiết)**

Các tính năng được phân nhóm theo chức năng và mức độ ưu tiên (Critical là bắt buộc phải có cho MVP).

### **System & Security (Hệ thống & Bảo mật)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **SYS-01** | **Dynamic Secrets Management** | Giao diện Frontend cho phép nhập/sửa/xóa API Keys (Qdrant, Search...). Backend mã hóa và lưu vào DB. Agent runtime tự động load lại key khi có thay đổi mà không cần deploy lại. | **Critical** |
| **SYS-02** | **Ollama Integration Manager** | Module kết nối tới Ollama Instance. Cho phép chọn Model active (ví dụ chuyển từ kimi-k2 sang gemma) ngay trên UI. | **High** |

### **Agent Orchestration (Quản lý Agent)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **AG-01** | **Hierarchical Agent Management** | Quản lý danh sách các Nodes trong LangGraph. Hiển thị cấu trúc cây Supervisor \-\> Workers. Cho phép kích hoạt/vô hiệu hóa từng Sub-Agent Node. | **Critical** |
| **AG-02** | **System Prompt Editor** | Giao diện chỉnh sửa System Message cho từng Node. Dữ liệu được versioning và lưu trong PostgreSQL. Hỗ trợ biến động (Dynamic Variables). | **Critical** |
| **AG-03** | **Model Parameter Tuning** | Cấu hình tham số inference cho Kimi k2/Gemma 3 (Temperature, Max Tokens, Top-P) thông qua API Config. | **High** |
| **AG-04** | **LLM Intent Classification** | Main Agent sử dụng LLM + Well-crafted Prompt để phân loại intent và routing. Không cần RAG routing hay Few-Shot examples. | **High** |

### **Tools & Integrations (Công cụ & Tích hợp)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **TL-01** | **Automated Tool Scanner** | Backend Service quét các hàm Python nội bộ (@mcp.tool) để tạo tool. Tất cả tools được code thủ công với semantic descriptions. | **Critical** |
| **TL-02** | **Tool Assignment & Routing** | Map các MCP Tools cụ thể vào từng Sub-Agent Node trong LangGraph. Đảm bảo Agent chỉ nhìn thấy tool được cho phép. | **Critical** |

### **Knowledge Base & RAG (Kiến thức)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **KB-01** | **Cloud Vector Sync (RAG)** | Pipeline sử dụng LlamaIndex để đọc file (PDF/Docx), thực hiện Chunking và đẩy Vector vào **Qdrant Cloud**. Xử lý xác thực qua API Key động. | **Critical** |
| **KB-02** | **Knowledge Graph Integration** | Tích hợp truy vấn Petagraph để xác thực thông tin y tế, giảm thiểu hallucination trong câu trả lời. | **High** |

### **Playground & Monitoring (Kiểm thử & Giám sát)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **PG-01** | **Real-time Chat Simulator** | Giao diện Chat kết nối qua WebSocket. Hiển thị Streaming Response từ FastAPI backend. | **Critical** |
| **PG-02** | **Thinking Process Visualization** | Hiển thị quá trình suy luận (Chain of Thought) và các bước gọi Tool (Tool Calls) của LangGraph dưới dạng log hoặc cây quyết định. | **Critical** |
| **PG-03** | **Traceability & Citation View** | Hiển thị nguồn trích dẫn từ Qdrant (Metadata: filename, page number) hoặc Web Search (URL) ngay trong log chat. | **High** |

### **Performance (Hiệu năng)**

| ID | Feature Name | Tech Stack Context & Description | Priority |
| :---- | :---- | :---- | :---- |
| **PERF-01** | **Binary Quantization Config** | Cấu hình tự động bật Binary Quantization khi tạo Collection mới trên Qdrant để tối ưu tốc độ search. | **High** |

## **10\. Use Case Descriptions (Mô tả Kịch bản Sử dụng)**

Mô tả các tình huống thực tế gắn liền với công nghệ sử dụng.

### **UC-01: Tinh chỉnh hành vi Điều phối (Supervisor Tuning with LangGraph)**

* **Actor:** Admin Hệ thống.  
* **Context:** Main Agent (Supervisor Node) sử dụng kimi-k2 đang phân loại sai ý định người dùng.  
* **Process:**  
  1. Admin truy cập Dashboard, chọn Node Supervisor.  
  2. Admin chỉnh sửa System Prompt trong Editor: "Thêm quy tắc: Nếu query chứa từ khóa 'nôn', 'tiêu chảy', bắt buộc route sang Node MedicalAgent".  
  3. Admin nhấn Save \-\> Backend cập nhật cấu hình vào PostgreSQL.  
  4. Tại Playground, Admin chat thử. WebSocket trả về log cho thấy Supervisor đã route đúng sang MedicalAgent.

### **UC-02: Thêm Tool mới cho Agent (Code-based)**

* **Actor:** Developer + Admin.
* **Context:** Cần thêm tool `check_vaccine_history` để Medical Agent tra cứu lịch sử tiêm chủng.
* **Process:**
  1. Developer tạo function trong `mcp_tools/medical_tools.py`:
     ```python
     @tool
     def check_vaccine_history(pet_name: str) -> str:
         """
         Tra cứu lịch sử tiêm chủng của thú cưng.
         Sử dụng khi user hỏi về vaccine, tiêm phòng, hoặc lịch sử tiêm.
         """
         # Gọi Spring Boot API bên trong
         response = requests.get(f"{BACKEND_URL}/api/v1/vaccines/by-pet/{pet_name}")
         return format_vaccine_history(response.json())
     ```
  2. Admin vào Dashboard → "Tool Management" → nhấn "Scan Tools".
  3. Hệ thống quét và hiển thị tool mới `check_vaccine_history`.
  4. Admin gán tool cho Medical Agent và bật Enable.
* **Lưu ý:** Tool được thiết kế với semantic description cho LLM hiểu khi nào nên gọi.

### **UC-03: Thêm kiến thức mới vào Vector Store (RAG Update)**

* **Actor:** Admin.  
* **Context:** Có phác đồ điều trị mới cần cập nhật cho Agent.  
* **Process:**  
  1. Admin upload file phoc\_do\_2026.pdf lên Dashboard.  
  2. Hệ thống kích hoạt LlamaIndex Pipeline: Doc Parsing \-\> Text Chunking \-\> Embedding (**Ollama/Nomic**) \-\> Upsert vào **Qdrant Cloud**.  
  3. Admin vào mục "Retrieval Test", nhập từ khóa. Hệ thống query Qdrant và hiển thị các chunks.

### **UC-04: Cấu hình Hệ thống Cloud APIs (Dynamic System Config)**

* **Actor:** Admin (DevOps hoặc Lead Dev).
* **Context:** Hệ thống đã deploy lên AWS EC2 với Docker. Cần cấu hình Cloud APIs qua Dashboard thay vì SSH sửa file .env.
* **Process:**
  1. Admin truy cập Dashboard, vào mục **"System Settings"**.
  2. Tại tab **"API Keys"**, Admin nhập:
     * **OpenRouter API Key** (LLM provider)
     * **Cohere API Key** (Embeddings)
     * **Qdrant Cloud URL + API Key** (Vector DB)
     * **Tavily API Key** (Web Search)
  3. Tại tab **"Model Configuration"**:
     * Chọn Primary LLM model (e.g., `google/gemini-2.0-flash-exp:free`)
     * Chọn Fallback model (e.g., `meta-llama/llama-3.3-70b-instruct`)
     * Set temperature, max_tokens cho từng agent
  4. Admin nhấn **"Test Connections"** để verify tất cả APIs hoạt động.
  5. Admin nhấn **"Save & Reload Context"**.
  6. Backend cập nhật DB (mã hóa API keys), refresh LangGraph Runtime ngay lập tức.
* **Lợi ích:**
  * Cloud-native AI stack (không cần GPU/Ollama server local)
  * Deploy production-ready trên AWS EC2
  * CI/CD tự động qua GitHub Actions
  * Thay đổi config không cần restart server