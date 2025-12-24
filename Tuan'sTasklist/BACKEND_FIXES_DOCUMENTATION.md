# 📋 Tài Liệu Tổng Hợp: Các Chỉnh Sửa Backend để Fix Lỗi "Socket Hang Up"

## 📌 Tổng Quan

Tài liệu này mô tả chi tiết tất cả các thay đổi đã thực hiện để khắc phục lỗi **"Socket Hang Up"** và các vấn đề liên quan khi test API trong Postman. Backend đã được fix và hiện đang chạy thành công trong Docker.

---

## 🔍 Các Vấn Đề Đã Gặp Phải

### 1. **Socket Hang Up** ❌
- **Mô tả**: Postman không thể kết nối đến backend, hiển thị lỗi "socket hang up"
- **Nguyên nhân**: Backend container vừa mới khởi động, Spring Boot chưa sẵn sàng (cần 30-60 giây)

### 2. **403 Forbidden** ❌
- **Mô tả**: GET `/api/clinics` trả về 403 Forbidden
- **Nguyên nhân**: SecurityConfig đang match sai path pattern

### 3. **500 Internal Server Error - Transaction** ❌
- **Mô tả**: Lỗi "Cannot commit when autoCommit is enabled"
- **Nguyên nhân**: Xung đột giữa Hibernate autocommit và Spring Transaction Management

### 4. **500 Internal Server Error - SQL Query** ❌
- **Mô tả**: Lỗi "function lower(bytea) does not exist"
- **Nguyên nhân**: Query JPA đang cố dùng `lower()` trên field có thể là null/bytea

---

## ✅ Các Chỉnh Sửa Đã Thực Hiện

### 🔧 Fix 1: SecurityConfig - Cho phép public access GET /api/clinics

**File**: `backend-spring/petties/src/main/java/com/petties/petties/config/SecurityConfig.java`

**Vấn đề**: 
- Context path của ứng dụng là `/api` (được config trong `application.properties`)
- Controller mapping là `/clinics` (không có `/api` vì context path đã có)
- SecurityConfig đang match `/api/clinics/**` → **SAI** (vì Spring Security nhìn vào path sau khi đã strip context path)

**Giải pháp**:
```java
// TRƯỚC (SAI):
.requestMatchers(HttpMethod.GET, "/api/clinics/**").permitAll()

// SAU (ĐÚNG):
.requestMatchers(HttpMethod.GET, "/clinics/**").permitAll()  // Context path=/api, nên full path là /api/clinics
```

**Lý do**: 
- Spring Boot có `server.servlet.context-path=/api`
- Khi request đến `/api/clinics`, Spring sẽ:
  1. Strip context path → còn lại `/clinics`
  2. Match với Controller `@RequestMapping("/clinics")`
  3. SecurityConfig cũng nhìn vào path sau khi strip → `/clinics`

---

### 🔧 Fix 2: ClinicController - Sửa RequestMapping

**File**: `backend-spring/petties/src/main/java/com/petties/petties/controller/ClinicController.java`

**Vấn đề**:
- Controller có `@RequestMapping("/api/clinics")` 
- Nhưng context path đã là `/api` → full path sẽ thành `/api/api/clinics` → **SAI**

**Giải pháp**:
```java
// TRƯỚC (SAI):
@RestController
@RequestMapping("/api/clinics")
public class ClinicController { ... }

// SAU (ĐÚNG):
@RestController
@RequestMapping("/clinics")  // Context path is /api, so full path will be /api/clinics
public class ClinicController { ... }
```

**Lý do**:
- Context path `/api` + Controller path `/clinics` = Full path `/api/clinics` ✅

---

### 🔧 Fix 3: Application Properties - Fix Transaction Management

**File**: `backend-spring/petties/src/main/resources/application.properties`

**Vấn đề**:
- Hibernate config `hibernate.connection.provider_disables_autocommit=true` đang gây xung đột với Spring Transaction Management
- Khi Spring cố commit transaction, PostgreSQL báo lỗi "Cannot commit when autoCommit is enabled"

**Giải pháp**:
```properties
# TRƯỚC:
spring.jpa.properties.hibernate.connection.provider_disables_autocommit=true

# SAU:
# Disable Hibernate's autocommit handling - let Spring TransactionManager handle it
# spring.jpa.properties.hibernate.connection.provider_disables_autocommit=true

# Thêm:
spring.transaction.default-timeout=30
```

