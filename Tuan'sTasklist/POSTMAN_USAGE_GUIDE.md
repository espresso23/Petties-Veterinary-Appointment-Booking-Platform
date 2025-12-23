# 📮 Hướng Dẫn Sử Dụng Postman Collection

## 🎯 Vấn Đề: 403 Forbidden

**Nguyên nhân:** Endpoint `/api/clinics` yêu cầu authentication token, nhưng request chưa có token.

---

## ✅ Cách Sử Dụng Đúng

### Bước 1: Login để lấy Token

1. Mở Postman Collection: `postman/PETTIES_Clinic_Management.postman_collection.json`
2. Chạy request **"Login CLINIC_OWNER"** hoặc **"Login ADMIN"**:
   - **Login CLINIC_OWNER:**
     - Username: `owner1`
     - Password: `owner123`
   - **Login ADMIN:**
     - Username: `admin`
     - Password: `admin123`
3. Token sẽ **tự động lưu** vào collection variable `authToken`

### Bước 2: Test các Clinic APIs

Sau khi login, tất cả các request khác sẽ tự động dùng token từ header:
```
Authorization: Bearer {{authToken}}
```

---

## 🔓 Đã Sửa: GET /api/clinics Public

**Đã cập nhật SecurityConfig** để cho phép **GET requests** đến `/api/clinics/**` không cần authentication (chỉ để view clinics).

**Lưu ý:**
- ✅ **GET** `/api/clinics` - **Public** (không cần token)
- ✅ **GET** `/api/clinics/{id}` - **Public** (không cần token)
- 🔒 **POST** `/api/clinics` - **Cần CLINIC_OWNER token**
- 🔒 **PUT** `/api/clinics/{id}` - **Cần CLINIC_OWNER token**
- 🔒 **DELETE** `/api/clinics/{id}` - **Cần CLINIC_OWNER token**
- 🔒 **Admin endpoints** - **Cần ADMIN token**

---

## 📋 Test Flow Khuyến Nghị

### 1. Test Public Endpoints (Không cần login)
```
GET /api/clinics
GET /api/clinics/{id}
```

### 2. Test với Authentication
```
1. POST /auth/login (Login CLINIC_OWNER)
   → Token tự động lưu vào {{authToken}}

2. POST /api/clinics (Create Clinic)
   → Dùng token từ bước 1

3. GET /api/clinics/owner/my-clinics
   → Xem clinics của owner hiện tại

4. PUT /api/clinics/{id}
   → Update clinic

5. DELETE /api/clinics/{id}
   → Delete clinic
```

### 3. Test Admin Endpoints
```
1. POST /auth/login (Login ADMIN)
   → Token tự động lưu vào {{authToken}}

2. GET /api/clinics?status=PENDING
   → Xem clinics đang chờ approval

3. POST /api/clinics/{id}/approve
   → Approve clinic

4. POST /api/clinics/{id}/reject
   → Reject clinic
```

---

## 🐛 Troubleshooting

### Lỗi 403 Forbidden
- **Nguyên nhân:** Chưa login hoặc token hết hạn
- **Giải pháp:** Chạy lại "Login CLINIC_OWNER" hoặc "Login ADMIN"

### Lỗi 401 Unauthorized
- **Nguyên nhân:** Token không hợp lệ hoặc đã hết hạn
- **Giải pháp:** Login lại để lấy token mới

### Token không tự động lưu
- **Kiểm tra:** Xem collection variables có `authToken` không
- **Giải pháp:** Chạy lại login request, đảm bảo response code là 200

---

## 📝 Collection Variables

Collection tự động quản lý các variables sau:
- `baseUrl`: `http://localhost:8080/api`
- `authToken`: Token JWT (tự động lưu sau khi login)
- `clinicId`: ID của clinic (có thể set thủ công)

---

**Last Updated:** 2025-12-20


