# PETTIES - Sprint Checklist (14 Weeks)

Checklist use cases theo từng Actor, chia theo Sprint (mỗi sprint 1 tuần).

---

## Overview

| Phase | Sprint | Focus |
|-------|--------|-------|
| **Phase 1: Foundation** | Sprint 1-3 | Setup, Auth, Core Entities |
| **Phase 2: Core Features** | Sprint 4-7 | Booking, Clinic, Pet Management |
| **Phase 3: Advanced Features** | Sprint 8-10 | EMR, Payments, Notifications |
| **Phase 4: AI & Integration** | Sprint 11-13 | AI Chatbot, Agent Management |
| **Phase 5: Polish & Launch** | Sprint 14 | Testing, Bug fixes, Deployment |

---

## Actors Summary

| Actor | Platform | Description |
|-------|----------|-------------|
| **PET_OWNER** | Mobile Only | Khách hàng - Chủ thú cưng |
| **VET** | Mobile + Web | Bác sĩ thú y |
| **CLINIC_MANAGER** | Web Only | Quản lý phòng khám |
| **CLINIC_OWNER** | Web Only | Chủ phòng khám |
| **ADMIN** | Web Only | Admin nền tảng |

---

## Priority Legend

| Priority | Meaning | Must Complete |
|----------|---------|---------------|
| P0 | Critical - MVP | Yes |
| P1 | High - Core Feature | Yes |
| P2 | Medium - Enhancement | If time permits |
| P3 | Low - Nice to have | Future sprint |

---

# PHASE 1: FOUNDATION (Sprint 1-3)

## Sprint 1: Project Setup & Infrastructure

**Goal:** Setup môi trường phát triển, CI/CD, Database schema cơ bản

### Infrastructure & Setup
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| S1-01 | Setup Git repository với branch protection | Tân | P0 | [x] |
| S1-02 | Setup Docker Compose cho development | Tân | P0 | [x] |
| S1-03 | Setup PostgreSQL + MongoDB + Redis | Tân | P0 | [x] |
| S1-04 | Setup Spring Boot project structure | Tân | P0 | [x] |
| S1-05 | Setup React + Vite project structure | Tân | P0 | [x] |
| S1-06 | Setup Flutter project structure | Tân | P0 | [x] |
| S1-07 | Setup FastAPI + LangGraph project | Tân | P0 | [x] |
| S1-08 | Configure CI/CD pipelines | Tân | P1 | [x] |
| S1-09 | Setup Qdrant Cloud connection | Tân | P1 | [x] |
| S1-10 | Configure environment variables | All | P0 | [x] |

### Database Design
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| S1-11 | Design User entity schema | Tân | P0 | [x] |
| S1-12 | Design Clinic entity schema | Triết | P0 | [ ] |
| S1-13 | Design Pet entity schema | Triết | P0 | [ ] |
| S1-14 | Design Booking entity schema | Triết | P0 | [ ] |
| S1-15 | Design EMR entity schema | Tuân | P1 | [ ] |

**Sprint 1 Deliverables:**
- [x] All projects can run locally
- [ ] Database schemas created
- [x] CI/CD pipelines working
- [x] Team can push/pull code

---

## Sprint 2: Authentication & User Management

**Goal:** Hoàn thành hệ thống đăng ký, đăng nhập cho tất cả actors

### ADMIN - Authentication
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A2-01 | Admin Login | Đăng nhập với username/password | P0 | [x] |
| A2-02 | Admin Dashboard Access | Truy cập trang quản trị | P0 | [x] |

### PET_OWNER - Authentication (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO2-01 | Register Account | Đăng ký tài khoản mới | P0 | [x] |
| PO2-02 | Login | Đăng nhập với email/password | P0 | [x] |
| PO2-03 | Google Sign-In | Đăng nhập bằng Google | P1 | [x] |
| PO2-04 | Forgot Password | Quên mật khẩu - gửi email reset | P1 | [ ] |
| PO2-05 | Update Profile | Cập nhật thông tin cá nhân | P1 | [ ] |
| PO2-06 | Change Password | Đổi mật khẩu | P2 | [ ] |
| PO2-07 | Logout | Đăng xuất | P0 | [x] |

