# Wireframe Generation Checklist

This document tracks the generation of black & white wireframes for the Petties SRS documentation, aligned with implemented features.
**Style Constraint:** Strictly monochrome (Black/White/Gray).
**Status Legend:**
- [x] : Wireframe Generated (Stitch ID recorded)
- [ ] : Implemented in Code, Waiting for Wireframe
- [-] : Not Implemented yet (Out of scope for now)

## 📱 Petties Mobile (Project ID: `875246162632064109`)

### Authentication (Module 3.2)
- [x] **Login Screen** (UC-AUTH-02)
  - Code: `login_screen.dart`
  - Stitch ID: `316370f46ea94ee78d2138a66165cef3`
- [x] **Register Screen** (UC-AUTH-01)
  - Code: `register_screen.dart`
  - Stitch ID: `3f1613c55e43486ca8376f8ffa3a5029`
- [x] **Forgot Password Screen** (UC-AUTH-01b)
  - Code: `forgot_password_screen.dart`
  - Stitch ID: `c6a7dae33f65480aa1ae48ffc95cd05c`
- [x] **Reset Password Screen** (UC-AUTH-01b)
  - Code: `reset_password_screen.dart`
  - Stitch ID: `6b662e8441f2474e9706fe08e53ccccc`

### Pet Owner Features (Module 3.4, 3.5, 3.8)
- [x] **Home Screen** (Dashboard)
  - Code: `pet_owner_home_screen.dart`
  - Stitch ID: `97f0d0ca8d734addb0f10acae7530bad`
- [x] **My Pets List** (UC-PET-01)
  - Code: `pet_list_screen.dart`
  - Stitch ID: `3ae47297704944c79e468b47b7c5b6d1`
- [x] **Pet Detail Screen** (UC-PET-01)
  - Code: `pet_detail_screen.dart`
  - Stitch ID: `dbb245dbb84849d2aef20fe66c2c42e7`
- [x] **Add/Edit Pet Screen** (UC-PET-01)
  - Code: `add_edit_pet_screen.dart`
  - Stitch ID: `4d5b63f07af84b7fa4ebcbb6687e0e9b`
- [ ] **Pet Health Record Screen** (UC-PET-04)
  - Code: `lib/ui/pet/pet_health_record_screen.dart`
  - *UI Description: Hiển thị lịch sử khám bệnh, vaccination records, và hồ sơ y tế của thú cưng. Bao gồm timeline EMR, vaccination schedule.*
- [x] **Clinic Search Screen** (UC-CLINIC-01)
  - Code: `clinic_search_view.dart`
  - Stitch ID: `25b0b6b584034eb481f493dda4bad9a2`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [x] **Clinic Detail Screen** (UC-CLINIC-02)
  - Code: `clinic_detail_view.dart`
  - Stitch ID: `fcc442313bda4ac29be75b60da96db05`
- [x] **Clinic Map View**
  - Code: `clinic_map_view.dart`
  - Stitch ID: `20db7a9a56fc46dbbfc46835ec8ea577`
- [x] **Clinic Services Screen**
  - Code: `clinic_all_services_screen.dart`
  - Stitch ID: `e2cc78e8214a44f4849983c99fe32314`

### Booking Features (Module 3.8, 3.9)
- [ ] **Select Pet Screen** (UC-BOOK-01)
  - Code: `lib/ui/booking/select_pet_screen.dart`
  - *UI Description: Chọn thú cưng để đặt lịch khám. Hiển thị danh sách pets với avatar, tên, loài. Có nút "Thêm pet mới".*
- [ ] **Select Services Screen** (UC-BOOK-02)
  - Code: `lib/ui/booking/select_services_screen.dart`
  - *UI Description: Chọn dịch vụ khám (Grooming, Vaccination, Checkup, etc.). Multi-select với tính tổng giá tiền realtime.*
- [ ] **Select Date & Time Screen** (UC-BOOK-03)
  - Code: `lib/ui/booking/select_datetime_screen.dart`
  - *UI Description: Calendar view chọn ngày, sau đó hiển thị available time slots dựa trên Smart Availability algorithm.*
