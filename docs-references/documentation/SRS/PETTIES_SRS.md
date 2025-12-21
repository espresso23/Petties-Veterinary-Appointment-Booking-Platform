# PETTIES - Software Requirements Specification (SRS)

**Project:** Petties - Veterinary Appointment Booking Platform  
**Version:** 1.0.0  
**Last Updated:** 2025-12-19  
**Document Status:** In Progress

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Requirements](#2-user-requirements)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Requirement Appendix](#5-requirement-appendix)

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Purpose

**Petties** là nền tảng kết nối chủ thú cưng (Pet Owner) với các phòng khám thú y (Veterinary Clinics). Hệ thống cho phép:

- 🐾 Chủ pet đặt lịch khám tại phòng khám hoặc tại nhà
- 🏥 Phòng khám quản lý dịch vụ, bác sĩ, lịch làm việc
- 👨‍⚕️ Bác sĩ quản lý ca làm, khám bệnh, ghi hồ sơ y tế
- 🤖 AI Chatbot hỗ trợ tư vấn chăm sóc thú cưng
- 📊 Admin quản lý toàn bộ nền tảng

### 1.2 Product Scope

| Aspect | Description |
|--------|-------------|
| **Platform** | Web (Admin, Clinic), Mobile (Pet Owner, Vet) |
| **Target Users** | Pet Owners, Veterinary Clinics, Vets, Admins |
| **Geography** | Vietnam (initial), Southeast Asia (future) |
| **Timeline** | 13 Sprints (10/12/2025 - 11/03/2026) |

### 1.3 Intended Audience

| Audience | Description |
|----------|-------------|
| Developers | Xây dựng và bảo trì hệ thống |
| QA/Testers | Kiểm tra chức năng và chất lượng |
| Product Owners | Theo dõi và ưu tiên requirements |
| Stakeholders | Đánh giá tính khả thi và business value |

### 1.4 Product Overview Diagram (Context Diagram)

```mermaid
flowchart TB
    PO["🐾 Pet Owner<br/>(Mobile)"]
    VET["👨‍⚕️ Vet<br/>(Mobile + Web)"]
    CM["👨‍💼 Clinic Manager<br/>(Web)"]
    CO["🏥 Clinic Owner<br/>(Web)"]
    ADMIN["🔧 Admin<br/>(Web)"]
    
    SYSTEM(("🐾 Petties<br/>System"))
    
    %% Pet Owner flows
    PO -->|"Register, Login, Profile Update"| SYSTEM
    PO -->|"Pet Profile (View EMR + Vaccination)"| SYSTEM
    PO -->|"Search Clinic, Create Booking"| SYSTEM
    PO -->|"Payment (Stripe)"| SYSTEM
    PO -->|"Review, AI Chat, Report Violation"| SYSTEM
    SYSTEM -->|"Booking Confirmation, Notifications"| PO
    SYSTEM -->|"Pet Profile (EMR + Vaccination Records)"| PO
    
    %% Vet flows
    VET -->|"Login, View Schedule"| SYSTEM
    VET -->|"Accept/Reject Booking"| SYSTEM
    VET -->|"Check-in, Create/Edit EMR"| SYSTEM
    VET -->|"Add/Edit Vaccination, Check-out"| SYSTEM
    SYSTEM -->|"Assigned Bookings, Schedules"| VET
    SYSTEM -->|"Pet Profile (EMR + Vaccination, READ-ONLY cross-clinic)"| VET
    
    %% Clinic Manager flows
    CM -->|"Add/Remove Vet"| SYSTEM
    CM -->|"Create Vet Schedule, Import Excel"| SYSTEM
    CM -->|"Assign Vet to Booking"| SYSTEM
    SYSTEM -->|"Vet List, Booking List/Pending Bookings"| CM
    SYSTEM -->|"Schedule Overview"| CM
    
    %% Clinic Owner flows
    CO -->|"Register Clinic"| SYSTEM
    CO -->|"Create/Update Services, Pricing"| SYSTEM
    CO -->|"Add Clinic Manager"| SYSTEM
    SYSTEM -->|"Clinic Status, Revenue Report"| CO
    SYSTEM -->|"Dashboard Analytics"| CO
    
    %% Admin flows
    ADMIN -->|"Login, Approve/Reject Clinic"| SYSTEM
    ADMIN -->|"Configure AI Agents"| SYSTEM
    ADMIN -->|"Manage Knowledge Base, Process Reports"| SYSTEM
    SYSTEM -->|"Pending Clinics, Platform Stats"| ADMIN
    SYSTEM -->|"User Reports, Agent Status"| ADMIN
```

### 1.5 System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB["petties-web<br/>(React + Vite)"]
        MOBILE["petties_mobile<br/>(Flutter)"]
    end
    
    subgraph "Backend Services"
        SPRING["backend-spring<br/>(Spring Boot)"]
        AI["petties-agent-service<br/>(FastAPI + LangGraph)"]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL)]
        MONGO[(MongoDB)]
        REDIS[(Redis)]
        QDRANT[(Qdrant Cloud)]
    end
    
    WEB --> SPRING
    WEB --> AI
    MOBILE --> SPRING
    MOBILE --> AI
    SPRING --> PG
    SPRING --> MONGO
    SPRING --> REDIS
    AI --> PG
    AI --> QDRANT
