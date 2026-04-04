# AI Copilot Clinic - User Manual

## 1. Giới Thiệu

AI Copilot là trợ lý AI thông minh dành cho phòng khám trên Petties Web Dashboard, giúp quản lý và vận hành phòng khám bằng ngôn ngữ tự nhiên.

### 1.1 Ai Có Thể Sử Dụng

| Vai Tro` | Nền Tảng | Mức Truy Cập |
|----------|----------|--------------|
| **CLINIC_OWNER** | Web Dashboard | Đầy đủ (18 tools) |
| **CLINIC_MANAGER** | Web Dashboard | Quản lý vận hành (15 tools) |
| **STAFF** | Web Dashboard | Hỗ trợ chẩn đoán (6 tools) |

### 1.2 Nguyên Tắc An Toàn

- **HITL (Human In The Loop)**: AI KHÔNG bao giờ tự động thực hiện hành động ghi (tạo, sửa, xóa). Luôn yêu cầu xác nhận.
- **Role-Based Access**: Mỗi vai trò chỉ thấy và dùng được tools phù hợp với quyền hạn.
- **Preview Trước Khi Thực Thi**: Mọi thay đổi đều hiển thị preview để review trước khi confirm.

---

## 2. CLINIC_OWNER - Hướng Dẫn Sử Dụng

Chủ phòng khám có quyền cao nhất, bao gồm: setup phòng khám, quản lý dịch vụ, quản lý booking, quản lý nhân viên và xem báo cáo.

### 2.1 Setup Phòng Khám

#### 2.1.1 Gợi Ý Dịch Vụ Từ Hệ Thống

**Khi nào dùng**: Khi mới mở phòng khám, cần tạo danh mục dịch vụ nhanh.

**Bước thực hiện**:

1. Mở AI Copilot từ thanh điều hướng
2. Nhập một trong các prompt:
   - `"Gợi ý dịch vụ cho phòng khám của tôi"`
   - `"Tôi muốn setup danh mục dịch vụ cho phòng khám chó mèo"`
   - `"Gợi ý dịch vụ spa và tắm rửa cho thú cưng"`
3. AI trả về danh sách dịch vụ gợi ý từ hệ thống, bao gồm:
   - Tên dịch vụ
   - Mô tả
   - Giá tham khảo
   - Thời lượng dự kiến
4. Review danh sách, chọn các dịch vụ phù hợp
5. Với mỗi dịch vụ đã chọn, AI sẽ tạo mới sau khi bạn xác nhận

**Ví dụ prompt**:
```
"Tôi mới mở phòng khám đa khoa cho chó và mèo ở quận 1. Gợi ý cho tôi danh mục dịch vụ phù hợp."
```

#### 2.1.2 Tạo Dịch Vụ Mới

**Khi nào dùng**: Khi cần thêm dịch vụ mới không có trong gợi ý.

**Bước thực hiện**:

1. Nhập prompt mô tả dịch vụ muốn tạo:
   - `"Tạo dịch vụ mới: Tắm spa cao cấp cho chó lớn, giá 350.000đ, thời lượng 60 phút"`
   - `"Thêm dịch vụ triệt sản cho mèo, giá 500.000đ"`
2. AI hiển thị preview thông tin dịch vụ sẽ tạo:
   ```
   ┌─────────────────────────────────────┐
   │ XÁC NHẬN TẠO DỊCH VỤ MỚI            │
   ├─────────────────────────────────────┤
   │ Tên: Tắm spa cao cấp cho chó lớn    │
   │ Giá: 350.000 đ                      │
   │ Thời lượng: 60 phút                 │
   │ Loại: Home Visit: Không             │
   │ Danh mục: Spa                       │
   ├─────────────────────────────────────┤
   │ [✅ Xác nhận]  [❌ Hủy]             │
   └─────────────────────────────────────┘
   ```
3. Click **Xác nhận** để tạo, hoặc **Hủy** để chỉnh sửa

### 2.2 Quản Lý Dịch Vụ

#### 2.2.1 Xem Danh Sách Dịch Vụ

**Khi nào dùng**: Kiểm tra danh sách dịch vụ hiện có, giá cả, trạng thái.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Liệt kê tất cả dịch vụ của phòng khám"`
   - `"Cho tôi xem dịch vụ tiêm phòng"`
   - `"Dịch vụ nào đang không hoạt động?"`
   - `"Giá các dịch vụ khám bệnh là bao nhiêu?"`
