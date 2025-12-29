# PROJECT WORK BREAKDOWN STRUCTURE (DETAILED)
## PETTIES - Veterinary Appointment Booking Platform

**Project Duration:** 14 Sprints (1 Week/Sprint)
**Timeline:** 10/12/2025 - 18/03/2026
**Strategy:** Complete Core Business Features by Sprint 6
**Last Updated:** December 29, 2025

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Hoàn thành cả BE + FE + Test |
| 🔶 BE Done | Chỉ có Backend, thiếu Frontend |
| 🔷 FE Done | Chỉ có Frontend, thiếu Backend |
| 🔄 In Progress | Đang làm |
| ⏳ Pending | Chưa bắt đầu |
| ❌ Deferred | Hoãn sang Phase 2 |

---

## 📋 SPRINT 1: Setup & Infrastructure ✅ COMPLETED

### 1.1 Backend APIs - Authentication Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/auth/register` | POST | Đăng ký tài khoản mới với email | ✅ |
| `/api/auth/login` | POST | Đăng nhập bằng email/password | ✅ |
| `/api/auth/google` | POST | Đăng nhập bằng Google OAuth | ✅ |
| `/api/auth/send-otp` | POST | Gửi OTP qua email để xác thực | ✅ |
| `/api/auth/verify-otp` | POST | Xác thực OTP | ✅ |
| `/api/auth/refresh-token` | POST | Làm mới access token | ✅ |
| `/api/auth/forgot-password` | POST | Gửi OTP reset password | ✅ |
| `/api/auth/reset-password` | POST | Đặt lại password với OTP | ✅ |

### 1.2 Backend APIs - User Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/users/me` | GET | Lấy thông tin user hiện tại | ✅ |
| `/api/users/me` | PUT | Cập nhật thông tin cá nhân | ✅ |
| `/api/users/me/avatar` | POST | Upload avatar lên Cloudinary | ✅ |
| `/api/users/me/change-password` | PUT | Đổi password | ✅ |

### 1.3 Web Frontend - Auth Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **LoginPage** | `/login` | Email input, Password input, Google Sign-in button, Forgot password link | ✅ |
| **RegisterPage** | `/register` | Full name, Email, Password, Confirm password, OTP verification modal | ✅ |
| **ForgotPasswordPage** | `/forgot-password` | Email input, Send OTP button | ✅ |
| **ResetPasswordPage** | `/reset-password` | OTP input, New password, Confirm password | ✅ |

### 1.4 Mobile Frontend - Auth Screens

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **LoginScreen** | `/login` | Logo, Email field, Password field, Login button, Google sign-in, Register link | ✅ |
| **RegisterScreen** | `/register` | Full name, Email, Phone, Password fields, OTP bottom sheet | ✅ |
| **ForgotPasswordScreen** | `/forgot-password` | Email input, Send OTP button | ✅ |
| **ResetPasswordScreen** | `/reset-password` | OTP input (6 digits), New password fields | ✅ |

### 1.5 DevOps & Infrastructure

| Task | Description | Status |
|------|-------------|:------:|
| Docker Compose | docker-compose.dev.yml, docker-compose.test.yml, docker-compose.prod.yml | ✅ |
| GitHub Actions CI | Build + Lint + Test on PR | ✅ |
| GitHub Actions CD | Auto deploy to EC2 on push to main/develop | ✅ |
| Production Server | api.petties.world (EC2) | ✅ |
| Test Server | api-test.petties.world (EC2) | ✅ |
| Frontend Hosting | www.petties.world (Vercel) | ✅ |

---

## 📋 SPRINT 2: Pet & Clinic Management ✅ COMPLETED

### 2.1 Backend APIs - Pet Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/pets` | POST | Tạo hồ sơ thú cưng mới (name, species, breed, weight, dob, photo) | ✅ |
| `/api/pets` | GET | Lấy danh sách pets của user hiện tại | ✅ |
| `/api/pets/{id}` | GET | Lấy chi tiết một pet | ✅ |
| `/api/pets/{id}` | PUT | Cập nhật thông tin pet | ✅ |
| `/api/pets/{id}` | DELETE | Xóa pet | ✅ |
| `/api/pets/{id}/photo` | POST | Upload ảnh pet lên Cloudinary | ✅ |