```

---

## 2. USER REQUIREMENTS

### 2.1 User Roles

| Role | Platform | Description |
|------|----------|-------------|
| **PET_OWNER** | Mobile only | Chủ thú cưng, đặt lịch khám, xem hồ sơ y tế |
| **VET** | Mobile + Web | Bác sĩ thú y, khám bệnh, ghi EMR |
| **CLINIC_MANAGER** | Web only | Quản lý phòng khám, gán booking cho bác sĩ |
| **CLINIC_OWNER** | Web only | Chủ phòng khám, quản lý dịch vụ, doanh thu |
| **ADMIN** | Web only | Admin nền tảng, duyệt phòng khám, quản lý AI |

### 2.2 Use Cases

#### 2.2.1 Pet Owner Use Cases

| UC-ID | Use Case | Priority | Sprint |
|-------|----------|----------|--------|
| UC-PO-01 | Đăng ký / Đăng nhập | High | 1 |
| UC-PO-02 | Đăng nhập bằng Google | High | 1 |
| UC-PO-03 | Quản lý hồ sơ cá nhân | Medium | 2 |
| UC-PO-04 | Tạo/Sửa/Xóa hồ sơ thú cưng | High | 2 |
| UC-PO-05 | Tìm kiếm phòng khám | High | 4 |
| UC-PO-06 | Đặt lịch khám tại phòng (Clinic Visit) | High | 4-6 |
| UC-PO-07 | Đặt lịch khám tại nhà (Home Visit) | High | 4-6 |
| UC-PO-08 | Xem danh sách booking | High | 4 |
| UC-PO-09 | Hủy booking | Medium | 5 |
| UC-PO-10 | Thanh toán online (Stripe) | High | 8 |
| UC-PO-11 | Xem hồ sơ y tế thú cưng (EMR) | Medium | 7 |
| UC-PO-12 | Xem sổ tiêm chủng | Medium | 7 |
| UC-PO-13 | Đánh giá bác sĩ/phòng khám | Low | 9 |
| UC-PO-14 | Chat với AI Chatbot | Medium | 10 |
| UC-PO-15 | SOS - Cấp cứu khẩn cấp | Low | 11 |
| UC-PO-16 | Báo cáo vi phạm Clinic/Vet | Low | 9 |

#### 2.2.2 Vet Use Cases

| UC-ID | Use Case | Priority | Sprint |
|-------|----------|----------|--------|
| UC-VT-01 | Đăng nhập (Account được cấp) | High | 3 |
| UC-VT-02 | Xem lịch làm việc | High | 3 |
| UC-VT-03 | Xem booking được gán | High | 4 |
| UC-VT-04 | Phê duyệt/Từ chối booking | High | 5 |
| UC-VT-05 | Check-in bệnh nhân | High | 6 |
| UC-VT-06 | Ghi hồ sơ bệnh án (EMR) | High | 7 |
| UC-VT-07 | Ghi đơn thuốc | Medium | 7 |
| UC-VT-08 | Cập nhật sổ tiêm chủng | Medium | 7 |
| UC-VT-09 | Checkout bệnh nhân | High | 6 |

#### 2.2.3 Clinic Manager Use Cases

| UC-ID | Use Case | Priority | Sprint |
|-------|----------|----------|--------|
| UC-CM-01 | Đăng nhập | High | 1 |
| UC-CM-02 | Xem danh sách bác sĩ | High | 3 |
| UC-CM-03 | Thêm bác sĩ (gửi email mời) | High | 3 |
| UC-CM-04 | Import lịch bác sĩ từ Excel | Medium | 3 |
| UC-CM-05 | Tạo lịch bác sĩ thủ công | High | 3 |
| UC-CM-06 | Xem booking mới | High | 4 |
| UC-CM-07 | Gán bác sĩ cho booking | High | 5 |
| UC-CM-08 | Quản lý hủy & hoàn tiền | Medium | 8 |

#### 2.2.4 Clinic Owner Use Cases

| UC-ID | Use Case | Priority | Sprint |
|-------|----------|----------|--------|
| UC-CO-01 | Đăng ký phòng khám | High | 2 |
| UC-CO-02 | Quản lý thông tin phòng khám | High | 2 |
| UC-CO-03 | Tạo/Sửa/Xóa dịch vụ | High | 2 |
| UC-CO-04 | Cấu hình giá dịch vụ | High | 2 |
| UC-CO-05 | Xem Dashboard doanh thu | Medium | 9 |
| UC-CO-06 | Thêm Clinic Manager | Medium | 3 |

#### 2.2.5 Admin Use Cases

| UC-ID | Use Case | Priority | Sprint |
|-------|----------|----------|--------|
| UC-AD-01 | Đăng nhập | High | 1 |
| UC-AD-02 | Xem danh sách phòng khám pending | High | 2 |
| UC-AD-03 | Phê duyệt/Từ chối phòng khám | High | 2 |
| UC-AD-04 | Xem thống kê nền tảng | Medium | 9 |
| UC-AD-05 | Quản lý AI Agents | Low | 10 |
| UC-AD-06 | Quản lý Knowledge Base (RAG) | Low | 10 |
| UC-AD-07 | Agent Playground & Debugging | Low | 11 |
| UC-AD-08 | Xem danh sách User Reports | Medium | 9 |
| UC-AD-09 | Xử lý User Report (Warn/Suspend/Ban/Reject) | Medium | 9 |

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 System Functional Overview

#### 3.1.1 Screens Flow

```mermaid
flowchart TB
    subgraph "Mobile App (Pet Owner)"
        M_SPLASH[Splash] --> M_ONBOARD[Onboarding]
        M_ONBOARD --> M_AUTH[Login/Register]
        M_AUTH --> M_HOME[Home]
        M_HOME --> M_PETS[My Pets]
        M_HOME --> M_SEARCH[Search Clinics]
        M_HOME --> M_BOOKINGS[My Bookings]
        M_HOME --> M_CHAT[AI Chat]
        M_SEARCH --> M_CLINIC[Clinic Detail]
        M_CLINIC --> M_BOOKING[Create Booking]
        M_BOOKING --> M_PAYMENT[Payment]
        M_PETS --> M_PET_DETAIL[Pet Detail]
        M_PET_DETAIL --> M_EMR[EMR History]
        M_PET_DETAIL --> M_VACCINE[Vaccination Record]
    end
    
    subgraph "Mobile App (Vet)"
        V_AUTH[Login] --> V_HOME[Dashboard]
        V_HOME --> V_SCHEDULE[My Schedule]
        V_HOME --> V_BOOKINGS[Assigned Bookings]
        V_BOOKINGS --> V_BOOKING_DETAIL[Booking Detail]
        V_BOOKING_DETAIL --> V_CHECKIN[Check-in]
        V_CHECKIN --> V_EMR_CREATE[Create EMR]
        V_EMR_CREATE --> V_CHECKOUT[Check-out]
    end
    
    subgraph "Web App (Clinic)"
        W_AUTH[Login] --> W_DASH[Dashboard]
        W_DASH --> W_SERVICES[Services]
        W_DASH --> W_VETS[Manage Vets]
        W_DASH --> W_SCHEDULE[Vet Schedules]
        W_DASH --> W_BOOKINGS[Bookings]
        W_BOOKINGS --> W_ASSIGN[Assign Vet]
    end
    
    subgraph "Web App (Admin)"
        A_AUTH[Login] --> A_DASH[Dashboard]
        A_DASH --> A_CLINICS[Pending Clinics]
        A_DASH --> A_STATS[Statistics]
        A_DASH --> A_AGENTS[AI Agents]
        A_DASH --> A_KNOWLEDGE[Knowledge Base]
    end
