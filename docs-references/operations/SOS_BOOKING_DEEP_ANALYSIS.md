# 🚑 Phân tích chuyên sâu: Cơ chế SOS Matching trong Petties

Tài liệu này cung cấp cái nhìn chi tiết về cách hệ thống xử lý các ca cấp cứu (SOS), các kỹ thuật nâng cao được áp dụng và những vấn đề thực tế phát sinh (Edge Cases) để chuẩn bị cho việc phản biện trước Hội đồng.

---

## 1. Luồng hoạt động cốt lõi (Core Workflow)

Hệ thống sử dụng cơ chế **Sequential Escalation (Thang bậc tuần tự)** thay vì Broadcast (Phát tin đồng loạt).

1.  **Khởi tạo:** Chủ nuôi gửi yêu cầu SOS kèm tọa độ GPS. Hệ thống tìm các phòng khám trong bán kính **10km**.
2.  **Sắp xếp ưu tiên:** Danh sách phòng khám được sắp xếp theo khoảng cách từ gần đến xa.
3.  **Vòng lặp thông báo (Matching Loop):**
    *   Hệ thống gửi Alert đến phòng khám thứ nhất qua WebSocket/FCM.
    *   Phòng khám có **60 giây** để xác nhận (Accept) hoặc từ chối (Decline).
    *   Nếu từ chối hoặc hết 60 giây mà không phản hồi, hệ thống tự động chuyển sang phòng khám tiếp theo.
4.  **Kết thúc:** Quá trình dừng lại khi có phòng khám nhận ca hoặc đã thử hết 5 phòng khám gần nhất mà không thành công.

---

## 2. Các kỹ thuật nâng cao (Advanced Features)

### a. Redis-based Session Management
Thay vì lưu trạng thái khớp nối vào Database (gây chậm và rác dữ liệu), hệ thống sử dụng Redis để quản lý phiên SOS.
*   **Performance:** Truy xuất danh sách phòng khám và index hiện tại trong thời gian < 1ms.
*   **Reliability:** Nếu Server bị sập, `SosMatchingScheduler` sẽ quét lại Database và đồng bộ lại trạng thái từ Redis để tiếp tục quá trình leo thang mà không bị gián đoạn.

### b. Distributed Locking (Khóa phân tán)
Để tránh tình trạng "Race Condition" (ví dụ: hai Manager cùng nhấn nhận một ca cấp cứu, hoặc một User nhấn SOS liên tục), hệ thống áp dụng khóa phân tán:
*   `sos:lock:user:{userId}`: Chặn việc tạo nhiều yêu cầu SOS cùng lúc.
*   `sos:lock:booking:{bookingId}`: Chặn việc xử lý đồng thời (vừa hết hạn timeout vừa có người nhấn Accept).

### c. Real-time Status Synchronization
Sử dụng **WebSocket (STOMP)** để đẩy trạng thái liên tục cho chủ nuôi:
*   "Đang tìm phòng khám..."
*   "Đang chờ Phòng khám A xác nhận (45s còn lại)..."
*   "Phòng khám A đã từ chối, đang chuyển sang Phòng khám B..."

---

## 3. Phân tích Edge Cases (Dành cho phản biện Hội đồng)

Dưới đây là các tình huống thực tế và cách hệ thống xử lý (hoặc giới hạn):

### Case 1: "Thundering Herd" & Concurrency
*   **Hỏi:** Nếu đúng lúc 60s hết hạn, Manager nhấn Accept thì sao?
*   **Trả lời:** Hệ thống sử dụng `SosSessionManager.acquireBookingLock()`. Nếu Scheduler đang thực hiện leo thang (escalate), Manager sẽ nhận được thông báo "Yêu cầu đang được xử lý" và không thể Accept được nữa. Khóa này đảm bảo tính toàn vẹn dữ liệu.

### Case 2: Không có phòng khám nào nhận ca
*   **Hỏi:** Nếu thử hết 5 phòng khám mà tất cả đều từ chối hoặc timeout?
*   **Trả lời:** Hệ thống sẽ chuyển trạng thái Booking thành `CANCELLED` với lý do "Không tìm thấy phòng khám khả dụng". 
*   **Xử lý thực tế:** Trong suốt quá trình tìm kiếm, hệ thống luôn trả về số điện thoại của phòng khám đang được liên hệ (`clinicPhone`). Điều này cho phép chủ nuôi có thể chủ động gọi điện trực tiếp cho phòng khám để giục hoặc xác nhận tình trạng cấp cứu, thay vì chờ đợi thụ động. Petties đóng vai trò là cầu nối thông tin, không vận hành hotline cấp cứu tập trung.

### Case 3: Sự cố mạng giữa chừng
*   **Hỏi:** Nếu Manager nhấn Accept nhưng mạng bị đứt trước khi Request tới Server?
*   **Trả lời:** Client (Web Manager) có cơ chế "Catch-up". Khi kết nối lại, Manager có thể gọi API `getActiveSosAlertsForManager` để lấy lại các alert vẫn còn trong thời gian hiệu lực (TTL) trong Redis.

### Case 4: Chủ nuôi di chuyển vị trí sau khi gửi SOS
*   **Hỏi:** Tọa độ SOS có được cập nhật theo thời gian thực không?
*   **Trả lời:** Hiện tại, hệ thống fix tọa độ tại thời điểm gửi yêu cầu để tính toán danh sách phòng khám ban đầu. 
*   **Cải tiến (nếu được hỏi):** Có thể áp dụng cập nhật tọa độ mỗi 30s, nhưng sẽ gây tải lớn cho việc tính toán lại khoảng cách. Giải pháp hiện tại là ưu tiên tốc độ phản hồi ban đầu.

---

## 4. Các điểm yếu hiện tại & Hướng phát triển (Future Work)

Nếu Hội đồng hỏi về điểm chưa tốt, bạn hãy thẳng thắn nêu ra các điểm này và hướng giải quyết:

1.  **Phạm vi tìm kiếm cố định (10km):** Nếu ở vùng sâu vùng xa không có phòng khám trong 10km, hệ thống sẽ thất bại ngay lập tức.
    *   *Giải pháp:* Triển khai "Radius Expansion" - tự động mở rộng bán kính lên 20km, 50km nếu 10km đầu tiên không có kết quả.
2.  **Chưa kiểm tra trạng thái hoạt động thực tế của Staff:** Hệ thống mới chỉ kiểm tra Clinic có mở cửa không, chưa kiểm tra xem bác sĩ trực có đang bận ca mổ hay không.
    *   *Giải pháp:* Tích hợp với lịch làm việc (Shift) và trạng thái "Bận/Rảnh" của Staff trong hệ thống Quản lý nhân sự.
3.  **Lệch múi giờ/Thời gian thực:** Việc kiểm tra timeout dựa trên `System.currentTimeMillis()` có thể bị lệch nếu cụm Server không đồng bộ thời gian.
    *   *Giải pháp:* Sử dụng thời gian chuẩn từ Redis (Redis Server Time).

---
*Tài liệu này giúp sinh viên nắm vững kiến trúc SOS để tự tin trả lời các câu hỏi về tính nhất quán dữ liệu và hiệu năng hệ thống.*
