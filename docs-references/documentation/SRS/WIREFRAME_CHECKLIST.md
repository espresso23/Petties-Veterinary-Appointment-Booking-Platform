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
- [x] **Pet Health Record Screen** (UC-PET-04)
  - Code: `lib/ui/pet/pet_health_record_screen.dart`
  - Stitch ID: `bac5e69f7ab044fb8941463adc5456c2`
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
- [x] **Select Pet Screen** (UC-PO-06)
  - Code: `lib/ui/booking/select_pet_screen.dart`
  - Stitch ID: `fe3f6aa1a7b44e819ac7256449125b36`
- [x] **Select Services Screen** (UC-PO-06)
  - Code: `lib/ui/booking/select_services_screen.dart`
  - Stitch ID: `0f0e2a6c728245acabb5de3707fdda99`
- [x] **Select Date & Time Screen** (UC-PO-06)
  - Code: `lib/ui/booking/select_datetime_screen.dart`
  - Stitch ID: `b931aa0339cd4e49beaea902bc230128`
- [x] **Booking Confirm Screen** (UC-PO-06)
  - Code: `lib/ui/booking/booking_confirm_screen.dart`
  - Stitch ID: `13cff95d2edf431caf32554888c04d8e`
- [x] **Booking Success Screen** (UC-PO-06)
  - Code: `lib/ui/booking/booking_success_screen.dart`
  - Stitch ID: `4d1e3957cd004b809b6de585b57b795e`
- [x] **Booking Detail Screen** (UC-PO-08)
  - Code: `lib/ui/booking/booking_detail_screen.dart`
  - Stitch ID: `6dccd6e3c19a44f5ba42f8ea6f618d3f`
- [x] **My Bookings Screen** (UC-PO-08)
  - Code: `lib/ui/booking/my_bookings_screen.dart`
  - Stitch ID: `b877d8dbcce2416382df38e028b2c136`

### Profile & Settings (Module 3.11)
- [x] **Profile Screen** (UC-PROF-01)
  - Code: `lib/ui/profile/profile_screen.dart`
  - Stitch ID: `bc22e05eba4843c9b926341993507489`
- [x] **Edit Profile Screen** (UC-PROF-02)
  - Code: `lib/ui/profile/edit_profile_screen.dart`
  - Stitch ID: `cfdb2fe9a4864744a2240933a1aa66b6`
- [x] **Change Password Screen** (UC-PROF-03)
  - Code: `lib/ui/profile/change_password_screen.dart`
  - Stitch ID: `9b090bf518cb411cbf88986078b05da6`
- [x] **Notification Settings Screen** (UC-PROF-04)
  - Code: `lib/ui/profile/notification_settings_screen.dart`
  - Stitch ID: `d3179ad69da74d58a90643284c4c2062`

### Chat & AI Features (Module 3.13)

#### Pet Owner AI Features (Mobile)
- [x] **AI Chat Bubble (Float Button)** (UC-AI-001)
  - Code: `lib/ui/chat/ai_chat_bubble.dart`
  - Stitch ID: `7b8415d7d7e2423a962eb1c162bd9eaa`
  - *UI Description: Floating bubble button ở góc dưới phải màn hình (tất cả screens Pet Owner). Icon AI chatbot. Badge màu xanh "AI Trợ lý" + notification dot khi có tin nhắn mới. Khi click mở chat overlay fullscreen.*
- [x] **AI Chat Screen (Pet Care Q&A)** (UC-AI-002)
  - Code: `lib/ui/chat/ai_pet_care_chat_screen.dart`
  - Stitch ID: `4dd76e4f105a49faac0b7d0c1319075c`
  - *UI Description: Chat interface với AI Agent cho pet care Q&A. Header badge "AI Trợ lý". Quick reply suggestions (4-5 câu hỏi phổ biến dạng chips). Bubble messages user/AI. Typing indicator với animation dots khi AI đang xử lý. Sources/citations hiển thị dạng links dưới response. Input box + send button ở bottom.*
- [x] **AI Symptom Checker Screen** (UC-AI-003)
  - Code: `lib/ui/chat/ai_symptom_checker_screen.dart`
  - Stitch ID: `2fd76c5fc8184777b0830f395a7aa597`
- [x] **AI Image Analysis Screen** (UC-AI-019)
  - Code: `lib/ui/chat/ai_image_analysis_screen.dart`
  - Stitch ID: `de08f0cd031e477787c666c99e453474`
- [x] **AI Booking Assistant Screen** (UC-AI-004)
  - Code: `lib/ui/chat/ai_booking_assistant_screen.dart`
  - Stitch ID: `3b588aafd84f4b4c849726660df6634a`
- [x] **AI Medical History Summary** (UC-AI-030)
  - Code: `lib/ui/pet/ai_medical_summary_screen.dart`
  - Stitch ID: `2c72d246a10f436a82f3f36c6c6158b5`

