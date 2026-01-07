# 🎫 PETTIES MASTER BACKLOG (WBS)
## Project: Veterinary Appointment & SOS Platform
**Status:** 06/01/2026 | **Version:** 5.0 (Hierarchy & Codebase-Aligned)
**Progress:** 🛡️ 55%

---

## 📊 EXECUTIVE SUMMARY
| Epic Code | Epic Name | Sprint | Status |
| :--- | :--- | :--- | :--- |
| **EPIC-AUTH** | Authentication & Identity System | S1-S2 | ✅ 100% |
| **EPIC-PET** | Digital Pet Profiling System | S2 | ✅ 100% |
| **EPIC-CLINIC** | Clinic Infrastructure & Onboarding | S2-S4 | ✅ 100% |
| **EPIC-SCHED** | Vet Scheduling & Resource Engine | S3 | ✅ 100% |
| **EPIC-HEALTH** | EMR & Medical Records | S4-S5 | 🔄 20% |
| **EPIC-BOOK** | Hybrid Booking Workflow | S5-S6 | 🔄 10% |
| **EPIC-SOS** | Emergency Rescue System | S7 | 💡 Planned |
| **EPIC-AI** | AI Assistant & Intelligence | S6 | 🔄 40% |
| **EPIC-NOTI** | Omnichannel Notification System | S3/S6 | 🔄 60% |

---

## 📝 DETAILED BREAKDOWN (EPIC -> TASK -> SUBTASK)

### 🏛️ EPIC 1: [EPIC-AUTH] Authentication & Identity System
> **Goal:** Secure access control, JWT management, and RBAC.

#### ✅ AUTH-1: Cấu hình Security Filter Chain & JWT
*   [x] **Backend:** Cấu hình `SecurityConfig` (Disable CSRF, Enable CORS, Stateless Session).
*   [x] **Backend:** Implement `JwtTokenProvider` (Generate, Validate, Claims extraction).
*   [x] **Backend:** Cấu hình `JwtAuthenticationFilter` để chặn và xác thực request.
*   [x] **Backend:** Đăng ký Bean `AuthenticationManager`.

#### ✅ AUTH-2: Đăng nhập Google Social Auth
*   [x] **Mobile:** Tích hợp Firebase Auth để lấy Google ID Token.
*   [x] **Backend:** API `/auth/google` nhận token và verify với Google Cloud.
*   [x] **Backend:** Logic tự động tạo User nếu email chưa tồn tại (Auto-register).

#### ✅ AUTH-3: Xác thực OTP qua Email (Redis)
*   [x] **Backend:** Implement `EmailService` send OTP (JavaMailSender).
*   [x] **Backend:** Cấu hình Redis để lưu OTP với TTL 5 phút.
*   [x] **Backend:** API `/auth/verify-otp` kiểm tra mã và trả về Access Token.

#### ✅ AUTH-4: Quên mật khẩu & Khôi phục tài khoản
*   [x] **Mobile:** Màn hình nhập Email & Verify OTP.
*   [x] **Mobile:** Màn hình nhập mật khẩu mới.
*   [x] **Backend:** API Change Password & Reset Password Flow.

#### ✅ AUTH-5: Lưu phiên đăng nhập & Caching Profile
*   [x] **Mobile:** Implement `SecureStorage` lưu Access/Refresh Token.
*   [x] **Mobile:** Logic `AuthInterceptor` tự động refresh token khi hết hạn.
*   [x] **Mobile:** Cache User Profile để hiển thị Offline.

#### ✅ AUTH-6: Phân quyền DB động
*   [x] **Backend:** Define Enum `Role` (PET_OWNER, VET, CLINIC_OWNER, ADMIN...).
*   [x] **Backend:** Gán Permission động thông qua `@PreAuthorize`.

---

### 🏛️ EPIC 2: [EPIC-PET] Digital Pet Profiling System
> **Goal:** Manage pet identity and records.

#### ✅ PET-1: CRUD Hồ sơ thú cưng
*   [x] **Mobile:** Màn hình danh sách thú cưng (ListView).
*   [x] **Mobile:** Form thêm mới/Sửa thú cưng (Tên, Giống, Ngày sinh, Cân nặng).
*   [x] **Backend:** Entity `Pet` và Repository tương ứng.

#### ✅ PET-2: Upload & Quản lý ảnh (Cloudinary)
*   [x] **Backend:** Tích hợp `CloudinaryService`.
*   [x] **Mobile:** Logic Image Picker (Camera/Gallery).
*   [x] **Backend:** API Upload trả về URL ảnh tối ưu hóa.

