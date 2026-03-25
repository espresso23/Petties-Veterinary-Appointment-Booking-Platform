# 🎫 PETTIES WORK BREAKDOWN STRUCTURE (WBS)
## Project: Veterinary Appointment & SOS Platform
**Version:** 1.5.0 | **Last Updated:** 22/01/2026 | **Audited from Codebase**  
**Team Size:** 5 members | **Sprint Duration:** 1 week | **Target Effort:** ~40h/person/week

---

## 👥 TEAM ROSTER

| Code | Name | Role | Focus Area |
|------|------|------|------------|
| **DEV-1** | Nguyễn Văn An | Backend Lead | Spring Boot, Database |
| **DEV-2** | Trần Thị Bình | Frontend Lead | React, Flutter |
| **DEV-3** | Lê Hoàng Cường | Fullstack | BE + Mobile |
| **DEV-4** | Phạm Thị Dung | QA Lead | Test Case, System Test |
| **DEV-5** | Hoàng Văn Em | DevOps + AI | CI/CD, AI Service |

---

## 🎭 ACTORS & USER STORIES

### 👤 Pet Owner (Mobile App)
> Chủ thú cưng - Sử dụng ứng dụng di động để quản lý thú cưng và đặt lịch khám

| US Code | User Story | Status |
|---------|------------|--------|
| US-AUTH-01 | Đăng ký tài khoản với OTP Email | ✅ |
| US-AUTH-02 | Đăng nhập Username/Password | ✅ |
| US-AUTH-03 | Đăng nhập Google OAuth | ✅ |
| US-AUTH-04 | Quên mật khẩu & Reset Password | ✅ |
| US-USR-01 | Xem & Cập nhật thông tin cá nhân (Profile) | ✅ |
| US-PET-01 | CRUD Hồ sơ thú cưng | ✅ |
| US-PET-02 | Upload ảnh thú cưng | ✅ |
| US-DSC-01 | Tìm kiếm phòng khám gần đây | 🔄 |
| US-DSC-02 | Xem chi tiết phòng khám | 🔄 |
| US-DSC-03 | Filter phòng khám (khu vực, phường, thành phố, dịch vụ) | 💡 |
| US-DSC-04 | Đánh giá & Review Clinic (sau khám) | 💡 |
| US-DSC-05 | Đánh giá & Review Staff (sau khám) | 💡 |
| US-MED-01 | Xem lịch sử khám bệnh | 💡 |
| US-MED-03 | Xem sổ tiêm chủng điện tử | 💡 |
| US-APT-01 | Đặt lịch khám (manual) | 💡 |
| US-APT-03 | Staff click Check-in bắt đầu khám | 💡 |
| US-AI-02 | Chat với AI (hỏi triệu chứng) | 🔄 |
| US-AI-03 | Đặt lịch tự động với AI (AI Booking) | 💡 |
| US-AI-04 | Tìm dịch vụ phù hợp theo triệu chứng (AI Recommend) | 💡 |
| US-AI-05 | Tra cứu sản phẩm/vật dụng cho pet (AI Web Search) | 💡 |
| US-NTF-01 | Nhận thông báo đẩy (Push) | ✅ |
| US-NTF-03 | Xem danh sách thông báo | ✅ |
| US-SOS-01 | Tìm phòng khám cấp cứu | 💡 |
| US-SOS-02 | Đặt lịch SOS (Emergency Booking) | 💡 |
| US-SOS-03 | Theo dõi Staff di chuyển (Live GPS Tracking) | 💡 |
| US-PAY-01 | Thanh toán tiền mặt (Cash) | 💡 |
| US-PAY-02 | Thanh toán thẻ (Card) | 💡 |
| US-PAY-03 | Thanh toán QR Code (SePay) | 💡 |
| US-CHT-01 | Chat với Clinic Manager | 💡 |
| US-AUTH-06 | Hủy yêu cầu thay đổi Email (Cancel Email Change) | ✅ |

---

### 👨‍⚕️ Staff (Mobile App)
> Nhân viên thú y - Xem lịch làm việc, ghi bệnh án, và quản lý cuộc hẹn

| US Code | User Story | Status |
|---------|------------|--------|
| US-AUTH-02 | Đăng nhập Username/Password | ✅ |
| US-AUTH-04 | Quên mật khẩu & Reset Password | ✅ |
| US-USR-01 | Xem & Cập nhật thông tin cá nhân (Profile) | ✅ |
| US-SCH-03 | Xem lịch làm việc cá nhân | ✅ |
| US-APT-06 | Xem danh sách lịch hẹn sắp tới | 💡 |
| US-MED-01 | Xem lịch sử khám bệnh của Pet | 💡 |
| US-MED-02 | Ghi bệnh án SOAP | 💡 |
| US-MED-03 | Ghi/Xem sổ tiêm chủng | 💡 |
| US-APT-03 | Staff click Check-in bắt đầu khám | ✅ |
| US-APT-04 | Cập nhật dịch vụ phát sinh (nếu có) | ✅ |
| US-APT-05 | Checkout (hoàn thành khám) | ✅ |
| US-NTF-01 | Nhận thông báo đẩy (Push) | ✅ |
| US-NTF-03 | Xem danh sách thông báo | ✅ |
| US-APT-09 | Dashboard Tổng quan lịch hẹn (Staff Home Dashboard Summary) | ✅ |

---

### 👩‍💼 Clinic Manager (Web Portal)
> Quản lý phòng khám - Điều phối ca trực, nhân viên, và quản lý lịch hẹn

| US Code | User Story | Status |
|---------|------------|--------|
| US-AUTH-02 | Đăng nhập Username/Password | ✅ |
| US-AUTH-04 | Quên mật khẩu & Reset Password | ✅ |
| US-CLN-03 | Quản lý dịch vụ (Custom Pricing) | ✅ |
| US-CLN-04 | Quản lý nhân viên | ✅ |
| US-SCH-01 | Tạo ca trực cho nhân viên | ✅ |
| US-SCH-02 | Quản lý Slot (Block/Unblock) | ✅ |
| US-APT-02 | Quản lý lịch hẹn | 💡 |
| US-NTF-02 | Nhận Real-time Notification (SSE) | ✅ |
| US-NTF-03 | Xem Notification Center | ✅ |
| US-CHT-01 | Chat với Pet Owner | 💡 |
| US-SCH-04 | Block/Unblock Slot thủ công (Manual Slot Control) | ✅ |
| US-SCH-05 | Xóa ca trực hàng loạt (Bulk Shift Delete) | ✅ |
| US-APT-07 | Kiểm tra tính khả dụng của nhân viên (Check Staff Availability) | ✅ |
| US-APT-08 | Gán lại nhân viên cho dịch vụ (Reassign Staff) | ✅ |

---

### 🏥 Clinic Owner (Web Portal)
> Chủ phòng khám - Đăng ký phòng khám mới và quản lý thông tin phòng khám

| US Code | User Story | Status |
|---------|------------|--------|
| US-AUTH-02 | Đăng nhập Username/Password | ✅ |
| US-AUTH-04 | Quên mật khẩu & Reset Password | ✅ |
| US-CLN-01 | Đăng ký phòng khám | ✅ |
| US-CLN-03 | Quản lý dịch vụ (Master & Custom) | ✅ |
| US-CLN-04 | Quản lý nhân viên | ✅ |
| US-NTF-02 | Nhận Real-time Notification (SSE) | ✅ |
| US-NTF-03 | Xem Notification Center | ✅ |

---

### 🔧 Admin (Web Portal)
> Quản trị hệ thống - Duyệt phòng khám, quản lý Master Services, và cấu hình AI