---

#### Staff AI Assistant (Web + Mobile) - Context-aware assistant
- [x] **AI Staff Assistant Widget** (UC-AI-020)
  - Code: `petties-web/src/components/ai/AiStaffAssistantWidget.tsx` + `lib/ui/staff/widgets/ai_assistant_widget.dart`
  - Stitch ID: `6ad582d8101146c7b82cce5fdff083ee`
  - *UI Description: Widget cố định ở sidebar (Web) hoặc floating button bottom-right (Mobile). Icon AI với badge notification số (khi có gợi ý mới từ AI). Badge "AI Trợ lý - Staff". Click mở chat panel slide-in.*

- [x] **AI Staff Chat Panel (Slide-in)** (UC-AI-020)
  - Code: `petties-web/src/components/ai/AiStaffChatPanel.tsx` + `lib/ui/staff/ai_staff_chat_panel.dart`
  - Stitch ID: `396aa0772a8f444298a54ccacad46ed9`
  - *UI Description:

  **Layout:** Slide-in panel từ bên phải (Web: 450px width, Mobile: 85% screen width). Header: "AI Trợ lý - Staff" + minimize/close buttons.

  **Chat area với 3 types messages:**
  1. **User messages** (Staff gửi): Bubble bên phải, màu xanh
  2. **AI responses**: Bubble bên trái, màu trắng với border, có ReAct flow expandable
  3. **AI Proactive Notifications** (System role): Card style với icon alert, màu vàng nhạt background

  **AI Proactive Messages Examples:**
  - 🔔 "Bạn có 3 booking pending cần xử lý hôm nay"
  - ⚠️ "Phát hiện conflict: Bạn có 2 lịch hẹn trùng giờ 14:00 ngày 15/3"
  - 📊 "Tóm tắt ngày: 8 lịch hẹn, 2 hoàn thành, 6 chờ xử lý, 0 hủy"
  - 💡 "Gợi ý: Booking #BK001 có thể reassign cho Dr. Lan (workload thấp hơn)"
  - 🎯 "Pet Max (ID: PET123) sắp đến hạn vaccination vào ngày 20/3"

  **Context-aware:** AI biết staff đang xem booking nào, pet nào → suggest accordingly.

  **Quick action chips:** "TÓM TẮT BỆNH ÁN", "GỢI Ý REASSIGN", "XEM LỊCH HÔM NAY", "TẠO EMR".

  **Input box:** Text input + send icon. Suggested prompts dạng chips phía trên input.*

---

#### Manager AI Assistant (Web) - Operations focused
- [x] **AI Manager Assistant Widget** (UC-AI-021)
  - Code: `petties-web/src/components/ai/AiManagerAssistantWidget.tsx`
  - Stitch ID: `93cf9b918a144b7a80f2d0b8110cc716`
  - *UI Description: Similar widget như Staff. Badge "AI Trợ lý - Quản lý". Notification badge hiển thị số alerts chưa đọc (màu đỏ cho urgent như SOS).*

- [x] **AI Manager Chat Panel** (UC-AI-021)
  - Code: `petties-web/src/components/ai/AiManagerChatPanel.tsx`
  - Stitch ID: `8bbf62136be440f0b1a859c3e6d2f5d8`
  - *UI Description:

  **AI Proactive Notifications cho Manager:**
  - 🚨 "CẢNH BÁO SOS: Yêu cầu cấp cứu mới từ Nguyễn Văn A - 3.5km - Countdown: 50s" (Card màu đỏ với countdown timer, nút "XỬ LÝ NGAY")
  - 📊 "Báo cáo ngày: 25 bookings, 5 pending confirmation, doanh thu 15.5M VNĐ"
  - 👥 "Gợi ý reassign: Có 4 bookings có thể tối ưu staff assignment để cân bằng workload"
  - 📅 "Cảnh báo: Tuần tới thiếu 3 ca chiều thứ 6, cần tạo thêm shifts"
  - ⚠️ "Phát hiện: Dr. Minh workload quá cao (15 bookings hôm nay), nên điều chỉnh?"
  - 💰 "Insight: Dịch vụ Grooming giá 150K thấp hơn thị trường khu vực (180K), nên tăng?"

  **Quick action buttons:** "XỬ LÝ SOS", "XÁC NHẬN BOOKINGS", "REASSIGN TỰ ĐỘNG", "TẠO SHIFTS", "XEM BÁO CÁO", "PHÂN TÍCH DOANH THU".

  **Chat với context memory:** AI nhớ conversation history, user có thể hỏi follow-up. ReAct flow expandable cho transparency.*

---

#### Owner AI Assistant (Web) - Business intelligence
- [x] **AI Owner Assistant Widget** (UC-AI-026)
  - Code: `petties-web/src/components/ai/AiOwnerAssistantWidget.tsx`
  - Stitch ID: `25d91368fc26411d99e40891bcee195c`
  - *UI Description: Widget cho Owner với business analytics context. Badge "AI Trợ lý - Chủ phòng khám". Notification dot màu xanh cho insights mới.*

