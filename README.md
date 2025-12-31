![Petties Banner](https://github.com/user-attachments/assets/ee68cc72-7bed-475f-8611-b62dc1e7f5ec)

# 🐾 Petties - Veterinary Appointment Booking Platform

> **Petties** là hệ sinh thái quản lý và đặt lịch khám thú y toàn diện, đóng vai trò cầu nối thông minh giữa **Chủ pet** và các **Phòng khám (Clinic)** chuyên nghiệp. Không chỉ đơn thuần là ứng dụng đặt lịch, Petties tối ưu hóa toàn bộ quy trình vận hành từ điều phối bác sĩ, quản lý hồ sơ bệnh án điện tử (EMR) đến tư vấn AI chuyên sâu.

---

## 🏛️ Bối Cảnh & Tầm Nhìn (Context)

Dự án được xây dựng dựa trên mô hình **Clinic-Centric** (Lấy phòng khám làm trung tâm):
*   **Dành cho Chủ Pet:** Một nền tảng duy nhất để quản lý sức khỏe cho nhiều Pet, đặt lịch linh hoạt (**Khám tại nhà hoặc tại phòng khám**) với minh bạch về giá cả và chất lượng.
*   **Dành cho Phòng Khám:** Số hóa quy trình quản lý, từ việc tiếp nhận yêu cầu, phân công Bác sĩ (Vet), quản lý ca làm việc (Shift) đến tối ưu hóa doanh thu.
---

## 📋 Thông Tin Dự Án

| Thông Tin | Chi Tiết |
|-----------|---------|
| **Dự Án** | Petties: Veterinary Appointment Booking Platform |
| **Mã Lớp** | CP_SEP490 |
| **Thời Gian** | 10/12/2025 - 11/03/2026 (13 Sprints) |
| **Công Nghệ Core** | Java 21, Spring Boot, FastAPI, Flutter, PostgreSQL, MongoDB, Qdrant |
| **Last Updated** | 2025-12-29 |

---

## 👥 Thành Viên Nhóm

### Giáo Viên Hướng Dẫn
- **Nguyễn Xuân Long** - Supervisor
  - ☎️ 0905764750
  - 📧 longnx6@fe.edu.vn

### Thành Viên Nhóm

| STT | Tên | Vai Trò | Liên Hệ |
|-----|-----|---------|---------|
| 1 | **Phạm Lê Quốc Tân** | Team Leader / Backend Lead | tanplqse181717@fpt.edu.vn |
| 2 | **Nguyễn Đức Tuấn** | Full-stack Developer | tuanndde180807@fpt.edu.vn |
| 3 | **Vũ Minh Triết** | Full-stack Developer | trietvmde180687@fpt.edu.vn |
| 4 | **Lưu Đặng Diệu Huyền** | Business Analyst/Frontend Developer / Tester | huyenlddde180773@fpt.edu.vn |
| 5 | **Lê Phương Uyên** | Designer Frontend Developer / Mobile Developer | uyenlpde180893@fpt.edu.vn |

---

## 🚀 Cách Chạy Thủ Công (Dành cho Dev)

Nếu không dùng Dev Container, bạn có thể chạy nhanh các thành phần theo các bước sau:

### 0. Cấu hình Biến môi trường
Copy file mẫu và điền các API Key cần thiết (OpenRouter, Cloudinary, v.v.):
```bash
cp .env.example .env
```

### 1. Chạy nhanh toàn bộ hệ thống (Full Stack)
Lệnh này sẽ tự động build và chạy tất cả dịch vụ (Backend, AI, Web, Databases):
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### 2. Khởi động riêng Databases (Docker)
```bash
docker-compose -f docker-compose.dev.yml up -d postgres mongodb redis
```

### 2. Chạy Backend (Java)
```bash
cd backend-spring/petties && mvn spring-boot:run
```

### 3. Chạy AI Service (Python)
```bash
cd petties-agent-serivce && python -m uvicorn app.main:app --reload
```

### 4. Chạy Web Frontend (Node.js)
```bash
cd petties-web && npm run dev
```

### 5. Phát triển Mobile (Flutter)
**Yêu cầu:** Đã cài đặt Flutter SDK 3.5+ và cấu hình Android Studio/Xcode.

```bash
cd petties_mobile
# 1. Cài đặt các thư viện
flutter pub get

# 2. Chạy ứng dụng (Development với Local Backend)
# Đối với Android Emulator:
flutter run --flavor dev --dart-define=FLAVOR=dev

# Đối với Thiết bị thật (Thay XXX bằng IP LAN của máy tính):
flutter run --flavor dev --dart-define=FLAVOR=dev --dart-define=API_URL=http://192.168.1.XXX:8080/api

# 3. Build APK Production (Release)
flutter build apk --release --flavor prod --dart-define=FLAVOR=prod
```
*Chi tiết xem tại:* [MOBILE_DEVELOPMENT_GUIDE.md](docs-references/development/MOBILE_DEVELOPMENT_GUIDE.md)

---

## 🌟 Các Tính Năng Cốt Lõi (Core Features)

Dự án được triển khai trên 5 vai trò chính với các tính năng chuyên biệt:

### 1. Pet Owner (Chủ nuôi - Mobile App)
*   **Quản lý Pet:** Tạo hồ sơ thú cưng, lưu trữ ảnh, giống, đặc điểm và lịch sử y tế.
*   **Booking Engine:** Tìm kiếm phòng khám/bác sĩ và đặt lịch **Clinic Visit** hoặc **Home Visit**.
*   **Theo dõi Real-time:** Tracking vị trí bác sĩ trên bản đồ khi thực hiện dịch vụ tại nhà.
*   **Y tế số:** Xem hồ sơ bệnh án điện tử (EMR), sổ tiêm chủng và đơn thuốc (e-Rx).
*   **Tương tác:** Chat với AI Assistant, đánh giá bác sĩ và thanh toán trực tuyến.

### 2. Vet (Bác sĩ thú y - Web & Mobile)
*   **Quản lý lịch:** Theo dõi lịch làm việc được phân công, phê duyệt/từ chối booking.
*   **Thực thi chuyên môn:** Check-in/Check-out bệnh nhân, cập nhật EMR và sổ tiêm chủng.
*   **Dịch vụ tại nhà:** Bắt đầu di chuyển và cập nhật vị trí GPS tự động cho chủ pet.

### 3. Clinic Manager (Quản lý chi nhánh - Web Only)
*   **Điều phối nhân sự:** Phân công bác sĩ cho booking, quản lý ca làm việc (Shifts).
*   **Quản lý lịch biểu:** Tạo lịch làm việc thủ công và tự động sinh Slot trống cho clinic.
*   **Chăm sóc khách hàng:** Chat trực tiếp với chủ pet để tư vấn và hỗ trợ.

### 4. Clinic Owner (Chủ hệ thống phòng khám - Web Only)
*   **Quản lý danh mục:** Thiết lập **Master Services** (dịch vụ mẫu) cho toàn hệ thống.
*   **Tùy chỉnh dịch vụ:** Thừa hưởng hoặc tự tạo dịch vụ riêng (Custom) cho từng chi nhánh.
*   **Kinh doanh:** Theo dõi Dashboard doanh thu, thống kê hiệu quả hoạt động.

### 5. Admin (Quản lý nền tảng - Web Only)
*   **Kiểm duyệt:** Phê duyệt/từ chối các phòng khám mới tham gia hệ thống.
*   **Cấu hình AI:** Quản lý System Prompt, bật/tắt Tools (@mcp.tool), quản lý Knowledge Base (RAG).
*   **Trình chơi AI (Playground):** Kiểm tra và debug luồng suy nghĩ của Agent (Thought -> Action -> Observation).

---

## 🤖 Hệ Thống AI Agent (Petties AI Layer)

Petties sử dụng kiến trúc **Single Agent (ReAct Pattern)** hiện đại:
*   **Cơ chế ReAct:** AI tự động suy luận (Thought), gọi công cụ (Action) và quan sát kết quả (Observation).
*   **Tools thông minh:** Đặt lịch qua chat, tra cứu triệu chứng bệnh, tìm kiếm phòng khám gần nhất.
*   **RAG (Retrieval-Augmented Generation):** Truy xuất kiến thức y tế từ tài liệu chuyên môn đã được vector hóa.

---

## 🛠️ Stack Công Nghệ

### Backend & AI
*   **Java 21 + Spring Boot 3.4.x**: Micro-services architecture (Core API).
*   **Spring Security + JWT**: Bảo mật và phân quyền 5 tầng (Admin, Manager, Vet, Owner, Staff).
*   **FastAPI (Python 3.12)**: Serving AI Agent và xử lý dữ liệu vector.
*   **Database**: PostgreSQL (Structured), MongoDB (Logs/EMR), Redis (OTP/Cache), Qdrant (Vector).

### Frontend & Mobile
*   **React 19 + TypeScript + Tailwind v4**: Giao diện Admin & Clinic Manager hiện đại.
*   **Zustand**: Quản lý State nhẹ nhàng và hiệu quả.
*   **Flutter 3.x**: Trải nghiệm mượt mà trên cả iOS & Android cho Chủ pet và Bác sĩ.

---

## 🐳 Hướng Dẫn Phát Triển Theo Chuẩn Discourse (Dev Container)

Chúng tôi khuyến nghị sử dụng **Dev Containers** để có môi trường phát triển đồng nhất.

### 1. Chuẩn Bị
*   Cài đặt **Docker Desktop**.
*   Cài đặt **VS Code** và extension **[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)**.

### 2. Khởi Chạy
1.  Mở thư mục dự án bằng VS Code.
2.  Nhấn `Ctrl + Shift + P` -> chọn `Dev Containers: Reopen in Container`.
3.  Đợi VS Code tự động build và cài đặt Java, Python, Node.js vào container.
4.  **Database Migration**:
    *   Cả **Backend** và **AI Service** đều đã được cấu hình tự động chạy Migration (Flyway/Alembic) ngay khi khởi động ứng dụng. Bạn không cần chạy lệnh thủ công.

### 3. Chạy Các Dịch Vụ
*   **Backend**: `cd backend-spring/petties && mvn spring-boot:run`
*   **AI Service**: `cd petties-agent-serivce && python -m uvicorn app.main:app --reload`
*   **Web Frontend**: `cd petties-web && npm run dev`
*   **Mobile App**: `cd petties_mobile && flutter run --flavor dev`

---

## 📜 Chiến Lược Quản Lý Database (Migration)

Dự án sử dụng chiến lược **Migration-First** để đảm bảo tính nhất quán tuyệt đối giữa các môi trường:

*   **Backend (Java):** Sử dụng **Flyway**. Script lưu tại `src/main/resources/db/migration/`.
*   **AI Service (Python):** Sử dụng **Alembic**. Script lưu tại `migrations/versions/`.
*   **Quy tắc Vàng:**
    1. Tuyệt đối KHÔNG dùng `ddl-auto=update` trên mọi môi trường (dùng `validate`).
    2. Cả hai hệ thống hoạt động cách ly an toàn (Alembic chỉ quản lý bảng AI, Flyway quản lý bảng nghiệp vụ).
    3. Tự động hóa: Các service đều tự động nâng cấp cấu trúc DB khi khởi động.

👉 *Xem hướng dẫn chi tiết tại:* [DATABASE_MIGRATION_GUIDE.md](docs-references/development/DATABASE_MIGRATION_GUIDE.md)

---

© 2025 Petties Team. All rights reserved. Built with ❤️ for Pet Lovers.
