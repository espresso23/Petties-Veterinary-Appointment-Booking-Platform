# PETTIES - Tài liệu Yêu cầu Người dùng (URD)

**Dự án:** Petties - Nền tảng Đặt lịch Khám Thú y  
**Phiên bản:** 1.0  
**Cập nhật lần cuối:** 25/12/2025  

---

## 1. ĐỐI TƯỢNG SỬ DỤNG

### 1.1 Tổng quan đối tượng

Hệ thống Petties phục vụ **5 nhóm đối tượng** chính với các vai trò và nền tảng sử dụng khác nhau:

| STT | Đối tượng | Mô tả | Nền tảng |
|:---:|-----------|-------|:--------:|
| 1 | Chủ thú cưng (Pet Owner) | Người nuôi thú cưng, cần tìm dịch vụ y tế cho pet | 📱 Mobile |
| 2 | Bác sĩ thú y (Vet) | Chuyên gia y tế thực hiện khám, chẩn đoán, điều trị | 📱 Mobile + 💻 Web |
| 3 | Quản lý phòng khám (Clinic Manager) | Nhân viên vận hành phòng khám, điều phối lịch hẹn | 💻 Web |
| 4 | Chủ phòng khám (Clinic Owner) | Chủ doanh nghiệp phòng khám, quản lý kinh doanh | 💻 Web |
| 5 | Quản trị viên (Admin) | Quản lý toàn bộ nền tảng Petties | 💻 Web |

---

### 1.2 Chi tiết từng đối tượng

#### 1.2.1 🐾 Chủ thú cưng (Pet Owner)

**Đặc điểm:**
- Là người nuôi chó, mèo hoặc các loại thú cưng khác
- Có nhu cầu chăm sóc sức khỏe định kỳ và khẩn cấp cho thú cưng
- Sử dụng ứng dụng điện thoại để tìm kiếm và đặt lịch

**Vấn đề gặp phải:**
- ❌ Khó tìm phòng khám thú y uy tín gần nhà
- ❌ Không biết phòng khám nào có dịch vụ thăm khám tại nhà
- ❌ Khó so sánh giá cả và chất lượng dịch vụ giữa các phòng khám
- ❌ Quản lý lịch sử khám bệnh của nhiều thú cưng phức tạp
- ❌ Thiếu thông tin về lịch tiêm chủng định kỳ

**Kỳ vọng:**
- ✅ Tìm kiếm phòng khám theo vị trí, dịch vụ, đánh giá
- ✅ Đặt lịch khám tại phòng khám hoặc tại nhà dễ dàng
- ✅ Theo dõi hồ sơ y tế và sổ tiêm chủng tập trung
- ✅ Nhận thông báo nhắc nhở lịch hẹn và tiêm chủng
- ✅ Chat với AI để được tư vấn chăm sóc thú cưng

---

#### 1.2.2 👨‍⚕️ Bác sĩ thú y (Vet)

**Đặc điểm:**
- Là bác sĩ thú y có chứng chỉ hành nghề
- Thuộc về **một phòng khám duy nhất** (clinic-based)
- Thực hiện khám, chẩn đoán, điều trị cho thú cưng

**Vấn đề gặp phải:**
- ❌ Ghi chép hồ sơ bệnh án bằng giấy tờ, khó lưu trữ và tra cứu
- ❌ Khó nhớ lịch hẹn và booking được phân công trong ngày
- ❌ Không có công cụ nhận thông báo khi có booking mới
- ❌ Khi khám tại nhà, khó cập nhật tình trạng cho chủ pet

**Kỳ vọng:**
- ✅ Xem lịch làm việc và booking được phân công
- ✅ Xem hồ sơ bệnh án của thú cưng
- ✅ Ghi chú hồ sơ bệnh án và đơn thuốc điện tử
- ✅ Cập nhật sổ tiêm chủng cho thú cưng
- ✅ Nhận thông báo khi có booking mới

---

#### 1.2.3 👨‍💼 Quản lý phòng khám (Clinic Manager)