#### ✅ PET-3: Danh sách thú cưng & Bộ lọc
*   [x] **Mobile:** Thanh tìm kiếm thú cưng theo tên.
*   [x] **Mobile:** Filter thú cưng theo Species (Chó/Mèo).
*   [x] **Mobile:** Hiển thị Empty State khi chưa có dữ liệu.

---

### 🏛️ EPIC 3: [EPIC-CLINIC] Clinic Infrastructure
> **Goal:** Network of clinics, services, and locations.

#### ✅ CLN-1: Quản lý hồ sơ phòng khám
*   [x] **Web:** Form đăng ký phòng khám cho Owner.
*   [x] **Backend:** Entity `Clinic` với thông tin địa chỉ, giờ mở cửa.
*   [x] **Backend:** Upload giấy phép kinh doanh (License Image).

#### ✅ CLN-2: Quy trình duyệt phòng khám (Admin)
*   [x] **Web:** Dashboard Admin hiển thị danh sách "Pending Approval".
*   [x] **Web:** Nút Approve/Reject chuyển trạng thái Clinic.
*   [x] **Backend:** API update status `ACTIVE`/`REJECTED`.

#### ✅ CLN-3: Quản lý Dịch vụ (Master & Custom)
*   [x] **Backend:** Entity `MasterService` (Template chung).
*   [x] **Backend:** Entity `ClinicService` (Override giá riêng cho từng Clinic).
*   [x] **Backend:** Logic thừa kế giá (Inheritance logic).

#### ✅ CLN-4: Định vị & Bản đồ (Geocoder)
*   [x] **Backend:** Tích hợp Geocoding API (Google/Goong) convert Address -> Lat/Lng.
*   [x] **Backend:** Lưu tọa độ `POINT` vào database.

#### ✅ CLN-5: Tìm kiếm phòng khám (Nearby)
*   [x] **Backend:** Query SQL dùng công thức **Haversine** tính khoảng cách.
*   [x] **Backend:** API `/clinics/nearby` nhận tham số Lat/Lng/Radius.
*   [x] **Mobile:** Hiển thị kết quả tìm kiếm và khoảng cách (km).

---

### 🏛️ EPIC 4: [EPIC-SCHED] Vet Scheduling Engine
> **Goal:** Shift management and Automatic slot generation.

#### ✅ SCH-1: Thuật toán sinh Slot (Auto-Generation)
*   [x] **Backend:** Service tự động chia ca làm việc (VetShift) thành các Slot 30 phút.
*   [x] **Backend:** Entity `VetShift` và `Slot` relationships.
*   [x] **Backend:** Logic loại trừ giờ nghỉ (Lunch break exclusion).

#### ✅ SCH-2: Bảng điều phối ca trực (Shift Board)
*   [x] **Web:** Calendar View (Tháng/Tuần) cho Manager.
*   [x] **Web:** Giao diện tạo ca trực (Chọn Bác sĩ, Ngày, Giờ).
*   [x] **Backend:** Validate trùng lặp ca trực (Overlap validation).

#### ✅ SCH-3: Lịch làm việc cá nhân (Vet View)
*   [x] **Mobile:** Màn hình `MySchedule` hiển thị lịch theo ngày.
*   [x] **Mobile:** Status Indicator cho từng Slot (Open/Booked/Completed).

#### ✅ SCH-4: Real-time SSE Sync
*   [x] **Backend:** `SseEmitter` broadcast event khi có lịch mới.
*   [x] **Web:** Auto-refresh bảng lịch khi có thay đổi.

---

### 🏛️ EPIC 5: [EPIC-HEALTH] EMR & Medical Records
> **Goal:** Centralized medical history and vaccination records.

#### ⏳ EMR-1: Xem lịch sử EMR (Shared)
*   [ ] **Backend:** API truy xuất lịch sử khám "Cross-clinic" (dựa trên PetID).
*   [ ] **Mobile:** Timeline view hiển thị lịch sử khám bệnh.
*   [ ] **Backend:** Policy kiểm soát quyền xem dữ liệu (Privacy).

#### ⏳ EMR-2: Ghi bệnh án SOAP (Vet)
*   [ ] **Mobile:** Form nhập liệu SOAP (Subjective, Objective, Assessment, Plan).
*   [ ] **Backend:** Entity `MedicalRecord`.
*   [ ] **Mobile:** Chức năng đính kèm ảnh triệu chứng.

