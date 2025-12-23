# Quick Start - Frontend Clinic Management

## Các Bước Chạy Frontend

### 1. Cài Đặt Dependencies (Đã hoàn thành ✅)
```bash
cd petties-web
npm install
```

### 2. Tạo Environment File (Đã hoàn thành ✅)
File `.env.local` đã được tạo với:
```env
VITE_API_BASE_URL=http://localhost:8080/api
```

### 3. Đảm Bảo Backend Đang Chạy
```bash
# Kiểm tra backend
curl http://localhost:8080/api/actuator/health

# Hoặc nếu chưa chạy, start backend:
docker-compose -f docker-compose.dev.yml up -d backend
```

### 4. Chạy Frontend
```bash
cd petties-web
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:5173**

---

## Test Flow

1. **Mở Browser**: http://localhost:5173

2. **Login**:
   - Navigate đến: http://localhost:5173/auth/login
   - Username: `owner1`
   - Password: `owner123`
   - (Hoặc account CLINIC_OWNER khác)

3. **Vào Clinic Management**:
   - Click "QUẢN LÝ PHÒNG KHÁM" trong sidebar
   - Hoặc truy cập: http://localhost:5173/clinic-owner/clinics

4. **Test Features**:
   - ✅ Create Clinic
   - ✅ View List
   - ✅ Edit Clinic
   - ✅ Delete Clinic
   - ✅ Search & Filter

---

## Troubleshooting

### Backend không kết nối được
- Kiểm tra backend đang chạy: `http://localhost:8080/api/actuator/health`
- Kiểm tra `VITE_API_BASE_URL` trong `.env.local`

### Port 5173 đã được sử dụng
- Đóng process khác đang dùng port 5173
- Hoặc thay đổi port trong `vite.config.ts`

### Lỗi CORS
- Đảm bảo backend đã config CORS cho `http://localhost:5173`

---

**Ready to run!** 🚀

