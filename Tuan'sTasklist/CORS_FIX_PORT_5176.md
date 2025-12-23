# Fix CORS Error - Port 5176

## Vấn Đề

Frontend đang chạy trên port **5176** nhưng backend chỉ cho phép:
- `http://localhost:5173`
- `http://localhost:3000`

**Lỗi:**
```
Reject: 'http://localhost:5176' origin is not allowed
```

## Giải Pháp

### ✅ Đã Fix

Đã thêm `http://localhost:5176` vào CORS allowed origins trong `application.properties`:

```properties
# TRƯỚC:
cors.allowed-origins=${CORS_ORIGINS:http://localhost:5173,http://localhost:3000}

# SAU:
cors.allowed-origins=${CORS_ORIGINS:http://localhost:5173,http://localhost:5176,http://localhost:3000}
```

## Cách Apply Fix

### Option 1: Restart Backend (Nếu đang chạy local)

```powershell
# Stop backend (Ctrl+C trong terminal đang chạy backend)
# Sau đó start lại:
cd backend-spring/petties
.\mvnw.cmd spring-boot:run
```

### Option 2: Restart Backend Container (Nếu đang chạy Docker)

```powershell
# Restart backend container
docker-compose -f docker-compose.dev.yml restart backend

# Hoặc rebuild và restart:
docker-compose -f docker-compose.dev.yml up -d --build backend
```

### Option 3: Set Environment Variable (Không cần restart)

Nếu backend đang chạy và bạn không muốn restart, có thể set environment variable:

```powershell
# Windows PowerShell
$env:CORS_ORIGINS="http://localhost:5173,http://localhost:5176,http://localhost:3000"

# Sau đó restart backend để load env var
```

## Kiểm Tra

Sau khi restart backend, test lại:

1. **Mở browser console** (F12)
2. **Thử login** từ frontend
3. **Kiểm tra Network tab** - không còn CORS error

## Alternative: Chạy Frontend trên Port 5173

Nếu không muốn thay đổi backend config, có thể chạy frontend trên port 5173:

```powershell
cd petties-web

# Option 1: Set port trong vite.config.ts
# Hoặc

# Option 2: Dùng flag
npm.cmd run dev -- --port 5173
```

## Tất Cả Ports Được Phép Hiện Tại

- ✅ `http://localhost:5173` (Vite default)
- ✅ `http://localhost:5176` (Vite auto-assigned khi 5173 bận)
- ✅ `http://localhost:3000` (React default)

## Lưu Ý

- **Development**: Có thể cho phép tất cả localhost ports: `http://localhost:*`
- **Production**: Chỉ cho phép domain cụ thể: `https://petties.world`

---

**Ngày fix**: 2025-12-20  
**Status**: ✅ Fixed