#### ⏳ EMR-3: Sổ tiêm chủng điện tử
*   [ ] **Backend:** Entity `VaccinationRecord`.
*   [ ] **Mobile:** Giao diện thẻ tiêm chủng (Vaccine Card).
*   [ ] **Backend:** Logic tính ngày tái chủng (Next due date).

#### ⏳ EMR-5: Đơn thuốc điện tử (Rx)
*   [ ] **Backend:** Schema lưu trữ đơn thuốc.
*   [ ] **Mobile:** View Rx detail trong lịch sử khám.

---

### 🏛️ EPIC 6: [EPIC-BOOK] Hybrid Booking Workflow
> **Goal:** Booking flow for In-clinic and Home-visit appointments.

#### ⏳ BOK-1: Wizard đặt lịch (Mobile)
*   [ ] **Mobile:** Flow chọn: Pet -> Clinic -> Service -> Vet -> Slot -> Confirm.
*   [ ] **Mobile:** Xử lý giữ chỗ (Slot locking) tạm thời.

#### ✅ BOK-4: Tính phí khoảng cách (Backend)
*   [x] **Backend:** Service tính phí ship/di chuyển dựa trên khoảng cách km.
*   [x] **Backend:** Cấu hình giá `pricePerKm`.

#### ⏳ BOK-3: Workflow trạng thái Booking
*   [ ] **Backend:** State Machine (PENDING -> CONFIRMED -> CHECK_IN -> DONE).
*   [ ] **Mobile:** QR Code Check-in tại phòng khám.

#### ⏳ BOK-5: Hủy lịch & Hoàn tiền
*   [ ] **Backend:** Policy hoàn tiền (Refund logic).
*   [ ] **Web/Mobile:** UI yêu cầu hủy lịch.

---

### 🏛️ EPIC 7: [EPIC-SOS] Emergency Rescue System (Planned)
> **Goal:** Real-time emergency response.

#### ⏳ SOS-1: Tìm kiếm khẩn cấp
*   [ ] **Backend:** Filter phòng khám có trạng thái `IS_EMERGENCY_AVAILABLE`.
*   [ ] **Mobile:** Nút SOS chuyển sang chế độ tìm kiếm ưu tiên.

#### 💡 SOS-2: Live GPS Tracking
*   [ ] **Backend:** WebSocket Endpoint nhận tọa độ Vet.
*   [ ] **Mobile:** Google Maps Polylines vẽ đường đi realtime.

#### 💡 SOS-3: Màn hình SOS Tracking
*   [ ] **Mobile:** Map interface cho Pet Owner theo dõi Vet.

---

### 🏛️ EPIC 8: [EPIC-AI] AI Assistant Intelligence
> **Goal:** Smart assistant using RAG and LLM.

#### ✅ AI-1: RAG Knowledge Base
*   [x] **AI Service:** Tích hợp LlamaIndex + Qdrant.
*   [x] **Backend:** API forward câu hỏi sang AI Service.

#### ✅ AI-2: Chẩn đoán sơ bộ
*   [x] **AI Service:** Tool `symptom_checker` phân tích triệu chứng.

#### ⏳ AI-3: Booking qua Chat
*   [ ] **AI Service:** Tool `create_booking` để Agent thực hiện function calling.

#### ✅ AI-4: Admin AI Playground
*   [x] **Web:** UI chỉnh sửa System Prompt.
*   [x] **Web:** Test chat interface.

---

### 🏛️ EPIC 9: [EPIC-NOTI] Omnichannel Notification
> **Goal:** Push, SSE, and Email communication.

#### ✅ NTF-1: Firebase Push Notification (FCM)
*   [x] **Backend:** `FcmService` gửi message tới device token.
*   [x] **Mobile:** Xử lý `onMessage` và `onBackgroundMessage`.
*   [x] **Mobile:** Deep link navigation khi tap vào noti.

#### ✅ NTF-2: Real-time Web Notification (SSE)
*   [x] **Backend:** `SseEmitterService` quản lý kết nối SSE.
*   [x] **Web:** Tự động hiển thị Toast khi có event mới.

#### ⏳ NTF-4: Nhắc lịch tự động
*   [ ] **Backend:** Cron Job quét các booking sắp tới (24h/2h).
*   [ ] **Backend:** Trigger gửi noti nhắc nhở.

---
**Author:** Senior PM Agent
