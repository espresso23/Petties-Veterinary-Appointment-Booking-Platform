# Staff Management API Documentation

Tài liệu này mô tả các API dùng để quản lý nhân sự (Managers và Staff) cho các phòng khám trong hệ thống Petties.

## 📌 Tổng quan thiết kế
- **Định danh chính**: Sử dụng **Số điện thoại** làm `username`.
- **Mật khẩu mặc định**: 6 số cuối của số điện thoại.
- **Email**: Không bắt buộc (Nullable).
- **Phân quyền**:
    - `CLINIC_OWNER`: Quản lý toàn bộ nhân sự của phòng khám mình sở hữu.
    - `CLINIC_MANAGER`: Quản lý danh sách Nhân viên (Staff) thuộc chi nhánh đang làm việc.

---

## 🚀 Danh sách API

### 1. Tạo nhanh tài khoản nhân viên (Quick Add)
Tạo mới một tài khoản User và gán trực tiếp vào phòng khám.

- **URL**: `/clinics/{clinicId}/staff/quick-add`
- **Method**: `POST`
- **Auth**: `Bearer Token` (Role: `CLINIC_OWNER`, `CLINIC_MANAGER`)
- **Request Body**:
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "role": "STAFF" // Hoặc "CLINIC_MANAGER"
}
```
- **Xử lý đặc biệt**: 
    - Nếu `phone` là `0912345678`, mật khẩu mặc định sẽ là `345678`.
    - `CLINIC_MANAGER` chỉ có thể tạo `STAFF` cho chi nhánh của mình.

### 2. Gán Quản lý (Assign Manager)
Gán một người dùng đã có tài khoản trên hệ thống làm Quản lý cho phòng khám.

- **URL**: `/clinics/{clinicId}/staff/manager/{usernameOrEmail}`
- **Method**: `POST`
- **Auth**: `Bearer Token` (Role: `CLINIC_OWNER`)

### 3. Gán Nhân viên (Assign Staff)
Gán một người dùng đã có tài khoản trên hệ thống làm Nhân viên cho phòng khám.

- **URL**: `/clinics/{clinicId}/staff/vet/{usernameOrEmail}`
- **Method**: `POST`
- **Auth**: `Bearer Token` (Role: `CLINIC_OWNER`, `CLINIC_MANAGER`)

### 4. Lấy danh sách nhân viên
Lấy toàn bộ danh sách nhân sự thuộc một chi nhánh.

- **URL**: `/clinics/{clinicId}/staff`
- **Method**: `GET`
- **Auth**: `Bearer Token` (Role: `CLINIC_OWNER`, `CLINIC_MANAGER`, `ADMIN`)
- **Response**: `List<StaffResponse>`

### 5. Xóa nhân viên
Gỡ bỏ nhân viên khỏi chi nhánh.

- **URL**: `/clinics/{clinicId}/staff/{userId}`
- **Method**: `DELETE`
- **Auth**: `Bearer Token` (Role: `CLINIC_OWNER`, `CLINIC_MANAGER`)

---

## ⚠️ Quy trình xử lý lỗi (Error Handling)
- `403 Forbidden`: Người dùng không có quyền quản lý chi nhánh này.
- `404 Not Found`: Không tìm thấy Phòng khám hoặc Người dùng.
- `400 Bad Request`: Định dạng SĐT không đúng hoặc vai trò không hợp lệ.
- `409 Conflict`: Số điện thoại đã được đăng ký tài khoản khác trên hệ thống.