```

#### 3.1.2 Screen Descriptions

##### Mobile App - Pet Owner

| Screen ID | Screen Name | Description |
|-----------|-------------|-------------|
| M-001 | Splash | Logo, loading |
| M-002 | Onboarding | 3 slides giới thiệu app |
| M-003 | Login | Email/Password, Google Sign-in |
| M-004 | Register | Email, Password, OTP verification |
| M-005 | Home | Quick actions, My Pets, Upcoming Bookings |
| M-006 | My Pets | Danh sách thú cưng |
| M-007 | Pet Detail | Thông tin pet, EMR, Vaccination |
| M-008 | Search Clinics | Tìm kiếm theo location, filter |
| M-009 | Clinic Detail | Thông tin, dịch vụ, đánh giá |
| M-010 | Create Booking | Chọn service, date, time slot, pet |
| M-011 | Payment | Stripe checkout / Cash option |
| M-012 | My Bookings | Danh sách booking (tabs: Upcoming, Past) |
| M-013 | Booking Detail | Chi tiết booking, status, actions |
| M-014 | AI Chat | Chat với Pet Care Assistant |
| M-015 | Profile | Thông tin cá nhân, settings |
| M-016 | Notifications | Danh sách thông báo |

##### Mobile App - Vet

| Screen ID | Screen Name | Description |
|-----------|-------------|-------------|
| V-001 | Login | Đăng nhập với account được cấp |
| V-002 | Dashboard | Tổng quan: hôm nay, bookings, schedule |
| V-003 | My Schedule | Calendar view ca làm việc |
| V-004 | Assigned Bookings | Danh sách booking được gán |
| V-005 | Booking Detail | Chi tiết booking, pet info, owner info |
| V-006 | Check-in | Xác nhận pet owner đến |
| V-007 | Create EMR | Form nhập chẩn đoán, điều trị, đơn thuốc |
| V-008 | Check-out | Hoàn thành khám, thu tiền (nếu Cash) |
| V-009 | Profile | Thông tin bác sĩ |

##### Web App - Clinic Owner/Manager

| Screen ID | Screen Name | Description |
|-----------|-------------|-------------|
| W-001 | Login | Đăng nhập |
| W-002 | Register Clinic | Form đăng ký phòng khám |
| W-003 | Dashboard | Tổng quan: bookings hôm nay, doanh thu |
| W-004 | Clinic Profile | Thông tin phòng khám |
| W-005 | Services | CRUD dịch vụ, pricing |
| W-006 | Manage Vets | Danh sách, thêm, xóa bác sĩ |
| W-007 | Vet Schedules | Calendar, import Excel, tạo ca |
| W-008 | Bookings | Danh sách booking, filter by status |
| W-009 | Assign Vet | Popup gán bác sĩ cho booking |
| W-010 | Revenue | Báo cáo doanh thu |

##### Web App - Admin

| Screen ID | Screen Name | Description |
|-----------|-------------|-------------|
| A-001 | Login | Đăng nhập Admin |
| A-002 | Dashboard | Thống kê tổng quan |
| A-003 | Pending Clinics | Danh sách phòng khám chờ duyệt |
| A-004 | Clinic Detail | Chi tiết để review, approve/reject |
| A-005 | Users | Quản lý users |
| A-006 | Statistics | Báo cáo chi tiết |
| A-007 | AI Agents | Quản lý, cấu hình agents |
| A-008 | Knowledge Base | Upload documents, RAG management |
| A-009 | Agent Playground | Test và debug agents |

#### 3.1.3 Screen Authorization

| Screen | PET_OWNER | VET | CLINIC_MANAGER | CLINIC_OWNER | ADMIN |
|--------|:--------:|:--:|:--------------:|:------------:|:-----:|
| **Mobile - Pet Owner** |
| Home, My Pets, Search | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Booking, Payment | ✅ | ❌ | ❌ | ❌ | ❌ |
| My Bookings, EMR, Vaccine | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI Chat | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Mobile - Vet** |
| Vet Dashboard, Schedule | ❌ | ✅ | ❌ | ❌ | ❌ |
| Assigned Bookings | ❌ | ✅ | ❌ | ❌ | ❌ |
| Check-in, EMR, Check-out | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Web - Clinic** |
| Clinic Dashboard | ❌ | ✅ | ✅ | ✅ | ❌ |
| Services | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manage Vets, Schedules | ❌ | ❌ | ✅ | ✅ | ❌ |
| Bookings, Assign Vet | ❌ | ❌ | ✅ | ❌ | ❌ |
| Revenue | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Web - Admin** |
| Admin Dashboard | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pending Clinics | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI Agents, Knowledge Base | ❌ | ❌ | ❌ | ❌ | ✅ |

#### 3.1.4 Non-Screen Functions

| Function ID | Function Name | Description | Trigger |
|-------------|---------------|-------------|---------|
| NSF-001 | Auto Slot Generation | Tự động tạo slots (30 phút) khi tạo VET_SHIFT | Khi CLINIC_MANAGER tạo ca |
| NSF-002 | Booking Status Update | Tự động cập nhật status theo thời gian | Scheduled job |
| NSF-003 | Push Notification | Gửi push notification đến mobile | Event-driven |
| NSF-004 | Email Notification | Gửi email xác nhận, nhắc nhở | Event-driven |
| NSF-005 | OTP Generation | Tạo mã OTP 6 số, lưu Redis (TTL 5 phút) | Registration, Forgot Password |
| NSF-006 | JWT Token Refresh | Tự động refresh access token | Middleware |
| NSF-007 | Token Blacklist | Đưa token vào blacklist khi logout | Logout event |
| NSF-008 | Distance Calculation | Tính khoảng cách cho Home Visit | Khi tạo booking Home Visit |
| NSF-009 | Dynamic Pricing | Tính giá dựa trên base + distance fee | Khi tạo booking |
| NSF-010 | Rating Aggregation | Cập nhật rating_avg của Clinic/Vet | Khi có review mới |
| NSF-011 | AI Chatbot Processing | Xử lý tin nhắn qua Multi-Agent System | User gửi message |
| NSF-012 | RAG Retrieval | Tìm kiếm trong Knowledge Base | AI Chat query |

#### 3.1.5 Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ PET : owns
    USER ||--o{ CLINIC : owns
    USER ||--o{ CLINIC_STAFF : works_as
    USER ||--o{ VET_SHIFT : works
    USER ||--o{ BOOKING : books
    USER ||--o{ REVIEW : writes
    USER ||--o{ NOTIFICATION : receives

    CLINIC ||--o{ CLINIC_STAFF : employs
    CLINIC ||--o{ SERVICE : offers
    CLINIC ||--o{ VET_SHIFT : schedules
    CLINIC ||--o{ BOOKING : receives

    SERVICE ||--o{ BOOKING : used_in

    PET ||--o{ BOOKING : has
    PET ||--o{ EMR : has
    PET ||--o{ VACCINATION : receives

    VET_SHIFT ||--|{ SLOT : contains
    SLOT }o--|| BOOKING : reserved_by

    BOOKING ||--|| PAYMENT : has
    BOOKING ||--o| EMR : generates
    BOOKING ||--o{ REVIEW : has

    EMR ||--o{ PRESCRIPTION : contains
```

