# 🤖 Petties AI Chatbot - Tài Liệu Kiến Trúc Toàn Diện (Modular & Goal-Oriented)

**Phiên bản:** 2.0.0 (Sau Refactor)  
**Cập nhật:** 20/05/2026  
**Trạng thái:** Production Ready

---

## 1. Triết Lý Thiết Kế

Hệ thống AI Chatbot của Petties đã được tái cấu trúc hoàn toàn từ dạng "Nguyên khối" (Monolithic) sang kiến trúc **Modular & Goal-Oriented**.

*   **Modular (Mô-đun hóa):** Chia nhỏ các công cụ của AI theo miền nghiệp vụ (Domain). Dễ bảo trì, dễ mở rộng.
*   **Goal-Oriented (Hướng mục tiêu):** AI không bị gò bó bởi các luồng (flow) cứng nhắc. Nó tự quyết định cách xử lý dựa trên **Mục tiêu (Goals)** và **Ràng buộc (Constraints)**.
*   **Source of Truth:** Trạng thái đặt lịch (Booking State) được quản lý tập trung tại Backend và đồng bộ thời gian thực về Frontend qua WebSocket.

---

## 2. Kiến Trúc Backend (Python Agent Service)

### 📂 Cấu trúc Module Tools (`app/core/tools/mcp_tools/`)
*   `pet_tools.py`: Quản lý hồ sơ thú cưng.
*   `clinic_search_tools.py`: Tìm kiếm và thông tin phòng khám.
*   `scheduling_tools.py`: Kiểm tra lịch trống (Slots).
*   `appointment_tools.py`: Tạo và quản lý lịch hẹn (Booking).
*   `staff_tools.py`: Các công cụ dành riêng cho nhân sự phòng khám.

### 🚀 Siêu Tool: `quick_booking_search`
Đây là điểm chạm đầu tiên quan trọng nhất. Trong 1 lần gọi, AI lấy được:
- Danh sách thú cưng của User.
- Resolve đúng phòng khám dựa trên tên/vị trí.
- Danh sách dịch vụ và các khung giờ rảnh (nếu có ngày).
**Kết quả:** Giảm số vòng lặp ReAct, phản hồi người dùng < 3 giây.

---

## 3. Kiến Trúc Frontend (Flutter Mobile)

### 🧠 Bộ não: `AiChatProvider`
Màn hình Chat giờ đây cực kỳ gọn nhẹ nhờ di dời toàn bộ logic vào Provider:
- Quản lý WebSocket (Auto-reconnect).
- Xử lý Streaming Buffer (Chữ chạy mượt mà).
- Tự động đồng bộ `BookingTracker` từ Backend Snapshot.

### 🧩 Hệ thống Component (Widgets)
Các thẻ hiển thị (Cards) được tách thành các Widget độc lập trong `lib/ui/chat/ai_chat/widgets/`:
- `AiClinicSuggestionCard`: Hiển thị gợi ý phòng khám.
- `AiSlotGridCard`: Chọn khung giờ khám.
- `AiStructuredBookingSummaryCard`: Form xác nhận thông tin cuối cùng.

---

## 4. Cơ Chế Đồng Bộ Trạng Thái (State Management)

1.  **AI Tool:** Khi AI thực hiện một hành động (ví dụ: chọn bé Milu), Tool sẽ cập nhật bản nháp (Draft) trong Backend Context.
2.  **WebSocket Sync:** Backend gửi sự kiện `booking_state_update` chứa toàn bộ Snapshot hiện tại.
3.  **FE Sync:** `AiChatProvider` nhận Snapshot và cập nhật `BookingTracker`, UI tự động làm mới form hiển thị.

---

## 5. Hướng Dẫn Phát Triển

### Cách thêm một Công cụ (Tool) mới:
1.  Xác định đúng Module nghiệp vụ trong `mcp_tools/`.
2.  Sử dụng decorator `@mcp_server.tool`.
3.  Sử dụng các helper từ `booking_helpers.py` để chuẩn hóa kết quả.
4.  Đăng ký module mới (nếu có) vào `mcp_tools/__init__.py`.

### Cách chỉnh sửa giọng điệu của AI:
Vào file `app/core/agents/prompt_builder.py`. Chỉnh sửa phần `GOALS & CONSTRAINTS`. Tránh viết luật dài dòng, ưu tiên dùng Few-shot examples.

---
© 2026 Petties AI Team.
