# 🐾 Petties - Veterinary Appointment Booking Platform

**Petties** là một nền tảng hiện đại kết nối chủ nuôi thú cưng với các **phòng khám thú y** chuyên nghiệp. Chủ pet đặt lịch với phòng khám, phòng khám phân công bác sĩ phù hợp. Cung cấp dịch vụ đặt lịch tham khám tại nhà hoặc tại phòng khám một cách dễ dàng và an toàn.

---

## 📋 Thông Tin Dự Án

| Thông Tin | Chi Tiết |
|-----------|---------|
| **Tên Dự Án** | Petties: Veterinary Appointment Booking Platform |
| **Viết Tắt** | PVABP |
| **Lớp** | CP_SEP490 |
| **Thời Gian** | 05/01/2026 - 30/04/2026 (13 Sprints) |
| **Chuyên Ngành** | Software Engineering |
| **Địa Điểm** | Da Nang |

---

## 👥 Thành Viên Team

### Giáo Viên Hướng Dẫn
- **Nguyễn Xuân Long** - Supervisor
  - ☎️ 0905764750
  - 📧 longnx6@fe.edu.vn

### Thành Viên Nhóm
| STT | Tên | Mã SV | Điện Thoại | Email | Vai Trò |
|-----|-----|-------|-----------|-------|---------|
| 1 | Phạm Lê Quốc Tân | SE181717 | 0931600767 | tanplqse181717@fpt.edu.vn | Leader |
| 2 | Nguyễn Đức Tuấn | DE180807 | 0767007284 | tuanndde180807@fpt.edu.vn | Member |
| 3 | Vũ Minh Triết | DE180687 | 0923131004 | trietvmde180687@fpt.edu.vn | Member |
| 4 | Lưu Đặng Diệu Huyền | DE180773 | 0886998759 | huyenlddde180773@fpt.edu.vn | Member |
| 5 | Lê Phương Uyên | DE180893 | 0372395933 | uyenlpde180893@fpt.edu.vn | Member |

---

## 🎯 Mục Tiêu Dự Án

### Vấn Đề Cần Giải Quyết
Chủ nuôi thú cưng thường gặp khó khăn khi cần chăm sóc sức khỏe cho pet:

- ❌ Khó tìm phòng khám thú y có dịch vụ thăm nhà
- ❌ Khó so sánh dịch vụ và giá cả giữa các phòng khám
- ❌ Quy trình đặt lịch phức tạp, quản lý nhiều pet không tiện
- ❌ Không có thông báo định kỳ về tình trạng sức khỏe
- ❌ Thanh toán trực tuyến chưa an toàn

### Mục Tiêu Giải Pháp
- ✅ Cung cấp nền tảng đặt lịch tham khám với **phòng khám thú y** (Clinic-centric)
- ✅ Tìm kiếm và so sánh phòng khám theo dịch vụ, giá cả, đánh giá
- ✅ Phòng khám phân công bác sĩ phù hợp sau khi nhận booking
- ✅ Hỗ trợ đặt lịch thực thời: **Home Visit** hoặc **Clinic Visit**
- ✅ Phòng khám quản lý bác sĩ, lịch biểu, giá cước, doanh thu
- ✅ Thanh toán trực tuyến an toàn và bảo mật
- ✅ Admin dashboard giám sát appointment, người dùng và giao dịch
- ✅ Tối ưu UX: thông báo, nhắc nhở, tips chăm sóc thú cưng

---

## 🛠️ Tech Stack

### Frontend
```
┌─────────────────────────────────────┐
│         WEB FRONTEND                │
│  - React 19 + Vite                  │
│  - TypeScript                       │
│  - Tailwind CSS v4                  │
│  - React Router v7                  │
│  - Zustand (State Management)       │
│  - Axios (HTTP Client)              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       MOBILE FRONTEND               │
│  - Flutter 3.5                      │
│  - iOS & Android Support            │
│  - Provider (State Management)      │
│  - GoRouter (Navigation)            │
│  - Role-based Routing               │
│  - Firebase Messaging (Push)        │
└─────────────────────────────────────┘
```

### Backend
```
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  - Java 21                          │
│  - Spring Boot 4.0.0                │
│  - Spring Data JPA                  │
│  - Spring Security 6.x (JWT)        │
│  - Spring Boot Actuator             │
│  - RESTful API Architecture         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         DATABASES                   │
│  - PostgreSQL 16 (Relational Data) │
│  - MongoDB 7 (NoSQL, Flexible Data)│
│  - Qdrant Cloud (Vector Database)  │
│  - Redis (Caching - Optional)      │
└─────────────────────────────────────┘
```

### AI & Data Processing
```
┌─────────────────────────────────────┐
│      AI LAYER (Python)              │
│  - Python 3.12                      │
│  - FastAPI + Uvicorn                │
│  - LangGraph (Multi-agent)          │
│  - Ollama (Hybrid: Local/Cloud)     │
│  - LlamaIndex (RAG)                 │
│  - Qdrant Cloud (Vector Database)   │
│  - FastMCP (Protocol)               │
└─────────────────────────────────────┘
```

