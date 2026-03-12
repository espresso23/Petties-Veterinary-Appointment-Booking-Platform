# PETTIES V0.0.1 - FEATURES & HAPPY FLOWS

---

## 🎯 5 ROLES & CORE FEATURES

### 🐕 **ROLE 1: PET_OWNER (Customer đồng thời là chủ thú cưng) MOBILE ONLY**
1. Đăng ký / Đăng nhập ✅
2. Quản lý hồ sơ cá nhân ✅
3. Tạo/sửa hồ sơ thú cưng ✅
4. Tìm kiếm phòng khám ✅
5. Tìm kiếm nhân viên
6. Đặt lịch khám tại phòng (Clinic Visit) ✅
7. Đặt lịch khám tại nhà (Home Visit) ✅
8. Xem lịch booking của tôi ✅
9. Xem chi tiết booking ✅
10. Hủy booking 🔄 (BE done)
11. Thanh toán online. 🔄 (In Progress)
12. Xem hồ sơ y tế thú cưng (EMR) ✅
13. Xem sổ tiêm chủng ✅
14. Đánh giá & review nhân viên
15. Chat với AI Chatbot (Pet Care Assistant) ✅
16. SOS - Cấp cứu khẩn cấp
17. **AI Vision: Phân tích hình ảnh sức khỏe thú cưng** ✅
18. **Hủy yêu cầu thay đổi Email** ✅
20. Xem đơn thuốc trong hồ sơ bệnh án (EMR) ✅
21. Nhận thông báo & nhắc nhở (Push/Email/SMS) ✅
22. Lưu ảnh, giống, độ tuổi, đặc điểm thú cưng ✅
23. **[SOS] Xem bản đồ realtime vị trí nhân viên**
24. **[SOS] Tracking đường di chuyển của nhân viên** (định tuyến cứu hộ)
25. **[SOS] Nhận thông báo khi nhân viên bắt đầu di chuyển, khi sắp đến & khi đã đến nơi** ✅
26. **[SOS] Tự động dừng tracking khi nhân viên xác nhận đã tiếp cận bệnh nhân** ✅

---

### 👨‍⚕️ **ROLE 2: STAFF (Nhân viên - nhân viên thú y, groomer) MOBILE + WEB**
1. Đăng nhập từ account được cấp ✅
2. Xem hồ sơ của tôi ✅
3. Xem lịch làm việc của tôi ✅
4. Xem booking được gán ✅
5. Check-in bệnh nhân ✅
6. **Hoàn thành khám (Treatment Finished)**: Nhân viên xác nhận đã khám xong, gửi yêu cầu thanh toán tới Manager. ✅
7. Xem hồ sơ y tế thú cưng ✅
8. Xem sổ tiêm chủng của pet ✅
9. **Tra cứu bệnh nhân cũ** (Patient Lookup): Tìm kiếm và xem hồ sơ bệnh nhân cũ của phòng khám ✅
10. Ghi chú hồ sơ bệnh án (tạo EMR) - **[Bắt buộc gắn với Booking]** ✅
11. Cập nhật sổ tiêm chủng - **[Bắt buộc gắn với Booking]** ✅
12. **[SOS] Start moving / Arrived / Checkout** → Quy trình cứu hộ khép kín với tracking realtime ✅
13. **[SOS] Detailed Checkout Dialog**: Xác nhận phí SOS, phí di chuyển và dịch vụ phát sinh ✅
13. **Dashboard Tổng quan lịch hẹn (Summary Dashboard)** ✅

---

### 👨‍💼 **ROLE 3: CLINIC_MANAGER (Quản lý phòng khám) WEB-ONLY**
1. Đăng nhập ✅
2. Xem danh sách nhân viên ✅
3. Thêm nhân viên thủ công ✅
4. Xóa/bỏ liên kết nhân viên ✅
5. Import lịch nhân viên thủ công ✅
6. Xem booking mới ✅
7. Gán nhân viên cho booking ✅
8. Gán lại booking (nếu nhân viên từ chối) ✅
9. Gán dịch vụ nếu user chưa chọn được
10. **Nhận tiền & Checkout (Payment & Completion)**: Nhận thanh toán từ khách và thực hiện thao tác Checkout để đóng đơn hàng.
11. Quản lý hủy & hoàn tiền
12. Xem dashboard hôm nay ✅
13. Quản lý ca làm việc nhân viên ✅
14. **Quản lý Hồ sơ Bệnh nhân (Patient Management)**: ✅
    - Xem danh sách bệnh nhân từng khám tại phòng khám
    - Xem chi tiết Lịch sử EMR và Sổ tiêm chủng của bệnh nhân (Read-Only)
