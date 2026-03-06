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

### Staff Features (Module 3.7)
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
  - Code: `admin/DashboardPage.tsx`
- [ ] **Pending Clinics** (UC-GOV-01)
  - Code: `admin/clinics/PendingClinicsPage.tsx` (Inferred)
- [ ] **Clinic List** (Approved)
  - Code: `admin/clinics/ClinicsPage.tsx` (Inferred)