| US Code | User Story | Status |
|---------|------------|--------|
| US-AUTH-02 | Đăng nhập Username/Password | ✅ |
| US-CLN-02 | Duyệt phòng khám (Approve/Reject) | ✅ |
| US-CLN-03 | Quản lý Master Services | ✅ |
| US-AD-11 | AI Feedback Audit & Visual Learning | ✅ |
| US-AD-12 | Knowledge Graph Management | ✅ |
| US-AD-13 | Knowledge Graph Query Testing | ✅ |

---

### 📊 Actor Summary

| Actor | Total US | Done | In Progress | Planned |
|-------|----------|------|-------------|---------|
| **Pet Owner** | 17 | 10 | 4 | 3 |
| **Staff** | 10 | 6 | 0 | 4 |
| **Clinic Manager** | 13 | 11 | 0 | 2 |
| **Clinic Owner** | 7 | 7 | 0 | 0 |
| **Admin** | 9 | 9 | 0 | 0 |

---

## 📊 EPIC SUMMARY & SPRINT ROADMAP

### 🎭 EPIC CATALOG (12 EPICs)

---

#### 🔐 EPIC 1: [EPIC-AUTH] Authentication & Identity System
| Attribute | Details |
|-----------|---------|
| **Goal** | Secure, seamless access control with JWT tokens and role-based permissions |
| **Sprints** | S1-S2 |
| **Status** | ✅ 100% Complete |

**Actor Benefits:**
- 🐾 **Pet Owner:** Register with OTP email, login with Google, reset password easily
- 👨‍⚕️ **Staff:** Login with auto-generated credentials from clinic
- 🔧 **Admin:** Secure access to admin portal

**Key Deliverables:**
- `US-AUTH-01` Register with OTP email verification
- `US-AUTH-02` Login with username/password
- `US-AUTH-03` Google OAuth sign-in
- `US-AUTH-04` Forgot password with OTP reset
- `US-AUTH-05` JWT refresh token rotation & session management

**Dependencies:** None (Foundation)

---

#### 👤 EPIC 2: [EPIC-USR] User Profile Management
| Attribute | Details |
|-----------|---------|
| **Goal** | Allow users to manage personal information, avatar, and account security |
| **Sprints** | S1 |
| **Status** | ✅ 100% Complete |

**Actor Benefits:**
- 🐾 **Pet Owner:** Update name, phone, upload avatar, change password
- 👨‍⚕️ **Staff:** View and update personal info on mobile

**Key Deliverables:**
- `US-USR-01` View & update profile (name, phone, avatar)
- `US-USR-02` Change password (requires current password)
- `US-USR-03` Change email (with OTP verification)

**Dependencies:** EPIC-AUTH (authentication required)

---

#### 🐕 EPIC 3: [EPIC-PET] Digital Pet Profiling
| Attribute | Details |
|-----------|---------|
| **Goal** | Pet Owner manages all pet information in one place with photos |
| **Sprints** | S2 |
| **Status** | ✅ 100% Complete |

**Actor Benefits:**
- 🐾 **Pet Owner:** Create multiple pet profiles with photos, track basic health info
- 👨‍⚕️ **Staff:** Quickly identify pets with photos before appointment

**Key Deliverables:**
- `US-PET-01` CRUD pet profiles (name, species, breed, DOB, weight)
- `US-PET-02` Upload pet avatar via Cloudinary

**Dependencies:** EPIC-AUTH (pet owner authentication)

---

#### 🏥 EPIC 4: [EPIC-CLINIC] Clinic Infrastructure & Onboarding
| Attribute | Details |
|-----------|---------|
| **Goal** | Clinic registration, services catalog, and staff management |
| **Sprints** | S2-S3 |
| **Status** | ✅ 100% Complete |

**Actor Benefits:**
- 🏥 **Clinic Owner:** Register clinic, manage services with custom pricing, add staff
- 👩‍💼 **Clinic Manager:** Add/remove vets, manage branch operations
- 🔧 **Admin:** Approve/reject clinic registrations

**Key Deliverables:**
- `US-CLN-01` Clinic registration (→ PENDING → Admin approval)
- `US-CLN-02` Admin approve/reject clinic
- `US-CLN-03` Master Services + custom pricing per clinic
- `US-CLN-04` Staff management (Quick Add Staff/Manager)

**Dependencies:** EPIC-AUTH (role-based access)

---

#### 📅 EPIC 5: [EPIC-SCHED] Scheduling & Shifts
| Attribute | Details |
|-----------|---------|
| **Goal** | Staff shift creation with automatic 30-min slot generation |
| **Sprints** | S4-S5 |
| **Status** | ✅ 100% Complete |

**Actor Benefits:**
- 👩‍💼 **Clinic Manager:** Create shifts easily, auto-generate slots, block/unblock slots
- 👨‍⚕️ **Staff:** View personal schedule on mobile + web (month/week/day views)

**Key Deliverables:**
- `US-SCH-01` Create vet shift → auto-generate 30-min slots
- `US-SCH-02` Block/Unblock slots for breaks or emergencies
- `US-SCH-03` Staff views personal schedule on mobile

**Dependencies:** EPIC-CLINIC (staff must exist), EPIC-AUTH

---

#### 🔔 EPIC 6: [EPIC-NOTI] Notification System
| Attribute | Details |
|-----------|---------|
| **Goal** | Push notifications (FCM), real-time SSE, and in-app notification center |
| **Sprints** | S4-S5 |
| **Status** | ✅ 100% Complete |

**Actor Benefits:**
- 🐾 **Pet Owner:** Receive booking confirmations, reminders on mobile
- 👨‍⚕️ **Staff:** Get notified of new assignments
- 👩‍💼 **Manager:** Real-time alerts for new bookings (SSE)

**Key Deliverables:**
- `US-NTF-01` Push notifications via Firebase Cloud Messaging
- `US-NTF-02` Real-time SSE for web portal
- `US-NTF-03` In-app notification center (mobile + web)

**Dependencies:** EPIC-AUTH (FCM token linked to user)

---

#### 🔍 EPIC 7: [EPIC-DISCOVERY] Clinic Search & Discovery
| Attribute | Details |
|-----------|---------|
| **Goal** | Help Pet Owners find clinics by location, services, and ratings |
| **Sprints** | S6-S7 |
| **Status** | 🔄 50% In Progress |

**Actor Benefits:**
- 🐾 **Pet Owner:** Find nearby clinics on map, filter by services/ratings, view details

**Key Deliverables:**
- `US-DSC-01` Nearby clinic search (Haversine GPS formula)
- `US-DSC-02` View clinic details (services, hours, gallery, reviews)
- `US-DSC-03` Filter by district, service type, rating
- `US-DSC-04` Review clinic after completed booking
- `US-DSC-05` Review vet after completed booking

**Dependencies:** EPIC-CLINIC (clinics must exist)

---

#### 🤖 EPIC 8: [EPIC-AI] AI Assistant Intelligence
| Attribute | Details |
|-----------|---------|
| **Goal** | Smart AI assistant with RAG knowledge, symptom checker, and auto-booking |
| **Sprints** | S5-S12 |
| **Status** | 🔄 80% In Progress |

**Actor Benefits:**
- 🐾 **Pet Owner:** Ask pet care questions, describe symptoms, book via AI
- 🔧 **Admin:** Manage knowledge base, configure AI parameters

**Key Deliverables:**
- `US-AI-01` RAG Knowledge Base setup (LlamaIndex + Qdrant)
- `US-AI-02` Pet care Q&A chat (RAG retrieval)
- `US-AI-03` Symptom checker with AI suggestions
- `US-AI-04` AI-assisted booking via conversation
- `US-AI-05` Web search for pet products (DuckDuckGo)
- `US-AI-06` AI Vision Pet Health Analysis (Images)
- `US-AI-11` AI Feedback Audit & Visual Learning
- `US-AI-12` Knowledge Graph Management & Visualization
- `US-AI-13` KB Image Embeddings (PDF images + Jina CLIP) ✅ NEW