15. **Block/Unblock Slot thủ công (Manual Slot Control)** ✅
16. **Xóa ca trực hàng loạt (Bulk Shift Delete)** ✅
17. **Kiểm tra tính khả dụng của nhân viên (Check Staff Availability)** ✅
18. **Gán lại nhân viên cho dịch vụ (Reassign Staff)** ✅

---

### 🏥 **ROLE 4: CLINIC_OWNER (Chủ phòng khám) WEB-ONLY**
1. Đăng nhập ✅
2. Quản lý thông tin phòng khám ✅
3. **Quản lý Danh mục Dịch vụ (Master Services):** ✅
    - Tạo danh mục dịch vụ tiêu chuẩn (Tên, Category, Mô tả, Icon, Giá mặc định).
    - Cấu hình giá sẵn để gán nhanh cho các phòng khám.
4. **Quản lý Dịch vụ tại Phòng khám (Clinic Services):** ✅
    - **Thừa hưởng (Inherit):** Áp dụng từ Master Services với giá đã cấu hình sẵn (có thể ghi đè/override giá riêng nếu muốn).
    - **Tự tạo (Custom):** Tạo các dịch vụ riêng biệt chỉ có tại phòng khám đó.
    - Cấu hình giá chi tiết (Base price, Price per KM) và trạng thái (Active/Inactive) cho từng dịch vụ cụ thể.
5. Xem Dashboard Phòng Khám ✅
6. Theo dõi doanh thu ✅


---

### 👨‍💻 **ROLE 5: ADMIN (Admin nền tảng) WEB ONLY**

#### **Platform Management (Quản lý Nền tảng)**
1. Đăng nhập ✅
2. Xem danh sách các clinic pending chờ duyệt ✅
3. Phê duyệt clinic ✅
4. Từ chối clinic 
5. Xem thống kê nền tảng, doanh thu ✅
6. Thống kê người dùng và giao dịch ✅

#### **AI Agent Configuration (Single Agent + ReAct)**
7. **Agent Configuration**
    - Bật/tắt Agent (Enable/Disable)
    - Chỉnh sửa System Prompt (với version control)
    - Điều chỉnh Model Hyperparameters (Temperature, Max Tokens, Top-P)
    - Chọn LLM Model (gemini-2.0-flash, llama-3.3-70b, claude-3.5-sonnet)

8. **Tool Management (@mcp.tool)**
    - Xem danh sách Tools được code sẵn
    - Bật/tắt từng Tool riêng lẻ
    - Xem Request/Response Schema cho mỗi tool

9. **Knowledge Base Management (RAG)**
    - Upload tài liệu (PDF, DOCX, TXT, MD)
    - Theo dõi trạng thái indexing (chunking & vectorization)
    - Test RAG retrieval với query examples
    - Xem vector count và storage usage

10. **Agent Testing & Debugging**
    - Interactive Chat Simulator để test agent
    - Xem ReAct Flow (Thought → Action → Observation)
    - Xem Tool Calls và Results
    - Citation View (RAG sources)
    - Feedback system (Good/Bad responses)


14. **System & Security Configuration**
    - Dynamic API Key Management (OpenRouter, Cohere, Qdrant, Tavily)
    - LLM Provider Configuration (OpenRouter Cloud API)
    - Model Selection (gemini-2.0-flash, llama-3.3-70b, claude-3.5-sonnet)
    - Embedding Provider (Cohere embed-multilingual-v3)
    - Test connections cho các Cloud services
    - Save & Reload Context (không cần restart server)

---

## 🤖 AI & AGENT FEATURES (Petties AI Layer)

> **Architecture:** Single Agent + ReAct Pattern + MCP Tools
> 
> **Note:** MVP sử dụng **Single Agent** với nhiều skills/tools, có thể config bởi Admin.

