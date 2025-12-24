# 🚀 Hướng Dẫn Chạy Dự Án Local

**Người thực hiện:** Nguyễn Đức Tuấn (DE180807)  
**Ngày:** 2025-12-20

---

## ⚠️ Vấn Đề Hiện Tại

Khi chạy `docker-compose -f docker-compose.dev.yml up -d`, Docker đang timeout khi pull images lớn (eclipse-temurin:21-jdk-alpine, python:3.12, etc.) do vấn đề kết nối mạng.

**Giải pháp:** Chỉ chạy databases trong Docker, services chạy trực tiếp với hot-reload.

---

## 📦 Prerequisites

### Required Software

- **Java 21** (Spring Boot 4.0.0 yêu cầu Java 21) ⚠️ **BẮT BUỘC**
- **Maven 3.9.11** (hoặc 3.6.3+, project đang dùng 3.9.11)
- **Node.js 18+** (cho Frontend)
- **Docker Desktop** (cho databases)
- **Python 3.12+** (cho AI Service - optional)

### Cài Đặt Java 21

**⚠️ QUAN TRỌNG:** Project yêu cầu Java 21, không thể dùng Java 17 hoặc thấp hơn.

**Option 1: Cài tự động bằng winget (Khuyến nghị - Windows 10/11)**

```powershell
# Cài Java 21 (Microsoft OpenJDK)
winget install Microsoft.OpenJDK.21 --accept-package-agreements --accept-source-agreements

# Sau khi cài, RESTART TERMINAL hoặc set JAVA_HOME:
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Kiểm tra
java -version
# Output: openjdk version "21.0.9" ...
```

**Option 2: Cài bằng Chocolatey**

```powershell
# Cài Java 21 (cần chạy PowerShell với quyền Administrator)
choco install microsoft-openjdk21 -y

# Restart terminal và kiểm tra
java -version
```

**Option 3: Download thủ công**

1. Download Java 21: https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-21
   - File: `microsoft-jdk-21.0.9-windows-x64.msi`

2. Cài đặt và set JAVA_HOME:
   ```powershell
   # Thêm vào System Environment Variables
   # Variable: JAVA_HOME = C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot
   # Variable: Path → Thêm: %JAVA_HOME%\bin (đặt trước các Java khác)
   ```

3. **Restart Terminal** và kiểm tra:
   ```powershell
   java -version
   # Phải hiển thị: openjdk version "21" ...
   ```

**Lưu ý:** Nếu vẫn thấy Java 17 sau khi cài, hãy:
1. **Restart Terminal/PowerShell** (quan trọng!)
2. Hoặc set JAVA_HOME trong session hiện tại:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
   $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
   java -version
   ```

### Cài Đặt Maven

**Option 1: Cài tự động bằng winget (Khuyến nghị - Windows 10/11)**

```powershell
# Cài Maven tự động (sẽ cài version mới nhất, thường là 3.9.x)
winget install Apache.Maven

# Kiểm tra sau khi cài
mvn -version
```

**Option 2: Cài tự động bằng Chocolatey**

```powershell
# Cài Maven (cần chạy PowerShell với quyền Administrator)
choco install maven -y

# Kiểm tra sau khi cài
mvn -version
```

**Option 3: Download và cài thủ công**

1. Download Maven 3.9.11: https://maven.apache.org/download.cgi
   - File: `apache-maven-3.9.11-bin.zip`

2. Giải nén vào thư mục (ví dụ: `C:\Program Files\Apache\maven`)

3. Thêm vào PATH:
   ```powershell
   # Thêm vào System Environment Variables
   # Variable: MAVEN_HOME = C:\Program Files\Apache\maven
   # Variable: Path → Thêm: %MAVEN_HOME%\bin
   ```

4. Kiểm tra:
   ```powershell
   mvn -version
   # Output: Apache Maven 3.9.11
   ```

**Option 4: Dùng Maven Wrapper (Không cần cài Maven)**

Project đã có Maven Wrapper, chỉ cần chạy:
```powershell
.\mvnw.cmd spring-boot:run
```

---

## ✅ Cách Chạy Local (Khuyến Nghị)

### Bước 1: Start Databases Only

```powershell
# Chỉ chạy PostgreSQL, MongoDB, Redis
docker-compose -f docker-compose.db-only.yml up -d
```

**Kiểm tra:**
```powershell
docker ps
# Sẽ thấy 3 containers: postgres, mongodb, redis
```

### Bước 2: Start Backend Service (Terminal 1)

```powershell
cd backend-spring/petties

# Option 1: Dùng Maven đã cài (nếu đã cài Maven 3.9.11)
mvn spring-boot:run