#### 3.1.6 Entities Description

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **USER** | Người dùng hệ thống (5 roles) | id, username, email, password, role, avatar |
| **PET** | Thú cưng của Pet Owner | id, owner_id, name, species, breed, birth_date |
| **CLINIC** | Phòng khám thú y | id, owner_id, name, address, phone, status, rating_avg |
| **CLINIC_STAFF** | Nhân viên phòng khám | id, clinic_id, user_id, role (VET/MANAGER), specialization |
| **SERVICE** | Dịch vụ khám | id, clinic_id, name, base_price, duration_minutes, slots_required |
| **VET_SHIFT** | Ca làm việc bác sĩ | id, vet_id, clinic_id, work_date, start_time, end_time |
| **SLOT** | Slot thời gian (30 phút) | id, shift_id, slot_number, start_time, end_time, status |
| **BOOKING** | Lịch hẹn khám | id, pet_id, clinic_id, service_id, assigned_vet_id, booking_date, type, status, total_price |
| **PAYMENT** | Thanh toán | id, booking_id, amount, method, status, stripe_payment_id |
| **EMR** | Hồ sơ bệnh án điện tử | id, booking_id, pet_id, vet_id, diagnosis, treatment_plan |
| **PRESCRIPTION** | Đơn thuốc | id, emr_id, medicine_name, dosage, frequency, duration_days |
| **VACCINATION** | Tiêm chủng | id, pet_id, vet_id, vaccine_name, vaccination_date, next_due_date |
| **REVIEW** | Đánh giá | id, booking_id, reviewer_id, type (VET/CLINIC), rating, comment |
| **NOTIFICATION** | Thông báo | id, user_id, title, content, is_read |

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 External Interfaces

