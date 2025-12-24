# 👥 Sample Users - Dữ Liệu Mẫu

## 📝 Tổng Quan

File `DataInitializer.java` tự động tạo các users mẫu khi backend khởi động lần đầu.

---

## 🔐 Danh Sách Users

### 1. ADMIN User
- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@petties.com`
- **Role:** `ADMIN`
- **Mô tả:** Quản trị viên hệ thống, có quyền approve/reject clinics

### 2. CLINIC_OWNER Users
- **Username:** `owner1`
- **Password:** `owner123`
- **Email:** `owner1@petties.com`
- **Role:** `CLINIC_OWNER`
- **Mô tả:** Chủ phòng khám, có quyền tạo/quản lý clinics

- **Username:** `owner2`
- **Password:** `owner123`
- **Email:** `owner2@petties.com`
- **Role:** `CLINIC_OWNER`

### 3. VET Users
- **Username:** `vet1`
- **Password:** `vet123`
- **Email:** `vet1@petties.com`
- **Role:** `VET`
- **Mô tả:** Bác sĩ thú y

- **Username:** `vet2`
- **Password:** `vet123`
- **Email:** `vet2@petties.com`
- **Role:** `VET`

### 4. PET_OWNER Users
- **Username:** `petowner1`
- **Password:** `petowner123`
- **Email:** `petowner1@petties.com`
- **Role:** `PET_OWNER`
- **Mô tả:** Chủ thú cưng

- **Username:** `petowner2`
- **Password:** `petowner123`
- **Email:** `petowner2@petties.com`
- **Role:** `PET_OWNER`

### 5. CLINIC_MANAGER User
- **Username:** `manager1`
- **Password:** `manager123`
- **Email:** `manager1@petties.com`
- **Role:** `CLINIC_MANAGER`
- **Mô tả:** Quản lý phòng khám

---

## 🚀 Cách Sử Dụng

### Test Login trong Postman:

1. **Login ADMIN:**
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

2. **Login CLINIC_OWNER:**
```json
POST /api/auth/login
{
  "username": "owner1",
  "password": "owner123"
}
```

3. **Login VET:**
```json
POST /api/auth/login
{
  "username": "vet1",
  "password": "vet123"
}
```

4. **Login PET_OWNER:**
```json
POST /api/auth/login
{
  "username": "petowner1",
  "password": "petowner123"
}
```

---

## ⚙️ Cơ Chế Hoạt Động

- **Tự động chạy:** DataInitializer chạy khi backend khởi động
- **Tránh duplicate:** Kiểm tra user đã tồn tại trước khi tạo
- **Password hashing:** Tất cả passwords được hash bằng BCrypt
- **JPA Auditing:** `createdAt` và `updatedAt` tự động được set

---

## 🔄 Reset Data

Để reset và tạo lại data mẫu:

1. Xóa users trong database:
```sql
DELETE FROM users;
```

2. Restart backend → DataInitializer sẽ tự động tạo lại

---

**Last Updated:** 2025-12-20


