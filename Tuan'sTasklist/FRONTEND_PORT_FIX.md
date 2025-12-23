# Fix Frontend Port - Chạy trên Port 5173

## Vấn Đề

Frontend đang chạy trên port **5176** thay vì **5173** như trong tài liệu `DEVELOPMENT_WORKFLOW.md`.

**Nguyên nhân:** Port 5173 đã bị chiếm bởi process khác, Vite tự động chuyển sang port tiếp theo (5176).

## Giải Pháp

### ✅ Đã Fix

Đã cập nhật `vite.config.ts` để:
1. **Force port 5173** (theo tài liệu)
2. **Strict port mode** - Nếu port bị chiếm, sẽ báo lỗi thay vì tự động chuyển

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Báo lỗi nếu port bị chiếm
  },
})
```

## Cách Xử Lý Port 5173 Bị Chiếm

### Option 1: Kill Process Đang Dùng Port 5173 (Khuyến nghị)

```powershell
# Tìm process đang dùng port 5173
netstat -ano | findstr :5173

# Kill process (thay <PID> bằng số từ netstat)
taskkill /PID <PID> /F

# Hoặc kill tất cả Node processes (cẩn thận!)
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
```

### Option 2: Tìm và Kill Process Cụ Thể

```powershell
# Xem process nào đang dùng port 5173
Get-NetTCPConnection -LocalPort 5173 | Select-Object OwningProcess
$pid = (Get-NetTCPConnection -LocalPort 5173).OwningProcess
Get-Process -Id $pid

# Kill process
Stop-Process -Id $pid -Force
```

### Option 3: Restart Frontend (Nếu đang chạy nhiều instance)

```powershell
# Stop tất cả frontend instances
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Start lại
cd petties-web
npm.cmd run dev
```

## Kiểm Tra Sau Khi Fix

1. **Start frontend:**
   ```powershell
   cd petties-web
   npm.cmd run dev
   ```

2. **Kiểm tra output:**
   ```
   VITE v7.2.5  ready in 500 ms
   
   ➜  Local:   http://localhost:5173/  ← Phải là 5173
   ➜  Network: use --host to expose
   ```

3. **Mở browser:**
   - URL: `http://localhost:5173` ✅
   - Không còn CORS error (vì backend đã cho phép 5173)

## Lưu Ý

### Nếu Vẫn Bị Lỗi "Port 5173 is already in use"

**Với `strictPort: true`, Vite sẽ báo lỗi:**
```
Error: Port 5173 is in use, trying another one...
```

**Giải pháp:**
1. Kill process đang dùng port 5173 (xem Option 1)
2. Hoặc tạm thời set `strictPort: false` để Vite tự chọn port khác

### Nếu Muốn Dùng Port Khác

Nếu muốn dùng port khác (ví dụ 3000), cần:
1. Update `vite.config.ts`:
   ```typescript
   server: {
     port: 3000,
     strictPort: true,
   }
   ```

2. Update backend CORS trong `application.properties`:
   ```properties
   cors.allowed-origins=${CORS_ORIGINS:http://localhost:5173,http://localhost:3000}
   ```

3. Restart backend để apply CORS changes

## Tóm Tắt

| Item | Trước | Sau |
|------|-------|-----|
| Port | 5176 (auto) | 5173 (fixed) |
| Config | Không có | `strictPort: true` |
| CORS | Cần thêm 5176 | Chỉ cần 5173 |
| Tài liệu | Không match | ✅ Match với DEVELOPMENT_WORKFLOW.md |

---

**Ngày fix**: 2025-12-20  
**Status**: ✅ Fixed - Frontend sẽ chạy trên port 5173 như tài liệu