**Dependencies:** EPIC-DISCOVERY (for AI booking), external AI services

---

#### 📋 EPIC 9: [EPIC-APPOINTMENT] Booking & Check-in
| Attribute | Details |
|-----------|---------|
| **Goal** | Complete appointment lifecycle from booking to checkout |
| **Sprints** | S7-S8 |
| **Status** | 🔄 60% In Progress (Backend Done) |

**Actor Benefits:**
- 🐾 **Pet Owner:** Book clinic/home visit, track status, cancel if needed
- 👩‍💼 **Manager:** View bookings, assign vets, manage cancellations
- 👨‍⚕️ **Staff:** Receives assigned bookings, performs check-in/out

**Key Deliverables:**
- `US-APT-01` Booking wizard (Pet → Clinic → Service → Staff → Slot)
- `US-APT-02` Manager booking management
- `US-APT-03` Check-in (Staff clicks button when pet arrives)
- `US-APT-04` Add incurred services during exam
- `US-APT-05` Checkout & generate invoice
- `US-APT-06` Staff views assigned bookings

**Dependencies:** EPIC-SCHED (slots), EPIC-DISCOVERY (clinic selection)

---

#### 📝 EPIC 10: [EPIC-MEDICAL] EMR & Health Records
| Attribute | Details |
|-----------|---------|
| **Goal** | Centralized medical history with SOAP notes and vaccination records |
| **Sprints** | S8 |
| **Status** | 🔄 50% In Progress (Backend Done) |

**Actor Benefits:**
- 👨‍⚕️ **Staff:** Record diagnoses professionally (SOAP format), prescriptions
- 🐾 **Pet Owner:** View pet's medical timeline, vaccination due dates

**Key Deliverables:**
- `US-MED-01` View pet medical history (cross-clinic)
- `US-MED-02` Create EMR with SOAP format + prescriptions
- `US-MED-03` Digital vaccination book with reminders

**Dependencies:** EPIC-APPOINTMENT (EMR created after check-in)

---

#### 🚨 EPIC 11: [EPIC-SOS] Emergency Rescue System
| Attribute | Details |
|-----------|---------|
| **Goal** | Emergency booking with real-time GPS tracking of vet |
| **Sprints** | S9 |
| **Status** | 💡 0% Not Started |

**Actor Benefits:**
- 🐾 **Pet Owner:** Create SOS request, track vet location live, get ETA
- 👨‍⚕️ **Staff:** Receives SOS assignment, auto-enable GPS, navigate to location

**Key Deliverables:**
- `US-SOS-01` Find nearest emergency clinic
- `US-SOS-02` Create SOS booking with high priority
- `US-SOS-03` Live GPS tracking with WebSocket

**Dependencies:** EPIC-APPOINTMENT, EPIC-SCHED (vet availability)

---

#### 💳 EPIC 12: [EPIC-PAYMENT] Payment & Billing
| Attribute | Details |
|-----------|---------|
| **Goal** | Support multiple payment methods for booking fees |
| **Sprints** | S9 |
| **Status** | 💡 0% Not Started |

**Actor Benefits:**
- 🐾 **Pet Owner:** Pay with cash, card (Stripe), or QR code (SePay)
- 🏥 **Clinic:** Track revenue, generate invoices

**Key Deliverables:**
- `US-PAY-01` Cash payment at clinic
- `US-PAY-02` Card payment via Stripe
- `US-PAY-03` QR code payment via SePay

**Dependencies:** EPIC-APPOINTMENT (payment linked to booking)

---

### 📅 Sprint Roadmap (10 Sprints)

| Sprint | Dates | Primary EPICs | Key Deliverables | Status |
|--------|-------|---------------|------------------|--------|
| Sprint | Dates | Primary EPICs | Key Deliverables | Status |
|--------|-------|---------------|------------------|--------|
| **S1** | 02/12 - 08/12/2025 | AUTH, USR | Register OTP, Login, Google OAuth, Profile | ✅ Done |
| **S2** | 09/12 - 15/12/2025 | AUTH, PET, CLINIC | Session mgmt, Pet CRUD, Clinic registration | ✅ Done |
| **S3** | 16/12 - 22/12/2025 | CLINIC | Staff management (Staff, Manager) | ✅ Done |
| **S4** | 23/12 - 29/12/2025 | SCHED, NOTI | Shift creation, Push/SSE notifications | ✅ Done |
| **S5** | 30/12 - 05/01/2026 | SCHED, AI | Block/Unblock slots, RAG knowledge base | ✅ Done |
| **S6** | 06/01 - 12/01/2026 | DISCOVERY, AI | Nearby search, Clinic detail, AI Chat | ✅ Done |
| **S7** | 13/01 - 19/01/2026 | DISCOVERY, APPOINTMENT | Clinic filters, Booking wizard | ✅ Done |
| **S8** | 20/01 - 26/01/2026 | APPOINTMENT, MEDICAL | Check-in/out, EMR SOAP, Vaccination | ✅ Done |
| **S9** | 27/01 - 02/02/2026 | SOS, PAYMENT | SOS booking, GPS tracking, Payments | ✅ Done |
| **S10** | 03/02 - 09/02/2026 | AI (Advanced) | AI booking, AI Recommend, Web Search | ✅ Done |
| **S11** | 10/02 - 16/02/2026 | PT_REVIEW | Review system, UI polishing (Neobrutalism) | ✅ Done |
| **S12** | 17/02 - 01/03/2026 | TESTING | Integration Testing, System Testing | ✅ Done |
| **S13** | 02/03 - 11/03/2026 | AI_DATA_IMPR | Feedback Audit, Knowledge Graph Query | ✅ Done |
| **S14** | 12/03 - 15/03/2026 | RELEASE | Final Audit, Walkthrough, Production Release | 🔄 Current |

---

### 🎯 Sprint Goals (Chi tiết)

#### ✅ S1 (02/12 - 08/12/2025): Authentication Foundation + User Profile
> **Sprint Goal:** Xây dựng nền tảng xác thực và cho phép người dùng quản lý thông tin cá nhân

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Đăng ký OTP** | US-AUTH-01 | Pet Owner có thể đăng ký tài khoản mới bằng email, nhận OTP xác thực, hoàn tất đăng ký |
| **Đăng nhập** | US-AUTH-02 | Tất cả user có thể đăng nhập bằng username/password, nhận JWT token |
| **Google OAuth** | US-AUTH-03 | Pet Owner có thể đăng nhập nhanh bằng tài khoản Google |
| **Quên mật khẩu** | US-AUTH-04 | User có thể reset password qua OTP email |
| **User Profile** | US-USR-01 | User có thể xem và cập nhật thông tin cá nhân (tên, avatar, số điện thoại) |

**Acceptance Criteria:** User có thể đăng ký, đăng nhập, reset password, và quản lý profile

---

#### ✅ S2 (09/12 - 15/12/2025): Auth Complete + Pet + Clinic Infrastructure
> **Sprint Goal:** Hoàn thiện xác thực, quản lý thú cưng, và đăng ký phòng khám

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Session Management** | US-AUTH-05 | Hệ thống tự động refresh token, blacklist token khi logout |
| **Pet CRUD** | US-PET-01 | Pet Owner có thể thêm/sửa/xóa hồ sơ thú cưng |
| **Pet Avatar** | US-PET-02 | Pet Owner có thể upload ảnh thú cưng lên Cloudinary |
| **Đăng ký phòng khám** | US-CLN-01 | Clinic Owner có thể đăng ký phòng khám với đầy đủ thông tin |
| **Admin duyệt** | US-CLN-02 | Admin có thể approve/reject phòng khám chờ duyệt |
| **Quản lý dịch vụ** | US-CLN-03 | Clinic có thể chọn từ Master Services và tùy chỉnh giá riêng |

