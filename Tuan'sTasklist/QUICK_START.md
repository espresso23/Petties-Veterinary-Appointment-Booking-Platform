# 🚀 Quick Start - Chạy Backend

## ⚠️ Lưu Ý Quan Trọng

**Project cần Java 21**, nhưng bạn đang dùng Java 17. Cần cài Java 21 trước!

---

## 📦 Bước 1: Cài Java 21

### Cách 1: Dùng winget (Khuyến nghị)

```powershell
# Cài Java 21
winget install Microsoft.OpenJDK.21 --accept-package-agreements --accept-source-agreements

# Sau khi cài, RESTART TERMINAL hoặc set JAVA_HOME:
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Kiểm tra
java -version
# Output: openjdk version "21.0.9" ...
```

### Cách 2: Dùng Chocolatey

```powershell
# Cài Java 21 (cần chạy PowerShell với quyền Administrator)
choco install microsoft-openjdk21 -y

# Restart terminal và kiểm tra
java -version
```

---

## 🗄️ Bước 2: Start Databases

```powershell
# Chạy PostgreSQL, MongoDB, Redis
docker-compose -f docker-compose.db-only.yml up -d

# Kiểm tra
docker ps
# Sẽ thấy 3 containers: postgres, mongodb, redis
```

---

## 🚀 Bước 3: Chạy Backend với Maven Wrapper

```powershell
cd backend-spring/petties

# Chạy với Maven Wrapper (không cần cài Maven)
.\mvnw.cmd spring-boot:run
```

**Lưu ý:**
- Lần đầu chạy, Maven Wrapper sẽ tự động download Maven 3.9.11 (~30MB)
- Backend sẽ chạy tại: `http://localhost:8080/api`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

---

## ✅ Kiểm Tra

Mở terminal mới và test:

```powershell
# Test health endpoint
curl http://localhost:8080/api/actuator/health

# Hoặc mở browser:
# http://localhost:8080/api/actuator/health
```

---

## 🐛 Troubleshooting

### Lỗi: "class file version 65.0"

**Nguyên nhân:** Đang dùng Java 17, cần Java 21

**Giải pháp:**
```powershell
# Kiểm tra Java version
java -version

# Nếu vẫn là Java 17, cài Java 21 (xem Bước 1)
# Sau đó RESTART TERMINAL và chạy lại
```

### Lỗi: "Database connection refused"

**Giải pháp:**
```powershell
# Kiểm tra databases đang chạy
docker ps

# Nếu không thấy, start lại
docker-compose -f docker-compose.db-only.yml up -d
```

### Lỗi: "Port 8080 already in use" hoặc "Database connection failed"

**Giải pháp:**
```powershell
# Kill tất cả Java processes (nếu có nhiều backend đang chạy)
Stop-Process -Name java -Force -ErrorAction SilentlyContinue

# Hoặc tìm process cụ thể đang dùng port 8080
netstat -ano | findstr :8080

# Kill process (thay <PID> bằng số từ netstat)
taskkill /PID <PID> /F
```

### Lỗi: "HikariCP connection failed" hoặc "password authentication failed"

**Nguyên nhân:** 
- Backend khởi động trước khi database sẵn sàng
- Password không khớp

**Giải pháp:**
1. Đảm bảo databases đang chạy:
   ```powershell
   docker ps
   # Phải thấy: petties-dev-postgres, petties-dev-mongodb, petties-dev-redis
   ```

2. Nếu databases chưa chạy:
   ```powershell
   docker-compose -f docker-compose.db-only.yml up -d
   ```

3. Reset password PostgreSQL (nếu gặp lỗi authentication):
   ```powershell
   docker exec -it petties-dev-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
   ```

4. Đợi 10-15 giây để databases sẵn sàng, sau đó chạy lại backend:
   ```powershell
   cd backend-spring/petties
   .\mvnw.cmd spring-boot:run
   ```

---

**Last Updated:** 2025-12-20