# Option 2: Dùng Maven Wrapper (không cần cài Maven)
.\mvnw.cmd spring-boot:run
```

**Lưu ý:** 
- Nếu dùng Maven Wrapper lần đầu, nó sẽ tự động download Maven 3.9.11 (~30MB)
- Nếu đã cài Maven, đảm bảo version ≥ 3.6.3 (khuyến nghị 3.9.11)

**Backend sẽ chạy tại:** `http://localhost:8080/api`

**Swagger UI:** `http://localhost:8080/swagger-ui.html`

### Bước 3: Start AI Service (Terminal 2) - Optional

```powershell
cd petties-agent-serivce

# Tạo virtual environment (nếu chưa có)
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start service
python -m uvicorn app.main:app --reload --port 8000
```

**AI Service sẽ chạy tại:** `http://localhost:8000/docs`

### Bước 4: Start Web Frontend (Terminal 3)

```powershell
cd petties-web

# Install dependencies (nếu chưa có)
npm install

# Start dev server
npm run dev
```

**Frontend sẽ chạy tại:** `http://localhost:5173`

---

## 🔧 Environment Variables

### Backend (.env hoặc export)

Tạo file `.env` trong `backend-spring/petties/` hoặc set environment variables:

```properties
# Database (connect đến Docker containers)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petties_db
DB_USERNAME=postgres
DB_PASSWORD=postgres

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=petties_nosql
MONGO_USERNAME=admin
MONGO_PASSWORD=admin

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=devSecretKeyForLocalDevelopmentOnly123456789012345678901234

# Google Maps API (cho Clinic geocoding)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Optional (nếu cần)
MAIL_USERNAME=
MAIL_PASSWORD=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Frontend (.env)

Tạo file `.env` trong `petties-web/`:

```properties
VITE_API_URL=http://localhost:8080/api
VITE_AI_SERVICE_URL=http://localhost:8000/api/v1
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

---

## 🧪 Test APIs với Postman

1. **Import Collection:**
   - File: `postman/PETTIES_Clinic_Management.postman_collection.json`

2. **Login để lấy token:**
   - Chạy request "Login CLINIC_OWNER" hoặc "Login ADMIN"
   - Token sẽ tự động lưu vào variable `authToken`

3. **Test Clinic APIs:**
   - Create Clinic → Get Clinic → Update → Search → Nearby → Geocode → Distance

---

## 🛑 Stop Services

```powershell
# Stop databases
docker-compose -f docker-compose.db-only.yml down

# Hoặc stop và xóa volumes (reset data)
docker-compose -f docker-compose.db-only.yml down -v
```

---

## 📝 Troubleshooting

### 1. Database Connection Error

**Lỗi:** `Connection refused` hoặc `Connection timeout`

**Giải pháp:**
```powershell
# Kiểm tra containers đang chạy
docker ps

# Kiểm tra logs
docker logs petties-dev-postgres
docker logs petties-dev-mongodb
docker logs petties-dev-redis

# Restart containers
docker-compose -f docker-compose.db-only.yml restart
```

### 2. Port Already in Use

**Lỗi:** `Port 5432 is already allocated`

**Giải pháp:**
```powershell
# Tìm process đang dùng port
netstat -ano | findstr :5432

# Hoặc đổi port trong docker-compose.db-only.yml
ports:
  - "5433:5432"  # Thay vì 5432:5432
```

### 3. Google Maps API Key Not Set

**Lỗi:** `Google Maps API key not configured`

**Giải pháp:**
- Geocoding sẽ fail nhưng không ảnh hưởng đến các APIs khác
- Set `GOOGLE_MAPS_API_KEY` trong environment variables hoặc `.env`
- Hoặc test các endpoints không cần geocoding trước

### 4. Maven Build Error

**Lỗi:** `Could not resolve dependencies` hoặc `mvn: command not found`

**Giải pháp:**

**Nếu chưa cài Maven:**
```powershell
# Dùng Maven Wrapper thay vì cài Maven
.\mvnw.cmd clean install -DskipTests
.\mvnw.cmd spring-boot:run
```

**Nếu đã cài Maven:**
```powershell
# Kiểm tra version (cần ≥ 3.6.3)
mvn -version

# Clean và rebuild
mvn clean install -DskipTests
mvn spring-boot:run
```

**Kiểm tra Java version:**
```powershell
java -version
# Cần Java 21 (Spring Boot 4.0.0 yêu cầu)
```

---

## ✅ Checklist

- [ ] Docker Desktop đang chạy
- [ ] Databases đã start (`docker ps` thấy 3 containers)
- [ ] Backend đã start (check `http://localhost:8080/api/actuator/health`)
- [ ] Frontend đã start (check `http://localhost:5173`)
- [ ] Postman Collection đã import
- [ ] Đã login và có token

---

**Last Updated:** 2025-12-20

