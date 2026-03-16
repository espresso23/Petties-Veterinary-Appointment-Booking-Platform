# AI Service - Full Use Cases by Role
**Petties Veterinary Platform**

Dưới đây là danh sách toàn bộ các ca sử dụng (Use Cases) của AI Service được phân chia chính xác theo vai trò người dùng (Dựa trên tài liệu Đặc tả Yêu cầu `AI_ASSISTANT_ROLE_REQUIREMENTS.md`).

---

### 1. Vai trò: PET_OWNER (Chủ Thú Cưng - Trên Mobile App)
*Người dùng cuối cần tư vấn sức khỏe và đặt lịch khám cho thú cưng. (Giao tiếp thụ động - AI chỉ trả lời khi được hỏi).*

1. **Hỏi đáp kiến thức thú y chung**: Hỏi về cách chăm sóc, dinh dưỡng, huấn luyện thú cưng.
2. **Tìm kiếm bệnh theo triệu chứng**: Mô tả triệu chứng để AI đánh giá tình trạng và mức độ khẩn cấp.
3. **Đặt lịch khám qua Chat (Booking via chat)**: Xác nhận đặt lịch trực tiếp ngay trong cuộc hội thoại với AI (bao gồm tìm phòng khám, kiểm tra lịch trống, lấy danh sách thú cưng).
4. **Tìm kiếm Web dự phòng (Web search fallback)**: Tự động tìm kiếm trên internet nếu kiến thức nội bộ không đủ.
5. **Đánh giá câu trả lời của AI**: Gửi Feedback để hệ thống tự học hỏi.

---

### 2. Vai trò: STAFF (Nhân Viên / Bác Sĩ Thú Y - Trên Web & Mobile)
*Hỗ trợ chẩn đoán và tóm tắt bệnh án (Diagnostic Support + Patient Summary).*

1. **Tóm tắt thông tin bệnh nhân (Patient Summary)**: Tổng hợp nhanh lịch sử khám, tình trạng tiêm phòng của thú cưng trước khi vào phòng khám.
2. **Hỗ trợ chẩn đoán lâm sàng**: AI hỗ trợ đưa ra các chẩn đoán phân biệt sơ bộ dựa trên triệu chứng hiện tại và hồ sơ bệnh án (EMR).
3. **Cảnh báo Red Flags**: Nhận diện các dấu hiệu nguy hiểm từ hồ sơ/triệu chứng và gợi ý các bước kiểm tra tiếp theo.
4. **Tra cứu hồ sơ y tế cũ (Case Memory)**: Tìm kiếm các ca bệnh tương tự trước đây đã được phòng khám xử lý thành công.

---

### 3. Vai trò: CLINIC_MANAGER (Quản Lý Phòng Khám - Trên Web)
*Trợ lý Phân tích & Chăm sóc khách hàng (Analytics & Customer Care).*

1. **Phân tích phản hồi khách hàng (Sentiment Analysis)**: Tự động tổng hợp và phân tích các đánh giá (reviews), phản hồi của khách hàng để nhận diện điểm mạnh và các vấn đề cần cải thiện của phòng khám.
2. **Hỗ trợ tạo nội dung chăm sóc khách hàng (Customer Care)**: AI hỗ trợ soạn thảo các mẫu tin nhắn nhắc lịch tái khám, tiêm phòng, hoặc hỏi thăm sức khỏe sau phẫu thuật một cách chuyên nghiệp.
3. **Tóm tắt tình hình lịch hẹn (Booking Trends Summary)**: Phân tích nhanh dữ liệu đặt lịch để báo cáo các khung giờ cao điểm, tỷ lệ hủy lịch, và dịch vụ được yêu cầu nhiều nhất trong tuần/tháng.

---

### 4. Vai trò: CLINIC_OWNER (Chủ Phòng Khám - Trên Web)
*Trợ lý Thiết lập Phòng khám (Clinic Setup Assistant).*

1. **Tự động tạo danh mục dịch vụ (Generate clinic services)**: Trong quá trình setup phòng khám mới, AI tự động gợi ý danh sách các dịch vụ khám chữa bệnh phù hợp dựa trên loại hình phòng khám và các loại thú cưng phục vụ.

---

### 5. Vai trò: ADMIN (Quản Trị Viên Hệ Thống - Trên Web)
*Quản lý, cấu hình và giám sát hoạt động của AI (Không chat trực tiếp với AI).*

1. **Bật/Tắt AI Agent**: Kích hoạt hoặc bảo trì hệ thống AI.
2. **Cấu hình System Prompt**: Chỉnh sửa định hướng và phong cách trả lời của AI cho từng role.
3. **Cấu hình Tham số Model**: Điều chỉnh Temperature, Max Tokens, và chọn model LLM từ OpenRouter (Gemini, Llama, Claude).
4. **Quản lý Công Cụ (Tools)**: Kích hoạt/vô hiệu hóa từng công cụ (@mcp.tool).
5. **Quản lý Nguồn Kiến Thức (Knowledge Base)**: Tải lên, cập nhật tài liệu y khoa vào Qdrant Vector DB và kiểm thử trích xuất (RAG Test).
6. **Quản lý API Keys**: Cấu hình các khóa bảo mật cho OpenRouter, Cohere, Qdrant, Jina.
7. **Mô phỏng & Debug**: Chat mô phỏng để xem chi tiết luồng suy nghĩ ReAct và gỡ lỗi hệ thống.