### VET - Authentication
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| V2-01 | Login (Web) | Đăng nhập từ tài khoản được cấp (Web) | P0 | [x] |
| V2-02 | Login (Mobile) | Đăng nhập từ tài khoản được cấp (Mobile) | P0 | [x] |
| V2-03 | View My Profile | Xem hồ sơ bác sĩ | P1 | [ ] |
| V2-04 | Update Profile | Cập nhật thông tin (ảnh, bio) | P2 | [ ] |

### CLINIC_MANAGER - Authentication
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CM2-01 | Login | Đăng nhập từ tài khoản được cấp | P0 | [x] |
| CM2-02 | View Dashboard | Xem dashboard quản lý | P0 | [x] |

### CLINIC_OWNER - Authentication
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CO2-01 | Register Clinic | Đăng ký phòng khám mới (pending approval) | P0 | [ ] |
| CO2-02 | Login | Đăng nhập | P0 | [x] |
| CO2-03 | View Dashboard | Xem dashboard phòng khám | P0 | [x] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B2-01 | Implement JWT Authentication | Tân | P0 | [x] |
| B2-02 | Implement Refresh Token | Tân | P0 | [x] |
| B2-03 | Implement Role-based Authorization | Tân | P0 | [x] |
| B2-04 | Google OAuth Integration | Tân | P1 | [x] |
| B2-05 | Password Reset Flow | Tân | P1 | [ ] |
| B2-06 | Input Validation (Vietnamese messages) | Tân | P0 | [ ] |

**Sprint 2 Deliverables:**
- [ ] All actors can register/login
- [ ] JWT + Refresh Token working
- [ ] Role-based access control
- [ ] Validation messages in Vietnamese

---

## Sprint 3: Pet & Clinic Basic Management

**Goal:** CRUD cơ bản cho Pet và Clinic

### PET_OWNER - Pet Management (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO3-01 | Create Pet Profile | Tạo hồ sơ thú cưng mới | P0 | [ ] |
| PO3-02 | Upload Pet Photo | Tải ảnh thú cưng | P0 | [ ] |
| PO3-03 | Edit Pet Profile | Sửa thông tin thú cưng | P0 | [ ] |
| PO3-04 | View Pet List | Xem danh sách thú cưng | P0 | [ ] |
| PO3-05 | View Pet Detail | Xem chi tiết thú cưng | P0 | [ ] |
| PO3-06 | Delete Pet | Xóa thú cưng | P1 | [ ] |
| PO3-07 | Add Pet Characteristics | Thêm đặc điểm (giống, màu, cân nặng) | P1 | [ ] |

### CLINIC_OWNER - Clinic Management (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CO3-01 | Update Clinic Info | Cập nhật thông tin phòng khám | P0 | [ ] |
| CO3-02 | Upload Clinic Photos | Tải ảnh phòng khám | P1 | [ ] |
| CO3-03 | Set Clinic Hours | Cài đặt giờ mở cửa | P0 | [ ] |
| CO3-04 | Set Clinic Location | Cài đặt vị trí (Google Maps) | P0 | [ ] |
| CO3-05 | Create Service | Tạo dịch vụ mới | P0 | [ ] |
| CO3-06 | Edit Service | Sửa dịch vụ | P0 | [ ] |
| CO3-07 | Delete Service | Xóa dịch vụ | P1 | [ ] |
| CO3-08 | Set Service Pricing | Cấu hình giá (base + km) | P0 | [ ] |

### ADMIN - Clinic Approval (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A3-01 | View Pending Clinics | Xem danh sách clinic chờ duyệt | P0 | [ ] |
| A3-02 | Approve Clinic | Phê duyệt clinic | P0 | [ ] |
| A3-03 | Reject Clinic | Từ chối clinic (với lý do) | P0 | [ ] |
| A3-04 | View All Clinics | Xem tất cả clinics | P1 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B3-01 | Pet CRUD APIs | Triết | P0 | [ ] |
| B3-02 | Clinic CRUD APIs | Triết | P0 | [ ] |
| B3-03 | Service CRUD APIs | Triết | P0 | [ ] |
| B3-04 | Cloudinary Integration (Images) | Triết | P0 | [ ] |
| B3-05 | Google Maps Integration | Triết | P1 | [ ] |

**Sprint 3 Deliverables:**
- [ ] Pet CRUD complete
- [ ] Clinic + Service CRUD complete
- [ ] Admin can approve/reject clinics
- [ ] Image upload working