- [x] **AI Owner Chat Panel** (UC-AI-026)
  - Code: `petties-web/src/components/ai/AiOwnerChatPanel.tsx`
  - Stitch ID: `cd1a8c219f2c44399de6348d3c09176b`
  - *UI Description:

  **AI Proactive Business Insights:**
  - 📈 "Doanh thu tháng 3: 125M VNĐ, tăng 18% so với tháng 2. Top clinic: Chi nhánh Quận 1 (45M)"
  - 🏆 "Top 3 dịch vụ doanh thu: Grooming (35M), Vaccination (28M), Surgery (22M)"
  - 📉 "Cảnh báo: Booking tuần này giảm 12% (80 → 70 bookings). Nguyên nhân có thể: mưa kéo dài 4 ngày"
  - 🎯 "Gợi ý mở rộng: Dental Cleaning có nhu cầu cao (15 yêu cầu/tháng) nhưng chưa có dịch vụ"
  - 👨‍⚕️ "Phân tích nhân sự: Dr. Hùng workload cao nhất (140 bookings/tháng). Nên tuyển thêm 1 vet hoặc mở rộng giờ làm?"
  - 💡 "Insight: 65% khách hàng đặt lịch vào sáng thứ 7 (8-11h). Gợi ý tăng 2 shifts sáng thứ 7 để tăng capacity."
  - 🌟 "Đánh giá tốt: Clinic chi nhánh 2 có rating 4.8/5 (cao nhất). Key success factors: Thời gian chờ ngắn, staff nhiệt tình."

  **Quick actions:** "TẠO DỊCH VỤ MỚI", "PHÂN TÍCH DOANH THU CHI TIẾT", "QUẢN LÝ NHÂN SỰ", "SO SÁNH CHI NHÁNH", "XEM KPI".

  **Business analytics tools:** AI có access revenue analytics, customer behavior, staff performance, market trends.*

---

#### AI Notification System (Cross-platform)
- [x] **AI Proactive Notification Component** (UC-AI-031)
  - Code: `petties-web/src/components/ai/AiNotificationToast.tsx` + `lib/ui/widgets/ai_notification_toast.dart`
  - Stitch ID: `cd77e979036e431396a7aaed683c2438`
  - *UI Description:

  **Toast notification style:** Slide-in từ top-right (Web) / top (Mobile). Card design với:
  - AI icon + badge role (Staff/Manager/Owner) ở bên trái
  - Notification text (max 2 lines) ở giữa
  - Action buttons: "XEM" / "BỎ QUA" ở bên phải
  - Priority colors: 🔴 Urgent (SOS) / 🟡 Warning / 🟢 Info
  - Auto-dismiss sau 10s HOẶC click "XEM" → mở AI chat panel với context focused.
  - Sound/vibration khi notification mới (có thể tắt trong settings).
  - Stack multiple notifications (max 3 visible).

  **Web behavior:** Notification xuất hiện ngay cả khi chat panel đang đóng.
  **Mobile behavior:** Push notification style với deep link vào AI chat panel.*

### Notifications (Module 3.14)
- [x] **Notification List Screen** (UC-NOTIF-01)
  - Code: `lib/ui/notifications/notifications_screen.dart`
  - Stitch ID: `5399f23f82be4bbcbe2e13d50d10b227`

### Staff Features (Module 3.7)
- [x] **Staff Schedule Mobile** (UC-STAFF-04)
  - Code: `staff_schedule_screen.dart`
  - Stitch ID: `095f6b61101b464aba244dc8d89a4374`
- [x] **Staff Home Dashboard** (UC-BOOK-10)
  - Code: `lib/ui/staff/staff_home_screen.dart`
  - Stitch ID: `05b3462ea430474d91b2d7cc47de790c`
- [x] **Staff Bookings Screen** (UC-BOOK-09)
  - Code: `lib/ui/staff/staff_bookings_screen.dart`
  - Stitch ID: `46e2d7c4303f45989f51cd3118311601`
- [x] **Staff Add Service** (UC-BOOK-11)
  - Code: `lib/ui/staff/add_service_screen.dart`
  - Stitch ID: `509e5ee6f6a8420e92cf7d02107911dc`
- [x] **Staff Remove Add-on Service** (UC-BOOK-12)
  - Code: `components/booking/RemoveAddOnServiceAction.tsx`
  - Stitch ID: `1850463b03994041b9253977c383e756`
- [x] **Staff Update Booking Progress** (UC-BOOK-08)
  - Code: `lib/ui/staff/staff_booking_detail_screen.dart`
  - Stitch ID: `23bac76ebe5e435485519123fd7fe483`
