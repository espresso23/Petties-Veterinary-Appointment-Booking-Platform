## 1. Mở đầu & tên kiến trúc

- Petties là nền tảng đặt lịch khám thú y, kết nối **Pet Owner** với **phòng khám và Staff** (nhân sự phòng khám).
- Ở mức tổng thể, hệ thống dùng **kiến trúc nhiều tầng (multi‑tier / layered)**:
  - Tầng Presentation: web React + mobile Flutter.
  - Tầng Backend API: Spring Boot.
  - Tầng AI Service: FastAPI (AI Agent Service) tách riêng.
  - Tầng Data: Postgres, MongoDB, Redis, Qdrant, Firebase.
- Phần Java là **modular monolith dạng layered** (`controller → service → repository → model`), còn AI là một service đứng cạnh, giao tiếp qua HTTP/WebSocket.

---

## 2. System Architecture (≈3 phút)

### 2.1. Frontend – React Web & Flutter Mobile

- **React Web (petties-web)**:
  - Dùng cho Admin, Clinic Owner, Clinic Manager, Staff.
  - Hiển thị dashboard quản lý lịch hẹn, ca trực, EMR, chat, thông báo real‑time.
- **Flutter Mobile (petties_mobile)**:
  - Dùng cho Pet Owner và Staff trên điện thoại.
  - Cho phép đặt lịch, xem lịch sử, cập nhật trạng thái booking, chat với phòng khám, nhận push notification.
- Cả hai chỉ giao tiếp với backend qua **REST API, SSE và WebSocket**, không truy cập DB trực tiếp.

### 2.2. Backend Spring Boot – Lõi nghiệp vụ

- Spring Boot xử lý toàn bộ nghiệp vụ lõi: auth, booking, clinic, staff shift, vaccination, notification, file upload, chat…
- Kiến trúc bên trong theo layered rõ ràng:
  - `controller` nhận HTTP request, trả JSON response.
  - `service` chứa business logic.
  - `repository` thao tác Postgres qua JPA.
  - `model`/`model/enums` là domain entity & enum.
- Các concern chung như security, exception, config, utils, converter được tách riêng thành package, giúp code dễ bảo trì và test.

### 2.3. AI Agent Service (FastAPI) – Trợ lý AI tách riêng

- AI được tách thành **AI Agent Service riêng** viết bằng FastAPI, đứng cạnh Spring Boot phía sau Nginx.
- Service này phục vụ Pet Owner và Staff trong các luồng:
  - Chat tư vấn chăm sóc thú cưng, giải đáp câu hỏi.
  - Gợi ý và hỗ trợ đặt lịch qua chat.
- Cách hoạt động (đúng với code):
  - Frontend mở WebSocket/REST tới AI Agent Service.
  - Bên trong, agent chạy theo **ReAct**: LLM suy nghĩ; khi cần, gọi tools như `search_clinics_nearby`, `check_available_slots`, `create_booking_for_user` để hỏi Spring Boot, hoặc dùng **RAG với Qdrant + LlamaIndex + Cohere** để truy vấn kiến thức.
  - Kết quả cuối cùng được **stream ngược** lại cho user qua WebSocket.
- Điểm quan trọng:
  - **AI chỉ gọi sang backend qua HTTP, không truy cập trực tiếp database** → dữ liệu nghiệp vụ vẫn do Spring Boot kiểm soát.
  - Nếu LLM hoặc tool lỗi/timeout, AI Service trả lỗi “ở lớp AI”, không thực hiện các hành động nguy hiểm như tạo/sửa booking.
  - Mỗi lần hội thoại và tool‑call được lưu vào MongoDB của AI (`ai_chat_sessions`, `ai_chat_messages`) để audit và phân tích lại.

#### 2.3.1. AI Insight – “đã làm được gì” (giải thích dễ hiểu cho khách hàng)

- **Hiển thị AI đang làm gì theo từng bước (real‑time)**:
  - Khi bạn chat, hệ thống có thể hiển thị tuần tự: AI “đang suy nghĩ” → AI “đang gọi dữ liệu” → AI “nhận kết quả” → AI “trả lời”.
  - Mục tiêu: minh bạch, giúp người dùng tin tưởng và giúp đội kỹ thuật dễ debug khi có lỗi.

- **Ghi lại lịch sử để kiểm tra lại sau (audit trail)**:
  - Mỗi phiên chat được lưu lại để có thể xem lại: đã hỏi gì, AI trả lời gì, có gọi dữ liệu gì không.
  - Mục tiêu: giải quyết khiếu nại nhanh, truy vết lỗi rõ ràng.

- **Thu thập phản hồi để AI tốt dần lên (feedback loop)**:
  - Người dùng/nhân sự có thể đánh giá câu trả lời “hữu ích/không hữu ích”.
  - Với phản hồi “đúng”, hệ thống lưu lại “trường hợp đã được xác nhận” để lần sau gặp câu hỏi tương tự sẽ trả lời chắc hơn.

