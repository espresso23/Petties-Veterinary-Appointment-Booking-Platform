# 🐾 Petties - Veterinary Appointment Booking Platform

**Petties** là một nền tảng hiện đại kết nối chủ nuôi thú cưng với bác sĩ thú y chuyên nghiệp, cung cấp dịch vụ đặt lịch tham khám tại nhà hoặc tại phòng khám một cách dễ dàng và an toàn.

---

## 📋 Thông Tin Dự Án

| Thông Tin | Chi Tiết |
|-----------|---------|
| **Tên Dự Án** | Petties: Veterinary Appointment Booking Platform |
| **Viết Tắt** | PVABP |
| **Lớp** | CP_SEP490 |
| **Thời Gian** | 05/01/2026 - 30/04/2026 |
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

- ❌ Khó tìm bác sĩ thú y có dịch vụ thăm nhà
- ❌ Quy trình đặt lịch phức tạp, quản lý nhiều pet không tiện
- ❌ Không có thông báo định kỳ về tình trạng sức khỏe
- ❌ Thanh toán trực tuyến chưa an toàn

### Mục Tiêu Giải Pháp
- ✅ Cung cấp nền tảng đặt lịch tham khám tại nhà từ bác sĩ thú y
- ✅ Hỗ trợ đặt lịch thực thời và quản lý appointment giữa chủ pet và bác sĩ
- ✅ Bác sĩ quản lý lịch biểu, cài đặt giá cước, theo dõi doanh thu
- ✅ Thanh toán trực tuyến an toàn và bảo mật
- ✅ Admin dashboard giám sát appointment, người dùng và giao dịch
- ✅ Tối ưu UX: thông báo, nhắc nhở, tips chăm sóc thú cưng

---

## 🛠️ Tech Stack

### Frontend
```
┌─────────────────────────────────────┐
│         WEB FRONTEND                │
│  - React 18+ + Vite                │
│  - TypeScript                       │
│  - Tailwind CSS                     │
│  - React Router v7                  │
│  - Zustand (State Management)       │
│  - Axios (HTTP Client)              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       MOBILE FRONTEND               │
│  - Flutter 3.5                      │
│  - iOS & Android Support           │
│  - Provider (State Management)      │
│  - Google Maps Integration          │
│  - Firebase Messaging (Push)        │
└─────────────────────────────────────┘
```

### Backend
```
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  - Java 21                          │
│  - Spring Boot 3.x                  │
│  - Spring Data JPA                  │
│  - Spring Security (JWT)            │
│  - RESTful API Architecture         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         DATABASES                   │
│  - PostgreSQL (Relational Data)    │
│  - MongoDB (NoSQL, Flexible Data)  │
│  - Redis (Caching)                 │
└─────────────────────────────────────┘
```

### AI & Data Processing
```
┌─────────────────────────────────────┐
│      AI LAYER (Python)              │
│  - Python 3.14                      │
│  - FastAPI + Uvicorn                │
│  - LangGraph (Multi-agent)          │
│  - Ollama (Local LLM)               │
│  - LlamaIndex (RAG)                 │
│  - OpenAI Embedding Model           │
│  - Qdrant (Vector Database)         │
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
- Chọn loại dịch vụ: **Home Visit** hoặc **Clinic Visit**
- Tìm kiếm bác sĩ theo chuyên khoa, khoảng cách, đánh giá
- Xem lịch trống của bác sĩ
- Thanh toán trực tuyến ngay khi đặt

### 4️⃣ Cấp Cứu (SOS)
- Xác định bác sĩ thú y khẩn cấp gần nhất
- Liên hệ tức thì cho tư vấn
- Đặt lịch khẩn cấp

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

### 9️⃣ Dashboard Bác Sĩ/Phòng Khám
- Quản lý lịch biểu
- Duyệt request từ chủ pet
- Quản lý nhân viên, ca làm việc
- Theo dõi doanh thu

### 🔟 Đánh Giá & Nhận Xét
- Chủ pet đánh giá bác sĩ (1-5 sao)
- Viết nhận xét chi tiết
- Xây dựng uy tín cho bác sĩ

### 🔐 Thêm Tính Năng Đặc Biệt
- **AI Chatbot**: Trợ lý chăm sóc pet thông minh
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
         ┌───────────────▼────────────────┐
         │    API GATEWAY / LOAD BALANCER │
         │    (Port 8080 / 8443)          │
         └───────────────┬────────────────┘
                         │
┌────────────────────────┼────────────────────────┐
│                  BACKEND SERVICES               │
│                                                  │
│  ┌─────────────────────────────────────┐       │
│  │ Spring Boot API Server              │       │
│  │ ├─ Authentication Service           │       │
│  │ ├─ Booking Service                  │       │
│  │ ├─ Pet Management Service           │       │
│  │ ├─ Doctor Service                   │       │
│  │ ├─ Payment Service (Stripe)         │       │
│  │ ├─ Notification Service             │       │
│  │ └─ Admin Dashboard Service          │       │
│  └─────────────────────────────────────┘       │
│                                                  │
│  ┌─────────────────────────────────────┐       │
│  │ AI & Data Processing (Python)       │       │
│  │ ├─ FastAPI Server                   │       │
│  │ ├─ AI Chatbot (LLM)                │       │
│  │ ├─ RAG Engine (LlamaIndex)          │       │
│  │ ├─ Vector Search (Qdrant)          │       │
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
    │   Redis Cache       │
    └─────────────────────┘
         │
    ┌────▼────────────────┐
    │ AWS S3 / Cloudinary │
    │ (Media Storage)     │
    └─────────────────────┘
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Prerequisites
- Node.js 18+ (Web Frontend)
- Java 21 (Backend)
- Python 3.10+ (AI Layer)
- Flutter SDK 3.5+ (Mobile)
- PostgreSQL 14+ & MongoDB 6+
- Docker & Docker Compose

### Web Frontend Setup

```bash
# 1. Clone repo và navigate
cd petties-web