- [x] **Staff Create EMR** (UC-VT-06)
  - Code: `lib/ui/staff/create_emr_screen.dart`
  - Stitch ID: `6e7c15796b784e82b1248c78e43b6e51`
- [x] **Staff EMR Detail** (UC-VT-06)
  - Code: `lib/ui/staff/emr_detail_screen.dart`
  - Stitch ID: `948ceaa48762498c87ace145227ba51e`
- [x] **Staff AI Diagnosis (Mobile)** (UC-STAFF-11)
  - Code: `lib/ui/staff/emr/ai_diagnosis_screen.dart`
  - Stitch ID: `243a2c9646f3407ab610c82b528234b6`
  - *UI Description: Bottom sheet hoặc màn hình fullscreen trong Create/Edit EMR mobile flow. Gồm khu vực nhập mô tả/triệu chứng, cuộn ngang ảnh đính kèm, Top 3 chẩn đoán, và dấu hiệu từ ảnh.*
- [x] **Staff Vaccination Record** (UC-VT-08)
  - Code: `lib/ui/staff/vaccination_record_screen.dart`
  - Stitch ID: `0d6c6e995b1744c4b22734e130fba67c`
- [x] **Staff Schedule Mobile** (UC-STAFF-04)
  - Code: `staff_schedule_screen.dart`
  - Stitch ID: `095f6b61101b464aba244dc8d89a4374`

---

## 💻 Petties Web (Project ID: `5753470864620675867`)

### Staff Features (Module 3.7, 3.8, 3.9)
- [x] **Staff Dashboard** (UC-BOOK-10)
  - Code: `staff/DashboardPage.tsx`
  - Stitch ID: `ac2118e0816044598b63ac72ed5fda35`
- [x] **Staff Shift Management** (UC-STAFF-06)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID (Full Desktop View): `cef09cbbf65249ccb67cfa7849134bcf`
  - Stitch ID (Sidebar Detail): `213e781a8fb24b639c87bfaff592b95f`
- [x] **Staff Schedule** (UC-STAFF-04)
  - Code: `staff/StaffSchedulePage.tsx`
  - Stitch ID: `48420cb21977457689fe791da0f3541a`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [x] **Shift Conflict Warning Modal** (UC-STAFF-05)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `2853459417f547a1abc26b185b817870`
- [x] **Bulk Delete Shifts Mode (Grid)** (UC-STAFF-07)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `523c4135e7bd4c668607ec89c3b06d2d`
- [x] **Bulk Delete Confirmation Modal** (UC-STAFF-07)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `e367f913c5d54d67a2c3a5b2e654928b`
- [x] **Assigned Bookings List** (UC-BOOK-09)
  - Code: `staff/StaffBookingsPage.tsx`
  - Stitch ID: `0595f1cdc9714ab990fcab59851583b5`
- [x] **Patient List** (UC-CM-08)
  - Code: `staff/patients/StaffPatientsPage.tsx`
  - Stitch ID: `988111dae18a4313a4214aa4413ec497`
- [x] **EMR Detail** (UC-VT-06)
  - Code: `staff/emr/EmrDetailPage.tsx`
  - Stitch ID: `2d10d23ef25c460e8f3aa2940b83dd60`
- [x] **Create EMR** (UC-VT-06)
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
- [x] **Create Clinic Page** (UC-OPS-01)
  - Code: `petties-web/src/pages/clinic-owner/clinics/CreateClinicPage.tsx`
  - Stitch ID: `7854a92855ee433caf0842c820eb1643`
- [x] **Edit Clinic Page** (UC-OPS-01)
  - Code: `petties-web/src/pages/clinic-owner/clinics/EditClinicPage.tsx`
  - Stitch ID: `e7632c4b2a594cd1bc5f3f493a7feac9`
- [x] **Clinic Detail** (UC-OPS-01)
  - Code: `clinic-owner/clinics/ClinicDetailPage.tsx`
  - Stitch ID: `d449645f57754ac7adddba5033a22719`
- [x] **Master Services** (UC-OPS-04)
  - Code: `clinic-owner/MasterServicesPage.tsx`
  - Stitch ID: `0cd58e7fa257402d8d3e81c2c70e080d`
- [x] **Clinic Services** (UC-OPS-02)
  - Code: `clinic-owner/ServicesPage.tsx`
  - Stitch ID: `898e6fa6912140e79d9958c00223e28b`
- [x] **Staff Management** (UC-STAFF-03)
  - Code: `clinic-owner/staff/StaffManagementPage.tsx`
  - Stitch ID: `fefa8807bde145108097e5e40f1a8cfa`

### Clinic Manager Features (Module 3.8)
- [x] **Manager Dashboard** (UC-OPS-03)
  - Code: `clinic-manager/DashboardPage.tsx`
  - Stitch ID: `71e767c840874fd68eddd1cea828b836`
  - *UI Description: Dashboard với KPI cards (Today bookings, Revenue, Pending confirmations). Chart xu hướng bookings. SOS Alert modal popup khi có request.*