**Đặc điểm:**
- Là nhân viên điều hành hàng ngày tại phòng khám
- Tiếp nhận và phân bổ lịch hẹn cho bác sĩ
- Làm việc trên nền tảng web tại quầy lễ tân

**Vấn đề gặp phải:**
- ❌ Sổ đặt lịch thủ công, dễ bị trùng lịch
- ❌ Khó phân bổ công việc hợp lý cho đội ngũ bác sĩ
- ❌ Thiếu công cụ quản lý luồng khám trong ngày

**Kỳ vọng:**
- ✅ Xem và quản lý booking mới từ Pet Owner
- ✅ Phân công bác sĩ phù hợp cho từng booking
- ✅ Quản lý lịch làm việc (ca/shift) của bác sĩ
- ✅ Theo dõi luồng khám: Check-in → Khám → Check-out
- ✅ Chat với Pet Owner để tư vấn và hỗ trợ

---

#### 1.2.4 🏥 Chủ phòng khám (Clinic Owner)

**Đặc điểm:**
- Là chủ doanh nghiệp phòng khám thú y
- Có thể sở hữu một hoặc nhiều chi nhánh
- Quan tâm đến doanh thu, chất lượng dịch vụ, uy tín

**Vấn đề gặp phải:**
- ❌ Khó tiếp cận khách hàng mới
- ❌ Thiếu công cụ quản lý giá dịch vụ linh hoạt
- ❌ Không có báo cáo doanh thu chi tiết

**Kỳ vọng:**
- ✅ Quản lý thông tin phòng khám (địa chỉ, giờ mở cửa, hình ảnh)
- ✅ Quản lý danh mục dịch vụ và bảng giá linh hoạt
- ✅ Thêm và quản lý nhân viên (Manager, Vet)
- ✅ Xem báo cáo doanh thu và thống kê
- ✅ Nhận đánh giá từ khách hàng

---

#### 1.2.5 🔧 Quản trị viên (Admin)

**Đặc điểm:**
- Là nhân viên của Petties quản lý nền tảng
- Phê duyệt phòng khám mới, xử lý khiếu nại
- Cấu hình hệ thống AI Chatbot

**Kỳ vọng:**
- ✅ Phê duyệt/từ chối phòng khám đăng ký mới
- ✅ Giám sát hoạt động toàn nền tảng
- ✅ Cấu hình AI Agent (prompt, tools, knowledge base)
- ✅ Xem thống kê tổng quan (users, bookings, revenue)

---

## 2. MỤC TIÊU HỆ THỐNG

**Petties** được xây dựng với sứ mệnh:

> *"Kết nối chủ thú cưng với các phòng khám thú y chuyên nghiệp, mang lại trải nghiệm đặt lịch khám dễ dàng, minh bạch và an toàn."*

---

### 2.1 🐾 Chủ thú cưng (Pet Owner)

#### 2.1.1 Đặt lịch khám cho thú cưng

| Mục | Nội dung |
|-----|----------|
| **Actor** | Chủ thú cưng (Pet Owner) |
| **Mục tiêu** | Đặt lịch khám cho thú cưng tại phòng khám hoặc tại nhà một cách nhanh chóng và thuận tiện |
| **Giải pháp** | Cung cấp ứng dụng mobile cho phép tìm kiếm phòng khám, chọn dịch vụ, chọn thời gian và thanh toán online |

**Các bước thực hiện:**
1. Mở ứng dụng Petties trên điện thoại
2. Tìm kiếm phòng khám theo vị trí, dịch vụ hoặc đánh giá
3. Chọn phòng khám và xem danh sách dịch vụ
4. Chọn dịch vụ cần khám (khám tại phòng khám hoặc tại nhà)
5. Chọn thú cưng cần khám từ danh sách
6. Chọn ngày và khung giờ trống
7. Xác nhận thông tin và thanh toán online (Stripe)
8. Nhận xác nhận booking qua notification

---

#### 2.1.2 Quản lý hồ sơ thú cưng