**Lý do**:
- Spring Boot tự động quản lý transaction thông qua `JpaTransactionManager`
- Hibernate không nên can thiệp vào autocommit
- Để Spring quản lý transaction hoàn toàn → tránh xung đột

---

### 🔧 Fix 4: ClinicRepository - Fix SQL Query với null handling

**File**: `backend-spring/petties/src/main/java/com/petties/petties/repository/ClinicRepository.java`

**Vấn đề**:
- Query JPA: `LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))`
- Khi `:name` là `null`, Hibernate có thể cố cast thành bytea → lỗi "function lower(bytea) does not exist"

**Giải pháp**:
```java
// TRƯỚC:
@Query("SELECT c FROM Clinic c WHERE " +
       "(:status IS NULL OR c.status = :status) AND " +
       "(:name IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))) AND " +
       "c.deletedAt IS NULL")

// SAU:
@Query("SELECT c FROM Clinic c WHERE " +
       "(:status IS NULL OR c.status = :status) AND " +
       "(:name IS NULL OR :name = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))) AND " +
       "c.deletedAt IS NULL")
```

**Lý do**:
- Thêm check `:name = ''` để tránh Hibernate cố xử lý null/empty string
- Đảm bảo chỉ dùng `LOWER()` khi `name` thực sự có giá trị

---

### 🔧 Fix 5: DataInitializer - Tạm thời disable để tránh transaction error

**File**: `backend-spring/petties/src/main/java/com/petties/petties/config/DataInitializer.java`

**Vấn đề**:
- `DataInitializer` đang gặp lỗi transaction khi tạo sample users
- Gây crash backend khi khởi động

**Giải pháp tạm thời**:
```java
// TRƯỚC:
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner { ... }

// SAU:
// @Component  // Temporarily disabled to allow backend to start
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner { ... }
```

**Lưu ý**: 
- Đây là giải pháp **tạm thời**
- Backend sẽ start được nhưng không có sample users
- Cần fix transaction trong `DataInitializer` sau (hoặc tạo users thủ công)

---

## 📁 Danh Sách Files Đã Thay Đổi

1. ✅ `backend-spring/petties/src/main/java/com/petties/petties/config/SecurityConfig.java`
   - Thay đổi: Permit `/clinics/**` thay vì `/api/clinics/**`

2. ✅ `backend-spring/petties/src/main/java/com/petties/petties/controller/ClinicController.java`
   - Thay đổi: `@RequestMapping("/api/clinics")` → `@RequestMapping("/clinics")`

3. ✅ `backend-spring/petties/src/main/resources/application.properties`
   - Thay đổi: Comment `hibernate.connection.provider_disables_autocommit`
   - Thêm: `spring.transaction.default-timeout=30`

4. ✅ `backend-spring/petties/src/main/java/com/petties/petties/repository/ClinicRepository.java`
   - Thay đổi: Thêm check `:name = ''` trong query `findWithFilters`

5. ⚠️ `backend-spring/petties/src/main/java/com/petties/petties/config/DataInitializer.java`
   - Thay đổi: Comment `@Component` (tạm thời)

---

## 🧪 Cách Test Sau Khi Fix

### 1. Kiểm tra Backend đã sẵn sàng

```bash
# Kiểm tra health endpoint
curl http://localhost:8080/api/actuator/health

# Hoặc trong PowerShell
Invoke-RestMethod -Uri "http://localhost:8080/api/actuator/health"
```

**Kết quả mong đợi**: 
```json
{
  "status": "UP"
}
```

### 2. Test GET /api/clinics (Public - không cần auth)

**Trong Postman**:
- Method: `GET`
- URL: `http://localhost:8080/api/clinics?page=0&size=10`
- Headers: Không cần (public endpoint)

**Kết quả mong đợi**: 
```json
{
  "content": [],
  "totalElements": 0,
  "totalPages": 0,
  "number": 0,
  "size": 10
}
```

### 3. Test POST /api/auth/login (Cần user)

**Trong Postman**:
- Method: `POST`
- URL: `http://localhost:8080/api/auth/login`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Lưu ý**: 
- ⚠️ Hiện tại sẽ trả về **401 Unauthorized** vì `DataInitializer` đã tắt
- Cần tạo user thủ công hoặc bật lại `DataInitializer` (sau khi fix transaction)