**Acceptance Criteria:** Pet Owner quản lý thú cưng, Clinic đăng ký + dịch vụ, Admin duyệt

---

#### ✅ S3 (16/12 - 22/12/2025): Staff Management
> **Sprint Goal:** Quản lý nhân viên phòng khám

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Quản lý nhân viên** | US-CLN-04 | Clinic Owner/Manager có thể thêm/sửa/xóa nhân viên, gán role |

**Acceptance Criteria:** Clinic có thể quản lý nhân viên

---

#### ✅ S4 (23/12 - 29/12/2025): Scheduling & Notifications
> **Sprint Goal:** Tạo ca trực cho Staff và hệ thống thông báo

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Tạo ca trực** | US-SCH-01 | Clinic Manager có thể tạo ca trực cho Staff, hệ thống tự động sinh Slot |
| **Push Notification** | US-NTF-01 | Hệ thống gửi thông báo đẩy qua Firebase Cloud Messaging |
| **SSE Real-time** | US-NTF-02 | Web Portal nhận thông báo real-time qua Server-Sent Events |

**Acceptance Criteria:** Staff có lịch làm việc, user nhận được thông báo

---

#### ✅ S5 (30/12 - 05/01/2026): Scheduling + AI Setup
> **Sprint Goal:** Hoàn thiện quản lý lịch và triển khai AI Service cơ bản

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Block/Unblock Slot** | US-SCH-02 | Clinic Manager có thể block slot cho nghỉ/họp, unblock khi cần |
| **Staff Schedule** | US-SCH-03 | Staff xem lịch làm việc cá nhân trên Mobile App |
| **Notification Center** | US-NTF-03 | User xem lịch sử thông báo tại một nơi tập trung |
| **AI RAG Setup** | US-AI-01 | Triển khai LlamaIndex + Qdrant cho knowledge base thú y |

**Acceptance Criteria:** Staff có thể xem lịch làm việc, AI Service sẵn sàng cho chat

---

#### 🔄 S6 (06/01 - 12/01/2026): Discovery + AI Chat [CURRENT]
> **Sprint Goal:** Pet Owner có thể tìm kiếm phòng khám và hỏi AI về triệu chứng pet

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Nearby Search** | US-DSC-01 | Pet Owner tìm phòng khám gần vị trí hiện tại (Haversine formula) |
| **Clinic Detail** | US-DSC-02 | Pet Owner xem chi tiết phòng khám (dịch vụ, giờ mở cửa, reviews, ảnh) |
| **AI Chat** | US-AI-02 | Pet Owner chat với AI về triệu chứng pet, nhận gợi ý sơ bộ |

**Acceptance Criteria:** Pet Owner có thể tìm và xem thông tin phòng khám, chat với AI

---

#### 💡 S7 (13/01 - 19/01/2026): Discovery Complete + Booking Start + Chat
> **Sprint Goal:** Hoàn thiện tìm kiếm và bắt đầu luồng đặt lịch

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Filter Clinic** | US-DSC-03 | Lọc phòng khám theo quận/huyện, phường/xã, thành phố, loại dịch vụ |
| **Đặt lịch** | US-APT-01 | Pet Owner đặt lịch theo wizard: chọn Pet → Clinic → Service → Staff → Slot |
| **Staff Appointments** | US-APT-06 | Staff xem danh sách lịch hẹn sắp tới trên Mobile |
| **Chat P2P** | US-CHT-01 | Pet Owner và Clinic Manager chat real-time qua WebSocket |

**Acceptance Criteria:** Pet Owner có thể filter, đặt lịch và chat với phòng khám

---

#### 💡 S8 (20/01 - 26/01/2026): Medical + Booking Complete
> **Sprint Goal:** Triển khai EMR và hoàn thiện luồng khám bệnh từ check-in đến checkout

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Lịch sử khám** | US-MED-01 | Pet Owner/Staff xem timeline lịch sử khám bệnh của pet |
| **SOAP Notes** | US-MED-02 | Staff ghi bệnh án theo format SOAP (Subjective, Objective, Assessment, Plan) |
| **Sổ tiêm chủng** | US-MED-03 | Xem/ghi vaccine records với nhắc nhở lịch tiêm tiếp theo |
| **Quản lý booking** | US-APT-02 | Clinic Manager xem/xác nhận/hủy lịch hẹn |
| **Check-in** | US-APT-03 | Staff check-in khi pet/owner đến phòng khám |
| **Dịch vụ phát sinh** | US-APT-04 | Staff thêm dịch vụ phát sinh trong quá trình khám |
| **Checkout** | US-APT-05 | Staff/Clinic Manager hoàn thành khám và tạo hóa đơn |

**Acceptance Criteria:** Luồng khám hoàn chỉnh từ đặt lịch → check-in → khám → checkout

---

#### 💡 S9 (27/01 - 02/02/2026): SOS + Payment + Reviews
> **Sprint Goal:** Triển khai cấp cứu, thanh toán và đánh giá

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **Tìm cấp cứu** | US-SOS-01 | Tìm phòng khám cấp cứu gần nhất đang mở |
| **SOS Booking** | US-SOS-02 | Đặt lịch khẩn cấp với priority cao |
| **GPS Tracking** | US-SOS-03 | Theo dõi vị trí Staff di chuyển real-time |
| **Cash Payment** | US-PAY-01 | Thanh toán tiền mặt tại phòng khám |
| **Card Payment** | US-PAY-02 | Thanh toán bằng thẻ Visa/Mastercard |
| **QR Payment** | US-PAY-03 | Thanh toán bằng QR Code (SePay) |
| **Review Clinic** | US-DSC-04 | Pet Owner đánh giá phòng khám sau khi khám |
| **Review Staff** | US-DSC-05 | Pet Owner đánh giá Staff sau khi khám |

**Acceptance Criteria:** Hệ thống hỗ trợ cấp cứu, thanh toán đa phương thức, và reviews

---

#### 💡 S10+ (03/02 - 23/02/2026): AI Advanced + Polish
> **Sprint Goal:** Nâng cao AI features và hoàn thiện sản phẩm

| Deliverable | User Story | Mô tả chi tiết |
|-------------|------------|----------------|
| **AI Booking** | US-AI-03 | AI tự động đặt lịch dựa trên triệu chứng pet |
| **AI Recommend** | US-AI-04 | AI gợi ý dịch vụ phù hợp theo triệu chứng |
| **AI Web Search** | US-AI-05 | AI tìm kiếm web về sản phẩm/vật dụng cho pet |
| **Bug Fixing** | - | Sửa các bugs phát hiện trong quá trình testing |
| **System Testing** | - | Chạy full regression test |
| **Deployment** | - | Deploy lên production environment |

**Acceptance Criteria:** Sản phẩm sẵn sàng cho production, AI hoạt động intelligent

---

## 📝 EPIC 1: [EPIC-AUTH] Authentication & Identity System ✅ 100%
> **Goal:** Secure login, registration, JWT session management, and RBAC
> **Benefits:** All actors access platform securely with role-based permissions

### 🔹 US-AUTH-01: Đăng ký tài khoản với OTP Email ✅
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** register an account using my email with OTP verification  
> **So that** I can securely create my account and start using the app to manage my pets

**Sprint:** S1 | **Verified Files:** `RegistrationOtpService.java`, `register_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ✅ |
| Code BE: RegistrationOtpService | DEV-1 | 8h | ✅ |
| Code FE: Mobile Register Screen | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 3h | ✅ |
| Viết system test (Report 5) | DEV-4 | 3h | ✅ |
| Run test & fix bugs | DEV-4 | 4h | ✅ |

---

### 🔹 US-AUTH-02: Đăng nhập Username/Password ✅
> **Actor:** Pet Owner, Staff, Clinic Manager, Clinic Owner, Admin  
> **As a** User, **I want to** log in using my username and password  
> **So that** I can access my account and use the platform's features based on my role

**Sprint:** S1 | **Verified Files:** `AuthService.login()`, `login_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 3h | ✅ |
| Code BE: AuthService.login() | DEV-1 | 8h | ✅ |
| Code FE: Mobile/Web Login Screen | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-AUTH-03: Đăng nhập Google OAuth ✅
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** sign in quickly using my Google account  
> **So that** I don't need to remember another password and can start using the app immediately