- **Cập nhật kiến thức dễ dàng (AI update data)**:
  - Khi có tài liệu thú y mới (phác đồ, hướng dẫn chăm sóc), Admin upload tài liệu lên Knowledge Base.
  - Hệ thống tự chia nhỏ nội dung và đưa vào “kho tra cứu” (vector database).
  - Từ đó, AI sẽ tra cứu trên kho mới để trả lời đúng hơn, hạn chế bịa thông tin.

#### 2.3.2. Kịch bản thuyết trình ngắn (1–2 phút) – “AI cập nhật dữ liệu và cải thiện độ chính xác”

- **AI cập nhật dữ liệu thế nào?**
  - “Bọn em không ‘train lại model’ mỗi lần có thông tin mới. Thay vào đó, bọn em cập nhật kiến thức bằng cách upload tài liệu thú y vào Knowledge Base.”
  - “Hệ thống tự xử lý tài liệu: tách nội dung thành nhiều đoạn nhỏ và lưu vào kho tra cứu. Khi Pet Owner hỏi, AI sẽ tra cứu kho này để lấy đúng nội dung liên quan rồi mới trả lời.”

- **AI cải thiện độ chính xác ra sao theo thời gian?**
  - “Thứ nhất, nếu câu hỏi quá ngắn, AI tự mở rộng từ khóa để tìm đúng tài liệu hơn.”
  - “Thứ hai, khi người dùng/Staff xác nhận câu trả lời đúng, hệ thống lưu lại các ‘trường hợp đã được xác nhận’ để lần sau gặp tình huống tương tự sẽ ưu tiên tham chiếu, nên câu trả lời ngày càng sát thực tế hơn.”

### 2.4. Store Data – Postgres, MongoDB, Redis, Qdrant, Firebase

- **PostgreSQL**: nguồn dữ liệu quan hệ chính – user, clinic, pet, booking, staff shift, vaccination, notification… (do Spring Boot quản lý, Flyway migration).
- **MongoDB**: lưu document linh hoạt cho các payload/log không phù hợp schema cứng.
- **Redis** (đúng với code):
  - Lưu OTP đăng ký, OTP quên mật khẩu, OTP đổi email + cooldown qua `OtpRedisService` (keys `otp:registration:*`, `otp:password_reset:*`, `otp:email_change:*`).
  - Lưu **session matching SOS** và lock chống race condition qua `SosSessionManager` (keys `sos:matching:*`).
  - Lưu **tracking vị trí GPS tạm thời** cho booking home visit/SOS qua `TrackingService` (key `tracking:{bookingId}`) với TTL ngắn.
  - Mục tiêu: giảm tải cho Postgres và tăng tốc các luồng xác thực/khẩn cấp.
- **Qdrant**: vector DB chứa embedding tài liệu thú y, dùng trong RAG của AI Service.
- **Firebase**: lưu FCM token và gửi push notification xuống mobile khi có booking, shift, chat, vaccine reminder…

### 2.5. Nginx, External Services & CI/CD

- **Nginx (API Gateway/Reverse Proxy)**:
  - Chạy trên EC2, terminate SSL và route:
    - `/api/**` → Spring Boot backend (127.0.0.1:8080/8081).
    - `/ai/**`, `/ai/ws/**` → AI Agent Service (127.0.0.1:8000/8001).
    - `/ws/**` → WebSocket backend.
- **External services**:
  - **OpenRouter**: LLM gateway cho AI Service (Gemini, Llama, Claude…).
  - **Goong Map**: tính khoảng cách cho dịch vụ home visit/SOS.
  - **Stripe / Payment provider**: xử lý thanh toán online (nếu bật).
  - **Sentry**: theo dõi lỗi và performance cho cả backend và AI.
- **CI/CD & môi trường**:
  - 3 môi trường: `dev` (local Docker), `test` (`test.petties.world` + `api-test.petties.world`, branch `develop`), `prod` (`www.petties.world` + `api.petties.world`, branch `main`).
  - GitHub Actions: `ci.yml` (build + test), `deploy-test.yml`, `deploy-ec2.yml`, `mobile-ci-cd.yml`.
  - Frontend web deploy trên **Vercel**, backend + AI Service chạy bằng Docker trên **EC2**.

---

## 3. Lý do chọn kiến trúc này (≈1 phút)

- **Rõ ràng về tầng và trách nhiệm**:
  - Presentation (web/mobile) tách khỏi Backend/API; Backend tách khỏi AI; Data tách khỏi logic.
  - Backend Java là **modular monolith layered**, dễ hiểu, dễ debug, không quá phức tạp như full microservices.
