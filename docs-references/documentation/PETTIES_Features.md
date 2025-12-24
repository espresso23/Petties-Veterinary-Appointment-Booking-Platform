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
9. Xem hồ sơ y tế thú cưng (Nếu được pet owner SHARED)
10. Xem sổ tiêm chủng của pet
11. Ghi chú hồ sơ bệnh án (tạo EMR)
12. Cập nhật sổ tiêm chủng
13. Video Consultation với pet owner(optionally)
14. Ghi đơn thuốc vào hồ sơ bệnh án (EMR)

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
9. Xem đơn tố cáo xử lý vi phạm của clinic, người dùng.
11. **Agent Configuration**
    - Quản lý Agent theo cấu trúc phân cấp (Main Agent + Sub-Agents)
    - Chỉnh sửa System Prompt với version control (không ưu tiên)
    - Điều chỉnh Model Hyperparameters (Temperature, Max Tokens, Top-P)
    - Bật/tắt Agent (Enable/Disable)

11. **Tool Management (Code-based)**
    - Quét và đồng bộ Code-based Tools từ Python (@mcp.tool)
    - Xem Request/Response Schema cho mỗi tool
    - Gán Tools cho Agents
    - Bật/tắt Tools (Enable/Disable)

12. **Knowledge Base Management (RAG)**
    - Upload tài liệu (PDF, DOCX, TXT, MD)
    - Theo dõi trạng thái indexing (chunking & vectorization)
    - Test RAG retrieval với query examples
    - Xem vector count và storage usage

13. **Agent Playground & Debugging**
    - Interactive Chat Simulator để test agents
    - Hierarchical Flow Visualization (agent handoffs)
    - Xem Thinking Process và Tool Calls
    - Citation View (RAG sources + Web URLs)
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

### AI Chatbot - Pet Care Assistant
- 🤖 Chat với AI Chatbot thông minh
- 🤖 Tư vấn chăm sóc thú cưng
- 🤖 Hỗ trợ tìm kiếm triệu chứng (Symptom Search)
- 🤖 RAG Engine - Tra cứu kiến thức y tế thú y
- 🤖 Multi-agent Architecture (LangGraph)

### Multi-Agent Architecture
- 🧠 **Main Agent (Supervisor/Orchestrator)**
  - Single Point of Contact - Mọi tương tác bắt đầu và kết thúc tại đây
  - Intent Classification - Phân loại ý định user (Tư vấn? Đặt lịch? Tìm kiếm thông tin?)
  - Context-Aware Routing - Điều phối đến đúng Sub-Agent với context đầy đủ
  - Response Synthesis - Tổng hợp và làm mượt câu trả lời từ Sub-Agents
  - Quality Control - Đánh giá và từ chối câu trả lời không đạt chất lượng

- 🏥 **Medical/Triage Agent (Semi-Autonomous)**
  - Chẩn đoán sơ bộ dựa trên triệu chứng
  - Internal RAG Search - Tra cứu kiến thức nội bộ trước
  - Confidence Check - Tự động gọi Research Agent nếu confidence < 80%
  - Solution Expansion - Tìm mẹo chăm sóc và video hướng dẫn

- 🔍 **Research Agent (Web Researcher)**
  - **Vai trò:** Chuyên gia tìm kiếm thông tin Internet (Web Researcher)
  - **Web Search Strategy:** Sử dụng Search Engine (Tavily/DuckDuckGo) để tìm kiếm real-time
  - **Phục vụ Main Agent:** Khi user cần thông tin chung, tin tức, kiến thức bên ngoài
  - **Phục vụ Medical Agent:** Khi cần tra cứu bệnh lạ, tìm bài viết y khoa mới nhất, biện pháp sơ cứu
  - **Use Cases:**
    - Tìm kiếm bài viết y khoa và tài liệu tham khảo uy tín
    - Tìm mẹo chăm sóc, kinh nghiệm từ chuyên gia (Tips & Tricks)
    - Tìm video hướng dẫn trên YouTube
    - Tra cứu home remedies và biện pháp dân gian
  - **Video Integration:** Tự động tìm và nhúng link YouTube videos vào câu trả lời
  - **Attribution Required:** Bắt buộc trích dẫn nguồn (URL) cho mọi thông tin tìm được

- 📅 **Booking Agent**
  - Xử lý đặt lịch khám
  - Kiểm tra slot trống
  - Hủy lịch hẹn

