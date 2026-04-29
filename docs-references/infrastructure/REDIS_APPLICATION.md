# 🚀 Ứng dụng Redis trong Hệ thống Petties

Redis đóng vai trò quan trọng trong việc tối ưu hóa hiệu năng, đảm bảo tính bảo mật và xử lý các luồng nghiệp vụ thời gian thực (real-time) trong hệ thống Petties. Dưới đây là các ứng dụng chi tiết của Redis.

---

## 1. Quản lý OTP (One-Time Password)
Redis được sử dụng làm bộ nhớ tạm thời cho các mã OTP nhờ tính năng **TTL (Time-To-Live)** tự động xóa dữ liệu sau một khoảng thời gian.

*   **Các luồng áp dụng:**
    *   **Đăng ký tài khoản:** Lưu trữ dữ liệu đăng ký tạm thời (`PendingRegistrationData`) và mã OTP.
    *   **Quên mật khẩu:** Lưu trữ mã OTP xác thực thay đổi mật khẩu (`PasswordResetOtpData`).
    *   **Thay đổi Email:** Xác thực email mới trước khi cập nhật vào Database.
*   **Cấu hình:**
    *   **Thời gian sống (TTL):** 5 phút.
    *   **Cơ chế:** Khi hết hạn, Redis tự động xóa key, giúp hệ thống không bị rác dữ liệu.
    *   **Key Pattern:** `otp:registration:{email}`, `otp:password_reset:{email}`, `otp:email_change:{userId}`.

---

## 2. Giới hạn tốc độ API (API Rate Limiting)
Để bảo vệ hệ thống khỏi các cuộc tấn công Brute-force hoặc Spam API, Petties sử dụng Redis để theo dõi tần suất yêu cầu.

*   **Cơ chế:** Sử dụng `ApiRateLimitInterceptor` kết hợp với lệnh `INCR` của Redis.
*   **Chi tiết:**
    *   **Identifier:** Dựa trên IP (đối với khách) hoặc UserId (đối với người dùng đã đăng nhập).
    *   **Cấu hình giới hạn:**
        *   **Auth APIs:** 20 yêu cầu/phút (ngăn chặn brute-force login).
        *   **Default APIs:** 100 yêu cầu/phút.
    *   **Key Pattern:** `rate:api:{bucket}:{identifier}:{minute_timestamp}`.

---

## 3. Hệ thống Điều phối SOS (SOS Matching System)
Đây là phần ứng dụng phức tạp nhất của Redis trong dự án, đảm bảo việc điều phối ca cấp cứu diễn ra chính xác và không bị trùng lặp.

### a. Khóa phân tán (Distributed Lock)
*   **Mục đích:** Đảm bảo tại một thời điểm chỉ có một luồng xử lý SOS cho một User hoặc một Booking nhất định, tránh race-condition.
*   **Cơ chế:** Sử dụng `setIfAbsent` (SETNX) với timeout 30 giây.
*   **Key Pattern:** `sos:lock:user:{userId}`, `sos:lock:booking:{bookingId}`.

### b. Quản lý phiên khớp nối (Matching Session)
*   **Mục đích:** Lưu trữ trạng thái của quá trình tìm kiếm phòng khám cấp cứu mà không cần ghi vào Database liên tục.
*   **Thông tin lưu trữ:**
    *   Danh sách ID phòng khám ưu tiên (theo khoảng cách).
    *   Index của phòng khám hiện tại đang được thông báo.
    *   Thời điểm thông báo (để tính toán timeout 60s cho mỗi phòng khám).
*   **Key Pattern:** `sos:matching:{bookingId}:clinics`, `sos:matching:{bookingId}:index`, `sos:matching:{bookingId}:notifiedAt`.

---

## 4. Bộ nhớ đệm (Application Caching)
Sử dụng Spring Cache abstraction với Redis làm Provider để giảm tải cho cơ sở dữ liệu PostgreSQL.

*   **Dữ liệu được cache:**
    *   Danh sách phòng khám (Clinics) theo khu vực.
    *   Thông tin dịch vụ (Clinic Services) phổ biến.
    *   Cấu hình hệ thống.
*   **Cấu hình:**
    *   **TTL mặc định:** 60 phút.
    *   **Serializer:** Sử dụng `Jackson2JsonRedisSerializer` để lưu trữ dữ liệu dưới dạng JSON, giúp dễ dàng debug và tương thích cao.

---

## 🛠 Thông số kỹ thuật
*   **Thư viện:** `spring-boot-starter-data-redis` (Lettuce driver).
*   **Serializer:** `StringRedisSerializer` cho Key và `Jackson2JsonRedisSerializer` cho Value.
*   **Hạ tầng:** 
    *   **Development:** Docker Image `redis:7-alpine`.
    *   **Production:** Redis Cloud (Upstash/Redis Labs).

---
*Tài liệu này được soạn thảo dựa trên cấu trúc mã nguồn thực tế của dự án Petties (Tháng 4/2026).*