- [x] **Booking Management Dashboard** (UC-BOOK-05)
  - Code: `clinic-manager/bookings/BookingsPage.tsx`
  - Stitch ID: `a6b3f3f0c15f4f109dd9cddfb05ac1c4`
  - *UI Description: Kanban board hoặc Table view bookings theo status. Filters: Date range, Status, Type (Walk-in/Home/SOS). Bulk actions.*
- [x] **Booking Confirmation Page** (UC-BOOK-06)
  - Code: `clinic-manager/bookings/BookingConfirmationPage.tsx`
  - Stitch ID: `d6fe1520c1e54e0ba9edebd0b36a1339`
  - *UI Description: Chi tiết booking pending confirmation. Auto-assign hoặc Manual-assign staff UI. Available staff list với workload indicator.*
- [x] **Staff List Management** (UC-STAFF-03)
  - Code: `clinic-manager/staff/StaffManagementPage.tsx`
  - Stitch ID: `32036310fa7c487ebfe5a4b8fd7edb22`
  - *UI Description: Danh sách nhân viên (Table/Grid), thông tin liên lạc, vai trò, chuyên môn, nút Thêm nhân sự.*
- [x] **Staff Invitation by Email** (UC-STAFF-01)
  - Code: `components/clinic-staff/QuickAddStaffModal.tsx`
  - Stitch ID: `f84e04f0976440fc87b0280c98f8b442`
  - *UI Description: Modal Thêm nhân viên bằng Email, chọn Role, Specialty.*
- [x] **Staff Removal Confirmation Dialog** (UC-STAFF-02)
  - Code: `components/clinic-staff/StaffTable.tsx`
  - Stitch ID: `bb322f38e46d4e41b3d5930d45bf44f4`
  - *UI Description: Modal xác nhận trước khi xóa nhân viên.*
- [x] **Chat Management** (UC-CHAT-01)
  - Code: `shared/chat/ChatManagementPage.tsx`
  - Stitch ID: `0924bd78033e440cb09da2a1939ddc36`
  - *UI Description: Live chat inbox với pet owners. Sidebar list conversations, main area chat messages. Assign to staff feature.*
- [x] **View New Bookings (Pending)** (UC-BOOK-05)
  - Code: `clinic-manager/bookings/BookingDashboardPage.tsx`
  - Stitch ID: `d884ac4b12d440898b5e8e74d77fc2cc`
  - *UI Description: Table view danh sách booking PENDING với tabs status, filter search/date/type, action buttons Chi tiết/Gán Staff/Hủy.*
- [x] **Assign Staff to Booking Modal** (UC-BOOK-06)
  - Code: `clinic-manager/bookings/BookingDashboardPage.tsx`
  - Stitch ID: `3e0f4ffe4eef4dc4ba4937d705a616f6`
  - *UI Description: Modal gán nhân viên cho từng dịch vụ trong booking. Dropdown chọn staff với specialty tag, suggested indicator, available slots.*
- [x] **Reassign Staff Modal** (UC-BOOK-07)
  - Code: `components/booking/ReassignStaffModal.tsx`
  - Stitch ID: `cc1c92942447431d9fd8ebd7d40ca9eb`
  - *UI Description: Modal đổi nhân viên cho dịch vụ cụ thể. Hiện nhân viên hiện tại, danh sách staff available với radio button, specialty filter.*
- [x] **Add Service Modal (Web)** (UC-BOOK-11)
  - Code: `petties-web/src/components/modals/AddServiceModal.tsx`
  - Stitch ID: `a49b7470b5174179bcc92ae9fe5b0a81`
- [x] **Remove Add-on Service Modal (Web)** (UC-BOOK-12)
  - Code: `petties-web/src/components/booking/RemoveAddOnServiceAction.tsx`
  - Stitch ID: `431cb1de38764765b78c03b031713b03`

### Staff Web Features (Module 3.7, 3.9)
- [x] **Staff Dashboard** (UC-BOOK-10)
  - Code: `staff/DashboardPage.tsx`
  - Stitch ID: `ac2118e0816044598b63ac72ed5fda35`
- [x] **Staff Shift Management** (UC-STAFF-06)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID (Full Desktop View): `cef09cbbf65249ccb67cfa7849134bcf`
- [x] **Shift Detail Sidebar** (UC-STAFF-06)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `4befcd685bb34273ba6d506796481acb`
  - *UI Description: Sidebar tab "Chi tiết ca" hiển thị thông tin nhân viên, KHUNG GIỜ, khung tóm tắt Slots (Trống/Đã đặt/Đã khóa) và DANH SÁCH SLOTS chi tiết.*