#### 4.1.1 User Interfaces

| Platform | Technology | Description |
|----------|------------|-------------|
| Web Frontend | React 19 + Vite + TypeScript | Admin, Clinic Owner, Clinic Manager dashboards |
| Mobile App | Flutter 3.5 | Pet Owner, Vet mobile apps (iOS + Android) |

#### 4.1.2 Hardware Interfaces

| Interface | Description |
|-----------|-------------|
| GPS/Location | Mobile app dùng GPS để tìm clinic gần nhất |
| Camera | Upload ảnh pet, chứng chỉ |
| Push Notification | Firebase Cloud Messaging |

#### 4.1.3 Software Interfaces

| Interface | Provider | Purpose |
|-----------|----------|---------|
| Stripe API | Stripe | Payment processing |
| Google Sign-In | Google | OAuth authentication |
| Firebase | Google | Push notifications, analytics |
| OpenRouter API | OpenRouter | LLM inference (Cloud) |
| Cohere API | Cohere | Text embeddings (Cloud) |
| Qdrant Cloud | Qdrant | Vector database |
| DuckDuckGo Search | DuckDuckGo | Web search for AI (free) |
| Gmail SMTP | Google | Email notifications |
| Cloudinary | Cloudinary | Image storage & CDN |

#### 4.1.4 Communication Interfaces