### AI Chatbot - Pet Care Assistant
- 🤖 Chat với AI Chatbot thông minh ✅
- 🤖 Tư vấn chăm sóc thú cưng ✅
- 🤖 Hỗ trợ tra cứu triệu chứng qua knowledge base ✅
- 🤖 **AI Vision Analysis - Phân tích hình ảnh sức khỏe thú cưng** ✅
- 🤖 RAG Engine - Tra cứu kiến thức y tế thú y (LlamaIndex + Qdrant) ✅
- 🤖 Booking via Chat - Đặt lịch qua hội thoại 🔄 (đã có tool + mobile confirmation, đang chờ E2E validation)
- 🤖 Citation & Attribution - Trích dẫn nguồn
- 🤖 Web Search - Tìm kiếm realtime 🔄
- 🤖 EMR Integration - Xem bệnh án điện tử ✅ (FE/BE)
- 🤖 SOS Tracking - Theo dõi vị trí cứu hộ ✅ (FE/BE)
- 🤖 Dynamic Pricing ✅ (BE)
- 🤖 Manual Scheduling ✅ (FE/BE)
- 🤖 Admin AI Config Board ✅ (FE/BE)
- 🤖 Knowledge Base Management ✅ (FE/BE)
- 🤖 Tool Registry ✅ (FE/BE)
- 🤖 Agent Playground ✅ (FE/BE)

### Single Agent Architecture (ReAct Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PETTIES AI AGENT (ReAct)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🧠 LLM Core (OpenRouter / Cohere)                                  │
│  ├── ReAct Pattern: Thought → Action → Observation → Loop          │
│  ├── Chain-of-Thought Reasoning                                     │
│  └── System Prompt (Admin Configurable)                             │
│                                                                     │
│  🔧 Skills/Tools (FastMCP @mcp.tool)                                │
│  ├── @mcp.tool: pet_knowledge_search → RAG knowledge retrieval      │
│  ├── @mcp.tool: web_search          → Web fallback search           │
│  ├── @mcp.tool: get_user_pets         → Load user pets             │
│  ├── @mcp.tool: search_clinics_nearby → Find nearby clinics        │
│  ├── @mcp.tool: check_available_slots → Check available slots      │
│  └── @mcp.tool: create_booking_for_user → Create booking via chat  │
│                                                                     │
│  📚 Hybrid RAG Engine                                               │
│  ├── RAG Engine: LlamaIndex + Qdrant Cloud + Cohere Embeddings     │
│  ├── Query Expander: LLM-based short query expansion               │
│  ├── Knowledge Graph: LlamaIndex KGIndex + SimpleGraphStore        │
│  ├── Case Memory: Confirmed cases + feedback-weighted re-ranking   │
│  └── Parallel Search: RAG + KG + Case Memory merged results       │
│                                                                     │
│  💬 Feedback Loop                                                    │
│  ├── User Feedback Collection (1-5 rating per message)             │
│  ├── Auto-embed positive cases into Case Memory                    │
│  └── Role-based feedback weights (STAFF=1.0, PET_OWNER=0.6)       │
│                                                                     │
│  ⚙️ Admin Config                                                    │
│  ├── Enable/Disable Agent                                           │
│  ├── System Prompt (editable)                                       │
│  ├── Parameters: Temperature, Max Tokens, Top-P                     │
│  ├── Tool Management: Enable/Disable individual tools              │
│  ├── Knowledge Base: Upload/Remove documents                        │
│  ├── Knowledge Graph: Build/Stats                                   │
│  └── Case Memory: Stats/Prune                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### ReAct Pattern (Reason + Act)

- 🧠 **Thought**: Agent suy luận về câu hỏi/yêu cầu của user
- 🔧 **Action**: Gọi tool phù hợp (RAG search, symptom lookup, booking, etc.)
- 👁️ **Observation**: Nhận kết quả từ tool
- 🔄 **Loop**: Lặp lại cho đến khi có đủ thông tin để trả lời
- ✅ **Answer**: Tổng hợp và trả lời user

### AI Tools (FastMCP Protocol)
- 🔧 `pet_knowledge_search` - Tra cứu kiến thức thú y và triệu chứng từ knowledge base
- 🔧 `web_search` - Tìm kiếm web khi knowledge base chưa đủ dữ liệu
- 🔧 `get_user_pets` - Lấy danh sách thú cưng của user hiện tại
- 🔧 `search_clinics_nearby` - Tìm phòng khám gần vị trí người dùng
- 🔧 `get_clinic_services` - Lấy dịch vụ đang hoạt động của phòng khám
- 🔧 `check_vaccination_status` - Kiểm tra lịch sử tiêm và mũi sắp tới
- 🔧 `check_available_slots` - Kiểm tra slot trống theo dịch vụ
- 🔧 `create_booking_for_user` - Tạo lịch hẹn qua chat sau khi đã xác nhận