### DevOps & Infrastructure
```
┌─────────────────────────────────────┐
│      DEPLOYMENT & STORAGE           │
│  - AWS S3 / Cloudinary (CDN)       │
│  - Docker & Docker Compose          │
│  - GitHub (Version Control)         │
│  - GitHub Actions (CI/CD)           │
│  - Stripe (Payment Gateway)         │
│  - Firebase (Notifications)         │
└─────────────────────────────────────┘
```

---

## 📱 Features Chính

### 1️⃣ Quản Lý Thông Tin Pet
- Thêm/sửa/xóa profile thú cưng
- Lưu ảnh, giống, độ tuổi, đặc điểm thể chất
- Lịch sử tiêm chủng (Vaccination Tracker)

### 2️⃣ Hệ Thống Hồ Sơ Bệnh Án Điện Tử (EMR)
- Lưu trữ tập trung lịch sử bệnh tật
- Các bác sĩ có thể cập nhật từ xa
- Truy cập bất kỳ lúc nào, bất kỳ nơi đâu

### 3️⃣ Đặt Lịch Tham Khám
- Tìm kiếm **phòng khám** (Clinic) theo dịch vụ, khoảng cách, đánh giá
- Chọn loại dịch vụ: **Home Visit** hoặc **Clinic Visit**
- Xem lịch trống của phòng khám
- Clinic sẽ phân công bác sĩ phù hợp sau khi đặt
- Thanh toán trực tuyến ngay khi đặt

### 4️⃣ Cấp Cứu (SOS)
- Tìm phòng khám thú y khẩn cấp gần nhất
- Liên hệ tức thì với phòng khám để được tư vấn
- Đặt lịch khẩn cấp với phòng khám

### 5️⃣ Tư Vấn Video
- Gọi video trực tiếp với bác sĩ
- Chẩn đoán từ xa
- Lưu lại video để xem lại

### 6️⃣ Đơn Thuốc Điện Tử (e-Rx)
- Bác sĩ lập đơn thuốc kỹ thuật số
- Lưu vào hồ sơ bệnh của pet
- Chia sẻ với chủ pet

### 7️⃣ Thông Báo & Nhắc Nhở
- Thông báo appointment sắp tới
- Nhắc nhở lịch uống thuốc
- Email, SMS, Push notification

### 8️⃣ Dashboard Admin
- Theo dõi tất cả appointment
- Thống kê người dùng và giao dịch
- Báo cáo doanh thu

### 9️⃣ Dashboard Bác Sĩ (VET) - Mobile + Web
- Xem lịch làm việc được gán
- Xem booking được phân công từ Clinic
- Phê duyệt/từ chối booking
- Check-in/Check-out bệnh nhân
- Ghi chú hồ sơ bệnh án (EMR)
- Ghi đơn thuốc điện tử

### 9️⃣.1 Dashboard Phòng Khám (CLINIC_OWNER/CLINIC_MANAGER) - Web Only
- **CLINIC_OWNER**: Quản lý phòng khám, thêm CLINIC_MANAGER
- **CLINIC_MANAGER**: Quản lý bác sĩ (VET), phân công booking
- Quản lý lịch biểu và ca làm việc
- Duyệt request từ chủ pet
- Theo dõi doanh thu và thống kê

### 🔟 Đánh Giá & Nhận Xét
- Chủ pet đánh giá **phòng khám (Clinic)** và **bác sĩ (Vet)** (1-5 sao)
- Viết nhận xét chi tiết
- Xây dựng uy tín cho phòng khám và bác sĩ

### 🔐 Thêm Tính Năng Đặc Biệt
- **AI Chatbot**: Trợ lý chăm sóc pet thông minh với Multi-Agent Architecture
- **Admin Dashboard**: Quản lý AI Agents, Tools, Knowledge Base
- **Định giá động**: Tính giá dựa trên khoảng cách
- **Đa ngôn ngữ**: Hỗ trợ nhiều ngôn ngữ và múi giờ
- **Analytics**: Báo cáo chi tiết cho quản trị viên

---

## 📊 Kiến Trúc Hệ Thống

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  ┌─────────────────┐         ┌──────────────────┐           │
│  │ WEB FRONTEND    │         │ MOBILE APP       │           │
│  │ React + Vite    │         │ Flutter 3.5      │           │
│  │ (Browser)       │         │ (iOS/Android)    │           │
│  └────────┬────────┘         └────────┬─────────┘           │
└───────────┼────────────────────────────┼────────────────────┘
            │                            │
            └────────────┬───────────────┘
                         │