| Protocol | Usage |
|----------|-------|
| HTTPS | All API calls |
| WSS | WebSocket for real-time chat |
| SMTP | Email sending |
| FCM | Push notifications |

### 4.2 Quality Attributes

#### 4.2.1 Usability

| Requirement | Target | Metric |
|-------------|--------|--------|
| Learnability | Users can complete basic tasks within 5 minutes | First-time task completion rate > 80% |
| Accessibility | WCAG 2.1 Level AA compliance | Pass automated accessibility tests |
| Mobile UX | Intuitive touch navigation | Touch target size ≥ 44px |
| Error Messages | Clear, actionable error messages | Vietnamese language support |
| Loading States | Visual feedback during operations | All async operations show loading indicators |

#### 4.2.2 Reliability

| Requirement | Target | Metric |
|-------------|--------|--------|
| Availability | 99.5% uptime | Monthly uptime percentage |
| MTBF (Mean Time Between Failures) | > 720 hours | Failure tracking |
| MTTR (Mean Time To Recovery) | < 1 hour | Incident response time |
| Data Backup | Daily automated backups | Backup success rate 100% |
| Failover | Auto-restart on crash | Docker restart policy: unless-stopped |

#### 4.2.3 Performance

| Requirement | Target | Metric |
|-------------|--------|--------|
| API Response Time | < 200ms (95th percentile) | Server-side latency |
| Page Load Time | < 3 seconds (FCP) | Lighthouse performance score |
| Database Query | < 100ms | Query execution time |
| Concurrent Users | 1000+ simultaneous | Load testing with k6 |
| Mobile App Size | < 50MB (APK) | Bundle size |

#### 4.2.4 Maintainability and Continuous Integration

| Requirement | Description |
|-------------|-------------|
| Version Control | Git with GitHub, branching strategy (main/develop/feature) |
| CI/CD Pipeline | GitHub Actions for automated testing and deployment |
| Documentation | README, API docs (Swagger), Code comments |
| Modularity | Microservices architecture (Backend + AI Service) |
| Logging | Structured logging với Loguru (Python), SLF4J (Java) |
| Monitoring | Docker healthchecks, Actuator endpoints |

#### 4.2.5 Code Quality and Testability

| Requirement | Target | Tools |
|-------------|--------|-------|
| Test Coverage | > 70% | JaCoCo (Java), pytest-cov (Python) |
| Unit Tests | All business logic | JUnit 5 (Java), pytest (Python) |
| Integration Tests | API endpoints | MockMvc (Spring), TestClient (FastAPI) |
| E2E Tests | Critical user flows | Playwright, Flutter integration tests |
| Code Quality | No critical issues | SonarQube (optional) |
| Linting | Consistent code style | ESLint (TS), Black (Python), Checkstyle (Java) |