---

# PHASE 2: CORE FEATURES (Sprint 4-7)

## Sprint 4: Vet Management & Scheduling

**Goal:** Quản lý bác sĩ và lịch làm việc

### CLINIC_MANAGER - Vet Management (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CM4-01 | View Vet List | Xem danh sách bác sĩ | P0 | [ ] |
| CM4-02 | Add Vet Manually | Thêm bác sĩ thủ công (tạo account) | P0 | [ ] |
| CM4-03 | Remove Vet Link | Xóa/bỏ liên kết bác sĩ | P1 | [ ] |
| CM4-04 | Import Schedule (Excel) | Import lịch từ Excel | P1 | [ ] |
| CM4-05 | Add Schedule Manually | Thêm lịch làm việc thủ công | P0 | [ ] |
| CM4-06 | View Vet Schedule | Xem lịch làm việc bác sĩ | P0 | [ ] |
| CM4-07 | Edit Vet Schedule | Sửa lịch làm việc | P1 | [ ] |

### VET - Schedule Management
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| V4-01 | View My Schedule | Xem lịch làm việc của tôi | P0 | [ ] |
| V4-02 | View Today's Schedule | Xem lịch hôm nay | P0 | [ ] |
| V4-03 | View Week Schedule | Xem lịch tuần | P1 | [ ] |

### CLINIC_OWNER - Dashboard (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CO4-01 | View Clinic Stats | Xem thống kê phòng khám | P1 | [ ] |
| CO4-02 | View Today's Summary | Xem tổng hợp hôm nay | P1 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B4-01 | Vet CRUD APIs | Tuân | P0 | [ ] |
| B4-02 | Schedule/Shift APIs | Tuân | P0 | [ ] |
| B4-03 | Excel Import Service | Tuân | P1 | [ ] |
| B4-04 | Slot Availability Logic | Triết | P0 | [ ] |

**Sprint 4 Deliverables:**
- [ ] Vet management complete
- [ ] Schedule management working
- [ ] Slot availability calculation

---

## Sprint 5: Booking System - Part 1 (Create & View)

**Goal:** Pet Owner có thể đặt lịch, xem lịch

### PET_OWNER - Search & Discovery (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO5-01 | Search Clinics | Tìm kiếm phòng khám | P0 | [ ] |
| PO5-02 | Filter by Location | Lọc theo vị trí (gần nhất) | P0 | [ ] |
| PO5-03 | Filter by Service | Lọc theo dịch vụ | P1 | [ ] |
| PO5-04 | View Clinic Detail | Xem chi tiết phòng khám | P0 | [ ] |
| PO5-05 | Search Vets | Tìm kiếm bác sĩ | P1 | [ ] |
| PO5-06 | View Vet Detail | Xem chi tiết bác sĩ | P1 | [ ] |
| PO5-07 | View Vet Reviews | Xem đánh giá bác sĩ | P2 | [ ] |

### PET_OWNER - Booking Creation (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO5-08 | Select Service | Chọn dịch vụ cần đặt | P0 | [ ] |
| PO5-09 | Select Pet | Chọn thú cưng | P0 | [ ] |
| PO5-10 | Select Date | Chọn ngày khám | P0 | [ ] |
| PO5-11 | View Available Slots | Xem slot trống | P0 | [ ] |
| PO5-12 | Select Time Slot | Chọn giờ khám | P0 | [ ] |
| PO5-13 | Add Notes | Thêm ghi chú | P1 | [ ] |
| PO5-14 | Create Clinic Visit | Đặt lịch khám tại phòng | P0 | [ ] |
| PO5-15 | Create Home Visit | Đặt lịch khám tại nhà | P0 | [ ] |
| PO5-16 | View Booking Summary | Xem tóm tắt booking | P0 | [ ] |

### PET_OWNER - Booking View (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO5-17 | View My Bookings | Xem danh sách booking | P0 | [ ] |
| PO5-18 | Filter by Status | Lọc theo trạng thái | P1 | [ ] |
| PO5-19 | View Booking Detail | Xem chi tiết booking | P0 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B5-01 | Clinic Search API | Triết | P0 | [ ] |
| B5-02 | Vet Search API | Triết | P1 | [ ] |
| B5-03 | Available Slots API | Triết | P0 | [ ] |
| B5-04 | Create Booking API | Triết | P0 | [ ] |
| B5-05 | Booking List API | Triết | P0 | [ ] |
| B5-06 | Booking Detail API | Triết | P0 | [ ] |
| B5-07 | Dynamic Pricing Logic | Triết | P0 | [ ] |