┌────────────────────────┼────────────────────────┐
│                  BACKEND SERVICES               │
│                                                  │
│  ┌─────────────────────────────────────┐       │
│  │ Spring Boot API Server (Port 8080)  │       │
│  │ ├─ Authentication Service           │       │
│  │ ├─ Booking Service                  │       │
│  │ ├─ Pet Management Service           │       │
│  │ ├─ Vet Service                      │       │
│  │ ├─ Payment Service (Stripe)         │       │
│  │ ├─ Notification Service             │       │
│  │ └─ Admin Dashboard Service          │       │
│  └─────────────────────────────────────┘       │
│                                                  │
│  ┌─────────────────────────────────────┐       │
│  │ AI Agent Service (Port 8000)        │       │
│  │ ├─ FastAPI Server                   │       │
│  │ ├─ Multi-Agent System (LangGraph)   │       │
│  │ │  ├─ Main Agent (Supervisor)       │       │
│  │ │  ├─ Booking Agent                 │       │
│  │ │  ├─ Medical Agent                 │       │
│  │ │  └─ Research Agent                │       │
│  │ ├─ RAG Engine (LlamaIndex)          │       │
│  │ ├─ Vector Search (Qdrant Cloud)     │       │
│  │ ├─ Tool Registry (FastMCP)          │       │
│  │ └─ WebSocket Orchestrator           │       │
│  └─────────────────────────────────────┘       │
│                                                  │
└────────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼────┐                  ┌──────▼──────┐
    │PostgreSQL│                  │  MongoDB    │
    │(Primary) │                  │ (Document) │
    └──────────┘                  └────────────┘
         │
    ┌────▼────────────────┐
    │   Qdrant Cloud      │
    │ (Vector Database)   │
    └─────────────────────┘
         │
    ┌────▼────────────────┐
    │ Ollama (Hybrid)     │
    │ Local / Cloud LLM   │
    └─────────────────────┘
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Prerequisites
- Node.js 18+ (Web Frontend)
- Java 21 (Backend)
- Python 3.12+ (AI Layer)
- Flutter SDK 3.5+ (Mobile)
- PostgreSQL 16+ & MongoDB 7+
- Docker & Docker Compose
- Ollama (Optional - for local LLM mode)

### Web Frontend Setup

```bash
# 1. Navigate to web folder
cd petties-web

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open browser
# http://localhost:5173

# 5. Build for production
npm run build
```

### Backend Setup

```bash
# 1. Navigate to backend folder
cd backend-spring/petties

# 2. Build with Maven
mvn clean install

# 3. Run application
mvn spring-boot:run

# 4. API accessible at
# http://localhost:8080/api
# Health check: http://localhost:8080/api/actuator/health
```

### Mobile App Setup

```bash
# 1. Navigate to mobile folder
cd petties_mobile

# 2. Get Flutter packages
flutter pub get

# 3. Run on emulator/device
flutter run

# 4. Build APK (Android)
flutter build apk

# 5. Build IPA (iOS)
flutter build ios

# Note: Mobile app supports role-based routing:
# - PET_OWNER: Mobile only
# - VET: Web + Mobile
# - CLINIC_OWNER: Web + Mobile
# - ADMIN: Web only (blocked on mobile)
# - CLINIC_MANAGER: Web only (blocked on mobile)
```

### AI Layer Setup

```bash
# 1. Navigate to AI service folder
cd petties-agent-serivce

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run database migrations
alembic upgrade head

# 5. Run FastAPI server
python -m uvicorn app.main:app --reload --port 8000

# 6. Access API docs
# Swagger UI: http://localhost:8000/docs
# Health check: http://localhost:8000/health

# Note: Ollama Configuration
# - Local Mode: Set OLLAMA_BASE_URL=http://localhost:11434 (default)
# - Cloud Mode: Set OLLAMA_API_KEY=sk-... (auto-switches to https://ollama.com)
```

## 🐳 Docker Compose Files

Project sử dụng **3 Docker Compose files** cho các mục đích khác nhau:

### 📁 File Structure

| File | Mục đích | Khi nào dùng |
|------|----------|--------------|
| `docker-compose.db-only.yml` | Chỉ databases (PostgreSQL + MongoDB) | **Development chính**: Chạy Backend/AI Service trực tiếp với hot-reload |
| `docker-compose.dev.yml` | Full stack với Docker (dev mode) | Test toàn bộ stack trong Docker, với hot-reload |
| `docker-compose.prod.yml` | Production test (services only) | Test production build locally trước khi deploy EC2 |

**Lưu ý:** Tất cả Dockerfiles sử dụng **unified multi-stage builds** với `BUILD_ENV` argument (dev/prod).

### 🚀 Quick Start

#### Option 1: Development với Hot-reload (Khuyến nghị)

```bash
# 1. Copy environment variables (if not exists)
cp .env.example .env
# Edit .env với credentials của bạn

# 2. Start databases only
docker-compose -f docker-compose.db-only.yml up -d

# 3. Start services trực tiếp (not in Docker)
# Terminal 1: Backend
cd backend-spring/petties
mvn spring-boot:run

# Terminal 2: AI Service
cd petties-agent-serivce
# Activate virtual environment (if using venv)
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

# Terminal 3: Frontend
cd petties-web
npm run dev

# Terminal 4: Mobile (Optional)
cd petties_mobile
flutter run
```

