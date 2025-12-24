# PETTIES MVP - Happy Flows

**Version:** 1.0 MVP  
**Last Updated:** 2025-12-17  
**Scope:** Core Features (Sprint 1-9)

---

## 1. HF-001: Đăng ký & Đăng nhập

### Pet Owner (Mobile)

```
1. Mở app → Onboarding slides (3 trang)
2. Chọn "Đăng ký" → Nhập email, mật khẩu, họ tên
3. Xác nhận email → Click link kích hoạt
4. Đăng nhập → Vào trang chủ Pet Owner
```

### Clinic Owner (Web)

```
1. Truy cập petties.world → Chọn "Đăng ký Phòng khám"
2. Nhập thông tin: Tên, địa chỉ, SĐT, email
3. Upload giấy phép kinh doanh
4. Wait Admin approve → Nhận email thông báo
5. Đăng nhập → Dashboard Clinic Owner
```

---

## 2. HF-002: Tạo hồ sơ thú cưng

**Actor:** Pet Owner (Mobile)

```
1. Trang chủ → Chọn "Thêm thú cưng"
2. Nhập thông tin: Tên, loài (Chó/Mèo/...), giống, ngày sinh
3. Upload ảnh (optional)
4. Lưu → Pet hiển thị trên trang chủ
```

---

## 3. HF-003: Đặt lịch khám (Booking)

**Actor:** Pet Owner (Mobile)

```
1. Trang chủ → Chọn "Đặt lịch"
2. Tìm phòng khám (theo vị trí/tên)
3. Chọn phòng khám → Xem danh sách dịch vụ
4. Chọn dịch vụ → Chọn ngày → Chọn slot trống
5. Chọn pet → Thêm ghi chú (optional)
6. Chọn phương thức: "Thanh toán online" / "Tiền mặt"
7. Xác nhận → Booking tạo (status: PENDING)
8. Nhận thông báo xác nhận
```

**Actor:** Clinic Manager (Web)

```
1. Dashboard → Xem booking mới (PENDING)
2. Chọn booking → Gán bác sĩ
3. Xác nhận → Status: ASSIGNED
4. Bác sĩ nhận thông báo
```

**Actor:** Vet (Mobile/Web)

```
1. Xem lịch hẹn → Booking mới (ASSIGNED)
2. Chấp nhận → Status: CONFIRMED
3. Pet Owner nhận thông báo "Đã xác nhận"
```

---

## 4. HF-004: Thực hiện khám (Medical Service)

**Actor:** Vet (Mobile/Web)

```
1. Pet Owner đến phòng khám
2. Check-in → Status: CHECK_IN
3. Bắt đầu khám → Status: IN_PROGRESS
4. Xem lịch sử bệnh (EMR cũ)
5. Khám, chẩn đoán → Nhập EMR mới:
   - Triệu chứng
   - Chẩn đoán
   - Kế hoạch điều trị
   - Đơn thuốc (optional)
   - Cập nhật tiêm chủng (optional)
6. Lưu EMR → Checkout → Status: CHECK_OUT
7. Thu tiền (nếu Cash) → Status: COMPLETED
```

**Actor:** Pet Owner (Mobile)

```
1. Nhận thông báo "Khám xong"
2. Xem EMR + đơn thuốc trong app
```

---

## 5. HF-005: Thanh toán

### Online (Stripe)

```
1. Khi đặt lịch → Chọn "Thanh toán online"
2. Nhập thẻ → Xác nhận
3. Payment status: PAID
4. Checkout → Không cần thu tiền
```

### Cash

```
1. Khi đặt lịch → Chọn "Tiền mặt"
2. Payment status: UNPAID
3. Checkout → Vet thu tiền
4. Xác nhận → Payment status: PAID
```

---

## 6. HF-006: Đánh giá sau khám

**Actor:** Pet Owner (Mobile)

```
1. Sau khi COMPLETED → Popup đánh giá bác sĩ
2. Chọn 1-5 sao → Submit (hoặc Skip)
3. Sau 24h → Nhận thông báo "Đánh giá phòng khám"
4. Chọn 1-5 sao + Viết nhận xét → Submit
```

---

## 7. HF-007: Xem hồ sơ y tế

**Actor:** Pet Owner (Mobile)

```
1. Trang chủ → Chọn pet
2. Tab "Hồ sơ bệnh án" → Danh sách EMR
3. Chọn EMR → Xem chi tiết:
   - Ngày khám
   - Bác sĩ
   - Chẩn đoán
   - Đơn thuốc
4. Tab "Tiêm chủng" → Lịch sử tiêm + nhắc nhở
```

---

## 8. HF-008: Quản lý phòng khám

**Actor:** Clinic Owner (Web)