**Sprint 5 Deliverables:**
- [ ] Pet Owner can search clinics/vets
- [ ] Pet Owner can create bookings
- [ ] Pet Owner can view their bookings

---

## Sprint 6: Booking System - Part 2 (Workflow)

**Goal:** Hoàn thành workflow booking: Assign, Approve, Cancel

### CLINIC_MANAGER - Booking Management (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CM6-01 | View New Bookings | Xem booking mới (PENDING) | P0 | [ ] |
| CM6-02 | Assign Vet | Gán bác sĩ cho booking | P0 | [ ] |
| CM6-03 | Reassign Vet | Gán lại khi bác sĩ từ chối | P0 | [ ] |
| CM6-04 | Assign Service | Gán dịch vụ nếu user chưa chọn | P1 | [ ] |
| CM6-05 | View Today Dashboard | Xem dashboard hôm nay | P0 | [ ] |
| CM6-06 | Manage Cancellation | Quản lý hủy booking | P1 | [ ] |

### VET - Booking Response (Mobile + Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| V6-01 | View Assigned Bookings | Xem booking được gán | P0 | [ ] |
| V6-02 | Approve Booking | Phê duyệt booking | P0 | [ ] |
| V6-03 | Reject Booking | Từ chối booking (với lý do) | P0 | [ ] |
| V6-04 | View Booking Detail | Xem chi tiết booking | P0 | [ ] |

### PET_OWNER - Booking Actions (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO6-01 | Cancel Booking | Hủy booking | P0 | [ ] |
| PO6-02 | View Cancellation Policy | Xem chính sách hủy | P1 | [ ] |
| PO6-03 | Receive Booking Confirmation | Nhận xác nhận booking | P0 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B6-01 | Booking Assignment API | Triết | P0 | [ ] |
| B6-02 | Booking Approval/Rejection API | Triết | P0 | [ ] |
| B6-03 | Booking Cancellation API | Triết | P0 | [ ] |
| B6-04 | Booking Status Workflow | Triết | P0 | [ ] |
| B6-05 | Slot Restore on Cancel | Triết | P0 | [ ] |

**Sprint 6 Deliverables:**
- [ ] Full booking workflow working
- [ ] Assign/Approve/Reject/Cancel
- [ ] Status transitions correct

---

## Sprint 7: Booking Execution & Check-in/out

**Goal:** Thực hiện khám: Check-in, In-progress, Check-out

### VET - Appointment Execution (Mobile + Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| V7-01 | Check-in Patient | Check-in bệnh nhân | P0 | [ ] |
| V7-02 | Start Appointment | Bắt đầu khám | P0 | [ ] |
| V7-03 | View Pet EMR (Shared) | Xem hồ sơ y tế (nếu được share) | P0 | [ ] |
| V7-04 | View Vaccination Record | Xem sổ tiêm chủng | P0 | [ ] |
| V7-05 | Check-out Patient | Check-out bệnh nhân | P0 | [ ] |
| V7-06 | Complete Appointment | Hoàn thành buổi khám | P0 | [ ] |

### PET_OWNER - Appointment Tracking (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO7-01 | Track Booking Status | Theo dõi trạng thái booking | P0 | [ ] |
| PO7-02 | View Check-in Status | Xem trạng thái check-in | P1 | [ ] |
| PO7-03 | Receive Status Updates | Nhận cập nhật trạng thái | P1 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B7-01 | Check-in API | Triết | P0 | [ ] |
| B7-02 | Check-out API | Triết | P0 | [ ] |
| B7-03 | Status Update APIs | Triết | P0 | [ ] |
| B7-04 | Booking Timeline/History | Triết | P1 | [ ] |

**Sprint 7 Deliverables:**
- [ ] Check-in/Check-out working
- [ ] Full booking lifecycle complete
- [ ] Status tracking for Pet Owner

---

# PHASE 3: ADVANCED FEATURES (Sprint 8-10)

## Sprint 8: EMR & Medical Records