### 2.2 Backend APIs - Clinic Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/clinics` | POST | Tạo phòng khám mới (name, address, phone, description, operatingHours) | ✅ |
| `/api/clinics` | GET | Lấy danh sách clinics (filter by owner, status) | ✅ |
| `/api/clinics/{id}` | GET | Lấy chi tiết clinic | ✅ |
| `/api/clinics/{id}` | PUT | Cập nhật thông tin clinic | ✅ |
| `/api/clinics/{id}` | DELETE | Xóa clinic (soft delete) | ✅ |
| `/api/clinics/{id}/images` | POST | Upload ảnh clinic (gallery) | ✅ |
| `/api/clinics/{id}/images/{imageId}/primary` | PUT | Set ảnh chính cho clinic | ✅ |
| `/api/clinics/pending` | GET | [ADMIN] Lấy danh sách clinics chờ duyệt | ✅ |
| `/api/clinics/{id}/approve` | PUT | [ADMIN] Phê duyệt clinic | ✅ |
| `/api/clinics/{id}/reject` | PUT | [ADMIN] Từ chối clinic với lý do | ✅ |

### 2.3 Backend APIs - Service Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/master-services` | POST | [ADMIN] Tạo master service (name, category, description, defaultPrice) | ✅ |
| `/api/master-services` | GET | Lấy danh sách master services | ✅ |
| `/api/master-services/{id}` | PUT | [ADMIN] Cập nhật master service | ✅ |
| `/api/master-services/{id}` | DELETE | [ADMIN] Xóa master service | ✅ |
| `/api/clinics/{clinicId}/services` | POST | Tạo clinic service (inherit hoặc custom) | ✅ |
| `/api/clinics/{clinicId}/services` | GET | Lấy danh sách services của clinic | ✅ |
| `/api/clinics/{clinicId}/services/{id}` | PUT | Cập nhật clinic service (price override) | ✅ |
| `/api/clinics/{clinicId}/services/{id}` | DELETE | Xóa clinic service | ✅ |

### 2.4 Backend APIs - Pricing Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/clinics/{clinicId}/prices` | POST | Tạo pricing rule (basePrice, pricePerKm, weightTiers) | ✅ |
| `/api/clinics/{clinicId}/prices` | GET | Lấy pricing rules của clinic | ✅ |
| `/api/clinics/{clinicId}/prices/calculate` | POST | Tính giá dựa trên service, weight, distance | ✅ |

### 2.5 Web Frontend - Admin Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **AdminDashboardPage** | `/admin` | Stats cards (users, clinics, bookings), Recent activities list | ✅ |
| **ClinicApprovalPage** | `/admin/clinics/approval` | Pending clinics table, Clinic detail modal, Approve/Reject buttons with reason input | ✅ |

### 2.6 Web Frontend - Clinic Owner Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **OwnerDashboardPage** | `/owner` | Clinic stats cards, Revenue chart, Quick actions | ✅ |
| **ClinicsListPage** | `/owner/clinics` | Clinics table (name, status, address), Create clinic button, Status badges | ✅ |
| **ClinicCreatePage** | `/owner/clinics/create` | Form: Basic info (inc. email/specific location) → Address → Operating hours → License upload → Images | ✅ |
| **ClinicDetailPage** | `/owner/clinics/:id` | Clinic info card, Image gallery, Operating hours table, Services list, Staff list, Rejection reason (if any) | ✅ |
| **ClinicEditPage** | `/owner/clinics/:id/edit` | Edit form với all clinic fields (inc. specific_location, email, business_license), Image manager | ✅ |
| **ServicesPage** | `/owner/clinics/:id/services` | Services table, Add service modal (inherit/custom), Price editor | ✅ |
| **MasterServicesPage** | `/owner/services/master` | Master services catalog, Search/filter, Select to inherit | ✅ |