### Admin Agent Configuration (Simple UI)
- ⚙️ **Agent Status** - Bật/Tắt Agent
- 📝 **System Prompt** - Chỉnh sửa prompt hướng dẫn Agent
- 🎛️ **Model Parameters** - Temperature, Max Tokens, Top-P, Model selection
- 🔧 **Tool Management** - Bật/Tắt từng tool riêng lẻ
- 📚 **Knowledge Base** - Upload/Remove documents cho RAG

### RAG Engine (LlamaIndex + Qdrant)
- 📄 **Document Ingestion** - Upload PDF, DOCX, TXT, MD
- ✂️ **Chunking** - Tự động chia nhỏ documents
- 🔢 **Embedding** - Cohere embed-multilingual-v3
- 🔍 **Vector Search** - Qdrant Cloud với Binary Quantization
- 📖 **Retrieval** - Top-K similarity search

### AI Accuracy Improvement Mechanisms ✅ (Sprint 13)

> **4 cơ chế cải thiện độ chính xác AI theo thời gian** - Tất cả đã được implement và tích hợp vào HybridRAGEngine.

#### Query Expansion (Mở rộng truy vấn) ✅
- 🔍 **LLM-based Query Expansion** - Mở rộng câu hỏi ngắn/mơ hồ thành truy vấn chi tiết hơn trước khi search RAG
- 🔍 Tự động bỏ qua nếu query đã đủ dài hoặc rõ ràng (>50 ký tự)
- 🔍 Tích hợp vào `pet_knowledge_search` MCP tool
- 🔍 File: `app/core/rag/query_expander.py`

#### Knowledge Graph (Đồ thị tri thức) ✅
- 🧠 **LlamaIndex KnowledgeGraphIndex** - Trích xuất quan hệ (entity → relation → entity) từ tài liệu
- 🧠 **SimpleGraphStore** - Lưu trữ graph trong file JSON (phù hợp MVP)
- 🧠 Build từ Admin API (`POST /knowledge/build-kg`)
- 🧠 Cung cấp ngữ cảnh quan hệ bổ sung cho RAG retrieval
- 🧠 File: `app/core/rag/knowledge_graph.py`

#### Visual Case Memory (Bộ nhớ ca bệnh) ✅
- 📋 **Confirmed Case Storage** - Lưu các ca bệnh đã xác nhận từ feedback tích cực vào Qdrant
- 📋 **Feedback-weighted Re-ranking** - Score = cosine_similarity + min(feedback_count/100, 0.3) + (0.1 if staff_verified)
- 📋 **Role-based Weights** - STAFF=1.0, CLINIC_MANAGER/OWNER=0.7, PET_OWNER=0.6
- 📋 Auto-embed khi nhận feedback tích cực (rating >= 4)
- 📋 Admin prune endpoint (`POST /knowledge/case-memory/prune`)
- 📋 File: `app/core/rag/case_memory.py`

#### Feedback Loop (Vòng phản hồi) ✅
- 💬 **User Feedback API** - Thu thập đánh giá (1-5 sao) cho mỗi tin nhắn AI
- 💬 **Auto-classify** - Tự động phân loại feedback dựa trên rating
- 💬 **Auto-embed Positive Cases** - Feedback tốt tự động lưu vào Case Memory
- 💬 **Per-role Statistics** - Admin xem toàn bộ, user khác chỉ xem feedback của mình
- 💬 MongoDB storage (feedback collection)
- 💬 File: `app/core/services/feedback_service.py`, `app/api/schemas/feedback_schemas.py`

#### Hybrid RAG Engine (Tổng hợp) ✅
- 🔗 **Parallel Search** - Chạy đồng thời RAG + Knowledge Graph + Case Memory
- 🔗 **Merged Results** - Gộp và deduplicate kết quả từ 3 nguồn
- 🔗 **Graceful Degradation** - Nếu KG hoặc Case Memory lỗi, vẫn trả kết quả RAG
- 🔗 File: `app/core/rag/hybrid_engine.py`

---

## 📱 ADVANCED FEATURES

