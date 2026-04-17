# 🐾 Petties - Veterinary Appointment Booking Platform

Chào mừng bạn đến với dự án **Petties**, hệ sinh thái quản lý và đặt lịch khám thú y toàn diện. Đây là tài liệu hướng dẫn ngữ cảnh dành cho Gemini CLI để hỗ trợ phát triển dự án một cách hiệu quả nhất.

---

## 📖 Tổng Quan Dự Án
Petties là một hệ thống đa dịch vụ kết nối Chủ nuôi (Pet Owner) với các Phòng khám thú y (Clinic). Dự án được xây dựng theo mô hình **Clinic-Centric**, tối ưu hóa quy trình từ đặt lịch, điều phối bác sĩ đến hồ sơ bệnh án điện tử (EMR) và tư vấn AI.

### 🏗️ Kiến Trúc Hệ Thống
Dự án là một monorepo bao gồm 4 thành phần chính:
1.  **Backend (Java):** Spring Boot 3.4, Java 21. Quản lý logic nghiệp vụ chính, bảo mật (JWT), và lưu trữ dữ liệu (PostgreSQL, MongoDB, Redis).
2.  **Web Frontend (React):** React 19, TypeScript, Tailwind v4. Dành cho Admin, Clinic Owner, Manager và Vet. Style thiết kế: **Soft Neobrutalism**.
3.  **Mobile App (Flutter):** Flutter 3.5. Dành cho Pet Owner (đặt lịch, theo dõi SOS) và Vet (quản lý ca làm việc).
4.  **AI Service (Python):** FastAPI, LangGraph, LlamaIndex. Cung cấp AI Assistant (ReAct pattern), RAG y tế, và chẩn đoán hình ảnh.

---

## 🛠️ Công Nghệ & Thành Phần

### 1. Backend Spring Boot (`/backend-spring/petties`)
- **Core:** Java 21, Spring Boot 3.4.x.
- **Database:** PostgreSQL (Nghiệp vụ), MongoDB (EMR/Logs), Redis (Cache/OTP).
- **Migration:** Flyway.
- **Security:** Spring Security + JWT (5 vai trò: Admin, Owner, Manager, Vet, Owner).

### 2. Web Frontend (`/petties-web`)
- **Tech:** React 19, TypeScript, Vite, Tailwind CSS v4.
- **State Management:** Zustand.
- **Style:** Neobrutalism (Shadow đậm, viền rõ, màu tương phản).

### 3. Mobile App (`/petties_mobile`)
- **Tech:** Flutter 3.5+, GoRouter, Provider.
- **Features:** Google Maps (SOS tracking), FCM (Notification), Chat Realtime.

### 4. AI Agent Service (`/petties-agent-serivce`)
- **Tech:** Python 3.12, FastAPI.
- **AI Core:** LangGraph (Multi-agent/ReAct), Gemini/GPT-4o, Cohere (Embedding).
- **Vector DB:** Qdrant (RAG & Case Memory).
- **Protocol:** MCP (Model Context Protocol) cho các tools.

---

## 🚀 Lệnh Phát Triển Quan Trọng

### Toàn bộ hệ thống (Docker)
```bash
# Chạy toàn bộ stack dev
docker-compose -f docker-compose.dev.yml up -d --build
```

### Backend (Java)
```bash
cd backend-spring/petties
mvn spring-boot:run
# Chạy test
mvn test
```

### Web Frontend (React)
```bash
cd petties-web
npm install
npm run dev
# Lint & Build
npm run lint
npm run build
```

### Mobile App (Flutter)
```bash
cd petties_mobile
flutter pub get
flutter run --flavor dev
```

### AI Service (Python)
```bash
cd petties-agent-serivce
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
# Chạy test AI
pytest
```

---

## 📏 Quy ƯớC & Nguyên Tắc Phát Triển

### 1. Ngôn Ngữ & Tài Liệu
- **Ngôn ngữ:** Ưu tiên sử dụng **Tiếng Việt** cho các phản hồi của AI và nội dung giao diện người dùng (UI), theo yêu cầu tại `.gemini/gemini.md`.
- **Tài liệu:** Luôn tuân thủ các hướng dẫn trong thư mục `docs-references/`. Đây là nguồn tài liệu chuẩn cho SRS, SDD và Features.

### 2. Quy Trình Database (Migration-First)
- **Tuyệt đối không** sử dụng `ddl-auto=update` trong Spring Boot. Sử dụng **Flyway** (`src/main/resources/db/migration/`).
- AI Service sử dụng **Alembic** cho các bảng liên quan đến AI (`migrations/versions/`).

### 3. Tiêu Chuẩn Code
- **Commits:** Sử dụng **Conventional Commits** (feat, fix, docs, style, refactor, test, chore).
- **Testing:** Mỗi tính năng mới hoặc bug fix phải đi kèm với unit test tương ứng.
- **AI Integration:** Khi làm việc với AI Service, chú ý đến cơ chế **ReAct** (Thought -> Action -> Observation).

### 4. Giao Diện (UI/UX)
- Tuân thủ phong cách **Soft Neobrutalism** trên Web.
- Mobile sử dụng phong cách **Hybrid** (mềm mại nhưng vẫn giữ dấu ấn Neobrutalism).

---

## 📂 Cấu Trúc Thư Mục Chính
- `/backend-spring`: Mã nguồn backend Java.
- `/petties-web`: Mã nguồn frontend React.
- `/petties_mobile`: Mã nguồn ứng dụng di động Flutter.
- `/petties-agent-serivce`: Dịch vụ AI Agent Python.
- `/docs-references`: Tài liệu nghiệp vụ, thiết kế và hướng dẫn vận hành.
- `/postman`: Các bộ sưu tập API để testing.

---

## ⚠️ Lưu Ý Bảo Mật
- Không bao giờ commit các file `.env` hoặc API Keys lên repository.
- Sử dụng `.env.example` để hướng dẫn cấu hình biến môi trường.

---
© 2025 Petties Team.