- [x] **Staff Schedule** (UC-STAFF-04)
  - Code: `staff/StaffSchedulePage.tsx`
  - Stitch ID: `48420cb21977457689fe791da0f3541a`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [x] **Shift Conflict Warning Modal** (UC-STAFF-05)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `2853459417f547a1abc26b185b817870`
- [x] **Bulk Delete Shifts Mode (Grid)** (UC-STAFF-07)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `523c4135e7bd4c668607ec89c3b06d2d`
- [x] **Bulk Delete Confirmation Modal** (UC-STAFF-07)
  - Code: `clinic-manager/shifts/StaffShiftPage.tsx`
  - Stitch ID: `e367f913c5d54d67a2c3a5b2e654928b`
- [x] **Assigned Bookings List** (UC-BOOK-09)
  - Code: `staff/StaffBookingsPage.tsx`
  - Stitch ID: `0595f1cdc9714ab990fcab59851583b5`
- [x] **Patient List** (UC-CM-08)
  - Code: `staff/patients/StaffPatientsPage.tsx`
  - Stitch ID: `988111dae18a4313a4214aa4413ec497`
- [x] **EMR Detail** (UC-VT-06)
  - Code: `staff/emr/EmrDetailPage.tsx`
  - Stitch ID: `2d10d23ef25c460e8f3aa2940b83dd60`
- [x] **Create EMR** (UC-VT-06)
  - Code: `staff/emr/CreateEmrPage.tsx`
  - Stitch ID: `11e29c25c0524dc6bf0808a6c2615e47`
- [x] **Edit EMR** (UC-VT-06)
  - Code: `petties-web/src/pages/staff/emr/EditEmrPage.tsx`
  - Stitch ID: `7d85f629b38440efa97e8751233b3629`
  - *UI Description: Form chỉnh sửa EMR existing. Pre-filled data, rich text editor, attachment upload. Audit trail hiển thị lịch sử sửa.*
- [x] **AI Diagnosis Panel** (UC-STAFF-11)
  - Code: `petties-web/src/components/emr/AIDiagnosisPanel.tsx`
  - Stitch ID: *(Chưa generate - wireframe monochrome)*
  - *UI Description: Panel trong Create/Edit EMR page. Input: ô nhập mô tả lâm sàng, vùng tổn thương, triệu chứng, danh sách ảnh. Output: Card Chẩn đoán phân biệt (top 3), Dấu hiệu từ ảnh, nút Chèn vào SOAP fields. Disclaimer: "Đây là gợi ý hỗ trợ tham khảo".*
  - > **⚠️ 2026-03-17 Update:** Component đã implement. Nguồn: Gemini Vision + KB nội bộ + EMR confirmed (thay thế thumbs feedback).*
- [x] **Vaccination Management** (UC-VT-08)
  - Code: `petties-web/src/pages/staff/emr/components/VaccinationTab.tsx`
  - Stitch ID: `f82869af13634ec19a747ac1f9fa7c6a`
  - *UI Description: Table danh sách vaccinations với filters (Pet, Date range, Type). Add vaccination modal, view certificate button.*
- [x] **Add Service Modal (Web)** (UC-BOOK-11)
  - Code: `petties-web/src/components/modals/AddServiceModal.tsx`
  - Stitch ID: `a49b7470b5174179bcc92ae9fe5b0a81`
- [x] **Remove Add-on Service Modal (Web)** (UC-BOOK-12)
  - Code: `petties-web/src/components/booking/RemoveAddOnServiceAction.tsx`
  - Stitch ID: `431cb1de38764765b78c03b031713b03`
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
- [x] **Booking Detail with Checkout** (Mobile Staff side)
  - Code: `lib/ui/staff/staff_booking_detail_screen.dart`
  - Stitch ID: `f1e6db59e75b41168c29b3ee894a0189`
  - *UI Description: Chi tiết lịch hẹn trạng thái IN_PROGRESS, badge "Đang khám" & "SOS". Nút to "XEM LẠI HÓA ĐƠN & THANH TOÁN" ở phần Action.*
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
- [x] **Admin Dashboard** (UC-ADM-02)
  - Code: `admin/DashboardPage.tsx`
  - Stitch ID: `804d568b852847e082dcb45b9cfe441d`
  - *UI Description: System-wide dashboard với KPI cards (Total Clinics, Active Users, Total Bookings, Revenue). Charts xu hướng platform growth. Quick links.*
- [x] **Pending Clinics** (UC-ADM-01)
  - Code: `admin/clinics/PendingClinicsPage.tsx`
  - Stitch ID: `3227f9fe34b0455cb0f3c8ff9c005fae`
  - *UI Description: Table danh sách clinics pending approval. Columns: Clinic Name, Owner, Submitted Date, Documents. Actions: Review/Approve/Reject buttons.*
- [x] **Clinic List** (UC-ADM-03)
  - Code: `admin/clinics/ClinicsPage.tsx`
  - Stitch ID: `b2e27b7fe49147a584a188a417982f82`
  - *UI Description: Full list approved clinics với filters (Status, Region, Type). Search bar, export CSV. View detail/Suspend actions.*