### 🚨 SOS - Cấp Cứu Khẩn Cấp
- Xác định phòng khám thú y (Clinic) khẩn cấp gần nhất
- Liên hệ tức thì cho tư vấn
- Đặt lịch khẩn cấp

### Electronic Medical Records (EMR)
- Hệ thống Hồ sơ Bệnh án Điện tử
- Lưu trữ tập trung lịch sử bệnh tật
- **Đơn thuốc (Prescription)** được ghi trực tiếp vào EMR
- Shared EMR - Tất cả phòng khám xem được lịch sử y tế
- Truy cập bất kỳ lúc nào, bất kỳ nơi đâu

> **📌 Scope:** Petties là **nền tảng booking**, KHÔNG bao gồm quản lý kho thuốc hay quản lý nhân sự chuyên sâu.

### 💉 Vaccination Tracker (Sổ Tiêm Chủng)
- Lịch sử tiêm chủng đầy đủ
- Shared across clinics - Chia sẻ giữa các phòng khám
- Nhắc nhở lịch tiêm định kỳ

- **Real-time Desktop (SSE):** Thông báo tức thời khi có lịch mới, duyệt clinic, hoặc cập nhật ca làm việc. ✅
- **Sidebar Badge Counter:** Tự động đếm số thông báo chờ xử lý/chưa đọc. ✅
- Push notification (Mobile/Firebase)

### 💰 Dynamic Pricing (Định Giá Động)
- Base price + fees
- Tính giá dựa trên khoảng cách (Home Visit)
- Phí dịch vụ linh hoạt

### 🌍 Multi-language Support
- Hỗ trợ đa ngôn ngữ
- Timezone support - Múi giờ

### 👨‍⚕️ Staff/Manager Account Creation Flow (Quick Add) ✅ (Updated - Use Google OAuth)
**Mô tả:** Quy trình để CLINIC_OWNER/MANAGER thêm nhanh nhân sự vào hệ thống thông qua Email. Nhân viên sẽ đăng nhập bằng tài khoản Google, thông tin cá nhân sẽ tự động đồng bộ.

#### Screen Flows:
1. Owner/Manager truy cập màn hình "Quản lý nhân sự" (Staff Management).
2. Chọn "Thêm nhân viên" (Quick Add).
3. Nhập các thông tin tối giản:
    - Email (Bắt buộc, dùng để liên kết tài khoản Google)
    - Vai trò (Clinic Manager hoặc Staff)
    - Chuyên môn (Chỉ áp dụng cho Staff)
4. Hệ thống:
    - Kiểm tra Email đã thuộc phòng khám khác chưa.
    - Tạo bản ghi nhân sự tạm thời gắn với Email.
5. Nhân viên sử dụng tài khoản Google tương ứng với Email đã mời để đăng nhập.
6. Hệ thống:
    - Tự động lấy `fullName` và `avatar` từ Google profile trong lần đăng nhập đầu tiên.
    - Hoàn tất kích hoạt tài khoản nhân sự.

#### Form thêm nhanh (Quick Add Form):
| Field | Required | Description |
|-------|----------|-------------|
| Email | ✅ | Email dùng để đăng nhập Google OAuth |
| Vai trò | ✅ | Chọn Clinic Manager hoặc Staff |
| Chuyên môn | 🔄 | Áp dụng cho Staff để gán booking phù hợp |

#### Account States:
| Status | Mô tả | Đăng nhập? |
|--------|-------|------------|
| `ACTIVE` | Hoạt động bình thường | ✅ |
| `DEACTIVATED` | Nghỉ việc / Bị vô hiệu hóa | ❌ |

**Lưu ý:** Role `STAFF` bao quát toàn bộ nhân sự phòng khám. Chuyên môn được phân biệt bằng nhóm chuyên môn y tế và grooming.

---

### 👨‍💼 Quản lý Lịch làm việc (Manual Scheduling Flow)
**Mô tả:** Quy trình CLINIC_MANAGER tạo lịch làm việc cho nhân viên và hệ thống tự động sinh Slot.

#### Quy trình chi tiết:
1. **Manager chọn Nhân viên & Ngày**: Chọn nhân viên từ danh sách và chọn ngày trên Calendar.
2. **Nhập thời gian**:
    - Giờ bắt đầu (Start Time): ví dụ 08:00
    - Giờ kết thúc (End Time): ví dụ 17:00
    - Thời gian nghỉ (Break Start/End): ví dụ 12:00 - 13:00 (Hệ thống sẽ không tạo Slot trong lúc này).