| Mục | Nội dung |
|-----|----------|
| **Actor** | Chủ thú cưng (Pet Owner) |
| **Mục tiêu** | Lưu trữ và theo dõi thông tin, hồ sơ y tế của tất cả thú cưng |
| **Giải pháp** | Cung cấp tính năng quản lý hồ sơ pet với thông tin cá nhân, ảnh, và lịch sử y tế |

**Các bước thực hiện:**
1. Vào mục "Thú cưng của tôi"
2. Nhấn "Thêm thú cưng mới"
3. Nhập thông tin: Tên, loài, giống, ngày sinh, cân nặng
4. Tải ảnh đại diện cho thú cưng
5. Lưu hồ sơ
6. Xem hồ sơ y tế và sổ tiêm chủng được cập nhật sau mỗi lần khám

---

#### 2.1.3 Chat với AI tư vấn

| Mục | Nội dung |
|-----|----------|
| **Actor** | Chủ thú cưng (Pet Owner) |
| **Mục tiêu** | Được tư vấn nhanh về chăm sóc thú cưng 24/7 |
| **Giải pháp** | Cung cấp AI Chatbot thông minh với kiến thức về chăm sóc thú cưng |

**Các bước thực hiện:**
1. Mở tab "Chat AI" trong ứng dụng
2. Nhập câu hỏi về thú cưng (ví dụ: "Chó bị nôn phải làm sao?")
3. AI phân tích và trả lời với thông tin hữu ích
4. Nếu cần thiết, AI gợi ý đặt lịch khám ngay

---

### 2.2 👨‍⚕️ Bác sĩ thú y (Vet)

#### 2.2.1 Xem và quản lý booking được phân công

| Mục | Nội dung |
|-----|----------|
| **Actor** | Bác sĩ thú y (Vet) |
| **Mục tiêu** | Nắm rõ lịch hẹn trong ngày và chuẩn bị cho các ca khám |
| **Giải pháp** | Cung cấp giao diện xem lịch với danh sách booking chi tiết |

**Các bước thực hiện:**
1. Đăng nhập ứng dụng Petties (Mobile/Web)
2. Xem lịch làm việc theo ngày/tuần
3. Xem chi tiết từng booking: thông tin pet, dịch vụ, ghi chú
4. Xác nhận hoặc từ chối booking
5. Di chuyển đến địa chỉ (nếu khám tại nhà)

---

#### 2.2.2 Ghi chú hồ sơ bệnh án

| Mục | Nội dung |
|-----|----------|
| **Actor** | Bác sĩ thú y (Vet) |
| **Mục tiêu** | Ghi lại kết quả khám, chẩn đoán và đơn thuốc |
| **Giải pháp** | Cung cấp form nhập hồ sơ bệnh án điện tử |

**Các bước thực hiện:**
1. Chọn booking đang khám
2. Nhấn "Bắt đầu khám" (Check-in)
3. Xem thông tin và lịch sử khám của pet
4. Thực hiện khám và ghi chú triệu chứng
5. Nhập chẩn đoán và kê đơn thuốc
6. Cập nhật sổ tiêm chủng (nếu có)
7. Nhấn "Hoàn thành" (Check-out)

---

### 2.3 👨‍💼 Quản lý phòng khám (Clinic Manager)

#### 2.3.1 Quản lý và phân công booking

| Mục | Nội dung |
|-----|----------|
| **Actor** | Quản lý phòng khám (Clinic Manager) |
| **Mục tiêu** | Tiếp nhận booking mới và phân công bác sĩ phù hợp |
| **Giải pháp** | Cung cấp dashboard quản lý booking với tính năng gán bác sĩ |

**Các bước thực hiện:**
1. Đăng nhập trang web quản lý
2. Xem danh sách booking mới (trạng thái PENDING)
3. Xem chi tiết booking: dịch vụ, địa điểm, thời gian
4. Chọn bác sĩ còn trống trong khung giờ đó
5. Gán bác sĩ cho booking
6. Hệ thống gửi thông báo cho bác sĩ và Pet Owner

---

