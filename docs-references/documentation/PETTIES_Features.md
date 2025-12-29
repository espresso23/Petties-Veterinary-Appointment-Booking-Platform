# PETTIES V0.0.1 - FEATURES & HAPPY FLOWS

---

## 🎯 5 ROLES & CORE FEATURES

### 🐕 **ROLE 1: PET_OWNER (Customer đồng thời là chủ thú cưng) MOBILE ONLY**
1. Đăng ký / Đăng nhập ✅
2. Quản lý hồ sơ cá nhân ✅
3. Tạo/sửa hồ sơ thú cưng
4. Tìm kiếm phòng khám
5. Tìm kiếm bác sĩ
6. Đặt lịch khám tại phòng (Clinic Visit)
7. Đặt lịch khám tại nhà (Home Visit)
8. Xem lịch booking của tôi
9. Xem chi tiết booking
10. Hủy booking
11. Thanh toán online.
12. Xem hồ sơ y tế thú cưng (EMR)
13. Xem sổ tiêm chủng
14. Đánh giá & review bác sĩ
15. Chat với AI Chatbot (Pet Care Assistant)
16. SOS - Cấp cứu khẩn cấp
17. Video Consultation (Tư vấn video từ xa)
18. Xem đơn thuốc trong hồ sơ bệnh án (EMR)
19. Nhận thông báo & nhắc nhở (Push/Email/SMS)
20. Lưu ảnh, giống, độ tuổi, đặc điểm thú cưng
21. **[Home Visit] Xem bản đồ realtime vị trí bác sĩ**
22. **[Home Visit] Tracking đường di chuyển của bác sĩ** (giống tracking tài xế)
23. **[Home Visit] Nhận thông báo khi bác sĩ sắp đến / đã đến nơi**

---

### 👨‍⚕️ **ROLE 2: VET (Bác sĩ thú y) MOBILE + WEB**
1. Đăng nhập từ account được cấp ✅
2. Xem hồ sơ của tôi ✅
3. Xem lịch làm việc của tôi
4. Xem booking được gán
5. Phê duyệt booking
6. Từ chối booking
7. Check-in bệnh nhân
8. Check-out bệnh nhân
9. Xem hồ sơ y tế thú cưng
10. Xem sổ tiêm chủng của pet
11. **Tra cứu bệnh nhân cũ** (Patient Lookup): Tìm kiếm và xem hồ sơ bệnh nhân cũ của phòng khám 
12. Ghi chú hồ sơ bệnh án (tạo EMR) - **[Bắt buộc gắn với Booking]**
13. Cập nhật sổ tiêm chủng - **[Bắt buộc gắn với Booking]**
14. Video Consultation với pet owner(optionally)
15. Ghi đơn thuốc vào hồ sơ bệnh án (EMR)
16. **[Home Visit] Bắt đầu di chuyển (Start Travel)** → Chuyển booking sang ON_THE_WAY
17. **[Home Visit] Tự động cập nhật vị trí GPS realtime** khi đang di chuyển
18. **[Home Visit] Thông báo đến nơi** → Pet Owner được notify

---

### 👨‍💼 **ROLE 3: CLINIC_MANAGER (Quản lý phòng khám) WEB-ONLY**
1. Đăng nhập ✅
2. Xem danh sách bác sĩ ✅ (BE)
3. Thêm bác sĩ thủ công ✅ (BE)
4. Xóa/bỏ liên kết bác sĩ ✅ (BE)
5. Import lịch bác sĩ từ Excel
6. Import lịch bác sĩ thủ công
7. Xem booking mới
8. Gán bác sĩ cho booking
9. Gán lại booking (nếu bác sĩ từ chối)
10. Chat với pet owner tư vấn
11. Gán dịch vụ nếu user chưa chọn được
12. Quản lý hủy & hoàn tiền
13. Xem dashboard hôm nay
14. Quản lý ca làm việc nhân viên
15. **Quản lý Hồ sơ Bệnh nhân (Patient Management)**:
    - Xem danh sách bệnh nhân từng khám tại phòng khám
    - Xem chi tiết Lịch sử EMR và Sổ tiêm chủng của bệnh nhân (Read-Only)

---

### 🏥 **ROLE 4: CLINIC_OWNER (Chủ phòng khám) WEB-ONLY**
1. Đăng nhập ✅
2. Quản lý thông tin phòng khám
3. **Quản lý Danh mục Dịch vụ (Master Services):**
    - Tạo danh mục dịch vụ tiêu chuẩn (Tên, Category, Mô tả, Icon, Giá mặc định).
    - Cấu hình giá sẵn để gán nhanh cho các phòng khám.
4. **Quản lý Dịch vụ tại Phòng khám (Clinic Services):**
    - **Thừa hưởng (Inherit):** Áp dụng từ Master Services với giá đã cấu hình sẵn (có thể ghi đè/override giá riêng nếu muốn).
    - **Tự tạo (Custom):** Tạo các dịch vụ riêng biệt chỉ có tại phòng khám đó.
    - Cấu hình giá chi tiết (Base price, Price per KM) và trạng thái (Active/Inactive) cho từng dịch vụ cụ thể.
5. Xem Dashboard Phòng Khám
6. Theo dõi doanh thu ✅ (BE)


---

### 👨‍💻 **ROLE 5: ADMIN (Admin nền tảng) WEB ONLY**

