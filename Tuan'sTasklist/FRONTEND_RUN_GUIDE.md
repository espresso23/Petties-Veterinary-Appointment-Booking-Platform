# Hướng Dẫn Chạy Frontend - Clinic Management

## Yêu Cầu Hệ Thống

- **Node.js**: Version 18+ (khuyến nghị 20+)
- **npm**: Đi kèm với Node.js
- **Backend**: Đang chạy tại `http://localhost:8080` (Docker hoặc local)

---

## Bước 1: Kiểm Tra Node.js

```bash
node --version
npm --version
```

Nếu chưa có Node.js, tải từ: https://nodejs.org/

---

## Bước 2: Cài Đặt Dependencies

```bash
cd petties-web
npm install
```

**Lưu ý**: Lần đầu tiên có thể mất 2-5 phút để download packages.

---

## Bước 3: Tạo File Environment Variables

Tạo file `.env.local` trong thư mục `petties-web/`:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8080/api

# Google Maps API Key (Optional - chỉ cần nếu muốn dùng Google Maps features)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Lưu ý**:
- Nếu không có Google Maps API key, AddressAutocomplete và ClinicMap sẽ không hoạt động
- Backend vẫn có thể geocode address tự động khi create/update clinic

---

## Bước 4: Chạy Development Server

```bash
cd petties-web
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:5173**

Bạn sẽ thấy output như:
```
  VITE v7.2.5  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Bước 5: Test Frontend

### 1. Mở Browser
Truy cập: `http://localhost:5173`

### 2. Login
- Navigate đến `/auth/login`
- Login với CLINIC_OWNER account:
  - Username: `owner1`
  - Password: `owner123`
  - (Hoặc account CLINIC_OWNER khác nếu đã tạo)

### 3. Navigate đến Clinic Management
- Sau khi login, bạn sẽ ở dashboard
- Click vào "QUẢN LÝ PHÒNG KHÁM" trong sidebar
- Hoặc truy cập trực tiếp: `http://localhost:5173/clinic-owner/clinics`

### 4. Test Features
- **Create Clinic**: Click "CREATE CLINIC" → Fill form → Submit
- **View List**: Xem danh sách clinics
- **Edit Clinic**: Click vào clinic → Click "EDIT"
- **Delete Clinic**: Click vào clinic → Click "DELETE"
- **Search**: Nhập tên clinic vào search box
- **Filter**: Chọn status từ dropdown

---

## Troubleshooting

### Lỗi: "Cannot find module" hoặc "Module not found"
**Giải pháp**: Chạy lại `npm install`

### Lỗi: "Port 5173 already in use"
**Giải pháp**: 
- Đóng process đang dùng port 5173
- Hoặc thay đổi port trong `vite.config.ts`

### Lỗi: "Failed to fetch" khi gọi API
**Nguyên nhân**: Backend chưa chạy hoặc không đúng URL
**Giải pháp**:
1. Kiểm tra backend đang chạy: `http://localhost:8080/api/actuator/health`
2. Kiểm tra `VITE_API_BASE_URL` trong `.env.local`
3. Đảm bảo backend đã start (Docker hoặc local)

### Lỗi: "Google Maps API key not found"
**Nguyên nhân**: Chưa set `VITE_GOOGLE_MAPS_API_KEY`
**Giải pháp**:
- Nếu không cần Google Maps ngay: Bỏ qua, backend vẫn geocode được
- Nếu cần: Tạo API key từ Google Cloud Console và thêm vào `.env.local`

### Lỗi: "401 Unauthorized" khi gọi API
**Nguyên nhân**: Chưa login hoặc token expired
**Giải pháp**:
1. Login lại
2. Kiểm tra token trong localStorage (DevTools → Application → Local Storage)

### Lỗi: "CORS error"
**Nguyên nhân**: Backend chưa config CORS đúng
**Giải pháp**: 
- Kiểm tra `SecurityConfig.java` đã permit origin `http://localhost:5173`
- Hoặc chạy frontend trên port khác và update CORS config

---

## Scripts Available

| Script | Command | Mô tả |
|--------|---------|-------|
| `npm run dev` | Start dev server | Chạy development server với hot-reload |
| `npm run build` | Build production | Build production bundle |
| `npm run preview` | Preview build | Preview production build |
| `npm run lint` | Lint code | Check code quality |

---

## Development Workflow

### 1. Start Backend (Terminal 1)
```bash
# Option 1: Docker
docker-compose -f docker-compose.dev.yml up -d backend

# Option 2: Local
cd backend-spring/petties
.\mvnw.cmd spring-boot:run
```

### 2. Start Frontend (Terminal 2)
```bash
cd petties-web
npm run dev
```

### 3. Open Browser
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080/api

---

## File Structure

```
petties-web/
├── .env.local              ← Tạo file này (không commit vào git)
├── package.json
├── vite.config.ts
├── src/
│   ├── components/
│   │   └── clinic/         ← Clinic components
│   ├── pages/
│   │   └── clinic-owner/
│   │       └── clinics/    ← Clinic pages
│   ├── services/
│   │   └── api/
│   │       └── clinicService.ts
│   ├── store/
│   │   └── clinicStore.ts
│   └── types/
│       └── clinic.ts
```

---

## Quick Start Commands

```bash
# 1. Install dependencies (chỉ cần chạy 1 lần)
cd petties-web
npm install

# 2. Tạo .env.local
echo "VITE_API_BASE_URL=http://localhost:8080/api" > .env.local

# 3. Start dev server
npm run dev

# 4. Open browser
# http://localhost:5173
```

---

## Environment Variables Reference

| Variable | Required | Default | Mô tả |
|----------|----------|---------|-------|
| `VITE_API_BASE_URL` | ✅ Yes | `http://localhost:8080/api` | Backend API URL |
| `VITE_GOOGLE_MAPS_API_KEY` | ❌ No | - | Google Maps API key (cho autocomplete & map) |

---

## Next Steps Sau Khi Chạy

1. **Test Create Clinic**:
   - Login → Navigate to Clinics → Create Clinic
   - Fill form → Submit
   - Kiểm tra clinic được tạo trong database

2. **Test Google Maps** (nếu có API key):
   - Address autocomplete trong form
   - Map display trong detail page
   - Distance calculation

3. **Test CRUD**:
   - Create, Read, Update, Delete
   - Search, Filter, Pagination

---

**Last Updated**: 2025-12-20  
**Author**: Auto (AI Assistant)

