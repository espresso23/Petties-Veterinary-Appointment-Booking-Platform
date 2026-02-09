# 📋 SOS Booking Feature Checklist

Tài liệu này tổng hợp tất cả các hạng mục công việc đã triển khai cho tính năng SOS Booking & Auto-Match.

## 1. Backend Implementation (Spring Boot)
- [x] **Database & Models**:
    - [x] Thêm `sosFee` vào `Booking` entity.
    - [x] Thêm `sosFee` vào `ClinicPricePerKm` cấu hình.
- [x] **Core Business Logic**:
    - [x] `PricingService`: Tính phí SOS cố định, bỏ qua phí km.
    - [x] `StaffAssignmentService`: Bypass specialty check cho lịch SOS.
    - [x] `BookingService`: Checkout luồng SOS với khả năng ghi đè phí.
- [x] **SOS Auto-Match Engine**:
    - [x] `SosMatchingService`: Logic tìm 5 phòng khám gần nhất.
    - [x] `SosMatchingScheduler`: Tự động chuyển phòng khám sau 60s nếu không phản hồi.
    - [x] `SosController`: REST API & WebSocket endpoints.
- [x] **Live GPS Tracking**:
    - [x] `TrackingService`: Tích hợp Redis để lưu tọa độ real-time.
    - [x] `TrackingController`: WebSocket STOMP định danh theo `bookingId`.

## 2. Mobile Implementation (Flutter)
- [x] **SOS Request Flow**:
    - [x] Tích hợp nút SOS tại Home Screen.
    - [x] `SosMatchingService.dart`: Xử lý WebSocket matching.
    - [x] `SosMatchingScreen.dart`: Giao diện Radar Animation.
- [x] **Staff Tracking**:
    - [x] `StaffBookingDetailScreen.dart`: Gửi tọa độ GPS khi đang di chuyển.
    - [x] `SosTrackingScreen.dart`: Bản đồ theo dõi bác sĩ real-time cho khách hàng.
    - [x] `TrackingWebsocketService.dart`: Đăng ký nhận tọa độ qua STOMP.

## 3. Web Manager Implementation (React)
- [x] **SOS Alert System**:
    - [x] `sosWebSocket.ts`: Lắng nghe thông báo SOS cho phòng khám.
    - [x] `SosAlertModal.tsx`: Popup thông báo cấp cứu với countdown 60s.
    - [x] Tích hợp vào `ClinicManagerLayout.tsx`.
- [x] **Clinic Configuration**:
    - [x] `ClinicForm.tsx`: Cho phép Manager nhập phí SOS VNĐ.
    - [x] `ClinicDetailPage.tsx`: Hiển thị phí SOS nổi bật.

## 4. Quality & Documentation
- [x] **Unit Testing**:
    - [x] `SosBookingUnitTest.java` (Logic nghiệp vụ).
    - [x] `SosMatchingServiceUnitTest.java` (Logic tự động khớp).
    - [x] `TrackingServiceUnitTest.java` (Logic GPS).
- [x] **Documents**:
    - [x] `SOS_BOOKING_E2E_TEST_GUIDE.md`: Hướng dẫn test kịch bản đầy đủ.
    - [x] Cập nhật SRS & SDD (Section SOS & Tracking).

## 5. Bug Fixes (09/02/2026)
- [x] **WebSocket Topic Alignment**:
    - [x] Backend gửi SOS alert tới `/topic/clinic/{clinicId}/sos-alert`.
    - [x] Web Manager subscribe đúng topic.
- [x] **Event Field Mismatch**:
    - [x] Thêm `event` field vào `SosAlertMessage` interface (sosWebSocket.ts).
    - [x] `SosAlertModal.tsx` kiểm tra `event === 'CLINIC_NOTIFIED'`.
- [x] **Database Column Length**:
    - [x] Migration `V202602091352__extend_booking_status_column.sql` mở rộng status từ varchar(20) → varchar(30).
- [x] **Redis Distributed Lock**:
    - [x] Thêm lock trong `escalateToNextClinic()` tránh race condition.

---
*Cập nhật lần cuối: 09/02/2026 bởi Antigravity*