3. **Hệ thống xử lý (Background)**:
    - Kiểm tra Overlap: Nhân viên đã có lịch tại chi nhánh này hoặc chi nhánh khác chưa.
    - Chia nhỏ thời gian thành các Slot 30 phút.
    - Lưu vào DB: 1 bản ghi `StaffShift` và danh sách các `Slot`.
4. **Kết quả**: Lịch và các ô trống hiện lên Dashboard để Pet Owner đặt lịch.


## 🔑 KEY FEATURES SUMMARY (MVP 1-Month Scope)

### ✅ CORE FEATURES (In Scope)
✅ **Clinic-based staff** (NO freelancers)  
✅ **Shared EMR** (All clinics see medical history)  
✅ **Shared vaccination records** (Across clinics)  
✅ **Dynamic pricing** (Base + Weight-based + Distance fees)  
✅ **Hybrid Service Model** (Master Services + Custom Services)  
✅ **Slot management** (Auto reduce/restore)  
✅ **Manual scheduling** (Manager tạo lịch thủ công)  
✅ **Multiple appointment types** (IN_CLINIC, HOME_VISIT)  
✅ **Quy trình Booking (Booking workflow)**: `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED`
  
✅ **Rating system** (Pet owner đánh giá Clinic/Staff)  
✅ **SOS Geo-Tracking** (GPS realtime tracking cho cấp cứu)
✅ **AI Chatbot** (Single Agent + ReAct Pattern + MCP Tools)  
✅ **EMR với đơn thuốc** (Prescription trong hồ sơ bệnh án)  
✅ **Push Notifications** (Firebase)  
✅ **Admin Agent Config** (Prompt, Parameters, Tools, Knowledge Base)  
✅ **Knowledge Base RAG** (LlamaIndex + Qdrant Cloud)  
✅ **Query Expansion** (LLM-based short query expansion)  
✅ **Knowledge Graph** (LlamaIndex KGIndex + SimpleGraphStore)  
✅ **Case Memory** (Confirmed cases + feedback-weighted re-ranking)  
✅ **Feedback Loop** (User feedback → auto-embed positive cases)

### ❌ DEFERRED (Phase 2)
❌ ~~Home Visit Geo-Routing~~ (Đơn giản hóa cho MVP, chỉ dùng cho SOS)
❌ ~~Video Consultation~~ (Deferred - WebRTC phức tạp)  
❌ ~~Excel Import~~ (Deferred - Manual đủ cho MVP)  
❌ ~~Legacy supervisor architecture~~ (Simplified to Single Agent)  
❌ ~~Email/SMS Notifications~~ (Push đủ cho MVP)  

---

## 🛠️ TECH STACK (Reference)

| Layer | Technologies |
|-------|-------------|
| **Web Frontend** | React 19+ Vite, TypeScript, Tailwind CSS, Zustand |
| **Mobile** | Flutter 3.5, iOS & Android |
| **Backend** | Java 21, Spring Boot 3.4.x, Spring Security (JWT) |
| **AI Layer** | Python 3.12, FastAPI, Single Agent (ReAct), FastMCP, LlamaIndex |
| **Databases** | PostgreSQL, MongoDB, Redis, Qdrant Cloud (Vector) |
| **Infrastructure** | Docker, Cloudinary, GitHub Actions |
| **Payment** | Stripe | 
| **Notifications** | Firebase (Push) |

---

**Version: 1.8.0 - PETTIES MVP SCOPE (AI ACCURACY IMPROVEMENT COMPLETE)**
**Status: ✅ READY FOR DEV**
**Total Features: 113 Use Cases (Full Coverage)**
**Last Updated: March 11, 2026**

---

## 📊 ROLE STANDARDIZATION: STAFF ✅ HOÀN THÀNH

> **Note:** Tài liệu dùng thống nhất thuật ngữ `Staff` cho role nhân sự phòng khám và không dùng lại thuật ngữ cũ.

| Thành phần | Trạng thái |
|------------|------------|
| Database (Flyway) | ✅ 3 migrations |
| Backend (Spring Boot) | ✅ 98% |
| Frontend (React) | ✅ 100% |
| Mobile (Flutter) | ✅ 100% |
| Unit Tests | ✅ 62/62 passed |