---

## 🚀 Hướng Dẫn Chạy Backend

### Option 1: Chạy bằng Docker Compose (Recommended)

```bash
# Start tất cả services (databases + backend)
docker-compose -f docker-compose.dev.yml up -d

# Chỉ start backend (sau khi databases đã chạy)
docker-compose -f docker-compose.dev.yml up -d backend

# Xem logs
docker logs petties-dev-backend -f

# Stop
docker-compose -f docker-compose.dev.yml stop backend
```

### Option 2: Chạy local (không Docker)

```bash
# 1. Start databases bằng Docker
docker-compose -f docker-compose.db-only.yml up -d

# 2. Chạy backend bằng Maven Wrapper
cd backend-spring/petties
.\mvnw.cmd spring-boot:run
```

**Lưu ý**: 
- Đảm bảo Java 21 đã được cài đặt
- Database port: `5433` (tránh conflict với local PostgreSQL)

---

## ⚠️ Lưu Ý Quan Trọng

### 1. Context Path Configuration

- **Context path**: `/api` (config trong `application.properties`)
- **Tất cả endpoints** sẽ có prefix `/api`
- **SecurityConfig và Controller** phải match path **SAU KHI** strip context path

**Ví dụ**:
- Full URL: `http://localhost:8080/api/clinics`
- Context path: `/api` → strip đi
- Path trong SecurityConfig/Controller: `/clinics` ✅

### 2. Transaction Management

- **Spring Boot** tự động quản lý transaction qua `@Transactional`
- **Không nên** để Hibernate can thiệp vào autocommit
- Nếu gặp lỗi transaction, kiểm tra:
  1. `@Transactional` annotation có đúng không
  2. `application.properties` có config conflict không
  3. Database connection pool có vấn đề không

### 3. DataInitializer

- Hiện đã **tạm thời tắt** để backend có thể start
- **Cần fix sau** để có sample users cho testing
- Hoặc tạo users thủ công trong database

### 4. Docker Container

- Backend cần **30-60 giây** để khởi động hoàn toàn
- Đợi thấy log `Started PettiesApplication` trước khi test
- Kiểm tra health endpoint để confirm backend sẵn sàng

---

## 📊 Trạng Thái Hiện Tại

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Container | ✅ Running | Chạy trong Docker |
| GET /api/clinics | ✅ Working | Public endpoint, không cần auth |
| POST /api/auth/login | ⚠️ 401 | Cần user (DataInitializer đã tắt) |
| Database Connection | ✅ Connected | PostgreSQL port 5433 |
| Transaction Management | ✅ Fixed | Đã comment Hibernate autocommit |

---

## 🔄 Các Bước Tiếp Theo (TODO)

1. **Fix DataInitializer transaction** 
   - Bật lại `@Component`
   - Đảm bảo transaction hoạt động đúng
   - Tạo sample users khi backend start

2. **Test đầy đủ các endpoints**
   - Login/Register
   - Clinic CRUD
   - Search & Filter
   - Google Maps integration

3. **Tối ưu hóa**
   - Review transaction timeout
   - Optimize database queries
   - Add proper error handling

---

## 📝 Tóm Tắt Nhanh

### Các lỗi đã fix:
1. ✅ Socket hang up → Backend chưa sẵn sàng (đợi 30-60s)
2. ✅ 403 Forbidden → SecurityConfig match sai path
3. ✅ 500 Transaction → Comment Hibernate autocommit config
4. ✅ 500 SQL Query → Fix null handling trong JPA query

### Files đã thay đổi:
- `SecurityConfig.java` - Fix path matching
- `ClinicController.java` - Fix RequestMapping
- `application.properties` - Fix transaction config
- `ClinicRepository.java` - Fix SQL query
- `DataInitializer.java` - Tạm thời disable

### Kết quả:
- ✅ Backend chạy thành công trong Docker
- ✅ GET /api/clinics hoạt động
- ⚠️ Login cần user (DataInitializer đã tắt)

---

**Tài liệu được tạo vào**: 2025-12-20  
**Phiên bản**: 1.0  
**Tác giả**: Auto (AI Assistant)

