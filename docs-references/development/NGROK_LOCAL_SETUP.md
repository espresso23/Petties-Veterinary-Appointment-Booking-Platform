# Ngrok Local Development Setup Guide

Hướng dẫn cấu hình ngrok để kết nối Mobile App với Backend (8080) và AI Service (8000) qua internet mà không cần USB debugging.

**Cập nhật:** 2026-02-06  
**Áp dụng cho:** Petties Mobile App + Backend Local Development

---

## Tổng quan

### Kiến trúc với Nginx Reverse Proxy

```
┌─────────────────┐     ngrok      ┌──────────────────────────────────────────┐
│   Mobile App    │ ◄────────────► │  https://xxx.ngrok-free.dev              │
└────────┬────────┘                └──────────┬───────────────────────────────┘
         │                                    │
         │         Nginx (Port 8080)          │
         │  ┌─────────────────────────────┐   │
         │  │  /api/* → Backend:8080      │   │
         │  │  /ws/chat/* → AI:8000       │   │  (AI WebSocket)
         │  │  /ws/* → Backend:8080       │   │  (Backend WebSocket)
         │  │  /* → AI:8000               │   │  (AI REST API)
         │  └─────────────────────────────┘   │
         │                                    │
         └────────────────────────────────────┘
```

**Routing chi tiết:**
| Path | Destination | Service |
|------|-------------|---------|
| `/api/*` | `backend:8080/api/*` | Backend REST API |
| `/ws/chat/*` | `ai-service:8000/ws/chat/*` | AI WebSocket Chat |
| `/ws/*` | `backend:8080/ws/*` | Backend WebSocket |
| `/ws-native/*` | `backend:8080/ws-native/*` | Backend Native WebSocket |
| `/*` | `ai-service:8000/*` | AI REST API |

> **Lưu ý:** `/ws/chat/*` phải đặt TRƯỚC `/ws/*` trong nginx.conf để tránh bị route nhầm vào Backend.

---

## Yêu cầu