2. AI trả về danh sách dịch vụ với thông tin:
   - Tên dịch vụ
   - Giá hiện tại
   - Trạng thái (Hoạt động / Ngưng hoạt động)
   - Danh mục
   - Thời lượng

#### 2.2.2 Cập Nhật Thông Tin Dịch Vụ

**Khi nào dùng**: Thay đổi giá, mô tả, thời lượng hoặc trạng thái dịch vụ.

**Bước thực hiện**:

1. Nhập prompt mô tả thay đổi:
   - `"Đổi giá tiêm phòng 5 bệnh thành 220.000đ"`
   - `"Bật lại dịch vụ tắm rửa"`
   - `"Sửa mô tả dịch vụ khám tổng quát thành: Khám sức khỏe toàn diện cho thú cưng"`
   - `"Đổi thời lượng dịch vụ triệt sản thành 90 phút"`
2. AI hiển thị preview thay đổi:
   ```
   ┌─────────────────────────────────────┐
   │ XÁC NHẬN CẬP NHẬT DỊCH VỤ           │
   ├─────────────────────────────────────┤
   │ Dịch vụ: Tiêm phòng 5 bệnh          │
   │                                     │
   │ Giá cũ: 200.000 đ                   │
   │ Giá mới: 220.000 đ                  │
   │                                     │
   │ Các trường khác: Không thay đổi     │
   ├─────────────────────────────────────┤
   │ [✅ Xác nhận]  [❌ Hủy]             │
   └─────────────────────────────────────┘
   ```
3. Click **Xác nhận** để lưu thay đổi

### 2.3 Quản Lý Booking

#### 2.3.1 Xem Danh Sách Lịch Hẹn

**Khi nào dùng**: Kiểm tra lịch hẹn theo trạng thái, ngày, hoặc tìm kiếm cụ thể.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Cho tôi xem tất cả lịch hẹn đang chờ xác nhận"`
   - `"Lịch hẹn ngày mai của phòng khám"`
   - `"Tìm lịch hẹn của bé Mimi"`
   - `"Có bao nhiêu lịch hẹn CONFIRMED tuần này?"`
2. AI trả về danh sách lịch hẹn với:
   - Mã booking
   - Tên thú cưng
   - Tên chủ nuôi
   - Ngày giờ
   - Dịch vụ
   - Trạng thái

#### 2.3.2 Xác Nhận Lịch Hẹn

**Khi nào dùng**: Xác nhận lịch hẹn từ PENDING → CONFIRMED.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Xác nhận lịch hẹn BK-20260403-001"`
   - `"Duyệt lịch hẹn của bé Mimi ngày mai"`
2. AI hiển thị thông tin lịch hẹn và yêu cầu xác nhận:
   ```
   ┌─────────────────────────────────────┐
   │ XÁC NHẬN LỊCH HẸN                   │
   ├─────────────────────────────────────┤
   │ Mã: BK-20260403-001                 │
   │ Thú cưng: Mimi (Chó Corgi)          │
   │ Ngày: 04/04/2026 - 09:00            │
   │ Dịch vụ: Khám tổng quát             │
   │ Trạng thái hiện tại: PENDING        │
   ├─────────────────────────────────────┤
   │ [✅ Xác nhận]  [❌ Hủy]             │
   └─────────────────────────────────────┘
   ```
3. Click **Xác nhận** → Trạng thái chuyển sang CONFIRMED

#### 2.3.3 Hủy Lịch Hẹn

**Khi nào dùng**: Hủy lịch hẹn không thể thực hiện.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Hủy lịch hẹn BK-20260403-001"`
   - `"Hủy lịch của bé Mimi vì bác sĩ nghỉ ốm"`
2. AI yêu cầu nhập lý do hủy
3. Hiển thị preview và yêu cầu xác nhận
4. Click **Xác nhận** → Lịch hẹn bị hủy

#### 2.3.4 Phân Công Lại Nhân Viên

**Khi nào dùng**: Khi nhân viên được phân công không thể làm việc, cần đổi người.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Phân công lại nhân viên cho lịch hẹn BK-20260403-001"`
   - `"Đổi bác sĩ cho dịch vụ khám tổng quát của bé Mimi"`
2. AI hiển thị:
   - Thông tin lịch hẹn hiện tại
   - Nhân viên đang được phân công
   - Danh sách nhân viên khả dụng thay thế
