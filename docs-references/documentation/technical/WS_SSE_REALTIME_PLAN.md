# 🚀 Lộ Trình Triển Khai Hệ Thống Real-time (WebSocket & SSE) - Petties Platform

## 1. Tổng quan (Overview)
Hệ thống Real-time của Petties sử dụng kết hợp hai công nghệ bổ trợ nhau:
*   **SSE (Server-Sent Events):** Phù hợp cho các thông báo một chiều từ Server xuống Client (Notification, Badge count, Alert).
*   **WebSocket (WS):** Phù hợp cho dữ liệu hai chiều, tần suất cao (Chat, Live Tracking, Routing).

Tài liệu này định hướng cách phối hợp hai công nghệ này để mang lại trải nghiệm người dùng tối ưu nhất.

## 2. Trạng thái hiện tại (Current Status - Done ✅)
Hệ thống hiện đã tích hợp hoàn tất các luồng thông báo chính qua **SSE**:

*   **Thông báo Phòng khám (Clinic Notifications):** `APPROVED`, `REJECTED`, `CLINIC_PENDING_APPROVAL`.
*   **Thông báo Lịch làm việc (Staff Shift Notifications):** `STAFF_SHIFT_ASSIGNED`, `STAFF_SHIFT_UPDATED`, `STAFF_SHIFT_DELETED`.
*   **Sidebar Badge Count:** Cập nhật số lượng thông báo chưa đọc thời gian thực cho tất cả các Role.
*   **Real-time Pending Clinic Counter (Admin):** Tự động cập nhật số lượng phòng khám chờ duyệt trên Sidebar Admin ngay khi có yêu cầu mới hoặc có thay đổi trạng thái. ✅

---

## 3. Các Mục Tiêu Ứng Dụng Tương Lai (Future Use Cases)

### Phân hệ A: Quản lý Lịch hẹn & Hàng đợi (SSE)
*   **Live Booking Update:** Tự động cập nhật slot lịch hẹn trên màn hình Quản lý.
*   **Queue Status:** Cập nhật trạng thái "Đang khám", "Chờ thanh toán" trên Dashboard.

### Phân hệ B: Chat & Tư vấn AI (WebSocket & SSE)
*   **Live Chat (WS):** Truyền tải tin nhắn hai chiều giữa Khách hàng và Phòng khám.
*   **New Message Alert (SSE):** Thông báo đẩy khi có tin nhắn mới dù người dùng đang ở trang khác.
*   **Streaming AI (SSE):** Đẩy kết quả AI Agent theo kiểu "typing" từng từ.

### Phân hệ C: Dịch vụ Khám tại nhà - Staff Routing (WebSocket - Cực kỳ quan trọng)
*   **Live GPS Tracking (WS):** Nhân viên liên tục gửi tọa độ GPS lên Server và Server đẩy ngay lập tức xuống bản đồ của Khách hàng.
*   **Distance Calculation:** Tự động tính toán lại khoảng cách và thời gian dự kiến đến (ETA) theo vị trí thực tế của Nhân viên.

### Phân hệ D: Tài chính & Thao tác nghiệp vụ (SSE)
*   **Payment Success (SSE/Webhook):** Tự động đóng cửa sổ thanh toán ngay khi giao dịch thành công.
*   **Data Change Alert (SSE):** Thông báo cho nhân viên khi có thay đổi lớn trong hệ thống (Ví dụ: Cập nhật bảng giá dịch vụ).

### Phân hệ E: Quản lý hiện diện & Cộng tác (WebSocket - Nâng cao)
*   **User Presence (WS):** Hiển thị trạng thái Online/Offline của nhân viên và nhân viên trong thời gian thực.
*   **EMR Editing Lock (WS):** Cảnh báo khi có hai nhân viên cùng truy cập/chỉnh sửa một hồ sơ bệnh án (EMR) để tránh ghi đè dữ liệu.

---

## 4. Hướng dẫn Kỹ thuật (Technical Guidelines)

### Khi nào dùng SSE?
*   Dữ liệu chỉ đi từ Server -> Client.
*   Tần suất cập nhật không quá dày đặc.
*   Cần sự đơn giản trong triển khai (HTTP chuẩn).

### Khi nào dùng WebSocket?
*   Cần tương tác hai chiều (Chat).
*   Cập nhật dữ liệu liên tục (GPS Routing).
*   Yêu cầu độ trễ (latency) cực thấp.

---

## 5. Tiêu chuẩn UI/UX cho Real-time
*   **Toast Notification:** Đi kèm âm thanh nhẹ hoặc hiệu ứng rung.
*   **Highlight Effect:** Flash nhẹ (vàng nhạt) vùng dữ liệu vừa được cập nhật qua SSE/WS để thu hút sự chú ý.
*   **Graceful Degradation:** Tự động chuyển sang chế độ Polling (Short polling) nếu kết nối Real-time bị thất bại.

---
*Tài liệu này được cập nhật vào ngày 05/01/2026 bởi Petties AI Agent.*