#### **Platform Management (Quản lý Nền tảng)**
1. Đăng nhập ✅
2. Xem danh sách các clinic pending chờ duyệt
3. Phê duyệt clinic
4. Từ chối clinic
5. Xem thống kê nền tảng, doanh thu
6. Thống kê người dùng và giao dịch

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
- 🤖 RAG Engine - Tra cứu kiến thức y tế thú y (LlamaIndex + Qdrant) ✅
- 🤖 Booking via Chat - Đặt lịch qua hội thoại ✅
- 🤖 Citation & Attribution - Trích dẫn nguồn
- 🤖 Web Search - Tìm kiếm realtime 🔄
- 🤖 EMR Integration - Xem bệnh án điện tử ✅ (FE/BE)
- 🤖 Vaccination Tracker - Xem sổ tiêm chủng ✅ (FE/BE)
- 🤖 Home Visit Tracking ✅ (FE/BE)
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
- Gọi video trực tiếp với bác sĩ
- Chẩn đoán từ xa

###  Electronic Medical Records (EMR)
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

### 🔔 Notification System
- Thông báo appointment sắp tới
- Nhắc nhở lịch uống thuốc
- Email, SMS, Push notification (Firebase)

### 💰 Dynamic Pricing (Định Giá Động)
- Base price + fees
- Tính giá dựa trên khoảng cách (Home Visit)
- Phí dịch vụ linh hoạt

### 🌍 Multi-language Support
- Hỗ trợ đa ngôn ngữ
- Timezone support - Múi giờ

### 👨‍⚕️ Vet/Manager Account Creation Flow (Quick Add) ✅ (Backend Done)
**Mô tả:** Quy trình để CLINIC_OWNER/MANAGER thêm nhanh và cấp tài khoản cho nhân sự (thông qua SĐT).

#### Screen Flows:
1. Owner/Manager truy cập màn hình "Quản lý nhân sự" (Staff Management).
2. Chọn "Thêm nhân viên" (Quick Add).
3. Nhập các thông tin tối giản:
    - Họ và tên
    - Số điện thoại (Bắt buộc, dùng làm Username)
    - Vai trò (Clinic Manager hoặc Vet)
4. Hệ thống:
    - Kiểm tra SĐT đã tồn tại chưa.
    - Tạo tài khoản với `username = phone`.
    - Tạo mật khẩu mặc định = **6 số cuối SĐT**.
    - Gán `workingClinic` trỏ về chi nhánh hiện tại.
5. Nhân viên sử dụng SĐT và mật khẩu mặc định để đăng nhập vào Web/Mobile ngay lập tức.

#### Form thêm nhanh (Quick Add Form):
| Field | Required | Description |
|-------|----------|-------------|
| Họ và tên | ✅ | Tên đầy đủ |
| Số điện thoại | ✅ | Định danh đăng nhập, mã xác thực sau này |
| Vai trò | ✅ | Chọn Clinic Manager hoặc Vet |

#### Account States:
| Status | Mô tả | Đăng nhập? |
|--------|-------|------------|
| `ACTIVE` | Hoạt động bình thường | ✅ |
| `DEACTIVATED` | Nghỉ việc / Bị vô hiệu hóa | ❌ |

---

### 👨‍💼 Quản lý Lịch làm việc (Manual Scheduling Flow)
**Mô tả:** Quy trình CLINIC_MANAGER tạo lịch làm việc cho bác sĩ và hệ thống tự động sinh Slot.

#### Quy trình chi tiết:
1. **Manager chọn Bác sĩ & Ngày**: Chọn bác sĩ từ danh sách và chọn ngày trên Calendar.
2. **Nhập thời gian**:
    - Giờ bắt đầu (Start Time): ví dụ 08:00
    - Giờ kết thúc (End Time): ví dụ 17:00
    - Thời gian nghỉ (Break Start/End): ví dụ 12:00 - 13:00 (Hệ thống sẽ không tạo Slot trong lúc này).
3. **Hệ thống xử lý (Background)**:
    - Kiểm tra Overlap: Bác sĩ đã có lịch tại chi nhánh này hoặc chi nhánh khác chưa.
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
✅ Quy trình Booking (Booking workflow): (PENDING → ASSIGNED → CONFIRMED → ON_THE_WAY → ARRIVED → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED)
  
✅ **Rating system** (Pet owner đánh giá Clinic/Vet)  
✅ **Chat 1-1** (Pet Owner ↔ Manager/Vet)  
✅ **Home Visit Geo-Tracking** (GPS realtime tracking)  
✅ **AI Chatbot** (Single Agent + ReAct Pattern + MCP Tools)  
✅ **EMR với đơn thuốc** (Prescription trong hồ sơ bệnh án)  
✅ **Push Notifications** (Firebase)  
✅ **Admin Agent Config** (Prompt, Parameters, Tools, Knowledge Base)  
✅ **Knowledge Base RAG** (LlamaIndex + Qdrant Cloud)  

### ❌ DEFERRED (Phase 2)
❌ ~~SOS Emergency~~ (Deferred - Logic phức tạp)  
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
| **Backend** | Java 21, Spring Boot 4.x, Spring Security (JWT) |
| **AI Layer** | Python 3.12, FastAPI, Single Agent (ReAct), FastMCP, LlamaIndex |
| **Databases** | PostgreSQL, MongoDB, Redis, Qdrant Cloud (Vector) |
| **Infrastructure** | Docker, Cloudinary, GitHub Actions |
| **Payment** | Stripe | 
| **Notifications** | Firebase (Push) |

---

**Version: 8.0 - PETTIES MVP SCOPE (1-MONTH)**  
**Status: ✅ READY FOR DEV**  
**Total Features: ~48 (MVP Scope)**  
**Last Updated: December 26, 2025**
