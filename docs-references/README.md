# 📚 PETTIES Documentation

Tài liệu tham khảo được tổ chức theo từng nhóm nội dung để dễ dàng tìm kiếm và quản lý.

> **Cập nhật lần cuối:** 18/12/2025

## 📁 Cấu trúc Folder

### 🛠️ Setup (`/setup`)
Các hướng dẫn setup môi trường và cấu hình ban đầu:
- `SETUP_GUIDE.md` - Hướng dẫn setup chi tiết cho Development và Production
- `ENVIRONMENT_SETUP_GUIDE.md` - Hướng dẫn cấu hình môi trường (Local & Production)
- `GOOGLE_SIGNIN_SETUP.md` - Hướng dẫn setup Google Sign-In cho Web và Mobile

### 🚀 Deployment (`/deployment`)
Các hướng dẫn về deployment và cấu hình production:
- `EC2_PRODUCTION_DEPLOYMENT.md` - Hướng dẫn chi tiết deploy Backend và AI Service lên AWS EC2
- `VERCEL_PRODUCTION_SETUP.md` - Hướng dẫn cấu hình Environment Variables trên Vercel cho Frontend Production
- `TEST_ENVIRONMENT_SETUP.md` - Hướng dẫn setup Test Environment (test.petties.world + api-test.petties.world)

### 🏗️ Infrastructure (`/infrastructure`)
Cấu hình infrastructure, server, và network:
- `NGINX_WEBSOCKET_CONFIG.md` - Cấu hình Nginx reverse proxy và WebSocket cho EC2

### 💻 Development (`/development`)
Workflow, best practices, và hướng dẫn phát triển:
- `DEVELOPMENT_WORKFLOW.md` - Workflow phát triển
- `FRONTEND_BEST_PRACTICES.md` - Best practices cho Frontend development
- `PETTIES_Git_Workflow_TEAM_GUIDE.md` - Hướng dẫn Git workflow cho team
- `SOURCE_CODE_MANAGEMENT_RULES.md` - Quy tắc quản lý source code với GitHub
- `EXCEPTION_HANDLING_GUIDE.md` - Hướng dẫn xử lý Exception trong Backend Spring
- `MOBILE_DEVELOPMENT_GUIDE.md` - Hướng dẫn phát triển Mobile Flutter
- `MOBILE_CICD_SETUP.md` - ✅ Hướng dẫn setup CI/CD cho Mobile (Firebase App Distribution)

### 📖 Reference (`/reference`)
Quick reference, commands, và cheat sheets:
- `COMMANDS.md` - Danh sách commands thường dùng

### 📋 Documentation (`/documentation`)
Technical documentation, features, và architecture:
- `PETTIES_Features.md` - Danh sách features của hệ thống
- `TECHNICAL SCOPE PETTIES - AGENT MANAGEMENT.md` - Technical scope về Agent Management
- `SP26_Petties_Capstone.md` - Tài liệu Capstone project
- `WBS_PETTIES_14_SPRINTS.md` - Work Breakdown Structure theo 14 Sprint
- `BUSINESS_WORKFLOW_BPMN.md` - Luồng nghiệp vụ theo chuẩn BPMN 2.0
- `BPMN_DETAILED_SPECIFICATIONS.md` - Chi tiết các nghiệp vụ BPMN
- `PETTIES_ERD_DIAGRAM.md` - ERD Diagram đầy đủ của hệ thống
- `PETTIES_MVP_ERD.md` - ERD cho phiên bản MVP
- `PETTIES_MVP_HAPPY_FLOWS.md` - Happy Flow cho MVP
- `VET_SCHEDULING_STRATEGY.md` - Chiến lược lên lịch cho Bác sĩ thú y

### 🧪 Testing (`/testing`)
Tài liệu về Testing strategy và test cases:
- `TESTING_STRATEGY.md` - Chiến lược testing tổng quan
- `TEST_CASES.md` - Danh sách test cases
- `AI_SERVICE_TESTING.md` - Chiến lược testing cho AI Service

### 🎨 Design (`/design`)
Design guides và style guidelines:
- `design-style-guide.md` - Design system và style guide (Neobrutalism)
- `GOOGLE_MAPS_STYLING.md` - Hướng dẫn custom styling cho Google Maps

---

## � Cách sử dụng

### Khi cần setup môi trường mới
→ Xem folder `/setup`

### Khi cần deploy lên production
→ Xem folder `/deployment`
  - **Backend & AI Service**: `EC2_PRODUCTION_DEPLOYMENT.md`
  - **Frontend (Vercel)**: `VERCEL_PRODUCTION_SETUP.md`

### Khi cần config server/infrastructure
→ Xem folder `/infrastructure`

### Khi cần hiểu về workflow và best practices
→ Xem folder `/development`

### Khi cần setup CI/CD cho Mobile
→ Xem `development/MOBILE_CICD_SETUP.md`

### Khi cần tra cứu commands nhanh
→ Xem folder `/reference`

### Khi cần hiểu về features và architecture
→ Xem folder `/documentation`

### Khi cần viết tests
→ Xem folder `/testing`

### Khi cần hướng dẫn về design
→ Xem folder `/design`

---

## 📊 Tiến Độ Dự Án (Hoàn thành Sprint 1)

**Tổng tiến độ:** 20.8% (20/96 tasks) | **Trạng thái:** Bắt đầu Sprint 2

| Component | Status | Progress | Notes |
|-----------|--------|----------|-------|
| 🌐 **Web Frontend** | ✅ Production | 100% (S1) | Deployed on Vercel. Auth screens completed. |
| 🔧 **Backend Spring** | ✅ Production | 100% (S1) | Deployed on EC2. JWT & OAuth ready. |
| 🤖 **AI Agent** | ✅ In Dev | 80% (S1) | Cloud-only stack ready. Core agents implemented. |
| 📱 **Mobile Flutter** | ✅ Staging | 100% (S1) | Firebase App Delivery & CI/CD ready. |
| 📝 **Documentation** | 🔄 In Progress | 50% | WBS, SRS, SDD, ERD, BPMN updated. |
| 🧪 **Testing** | 🔄 In Progress | 15% | Testing strategy and AI service test plan ready. |

---

## 📝 Ghi chú

- Tất cả tài liệu sử dụng Markdown format
- Các file được đặt tên theo convention: `UPPERCASE_DESCRIPTION.md`
- Khi thêm file mới, đặt vào folder phù hợp với nội dung
- Cập nhật README này nếu có thay đổi cấu trúc

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| 🌐 Production Web | [petties.world](https://petties.world) |
| 🔧 Production API | [api.petties.world](https://api.petties.world) |
| 📱 Firebase Console | [Firebase App Distribution](https://console.firebase.google.com/project/petties-cd84e/appdistribution) |
| 📦 GitHub Repo | [Petties Repository](https://github.com/espresso23/Petties-Veterinary-Appointment-Booking-Platform) |