- [ ] **Booking Confirm Screen** (UC-BOOK-04)
  - Code: `lib/ui/booking/booking_confirm_screen.dart`
  - *UI Description: Review toàn bộ thông tin booking (Pet, Services, DateTime, Clinic, Estimated Duration/Total). Nút "XÁC NHẬN ĐẶT LỊCH".*
- [ ] **Booking Success Screen** (UC-BOOK-05)
  - Code: `lib/ui/booking/booking_success_screen.dart`
  - *UI Description: Màn hình thành công với booking code, QR code, và các nút "XEM CHI TIẾT", "VỀ TRANG CHỦ".*
- [ ] **Booking Detail Screen** (UC-BOOK-06)
  - Code: `lib/ui/booking/booking_detail_screen.dart`
  - *UI Description: Chi tiết booking với timeline status, thông tin pet, services, staff assigned, total payment. Các nút action theo status (Cancel, Check-in, etc.).*
- [ ] **My Bookings Screen** (UC-BOOK-07)
  - Code: `lib/ui/booking/my_bookings_screen.dart`
  - *UI Description: Danh sách bookings với tabs: "Sắp tới", "Đang diễn ra", "Đã hoàn thành", "Đã hủy". Card booking hiển thị status, date, clinic, pet.*

### Profile & Settings (Module 3.11)
- [ ] **Profile Screen** (UC-PROF-01)
  - Code: `lib/ui/profile/profile_screen.dart`
  - *UI Description: Hiển thị thông tin user (Avatar, Name, Email, Phone). Menu các options: Edit Profile, Change Password, Notifications, About, Logout.*
- [ ] **Edit Profile Screen** (UC-PROF-02)
  - Code: `lib/ui/profile/edit_profile_screen.dart`
  - *UI Description: Form chỉnh sửa profile (Full Name, Phone, Avatar upload). Nút "LƯU THAY ĐỔI".*
- [ ] **Change Password Screen** (UC-PROF-03)
  - Code: `lib/ui/profile/change_password_screen.dart`
  - *UI Description: Form đổi password (Current Password, New Password, Confirm New Password). Validation rules hiển thị realtime.*
- [ ] **Notification Settings Screen** (UC-PROF-04)
  - Code: `lib/ui/profile/notification_settings_screen.dart`
  - *UI Description: Toggle switches cho các loại notifications (Booking reminders, SOS alerts, Promotions, System updates).*

### Chat & AI Features (Module 3.13)
- [ ] **Chat List Screen** (UC-CHAT-01)
  - Code: `lib/ui/chat/chat_list_screen.dart`
  - *UI Description: Danh sách conversations với AI Agent hoặc Staff. Hiển thị avatar, tên, last message, timestamp.*
- [ ] **Chat Detail Screen** (UC-CHAT-02)
  - Code: `lib/ui/chat/chat_detail_screen.dart`
  - *UI Description: Chat interface với bubble messages (user/agent), input box, send button. Hiển thị ReAct flow (Thought → Action → Observation) cho AI responses.*
- [ ] **Chat with AI (Pet Care Q&A)** (UC-CHAT-03)
  - Code: `lib/ui/chat/ai_chat_screen.dart`
  - *UI Description: Specialized chat UI cho AI Agent. Badge "AI" ở header. Suggested questions dạng quick replies. Hiển thị typing indicator khi streaming response.*

### Notifications (Module 3.14)
- [ ] **Notification List Screen** (UC-NOTIF-01)
  - Code: `lib/ui/notifications/notifications_screen.dart`
  - *UI Description: Timeline danh sách notifications với icons theo type (Booking, SOS, Promotion, System). Filter tabs: "Tất cả", "Chưa đọc". Mark all as read button.*

### Staff Features (Module 3.7)
- [x] **Staff Schedule Mobile** (UC-SCHED-01)
  - Code: `staff_schedule_screen.dart`
  - Stitch ID: `095f6b61101b464aba244dc8d89a4374`