### 2.7 Mobile Frontend - Pet Screens

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **PetListScreen** | `/pets` | Pet cards grid (photo, name, species), Add pet FAB, Empty state | ✅ |
| **PetDetailScreen** | `/pets/:id` | Large photo, Pet info card (name, breed, weight, age), Edit/Delete buttons | ✅ |
| **AddEditPetScreen** | `/pets/add`, `/pets/:id/edit` | Photo picker, Name input, Species dropdown, Breed input, Weight input, DOB picker | ✅ |

---

## 📋 SPRINT 3: Staff & Scheduling 🔄 IN PROGRESS

### 3.1 Backend APIs - Staff Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/clinics/{clinicId}/staff` | POST | Quick add staff (fullName, phone, role: VET/MANAGER) - auto create account | ✅ |
| `/api/clinics/{clinicId}/staff` | GET | Lấy danh sách staff của clinic | ✅ |
| `/api/clinics/{clinicId}/staff/{userId}` | DELETE | Remove staff khỏi clinic (không xóa account) | ✅ |
| `/api/clinics/{clinicId}/staff/{userId}/deactivate` | PUT | Deactivate staff account | ✅ |

### 3.2 Backend APIs - Notification Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/notifications` | GET | Lấy danh sách notifications của user (paginated) | ✅ |
| `/api/notifications/{id}/read` | PUT | Đánh dấu notification đã đọc | ✅ |
| `/api/notifications/read-all` | PUT | Đánh dấu tất cả đã đọc | ✅ |
| `/api/notifications/unread-count` | GET | Lấy số notification chưa đọc | ✅ |

### 3.3 Backend APIs - VetShift Module ⏳

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/clinics/{clinicId}/shifts` | POST | Tạo ca làm việc cho vet (vetId, date, startTime, endTime, breakStart, breakEnd) | ⏳ |
| `/api/clinics/{clinicId}/shifts` | GET | Lấy danh sách shifts (filter by vetId, dateRange) | ⏳ |
| `/api/clinics/{clinicId}/shifts/{id}` | PUT | Cập nhật shift | ⏳ |
| `/api/clinics/{clinicId}/shifts/{id}` | DELETE | Xóa shift (cascade delete slots) | ⏳ |
| `/api/clinics/{clinicId}/shifts/check-overlap` | POST | Kiểm tra overlap trước khi tạo shift | ⏳ |
| `/api/vets/me/shifts` | GET | [VET] Lấy lịch làm việc của bản thân | ⏳ |

### 3.4 Backend APIs - Slot Module ⏳

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/clinics/{clinicId}/slots` | GET | Lấy danh sách slots (filter by date, vetId, status) | ⏳ |
| `/api/clinics/{clinicId}/slots/available` | GET | Lấy slots trống cho booking (date, serviceId) | ⏳ |
| `/api/slots/{id}/block` | PUT | Block slot (không cho đặt) | ⏳ |
| `/api/slots/{id}/unblock` | PUT | Unblock slot | ⏳ |

**Slot Generation Logic:**
- Khi tạo VetShift, hệ thống tự động tạo Slots 30 phút
- Bỏ qua thời gian break (12:00-13:00)
- Slot status: AVAILABLE, BOOKED, BLOCKED