**Sprint:** S1 | **Verified Files:** `GoogleAuthService.java`, `AuthService.loginWithGoogle()`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ✅ |
| Code BE: GoogleAuthService | DEV-1 | 6h | ✅ |
| Code FE: Firebase Auth integration | DEV-3 | 8h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-AUTH-04: Quên mật khẩu & Reset Password ✅
> **Actor:** Pet Owner, Staff, Clinic Manager, Clinic Owner  
> **As a** User, **I want to** reset my password via OTP email  
> **So that** I can recover my account if I forget my password

**Sprint:** S2 | **Verified Files:** `PasswordResetService.java`, `forgot_password_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 3h | ✅ |
| Code BE: PasswordResetService | DEV-1 | 6h | ✅ |
| Code FE: Mobile Forgot/Reset screens | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-AUTH-05: Refresh Token & Session Management ✅
> **Actor:** All Users (System)  
> **As a** System, **I want to** automatically refresh access tokens  
> **So that** users stay logged in securely without frequent re-authentication

**Sprint:** S2 | **Verified Files:** `RefreshToken.java`, `BlacklistedToken.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ✅ |
| Code BE: Token rotation, Blacklist | DEV-1 | 8h | ✅ |
| Code FE: AuthInterceptor | DEV-3 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 3h | ✅ |

---

## 📝 EPIC 2: [EPIC-PET] Digital Pet Profiling System ✅ 100%
> **Goal:** CRUD pet profiles with photos and basic health info
> **Benefits:** Pet Owner manages all pets in one place, Staff identify pets easily

### 🔹 US-PET-01: CRUD Hồ sơ thú cưng ✅
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** create, view, edit, and delete my pet profiles  
> **So that** I can manage all my pets' information in one place

**Sprint:** S2 | **Verified Files:** `PetController.java`, `pet_list_screen.dart`, `pet_detail_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ✅ |
| Code BE: Pet Entity, Repository, Service | DEV-1 | 6h | ✅ |
| Code FE: Mobile Pet List & Form | DEV-2 | 8h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 3h | ✅ |

---

### 🔹 US-PET-02: Upload ảnh thú cưng ✅
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** upload photos of my pets  
> **So that** vets can easily identify my pet and I have visual records

**Sprint:** S2 | **Verified Files:** `CloudinaryService.java`, `add_edit_pet_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 1h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 2h | ✅ |
| Code BE: CloudinaryService | DEV-1 | 4h | ✅ |
| Code FE: Image Picker Widget | DEV-2 | 5h | ✅ |
| Viết unit test | DEV-1 | 1h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

## 📝 EPIC 3: [EPIC-CLINIC] Clinic Infrastructure & Onboarding ✅ 100%
> **Goal:** Clinic registration, services catalog, and staff management
> **Benefits:** Clinic Owner builds presence, Manager manages team, Admin approves clinics

### 🔹 US-CLN-01: Đăng ký phòng khám ✅
> **Actor:** Clinic Owner  
> **As a** Clinic Owner, **I want to** register my veterinary clinic on the platform  
> **So that** my clinic can receive appointments and be discovered by pet owners

**Sprint:** S3 | **Verified Files:** `Clinic.java`, `ClinicController.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 3h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ✅ |
| Code BE: Clinic Entity, ClinicService | DEV-1 | 8h | ✅ |
| Code FE: Web Clinic Registration Form | DEV-2 | 8h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 3h | ✅ |
| Run test & fix bugs | DEV-4 | 3h | ✅ |

---

### 🔹 US-CLN-02: Duyệt phòng khám ✅
> **Actor:** Admin  
> **As an** Admin, **I want to** review and approve/reject clinic registrations  
> **So that** only legitimate clinics can operate on the platform

**Sprint:** S3 | **Verified Files:** `ClinicService.approveClinic()`, Web Admin pages

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 3h | ✅ |
| Code BE: Admin approval API | DEV-1 | 4h | ✅ |
| Code FE: Web Admin Dashboard | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-CLN-03: Quản lý dịch vụ ✅
> **Actor:** Clinic Owner, Clinic Manager  
> **As a** Clinic Owner/Manager, **I want to** manage my clinic's services and custom pricing  
> **So that** I can offer appropriate services with competitive prices

**Sprint:** S3 | **Verified Files:** `MasterService.java`, `ClinicServiceService.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ✅ |
| Code BE: MasterService, ClinicServiceService | DEV-1 | 8h | ✅ |
| Code FE: Web Service Management | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-CLN-04: Quản lý nhân viên ✅
> **Actor:** Clinic Owner, Clinic Manager  
> **As a** Clinic Owner/Manager, **I want to** add, edit, and remove staff members  
> **So that** I can manage my clinic team and assign roles appropriately

**Sprint:** S4 | **Verified Files:** `ClinicStaffController.java`, `ClinicStaffService.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ✅ |
| Code BE: ClinicStaffService, Quick Add | DEV-1 | 6h | ✅ |
| Code FE: Web Staff Table | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

## 📝 EPIC 4: [EPIC-DISCOVERY] Clinic Discovery & Search 🔄 50%
> **Goal:** Search clinics by location, services, and ratings with filters
> **Benefits:** Pet Owner finds nearby clinics easily, Clinics gain visibility

### 🔹 US-DSC-01: Tìm kiếm phòng khám gần đây 🔄 70%
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** search for nearby veterinary clinics based on my location  
> **So that** I can find convenient clinics for my pet's healthcare needs

**Sprint:** S6 | **Verified Files:** `LocationService.java`, `ClinicRepository.findNearby()`  
**Missing:** Mobile Clinic Discovery Screen

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ✅ |
| Code BE: Haversine query, LocationService | DEV-1 | 6h | ✅ |
| Code FE: Mobile Clinic Discovery | DEV-3 | 8h | 🔄 |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-DSC-02: Xem chi tiết phòng khám 🔄 50%
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** view detailed information about a clinic (services, hours, reviews, photos)  
> **So that** I can make an informed decision before booking an appointment

**Sprint:** S6 | **Missing:** Mobile Clinic Detail Screen

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ✅ |
| Code BE: Clinic detail API | DEV-1 | 4h | ✅ |
| Code FE: Mobile Clinic Detail Screen | DEV-3 | 8h | 🔄 |
| Viết unit test | DEV-1 | 1h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-DSC-03: Filter phòng khám (Khu vực, Dịch vụ) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** filter clinics by area (district, ward, city) and services offered  
> **So that** I can narrow down my search to find the most suitable clinic

**Sprint:** S7 | **Missing:** Filter UI + Filter API

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ⏳ |
| Code BE: Filter API (district, ward, city, service) | DEV-1 | 6h | ⏳ |
| Code FE: Mobile Filter UI (chips, dropdowns) | DEV-3 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-DSC-04: Đánh giá & Review Clinic 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** rate and review a clinic after my appointment  
> **So that** other pet owners can benefit from my experience

**Sprint:** S8 | **Missing:** Review Entity, Review API

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ⏳ |
| Code BE: Review Entity, CRUD API | DEV-1 | 6h | ⏳ |
| Code FE: Mobile Review Form + Display | DEV-3 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-DSC-05: Đánh giá & Review Staff 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** rate and review a specific vet after my appointment  
> **So that** I can share my experience about the vet's professionalism

**Sprint:** S8 | **Missing:** Staff Review Entity

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ⏳ |
| Code BE: VetReview Entity, API | DEV-1 | 5h | ⏳ |
| Code FE: Mobile Staff Review UI | DEV-3 | 6h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

## 📝 EPIC 5: [EPIC-SCHED] Scheduling & Shifts ✅ 100%
> **Goal:** Staff shift creation with automatic slot generation, block/unblock
> **Benefits:** Manager creates schedules easily, Staff sees personal calendar

### 🔹 US-SCH-01: Tạo ca trực cho nhân viên ✅
> **Actor:** Clinic Manager  
> **As a** Clinic Manager, **I want to** create work shifts for veterinarians  
> **So that** I can schedule my vets and the system auto-generates bookable slots

**Sprint:** S4 | **Verified Files:** `StaffShift.java`, `Slot.java`, `StaffShiftService.createShifts()`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 3h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 5h | ✅ |
| Code BE: StaffShift, Slot auto-generation | DEV-1 | 12h | ✅ |
| Code FE: Web Shift Calendar View | DEV-2 | 10h | ✅ |
| Viết unit test | DEV-1 | 3h | ✅ |
| Viết system test (Report 5) | DEV-4 | 3h | ✅ |
| Run test & fix bugs | DEV-4 | 4h | ✅ |

---

### 🔹 US-SCH-02: Quản lý Slot (Block/Unblock) ✅
> **Actor:** Clinic Manager  
> **As a** Clinic Manager, **I want to** block or unblock specific time slots  
> **So that** I can temporarily disable slots for breaks, meetings, or emergencies

**Sprint:** S5 | **Verified Files:** `StaffShiftService.blockSlot()`, `StaffShiftService.unblockSlot()`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 3h | ✅ |
| Code BE: blockSlot, unblockSlot API | DEV-1 | 4h | ✅ |
| Code FE: Web Slot Management UI | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-SCH-03: Xem lịch làm việc cá nhân ✅
> **Actor:** Staff  
> **As a** Staff, **I want to** view my personal work schedule on my mobile  
> **So that** I know when and where I need to work each day

**Sprint:** S5 | **Verified Files:** `staff_schedule_screen.dart`, `staff_home_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ✅ |
| Code BE: GET /shifts/me | DEV-1 | 3h | ✅ |
| Code FE: Mobile Staff Schedule Screen | DEV-3 | 8h | ✅ |
| Viết unit test | DEV-1 | 1h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