### AI Tools (FastMCP Protocol)
- 🔧 `create_booking` - Chọn service và tạo lịch hẹn tự động
- 🔧 `search_symptoms` - Tìm bệnh dựa trên triệu chứng
- 🔧 `RAG_search` - Tra cứu thông tin y tế

### Admin Tool Management
- 📊 **Tool Scanner** - Tự động quét và đồng bộ Code-based tools từ Python (@mcp.tool)
- 📊 **Tool Assignment** - Gán tools cho specific agents (Main Agent hoặc Sub-Agents)
- 📊 **Schema Viewer** - Xem Request/Response schema cho mỗi tool
- 📊 **Tool Enable/Disable** - Bật/tắt tools cho từng agent

### Agent Architecture
- 🏗️ **Hierarchical Agent System** - Main Agent (Supervisor) + Sub-Agents (Workers)
- 🏗️ **Main Agent (Supervisor)** - Intent Classification, Context-Aware Routing, Response Synthesis
- 🏗️ **Sub-Agents** - Booking Agent, Medical/Triage Agent, Research Agent
- 🏗️ **Semi-Autonomous Flow** - Medical Agent tự động gọi Research Agent khi confidence thấp
- 🏗️ **State Management** - Main Agent quản lý toàn bộ conversation context


### Monitoring & Debugging
- 🔍 **Agent Playground** - Test agents trong môi trường an toàn
- 🔍 **Flow Visualization** - Xem hierarchical execution flow (Main → Sub-Agent → Tool calls)
- 🔍 **Thinking Process Log** - Xem quá trình suy luận của agents
- 🔍 **Citation Tracking** - Theo dõi nguồn trích dẫn (RAG chunks + Web URLs)
- 🔍 **Response Feedback** - Đánh giá chất lượng câu trả lời (Good/Bad)

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


## 🔑 KEY FEATURES SUMMARY

✅ **Clinic-based vets** (NO freelancers)  
✅ **Shared EMR** (All clinics see medical history)  
✅ **Shared vaccination records** (Across clinics)  
✅ **Dynamic pricing** (Base + fees)  
✅ **Hybrid Service Model** (Master Services + Custom Services)
✅ **Slot management** (Auto reduce/restore)  
✅ **Excel import** (Batch schedule)  
✅ **Manual import** (Thêm lịch thủ công)  
✅ **Multiple appointment types** (IN_CLINIC, HOME_VISIT)  
✅ **Booking workflow** (PENDING → ASSIGNED → CONFIRMED → CHECK_IN -> IN_PROGRESS → CHECK_OUT/COMPLETED)  
✅ **Rating system** (Pet owner đánh giá Dr)  
✅ **AI Chatbot** (Pet Care Assistant với Multi-agent Architecture)  
✅ **SOS Emergency** (Cấp cứu khẩn cấp)  
✅ **Video Consultation** (Tư vấn từ xa)  
✅ **EMR với đơn thuốc** (Prescription trong hồ sơ bệnh án)  
✅ **Push/Email/SMS Notifications** (Firebase)  
✅ **Multi-language & Timezone** (Đa ngôn ngữ)  
✅ **Admin Agent Management Dashboard** (Quản lý, Tinh chỉnh & Giám sát Agents)  
✅ **Dynamic Few-Shot Routing** (Zero Training, Cross-lingual)  
✅ **Tool Management** (Code-based Tools only)  
✅ **Knowledge Base RAG** (Qdrant Cloud với Binary Quantization)  
✅ **Agent Playground** (Interactive Testing & Debugging)  
✅ **Dynamic Secrets Management** (API Keys, Ollama Config)

---

## 🛠️ TECH STACK (Reference)

| Layer | Technologies |
|-------|-------------|
| **Web Frontend** | React 18+ Vite, TypeScript, Tailwind CSS, Zustand |
| **Mobile** | Flutter 3.5, iOS & Android |
| **Backend** | Java 21, Spring Boot 3.x, Spring Security (JWT) |
| **AI Layer** | Python 3.12, FastAPI, LangGraph, FastMCP, LlamaIndex |
| **Databases** | PostgreSQL, MongoDB, Redis, Qdrant (Vector) |
| **Infrastructure** | Docker, Cloudinary, GitHub Actions |
| **Payment** | Stripe | 
| **Notifications** | Firebase (Push), Email, SMS |

---

**Version: 7.0 - PETTIES COMPREHENSIVE FEATURES + AI AGENT MANAGEMENT**  
**Status: ✅ READY FOR DEV**  
**Total Features: 90+ (V0.0.1)**  
**Last Updated: December 6, 2025**