- [x] **Clinic Approval Detail** (UC-ADM-01)
  - Code: `admin/clinics/ClinicApprovalDetailPage.tsx`
  - Stitch ID: `a7fc191b609d4fc381f0987fb6e6e9df`
  - *UI Description: Chi tiết clinic pending approval. Tabs: Basic Info, Documents, Owner Info. Preview documents (Business License, etc.). Approve/Reject modal với reason field.*
- [x] **User Management** (UC-ADM-04)
  - Code: `admin/users/UsersPage.tsx`
  - Stitch ID: `6788dcbf8a8b485d99f374f4d750dba7`
  - *UI Description: Table users với filters (Role, Status, Registration Date). Search, bulk actions (Suspend, Activate). View user detail modal.*
- [x] **Knowledge Base Management** (UC-GOV-05)
  - Code: `petties-web/src/pages/admin/KnowledgeBasePage.tsx`
  - Stitch ID: `eeaf49734fc54e288a814c456d6d5378`
- [x] **AI Agent Configuration** (UC-AI-005)
  - Code: `petties-web/src/pages/admin/ai/AgentConfigPage.tsx`
  - Stitch ID: `6e7b941be8464f70aa58818de4ed16ce`
- [x] **Tool Management** (UC-AI-007)
  - Code: `petties-web/src/pages/admin/ai/ToolsPage.tsx`
  - Stitch ID: `7f3b9eb7cb72404580bdd93dfa17e821`
- [x] **Tool Test Modal** (UC-AI-009)
  - Code: `petties-web/src/components/admin/ai/ToolTestModal.tsx`
  - Stitch ID: `1dea42f13a104981b1bf6a8b4b12ded2`
- [x] **Knowledge Base Management** (UC-AI-012)
  - Code: `petties-web/src/pages/admin/ai/KnowledgeBasePage.tsx`
  - Stitch ID: `eeaf49734fc54e288a814c456d6d5378`
- [x] **Test RAG Retrieval Results** (UC-AI-014)
  - Code: `petties-web/src/components/admin/ai/RagTestResults.tsx`
  - Stitch ID: `3f15a77fe5b1456aaddc45870371ca5e`
- [x] **AI Playground** (UC-AI-015)
  - Code: `petties-web/src/pages/admin/ai/PlaygroundPage.tsx`
  - Stitch ID: `dc393b783f09429c947f068e48416fce`
- [x] **ReAct Flow Visualization** (UC-AI-016)
  - Code: `petties-web/src/components/admin/ai/ReactFlowVisualization.tsx`
  - Stitch ID: `52e7abe770e34ff49f68ae2b11c62415`
- [x] **System Settings (API Keys)** (UC-AI-015)
  - Code: `petties-web/src/pages/admin/ai/SystemSettingsPage.tsx`
  - Stitch ID: `8bcedadf693849d29df4a0e63ea8978e`

### Staff/Manager Web AI Features
- [x] **AI Staff Chat (Web)** (UC-AI-020)
  - Code: `petties-web/src/pages/staff/AiChatPage.tsx`
  - Stitch ID: `0e3ae8fa6c274351a81f04035eb0c53d`
- [x] **AI Booking Handling Assistant** (UC-AI-020)
  - Code: `petties-web/src/pages/clinic-manager/AiBookingAssistantPage.tsx`
  - Stitch ID: `f546c2efbb0649c9abbec781ec4780db`
- [x] **AI Staff Reassignment Suggester** (UC-AI-021)
  - Code: `petties-web/src/pages/clinic-manager/AiReassignPage.tsx`
  - Stitch ID: `a2b235cc38db46adbe5c93d608ca0e6f`
- [x] **AI EMR Summary** (UC-AI-023)
  - Code: `petties-web/src/pages/staff/AiEmrSummaryPage.tsx`
  - Stitch ID: `46b89ea2345c467c9b4d2d94102d1de7`
- [x] **AI Shift Scheduling Assistant** (UC-AI-024)
  - Code: `petties-web/src/pages/clinic-manager/AiShiftSchedulerPage.tsx`
  - Stitch ID: `181b5f2c6ee247b8aa56589a2d23c47a`
- [x] **AI Clinic Setup Wizard** (UC-AI-026)
  - Code: `petties-web/src/pages/clinic-owner/AiSetupWizardPage.tsx`
  - Stitch ID: `63cc148509bb40b885de9d3bb674804c`
