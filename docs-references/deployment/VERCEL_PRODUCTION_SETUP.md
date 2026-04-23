# Vercel Production Environment Variables Setup

Last Updated: 2026-04-21

## Tổng quan

Hướng dẫn cấu hình Environment Variables trên Vercel cho Production environment của frontend `petties-web`.

## Bước 1: Truy cập Vercel Dashboard

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Chọn project **petties-web** (hoặc tên project của bạn)
3. Vào **Settings** → **Environment Variables**

## Bước 2: Thêm Production Environment Variables

Thêm các biến sau và **chọn Production environment**:

### Bảng Environment Variables cần thêm:

| Key | Value | Environment | Mô tả |
|-----|-------|-------------|-------|
| `VITE_API_BASE_URL` | `https://petties.world/api` | **Production** | Backend API base URL |
| `VITE_WS_URL` | `wss://petties.world/ws` | **Production** | Backend WebSocket URL |
| `VITE_AGENT_SERVICE_URL` | `https://petties.world/ai` | **Production** | AI Service HTTP URL (unified proxy path, WebSocket tự động convert sang `wss://petties.world/ws/chat/{sessionId}`) |

### Các biến tùy chọn (nếu cần):

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_APP_NAME` | `Petties` | **Production** |
| `VITE_APP_ENV` | `production` | **Production** |
| `VITE_DEBUG` | `false` | **Production** |

## Bước 3: Cách thêm từng biến

1. Click **Add New** button
2. Nhập **Key**: `VITE_API_BASE_URL`
3. Nhập **Value**: `https://petties.world/api`
4. **Quan trọng**: Chọn **Production** trong dropdown "Environment"
5. Click **Save**
6. Lặp lại cho các biến còn lại

## Bước 4: Xóa các biến không cần thiết

Nếu có các biến sau đang set cho **All Environments** với giá trị localhost, nên xóa hoặc chỉnh lại:

- `VITE_AGENT_SERVICE_URL` = `http://localhost:8000` (nếu có)
- `VITE_API_BASE_URL` = `http://localhost:8080/api` (nếu có)
- `VITE_WS_URL` = `ws://localhost:8080/ws` (nếu có)

**Lưu ý**: Nếu biến đang set cho "All Environments" với giá trị localhost, nó sẽ override Production values. Nên xóa hoặc chỉ set cho Development/Preview.

## Bước 5: Redeploy

Sau khi thêm/sửa Environment Variables:

1. Vào **Deployments** tab
2. Chọn deployment mới nhất (hoặc deployment bạn muốn redeploy)
3. Click **⋯** (three dots) → **Redeploy**
4. Hoặc push commit mới lên `main` branch để trigger auto-deploy

## Bước 6: Kiểm tra

Sau khi deploy xong:

1. Truy cập `https://petties.world`
2. Mở **Browser Console** (F12)
3. Kiểm tra log:

```javascript
🔧 Environment Config: {
  environment: "production",
  hostname: "www.petties.world",
   API_BASE_URL: "https://petties.world/api",
   WS_URL: "wss://petties.world/ws",
   AGENT_SERVICE_URL: "https://petties.world/ai"
}
```

4. Test API call:
   - Thử đăng ký/đăng nhập (sẽ gọi Backend API)
   - Kiểm tra Network tab xem API calls có đúng URL không

5. Test AI Service WebSocket:
   - Mở chat với AI agent
   - Trong Console, bạn sẽ thấy: `🔌 WebSocket URL: wss://petties.world/ws/chat/{sessionId}`
   - Kiểm tra WebSocket connection trong Network tab → WS

## Troubleshooting

### Lỗi: Frontend vẫn gọi `localhost`

**Nguyên nhân**: Environment Variables chưa được set hoặc chưa redeploy

**Giải pháp**:
1. Kiểm tra lại Environment Variables trên Vercel
2. Đảm bảo đã chọn **Production** environment
3. Redeploy lại

### Lỗi: `ERR_CONNECTION_REFUSED`

**Nguyên nhân**: Backend chưa chạy hoặc URL sai

**Giải pháp**:
1. Kiểm tra backend có đang chạy: `curl https://petties.world/api/actuator/health`
2. Kiểm tra AI service: `curl https://petties.world/ai/health`
3. Kiểm tra Environment Variables trên Vercel

### Lỗi: WebSocket không kết nối được

**Có 2 loại WebSocket:**

#### 1. Backend WebSocket (`WS_URL`)
- **URL**: `wss://petties.world/ws`
- **Config**: `VITE_WS_URL` trên Vercel
- **Dùng cho**: Backend real-time features (nếu có)

#### 2. AI Service WebSocket (tự động từ `AGENT_SERVICE_URL`)
- **URL**: `wss://petties.world/ws/chat/{sessionId}`
- **Config**: Tự động convert từ `VITE_AGENT_SERVICE_URL`
- **Dùng cho**: Chat với AI agents
- **Code**: `agentService.ts` → `createChatWebSocket()` tự động convert `https://` → `wss://`

**Giải pháp:**
1. **Backend WebSocket**:
   - Kiểm tra `VITE_WS_URL` = `wss://petties.world/ws` (phải là `wss://` không phải `ws://`)
   - Kiểm tra Nginx config có WebSocket support cho `/ws` trên `petties.world`
   - Test: `wscat -c wss://petties.world/ws`

2. **AI Service WebSocket**:
   - Kiểm tra `VITE_AGENT_SERVICE_URL` = `https://petties.world/ai` (unified proxy path)
   - Kiểm tra Nginx config có WebSocket support cho `/ws/chat/*` trên `petties.world`
   - Code tự động convert: `https://petties.world/ai` → `wss://petties.world/ws/chat/{sessionId}`
   - Test: `wscat -c wss://petties.world/ws/chat/test`
   - Hoặc check browser console khi chat: `🔌 WebSocket URL: wss://petties.world/ws/chat/{sessionId}`

## Tóm tắt cấu hình

### Production Environment Variables:

```bash
VITE_API_BASE_URL=https://petties.world/api
VITE_WS_URL=wss://petties.world/ws
VITE_AGENT_SERVICE_URL=https://petties.world/ai
VITE_APP_NAME=Petties
VITE_APP_ENV=production
VITE_DEBUG=false
```

**Lưu ý về WebSocket:**
- **Backend WebSocket**: Dùng `VITE_WS_URL` → `wss://petties.world/ws`
- **AI Service WebSocket**: Tự động convert từ `VITE_AGENT_SERVICE_URL` → `wss://petties.world/ws/chat/{sessionId}`
  - Không cần biến riêng cho AI Service WS
  - Code tự động convert `https://` → `wss://` trong `createChatWebSocket()`
   - URL unified: Tất cả AI routes qua `/ai/*` và `/ws/chat/*` trên cùng domain `petties.world`

### Local Development (`.env.local`):

```bash
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
VITE_AGENT_SERVICE_URL=http://localhost:8000
```

## Lưu ý quan trọng

1. **Luôn chọn đúng Environment**: Production, Preview, hoặc Development
2. **Redeploy sau khi thay đổi**: Environment Variables chỉ áp dụng khi build, không áp dụng cho deployment đã build
3. **Kiểm tra URL format**: 
   - Production: `https://` và `wss://`
   - Local: `http://` và `ws://`
4. **Priority**: Vercel env vars > Code fallback > Local `.env.local`