**Goal:** Hồ sơ bệnh án điện tử (EMR)

### VET - EMR Management (Web + Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| V8-01 | Create EMR Entry | Ghi chú hồ sơ bệnh án | P0 | [ ] |
| V8-02 | Add Diagnosis | Thêm chẩn đoán | P0 | [ ] |
| V8-03 | Add Treatment Notes | Thêm ghi chú điều trị | P0 | [ ] |
| V8-04 | Add Prescription | Ghi đơn thuốc vào EMR | P0 | [ ] |
| V8-05 | Update EMR | Cập nhật EMR | P0 | [ ] |
| V8-06 | View EMR History | Xem lịch sử EMR | P0 | [ ] |
| V8-07 | Update Vaccination | Cập nhật sổ tiêm chủng | P0 | [ ] |
| V8-08 | Add Vaccination Record | Thêm mũi tiêm mới | P0 | [ ] |

### PET_OWNER - Medical Records View (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO8-01 | View Pet EMR | Xem hồ sơ y tế thú cưng | P0 | [ ] |
| PO8-02 | View EMR History | Xem lịch sử bệnh án | P0 | [ ] |
| PO8-03 | View Prescription | Xem đơn thuốc | P0 | [ ] |
| PO8-04 | View Vaccination Record | Xem sổ tiêm chủng | P0 | [ ] |
| PO8-05 | Share EMR Permission | Chia sẻ quyền xem EMR | P1 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B8-01 | EMR CRUD APIs | Tuân | P0 | [ ] |
| B8-02 | Prescription APIs | Tuân | P0 | [ ] |
| B8-03 | Vaccination CRUD APIs | Tuân | P0 | [ ] |
| B8-04 | EMR Sharing Logic | Tuân | P1 | [ ] |
| B8-05 | Cross-Clinic EMR Access | Tuân | P1 | [ ] |

**Sprint 8 Deliverables:**
- [ ] EMR creation and viewing
- [ ] Prescription in EMR
- [ ] Vaccination tracking
- [ ] Shared EMR across clinics

---

## Sprint 9: Payment Integration

**Goal:** Tích hợp thanh toán online

### PET_OWNER - Payment (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO9-01 | View Payment Amount | Xem số tiền cần thanh toán | P0 | [ ] |
| PO9-02 | Select Payment Method | Chọn phương thức thanh toán | P0 | [ ] |
| PO9-03 | Pay with Stripe | Thanh toán qua Stripe | P0 | [ ] |
| PO9-04 | View Payment History | Xem lịch sử thanh toán | P1 | [ ] |
| PO9-05 | Request Refund | Yêu cầu hoàn tiền | P1 | [ ] |
| PO9-06 | View Payment Receipt | Xem hóa đơn | P1 | [ ] |

### CLINIC_MANAGER - Refund Management (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CM9-01 | View Refund Requests | Xem yêu cầu hoàn tiền | P1 | [ ] |
| CM9-02 | Approve Refund | Phê duyệt hoàn tiền | P1 | [ ] |
| CM9-03 | Reject Refund | Từ chối hoàn tiền | P1 | [ ] |

### CLINIC_OWNER - Revenue (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| CO9-01 | View Revenue Dashboard | Xem dashboard doanh thu | P0 | [ ] |
| CO9-02 | View Revenue by Period | Xem doanh thu theo kỳ | P1 | [ ] |
| CO9-03 | Export Revenue Report | Xuất báo cáo doanh thu | P2 | [ ] |

### ADMIN - Platform Revenue (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A9-01 | View Platform Stats | Xem thống kê nền tảng | P0 | [ ] |
| A9-02 | View Total Revenue | Xem tổng doanh thu | P1 | [ ] |
| A9-03 | View Transaction List | Xem danh sách giao dịch | P1 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B9-01 | Stripe Integration | Tuân | P0 | [ ] |
| B9-02 | Payment Processing API | Tuân | P0 | [ ] |
| B9-03 | Refund Processing API | Tuân | P1 | [ ] |
| B9-04 | Revenue Calculation | Tuân | P0 | [ ] |
| B9-05 | Transaction History | Tuân | P1 | [ ] |

**Sprint 9 Deliverables:**
- [ ] Stripe payment working
- [ ] Payment history
- [ ] Revenue dashboard
- [ ] Refund flow