## 📝 EPIC 10: [EPIC-MEDICAL] EMR, Vaccination & Medical History 💡 0%
> **Goal:** Centralized medical history and vaccination records for cross-clinic access
> **Benefits:** Pet Owner views health history, Staff records diagnoses professionally
> **Status:** ❌ Not started

### 🔹 US-MED-01: Xem lịch sử khám bệnh 💡 Planned
> **Actor:** Pet Owner, Staff  
> **As a** Pet Owner, **I want to** view my pet's complete medical history across all clinics  
> **So that** any vet can access previous diagnoses and treatments

**Sprint:** S6-S7 | **Missing:** `EMR.java`, `EMRController.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ⏳ |
| Code BE: EMR Entity, History API | DEV-1 | 8h | ⏳ |
| Code FE: Mobile EMR Timeline | DEV-3 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### 🔹 US-MED-02: Ghi bệnh án SOAP 💡 Planned
> **Actor:** Staff  
> **As a** Staff, **I want to** record medical notes using the SOAP format  
> **So that** I can document diagnosis and treatment plans professionally

**Sprint:** S7 | **Missing:** SOAP form implementation

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ⏳ |
| Code BE: EMR CRUD API | DEV-1 | 8h | ⏳ |
| Code FE: Mobile SOAP Form | DEV-3 | 10h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### 🔹 US-MED-03: Sổ tiêm chủng điện tử 💡 Planned
> **Actor:** Pet Owner, Staff  
> **As a** Pet Owner, **I want to** view my pet's vaccination records and upcoming due dates  
> **So that** I never miss an important vaccination appointment

**Sprint:** S7 | **Missing:** `Vaccination.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ⏳ |
| Code BE: Vaccination Entity, CRUD API | DEV-1 | 6h | ⏳ |
| Code FE: Mobile Vaccine Card View | DEV-2 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

## 📝 EPIC 9: [EPIC-APPOINTMENT] Booking, Check-in & Status Tracking 💡 0%
> **Goal:** Complete appointment lifecycle from booking to checkout
> **Benefits:** Pet Owner books easily, Manager assigns vets, Staff manages appointments
> **Status:** ❌ Not started

### 🔹 US-APT-01: Đặt lịch khám 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** book an appointment by selecting pet → clinic → service → vet → slot  
> **So that** I can schedule a visit for my pet's healthcare needs

**Sprint:** S7-S8 | **Missing:** `Booking.java`, BookingController

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 4h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 6h | ⏳ |
| Code BE: Booking Entity, Service | DEV-1 | 16h | ⏳ |
| Code FE: Mobile Booking Wizard | DEV-2 | 16h | ⏳ |
| Viết unit test | DEV-1 | 4h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 4h | ⏳ |
| Run test & fix bugs | DEV-4 | 6h | ⏳ |

---

### 🔹 US-APT-02: Quản lý lịch hẹn (Clinic Manager) 💡 Planned
> **Actor:** Clinic Manager  
> **As a** Clinic Manager, **I want to** view, filter, and manage all clinic bookings  
> **So that** I can coordinate the clinic's daily operations efficiently

**Sprint:** S8 | **Missing:** Web Booking Management

#### Acceptance Criteria:
1. **View Bookings List:**
   - Xem tất cả bookings theo ngày/tuần/tháng
   - Filter theo status: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
   - Filter theo Staff được assign
   - Filter theo loại dịch vụ (CLINIC_VISIT, HOME_VISIT)

2. **Assign Staff to Booking:**
   - Xem danh sách bookings PENDING chưa có Staff
   - Chọn Staff available trong time slot đó
   - Sau khi assign → Status chuyển PENDING → CONFIRMED
   - Notify cả Pet Owner VÀ Staff

3. **Reassign Staff:**
   - Đổi Staff khác nếu booking chưa IN_PROGRESS
   - Notify Staff cũ (bị hủy assign) + Staff mới + Pet Owner

4. **View Booking Details:**
   - Xem thông tin Pet, Owner, Service, Time
   - Xem notes từ Pet Owner
   - Xem Staff được assign

5. **Approve/Reject Cancel Request:**
   - Pet Owner gửi yêu cầu hủy → Manager approve/reject
   - Nếu approved → Trigger refund (nếu có)

> 💡 **Lưu ý:** Manager assign Staff, booking tự động CONFIRMED. Staff KHÔNG có quyền Accept/Reject.

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ⏳ |
| Code BE: Booking status workflow | DEV-1 | 8h | ⏳ |
| Code FE: Web Booking List + Filters | DEV-2 | 6h | ⏳ |
| Code FE: Web Assign Staff Modal | DEV-2 | 4h | ⏳ |
| Code FE: Web Booking Detail View | DEV-2 | 4h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 3h | ⏳ |

---

### 🔹 US-APT-03: Check-in bắt đầu khám (Staff) 💡 Planned
> **Actor:** Staff  
> **As a** Staff, **I want to** click check-in to start the examination when the pet/owner arrives  
> **So that** the booking status changes to IN_PROGRESS and I can begin working

**Sprint:** S8 | **Missing:** Check-in button implementation

#### Acceptance Criteria:
1. **View Assigned Bookings Today:**
   - Danh sách bookings được assign cho Staff hôm nay
   - Hiển thị: Pet name, Service, Time, Status
   - Filter: CONFIRMED (đợi khám), IN_PROGRESS (đang khám)