```
1. Dashboard → "Quản lý nhân viên" (Staff Management)
2. Chọn "Thêm nhân viên" (Quick Add)
3. Nhập: Họ tên, Số điện thoại, Vai trò (Vet/Manager)
4. Lưu → Tài khoản được tạo ngay lập tức
5. Nhân viên đăng nhập bằng: SĐT / [6 số cuối SĐT]
```

---

## 9. HF-009: Quản lý lịch bác sĩ (Clinic Manager)

**Actor:** Clinic Manager (Web)

### 9.1 Tạo lịch thủ công

```
1. Dashboard → "Lịch làm việc"
2. Chọn bác sĩ → Chọn ngày/tuần/tháng
3. Click vào ô trống → Popup "Thêm ca"
4. Nhập: Giờ bắt đầu, Giờ kết thúc, Giờ nghỉ (optional)
5. Lưu → Slots tự động tạo (mỗi 30 phút)
```

### 9.2 Tạo lịch tháng (Import Excel)

```
1. Dashboard → "Lịch làm việc" → "Import Excel"
2. Tải template Excel (có sẵn mẫu)
3. Điền lịch cho từng bác sĩ, từng ngày:
   - Vet Name | Date | Start | End | Break Start | Break End
4. Upload file → Xem preview
5. Kiểm tra → Import
6. Hệ thống tạo VET_SHIFT + SLOT cho cả tháng
```

### 9.3 Clinic 24/7 - Tạo ca đêm

```
1. Thêm ca đêm: Start = 22:00, End = 06:00
   → System hiểu: Ca kết thúc sáng hôm sau
2. Ví dụ:
   - Dr. Minh: 17/12 06:00 - 14:00 (Ca sáng)
   - Dr. Lan: 17/12 14:00 - 22:00 (Ca chiều)  
   - Dr. Hùng: 17/12 22:00 - 06:00 (Ca đêm → 18/12)
```

### 9.4 Quản lý lịch đã có

```
1. Xem lịch tuần/tháng → Thấy ca của tất cả bác sĩ
2. Click ca → Xem chi tiết: slots booked/available
3. Sửa ca → Chỉ được nếu không có booking
4. Xóa ca → Chỉ được nếu không có booking
```

---

## 10. HF-010: Vet xem và quản lý lịch cá nhân

**Actor:** Vet (Mobile/Web)

### 10.1 Xem lịch làm việc

```
1. Mobile: Tab "Lịch" / Web: Menu "Lịch của tôi"
2. Xem calendar tháng → Ngày có ca = đánh dấu màu
3. Chọn ngày → Xem chi tiết ca:
   - Giờ làm: 08:00 - 18:00
   - Nghỉ trưa: 12:00 - 14:00
   - Số slots: 16 slots (8 sáng + 8 chiều)
   - Đã book: 5/16 slots
```

### 10.2 Xem booking trong ca

```
1. Trong ca → Tab "Lịch hẹn"
2. Danh sách booking theo giờ:
   - 08:00 - Mèo Mimi - Khám tổng quát (1 slot)
   - 09:00 - Chó Bobby - Tiêm vaccine (1 slot)
   - 10:00 - 10:30 TRỐNG
   - 11:00 - Mèo Tom - Grooming (2 slots)
3. Click booking → Xem chi tiết pet + owner
```

### 10.3 Xin đổi/hủy ca (nếu cho phép)

```
1. Chọn ca → "Yêu cầu thay đổi"
2. Nhập lý do
3. Gửi → Manager nhận thông báo
4. Manager approve/reject → Vet nhận kết quả
```

---

## 11. HF-011: Admin duyệt phòng khám

**Actor:** Admin (Web)

```
1. Dashboard → "Pending Clinics"
2. Xem chi tiết: Thông tin, giấy phép
3. Approve → Clinic status: APPROVED
4. Clinic Owner nhận email thông báo
   (hoặc)
   Reject + Lý do → Clinic Owner nhận email
```

---

## Status Flow Summary

```
BOOKING:
PENDING → ASSIGNED → CONFIRMED → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED

PAYMENT:
UNPAID (Cash) → PAID (after checkout)
PAID (Online) → PAID (at booking)

VET_SHIFT:
SCHEDULED → COMPLETED (sau khi hết ngày)
          → CANCELLED (nếu hủy trước)
```

---

## 12. HF-012: Đổi Email (Change Email)

**Actor:** Pet Owner, Vet, Clinic Owner, Clinic Manager

```
1. Profile Page → Click icon "Edit" cạnh Email
2. Modal hiện ra: "Đổi Email"
3. Nhập email mới
4. Click "Gửi mã OTP"
5. Hệ thống gửi Email chứa OTP (6 số) đến email MỚI
6. User check mail → Lấy OTP (hiệu lực 5 phút)
7. Nhập OTP vào form confirm
8. Click "Xác nhận"
9. Nếu OTP đúng → Email user được cập nhật
10. Hệ thống hiển thị Toast "Cập nhật email thành công"
```

---

**Document Status:** MVP Ready  
**Last Updated:** 2025-12-20