---

## Sprint 10: Notifications & Reviews

**Goal:** Hệ thống thông báo và đánh giá

### PET_OWNER - Notifications (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO10-01 | Receive Push Notifications | Nhận push notification | P0 | [ ] |
| PO10-02 | Booking Reminder | Nhắc nhở lịch hẹn | P0 | [ ] |
| PO10-03 | Vaccination Reminder | Nhắc nhở tiêm chủng | P1 | [ ] |
| PO10-04 | View Notification List | Xem danh sách thông báo | P0 | [ ] |
| PO10-05 | Mark as Read | Đánh dấu đã đọc | P1 | [ ] |

### PET_OWNER - Reviews (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO10-06 | Rate Appointment | Đánh giá buổi khám | P0 | [ ] |
| PO10-07 | Write Review | Viết nhận xét | P0 | [ ] |
| PO10-08 | View My Reviews | Xem đánh giá đã viết | P1 | [ ] |

### VET - Notifications & Reviews (Mobile + Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| V10-01 | Receive New Booking Alert | Nhận thông báo booking mới | P0 | [ ] |
| V10-02 | View My Reviews | Xem đánh giá về tôi | P1 | [ ] |
| V10-03 | View Average Rating | Xem điểm trung bình | P1 | [ ] |

### Backend Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| B10-01 | Firebase Push Integration | Tuân | P0 | [ ] |
| B10-02 | Notification Service | Tuân | P0 | [ ] |
| B10-03 | Reminder Scheduler | Tuân | P1 | [ ] |
| B10-04 | Review CRUD APIs | Triết | P0 | [ ] |
| B10-05 | Rating Calculation | Triết | P0 | [ ] |
| B10-06 | Email Notification Service | Tuân | P2 | [ ] |

**Sprint 10 Deliverables:**
- [ ] Push notifications working
- [ ] Booking reminders
- [ ] Review & Rating system

---

# PHASE 4: AI & INTEGRATION (Sprint 11-13)

## Sprint 11: AI Chatbot - Basic

**Goal:** AI Chatbot cơ bản với Main Agent

### PET_OWNER - AI Chat (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO11-01 | Open Chat Interface | Mở giao diện chat AI | P0 | [ ] |
| PO11-02 | Send Message | Gửi tin nhắn | P0 | [ ] |
| PO11-03 | Receive AI Response | Nhận phản hồi từ AI | P0 | [ ] |
| PO11-04 | View Chat History | Xem lịch sử chat | P1 | [ ] |
| PO11-05 | Clear Chat | Xóa lịch sử chat | P2 | [ ] |

### ADMIN - Agent Configuration (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A11-01 | View Agent List | Xem danh sách agents | P0 | [ ] |
| A11-02 | Edit System Prompt | Chỉnh sửa System Prompt | P0 | [ ] |
| A11-03 | Save Prompt Version | Lưu version prompt | P1 | [ ] |
| A11-04 | Enable/Disable Agent | Bật/tắt agent | P0 | [ ] |
| A11-05 | Configure Temperature | Cấu hình temperature | P1 | [ ] |

### AI Service Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| AI11-01 | Setup LangGraph | Tân | P0 | [ ] |
| AI11-02 | Implement Main Agent | Tân | P0 | [ ] |
| AI11-03 | Ollama Integration | Tân | P0 | [ ] |
| AI11-04 | WebSocket Streaming | Tân | P0 | [ ] |
| AI11-05 | Chat History Storage | Tân | P1 | [ ] |

**Sprint 11 Deliverables:**
- [ ] Basic AI chat working
- [ ] Main Agent routing
- [ ] Admin can configure agents

---

## Sprint 12: AI Chatbot - Sub-Agents

**Goal:** Medical Agent, Booking Agent, Research Agent

### PET_OWNER - Advanced AI Features (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO12-01 | Ask Medical Questions | Hỏi về triệu chứng, bệnh | P0 | [ ] |
| PO12-02 | Get Care Advice | Nhận tư vấn chăm sóc | P0 | [ ] |
| PO12-03 | Book via Chat | Đặt lịch qua chat | P1 | [ ] |
| PO12-04 | Check Slot via Chat | Kiểm tra slot qua chat | P1 | [ ] |
| PO12-05 | Search Products/Info | Tìm kiếm sản phẩm/thông tin | P2 | [ ] |
| PO12-06 | View Citations | Xem nguồn trích dẫn | P1 | [ ] |

