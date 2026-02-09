# Hướng dẫn Test SOS Booking - Full Flow End-to-End

## Môi trường chuẩn bị

### Yêu cầu hệ thống
- **Backend**: Java 17+, Redis đang chạy (`docker-compose up redis`)
- **Frontend Web**: Node.js 18+, npm install
- **Mobile**: Flutter 3.x, thiết bị thật hoặc emulator có GPS
- **Database**: PostgreSQL với dữ liệu test (clinic, services, staff)

### Tài khoản test
| Role | Username | Password |
|------|----------|----------|
| Pet Owner | owner@test.com | 123456 |
| Clinic Manager | manager@test.com | 123456 |
| Staff | staff@test.com | 123456 |

---

## Bước 1: Cấu hình Phí SOS trên Web (Manager)

### Thao tác:
1. Đăng nhập với tài khoản **Clinic Manager**
2. Vào **Quản lý Phòng khám** → Chọn phòng khám
3. Nhấn **"Chỉnh sửa"**
4. Điền **Phí Dịch Vụ SOS**: `200000` (200,000đ)
5. Nhấn **"Lưu"**

### Kết quả mong đợi:
- [ ] Toast thông báo "Cập nhật thành công"
- [ ] Quay lại trang Chi tiết → Thấy **PHÍ CẤP CỨU (SOS): 200.000₫** trong khung đỏ

---

## Bước 2: Đặt lịch SOS trên Mobile (Pet Owner)

### Thao tác:
1. Mở app Mobile, đăng nhập **Pet Owner**
2. Vào màn hình **Đặt lịch khẩn cấp (SOS)**
3. Chọn Thú cưng, nhập Mô tả vấn đề
4. Chọn Phòng khám gần nhất (đã cấu hình Phí SOS)
5. Xác nhận đặt lịch

### Kết quả mong đợi:
- [ ] Hiển thị **Phí SOS: 200.000₫** trong tổng chi phí
- [ ] Không hiển thị Phí quãng đường (distanceFee = 0)
- [ ] Trạng thái booking: `PENDING`

---

## Bước 3: Xác nhận và Gán Nhân viên (Manager)

### Thao tác:
1. Mở Web, đăng nhập **Clinic Manager**
2. Vào **Dashboard** → Thấy booking SOS mới
3. Nhấn **"Xác nhận"**
4. Chọn Nhân viên (bất kỳ, không cần đúng chuyên môn)
5. Xác nhận gán

### Kết quả mong đợi:
- [ ] Badge **SOS** màu đỏ hiển thị trên booking
- [ ] Nhân viên được gán thành công (bypass specialty check)
- [ ] Trạng thái: `CONFIRMED`

---

## Bước 4: Nhân viên Bắt đầu Di chuyển (Staff Mobile)

### Thao tác:
1. Mở app Mobile, đăng nhập **Staff**
2. Vào chi tiết booking SOS đã được gán
3. Nhấn **"Bắt đầu"** → Trạng thái: `IN_PROGRESS`
4. Nhấn nút **"BẮT ĐẦU DI CHUYỂN (SOS)"** màu xanh dương

### Kết quả mong đợi:
- [ ] App yêu cầu quyền truy cập GPS
- [ ] Cho phép → Nút đổi màu xám và hiển thị **"ĐANG GỬI VỊ TRÍ..."**
- [ ] Console log: Gửi tọa độ lên WebSocket mỗi 5 giây

---

## Bước 5: Khách hàng Theo dõi Vị trí (Pet Owner Mobile)

### Thao tác:
1. Mở app Mobile, đăng nhập **Pet Owner**
2. Vào chi tiết booking SOS
3. Nhấn nút **"THEO DÕI BÁC SĨ"**

### Kết quả mong đợi:
- [ ] Mở màn hình bản đồ Google Maps
- [ ] Hiển thị **Marker Nhân viên** (biểu tượng xe cứu thương)
- [ ] Marker di chuyển khi nhân viên di chuyển (realtime)
- [ ] Thẻ thông tin: Tên, SĐT nhân viên + nút Gọi điện

---

## Bước 6: Thêm Dịch vụ Phát sinh (Staff/Manager)

### Thao tác:
1. Trong chi tiết booking, nhấn **"Thêm dịch vụ"**
2. Chọn dịch vụ (VD: Tiêm vaccine - 150.000đ)
3. Xác nhận thêm

### Kết quả mong đợi:
- [ ] Dịch vụ được thêm thành công (bypass Specialty cho SOS)
- [ ] Tổng giá tự động tính lại: Services + SOS Fee
- [ ] Không có phí quãng đường

---

## Bước 7: Checkout và Hoàn tất (Staff)

### Thao tác:
1. Nhấn **"Hoàn tất"** hoặc **"Checkout"**
2. (Tùy chọn) Điều chỉnh Phí SOS nếu cần
3. Xác nhận thanh toán

### Kết quả mong đợi:
- [ ] Tracking GPS tự động dừng
- [ ] Hóa đơn cuối cùng hiển thị:
  - Chi phí dịch vụ: 150.000₫
  - Phí SOS: 200.000₫
  - **Tổng: 350.000₫**
- [ ] Trạng thái: `COMPLETED`

---

## Checklist Tổng kết

| # | Tính năng | Pass/Fail |
|---|-----------|-----------|
| 1 | Cấu hình Phí SOS trên Web | ☐ |
| 2 | Hiển thị Phí SOS trong Booking | ☐ |
| 3 | Bypass Specialty khi gán Staff | ☐ |
| 4 | Live Tracking GPS (Staff gửi) | ☐ |
| 5 | Live Tracking GPS (Owner nhận) | ☐ |
| 6 | Thêm dịch vụ phát sinh (Bypass) | ☐ |
| 7 | Checkout với SOS Fee | ☐ |

---

> **Lưu ý**: Nếu gặp lỗi WebSocket, kiểm tra Redis đang chạy và cấu hình ngrok/tunnel cho môi trường dev.