3. Chọn nhân viên mới từ danh sách
4. Xác nhận phân công lại

#### 2.3.5 Kiểm Tra Tình Trạng Nhân Viên Cho Booking

**Khi nào dùng**: Kiểm tra xem booking có đủ nhân viên cho tất cả dịch vụ chưa.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Kiểm tra tình trạng nhân viên cho booking BK-20260403-001"`
   - `"Booking này có đủ bác sĩ chưa?"`
2. AI trả về:
   - Trạng thái từng dịch vụ (đã có nhân viên / thiếu)
   - Gợi ý nhân viên thay thế nếu thiếu
   - Các khung giờ thay thế nếu cần

### 2.4 Quản Lý Nhân Viên & Lịch Làm Việc

#### 2.4.1 Xem Danh Sách Nhân Viên

**Khi nào dùng**: Kiểm tra danh sách nhân viên hiện tại của phòng khám.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Cho tôi xem danh sách nhân viên"`
   - `"Phòng khám có bao nhiêu bác sĩ?"`
   - `"Ai là nhân viên chuyên khoa da liễu?"`
2. AI trả về danh sách nhân viên với:
   - Họ tên
   - Vai trò (Bác sĩ, Trợ lý, Lễ tân)
   - Chuyên khoa
   - Trạng thái làm việc

#### 2.4.2 Xem Lịch Làm Việc

**Khi nào dùng**: Kiểm tra lịch trực của nhân viên trong tuần/tháng.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Lịch làm việc của tuần này"`
   - `"Ai trực ngày mai?"`
   - `"Lịch trực của bác sĩ Nam trong tháng 4"`
2. AI trả về:
   - Danh sách shifts theo ngày
   - Nhân viên trực từng ca
   - Số slot trống/đã đặt

#### 2.4.3 Xem Slot Trống/Đã Đặt

**Khi nào dùng**: Kiểm tra tình trạng slot trong ngày/tuần.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Hôm nay còn slot trống nào?"`
   - `"Slot trống tuần này"`
   - `"Ca sáng ngày mai đã đầy chưa?"`
2. AI trả về bảng slot với trạng thái:
   - 🟢 Trống
   - 🔴 Đã đặt
   - 🟡 Đã chặn

### 2.5 Báo Cáo & Analytics

#### 2.5.1 Tổng Quan Hôm Nay

**Khi nào dùng**: Xem nhanh tình hình phòng khám trong ngày.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Hôm nay phòng khám thế nào?"`
   - `"Tổng quan ngày hôm nay"`
   - `"Có bao nhiêu lịch hẹn hôm nay?"`
2. AI trả về dashboard:
   - Tổng số lịch hẹn
   - Phân loại theo trạng thái (Pending, Confirmed, In Progress, Completed, Cancelled)
   - Danh sách chi tiết từng booking

#### 2.5.2 Phân Tích Doanh Thu

**Khi nào dùng**: Xem báo cáo doanh thu theo kỳ.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Doanh thu tháng này"`
   - `"So sánh doanh thu tuần này với tuần trước"`
   - `"Doanh thu theo quý"`
   - `"Tổng doanh thu năm nay"`
2. AI trả về:
   - Tổng doanh thu
   - Phân loại theo phương thức thanh toán (QR, Cash)
   - Biểu đồ xu hướng theo kỳ
   - Top dịch vụ mang lại doanh thu

#### 2.5.3 Chỉ Số Hiệu Suất Phòng Khám

**Khi nào dùng**: Xem KPIs tổng quan của phòng khám.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Cho tôi xem chỉ số hiệu suất phòng khám"`
   - `"Metrics tháng này"`
   - `"Tỷ lệ hoàn thành booking là bao nhiêu?"`
2. AI trả về:
   - Tổng số booking
   - Số booking hoàn thành
   - Số booking hủy
   - Tổng doanh thu
   - Top dịch vụ phổ biến

### 2.6 Thông Tin Phòng Khám

**Khi nào dùng**: Xem thông tin chi tiết về phòng khám hiện tại.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Thông tin phòng khám của tôi"`
   - `"Địa chỉ phòng khám là gì?"`
   - `"Giờ hoạt động của phòng khám"`
2. AI trả về:
   - Tên phòng khám
   - Địa chỉ đầy đủ
   - Số điện thoại, email
   - Giờ hoạt động
   - Thông tin ngân hàng

---