**Services sẽ chạy tại:**
- PostgreSQL: `localhost:5432`
- MongoDB: `localhost:27017`
- Backend API: `http://localhost:8080` (Health: `/api/actuator/health`)
- AI Service: `http://localhost:8000` (Health: `/health`, Docs: `/docs`)
- Frontend Web: `http://localhost:5173`
- Mobile App: Flutter emulator/device

#### Option 2: Full Docker Development

```bash
# Start all services in Docker (không có hot-reload)
docker-compose -f docker-compose.dev.yml up --build -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

#### Option 3: Production Test Locally

```bash
# Test production build trước khi deploy EC2
docker-compose -f docker-compose.prod.yml up --build

# Note: Cần set environment variables trong .env
# Hoặc pass trực tiếp qua command line
```

### 🔐 Environment Variables

**Quan trọng:** Copy `.env.example` thành `.env` và điền giá trị thực tế:

```bash
cp .env.example .env
# Edit .env với credentials của bạn
```

Xem `.env.example` để biết tất cả environment variables cần thiết.

**Ollama Configuration (Hybrid Mode):**
- **Local Mode (Default)**: 
  - Set `OLLAMA_BASE_URL=http://localhost:11434` (hoặc IP server riêng)
  - Model: `kimi-k2` (hoặc model đã pull về)
  - Cần chạy Ollama server local hoặc self-hosted