### 3.5 Backend APIs - Search Module ⏳

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/clinics/nearby` | GET | Tìm clinics gần vị trí (lat, lng, radiusKm, serviceType) | ⏳ |
| `/api/clinics/search` | GET | Search clinics (keyword, city, district, services) | ⏳ |
| `/api/geocode/address` | GET | Convert địa chỉ thành lat/lng | ⏳ |

### 3.6 Web Frontend - Clinic Owner Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **StaffManagementPage** | `/owner/clinics/:id/staff` | Staff table (name, phone, role, status), Quick add modal, Deactivate button | ✅ |
| **NotificationsPage** | `/owner/notifications` | Notification list, Mark read button, Filter by type | ✅ |

### 3.7 Web Frontend - Clinic Manager Pages ⏳

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **ManagerDashboardPage** | `/manager` | Today's bookings count, Pending assignments, Quick stats | ✅ |
| **VetsManagementPage** | `/manager/vets` | Vets table, View schedule button | ✅ |
| **CalendarViewPage** | `/manager/calendar` | Weekly/Daily calendar grid, Vet filter dropdown, Shift blocks (draggable), Create shift modal | ⏳ |
| **CreateShiftModal** | Modal | Vet selector, Date picker, Start/End time, Break time inputs, Overlap warning | ⏳ |

### 3.8 Mobile Frontend - Vet Screens ⏳

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **VetHomeScreen** | `/vet` | Today's appointments list, Quick stats card | ✅ |
| **VetScheduleScreen** | `/vet/schedule` | Calendar view (monthly), Day detail list, Shift info cards | ⏳ |

### 3.9 Web Frontend - Vet Pages ⏳

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **VetSchedulePage** | `/vet/schedule` | Calendar view (Weekly/Daily), Shift blocks, Booking details tooltip | ⏳ |

### 3.10 Mobile Frontend - Pet Owner Screens ⏳

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **ClinicDiscoveryScreen** | `/discovery` | Map View (Google Maps/Leaflet), Search bar, Gallery of nearby clinics, Service category filters | ⏳ |
| **SearchFilterScreen** | `/discovery/filters` | Distance slider, Rating filter, Service type checkboxes, Price range filter | ⏳ |

---

## 📋 SPRINT 4: Booking Core Flow ⏳ PENDING

### 4.1 Backend APIs - Booking Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/bookings` | POST | Tạo booking mới (clinicId, serviceId, slotIds, petId, type: IN_CLINIC/HOME_VISIT, notes) | ⏳ |
| `/api/bookings` | GET | Lấy danh sách bookings (filter by status, clinicId, userId, dateRange) | ⏳ |
| `/api/bookings/{id}` | GET | Lấy chi tiết booking | ⏳ |
| `/api/bookings/{id}/cancel` | PUT | Hủy booking (với reason, chỉ được hủy trước 24h) | ⏳ |
| `/api/bookings/{id}/assign` | PUT | [MANAGER] Gán vet cho booking | ⏳ |
| `/api/bookings/{id}/approve` | PUT | [VET] Approve booking đã được gán | ⏳ |
| `/api/bookings/{id}/reject` | PUT | [VET] Reject booking với lý do | ⏳ |
| `/api/bookings/{id}/check-in` | PUT | [VET] Check-in bệnh nhân | ⏳ |
| `/api/bookings/{id}/check-out` | PUT | [VET] Check-out bệnh nhân | ⏳ |
| `/api/users/me/bookings` | GET | Lấy bookings của user hiện tại | ⏳ |

**Booking State Machine:**
```
PENDING ──[assign]──> ASSIGNED ──[approve]──> CONFIRMED ──[check-in]──> IN_PROGRESS ──[check-out]──> COMPLETED
    │                     │                       │
    └──[cancel]──> CANCELLED    └──[reject]──> REJECTED    └──[cancel]──> CANCELLED
```

### 4.2 Web Frontend - Manager Booking Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **BookingListPage** | `/manager/bookings` | Bookings table (pet, owner, service, status, time), Status filter tabs, Search input | ⏳ |
| **BookingDetailModal** | Modal | Pet info, Owner info, Service details, Timeline (status history), Assign vet dropdown | ⏳ |
| **AssignVetModal** | Modal | Available vets list (based on slot), Vet workload indicator, Assign button | ⏳ |

### 4.3 Web Frontend - Vet Booking Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **VetBookingsPage** | `/vet/bookings` | Assigned bookings list, Status tabs (Pending/Today/Completed), Approve/Reject buttons | ⏳ |
| **VetBookingDetailPage** | `/vet/bookings/:id` | Pet medical info, Owner contact, Check-in/Check-out buttons, Notes input | ⏳ |