- [x] **AI Service Generator & Auto-Adder** (UC-AI-027)
  - Code: `petties-web/src/pages/clinic-owner/AiServiceGeneratorPage.tsx`
  - Stitch ID: `03e64decf0cc43a5a5e7ff98be4c392c`
  - *UI Description: AI tự động generate VÀ thêm services vào clinic.

  **Layout:** Header "Tạo Dịch Vụ Tự Động với AI". Input form section bên trái: Clinic type dropdown (General/Specialist/Emergency), Pet types checkboxes (Dog/Cat/Bird/Exotic), Region (auto-filled từ clinic address, có thể edit).

  **Action button:** "TẠO VÀ THÊM DỊCH VỤ TỰ ĐỘNG" (primary button, màu xanh lá).

  **AI Process Display:** Khi click button → Loading overlay với steps:
  - Step 1: 🔍 "Đang phân tích master services..." (AI gọi tool get_master_services)
  - Step 2: 💰 "Đang lấy giá thị trường khu vực {Region}..." (AI gọi tool get_market_pricing từ Spring Boot API)
  - Step 3: ✍️ "Đang tạo mô tả dịch vụ bằng tiếng Việt..." (AI generate descriptions)
  - Step 4: ➕ "Đang thêm {N} dịch vụ vào clinic..." (AI gọi tool create_clinic_service for each)

  **Results table:** Service Name, Category, AI Price (editable inline), Description (editable inline), Status column (✅ Success / ❌ Failed với error tooltip). Checkbox mỗi row (default all checked BEFORE creation).

  **Confirmation Step:** Before batch create, show preview modal: "Xác nhận thêm {N} dịch vụ?" với list preview. "XÁC NHẬN THÊM" / "HỦY" buttons.

  **Success Summary:** Toast + card: "✅ Đã thêm 12/15 dịch vụ thành công. 3 dịch vụ bị lỗi (trùng tên hoặc validation failed)." "XEM DỊCH VỤ VỪA TẠO" link → navigate to Clinic Services page.

  **ReAct Flow Panel:** Expandable panel "Chi tiết AI Workflow" hiển thị: Thought → Action (tool calls) → Observation (results) với timestamps. Export log button.*
- [x] **AI Clinic Description Composer** (UC-AI-028)
  - Code: `petties-web/src/pages/clinic-owner/AiDescriptionComposerPage.tsx`
  - Stitch ID: `c269f7971a694dc9a80579744cc451d4`

### Modals & Components (Shared)
- [x] **Confirm Modal** (UC-MODAL-01)
  - Code: `petties-web/src/components/modals/ConfirmModal.tsx`
  - Stitch ID: `d837003571454b4baac33118e12fce98`
- [x] **Service Selection Modal** (UC-MODAL-02)
  - Code: `petties-web/src/components/modals/ServiceSelectionModal.tsx`
  - Stitch ID: `12c105552a4d4b37acac477958be50e8`
- [x] **Staff Assignment Modal** (UC-MODAL-03)
  - Code: `petties-web/src/components/modals/StaffAssignmentModal.tsx`
  - Stitch ID: `744124d622ea4dc0aa29f31826a4158d`
- [x] **Pricing Tier Modal** (UC-MODAL-04)
  - Code: `petties-web/src/components/modals/PricingTierModal.tsx`
  - Stitch ID: `7481b958649e45279c756837497c3780`
- [x] **Invite Staff Modal** (UC-MODAL-05)
  - Code: `petties-web/src/components/modals/InviteStaffModal.tsx`
  - Stitch ID: `aae799e7aa8b40e5b0c80ece4f42f285`
- [x] **Add Service Modal** (UC-MODAL-06)
  - Code: `petties-web/src/components/modals/AddServiceModal.tsx`
  - Stitch ID: `af18addf67ce4d319571ba9a06df055f`
- [x] **Cancel Booking Modal** (UC-MODAL-07)
  - Code: `petties-web/src/components/modals/CancelBookingModal.tsx`
  - Stitch ID: `113a3ff6caa44acca4f0a74bb7d2c88e`
- [x] **Document Preview Modal** (UC-MODAL-08)
  - Code: `petties-web/src/components/modals/DocumentPreviewModal.tsx`
  - Stitch ID: `745717170e8b4b768c3f6e77c9ff0fee`
- [x] **Notification Dropdown** (UC-COMP-01)
  - Code: `petties-web/src/components/notifications/NotificationDropdown.tsx`
  - Stitch ID: `e5ff8eb94f884bff8011e10b3501e6c6`
- [x] **Booking Status Badge** (UC-COMP-02)
  - Code: `petties-web/src/components/booking/BookingStatusBadge.tsx`
  - Stitch ID: `4d78d4b3baec44fe84dcef23681d760e`
- [x] **Staff Workload Indicator** (UC-COMP-03)
  - Code: `petties-web/src/components/staff/WorkloadIndicator.tsx`
  - Stitch ID: `f41bad65d09c41c3a0956992e65e285c`
- [x] **Timeline Component** (UC-COMP-04)
  - Code: `petties-web/src/components/timeline/Timeline.tsx`
  - Stitch ID: `80313cec889f46e0a83f0812711ed561`