---

## 5. REQUIREMENT APPENDIX

### 5.1 Business Rules

#### BR-001: Booking Rules

| Rule ID | Rule Description |
|---------|-----------------|
| BR-001-01 | Booking phải được tạo ít nhất 2 giờ trước giờ hẹn |
| BR-001-02 | Pet Owner chỉ được hủy booking trước giờ hẹn 4 giờ |
| BR-001-03 | Booking type HOME_VISIT yêu cầu địa chỉ nhà |
| BR-001-04 | Distance fee = 5,000 VND / km (từ km thứ 3) |
| BR-001-05 | Mỗi service có slots_required (mặc định 1 slot = 30 phút) |

#### BR-002: Payment Rules

| Rule ID | Rule Description |
|---------|-----------------|
| BR-002-01 | Online payment phải hoàn thành trước khi booking confirmed |
| BR-002-02 | Cash payment được thu tại checkout |
| BR-002-03 | Refund chỉ áp dụng cho booking hủy trước 24 giờ |
| BR-002-04 | Refund 100% cho online payment, 0% cho cash |

#### BR-003: User Account Rules

| Rule ID | Rule Description |
|---------|-----------------|
| BR-003-01 | Email là unique, có thể thay đổi thông qua quy trình xác thực OTP (gửi về email mới) |
| BR-003-02 | Password tối thiểu 8 ký tự, có chữ và số |
| BR-003-03 | OTP có hiệu lực 5 phút, tối đa 5 lần thử |
| BR-003-04 | Vet account được tạo bởi Clinic Manager, không tự đăng ký |
| BR-003-05 | Clinic phải được Admin approve trước khi hoạt động |

#### BR-004: Scheduling Rules

| Rule ID | Rule Description |
|---------|-----------------|
| BR-004-01 | Slot duration = 30 phút (cố định) |
| BR-004-02 | Shift có thể có break time (nghỉ trưa) |
| BR-004-03 | Shift đêm (end < start) = kết thúc ngày hôm sau |
| BR-004-04 | Không thể xóa/sửa shift đã có booking |

#### BR-005: EMR Rules (Pet Profile = EMR Central Hub)

> **Core Concept:** Pet Profile là trung tâm lưu trữ tất cả EMR. Mọi Clinic chỉ APPEND EMR mới, không sửa/xóa EMR cũ.

| Rule ID | Rule Description |
|---------|-----------------|
| BR-005-01 | Pet Profile = EMR Central Hub - Tất cả EMR được lưu trực tiếp dưới Pet Profile |
| BR-005-02 | EMR Editable Before COMPLETED - Vet có thể sửa EMR khi booking chưa COMPLETED |
| BR-005-03 | EMR Locked After COMPLETED - Sau khi booking COMPLETED, EMR không thể sửa (Read-Only) |
| BR-005-04 | EMR Read-Only (Cross-Clinic) - Vet từ Clinic khác chỉ READ-ONLY EMR history |
| BR-005-05 | Pet Owner Ownership - Pet Owner sở hữu Pet Profile → sở hữu toàn bộ EMR history |

#### BR-006: Vaccination Rules (Sổ Tiêm Chủng)

> **Core Concept:** Sổ tiêm chủng thuộc về Pet (Pet Profile). Có thể thêm vaccination mới bất kỳ lúc nào, nhưng record cũ đã COMPLETED thì không sửa được.

| Rule ID | Rule Description |
|---------|-----------------|
| BR-006-01 | Vaccination thuộc về Pet - Sổ tiêm lưu trực tiếp dưới Pet Profile |
| BR-006-02 | Có thể thêm mới - Vet có thể thêm vaccination mới vào sổ tiêm bất kỳ lúc nào |
| BR-006-03 | Editable Before COMPLETED - Vaccination record có thể sửa khi booking chưa COMPLETED |
| BR-006-04 | Locked After COMPLETED - Sau khi COMPLETED, record không thể sửa |
| BR-006-05 | Read-Only (Cross-Clinic) - Vet từ Clinic khác chỉ xem, không sửa |
| BR-006-06 | Next Due Date - Hệ thống tự tính ngày tiêm tiếp theo dựa trên loại vaccine |
| BR-006-07 | Reminder Notification - Gửi thông báo nhắc Pet Owner trước ngày tiêm 7 ngày |