## 3. CLINIC_MANAGER - Hướng Dẫn Sử Dụng

Quản lý phòng khám có quyền vận hành hàng ngày nhưng KHÔNG thể tạo/sửa dịch vụ.

### 3.1 Quản Lý Booking

#### 3.1.1 Xem Danh Sách Lịch Hẹn

**Tương tự CLINIC_OWNER** (xem mục 2.3.1)

#### 3.1.2 Xác Nhận Lịch Hẹn

**Tương tự CLINIC_OWNER** (xem mục 2.3.2)

#### 3.1.3 Hủy Lịch Hẹn

**Tương tự CLINIC_OWNER** (xem mục 2.3.3)

#### 3.1.4 Phân Công Lại Nhân Viên

**Tương tự CLINIC_OWNER** (xem mục 2.3.4)

#### 3.1.5 Kiểm Tra Tình Trạng Nhân Viên

**Tương tự CLINIC_OWNER** (xem mục 2.3.5)

### 3.2 Quản Lý Nhân Viên & Lịch

#### 3.2.1 Xem Danh Sách Nhân Viên

**Tương tự CLINIC_OWNER** (xem mục 2.4.1)

#### 3.2.2 Xem Lịch Làm Việc

**Tương tự CLINIC_OWNER** (xem mục 2.4.2)

#### 3.2.3 Xem Slot Trống/Đã Đặt

**Tương tự CLINIC_OWNER** (xem mục 2.4.3)

### 3.3 Báo Cáo & Analytics

#### 3.3.1 Tổng Quan Hôm Nay

**Tương tự CLINIC_OWNER** (xem mục 2.5.1)

#### 3.3.2 Phân Tích Doanh Thu

**Tương tự CLINIC_OWNER** (xem mục 2.5.2)

#### 3.3.3 Chỉ Số Hiệu Suất

**Tương tự CLINIC_OWNER** (xem mục 2.5.3)

### 3.4 Xem Thông Tin Phòng Khám

**Tương tự CLINIC_OWNER** (xem mục 2.6)

### 3.5 Xem Danh Sách Dịch Vụ

**Tương tự CLINIC_OWNER** (xem mục 2.2.1)

⚠️ **Lưu ý**: CLINIC_MANAGER chỉ có thể XEM dịch vụ, KHÔNG thể tạo hoặc sửa.

---

## 4. STAFF - Hướng Dẫn Sử Dụng

Nhân viên sử dụng AI Copilot để hỗ trợ chẩn đoán và tra cứu thông tin bệnh án.

### 4.1 Tìm Kiếm Thú Cưng

**Khi nào dùng**: Cần tìm nhanh thông tin thú cưng theo tên.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Tìm thú cưng tên Mimi"`
   - `"Cho tôi xem danh sách bệnh nhân"`
   - `"Tìm chó Corgi tên Mimi"`
2. AI trả về danh sách thú cưng khớp với tìm kiếm:
   - Tên thú cưng
   - Loài, giống
   - Tên chủ nuôi
   - Lần khám gần nhất

### 4.2 Xem Tóm Tắt Hồ Sơ Bệnh Án

**Khi nào dùng**: Cần xem nhanh thông tin y tế của thú cưng trước khi khám.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Tóm tắt hồ sơ của bé Mimi"`
   - `"Cho tôi xem thông tin y tế của thú cưng PET-001"`
2. AI trả về:
   - Thông tin cơ bản (tên, loài, giống, cân nặng, tuổi)
   - 2 lần khám gần nhất
   - Cảnh báo sức khỏe (nếu có)
   - Đơn thuốc đang dùng
   - Lịch tiêm chủng

### 4.3 Xem Lịch Sử Bệnh Án

**Khi nào dùng**: Cần xem toàn bộ lịch sử khám chữa bệnh.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Lịch sử bệnh án của bé Mimi"`
   - `"Bé Mimi đã khám những gì trong 6 tháng qua?"`
   - `"Hiển thị 5 lần khám gần nhất của PET-001"`
2. AI trả về:
   - Danh sách các lần khám theo thời gian
   - Chẩn đoán mỗi lần
   - Đơn thuốc đã kê
   - Ghi chú của bác sĩ

### 4.4 Tổng Quan Lịch Khám Hôm Nay

**Tương tự CLINIC_OWNER** (xem mục 2.5.1)

### 4.5 Tra Cứu Kiến Thức Thú Y

