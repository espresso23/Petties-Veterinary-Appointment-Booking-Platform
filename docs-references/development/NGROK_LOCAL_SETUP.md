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
API_BASE_URL=https://abc123.ngrok-free.app

# AI Service URL - để trống để auto-detect từ API_BASE_URL
# (Vì dùng nginx reverse proxy, AI service cùng URL với Backend)
AI_SERVICE_URL=

# WebSocket URLs - dùng cùng domain với API_BASE_URL
# Backend WebSocket: wss://abc123.ngrok-free.app/ws/chat/{conversationId}
# AI WebSocket: wss://abc123.ngrok-free.app/ws/chat/{session_id}
WS_URL=wss://abc123.ngrok-free.app

# Giữ nguyên các config khác:
GOOGLE_CLIENT_ID=620454234596-7vpt8pg3sdqo0j2u0r6j4iuaqu1q8t9h.apps.googleusercontent.com
GOONG_API_KEY=wFNRmlVOfptNJb1489XgcutaXwZc2FBJJPU3VQ0j
MAP_API_KEY=AIzaSyC-IQBcX0Sbbhb0seXwGdUbkvB5rSBUoic
ENVIRONMENT=dev
```

**Lưu ý WebSocket:**
- Backend WebSocket: `wss://xxx.ngrok-free.app/ws/chat/{conversationId}`
- AI WebSocket: `wss://xxx.ngrok-free.app/ws/chat/{session_id}` (cùng path nhưng khác query params)

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
curl https://abc123.ngrok-free.app/api/actuator/health

# Expected: {"status":"UP"}
```

### Test AI Service
```bash
# Từ mobile hoặc browser
curl https://abc123.ngrok-free.app/health

# Expected: {"status":"healthy","service":"ai-agent"}
```

### Test WebSocket

**Backend WebSocket:**
```bash
# Test WebSocket connection (dùng wscat hoặc websocat)
wscat -c "wss://abc123.ngrok-free.app/ws/chat/test-conversation?token=YOUR_JWT_TOKEN"

# Hoặc test với curl (HTTP upgrade)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: abc123.ngrok-free.app" \
  -H "Origin: https://abc123.ngrok-free.app" \
  "https://abc123.ngrok-free.app/ws-native"
```

**AI WebSocket:**
```bash
# AI Chat WebSocket
wscat -c "wss://abc123.ngrok-free.app/ws/chat/test-session?token=YOUR_JWT_TOKEN"
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

### WebSocket với Nginx Reverse Proxy

Với setup Nginx, cả Backend và AI Service đều dùng chung domain nhưng khác path:

| Service | WebSocket URL | Path |
|---------|---------------|------|
| **Backend** | `wss://abc123.ngrok-free.app/ws/chat/{conversationId}` | `/ws/chat/*` |
| **AI Service** | `wss://abc123.ngrok-free.app/ws/chat/{session_id}` | `/ws/chat/*` |
| **Backend Native** | `wss://abc123.ngrok-free.app/ws-native` | `/ws-native` |

> **Lưu ý quan trọng:** Cả Backend và AI Service đều dùng path `/ws/chat/*`. Nginx phân biệt bằng cách... không thể phân biệt chỉ bằng path! 
> 
> Đây là **limitation** của setup này. Nếu cần dùng cả 2 WebSocket cùng lúc, bạn cần:
> - Option A: Dùng 2 ngrok tunnels riêng biệt (cần ngrok paid)
> - Option B: Đổi AI WebSocket path trong code (vd: `/ai/ws/chat/*`)
> - Option C: Dùng IP LAN thay vì ngrok cho development

### Config trong Mobile

```dart
// File: petties_mobile/lib/config/env/environment.dart

// ❌ Sai - Không dùng ws:// với ngrok HTTPS
final wsUrl = 'ws://localhost:8080/ws';

// ✅ Đúng - Dùng wss:// cho ngrok HTTPS
final wsUrl = 'wss://abc123.ngrok-free.app';
// Backend WebSocket: $wsUrl/ws/chat/{conversationId}
// AI WebSocket: $wsUrl/ws/chat/{session_id}
```

**Update trong environment.dart:**
```dart
static String get wsUrl {
  // Ưu tiên lấy từ dart-define
  if (_wsUrlOverride.isNotEmpty) {
    return _wsUrlOverride;
  }
  
  // Default cho ngrok (wss://)
  return 'wss://abc123.ngrok-free.app';
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

**Nguyên nhân:** Backend, nginx không chạy, hoặc sai port  
**Kiểm tra:**
```bash
# Test backend trực tiếp
curl http://localhost:8080/api/actuator/health

# Test qua nginx
curl http://localhost:8080/api/actuator/health

# Test qua ngrok
curl https://xxx.ngrok-free.app/api/actuator/health