# 2. Cài dependencies
npm install

# 3. Setup Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Start development server
npm run dev

# 5. Open browser
# http://localhost:5173
```

### Backend Setup

```bash
# 1. Navigate to backend folder
cd petties-backend

# 2. Build with Maven
mvn clean install

# 3. Run application
mvn spring-boot:run

# 4. API accessible at
# http://localhost:8080/api
```

### Mobile App Setup

```bash
# 1. Navigate to mobile folder
cd petties_mobile

# 2. Get Flutter packages
flutter pub get

# 3. Run on emulator/device
flutter run

# 4. Build APK
flutter build apk

# 5. Build IPA
flutter build ios
```

### AI Layer Setup

```bash
# 1. Navigate to AI folder
cd petties-ai

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run FastAPI server
uvicorn main:app --reload --port 8000
```

### Docker Deployment

```bash
# 1. Build all services
docker-compose build

# 2. Start all services
docker-compose up -d

# 3. Check logs
docker-compose logs -f

# 4. Stop services
docker-compose down
```

---

## 📁 Project Structure

```
petties/
│
├── petties-web/                    # Web Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── selects/
│   │   │   └── features/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
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
├── petties-backend/                # Spring Boot API
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── com/petties/
│   │   │   │       ├── controller/
│   │   │   │       ├── service/
│   │   │   │       ├── repository/
│   │   │   │       ├── entity/
│   │   │   │       └── dto/
│   │   │   └── resources/
│   │   └── test/
│   ├── pom.xml
│   └── application.yml
│
├── petties-ai/                     # Python AI Layer
│   ├── main.py
│   ├── chatbot/
│   ├── rag/
│   ├── vector_store/
│   ├── requirements.txt
│   └── config.py
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register          - Đăng ký tài khoản
POST   /api/auth/login             - Đăng nhập
POST   /api/auth/logout            - Đăng xuất
POST   /api/auth/refresh-token     - Làm mới token
```

### Pet Management
```
GET    /api/pets                   - Lấy danh sách pet
POST   /api/pets                   - Thêm pet mới
GET    /api/pets/{id}              - Chi tiết pet
PUT    /api/pets/{id}              - Cập nhật pet
DELETE /api/pets/{id}              - Xóa pet
```

### Booking
```
GET    /api/bookings               - Danh sách appointment
POST   /api/bookings               - Tạo appointment mới
GET    /api/bookings/{id}          - Chi tiết appointment
PUT    /api/bookings/{id}          - Cập nhật appointment
POST   /api/bookings/{id}/cancel   - Hủy appointment
```

### Doctor
```
GET    /api/doctors                - Danh sách bác sĩ
GET    /api/doctors/available      - Bác sĩ có sẵn
GET    /api/doctors/{id}           - Chi tiết bác sĩ
GET    /api/doctors/{id}/schedule  - Lịch biểu bác sĩ
```

### AI Chatbot
```
POST   /api/chat                   - Gửi tin nhắn
GET    /api/chat/history           - Lịch sử chat
```

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

## 📊 Database Schema

### Key Tables
- `users` - Tài khoản người dùng
- `pets` - Thông tin thú cưng
- `doctors` - Hồ sơ bác sĩ thú y
- `bookings` - Lịch tham khám
- `medical_records` - Hồ sơ bệnh tật
- `prescriptions` - Đơn thuốc
- `payments` - Giao dịch thanh toán
- `notifications` - Thông báo
- `reviews` - Đánh giá và nhận xét

---

## 📈 Deployment

### Production Checklist
- [ ] Build optimized React bundle (`npm run build`)
- [ ] Configure Spring Boot for production
- [ ] Setup PostgreSQL & MongoDB databases
- [ ] Configure AWS S3 for media storage
- [ ] Setup Stripe production keys
- [ ] Enable HTTPS/TLS certificates
- [ ] Configure GitHub Actions CI/CD
- [ ] Setup monitoring & logging
- [ ] Database backup strategy
- [ ] Load testing & performance optimization

### Deployment Platforms
- **Web Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Backend API**: AWS EC2, Heroku, DigitalOcean
- **Databases**: AWS RDS, MongoDB Atlas
- **Mobile**: Apple App Store, Google Play Store

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

- [Frontend Setup Guide](./petties-web/SETUP.md)
- [Backend API Documentation](./petties-backend/API.md)
- [Mobile App Guide](./petties_mobile/README.md)
- [Database Schema](./docs/DATABASE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

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

## 📅 Timeline

| Phase | Thời Gian | Mục Tiêu |
|-------|-----------|---------|
| **Phase 1: Planning & Design** | 05/01 - 31/01/2026 | Requirements, Database Design, Architecture |
| **Phase 2: Core Development** | 01/02 - 28/02/2026 | API, Frontend, Mobile fundamentals |
| **Phase 3: Features & AI** | 01/03 - 31/03/2026 | Advanced features, AI implementation |
| **Phase 4: Testing & Deployment** | 01/04 - 30/04/2026 | Testing, Optimization, Deployment |

---

## 📞 Support & Contact

- **Issues**: Report trên GitHub Issues
- **Email**: tanplqse181717@fpt.edu.vn (Leader)
- **Supervisor**: longnx6@fe.edu.vn (Nguyễn Xuân Long)

---

## 📄 License

Dự án này được phát triển cho mục đích giáo dục tại FPT University.

---

## 🙏 Acknowledgments

- FPT University
- Supervisor: Nguyễn Xuân Long
- Team Members
- Open Source Community

---

**Last Updated**: December 1, 2025
**Version**: 1.0.0