**Khi nào dùng**: Cần tra cứu thông tin về bệnh lý, phác đồ điều trị.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Triệu chứng và cách điều trị bệnh Care ở chó"`
   - `"Phác đồ tiêm phòng cho mèo con"`
   - `"Cách xử lý khi chó bị sốc nhiệt"`
2. AI trả về thông tin từ cẩm nang thú y và kiến thức chuyên môn

### 4.6 Tìm Phòng Khám Gần Đó

**Khi nào dùng**: Cần giới thiệu phòng khám khác cho khách hàng.

**Bước thực hiện**:

1. Nhập prompt:
   - `"Phòng khám thú y gần đây"`
   - `"Tìm phòng khám ở quận 3"`
2. AI trả về danh sách phòng khám gần vị trí hiện tại

---

## 5. Giao Diện AI Copilot

### 5.1 Bố Cục Chính

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 AI Copilot - [Tên Phòng Khám]                [👤 Vai Trò] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 💬 Lịch sử hội thoại                                      │ │
│  │                                                           │ │
│  │  Bạn: "Hôm nay phòng khám thế nào?"                       │ │
│  │                                                           │ │
│  │  AI: 📊 Tổng quan hôm nay                                 │ │
│  │  ┌─────────────────────────────────────────────────┐     │ │
│  │  │ Tổng: 12 lịch hẹn                               │     │ │
│  │  │ ✅ Completed: 5  ⏳ In Progress: 2              │     │ │
│  │  │ 📋 Confirmed: 3  ⏸ Pending: 2                  │     │ │
│  │  │ ❌ Cancelled: 0                                 │     │ │
│  │  └─────────────────────────────────────────────────┘     │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 💡 Gợi ý: [Tổng quan hôm nay] [Doanh thu tháng] [...]    │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ Nhập câu hỏi của bạn...                   [📤 Gửi]        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📍 Context: [🏥 Tên Clinic] [📅 Hôm nay]                      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Gợi Ý Prompt Nhanh

Tùy theo vai trò, AI sẽ hiển thị các gợi ý phù hợp:

**CLINIC_OWNER**:
- "Gợi ý dịch vụ cho phòng khám"
- "Tổng quan hôm nay"
- "Doanh thu tháng này"
- "Lịch hẹn chờ xác nhận"
- "Danh sách nhân viên"

**CLINIC_MANAGER**:
- "Tổng quan hôm nay"
- "Lịch hẹn ngày mai"
- "Doanh thu tuần này"
- "Lịch trực tuần này"
- "Slot trống hôm nay"

**STAFF**:
- "Tìm thú cưng tên..."
- "Tóm tắt hồ sơ bé..."
- "Lịch sử bệnh án của..."
- "Tổng quan hôm nay"
- "Tra cứu bệnh lý..."

### 5.3 Context Chips

Hiển thị ngữ cảnh hiện tại (auto-populated):
- **Phòng khám**: Tên clinic đang làm việc
- **Thời gian**: Hôm nay / Tuần này / Tháng này
- Click vào context chip để thay đổi bộ lọc

---

## 6. Cơ Chế Xác Nhận An Toàn (HITL)

### 6.1 Hành Động Cần Xác Nhận

| Hành Động | Vai Trò | Cơ Chế |
|-----------|---------|--------|
| Tạo dịch vụ mới | CLINIC_OWNER | Preview → Confirm |
| Cập nhật dịch vụ | CLINIC_OWNER | Preview → Confirm |
| Xác nhận booking | CLINIC_OWNER, CLINIC_MANAGER | Preview → Confirm |
| Hủy booking | CLINIC_OWNER, CLINIC_MANAGER | Nhập lý do → Confirm |
| Phân công lại nhân viên | CLINIC_OWNER, CLINIC_MANAGER | Chọn staff → Confirm |

### 6.2 Hành Động KHÔNG Cần Xác Nhận

| Hành Động | Vai Trò | Lý Do |
|-----------|---------|-------|
| Xem danh sách | Tất cả | Chỉ đọc |
| Tìm kiếm | Tất cả | Chỉ đọc |
| Tra cứu kiến thức | STAFF | Chỉ đọc |
| Xem báo cáo | CLINIC_OWNER, CLINIC_MANAGER | Chỉ đọc |

---

## 7. Xử Lý Lỗi

### 7.1 Lỗi Thường Gặp