### ADMIN - Sub-Agent Management (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A12-01 | Configure Medical Agent | Cấu hình Medical Agent | P0 | [ ] |
| A12-02 | Configure Booking Agent | Cấu hình Booking Agent | P0 | [ ] |
| A12-03 | Configure Research Agent | Cấu hình Research Agent | P1 | [ ] |
| A12-04 | View Agent Hierarchy | Xem cấu trúc phân cấp | P0 | [ ] |

### AI Service Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| AI12-01 | Implement Medical Agent | Tân | P0 | [ ] |
| AI12-02 | Implement Booking Agent | Tân | P0 | [ ] |
| AI12-03 | Implement Research Agent | Tân | P1 | [ ] |
| AI12-04 | Agent Routing Logic | Tân | P0 | [ ] |
| AI12-05 | Confidence Check Logic | Tân | P1 | [ ] |
| AI12-06 | Web Search Integration | Tân | P1 | [ ] |

**Sprint 12 Deliverables:**
- [ ] Medical Agent with RAG
- [ ] Booking Agent with tools
- [ ] Research Agent with web search
- [ ] Agent handoffs working

---

## Sprint 13: RAG, Tools & Advanced AI

**Goal:** Knowledge Base, Tools Management, SOS

### ADMIN - Knowledge Base (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A13-01 | Upload Documents | Upload tài liệu (PDF, DOCX) | P0 | [ ] |
| A13-02 | View Indexing Status | Xem trạng thái indexing | P0 | [ ] |
| A13-03 | Test RAG Retrieval | Test truy vấn RAG | P0 | [ ] |
| A13-04 | View Vector Stats | Xem thống kê vector | P1 | [ ] |
| A13-05 | Delete Documents | Xóa tài liệu | P1 | [ ] |

### ADMIN - Tool Management (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A13-06 | Scan Tools | Quét tools từ code | P0 | [ ] |
| A13-07 | View Tool Schema | Xem schema tool | P0 | [ ] |
| A13-08 | Assign Tool to Agent | Gán tool cho agent | P0 | [ ] |
| A13-09 | Enable/Disable Tool | Bật/tắt tool | P0 | [ ] |

### ADMIN - Playground (Web)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| A13-10 | Test Agent Chat | Test chat với agent | P0 | [ ] |
| A13-11 | View Thinking Process | Xem quá trình suy luận | P0 | [ ] |
| A13-12 | View Tool Calls | Xem tool calls | P0 | [ ] |
| A13-13 | View Citations | Xem nguồn trích dẫn | P1 | [ ] |
| A13-14 | Rate Response | Đánh giá câu trả lời | P1 | [ ] |

### PET_OWNER - SOS Feature (Mobile)
| ID | Use Case | Description | Priority | Status |
|----|----------|-------------|----------|--------|
| PO13-01 | Trigger SOS | Bấm nút SOS cấp cứu | P0 | [ ] |
| PO13-02 | Find Nearest Emergency Clinic | Tìm phòng khám gần nhất | P0 | [ ] |
| PO13-03 | Quick Contact | Liên hệ nhanh | P0 | [ ] |
| PO13-04 | Emergency Booking | Đặt lịch khẩn cấp | P1 | [ ] |

### AI Service Tasks
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| AI13-01 | RAG Pipeline (LlamaIndex) | Tân | P0 | [ ] |
| AI13-02 | Qdrant Integration | Tân | P0 | [ ] |
| AI13-03 | Tool Scanner Service | Tân | P0 | [ ] |
| AI13-04 | Tool Execution Engine | Tân | P0 | [ ] |
| AI13-05 | Thinking Process Streaming | Tân | P1 | [ ] |
| AI13-06 | Citation Tracking | Tân | P1 | [ ] |

**Sprint 13 Deliverables:**
- [ ] RAG with uploaded documents
- [ ] Tool management working
- [ ] Agent Playground
- [ ] SOS feature

---

# PHASE 5: POLISH & LAUNCH (Sprint 14)

## Sprint 14: Testing, Bug Fixes & Deployment

**Goal:** QA, bug fixes, production deployment