### 4.4 Mobile Frontend - Pet Owner Booking Screens

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **ClinicDetailScreen** | `/clinics/:id` | Clinic photos carousel, Info card, Services list, Operating hours, Reviews summary, Book button | ⏳ |
| **ServiceSelectionScreen** | `/booking/services` | Services list with prices, Pet selector dropdown, Service description | ⏳ |
| **SlotPickerScreen** | `/booking/slots` | Calendar date picker, Available time slots grid (30min), Select multiple slots support | ⏳ |
| **BookingConfirmScreen** | `/booking/confirm` | Summary card (clinic, service, pet, time, price), Notes input, Confirm button, Price breakdown | ⏳ |
| **BookingSuccessScreen** | `/booking/success` | Success animation, Booking ID, Add to calendar button, View booking button | ⏳ |
| **MyBookingsScreen** | `/my-bookings` | Bookings list grouped by status (Upcoming/Past), Booking cards with status badge | ⏳ |
| **BookingDetailScreen** | `/my-bookings/:id` | Booking info card, Status timeline, Clinic info, Cancel button (if applicable), Chat button | ⏳ |

### 4.5 Mobile Frontend - Vet Booking Screens

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **VetBookingsScreen** | `/vet/bookings` | Today's bookings list, Upcoming tab, History tab | ⏳ |
| **VetBookingDetailScreen** | `/vet/bookings/:id` | Pet info card, Owner info, Approve/Reject buttons, Check-in/Check-out buttons | ⏳ |

---

## 📋 SPRINT 5: Chat System + Vet Operations ⏳ PENDING

### 5.1 Backend APIs - Chat Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/conversations` | GET | Lấy danh sách conversations của user | ⏳ |
| `/api/conversations` | POST | Tạo conversation mới (participantIds, bookingId optional) | ⏳ |
| `/api/conversations/{id}` | GET | Lấy chi tiết conversation với messages | ⏳ |
| `/api/conversations/{id}/messages` | GET | Lấy messages (paginated, cursor-based) | ⏳ |
| `/api/conversations/{id}/messages` | POST | Gửi message mới (text, imageUrl optional) | ⏳ |
| `/api/conversations/{id}/read` | PUT | Đánh dấu đã đọc đến message cuối | ⏳ |
| `WS /ws/chat` | WebSocket | Real-time chat connection (send/receive messages, typing indicator) | ⏳ |

**Chat Rules:**
- Pet Owner ↔ Clinic Manager: Có thể chat bất kỳ lúc nào
- Pet Owner ↔ Vet: Chỉ chat được sau khi booking CONFIRMED
- Conversation tự động tạo khi booking được confirm

### 5.2 Web Frontend - Chat Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **ChatListPage** | `/manager/chats` | Conversations list, Unread badges, Last message preview, Online status | ⏳ |
| **ChatRoomPage** | `/manager/chats/:id` | Message bubbles, Input box, Send button, Image upload, Typing indicator | ⏳ |
| **VetChatPage** | `/vet/chats` | Same as manager chat but for vet role | ⏳ |

### 5.3 Mobile Frontend - Chat Screens

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **ChatListScreen** | `/chats` | Conversation cards (avatar, name, last message, time, unread count), Pull to refresh | ⏳ |
| **ChatRoomScreen** | `/chats/:id` | Messages list, Text input, Send button, Image picker, Typing indicator, Scroll to bottom | ⏳ |

### 5.4 Web Frontend - Vet Operation Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **VetDashboardPage** | `/vet` | Today's schedule, Pending approvals count, Quick actions | ✅ |
| **VetBookingActionsPage** | `/vet/bookings/:id/actions` | Approve/Reject panel, Check-in/Check-out buttons, Notes editor | ⏳ |

---

## 📋 SPRINT 6: AI Integration + Notifications + Polish ⏳ PENDING

