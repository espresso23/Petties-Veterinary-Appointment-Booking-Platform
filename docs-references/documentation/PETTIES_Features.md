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
19. Video Consultation (Tư vấn video từ xa)
20. Xem đơn thuốc trong hồ sơ bệnh án (EMR) ✅
21. Nhận thông báo & nhắc nhở (Push/Email/SMS) ✅
22. Lưu ảnh, giống, độ tuổi, đặc điểm thú cưng ✅
23. **[SOS] Xem bản đồ realtime vị trí nhân viên**
24. **[SOS] Tracking đường di chuyển của nhân viên** (định tuyến cứu hộ)
25. **[SOS] Nhận thông báo khi nhân viên sắp đến / đã đến nơi**

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
12. **[SOS] Bắt đầu di chuyển cứu hộ (Start Emergency Travel)**
13. **[SOS] Tự động cập nhật vị trí GPS realtime** để người dùng theo dõi
14. **[SOS] Thông báo đến nơi** → Đánh dấu đã tiếp cận ca cấp cứu
15. **Dashboard Tổng quan lịch hẹn (Summary Dashboard)** ✅

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
> **Note:** MVP sử dụng **Single Agent** (không phải Multi-Agent) với nhiều skills/tools, có thể config bởi Admin.

### AI Chatbot - Pet Care Assistant
- 🤖 Chat với AI Chatbot thông minh ✅
- 🤖 Tư vấn chăm sóc thú cưng ✅
- 🤖 Hỗ trợ tìm kiếm triệu chứng (Symptom Search) ✅
- 🤖 **AI Vision Analysis - Phân tích hình ảnh sức khỏe thú cưng** ✅
- 🤖 RAG Engine - Tra cứu kiến thức y tế thú y (LlamaIndex + Qdrant) ✅
- 🤖 Booking via Chat - Đặt lịch qua hội thoại ✅
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
│  ├── @mcp.tool: pet_care_qa       → RAG-based Q&A                  │
│  ├── @mcp.tool: symptom_search    → Symptom → Disease lookup       │
│  ├── @mcp.tool: analyze_pet_image → Phân tích hình ảnh (Vision)     │
│  ├── @mcp.tool: search_clinics    → Find nearby clinics            │
│  ├── @mcp.tool: check_slots       → Check available slots          │
│  └── @mcp.tool: create_booking    → Create booking via chat        │
│                                                                     │
│  📚 RAG Engine (LlamaIndex + Qdrant)                                │
│  ├── LlamaIndex: Document processing, chunking, retrieval          │
│  ├── Qdrant Cloud: Vector storage với Binary Quantization          │
│  └── Cohere Embeddings (embed-multilingual-v3)                      │
│                                                                     │
│  ⚙️ Admin Config                                                    │
│  ├── Enable/Disable Agent                                           │
│  ├── System Prompt (editable)                                       │
│  ├── Parameters: Temperature, Max Tokens, Top-P                     │
│  ├── Tool Management: Enable/Disable individual tools              │
│  └── Knowledge Base: Upload/Remove documents                        │
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
- 🔧 `pet_care_qa` - Hỏi đáp về chăm sóc thú cưng (RAG-based)
- 🔧 `symptom_search` - Tìm bệnh dựa trên triệu chứng
- 🔧 `analyze_pet_image` - Phân tích hình ảnh sức khỏe pet (Vision)
- 🔧 `search_clinics` - Tìm phòng khám gần đây
- 🔧 `check_slots` - Kiểm tra slot trống
- 🔧 `create_booking` - Tạo lịch hẹn qua chat

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

---

## 📱 ADVANCED FEATURES

### 🚨 SOS - Cấp Cứu Khẩn Cấp
- Xác định phòng khám thú y (Clinic) khẩn cấp gần nhất
- Liên hệ tức thì cho tư vấn
- Đặt lịch khẩn cấp

### 📹 Video Consultation (Tư Vấn Video)
- Gọi video trực tiếp với nhân viên
- Chẩn đoán từ xa

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

**Lưu ý:** Từ phiên bản mới, Role `STAFF` đã được đổi thành `STAFF` để bao quát cả nhân viên thú y (VET_GENERAL, VET_SURGERY, etc.) và nhân viên grooming (GROOMER). Chuyên môn được phân biệt qua trường `StaffSpecialty`.

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
    - Lưu vào DB: 1 bản ghi `VetShift` và danh sách các `Slot`.
4. **Kết quả**: Lịch và các ô trống hiện lên Dashboard để Pet Owner đặt lịch.


## 🔑 KEY FEATURES SUMMARY (MVP 1-Month Scope)

### ✅ CORE FEATURES (In Scope)
✅ **Clinic-based vets** (NO freelancers)  
✅ **Shared EMR** (All clinics see medical history)  
✅ **Shared vaccination records** (Across clinics)  
✅ **Dynamic pricing** (Base + Weight-based + Distance fees)  
✅ **Hybrid Service Model** (Master Services + Custom Services)  
✅ **Slot management** (Auto reduce/restore)  
✅ **Manual scheduling** (Manager tạo lịch thủ công)  
✅ **Multiple appointment types** (IN_CLINIC, HOME_VISIT)  
✅ **Quy trình Booking (Booking workflow)**: (PENDING → CONFIRMED → ASSIGNED → ON_THE_WAY → ARRIVED → CHECK_IN → IN_PROGRESS → **PAID** → **CHECK_OUT / COMPLETED**)
  
✅ **Rating system** (Pet owner đánh giá Clinic/Staff)  
✅ **SOS Geo-Tracking** (GPS realtime tracking cho cấp cứu)
✅ **AI Chatbot** (Single Agent + ReAct Pattern + MCP Tools)  
✅ **EMR với đơn thuốc** (Prescription trong hồ sơ bệnh án)  
✅ **Push Notifications** (Firebase)  
✅ **Admin Agent Config** (Prompt, Parameters, Tools, Knowledge Base)  
✅ **Knowledge Base RAG** (LlamaIndex + Qdrant Cloud)  

### ❌ DEFERRED (Phase 2)
❌ ~~Home Visit Geo-Routing~~ (Đơn giản hóa cho MVP, chỉ dùng cho SOS)
❌ ~~Video Consultation~~ (Deferred - WebRTC phức tạp)  
❌ ~~Excel Import~~ (Deferred - Manual đủ cho MVP)  
❌ ~~Multi-Agent Architecture~~ (Simplified to Single Agent)  
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

**Version: 1.7.0 - PETTIES MVP SCOPE (VET→STAFF MIGRATION COMPLETE)**
**Status: ✅ READY FOR DEV**
**Total Features: 109 Use Cases (Full Coverage)**
**Last Updated: January 29, 2026**

---

## 📊 MIGRATION STATUS: VET → STAFF ✅ HOÀN THÀNH

> **Note:** Thuật ngữ `Vet` đã được migrate sang `Staff` để phù hợp với mô hình nhân viên đa dạng (Bác sĩ thú y, Groomer, v.v.)

| Thành phần | Trạng thái |
|------------|------------|
| Database (Flyway) | ✅ 3 migrations |
| Backend (Spring Boot) | ✅ 98% |
| Frontend (React) | ✅ 100% |
| Mobile (Flutter) | ✅ 100% |
| Unit Tests | ✅ 62/62 passed |

**Chi tiết:** Xem `docs-references/development/dev/VET_TO_STAFF_MIGRATION_GUIDE.md`