| Vấn Đề | Nguyên Nhân | Giải Pháp |
|--------|-------------|-----------|
| Không thấy AI Copilot | Chưa đăng nhập | Đăng nhập bằng tài khoản Owner/Manager/Staff |
| "Công cụ chưa được kích hoạt" | Admin chưa bật tool | Liên hệ quản trị viên hệ thống |
| AI không phản hồi | Mất kết nối mạng | Kiểm tra internet, thử lại |
| Không tìm thấy dịch vụ/thú cưng | Tên không chính xác | Kiểm tra lại tên, dùng từ khóa ngắn hơn |
| Preview không hiện | Lỗi hệ thống | Refresh trang, thử lại |
| "Không có quyền thực hiện" | Sai vai trò | Kiểm tra tài khoản có đúng role không |

### 7.2 Thông Báo Lỗi Mẫu

**Chưa đăng nhập**:
```
❌ Vui lòng đăng nhập để sử dụng tính năng này.
```

**Tool chưa kích hoạt**:
```
❌ Công cụ [tên tool] chưa được kích hoạt. Liên hệ quản trị viên.
```

**Không có quyền**:
```
❌ Bạn không có quyền thực hiện hành động này. Vui lòng liên hệ chủ phòng khám.
```

**Lỗi API**:
```
❌ Không thể kết nối đến máy chủ. Vui lòng thử lại sau.
```

---

## 8. Câu Hỏi Thường Gặp (FAQ)

### Chung

**Q: AI có tự động lưu/thay đổi dữ liệu không?**
**A**: KHÔNG. AI luôn hiển thị preview và chờ xác nhận trước khi thực hiện bất kỳ thay đổi nào.

**Q: Tôi có thể dùng AI Copilot trên mobile không?**
**A**: Hiện tại chỉ hỗ trợ trên Web Dashboard.

**Q: AI có hiểu tiếng Việt không?**
**A**: Có. AI Copilot hỗ trợ tiếng Việt 100%. Bạn có thể hỏi bằng ngôn ngữ tự nhiên.

### CLINIC_OWNER

**Q: Tôi có thể tạo nhiều dịch vụ cùng lúc không?**
**A**: Có. Bạn có thể yêu cầu AI gợi ý nhiều dịch vụ và chọn từng cái một.

**Q: AI có thể tự động định giá dịch vụ không?**
**A**: AI gợi ý giá dựa trên master services của hệ thống. Bạn nên review và điều chỉnh theo thị trường thực tế.

**Q: Tôi có thể xem doanh thu theo ngày không?**
**A**: Có. Yêu cầu "Doanh thu hôm nay" hoặc "Doanh thu theo ngày trong tuần này".

### CLINIC_MANAGER

**Q: Tôi có thể tạo/sửa dịch vụ không?**
**A**: KHÔNG. Chỉ CLINIC_OWNER mới có quyền tạo và sửa dịch vụ.

**Q: Tôi có thể xem báo cáo doanh thu không?**
**A**: CÓ. CLINIC_MANAGER có quyền xem tất cả báo cáo và analytics.

### STAFF

**Q: Tôi có thể xác nhận booking không?**
**A**: KHÔNG qua AI Copilot. Chức năng xác nhận booking chỉ dành cho CLINIC_OWNER và CLINIC_MANAGER.

**Q: Tôi có thể xem hồ sơ bệnh án của thú cưng bất kỳ không?**
**A**: Bạn chỉ có thể xem hồ sơ của thú cưng thuộc phòng khám nơi bạn làm việc.

---

## 9. Best Practices

### ✅ Nên Làm

- Dùng prompt suggestions để tiết kiệm thời gian
- Kiểm tra kỹ preview trước khi xác nhận
- Dùng ngôn ngữ tự nhiên, không cần cú pháp đặc biệt
- Sử dụng context chips để lọc dữ liệu chính xác hơn
- Đặt câu hỏi cụ thể để AI trả lời chính xác hơn

### ❌ Không Nên

- Không tin tưởng 100% vào AI - luôn review trước khi xác nhận
- Không nhập thông tin nhạy cảm (mật khẩu, thông tin thanh toán) vào prompt
- Không yêu cầu AI thực hiện hành động ngoài phạm vi quyền hạn
- Không bỏ qua bước preview xác nhận

---

## 10. Bảng Tổng Hợp Tools Theo Vai Trò

### CLINIC_OWNER (18 tools)