- **AI tách riêng, an toàn với dữ liệu**:
  - AI Agent Service là **service độc lập**, chỉ gọi Spring Boot qua HTTP, không truy cập DB trực tiếp.
  - Dễ đổi model/provider (qua `LLMClient` → OpenRouter) mà không ảnh hưởng business logic.
- **Tối ưu cho mở rộng và vận hành**:
  - Có thể bổ sung module mới (pharmacy, loyalty…) trong Spring Boot mà không đổi kiến trúc tổng thể.
  - Hệ thống đáp ứng tốt yêu cầu phi chức năng: realtime (SSE + FCM), bảo mật (JWT + roles), giám sát (Sentry), CI/CD đầy đủ.

---

## 4. Package Diagrams – Cấu trúc bên trong từng service (≈2 phút)

Mục tiêu của phần này là chứng minh **codebase bên trong không bị “spaghetti”**, mà mỗi service đều được chia layer rõ ràng, phụ thuộc một chiều từ trên xuống.

### 4.1. AI Agent Service – `petties-agent-service`

- Các package chính:
  - `api`: FastAPI endpoint (REST/WebSocket) nhận request chat/AI.
  - `core`: engine ReAct/agent – định nghĩa state, graph, luồng Thought → Action → Observation.
  - `services`: LLM client (`OpenRouterClient`…), tool executor, tích hợp RAG (LlamaIndex + Qdrant + Cohere).
  - `db`: Postgres lưu cấu hình/governance AI (agent, tools, prompt/settings), MongoDB lưu chat history (`ai_chat_sessions`, `ai_chat_messages`).
  - `config`: cấu hình hệ thống (API key, model, provider).
  - `test`: unit/integration test, chỉ import xuống các layer dưới.
- Ý chính: **luồng phụ thuộc đi từ trên xuống** – `api → core → services/db`, không có việc services gọi ngược lên api, nên dễ test và refactor.

### 4.2. Backend Spring Boot – `backend-spring`

- Package diagram thể hiện kiến trúc **layered/modular monolith**:
  - `controller`: Presentation Layer – REST controllers nhận và trả JSON.
  - `dto`: DTO Layer – request/response, tránh lộ entity ra bên ngoài.
  - `service`: Business Layer – chứa toàn bộ business logic (booking, clinic, notification…).
  - `repository`: Data Access Layer – truy cập Postgres qua JPA.
  - `model` + `model/enums`: Domain Layer – entity và enum nghiệp vụ.
  - `config`, `security`, `exception`: cross‑cutting (security, cấu hình, global exception).
  - `utils`, `converter`: hạ tầng dùng chung (helper, mapper).
  - `db/migration`: Flyway migration scripts.
  - `test`: test layer cho controller/service/repository.
- Khi trình bày có thể nhấn mạnh: **controller không bao giờ đụng DB trực tiếp**, mọi thứ đều qua `service → repository → model`.

### 4.3. Petties Mobile – `petties_mobile` (Flutter)

- Cấu trúc chính:
  - `ui/screens` (vet, auth, pet_owner, pet, profile): các màn hình chính cho từng role.
  - `routing`: điều hướng screen, tách khỏi logic UI.
  - `data` (model, services, datasource, repository): làm việc với API backend, mapping JSON → model.
  - `shared modules` (utils, providers, config/env, config/theme, config/constants): phần dùng chung toàn app.
  - `ui/widgets` (widgets, core/widgets): widget tái sử dụng giúp UI đồng nhất.
  - `core` (error, network): xử lý lỗi và network ở một chỗ.
  - `test`: test cho các phần trên.
- Thông điệp: **UI layer chỉ “uses” data layer qua model/services**, không trộn logic gọi API trực tiếp trong từng widget/screen.

### 4.4. Petties Web – `petties-web` (React)

- Cấu trúc chính:
  - `pages` (clinic-owner, clinic-manager, admin, vet, auth, shared): các trang theo role/ngữ cảnh.
  - `layouts`: khung layout chung (sidebar, header…), được pages import và dùng lại.
  - `components` (core, modules): component UI, chia core (button, card…) và modules (bảng lịch hẹn, modal…).
  - `services` (api, websocket): gọi REST API và WebSocket/SSE, tách khỏi component.
  - `shared modules` (lib, utils, hooks, store, config): logic và state dùng chung (Zustand store, hooks, config).
  - `types`: type/enum dùng chung toàn web.
  - `test`: test cho pages/components/services.
- Kết luận phần này: **cả 4 package diagram đều tuân theo cùng một triết lý thiết kế** – mỗi layer phụ thuộc xuống dưới, không phụ thuộc ngược lên; AI, backend, web, mobile thống nhất cách tổ chức code, giúp team dễ onboard, thử nghiệm và mở rộng về sau.