- **Cloud Mode (Recommended for Production)**: 
  - Set `OLLAMA_API_KEY=sk-...` (lấy từ https://ollama.com)
  - Auto-switches base URL to `https://ollama.com`
  - Model: `kimi-k2:1t-cloud` (256K context window)
  - Không cần Ollama server local

---

## 📁 Project Structure

### Frontend Best Practices (React + Vite)

The `petties-web` frontend follows modern React best practices:

```
petties-web/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/          # Shared components (Button, Input, Modal)
│   │   ├── features/        # Feature-specific components
│   │   └── selects/         # Custom select components
│   ├── pages/               # Route-based page components
│   ├── layouts/             # Layout wrappers (DashboardLayout, AuthLayout)
│   ├── services/            # API calls and external integrations
│   │   ├── api/            # API client configuration (axios)
│   │   └── endpoints/      # API endpoint functions
│   ├── store/               # State management (Zustand)
│   │   ├── auth.store.ts
│   │   ├── pet.store.ts
│   │   └── booking.store.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePets.ts
│   │   └── useBooking.ts
│   ├── types/               # TypeScript type definitions
│   │   ├── api.types.ts
│   │   ├── models.ts
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── assets/              # Static assets (images, icons)
│   ├── styles/              # Global styles
│   ├── config/              # App configuration
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # Application entry point
├── public/                  # Static public assets
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── Dockerfile               # Production Docker image
└── .dockerignore

Key Frontend Recommendations:
✅ Use functional components with hooks
✅ Implement proper TypeScript types
✅ Use Zustand for global state management
✅ Implement route-based code splitting
✅ Use React Query for server state
✅ Implement proper error boundaries
✅ Use CSS-in-JS or Tailwind CSS consistently
✅ Implement proper loading states
✅ Add proper authentication guards
✅ Use environment variables for API URLs
```

### Backend Structure (Spring Boot)

```
backend-spring/petties/
├── src/
│   ├── main/
│   │   ├── java/com/petties/
│   │   │   ├── PettiesApplication.java
│   │   │   ├── config/              # Configuration classes
│   │   │   │   ├── SecurityConfig.java
│   │   │   │   ├── CorsConfig.java
│   │   │   │   ├── RedisConfig.java
│   │   │   │   └── MongoConfig.java
│   │   │   ├── controller/          # REST Controllers
│   │   │   │   ├── AuthController.java
│   │   │   │   ├── PetController.java
│   │   │   │   ├── BookingController.java
│   │   │   │   └── VetController.java
│   │   │   ├── service/             # Business logic
│   │   │   │   ├── impl/
│   │   │   │   ├── AuthService.java
│   │   │   │   ├── PetService.java
│   │   │   │   └── BookingService.java
│   │   │   ├── repository/          # Data access layer
│   │   │   │   ├── UserRepository.java
│   │   │   │   ├── PetRepository.java
│   │   │   │   └── BookingRepository.java
│   │   │   ├── entity/              # JPA entities
│   │   │   │   ├── User.java
│   │   │   │   ├── Pet.java
│   │   │   │   ├── Booking.java
│   │   │   │   └── Vet.java
│   │   │   ├── dto/                 # Data Transfer Objects
│   │   │   │   ├── request/
│   │   │   │   └── response/
│   │   │   ├── exception/           # Custom exceptions
│   │   │   │   ├── GlobalExceptionHandler.java
│   │   │   │   └── ResourceNotFoundException.java
│   │   │   ├── security/            # Security components
│   │   │   │   ├── JwtTokenProvider.java
│   │   │   │   ├── JwtAuthenticationFilter.java
│   │   │   │   └── UserDetailsServiceImpl.java
│   │   │   └── util/                # Utility classes
│   │   └── resources/
│   │       ├── application.properties
│   │       ├── application-dev.properties
│   │       ├── application-prod.properties
│   │       └── db/migration/        # Flyway migrations
│   └── test/
│       └── java/com/petties/
│           ├── controller/
│           ├── service/
│           └── repository/
├── pom.xml
├── Dockerfile
└── .dockerignore

Key Backend Recommendations:
✅ Use layered architecture (Controller → Service → Repository)
✅ Implement proper exception handling
✅ Use DTOs for request/response
✅ Implement JWT authentication
✅ Use Spring Security for authorization
✅ Implement request validation
✅ Use database migrations (Flyway/Liquibase)
✅ Add comprehensive logging
✅ Implement caching where appropriate
✅ Use connection pooling (HikariCP)
```

### Complete Project Structure

```
petties/
│
├── petties-web/                    # Web Frontend (detailed above)
│
├── petties_mobile/                 # Mobile App
│   ├── lib/
│   │   ├── screens/
│   │   ├── widgets/
│   │   ├── models/
│   │   ├── services/
│   │   ├── providers/
│   │   └── main.dart
│   └── pubspec.yaml
│
├── backend-spring/petties/          # Spring Boot API (detailed above)
│
├── petties-agent-serivce/          # Python AI Layer
│   ├── app/
│   │   ├── main.py                 # FastAPI application
│   │   ├── api/                    # API routes (agents, tools, knowledge, chat, settings)
│   │   ├── core/
│   │   │   ├── agents/             # Multi-agent system (Main, Booking, Medical, Research)
│   │   │   ├── tools/              # Tool registry, executor, MCP integration
│   │   │   └── prompts/            # Prompt templates
│   │   ├── config/                 # Settings & logging
│   │   ├── db/                     # Database models & session
│   │   └── services/               # Business logic
│   ├── alembic/                    # Database migrations
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Unified Dockerfile (dev/prod)
│   └── .dockerignore
│
├── docker-compose.db-only.yml      # Databases only (PostgreSQL + MongoDB)
├── docker-compose.dev.yml          # Full dev stack (databases + services)
├── docker-compose.prod.yml         # Production test (services only)
├── .env.example                    # Environment variables template
├── scripts/                        # Utility scripts
│   ├── create-env-example.py       # Generate .env.example
│   ├── dev-start.bat               # Windows dev start script
│   └── dev-stop.bat                # Windows dev stop script
├── docs-references/                # Technical documentation
│   ├── PETTIES_Features.md         # Feature list
│   ├── TECHNICAL SCOPE PETTIES - AGENT MANAGEMENT.md
│   ├── DEVELOPMENT_WORKFLOW.md
│   └── SETUP_GUIDE.md
└── README.md                       # This file
```

---

## 🐳 Docker Configuration

### Services Architecture

The project uses Docker Compose to orchestrate multiple services:

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| **postgres** | postgres:16-alpine | 5432 | PostgreSQL database for relational data |
| **mongodb** | mongo:7-jammy | 27017 | MongoDB for flexible document storage |
| **backend** | Custom (Java 21, Spring Boot 4.0.0) | 8080 | Spring Boot REST API |
| **ai-service** | Custom (Python 3.12) | 8000 | FastAPI AI Agent Service |
| **Qdrant** | Cloud (External) | - | Vector database for AI embeddings |
| **Ollama** | Local/Cloud (Hybrid) | 11434 | LLM inference (Local or Cloud API) |

**Note:** 
- Qdrant sử dụng Qdrant Cloud (không chạy local)
- Ollama có thể chạy local hoặc dùng Ollama Cloud API
- Web frontend và Mobile app chạy ngoài Docker trong development

### Dockerfile Optimization

All Dockerfiles use multi-stage builds for lightweight production images:

#### Web Frontend Dockerfile
- **Stage 1**: Build with Node.js (dependencies + build)
- **Stage 2**: Serve with Nginx (only production files)
- **Size**: ~25MB (vs ~500MB+ without optimization)
- **Features**: Gzip compression, caching headers, health checks

#### Backend Dockerfile
- **Stage 1**: Build with Maven (compile + package)
- **Stage 2**: Run with JRE (only JAR file)
- **Size**: ~150MB (vs ~350MB+ with full JDK)
- **Features**: Non-root user, optimized JVM settings, health checks

#### AI Service Dockerfile
- **Unified Dockerfile**: Supports both dev and prod via `BUILD_ENV` argument
- **Base**: Python 3.12 slim-bookworm (minimal dependencies)
- **Multi-stage**: Builder stage (install deps) + Runtime stage (minimal)
- **Size**: ~400MB (includes ML libraries)
- **Features**: Non-root user, health checks, hot-reload (dev mode)

### Environment Variables

All services use environment variables for configuration. See `.env.example` for complete list.

### Health Checks

All services implement health checks for Docker Compose readiness:
- **Web**: HTTP check on `/health`
- **Backend**: HTTP check on `/api/actuator/health`
- **AI Service**: HTTP check on `/health`
- **Databases**: Native health check commands

### Volume Management

Persistent data is stored in Docker volumes:
- `postgres_dev_data`: PostgreSQL database (development)
- `mongodb_dev_data`: MongoDB database (development)

**Note:** 
- Qdrant sử dụng Qdrant Cloud (external service, không có local volume)
- Redis không được sử dụng trong current setup (optional)

---

## 🔌 API Endpoints

> **✅ Production URLs:** API endpoints có sẵn tại `https://api.petties.world/api`. Development sử dụng `http://localhost:8080/api`.

### Authentication ✅ (Implemented)
```
POST   /api/auth/register          - Đăng ký tài khoản ✅
POST   /api/auth/login             - Đăng nhập ✅
POST   /api/auth/google            - Đăng nhập bằng Google ✅ (NEW)
POST   /api/auth/logout            - Đăng xuất ✅
POST   /api/auth/refresh           - Làm mới token ✅
GET    /api/auth/me                - Lấy thông tin user hiện tại ✅
```

> 🔐 **Google Sign-In**: Hỗ trợ đăng nhập bằng Google cho cả Mobile và Web.
> - Mobile (Flutter) → Auto-assign role `PET_OWNER`
> - Web (React) → Auto-assign role `CLINIC_OWNER`
> - Xem chi tiết: [`petties_mobile/GOOGLE_SIGNIN_SETUP.md`](petties_mobile/GOOGLE_SIGNIN_SETUP.md)

### Pet Management ⚠️ (Not Yet Implemented)
```
GET    /api/pets                   - Lấy danh sách pet ⚠️
POST   /api/pets                   - Thêm pet mới ⚠️
GET    /api/pets/{id}              - Chi tiết pet ⚠️
PUT    /api/pets/{id}              - Cập nhật pet ⚠️
DELETE /api/pets/{id}              - Xóa pet ⚠️
```

### Booking ⚠️ (Not Yet Implemented)
```
GET    /api/bookings               - Danh sách appointment ⚠️
POST   /api/bookings               - Tạo appointment mới ⚠️
GET    /api/bookings/{id}          - Chi tiết appointment ⚠️
PUT    /api/bookings/{id}          - Cập nhật appointment ⚠️
POST   /api/bookings/{id}/cancel   - Hủy appointment ⚠️
```

### Vet ⚠️ (Not Yet Implemented)
```
GET    /api/vets                   - Danh sách bác sĩ thú y ⚠️
GET    /api/vets/available         - Bác sĩ có sẵn ⚠️
GET    /api/vets/{id}              - Chi tiết bác sĩ ⚠️
GET    /api/vets/{id}/schedule     - Lịch biểu bác sĩ ⚠️
```

### AI Chatbot & Agent Management
```
POST   /api/v1/chat                - Gửi tin nhắn đến AI Agent
GET    /api/v1/chat/history        - Lịch sử chat
WS     /ws/chat/{session_id}       - WebSocket real-time chat
GET    /api/v1/agents              - Danh sách agents
GET    /api/v1/agents/{id}         - Chi tiết agent
PUT    /api/v1/agents/{id}         - Cập nhật agent config
GET    /api/v1/tools               - Danh sách tools
POST   /api/v1/tools/scan          - Scan code-based tools
GET    /api/v1/knowledge           - Knowledge base documents
POST   /api/v1/knowledge/upload    - Upload document
GET    /api/v1/settings            - System settings
PUT    /api/v1/settings            - Update settings
```

---

## 📊 Feature Implementation Status

> **Last Updated:** December 15, 2025  
> **Project Status:** 🔄 Sprint 1 In Progress (62% Complete)
> **Current Sprint:** Sprint 1 - Project Setup, Infrastructure & Authentication

### Overall Progress (Based on WBS)

| Component | Completion | Status | Notes |
|-----------|------------|--------|-------|
| **Backend (Spring Boot)** | 15% | 🔄 In Progress | Auth (JWT, OAuth, Roles) ✅, Password Reset 🔄 |
| **AI Service** | 10% | 🔄 In Progress | Basic setup ✅, LangGraph planned |
| **Web Frontend** | 20% | 🔄 In Progress | Login ✅, Admin Dashboard ✅, Other Dashboards 🔄 |
| **Mobile App** | 25% | 🔄 In Progress | Auth ✅, Routing ✅, Home Screens ✅ |
| **Infrastructure** | 90% | ✅ Ready | CI/CD ✅, Databases ✅, Docker ✅ |

### Detailed Status

#### Backend (Spring Boot) - 15% Complete

| Feature | Status | Notes |
|---------|--------|-------|
| JWT Authentication | ✅ Done | Login, Register, Refresh Token |
| Google OAuth Integration | ✅ Done | Web + Mobile support |
| Role-based Authorization | ✅ Done | 5 Roles: PET_OWNER, VET, CLINIC_MANAGER, CLINIC_OWNER, ADMIN |
| Password Reset Flow | 🔄 In Progress | Forgot password, OTP, Reset |
| User Profile APIs | 🔄 In Progress | Get/Update profile, Avatar upload |
| Pet Management API | ⚠️ Sprint 2 | Planned |
| Booking API | ⚠️ Sprint 4 | Planned |
| Vet API | ⚠️ Sprint 3 | Planned |

#### AI Service (FastAPI) - 30% Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-Agent System | ✅ Done | Main, Booking, Medical, Research |
| Dynamic Config Loader | ✅ Done | DB-based configuration |
| Agent Factory | ✅ Done | Dynamic agent creation |
| Prompt Management | ✅ Done | Versioned prompts in DB |
| Tool System | ✅ Done | Scanner (Code-based only) |
| Ollama Hybrid Mode | ✅ Done | Local/Cloud support |
| RAG Pipeline | 🔄 50% | Qdrant client ✅, Document processing 🔄 |
| Chat API | 🔄 50% | In-memory storage (needs migration) |
| LLM Intent Classification | 🔄 In Progress | AG-04 - LLM + Prompt based |
| WebSocket Streaming | ⚠️ TODO | PG-01 - Critical |

#### Web Frontend (React) - 20% Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Login UI | ✅ Done | Shared login page for all roles |
| Onboarding & Auth Screens | ✅ Done | Welcome, Login, Register with Google |
| Role Protection Components | ✅ Done | ProtectedRoute, RoleGuard |
| Admin Dashboard Layout | ✅ Done | Stats, charts, recent activities |
| Clinic Owner Dashboard Layout | ✅ Done | Clinic stats, revenue overview |
| Clinic Manager Dashboard Layout | 🔄 In Progress | Today bookings, vet schedules |
| Vet Dashboard Layout | 🔄 In Progress | Assigned appointments, schedule view |
| Pet Management UI | ⚠️ Sprint 2 | Planned |
| Booking Flow UI | ⚠️ Sprint 4-5 | Planned |

#### Mobile App (Flutter) - 25% Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Onboarding Screens | ✅ Done | 3 slides introduction |
| Login & Register | ✅ Done | With Google Sign-In |
| Role-based Routing | ✅ Done | GoRouter with role guards |
| Role Restrictions | ✅ Done | ADMIN/CLINIC_MANAGER/CLINIC_OWNER blocked (web only) |
| Pet Owner Home Screen | ✅ Done | Pet cards, quick actions, bottom nav |
| Vet Home Screen | ✅ Done | Today appointments, calendar |
| User Profile Screen | 🔄 In Progress | Avatar, edit info, change password |
| Pet Management | ⚠️ Sprint 2 | Planned |
| Booking Flow | ⚠️ Sprint 4-5 | Planned |

---

## 🎯 Role-Based Access & Platforms

### Platform Support by Role

| Role | Web | Mobile | Notes |
|------|-----|--------|-------|
| **PET_OWNER** | ❌ | ✅ | Mobile only (blocked on web) |
| **VET** | ✅ | ✅ | Web + Mobile |
| **CLINIC_OWNER** | ✅ | ❌ | Web only (blocked on mobile) |
| **CLINIC_MANAGER** | ✅ | ❌ | Web only (blocked on mobile) |
| **ADMIN** | ✅ | ❌ | Web only (blocked on mobile) |

### Authentication & Routing

- **Web**: Role-based routing với React Router v7, Zustand state management
- **Mobile**: Role-based routing với GoRouter, Provider state management, tự động redirect theo role sau khi login
- **Backend**: JWT authentication với Spring Security 6.x
- **Token Management**: Access token + Refresh token với blacklist support
- **Google Sign-In**: OAuth 2.0 integration cho cả Web (React) và Mobile (Flutter)
  - Mobile → Auto-assign `PET_OWNER` role
  - Web → Auto-assign `CLINIC_OWNER` role
  - Chi tiết setup: [`petties_mobile/GOOGLE_SIGNIN_SETUP.md`](petties_mobile/GOOGLE_SIGNIN_SETUP.md)

---

## 🤖 AI Agent Architecture

### Multi-Agent System (LangGraph)

```
User Query
    │
    ▼
┌─────────────────┐
│  Main Agent     │  ← Supervisor (Intent Classification, Routing)
│  (Supervisor)   │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌─────────┐ ┌──────────┐ ┌──────────┐
│Booking  │ │ Medical  │ │ Research │
│ Agent   │ │ Agent    │ │ Agent    │
└─────────┘ └──────────┘ └──────────┘
    │         │            │
    └─────────┴────────────┘
              │
              ▼
    ┌─────────────────┐
    │   Tools (MCP)   │  ← check_slot, RAG_search, web_search, etc.
    └─────────────────┘
```

### Agent Responsibilities

1. **Main Agent (Supervisor)**
   - Intent classification với LLM + Well-crafted Prompts
   - Context-aware routing đến Sub-Agents
   - Response synthesis và quality control
   - State management (conversation context)

2. **Booking Agent**
   - Xử lý đặt lịch khám
   - Kiểm tra slot trống
   - Hủy lịch hẹn
   - Tools: `check_slot`, `create_booking`, `cancel_booking`

3. **Medical Agent (Semi-Autonomous)**
   - Chẩn đoán sơ bộ dựa trên triệu chứng
   - Internal RAG search (knowledge base)
   - Auto-delegate to Research Agent nếu confidence < 80%
   - Tools: `rag_search`, `search_symptoms`

4. **Research Agent (Web Researcher)**
   - Tìm kiếm thông tin trên web (Tavily/DuckDuckGo)
   - Tra cứu bài viết y khoa
   - Tìm video hướng dẫn (YouTube)
   - Bắt buộc trích dẫn nguồn (URL)
   - Tools: `web_search`, `search_youtube_videos`, `extract_web_content`

### Ollama Hybrid Mode

- **Local Mode**: 
  - Ollama server chạy local tại `http://localhost:11434`
  - Model: `kimi-k2` (hoặc model đã pull về)
  - Cần setup Ollama local hoặc self-hosted
- **Cloud Mode (Recommended for Production)**: 
  - Dùng Ollama Cloud API với API key (`https://ollama.com`)
  - Model: `kimi-k2:1t-cloud` (256K context window)
  - Auto-switching khi có `OLLAMA_API_KEY`
  - Không cần Ollama server local
- **Configuration**: Admin có thể config qua Dashboard (không cần restart server)

---

## 🔐 Security

- **JWT Authentication**: Token-based authentication
- **Password Encryption**: bcrypt hashing
- **HTTPS/TLS**: Encrypted communication
- **CORS**: Cross-Origin Resource Sharing configured
- **Rate Limiting**: API throttling
- **Input Validation**: XSS & SQL Injection prevention
- **Role-Based Access Control (RBAC)**: Phân quyền người dùng

---


## 🧪 Testing

```bash
# Frontend Testing
npm run test

# Backend Testing
mvn test

# End-to-End Testing
npm run test:e2e

# Mobile Testing
flutter test
```

---

## 📚 Documentation

- [Setup Guide](./docs-references/SETUP_GUIDE.md) - Chi tiết setup từng service
- [Development Workflow](./docs-references/DEVELOPMENT_WORKFLOW.md) - Quy trình phát triển
- [Features List](./docs-references/PETTIES_Features.md) - Danh sách đầy đủ tính năng
- [AI Agent Management](./docs-references/TECHNICAL%20SCOPE%20PETTIES%20-%20AGENT%20MANAGEMENT.md) - Kiến trúc AI Agent chi tiết
- [Git Workflow](./docs-references/PETTIES_Git_Workflow_TEAM_GUIDE.md) - Git collaboration guide

---

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

---

## 📝 Git Workflow

```bash
# Main branches
main                    # Production release
develop                 # Development branch

# Feature branches
feature/booking         # Feature specific
bugfix/payment-issue    # Bug fixes
hotfix/critical-bug     # Critical fixes
```

---

---

## 🚀 Deployment Status

> **✅ Production Deployed:** Project đã được deploy lên production tại **petties.world**

### Current Environment
- **Development:** Local (localhost)
- **Production:** ✅ Live at petties.world

### Production URLs
| Service | URL |
|---------|-----|
| **Web Frontend** | https://petties.world |
| **Backend API** | https://api.petties.world |
| **AI Service** | https://ai.petties.world |

### Infrastructure
- **Web Frontend:** Vercel
- **Backend/AI Service:** EC2
- **Databases:** Neon (PostgreSQL), MongoDB Atlas, Qdrant Cloud

### Sprint 1 Remaining Tasks (6 Pending)
1. ⏳ Password Reset Flow (Backend - Tuân)
2. ⏳ User Profile APIs (Backend - Tân)
3. ⏳ Clinic Manager Dashboard Layout (Frontend - TânPIC)
4. ⏳ Vet Dashboard Layout (Frontend - TânPIC)
5. ⏳ User Profile Screen (Mobile - Uyên)
6. ⏳ Draft Reports 1, 2, 3 (Docs)

### Sprint 2 Planned (17/12 - 23/12/2025)
- Pet Management (APIs + Mobile UI)
- Clinic Management (APIs + Web UI)
- Service Management
- Admin Approval Flow

---

**Last Updated**: December 15, 2025  
**Version**: 1.0.0 (Production)  
**Current Sprint**: Sprint 1 (62% Complete)  
**Status**: ✅ Deployed at petties.world