# Kiểm tra containers đang chạy
docker-compose -f docker-compose.dev.yml ps
```

**Fix:**
- Kiểm tra backend và nginx đã start chưa: `docker-compose -f docker-compose.dev.yml up -d`
- Kiểm tra port 8080 có bị chiếm không: `netstat -ano | findstr 8080`
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

**Nguyên nhân:** Nginx chưa route đúng hoặc AI service chưa start  
**Fix:**
```bash
# Kiểm tra AI service đang chạy (trực tiếp)
curl http://localhost:8000/health

# Kiểm tra qua nginx
curl http://localhost:8080/health

# Kiểm tra qua ngrok
curl https://xxx.ngrok-free.app/health

# Nếu lỗi 404, kiểm tra nginx logs
docker-compose -f docker-compose.dev.yml logs nginx
```

### Issue 5: WebSocket không kết nối được / timeout

**Nguyên nhân:** Nginx chưa config WebSocket headers  
**Kiểm tra:**
```bash
# Kiểm tra nginx.conf có Upgrade và Connection headers không
cat nginx.conf | grep -A5 "location /ws"
```

**Fix:**
- Đảm bảo `nginx.conf` có:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
  ```
- Restart nginx: `docker-compose -f docker-compose.dev.yml restart nginx`

### Issue 6: Nginx container không start

**Nguyên nhân:** Thiếu file nginx.conf hoặc syntax error  
**Fix:**
```bash
# Kiểm tra file tồn tại
ls -la nginx.conf

# Kiểm tra syntax
nginx -t -c $(pwd)/nginx.conf

# Nếu lỗi, copy lại từ repo
git checkout nginx.conf

# Restart
docker-compose -f docker-compose.dev.yml up -d nginx
```

### Issue 7: Cả Backend và AI WebSocket đều dùng `/ws/chat/*` - xung đột

**Nguyên nhân:** Nginx không thể phân biệt 2 WebSocket cùng path  
**Giải pháp:**
- **Option A:** Chỉ dùng 1 WebSocket tại 1 thời điểm (Backend hoặc AI)
- **Option B:** Dùng IP LAN thay vì ngrok (không cần nginx)
- **Option C:** Đổi AI WebSocket path trong code thành `/ai/ws/chat/*`

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

### Trường hợp 1: Không cần test Google Sign-In (Khuyến nghị dùng ngrok + Nginx)
- [ ] Start Docker services: `docker-compose -f docker-compose.dev.yml up -d`
- [ ] Kiểm tra nginx đang chạy: `docker-compose -f docker-compose.dev.yml ps nginx`
- [ ] Start ngrok tunnel: `ngrok http 8080`
- [ ] Copy ngrok URL (chỉ 1 URL duy nhất)
- [ ] Update `petties_mobile/.env`:
  - `API_BASE_URL=https://xxx.ngrok-free.app`
  - `AI_SERVICE_URL=` (để trống)
  - `WS_URL=wss://xxx.ngrok-free.app`
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test kết nối:
  - [ ] Login (username/password)
  - [ ] API calls (`/api/...`)
  - [ ] AI Service (`/health`, chat)
  - [ ] WebSocket (chat real-time)

### Trường hợp 2: Cần test Google Sign-In (Khuyến nghị dùng IP LAN)
- [ ] Lấy IP LAN: `ipconfig` → ví dụ: `192.168.1.100`
- [ ] Start Docker services: `docker-compose -f docker-compose.dev.yml up -d`
- [ ] Stop nginx container (không cần thiết): `docker-compose -f docker-compose.dev.yml stop nginx`
- [ ] Update `petties_mobile/.env`:
  - `API_BASE_URL=http://192.168.1.100:8080`
  - `AI_SERVICE_URL=http://192.168.1.100:8000`
  - `WS_URL=ws://192.168.1.100:8080`
- [ ] Đảm bảo phone và laptop cùng WiFi
- [ ] Run `flutter clean && flutter pub get && flutter run`
- [ ] Test: Google Sign-In, Login, API calls

### Lưu ý quan trọng
| Tính năng | Ngrok + Nginx | IP LAN | Ngrok Paid |
|-----------|---------------|--------|------------|
| API calls | ✅ | ✅ | ✅ |
| WebSocket | ✅* | ✅ | ✅ |
| Google Sign-In | ❌ | ✅ | ✅ |
| Static URL | ❌ | ✅ | ✅ |
| Số tunnels cần thiết | 1 | 0 | 1-2 |

\* *WebSocket có limitation: Backend và AI cùng dùng `/ws/chat/*`, có thể xung đột nếu dùng cả 2 cùng lúc.*

---

## References

- [Ngrok Documentation](https://ngrok.com/docs)
- [Flutter Network Configuration](https://docs.flutter.dev/development/data-and-backend/networking)
- [Spring Boot CORS Configuration](https://spring.io/guides/gs/rest-service-cors/)

---

*File location: `docs-references/development/NGROK_LOCAL_SETUP.md`*  
*Last updated: 2026-02-06*