#### 2.3.2 Quản lý lịch làm việc bác sĩ

| Mục | Nội dung |
|-----|----------|
| **Actor** | Quản lý phòng khám (Clinic Manager) |
| **Mục tiêu** | Tạo và quản lý ca làm việc cho bác sĩ |
| **Giải pháp** | Cung cấp calendar view với tính năng tạo shift và tự động chia slot |

**Các bước thực hiện:**
1. Vào mục "Lịch làm việc"
2. Chọn bác sĩ và ngày làm việc
3. Nhập giờ bắt đầu, giờ kết thúc, giờ nghỉ trưa
4. Hệ thống tự động chia thành các slot 30 phút
5. Xác nhận và lưu ca làm việc
6. Slot hiển thị cho Pet Owner khi đặt lịch

---

### 2.4 🏥 Chủ phòng khám (Clinic Owner)

#### 2.4.1 Quản lý dịch vụ và giá cả

| Mục | Nội dung |
|-----|----------|
| **Actor** | Chủ phòng khám (Clinic Owner) |
| **Mục tiêu** | Cấu hình danh sách dịch vụ và bảng giá linh hoạt |
| **Giải pháp** | Cung cấp trang quản lý dịch vụ với pricing phức tạp (theo khoảng cách, cân nặng) |

**Các bước thực hiện:**
1. Vào mục "Quản lý dịch vụ"
2. Thêm dịch vụ mới hoặc chọn từ danh mục Master
3. Cấu hình giá cơ bản
4. Thêm phí theo khoảng cách (cho dịch vụ tại nhà)
5. Thêm phí theo cân nặng (nếu áp dụng)
6. Bật/tắt dịch vụ theo nhu cầu

---

#### 2.4.2 Quản lý nhân viên

| Mục | Nội dung |
|-----|----------|
| **Actor** | Chủ phòng khám (Clinic Owner) |
| **Mục tiêu** | Thêm và quản lý tài khoản nhân viên (Manager, Vet) |
| **Giải pháp** | Cung cấp tính năng tạo tài khoản nhanh với mật khẩu mặc định |

**Các bước thực hiện:**
1. Vào mục "Quản lý nhân viên"
2. Nhấn "Thêm nhân viên"
3. Nhập: Họ tên, Số điện thoại, Vai trò (Manager/Vet)
4. Hệ thống tạo tài khoản với mật khẩu = 6 số cuối SĐT
5. Nhân viên đăng nhập và đổi mật khẩu

---

### 2.5 🔧 Quản trị viên (Admin)

#### 2.5.1 Phê duyệt phòng khám mới

| Mục | Nội dung |
|-----|----------|
| **Actor** | Quản trị viên (Admin) |
| **Mục tiêu** | Kiểm duyệt và phê duyệt phòng khám đăng ký nền tảng |
| **Giải pháp** | Cung cấp dashboard admin với danh sách pending clinics |

**Các bước thực hiện:**
1. Đăng nhập Admin Dashboard
2. Xem danh sách phòng khám chờ duyệt
3. Xem chi tiết thông tin, giấy phép, hình ảnh
4. Phê duyệt hoặc từ chối (kèm lý do)
5. Hệ thống gửi thông báo cho Clinic Owner

---

#### 2.5.2 Cấu hình AI Agent

| Mục | Nội dung |
|-----|----------|
| **Actor** | Quản trị viên (Admin) |
| **Mục tiêu** | Điều chỉnh hành vi và kiến thức của AI Chatbot |
| **Giải pháp** | Cung cấp trang cấu hình Agent với prompt editor, tool management, knowledge base |

**Các bước thực hiện:**
1. Vào mục "AI Agent Config"
2. Chỉnh sửa System Prompt cho agent
3. Bật/tắt các Tools (ví dụ: search_clinics, create_booking)
4. Upload tài liệu vào Knowledge Base
5. Test agent trong Playground
6. Lưu cấu hình

---

**Ghi chú:** Tài liệu này sẽ được cập nhật liên tục dựa trên feedback từ stakeholders và user research.

