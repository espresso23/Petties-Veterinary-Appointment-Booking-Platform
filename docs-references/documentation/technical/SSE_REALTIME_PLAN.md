# 🚀 Lộ Trình Triển Khai Hệ Thống Real-time (SSE) - Petties Platform

## 1. Tổng quan (Overview)
Hiện tại, dự án Petties đã có sẵn nền tảng `SseEmitterService` để đẩy thông báo (Notifications). Tài liệu này định hướng cách mở rộng nền tảng này để biến Petties thành một ứng dụng Real-time hoàn chỉnh, nâng cao trải nghiệm người dùng (UI/UX Pro Max).

## 2. Trạng thái hiện tại (Current Status - Done ✅)
Hệ thống SSE hiện đã được tích hợp hoàn tất cho các luồng thông báo chính:

*   **Thông báo Phòng khám (Clinic Notifications):**
    *   `APPROVED`/`REJECTED`: Gửi cho **Clinic Owner** ngay khi Admin phê duyệt hoặc từ chối phòng khám.
    *   `CLINIC_PENDING_APPROVAL`: Gửi cho tất cả **Admin** ngay khi có phòng khám mới đăng ký.
*   **Thông báo Lịch làm việc (Staff Shift Notifications):**
    *   `STAFF_SHIFT_ASSIGNED`: Gửi cho **Nhân viên** khi được gán ca làm việc mới.
    *   `STAFF_SHIFT_UPDATED`: Gửi cho **Nhân viên** khi lịch trực bị thay đổi.
    *   `STAFF_SHIFT_DELETED`: Gửi cho **Nhân viên** khi ca làm việc bị hủy.
*   **Hệ thống đếm thông báo Real-time:**
    *   Cập nhật con số chưa đọc (Unread Badge) trên thanh Sidebar ngay lập tức cho 5 roles. ✅
*   **Hệ thống đếm Phòng khám chờ duyệt (Admin Clinic Counter):**
    *   Cập nhật số lượng "Pending Clinic" tức thì trên Sidebar Admin ngay khi có yêu cầu mới (giúp Admin không cần F5 để thấy case mới). ✅

---

## 3. Các Mục Tiêu Ứng Dụng Tương Lai (Future Use Cases)

### Phân hệ A: Quản lý Lịch hẹn & Hàng đợi (Booking & Queue)
*   **Live Booking Update:** Khi khách đặt lịch, màn hình Quản lý của Clinic tự động cập nhật slot mà không cần load lại trang.
*   **Queue Status:** Cập nhật trạng thái "Đang khám", "Chờ thanh toán" trên Dashboard của Nhân viên và Lễ tân ngay khi có tác động từ phía đối diện.
*   **Auto-conflict Alert:** Cảnh báo tức thì nếu hai người cùng cố gắng đặt một slot tại cùng một thời điểm.

### Phân hệ B: Tư vấn & AI (AI Assistant)
*   **Streaming AI Response:** Đẩy kết quả từ AI Agent theo từng từ (streaming) để giảm cảm giác chờ đợi cho chủ thú cưng.
*   **Live Chat Support:** Kết hợp với WebSocket để đẩy thông báo "Bạn có tin nhắn mới" và nội dung xem trước của tin nhắn.

### Phân hệ C: Tài chính & Dashboard (Live Analytics)
*   **Payment Success Verification:** Tự động đóng cửa sổ thanh toán và hiển thị hóa đơn ngay khi nhận được Webhook từ cổng thanh toán (VNPay/PayOS).
*   **Daily Live Stats:** Biểu đồ doanh thu và số ca khám trong ngày nhảy số theo thời gian thực cho Owner.

---

## 3. Lộ trình triển khai (Implementation Phases)

### Giai đoạn 1: Đồng bộ hóa Lịch trình (Quý 1)
*   [ ] Tích hợp SSE vào màn hình `StaffSchedulePage` và `ClinicManagerPage`.
*   [ ] Sự kiện: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `STAFF_CHECK_IN`.

### Giai đoạn 2: Trải nghiệm AI & Thanh toán (Quý 2)
*   [ ] Triển khai Streaming cho AI Agent.
*   [ ] Tích hợp xử lý thanh toán Real-time.
*   [ ] Sự kiện: `AI_CHUNK_RECEIVED`, `PAYMENT_COMPLETED`.

### Giai đoạn 3: Hệ thống Thống kê trực tiếp (Quý 3)
*   [ ] Live Dashboard cho Admin và Clinic Owner.
*   [ ] Sự kiện: `SYSTEM_STATS_UPDATE`, `CLINIC_STATUS_CHANGE`.

---

## 4. Hướng dẫn Kỹ thuật (Technical Guidelines)

### Cách thêm một loại Sự kiện mới (Backend):
1.  **Định nghĩa Event Type:** Thêm vào Enum (hoặc String constant) trong `SseEventDto`.
2.  **Kích hoạt từ Service:** 
    ```java
    SseEventDto event = SseEventDto.builder()
        .type("BOOKING_UPDATE")
        .data(bookingDetailDto)
        .build();
    sseEmitterService.pushToUser(ownerId, event);
    ```

### Cách xử lý tại Frontend:
1.  **Lắng nghe sự kiện:** Sử dụng `useSse` hook hiện có.
2.  **Cập nhật Cache:** Sử dụng **React Query (Invalide Queries)** hoặc cập nhật trực tiếp vào State để UI thay đổi mượt mà.

---

## 5. Tiêu chuẩn UI/UX cho Real-time
*   **Toast Notification:** Luôn đi kèm với một âm thanh nhẹ hoặc hiệu ứng rung (với Mobile).
*   **Highlight Effect:** Khi dữ liệu trên bảng thay đổi qua SSE, hãy **flash** nhẹ (ví dụ nền vàng nhạt rồi mờ dần) để người dùng biết chỗ nào vừa thay đổi.
*   **Graceful Degradation:** Nếu kết nối SSE bị ngắt, hệ thống phải tự động chuyển sang chế độ Polling (5-10s/lần) để đảm bảo không mất dữ liệu.

---
*Tài liệu này được tạo vào ngày 05/01/2026 bởi Petties AI Agent.*