### 6.1 AI Service APIs - Agent Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/chat` | POST | Send message to AI agent (sync response) | ✅ |
| `WS /ws/chat` | WebSocket | Real-time AI chat với streaming response | ✅ |
| `/api/settings/agent` | GET | Lấy agent configuration | ✅ |
| `/api/settings/agent` | PUT | Cập nhật agent config (prompt, temperature, model) | ✅ |
| `/api/settings/tools` | GET | Lấy danh sách tools | ✅ |
| `/api/settings/tools/{name}/toggle` | PUT | Bật/tắt tool | ✅ |

### 6.2 AI Service - MCP Tools

| Tool Name | Description | Parameters | Status |
|-----------|-------------|------------|:------:|
| `pet_care_qa` | RAG-based Q&A cho kiến thức chăm sóc thú cưng | query: string, top_k: int | ✅ |
| `symptom_search` | Tìm bệnh dựa trên triệu chứng | symptoms: string[], pet_type: string | ✅ |
| `search_clinics` | Tìm phòng khám gần vị trí user | location: string, service_type: string, radius_km: int | ⏳ |
| `check_slots` | Kiểm tra slots trống của clinic | clinic_id: int, date: string, service_id: int | ⏳ |
| `create_booking` | Tạo booking qua chat | clinic_id, service_id, slot_id, pet_id, notes | ⏳ |

### 6.3 Backend APIs - Push Notification Module

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/users/me/fcm-token` | PUT | Đăng ký FCM token cho push notifications | ⏳ |
| `/api/notifications/settings` | GET | Lấy notification preferences | ⏳ |
| `/api/notifications/settings` | PUT | Cập nhật notification preferences | ⏳ |

**Push Notification Triggers:**
- Booking status changes (ASSIGNED, CONFIRMED, CANCELLED, etc.)
- New chat message
- Appointment reminder (24h, 1h before)
- Vet assigned to booking

### 6.4 Web Frontend - Admin AI Pages

| Page | Route | UI Components | Status |
|------|-------|---------------|:------:|
| **ToolsPage** | `/admin/tools` | Tools table, Enable/Disable toggle, Schema viewer | ✅ |
| **KnowledgePage** | `/admin/knowledge` | Documents list, Upload button, Delete button, Vector count | ✅ |
| **PlaygroundPage** | `/admin/playground` | Chat input, Messages list, ReAct trace panel, Model selector, Temperature slider | ✅ |
| **AgentConfigPage** | `/admin/agent` | System prompt editor, Hyperparameters sliders, Save button | ✅ |

### 6.5 Mobile Frontend - AI Chat Screen

| Screen | Route | UI Components | Status |
|--------|-------|---------------|:------:|
| **AIChatScreen** | `/ai-chat` | Chat messages, Text input, Send button, Typing indicator, Tool call cards, Citation links | ⏳ |

### 6.6 Polish & QA Tasks

| Task | Platform | Description | Status |
|------|----------|-------------|:------:|
| Cancel Booking Flow | BE + Mobile | Cancel button, Confirmation modal, Refund policy display | ⏳ |
| Today Dashboard | Web | Manager dashboard với today's bookings, pending tasks | ⏳ |
| Error Handling | All | Consistent error messages, Retry mechanisms | ⏳ |
| Loading States | All | Skeleton loaders, Pull-to-refresh | ⏳ |
| E2E Testing | All | Critical flows testing | ⏳ |

---

## 📋 SPRINT 7-8: EMR & Medical Records ❌ PHASE 2

### 7.1 Backend APIs - EMR Module (Phase 2)

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/pets/{petId}/emrs` | GET | Lấy danh sách hồ sơ bệnh án của pet | ❌ |
| `/api/bookings/{bookingId}/emr` | POST | [VET] Tạo hồ sơ bệnh án (Bắt buộc Booking) | ❌ |
| `/api/emrs/{id}` | GET | Lấy chi tiết EMR | ❌ |
| `/api/emrs/{id}` | PUT | [VET] Cập nhật EMR | ❌ |
| `/api/pets/{petId}/vaccinations` | GET | Lấy sổ tiêm chủng | ❌ |
| `/api/bookings/{bookingId}/vaccinations` | POST | [VET] Thêm mũi tiêm (Bắt buộc Booking) | ❌ |