- [Ngrok account](https://ngrok.com/) (Free tier hoạt động tốt)
- Backend Spring Boot chạy ở port 8080
- AI Service FastAPI chạy ở port 8000 (nếu test chat/AI)
- Flutter SDK đã cài đặt

---

## Cấu hình Backend (One-time Setup)

### Bước 1: Cập nhật CORS trong SecurityConfig

**File:** `backend-spring/petties/src/main/java/com/petties/petties/config/SecurityConfig.java`

Thêm ngrok domains vào `allowedOrigins`:

```java
@Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,https://*.ngrok.io,https://*.ngrok-free.app,https://*.ngrok.dev}")
private String allowedOrigins;
```

**Hoặc** cập nhật `application-dev.yml`:

```yaml
# src/main/resources/application-dev.yml
cors:
  allowed-origins: http://localhost:5173,http://localhost:3000,https://*.ngrok.io,https://*.ngrok-free.app,https://*.ngrok.dev
```

> **Lưu ý:** Chỉ cần làm 1 lần. Sau này restart backend không cần làm lại.

### Bước 2: Kiểm tra file nginx.conf

**File:** `nginx.conf` (ở thư mục gốc project)

File này đã được cấu hình sẵn với đầy đủ WebSocket support cho cả Backend và AI Service:

```nginx
server {
    listen 80;
    
    # Backend REST API
    location /api/ {
        proxy_pass http://backend:8080/api/;
        ...
    }
    
    # AI WebSocket - PHẢI đặt trước /ws/*
    location /ws/chat/ {
        proxy_pass http://ai-service:8000/ws/chat/;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        ...
    }
    
    # Backend WebSocket
    location /ws/ {
        proxy_pass http://backend:8080/ws/;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        ...
    }
    
    # AI REST API (catch-all)
    location / {
        proxy_pass http://ai-service:8000/;
        ...
    }
}
```

**Nếu thiếu file:** Copy từ `nginx.conf` trong repo (đã tạo sẵn).

---

## Daily Workflow (Mỗi ngày làm việc)

### Step 1: Start Backend Services (Docker)

```bash
# Terminal 1 - Start tất cả services bằng Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Services sẽ chạy ở:
# - Nginx Reverse Proxy: http://localhost:8080 (gộp Backend + AI)
# - Backend trực tiếp: http://localhost:8080/api/...
# - AI Service trực tiếp: http://localhost:8000
# - PostgreSQL: localhost:5432
# - MongoDB: localhost:27017
# - Redis: localhost:6379
```

**Kiểm tra services đã chạy:**
```bash
# Xem status containers
docker-compose -f docker-compose.dev.yml ps

# Kiểm tra logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f ai-service

# Test health check
curl http://localhost:8080/api/actuator/health
curl http://localhost:8000/health
```

**Nếu cần restart services:**
```bash
# Restart specific service
docker-compose -f docker-compose.dev.yml restart backend
docker-compose -f docker-compose.dev.yml restart ai-service

# Hoặc restart tất cả
docker-compose -f docker-compose.dev.yml restart

# Nếu muốn rebuild (sau khi pull code mới)
docker-compose -f docker-compose.dev.yml up -d --build
```

**Stop services khi xong:**
```bash
docker-compose -f docker-compose.dev.yml down

# Hoặc stop và xóa volumes (cẩn thận - mất data)
docker-compose -f docker-compose.dev.yml down -v
```

### Step 2: Start Ngrok Tunnel (Chỉ cần 1 tunnel!)

Với Nginx Reverse Proxy, chỉ cần 1 ngrok tunnel cho port 8080:

```bash
# Terminal 3 - Nginx tunnel (gộp cả Backend + AI)
ngrok http 8080
# Copy "Forwarding" URL: https://abc123.ngrok-free.app
```

**Ví dụ output ngrok:**
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:8080
```

> **Lưu ý:** Chỉ cần 1 tunnel duy nhất vì Nginx đã gộp Backend và AI Service vào cùng 1 port.

### Step 3: Update Mobile Configuration

**File:** `petties_mobile/.env`

Thay thế `API_BASE_URL` và thêm `AI_SERVICE_URL`:

```bash
# Backend API URL từ ngrok (thay abc123 bằng URL thực tế)
API_BASE_URL=https://abc123.ngrok.io

# AI Service URL từ ngrok (thay def456 bằng URL thực tế)
AI_SERVICE_URL=https://def456.ngrok.io

# Giữ nguyên các config khác:
GOOGLE_CLIENT_ID=
GOONG_API_KEY=
MAP_API_KEY=
ENVIRONMENT=dev
```

### Step 4: Rebuild & Run Mobile

```bash
cd petties_mobile

# Clean để đảm bảo load .env mới
flutter clean

# Install dependencies
flutter pub get

# Run app
flutter run
```

---

## Kiểm tra kết nối

### Test Backend API
```bash
# Từ mobile hoặc browser
curl https://abc123.ngrok.io/api/actuator/health

# Expected: {"status":"UP"}
```

### Test AI Service
```bash
# Từ mobile hoặc browser
curl https://def456.ngrok.io/health

# Expected: {"status":"healthy","service":"ai-agent"}
```

---

## Giới hạn Ngrok Free Tier

| Giới hạn | Tác động | Giải pháp |
|----------|----------|-----------|
| **URL thay đổi** mỗi session | Phải update `.env` mỗi lần restart ngrok | Dùng [paid plan](https://ngrok.com/pricing) ($5/tháng) cho static domain |
| **2-hour timeout** | Ngrok tự động disconnect sau 2h | Restart ngrok và update `.env` |
| **40 connections/minute** | Rate limiting | Đủ cho development, không ảnh hưởng |

---

## WebSocket Support (Cho Chat)

Nếu dùng WebSocket (chat feature), cần đổi từ `ws://` sang `wss://`:

```dart
// File: petties_mobile/lib/config/env/environment.dart

// ❌ Sai - Không dùng ws:// với ngrok HTTPS
final wsUrl = 'ws://localhost:8080/ws';

// ✅ Đúng - Dùng wss:// cho ngrok HTTPS
final wsUrl = 'wss://abc123.ngrok.io/ws';
```

**Update trong environment.dart:**
```dart
static String get wsUrl {
  // Ưu tiên lấy từ dart-define
  if (_wsUrlOverride.isNotEmpty) {
    return _wsUrlOverride;
  }
  
  // Default cho ngrok (wss://)
  return 'wss://abc123.ngrok.io/ws';
}
```

---

## ⚠️ Google OAuth / Google Sign-In Limitation

### Vấn đề
Google OAuth **KHÔNG hoạt động** với ngrok free tier vì:
- Google Cloud Console yêu cầu đăng ký domain trong "Authorized JavaScript origins"
- Ngrok free domain thay đổi mỗi session (abc123.ngrok.io → xyz789.ngrok.io)
- Không thể cập nhật Google Console mỗi lần chạy ngrok

### Giải pháp

#### Option 1: Dùng IP LAN cho OAuth Testing (Khuyến nghị)
```bash
# Không dùng ngrok cho OAuth testing
# Dùng IP LAN thay thế (phone và laptop cùng WiFi)

# Lấy IP LAN
ipconfig  # Windows → ví dụ: 192.168.1.100

# Update .env
API_BASE_URL=http://192.168.1.100:8080

# Thêm IP vào Google Cloud Console
# Authorized JavaScript origins: http://192.168.1.100:8080
```

#### Option 2: Ngrok Paid Plan ($5/tháng)
- Đăng ký ngrok paid plan để có static domain
- Domain cố định: `https://petties-dev.ngrok.io`
- Thêm domain này vào Google Cloud Console 1 lần

#### Option 3: Test OAuth trên Test/Staging Environment
- Deploy code lên test.petties.world
- Test Google Sign-In trên môi trường test

### Google Cloud Console Config

Nếu dùng **IP LAN** hoặc **static ngrok domain**, thêm vào:

**Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client IDs

| Loại | URL cần thêm |
|------|--------------|
| **IP LAN** | `http://192.168.x.x:8080` |
| **Ngrok Static** | `https://your-domain.ngrok.io` |
| **Web** | `http://localhost:3000`, `https://petties.world` |

> ⚠️ **Lưu ý:** Chỉ dùng IP LAN/ngrok cho development. Production phải dùng domain chính thức.

---

## Troubleshooting

### Issue 1: "Connection refused" / "Failed to connect"

**Nguyên nhân:** Backend không chạy hoặc sai port  
**Kiểm tra:**
```bash
# Test backend local
curl http://localhost:8080/api/actuator/health

# Test qua ngrok
curl https://xxx.ngrok.io/api/actuator/health
```

**Fix:**
- Kiểm tra backend đã start chưa
- Kiểm tra port 8080 có đúng không
- Restart ngrok nếu URL expired

### Issue 2: CORS error trong console

**Nguyên nhân:** Backend chưa allow ngrok domain  
**Kiểm tra:** Xem log backend có hiển thị CORS error không

**Fix:**
- Kiểm tra lại Step 1: CORS config
- Restart backend sau khi sửa CORS

### Issue 3: "Invalid token" sau khi đổi URL

**Nguyên nhân:** Token lưu trong app (localStorage) không hợp lệ với domain mới  
**Fix:**
```dart
// Trong app: Logout và login lại
// Hoặc: Clear app data trong Settings > Apps > Petties > Clear Data
```

### Issue 4: AI Service không kết nối được

**Nguyên nhân:** Quên start AI service hoặc sai URL  
**Fix:**
```bash
# Kiểm tra AI service đang chạy
curl http://localhost:8000/health

# Kiểm tra qua ngrok
curl https://yyy.ngrok.io/health
```

---

## Alternative: Dùng IP LAN (Không cần ngrok) - Khuyến nghị cho OAuth

IP LAN là **lựa chọn tốt nhất** nếu bạn cần test Google Sign-In/OAuth:
- ✅ Không thay đổi IP (trong cùng 1 mạng WiFi)
- ✅ Dễ cấu hình Google Cloud Console
- ✅ Không cần restart/update config thường xuyên
- ✅ Miễn phí 100%

Chỉ dùng ngrok nếu bạn **không cần test Google Sign-In** hoặc có **ngrok paid plan**.

### Bước 1: Lấy IP LAN
```bash
# Windows
ipconfig
# Tìm: IPv4 Address: 192.168.x.x

# macOS/Linux
ifconfig
# Hoặc: ip addr show
```

### Bước 2: Update .env
```bash
# petties_mobile/.env
API_BASE_URL=http://192.168.1.100:8080  # Thay bằng IP thực tế
AI_SERVICE_URL=http://192.168.1.100:8000
```

### Yêu cầu:
- Phone và Laptop phải cùng WiFi network
- Tường lửa cho phép kết nối qua LAN
- CORS config phải include IP: `http://192.168.*`

---

## Scripts hỗ trợ

### Auto-update .env với ngrok URL (PowerShell)

```powershell
# scripts/update-ngrok-env.ps1
$ngrokApi = "http://127.0.0.1:4040/api/tunnels"
$tunnels = Invoke-RestMethod -Uri $ngrokApi

$backendUrl = $tunnels.tunnels | Where-Object { $_.config.addr -eq "localhost:8080" } | Select-Object -ExpandProperty public_url
$aiUrl = $tunnels.tunnels | Where-Object { $_.config.addr -eq "localhost:8000" } | Select-Object -ExpandProperty public_url

$envFile = "petties_mobile/.env"
$content = Get-Content $envFile

$content = $content -replace "API_BASE_URL=.*", "API_BASE_URL=$backendUrl"
$content = $content -replace "AI_SERVICE_URL=.*", "AI_SERVICE_URL=$aiUrl"

Set-Content $envFile $content
Write-Host "Updated .env with ngrok URLs"
```

**Sử dụng:**
```powershell
# Sau khi start ngrok, chạy:
.\scripts\update-ngrok-env.ps1
```

---

## Checklist hàng ngày

### Trường hợp 1: Không cần test Google Sign-In (Khuyến nghị dùng ngrok)
- [ ] Start Backend Spring Boot (port 8080)
- [ ] Start AI Service (port 8000) - nếu cần
- [ ] Start ngrok tunnel cho 8080: `ngrok http 8080`
- [ ] Start ngrok tunnel cho 8000: `ngrok http 8000` (nếu cần AI)
- [ ] Copy ngrok URLs
- [ ] Update `petties_mobile/.env` với URLs mới
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test kết nối: Login (username/password), API calls

### Trường hợp 2: Cần test Google Sign-In (Khuyến nghị dùng IP LAN)
- [ ] Lấy IP LAN: `ipconfig` → ví dụ: `192.168.1.100`
- [ ] Start Backend Spring Boot (port 8080)
- [ ] Update `petties_mobile/.env`: `API_BASE_URL=http://192.168.1.100:8080`
- [ ] Đảm bảo phone và laptop cùng WiFi
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test: Google Sign-In, Login, API calls

### Lưu ý quan trọng
| Tính năng | Ngrok Free | IP LAN | Ngrok Paid |
|-----------|------------|--------|------------|
| API calls | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ |
| Google Sign-In | ❌ | ✅ | ✅ |
| Static URL | ❌ | ✅ | ✅ |

---

## References

- [Ngrok Documentation](https://ngrok.com/docs)
- [Flutter Network Configuration](https://docs.flutter.dev/development/data-and-backend/networking)
- [Spring Boot CORS Configuration](https://spring.io/guides/gs/rest-service-cors/)

---

*File location: `docs-references/development/NGROK_LOCAL_SETUP.md`*  
*Last updated: 2026-02-06*