#### BR-007: User Report Rules (Báo cáo Vi phạm)

> **Core Concept:** Pet Owner/Clinic có thể báo cáo vi phạm. Admin xem xét và xử lý.

| Rule ID | Rule Description |
|---------|-----------------|
| BR-007-01 | Pet Owner có thể báo cáo Clinic/Vet vi phạm sau booking COMPLETED |
| BR-007-02 | Clinic Manager có thể báo cáo Pet Owner vi phạm (NO_SHOW, hành vi xấu) |
| BR-007-03 | Report types: SPAM, INAPPROPRIATE, FRAUD, NO_SHOW, OTHER |
| BR-007-04 | Report status: PENDING (mới tạo) → RESOLVED (đã xử lý) hoặc REJECTED (không hợp lệ) |
| BR-007-05 | Admin actions: NONE (bỏ qua), WARN (cảnh cáo), SUSPEND (tạm khóa), BAN (cấm vĩnh viễn) |
| BR-007-06 | Report từ màn hình: Booking Detail (sau COMPLETED), Clinic/Vet Profile |
| BR-007-07 | Mỗi booking chỉ được report 1 lần |

### 5.2 Common Requirements

#### CR-001: Authentication

- JWT-based authentication với Access Token (24h) và Refresh Token (7 days)
- Access Token: Không lưu (stateless)
- Refresh Token: Lưu PostgreSQL (bảng `refresh_tokens`)
- Blacklisted Token: Lưu PostgreSQL (bảng `blacklisted_tokens`)

#### CR-002: Authorization

- Role-based Access Control (RBAC)
- 5 roles: PET_OWNER, VET, CLINIC_MANAGER, CLINIC_OWNER, ADMIN
- Platform restrictions: PET_OWNER (Mobile only), ADMIN/CLINIC_MANAGER (Web only)

#### CR-003: Data Validation

- Server-side validation required cho tất cả input
- Client-side validation cho UX (không thay thế server-side)
- Vietnamese characters support (UTF-8)

#### CR-004: Timezone

- Default timezone: Asia/Ho_Chi_Minh (UTC+7)
- All timestamps stored in UTC, converted for display

#### CR-005: Language

- Primary language: Vietnamese
- Error messages: Vietnamese
- API responses: Vietnamese hoặc English (configurable)

### 5.3 Application Messages List

#### Error Messages

| Code | Message | Description |
|------|---------|-------------|
| AUTH-001 | "Email hoặc mật khẩu không đúng" | Invalid credentials |
| AUTH-002 | "Token đã hết hạn" | JWT expired |
| AUTH-003 | "Bạn không có quyền truy cập" | Unauthorized access |
| AUTH-004 | "Mã OTP không đúng. Bạn còn {n} lần thử." | Invalid OTP |
| AUTH-005 | "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." | OTP expired |
| AUTH-006 | "Email đã được đăng ký" | Duplicate email |
| BOOK-001 | "Slot đã được đặt" | Slot already booked |
| BOOK-002 | "Không thể hủy booking trong 4 giờ trước giờ hẹn" | Late cancellation |
| BOOK-003 | "Vui lòng chọn thú cưng" | Pet required |
| PAY-001 | "Thanh toán thất bại" | Payment failed |
| PAY-002 | "Không thể hoàn tiền" | Refund failed |
| VAL-001 | "Dữ liệu không hợp lệ" | Validation error |
| SYS-001 | "Có lỗi xảy ra. Vui lòng thử lại sau." | Internal error |

#### Success Messages

| Code | Message | Description |
|------|---------|-------------|
| AUTH-S01 | "Đăng ký thành công" | Registration success |
| AUTH-S02 | "Đăng nhập thành công" | Login success |
| AUTH-S03 | "Đổi mật khẩu thành công" | Password reset success |
| BOOK-S01 | "Đặt lịch thành công" | Booking created |
| BOOK-S02 | "Hủy lịch thành công" | Booking cancelled |
| PAY-S01 | "Thanh toán thành công" | Payment success |

---

**Document Status:** In Progress  
**Version:** 1.0.0  
**Last Updated:** 2025-12-19  
**Author:** Petties Development Team