- [ ] **Staff Home Dashboard** (UC-STAFF-01)
  - Code: `lib/ui/staff/staff_home_screen.dart`
  - *UI Description: Dashboard cho Staff với summary cards (Today's bookings, Pending tasks, Upcoming shifts). Quick access buttons.*
- [ ] **Staff Bookings Screen** (UC-STAFF-02)
  - Code: `lib/ui/staff/staff_bookings_screen.dart`
  - *UI Description: Danh sách bookings assigned to staff. Filter by status, date. Badge "SOS" cho emergency bookings.*
- [ ] **Staff Add Service** (UC-STAFF-03)
  - Code: `lib/ui/staff/add_service_screen.dart`
  - *UI Description: Thêm add-on service vào booking đang IN_PROGRESS. List available services với giá, select multi, confirm.*
- [ ] **Staff Create EMR** (UC-STAFF-04)
  - Code: `lib/ui/staff/create_emr_screen.dart`
  - *UI Description: Form tạo EMR (Diagnosis, Symptoms, Treatment, Prescription, Notes). Rich text editor cho detailed notes.*
- [ ] **Staff EMR Detail** (UC-STAFF-05)
  - Code: `lib/ui/staff/emr_detail_screen.dart`
  - *UI Description: Xem chi tiết EMR record với full timeline, diagnosis, treatment plan, prescriptions. Edit/Delete buttons if authorized.*
- [ ] **Staff Vaccination Record** (UC-STAFF-06)
  - Code: `lib/ui/staff/vaccination_record_screen.dart`
  - *UI Description: Ghi nhận vaccination (Vaccine type, Batch number, Next due date, Notes). Auto-suggest next vaccination schedule.*
- [x] **Staff Schedule Mobile** (UC-SCHED-01)
  - Code: `staff_schedule_screen.dart`
  - Stitch ID: `095f6b61101b464aba244dc8d89a4374`

---

## 💻 Petties Web (Project ID: `5753470864620675867`)

### Staff Features (Module 3.7, 3.8, 3.9)
- [x] **Staff Dashboard** (UC-BOOK-10)
  - Code: `staff/DashboardPage.tsx`
  - Stitch ID: `ac2118e0816044598b63ac72ed5fda35`
- [x] **Staff Shift Management** (UC-SCHED-01)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID (Full Desktop View): `cef09cbbf65249ccb67cfa7849134bcf`
  - Stitch ID (Sidebar Detail): `213e781a8fb24b639c87bfaff592b95f`
- [x] **Staff Schedule** (UC-SCHED-01)
  - Code: `staff/StaffSchedulePage.tsx`
  - Stitch ID: `48420cb21977457689fe791da0f3541a`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [x] **Shift Conflict Warning Modal** (UC-SCHED-05)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `2853459417f547a1abc26b185b817870`
- [x] **Bulk Delete Shifts Mode (Grid)** (UC-SCHED-01)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `523c4135e7bd4c668607ec89c3b06d2d`
- [x] **Bulk Delete Confirmation Modal** (UC-SCHED-01)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `e367f913c5d54d67a2c3a5b2e654928b`
- [x] **Assigned Bookings List** (UC-BOOK-06)
  - Code: `staff/StaffBookingsPage.tsx`
  - Stitch ID: `0595f1cdc9714ab990fcab59851583b5`
- [x] **Patient List** (UC-EMR-04)
  - Code: `staff/patients/StaffPatientsPage.tsx`
  - Stitch ID: `988111dae18a4313a4214aa4413ec497`
- [x] **EMR Detail** (UC-EMR-01)
  - Code: `staff/emr/EmrDetailPage.tsx`
  - Stitch ID: `2d10d23ef25c460e8f3aa2940b83dd60`
- [x] **Create EMR** (UC-EMR-01)
  - Code: `staff/emr/CreateEmrPage.tsx`
  - Stitch ID: `11e29c25c0524dc6bf0808a6c2615e47`
- [x] **Notifications**
  - Code: `staff/NotificationsPage.tsx`
  - Stitch ID: `64bb7b67d4044632b23c2ce59b17f51b`

### Clinic Owner Features (Module 3.6, 3.7)
- [x] **Owner Dashboard** (UC-OPS-05)
  - Code: `clinic-owner/DashboardPage.tsx`
  - Stitch ID: `c03c1300bee7481fbb6615e13bb50551`
- [x] **My Clinics List** (UC-OPS-01)
  - Code: `clinic-owner/clinics/ClinicsListPage.tsx`
  - Stitch ID: `93d7ed13d47c49239c3e90b8d6b2a531`
- [ ] **Create Clinic Page** (UC-OPS-01)
  - Code: `petties-web/src/pages/clinic-owner/clinics/CreateClinicPage.tsx`
  - *UI Description: Multi-step form tạo clinic mới (Basic Info → Location → Operating Hours → Services → Review). Progress stepper ở trên. Validation realtime.*
- [ ] **Edit Clinic Page** (UC-OPS-01)
  - Code: `petties-web/src/pages/clinic-owner/clinics/EditClinicPage.tsx`
  - *UI Description: Form chỉnh sửa thông tin clinic với tabs (General, Location, Hours, SOS Config, Staff). Save/Cancel buttons sticky bottom.*
- [x] **Clinic Detail** (UC-OPS-01)
  - Code: `clinic-owner/clinics/ClinicDetailPage.tsx`
  - Stitch ID: `d449645f57754ac7adddba5033a22719`
- [x] **Master Services** (UC-OPS-04)
  - Code: `clinic-owner/MasterServicesPage.tsx`
  - Stitch ID: `0cd58e7fa257402d8d3e81c2c70e080d`
- [x] **Clinic Services** (UC-OPS-02)
  - Code: `clinic-owner/ServicesPage.tsx`
  - Stitch ID: `898e6fa6912140e79d9958c00223e28b`
- [x] **Staff Management** (UC-SCHED-06)
  - Code: `clinic-owner/staff/StaffManagementPage.tsx`
  - Stitch ID: `fefa8807bde145108097e5e40f1a8cfa`

### Clinic Manager Features (Module 3.8)
- [ ] **Manager Dashboard** (UC-MGR-01)
  - Code: `petties-web/src/pages/clinic-manager/DashboardPage.tsx`
  - *UI Description: Dashboard với KPI cards (Today bookings, Revenue, Pending confirmations). Chart xu hướng bookings. SOS Alert modal popup khi có request.*
- [ ] **Booking Management Dashboard** (UC-MGR-02)
  - Code: `petties-web/src/pages/clinic-manager/BookingDashboardPage.tsx`
  - *UI Description: Kanban board hoặc Table view bookings theo status. Filters: Date range, Status, Type (Walk-in/Home/SOS). Bulk actions.*
- [ ] **Booking Confirmation Page** (UC-MGR-03)
  - Code: `petties-web/src/pages/clinic-manager/BookingConfirmPage.tsx`
  - *UI Description: Chi tiết booking pending confirmation. Auto-assign hoặc Manual-assign staff UI. Available staff list với workload indicator.*
- [ ] **Staff Management (Manager)** (UC-MGR-04)
  - Code: `petties-web/src/pages/clinic-manager/StaffPage.tsx`
  - *UI Description: Danh sách staff với status (Active, On Leave). Invite staff modal, assign shifts button, view schedule link.*
- [ ] **Chat Management** (UC-MGR-05)
  - Code: `petties-web/src/pages/clinic-manager/ChatManagementPage.tsx`
  - *UI Description: Live chat inbox với pet owners. Sidebar list conversations, main area chat messages. Assign to staff feature.*

### Staff Web Features (Module 3.7, 3.9)
- [x] **Staff Dashboard** (UC-BOOK-10)
  - Code: `staff/DashboardPage.tsx`
  - Stitch ID: `ac2118e0816044598b63ac72ed5fda35`
- [x] **Staff Shift Management** (UC-SCHED-01)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID (Full Desktop View): `cef09cbbf65249ccb67cfa7849134bcf`
  - Stitch ID (Sidebar Detail): `213e781a8fb24b639c87bfaff592b95f`
- [x] **Staff Schedule** (UC-SCHED-01)
  - Code: `staff/StaffSchedulePage.tsx`
  - Stitch ID: `48420cb21977457689fe791da0f3541a`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [x] **Shift Conflict Warning Modal** (UC-SCHED-05)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `2853459417f547a1abc26b185b817870`
- [x] **Bulk Delete Shifts Mode (Grid)** (UC-SCHED-01)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `523c4135e7bd4c668607ec89c3b06d2d`
- [x] **Bulk Delete Confirmation Modal** (UC-SCHED-01)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `e367f913c5d54d67a2c3a5b2e654928b`
- [x] **Assigned Bookings List** (UC-BOOK-06)
  - Code: `staff/StaffBookingsPage.tsx`
  - Stitch ID: `0595f1cdc9714ab990fcab59851583b5`
- [x] **Patient List** (UC-EMR-04)
  - Code: `staff/patients/StaffPatientsPage.tsx`
  - Stitch ID: `988111dae18a4313a4214aa4413ec497`
- [x] **EMR Detail** (UC-EMR-01)
  - Code: `staff/emr/EmrDetailPage.tsx`
  - Stitch ID: `2d10d23ef25c460e8f3aa2940b83dd60`
- [x] **Create EMR** (UC-EMR-01)
  - Code: `staff/emr/CreateEmrPage.tsx`
  - Stitch ID: `11e29c25c0524dc6bf0808a6c2615e47`
- [ ] **Edit EMR Page** (UC-EMR-02)
  - Code: `petties-web/src/pages/staff/emr/EditEmrPage.tsx`
  - *UI Description: Form chỉnh sửa EMR existing. Pre-filled data, rich text editor, attachment upload. Audit trail hiển thị lịch sử sửa.*
- [ ] **Vaccination Management** (UC-EMR-03)
  - Code: `petties-web/src/pages/staff/VaccinationPage.tsx`
  - *UI Description: Table danh sách vaccinations với filters (Pet, Date range, Type). Add vaccination modal, view certificate button.*
- [x] **Notifications**
  - Code: `staff/NotificationsPage.tsx`
  - Stitch ID: `64bb7b67d4044632b23c2ce59b17f51b`

### SOS & Tracking Features (Full Flow - Monochrome)
- [x] **SOS Request Confirmation** (Pet Owner)
  - Code: `lib/ui/booking/sos_request_screen.dart`
  - Stitch ID: `7e1be600ae63466cade74e1527c85084`
  - *UI Description: Màn hình chọn thú cưng & nhập triệu chứng, tự động xác định địa chỉ khẩn cấp qua GPS và cho phép xác nhận/sửa lại.*
- [x] **SOS Radar Matching** (Pet Owner)
  - Code: `lib/ui/booking/sos_radar_map_screen.dart`
  - Stitch ID: `7e1be600ae63466cade74e1527c85085`
  - *UI Description: Animation radar tìm kiếm phòng khám trong bán kính 10km, hiển thị Map với các Markers phòng khám đang liên hệ.*
- [x] **SOS Emergency Alert Modal** (Clinic Manager)
  - Code: `src/components/modals/SosAlertModal.tsx`
  - Stitch ID: `7f14f0db50cc4f5389c03c28fc75dfae`
  - *UI Description: Popup đỏ nổi bật hiển thị trên Dashboard web, có countdown 60s và nút "CHẤP NHẬN" / "TỪ CHỐI".*
- [x] **Live Tracking Screen** (Pet Owner)
  - Code: `lib/ui/booking/sos_tracking_screen.dart`
  - Stitch ID: `4f60e2677c984d92a26bc40bbda2aa63` (Updated with Grab-style layout & Polyline)
  - *UI Description: Bản đồ hiển thị lộ trình (Polyline) chi tiết, custom markers (Bác sĩ, Nhà). Bottom card chứa ETA, Khoảng cách, Trạng thái di chuyển, thông tin Bác sĩ (Avatar vuông bo góc) và nút gọi trực tiếp cho nhân viên y tế.*
- [x] **SOS Booking Detail** (Mobile Staff side)
  - Code: `lib/ui/staff/staff_booking_detail_screen.dart`
  - Stitch ID: `a7279e0ebc6a48e7bd0d45fc9fb6b1f3`
  - *UI Description: Chi tiết ca SOS với Badge "SOS" đỏ, nút "BẮT ĐẦU DI CHUYỂN", "CHỈ ĐƯỜNG" và bảng "Payment Summary" (Phí SOS + Phí KM + Dịch vụ).*
- [x] **SOS Checkout & Complete** (Staff side)
  - Code: `lib/ui/staff/staff_booking_detail_screen.dart`
  - Stitch ID: `fa566e8868d3452c80460a7e616a20e6`
  - *UI Description: Các nút hành động "THANH TOÁN" và "HOÀN THÀNH" tích hợp vào thanh action bar phía dưới.*
- [x] **Checkout with Custom Fee Modal** (Staff side)
  - Code: `lib/ui/staff/staff_booking_detail_screen.dart` (AlertDialog inside `_handleCheckout`)
  - Stitch ID: `bee2508fd8bd415796130e957201d18b`
  - *UI Description: Form xác nhận thanh toán dạng popup modal, nổi bật khung nhập liệu "Điều chỉnh phí SOS" (Custom Fee) để thay đổi phí trước khi Checkout.*
- [x] **Clinic SOS Configuration** (Clinic Manager)
  - Code: `src/pages/clinic-manager/ClinicProfilePage.tsx`
  - Stitch ID: `ca5701e0fe4b445b9f4d9be302f7a783`
  - *UI Description: Form cấu hình phí SOS trong tab Settings, cho phép bật/tắt dịch vụ cấp cứu.*
- [x] **SOS Entry Button** (Pet Owner My Bookings)
  - Code: `lib/ui/booking/my_bookings_tab.dart`
  - Stitch ID: `ca5701e0fe4b445b9f4d9be302f7a784` (New)
  - *UI Description: Nút "THEO DÕI" màu xanh nổi bật nằm trên card booking SOS trong tab "Đang diễn ra".*
- [x] **SOS Booking Badge** (Dashboard/Booking List)
  - Code: `lib/ui/staff/staff_bookings_screen.dart`
  - Stitch ID: `0595f1cdc9714ab990fcab59851583b6` (New)
  - *UI Description: Badge "SOS" màu đỏ rực hiển thị cạnh mã đặt lịch trong danh sách của Staff.*

### Admin Features (Module 3.12)
*(Pending Verification of implemented Admin pages)*
- [ ] **Admin Dashboard** (UC-GOV-03)
  - Code: `petties-web/src/pages/admin/DashboardPage.tsx`
  - *UI Description: System-wide dashboard với KPI cards (Total Clinics, Active Users, Total Bookings, Revenue). Charts xu hướng platform growth. Quick links.*
- [ ] **Pending Clinics** (UC-GOV-01)
  - Code: `petties-web/src/pages/admin/clinics/PendingClinicsPage.tsx`
  - *UI Description: Table danh sách clinics pending approval. Columns: Clinic Name, Owner, Submitted Date, Documents. Actions: Review/Approve/Reject buttons.*
- [ ] **Clinic List** (Approved)
  - Code: `petties-web/src/pages/admin/clinics/ClinicsPage.tsx`
  - *UI Description: Full list approved clinics với filters (Status, Region, Type). Search bar, export CSV. View detail/Suspend actions.*
- [ ] **Clinic Approval Detail** (UC-GOV-02)
  - Code: `petties-web/src/pages/admin/clinics/ClinicApprovalPage.tsx`
  - *UI Description: Chi tiết clinic pending approval. Tabs: Basic Info, Documents, Owner Info. Preview documents (Business License, etc.). Approve/Reject modal với reason field.*
- [ ] **User Management** (UC-GOV-04)
  - Code: `petties-web/src/pages/admin/UsersPage.tsx`
  - *UI Description: Table users với filters (Role, Status, Registration Date). Search, bulk actions (Suspend, Activate). View user detail modal.*
- [ ] **Knowledge Base Management** (UC-GOV-05)
  - Code: `petties-web/src/pages/admin/KnowledgeBasePage.tsx`
  - *UI Description: Upload documents cho RAG system. Table documents list (Title, Type, Status, Uploaded Date). Upload modal, preview, delete actions.*
- [ ] **AI Agent Configuration** (UC-GOV-06)
  - Code: `petties-web/src/pages/admin/AgentConfigPage.tsx`
  - *UI Description: Admin dashboard cho Single Agent management. Tabs: System Prompt Editor, Hyperparameters (Temperature, Max Tokens, Top-P sliders), Tool Governance (enable/disable tools), ReAct Flow Visualization.*
- [ ] **Tool Management** (UC-GOV-07)
  - Code: `petties-web/src/pages/admin/ToolsPage.tsx`
  - *UI Description: List FastMCP tools với status (Active/Inactive). Enable/Disable toggle, view semantic descriptions, test tool execution.*
- [ ] **AI Playground** (UC-GOV-08)
  - Code: `petties-web/src/pages/admin/PlaygroundPage.tsx`
  - *UI Description: Test AI Agent interface. Chat UI với ReAct flow display (Thought → Action → Observation). Adjustable hyperparameters sidebar. Export conversation logs.*

### Modals & Components (Shared)
- [ ] **Confirm Modal** (UC-MODAL-01)
  - Code: `petties-web/src/components/modals/ConfirmModal.tsx`
  - *UI Description: Generic confirm dialog với Neobrutalism style. Props: title, message, confirmText, cancelText, variant (danger/warning/info).*
- [ ] **Service Selection Modal** (UC-MODAL-02)
  - Code: `petties-web/src/components/modals/ServiceSelectionModal.tsx`
  - *UI Description: Multi-select services modal. Searchable list, categories filter, price display. Selected count indicator.*
- [ ] **Staff Assignment Modal** (UC-MODAL-03)
  - Code: `petties-web/src/components/modals/StaffAssignmentModal.tsx`
  - *UI Description: Assign staff to booking. List available staff với workload indicator (số bookings assigned), availability status. Auto-assign suggestion.*
- [ ] **Pricing Tier Modal** (UC-MODAL-04)
  - Code: `petties-web/src/components/modals/PricingTierModal.tsx`
  - *UI Description: Add/Edit pricing tiers cho services (Small, Medium, Large pets). Weight range inputs, price inputs, description.*
- [ ] **Invite Staff Modal** (UC-MODAL-05)
  - Code: `petties-web/src/components/modals/InviteStaffModal.tsx`
  - *UI Description: Invite staff by email form. Fields: Email, Role (Staff/Manager), Specialty (cho Vet). Send invitation button.*
- [ ] **Add Service Modal** (UC-MODAL-06)
  - Code: `petties-web/src/components/modals/AddServiceModal.tsx`
  - *UI Description: Thêm add-on service vào booking. List available services, quantity selector, price display. Confirm add button.*
- [ ] **Cancel Booking Modal** (UC-MODAL-07)
  - Code: `petties-web/src/components/modals/CancelBookingModal.tsx`
  - *UI Description: Cancel booking với reason. Textarea reason input (required), cancellation policy notice. Confirm cancel button.*
- [ ] **Document Preview Modal** (UC-MODAL-08)
  - Code: `petties-web/src/components/modals/DocumentPreviewModal.tsx`
  - *UI Description: Preview uploaded documents (PDF, images). Fullscreen overlay, zoom controls, download button, close X.*
- [ ] **Notification Dropdown** (UC-COMP-01)
  - Code: `petties-web/src/components/notifications/NotificationDropdown.tsx`
  - *UI Description: Bell icon với badge count. Dropdown list recent notifications (title, message, timestamp). Mark all as read, View all link.*
- [ ] **Booking Status Badge** (UC-COMP-02)
  - Code: `petties-web/src/components/booking/BookingStatusBadge.tsx`
  - *UI Description: Status badge component với color mapping (Pending→Yellow, Confirmed→Blue, In Progress→Green, Completed→Gray, Cancelled→Red).*
- [ ] **Staff Workload Indicator** (UC-COMP-03)
  - Code: `petties-web/src/components/staff/WorkloadIndicator.tsx`
  - *UI Description: Visual indicator workload (Progress bar hoặc number badge). Tooltip hiển thị chi tiết (X bookings today, Y slots available).*
- [ ] **Timeline Component** (UC-COMP-04)
  - Code: `petties-web/src/components/timeline/Timeline.tsx`
  - *UI Description: Vertical timeline cho booking status history hoặc EMR audit trail. Icon bullets, timestamp, description, actor info.*