2. **Check-in Action:**
   - Staff click "Check-in" trên booking CONFIRMED
   - Status: CONFIRMED → IN_PROGRESS
   - check_in_time = now()
   - Notify Pet Owner: "Lịch hẹn đang bắt đầu"

3. **View Booking Details:**
   - Xước Pet info, Owner contact, Service details
   - Xem lịch sử EMR cũ của pet (nếu có)
   - Xem sổ tiêm chủng

> 💡 **Lưu ý:** Check-in = bắt đầu thực hiện dịch vụ. Sau khi khám xong + thu tiền → Checkout để hoàn thành.

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ⏳ |
| Code BE: Check-in API | DEV-1 | 4h | ⏳ |
| Code FE: Mobile Assigned Bookings List | DEV-3 | 4h | ⏳ |
| Code FE: Mobile Check-in Button | DEV-3 | 2h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-APT-04: Cập nhật dịch vụ phát sinh (Staff/Manager) 💡 Planned
> **Actor:** Staff, Clinic Manager
> **As a** Staff or Clinic Manager, **I want to** add additional services to a booking
> **So that** the final bill accurately reflects all services provided

**Sprint:** S8 | **Missing:** Additional Services UI

#### Acceptance Criteria:
1. **Add Incurred Service:**
   - Có thể thêm dịch vụ khi booking đang CONFIRMED hoặc IN_PROGRESS (trước khi checkout)
   - Chọn từ danh sách dịch vụ của clinic
   - Nhập số lượng (quantity)
   - Ghi chú lý do (optional)
   - **HOME_VISIT:** Staff chỉ thêm được dịch vụ trong chuyên môn của mình
   - **IN_CLINIC:** Manager có thể thêm bất kỳ dịch vụ nào

2. **View Added Services:**
   - Danh sách dịch vụ đã thêm vào booking
   - Tổng tiền cập nhật realtime
   - Có thể xóa dịch vụ phát sinh (trước khi checkout)

3. **Pricing Update:**
   - API tự động tính lại total_amount
   - Áp dụng giá theo weight tier (nếu có)

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ⏳ |
| Code BE: Incurred Service API | DEV-1 | 4h | ⏳ |
| Code FE: Mobile Add Service Form | DEV-3 | 4h | ⏳ |
| Code FE: Mobile Services List View | DEV-3 | 3h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-APT-05: Checkout - Hoàn thành khám (Staff) 💡 Planned
> **Actor:** Staff  
> **As a** Staff, **I want to** mark an appointment as completed and finalize the bill  
> **So that** the Pet Owner can proceed to payment and the booking is closed properly

**Sprint:** S8 | **Missing:** Checkout workflow

#### Acceptance Criteria:
1. **Review Before Checkout:**
   - Hiển thị tổng hợp: Dịch vụ chính + Dịch vụ phát sinh
   - Tổng tiền cuối cùng
   - Xác nhận EMR đã được ghi (nếu có)

2. **Handle Payment:**
   - **Đã thanh toán online (PAID):** Chỉ cần click Checkout
   - **Thanh toán tiền mặt (UNPAID):** Thu tiền → Đánh dấu PAID → Checkout
   - Update payment_status = PAID

3. **Complete Booking:**
   - Status: IN_PROGRESS → COMPLETED
   - checkout_time = now()
   - Generate invoice (PDF - optional)

4. **Notifications:**
   - Notify Pet Owner: "Lịch hẹn hoàn thành. Xem hóa đơn trong app."
   - Trigger Staff Rating popup (sau 30s)
   - Schedule Clinic Review reminder (sau 24h)

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ⏳ |
| Code BE: Checkout API, Payment update | DEV-1 | 6h | ⏳ |
| Code FE: Mobile Checkout Summary | DEV-3 | 4h | ⏳ |
| Code FE: Mobile Payment Collection | DEV-3 | 4h | ⏳ |
| Code FE: Mobile Invoice View | DEV-3 | 3h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 3h | ⏳ |

---

## 📝 EPIC 8: [EPIC-AI] AI Assistant Intelligence 🔄 60%
> **Goal:** Smart AI assistant using RAG, symptom checker, and automated booking
> **Benefits:** Pet Owner gets instant advice, Admin manages knowledge base

### 🔹 US-AI-01: RAG Knowledge Base Setup ✅
> **Actor:** Admin (System Setup)  
> **As an** Admin, **I want to** set up the AI knowledge base with veterinary information  
> **So that** the AI can provide accurate pet health advice

**Sprint:** S5 | **Verified Files:** AI Service (FastAPI), Web Admin Playground

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-5 | 3h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-5 | 4h | ✅ |
| Code AI: LlamaIndex + Qdrant setup | DEV-5 | 12h | ✅ |
| Code FE: Web Admin Playground | DEV-2 | 6h | ✅ |
| Viết unit test | DEV-5 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 3h | ✅ |
| Run test & fix bugs | DEV-4 | 4h | ✅ |

---

### 🔹 US-AI-02: Chat với AI 🔄 30%
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** chat with an AI assistant about my pet's symptoms  
> **So that** I can get initial guidance before deciding to visit a vet

**Sprint:** S6 | **Missing:** Mobile Chat UI Screen

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-5 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-5 | 4h | ✅ |
| Code AI: Chat streaming endpoint | DEV-5 | 10h | ✅ |
| Code FE: Mobile Chat UI | DEV-3 | 10h | ⏳ |
| Viết unit test | DEV-5 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### � US-AI-03: Đặt lịch tự động với AI (AI Booking) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** ask AI to book an appointment for me based on my pet's symptoms  
> **So that** I can quickly get an appointment without manually searching

**Sprint:** S8 | **Missing:** AI Booking Tool implementation

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-5 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-5 | 4h | ⏳ |
| Code AI: create_booking_for_user tool + function calling | DEV-5 | 12h | ⏳ |
| Code BE: AI Booking API integration | DEV-1 | 6h | ⏳ |
| Code FE: Mobile AI Booking confirmation | DEV-3 | 6h | ⏳ |
| Viết unit test | DEV-5 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### 🔹 US-AI-04: Tìm dịch vụ phù hợp (AI Service Recommend) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want AI to** recommend appropriate services based on my pet's symptoms  
> **So that** I know which services to book and what to expect

**Sprint:** S8 | **Missing:** AI Service Recommendation tool

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-5 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-5 | 3h | ⏳ |
| Code AI: recommend_service tool | DEV-5 | 8h | ⏳ |
| Code FE: Display recommendations in chat | DEV-3 | 4h | ⏳ |
| Viết unit test | DEV-5 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-AI-05: Tra cứu sản phẩm cho pet (AI Web Search) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want AI to** search the web for pet products, food, and accessories  
> **So that** I can find suitable items for my pet's needs

**Sprint:** S8 | **Missing:** AI Web Search integration

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-5 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-5 | 3h | ⏳ |
| Code AI: web_search tool (DuckDuckGo) | DEV-5 | 6h | ⏳ |
| Code FE: Display search results with links | DEV-3 | 4h | ⏳ |
| Viết unit test | DEV-5 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

## 📝 EPIC 6: [EPIC-NOTI] Omnichannel Notification System ✅ 100%
> **Goal:** Push, SSE, and in-app notifications across all platforms
> **Benefits:** All actors stay informed in real-time

### 🔹 US-NTF-01: Push Notification (FCM) ✅
> **Actor:** Pet Owner, Staff, Clinic Manager  
> **As a** User, **I want to** receive push notifications on my mobile device  
> **So that** I'm instantly informed about appointments, reminders, and updates