| # | Tool | Nhóm | Mô Tả Ngắn |
|---|------|------|------------|
| 1 | `generate_clinic_services` | Setup | Gợi ý dịch vụ từ hệ thống |
| 2 | `create_clinic_service` | Setup | Tạo dịch vụ mới |
| 3 | `update_service_info` | Dịch vụ | Sửa thông tin dịch vụ |
| 4 | `execute_update_service_confirmed` | Dịch vụ | Áp dụng cập nhật sau confirm |
| 5 | `list_clinic_services` | Dịch vụ | Xem danh sách dịch vụ |
| 6 | `get_my_clinic_info` | Thông tin | Thông tin phòng khám |
| 7 | `view_clinic_bookings` | Booking | Xem danh sách lịch hẹn |
| 8 | `confirm_booking_manager` | Booking | Xác nhận lịch hẹn |
| 9 | `cancel_booking_manager` | Booking | Hủy lịch hẹn |
| 10 | `get_available_staff_for_reassign` | Booking | Xem staff khả dụng |
| 11 | `reassign_staff_for_service` | Booking | Phân công lại nhân viên |
| 12 | `check_booking_availability` | Booking | Kiểm tra staff availability |
| 13 | `get_clinic_staff` | Nhân viên | Danh sách nhân viên |
| 14 | `get_staff_schedule` | Nhân viên | Lịch làm việc staff |
| 15 | `get_slot_availability` | Nhân viên | Slot trống/đã đặt |
| 16 | `get_clinic_shifts` | Nhân viên | Lịch shifts |
| 17 | `get_clinic_today_summary` | Analytics | Tổng quan hôm nay |
| 18 | `analyze_revenue_trends` | Analytics | Phân tích doanh thu |
| 19 | `get_clinic_metrics` | Analytics | Chỉ số hiệu suất |

### CLINIC_MANAGER (15 tools)

| # | Tool | Nhóm | Mô Tả Ngắn |
|---|------|------|------------|
| 1 | `list_clinic_services` | Dịch vụ | Xem danh sách dịch vụ |
| 2 | `get_my_clinic_info` | Thông tin | Thông tin phòng khám |
| 3 | `view_clinic_bookings` | Booking | Xem danh sách lịch hẹn |
| 4 | `confirm_booking_manager` | Booking | Xác nhận lịch hẹn |
| 5 | `cancel_booking_manager` | Booking | Hủy lịch hẹn |
| 6 | `get_available_staff_for_reassign` | Booking | Xem staff khả dụng |
| 7 | `reassign_staff_for_service` | Booking | Phân công lại nhân viên |
| 8 | `check_booking_availability` | Booking | Kiểm tra staff availability |
| 9 | `get_clinic_staff` | Nhân viên | Danh sách nhân viên |
| 10 | `get_staff_schedule` | Nhân viên | Lịch làm việc staff |
| 11 | `get_slot_availability` | Nhân viên | Slot trống/đã đặt |
| 12 | `get_clinic_shifts` | Nhân viên | Lịch shifts |
| 13 | `get_clinic_today_summary` | Analytics | Tổng quan hôm nay |
| 14 | `analyze_revenue_trends` | Analytics | Phân tích doanh thu |
| 15 | `get_clinic_metrics` | Analytics | Chỉ số hiệu suất |

### STAFF (6 tools)

| # | Tool | Nhóm | Mô Tả Ngắn |
|---|------|------|------------|
| 1 | `get_staff_patients` | Chẩn đoán | Tìm thú cưng theo tên |
| 2 | `get_patient_summary` | Chẩn đoán | Tóm tắt hồ sơ bệnh án |
| 3 | `get_emr_history` | Chẩn đoán | Lịch sử bệnh án |
| 4 | `get_clinic_today_summary` | Thông tin | Tổng quan hôm nay |
| 5 | `get_user_pets` | Booking | Xem thú cưng của user |
| 6 | `search_clinics_nearby` | Thông tin | Tìm phòng khám gần đó |

---

## 11. Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề khi sử dụng AI Copilot:

1. **Tự khắc phục**: Refresh trang, thử lại
2. **Kiểm tra logs**: Mở Developer Tools (F12) → Console
3. **Liên hệ support**: support@petties.world

---

**Version**: 2.0.0  
**Last Updated**: 2026-04-03  
**Document Status**: Active  
**Scope**: AI Copilot Clinic - Phase 0 + Phase 1