### Testing
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| T14-01 | Unit Tests - Backend | Tuân/Triết | P0 | [ ] |
| T14-02 | Unit Tests - Frontend | Huyền | P0 | [ ] |
| T14-03 | Unit Tests - Mobile | Uyên | P0 | [ ] |
| T14-04 | Unit Tests - AI Service | Tân | P0 | [ ] |
| T14-05 | Integration Tests | All | P0 | [ ] |
| T14-06 | E2E Tests | All | P1 | [ ] |
| T14-07 | Performance Testing | Tân | P1 | [ ] |
| T14-08 | Security Testing | Tuân | P0 | [ ] |

### Bug Fixes
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| BF14-01 | Fix Critical Bugs | All | P0 | [ ] |
| BF14-02 | Fix High Priority Bugs | All | P0 | [ ] |
| BF14-03 | Fix Medium Priority Bugs | All | P1 | [ ] |
| BF14-04 | UI/UX Polish | Huyền/Uyên | P1 | [ ] |

### Deployment
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| D14-01 | Setup Production Environment | Tân | P0 | [ ] |
| D14-02 | Deploy Backend to Render | Tân | P0 | [ ] |
| D14-03 | Deploy AI Service to Render | Tân | P0 | [ ] |
| D14-04 | Deploy Frontend to Vercel | Tân | P0 | [ ] |
| D14-05 | Setup Production Databases | Tân | P0 | [ ] |
| D14-06 | Configure DNS & SSL | Tân | P0 | [ ] |
| D14-07 | Setup Monitoring | Tân | P1 | [ ] |
| D14-08 | Build Mobile APK/IPA | Uyên | P0 | [ ] |

### Documentation
| ID | Task | Owner | Priority | Status |
|----|------|-------|----------|--------|
| DOC14-01 | API Documentation | Tuân/Triết | P0 | [ ] |
| DOC14-02 | User Guide | Huyền | P1 | [ ] |
| DOC14-03 | Admin Guide | Tân | P1 | [ ] |
| DOC14-04 | Deployment Guide | Tân | P0 | [ ] |

**Sprint 14 Deliverables:**
- [ ] All tests passing
- [ ] Critical bugs fixed
- [ ] Production deployment complete
- [ ] Documentation complete

---

# Summary Statistics

## Total Use Cases by Actor

| Actor | Total Use Cases | P0 (Critical) | P1 (High) | P2 (Medium) |
|-------|-----------------|---------------|-----------|-------------|
| PET_OWNER | 67 | 42 | 20 | 5 |
| VET | 26 | 18 | 7 | 1 |
| CLINIC_MANAGER | 18 | 12 | 5 | 1 |
| CLINIC_OWNER | 13 | 8 | 4 | 1 |
| ADMIN | 32 | 20 | 10 | 2 |
| **Total** | **156** | **100** | **46** | **10** |

## Sprint Workload Distribution

| Sprint | Focus Area | Estimated Story Points |
|--------|------------|----------------------|
| Sprint 1 | Setup & Infrastructure | 30 |
| Sprint 2 | Authentication | 35 |
| Sprint 3 | Pet & Clinic Basic | 30 |
| Sprint 4 | Vet & Scheduling | 25 |
| Sprint 5 | Booking - Create | 35 |
| Sprint 6 | Booking - Workflow | 30 |
| Sprint 7 | Booking - Execution | 25 |
| Sprint 8 | EMR & Medical | 35 |
| Sprint 9 | Payment | 30 |
| Sprint 10 | Notifications & Reviews | 25 |
| Sprint 11 | AI Basic | 30 |
| Sprint 12 | AI Sub-Agents | 35 |
| Sprint 13 | RAG & Tools | 35 |
| Sprint 14 | Testing & Deployment | 40 |

## Team Assignment by Sprint

| Member | Primary Sprints | Support Sprints |
|--------|-----------------|-----------------|
| Tân (Leader) | 1, 11, 12, 13, 14 | All |
| Tuân | 2, 4, 8, 9, 10 | 14 |
| Triết | 3, 5, 6, 7, 10 | 14 |
| Huyền | 2, 3, 5, 6, 11 | 14 |
| Uyên | 2, 3, 5, 7, 11 | 14 |

---

**Last Updated:** 2025-12-14
**Version:** 1.0
**Maintained By:** Petties Team
