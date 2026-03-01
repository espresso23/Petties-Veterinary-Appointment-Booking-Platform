# API Thanh toán QR qua SePay

**Cập nhật:** 2026-01-15

## 1. Mục tiêu

Tài liệu mô tả luồng thanh toán QR (chuyển khoản ngân hàng) tích hợp SePay cho ứng dụng mobile (PET_OWNER). Luồng hiện tại phục vụ mục đích kiểm thử nhanh, có endpoint tạo booking thử nghiệm để hiển thị QR và polling trạng thái thanh toán.

## 2. Nguyên tắc thiết kế

- Backend giữ `SEPAY_API_TOKEN`, mobile không gọi thẳng SePay.
- Mobile chỉ hiển thị QR bằng ảnh từ `https://qr.sepay.vn/img`.
- Xác nhận thanh toán dựa trên:
  - `transaction_content` chứa `paymentDescription`
  - `amount_in` khớp `payment.amount`
  - `transaction_date` không trước thời điểm tạo payment
- Cập nhật DB theo **Migration-First** (Flyway), không dùng `ddl-auto=update`.

## 3. Cấu hình môi trường

### 3.1 Backend (Spring Boot)

Các biến môi trường / cấu hình:

- `SEPAY_BASE_URL` (mặc định: `https://my.sepay.vn/userapi`)
- `SEPAY_API_TOKEN` (bắt buộc)
- `SEPAY_ACCOUNT_NUMBER` (khuyến nghị cấu hình để lọc giao dịch theo tài khoản)
- `SEPAY_QR_ACC` (mặc định: `9624720102004`)
- `SEPAY_QR_BANK` (mặc định: `BIDV`)

SePay API sử dụng header:

- `Content-Type: application/json`
- `Authorization: Bearer <SEPAY_API_TOKEN>`

### 3.2 Mobile (Flutter)

Mobile gọi API backend theo `Environment.baseUrl` (ví dụ dev: `http://<LAN_IP>:8080/api`).

## 4. Migration

Đã thêm migration:

- `backend-spring/petties/src/main/resources/db/migration/V202601141512__add_payment_description_to_payments.sql`

Mục đích:

- Thêm cột `payment_description` để lưu nội dung chuyển khoản ổn định (không tạo random lại mỗi lần).

## 5. API Backend

### 5.1 Lấy danh sách giao dịch từ SePay (phục vụ debug)

**GET** `/api/sepay/transactions`

Query params:
- `limit` (mặc định `200`)
- `account_number` (tuỳ chọn)
- `transaction_date_min` (tuỳ chọn)
- `transaction_date_max` (tuỳ chọn)
- `since_id` (tuỳ chọn)

Response (rút gọn):
```json
{
  "success": true,
  "count": 200,
  "transactions": [
    {
      "id": "49682",
      "transactionDate": "2023-05-05 19:59:48",
      "amountIn": "18067000.00",
      "transactionContent": "..."
    }
  ],
  "message": "Lấy danh sách giao dịch thành công"
}
```

Ví dụ lọc theo trạng thái:
- `GET /api/payments/petowner/{petOwnerId}/history?limit=50&status=PAID`

### 5.2 Tạo booking thử nghiệm để hiển thị QR (PET_OWNER)

**POST** `/api/dev/qr-bookings`

Yêu cầu:
- Role: `PET_OWNER`

Response (rút gọn):
```json
{
  "success": true,
  "bookingId": "...",
  "bookingCode": "...",
  "totalPrice": 2000,
  "paymentDescription": "A1B2C3D4E5",
  "qrImageUrl": "https://qr.sepay.vn/img?acc=9624720102004&bank=BIDV&amount=2000&des=...",
  "message": "Tạo booking test thành công"
}
```

### 5.3 Kiểm tra trạng thái thanh toán QR (PET_OWNER)

**GET** `/api/payments/{bookingId}/qr-status`

Yêu cầu:
- Role: `PET_OWNER`
- Booking phải thuộc về user đang đăng nhập.

Response (rút gọn):
```json
{
  "success": true,
  "bookingId": "...",
  "status": "PENDING",
  "message": "Chưa tìm thấy giao dịch phù hợp",
  "matchedTransactionId": null
}
```

Khi match thành công:
- `status = "PAID"`
- Backend cập nhật `Payment.status = PAID` và `paidAt = now`.

### 5.4 Lấy lịch sử thanh toán theo PetOwnerId (ADMIN)

**GET** `/api/payments/petowner/{petOwnerId}/history`

Query params:
- `limit` (mặc định `50`, tối đa `200`)
- `status` (tuỳ chọn: `PENDING`, `PAID`, `REFUNDED`)

Yêu cầu:
- Role: `ADMIN`

Response (rút gọn):
```json
{
  "success": true,
  "petOwnerId": "...",
  "count": 2,
  "payments": [
    {
      "paymentId": "...",
      "bookingId": "...",
      "bookingCode": "BK-TEST-123",
      "petOwnerId": "...",
      "amount": 2000,
      "method": "QR",
      "status": "PAID",
      "paymentDescription": "A1B2C3D4E5",
      "createdAt": "2026-01-15T08:00:00",
      "paidAt": "2026-01-15T08:01:00"
    }
  ],
  "message": "Lấy lịch sử thanh toán thành công"
}
```

## 6. Luồng Mobile (polling)

- Người dùng nhấn nút tạo booking thử nghiệm.
- App hiển thị ảnh QR (`qrImageUrl`) và hướng dẫn chuyển khoản.
- App polling mỗi 10 giây:
  - gọi `GET /api/payments/{bookingId}/qr-status`
  - nếu `status == PAID` thì dừng polling và hiển thị “Đã xác nhận giao dịch”.

## 7. Lưu ý triển khai

- Endpoint `/api/dev/qr-bookings` chỉ dùng trong giai đoạn test. Khi lên production cần loại bỏ hoặc khoá bằng cấu hình môi trường.
- Nếu lượng giao dịch cao, cần cân nhắc dùng filter `transaction_date_min`/`account_number` để giảm sai lệch khi match.