### 7.2 Backend APIs - Prescription Module (Phase 2)

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/emr/{emrId}/prescriptions` | POST | [VET] Tạo đơn thuốc | ❌ |
| `/api/emr/{emrId}/prescriptions` | GET | Lấy đơn thuốc của EMR | ❌ |

---

## 📋 SPRINT 9-10: Payment & Rating ❌ PHASE 2

### 9.1 Backend APIs - Payment Module (Phase 2)

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/payments/create-intent` | POST | Tạo Stripe payment intent | ❌ |
| `/api/payments/confirm` | POST | Xác nhận payment | ❌ |
| `/api/payments/webhook` | POST | Stripe webhook handler | ❌ |
| `/api/bookings/{id}/payment` | GET | Lấy payment status của booking | ❌ |

### 9.2 Backend APIs - Rating Module (Phase 2)

| API Endpoint | Method | Description | Status |
|--------------|--------|-------------|:------:|
| `/api/reviews` | POST | Tạo review sau khi booking completed | ❌ |
| `/api/clinics/{id}/reviews` | GET | Lấy reviews của clinic | ❌ |
| `/api/vets/{id}/reviews` | GET | Lấy reviews của vet | ❌ |

---

## 📋 SPRINT 11-14: Advanced Features ❌ PHASE 2

### Phase 2 Features (Deferred)

| Feature | Description | Status |
|---------|-------------|:------:|
| Home Visit GPS Tracking | Realtime tracking vị trí vet khi đến nhà | ❌ |
| Video Consultation | Video call với vet qua WebRTC | ❌ |
| SOS Emergency | Tìm clinic cấp cứu gần nhất | ❌ |
| Excel Import | Import lịch làm việc từ Excel | ❌ |
| Revenue Dashboard | Thống kê doanh thu cho Owner | ❌ |
| Multi-language | Hỗ trợ đa ngôn ngữ | ❌ |

---

## 📊 PROGRESS SUMMARY

| Sprint | Status | Completion |
|--------|:------:|:----------:|
| Sprint 1: Auth & Setup | ✅ Done | 100% |
| Sprint 2: Pet & Clinic | ✅ Done | 100% |
| Sprint 3: Staff & Scheduling | 🔄 In Progress | 50% |
| Sprint 4: Booking Core | ⏳ Pending | 0% |
| Sprint 5: Chat + Vet Ops | ⏳ Pending | 0% |
| Sprint 6: AI + Notifications | ⏳ Pending | 30% |
| Sprint 7-14: Phase 2 | ❌ Deferred | - |

**Overall Progress: ~45% Complete**

---

## 👥 TEAM ASSIGNMENT

| Member | Primary Responsibility |
|--------|----------------------|
| **Tân** | DevOps, AI Service, Chat System |
| **Triết** | Backend APIs (Booking, Search, Notifications) |
| **Huyền** | Web Frontend (Manager, Calendar, Chat) |
| **Uyên** | Mobile Frontend (All screens) |
| **Tuân** | Backend APIs (VetShift, Slot, EMR) |

---

## 🎯 SPRINT 6 COMPLETION CRITERIA

### Must Have (MVP):
- [ ] Pet Owner có thể tìm clinic và đặt lịch qua mobile
- [ ] Manager có thể xem calendar và gán vet cho booking
- [ ] Vet có thể approve/reject và check-in/check-out
- [ ] Chat realtime giữa Pet Owner ↔ Manager ↔ Vet
- [ ] AI có thể tìm clinic, check slots qua chat
- [ ] Push notifications cho booking status

### Nice to Have:
- [ ] AI có thể tạo booking qua chat
- [ ] Booking reminder notifications
- [ ] Cancel booking flow hoàn chỉnh

---

**Document Version:** 2.0
**Last Updated:** December 29, 2025
**Author:** Petties Development Team