**Sprint:** S4 | **Verified Files:** `FcmService.java`, `FcmController.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ✅ |
| Code BE: FcmService | DEV-1 | 6h | ✅ |
| Code FE: Mobile FCM handling | DEV-3 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 3h | ✅ |

---

### 🔹 US-NTF-02: Real-time Notification (SSE) ✅
> **Actor:** Clinic Manager, Clinic Owner, Admin  
> **As a** Web Portal User, **I want to** receive real-time notifications  
> **So that** I'm immediately alerted to new bookings or important events

**Sprint:** S4 | **Verified Files:** `SseController.java`, `SseEmitterService.java`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 3h | ✅ |
| Code BE: SseEmitterService | DEV-1 | 6h | ✅ |
| Code FE: Web SSE listener + Toast | DEV-2 | 4h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 2h | ✅ |

---

### 🔹 US-NTF-03: Notification Center ✅
> **Actor:** All Users  
> **As a** User, **I want to** view all my notifications in one place  
> **So that** I can review past alerts and take necessary actions

**Sprint:** S5 | **Verified Files:** `NotificationsPage.tsx`, `notification_list_screen.dart`

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ✅ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 3h | ✅ |
| Code BE: NotificationController | DEV-1 | 4h | ✅ |
| Code FE: Web NotificationsPage (x3) | DEV-2 | 8h | ✅ |
| Code FE: Mobile NotificationList | DEV-3 | 6h | ✅ |
| Viết unit test | DEV-1 | 2h | ✅ |
| Viết system test (Report 5) | DEV-4 | 2h | ✅ |
| Run test & fix bugs | DEV-4 | 3h | ✅ |

---

## 📝 EPIC 11: [EPIC-SOS] Emergency Rescue System 💡 0%
> **Goal:** Real-time emergency response with live GPS tracking
> **Benefits:** Pet Owner gets urgent help, Staff navigates to location

### 🔹 US-SOS-01: Tìm phòng khám cấp cứu 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner in an emergency, **I want to** quickly find the nearest available emergency clinic  
> **So that** my pet can receive urgent care as fast as possible

**Sprint:** S8 | **Missing:** All components

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ⏳ |
| Code BE: Emergency filter API | DEV-1 | 8h | ⏳ |
| Code FE: Mobile SOS Mode | DEV-3 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### � US-SOS-02: Đặt lịch SOS (Emergency Booking) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner in an emergency, **I want to** immediately book an emergency appointment  
> **So that** the clinic and vet are prepared when I arrive

**Sprint:** S8 | **Missing:** Emergency booking workflow

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ⏳ |
| Code BE: SOS Booking API | DEV-1 | 8h | ⏳ |
| Code FE: Mobile SOS Booking Flow | DEV-3 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### 🔹 US-SOS-03: Theo dõi Staff di chuyển (Live GPS Tracking) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner waiting for a home-visit vet during SOS, **I want to** track the vet's live location  
> **So that** I know when the vet will arrive and can prepare

**Sprint:** S8 | **Missing:** WebSocket GPS tracking

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ⏳ |
| Code BE: WebSocket GPS Endpoint | DEV-1 | 10h | ⏳ |
| Code FE: Mobile Map Tracking UI | DEV-3 | 12h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

## 📝 EPIC 12: [EPIC-PAYMENT] Payment & Billing System 💡 0%
> **Goal:** Support multiple payment methods (Cash, Card, QR)
> **Benefits:** Pet Owner pays conveniently, Clinic tracks revenue

### 🔹 US-PAY-01: Thanh toán bằng tiền mặt (Cash) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** pay with cash at the clinic after my appointment  
> **So that** I can use my preferred payment method

**Sprint:** S8 | **Missing:** Payment Entity, Bill generation

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 3h | ⏳ |
| Code BE: Payment Entity, Cash flow | DEV-1 | 6h | ⏳ |
| Code FE: Mobile Payment Selection | DEV-3 | 4h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 2h | ⏳ |
| Run test & fix bugs | DEV-4 | 2h | ⏳ |

---

### 🔹 US-PAY-02: Thanh toán bằng thẻ (Card) 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** pay with my debit/credit card  
> **So that** I can complete payment quickly without carrying cash

**Sprint:** S8 | **Missing:** Card payment integration

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ⏳ |
| Code BE: Card payment gateway integration | DEV-1 | 12h | ⏳ |
| Code FE: Mobile Card Input Form | DEV-3 | 6h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

### 🔹 US-PAY-03: Thanh toán bằng QR Code 💡 Planned
> **Actor:** Pet Owner  
> **As a** Pet Owner, **I want to** scan a QR code to pay via my banking app  
> **So that** I can pay quickly using SePay or banking apps

**Sprint:** S8 | **Missing:** QR payment integration

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-1 | 2h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-1 | 4h | ⏳ |
| Code BE: QR generation, SePay integration | DEV-1 | 14h | ⏳ |
| Code FE: Mobile QR Display + Scanner | DEV-3 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

## ? EPIC 11: [EPIC-CHAT] In-App Messaging System ?? 0%
> **Goal:** Real-time chat between Pet Owner and Clinic for appointment coordination

### 🔹 US-CHT-01: Chat với Clinic/Pet Owner 💡 Planned
> **Actor:** Pet Owner, Clinic Manager  
> **As a** Pet Owner, **I want to** chat directly with the clinic staff  
> **So that** I can ask questions about my appointment or my pet's condition

**Sprint:** S7 | **Missing:** Chat Entity, WebSocket implementation

| Sub-task | Assignee | Effort | Status |
|----------|----------|--------|--------|
| Viết spec (Report 3) | DEV-3 | 3h | ⏳ |
| Viết class/sequence diagram (Report 4) | DEV-3 | 4h | ⏳ |
| Code BE: ChatMessage Entity, WebSocket | DEV-1 | 12h | ⏳ |
| Code FE: Mobile Chat UI | DEV-3 | 10h | ⏳ |
| Code FE: Web Chat UI | DEV-2 | 8h | ⏳ |
| Viết unit test | DEV-1 | 2h | ⏳ |
| Viết system test (Report 5) | DEV-4 | 3h | ⏳ |
| Run test & fix bugs | DEV-4 | 4h | ⏳ |

---

## ??? BUG TRACKING

| Bug ID | Related US | Description | Assignee | Status |
|--------|------------|-------------|----------|--------|
| BUG-001 | US-SCH-02 | Sidebar stats không update sau block slot | DEV-2 | ✅ Fixed |
| BUG-002 | US-SCH-01 | Day View cards không click được | DEV-2 | ✅ Fixed |
| BUG-003 | US-SCH-01 | Highlight sai khi switch tab Gán lịch | DEV-2 | ✅ Fixed |

---

## 📈 PROGRESS SUMMARY

| Epic | User Stories | Done | In Progress | Planned | Progress |
|------|--------------|------|-------------|---------|----------|
| EPIC-AUTH | 5 | 5 | 0 | 0 | ✅ 100% |
| EPIC-PET | 2 | 2 | 0 | 0 | ✅ 100% |
| EPIC-CLINIC | 4 | 4 | 0 | 0 | ✅ 100% |
| EPIC-DISCOVERY | 5 | 0 | 2 | 3 | 🔄 40% |
| EPIC-SCHED | 3 | 3 | 0 | 0 | ✅ 100% |
| EPIC-MEDICAL | 3 | 0 | 2 | 1 | ? 50% |
| EPIC-APPOINTMENT | 5 | 3 | 1 | 1 | ? 80% |
| EPIC-AI | 5 | 1 | 1 | 3 | 🔄 30% |
| EPIC-NOTI | 3 | 3 | 0 | 0 | ✅ 100% |
| EPIC-SOS | 3 | 0 | 0 | 3 | 💡 0% |
| EPIC-PAYMENT | 3 | 0 | 0 | 3 | 💡 0% |
| EPIC-CHAT | 1 | 0 | 0 | 1 | 💡 0% |
| **TOTAL** | **42** | **21** | **6** | **15** | **58%** |

---

**Author:** Petties Team  
**Last Updated:** 20/01/2026  
**Audited By:** Codebase analysis
