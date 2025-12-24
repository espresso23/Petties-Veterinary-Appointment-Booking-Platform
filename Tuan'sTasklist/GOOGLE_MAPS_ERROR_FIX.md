# Fix Google Maps Error: "This page can't load Google Maps correctly"

## Lỗi Hiển Thị

```
This page can't load Google Maps correctly.
Do you own this website?
```

## Nguyên Nhân

Lỗi này xảy ra khi:
1. ❌ **API key chưa được set** trong `.env.local`
2. ❌ **API key chưa enable các APIs** cần thiết
3. ❌ **API key restrictions** chưa cho phép domain/URL hiện tại
4. ❌ **API key không hợp lệ** hoặc đã bị disable

## Cách Fix

### Bước 1: Kiểm Tra API Key Đã Được Set Chưa

**Mở file `.env.local` trong `petties-web/`:**

```powershell
# Kiểm tra file
cd petties-web
Get-Content .env.local
```

**Đảm bảo có dòng:**
```env
VITE_GOOGLE_MAPS_API_KEY=your-actual-api-key-here
```

**❌ Nếu vẫn là `your-google-maps-api-key-here` → Cần thay bằng API key thật**

### Bước 2: Lấy Google Maps API Key

1. **Truy cập:** https://console.cloud.google.com/google/maps-apis

2. **Tạo hoặc chọn Project**

3. **Enable các APIs:**
   - Vào **APIs & Services** > **Library**
   - Enable các APIs sau:
     - ✅ **Maps JavaScript API**
     - ✅ **Places API**
     - ✅ **Geocoding API**
     - ✅ **Distance Matrix API**

4. **Tạo API Key:**
   - Vào **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **API Key**
   - Copy API key

### Bước 3: Cấu Hình API Key Restrictions

**⚠️ QUAN TRỌNG:** Phải cấu hình restrictions để API key hoạt động!

1. **Click vào API key vừa tạo** (hoặc chọn API key có sẵn)

2. **Application restrictions:**
   - Chọn **HTTP referrers (web sites)**
   - Click **Add an item**

3. **Website restrictions - Thêm các URL sau:**
   ```
   http://localhost:5173/*
   http://127.0.0.1:5173/*
   https://petties.world/*
   https://www.petties.world/*
   https://test.petties.world/*
   ```

4. **API restrictions:**
   - Chọn **Restrict key**
   - Chọn các APIs sau:
     - ✅ Maps JavaScript API
     - ✅ Places API
     - ✅ Geocoding API
     - ✅ Distance Matrix API

5. **Click Save**

### Bước 4: Thêm API Key Vào .env.local

**Mở file `petties-web/.env.local`:**

```env
# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your-actual-key-here
```

**Lưu file**

### Bước 5: Restart Frontend

**Stop frontend hiện tại (Ctrl+C) và start lại:**

```powershell
cd petties-web
npm.cmd run dev
```

**Hoặc nếu đang chạy background:**
```powershell
# Kill Node processes
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Start lại
cd petties-web
npm.cmd run dev
```

### Bước 6: Kiểm Tra Browser Console

**Mở Browser DevTools (F12) > Console tab:**

**✅ Nếu thành công:**
- Không có lỗi Google Maps
- Map hiển thị bình thường

**❌ Nếu vẫn lỗi, kiểm tra:**

1. **Lỗi "RefererNotAllowedMapError":**
   ```
   Google Maps JavaScript API error: RefererNotAllowedMapError
   ```
   → **Fix:** Thêm `http://localhost:5173/*` vào HTTP referrers trong Google Cloud Console

2. **Lỗi "ApiNotActivatedMapError":**
   ```
   Google Maps JavaScript API error: ApiNotActivatedMapError
   ```
   → **Fix:** Enable Maps JavaScript API trong Google Cloud Console

3. **Lỗi "InvalidKeyMapError":**
   ```
   Google Maps JavaScript API error: InvalidKeyMapError
   ```
   → **Fix:** Kiểm tra API key có đúng không, có bị disable không

## Kiểm Tra Nhanh

### 1. Kiểm Tra API Key Có Được Load Không

**Mở Browser DevTools > Network tab:**
- Tìm request đến `maps.googleapis.com`
- Xem URL có chứa `key=...` không
- Nếu `key=` rỗng → API key chưa được set

### 2. Kiểm Tra Environment Variable

**Trong Browser Console, chạy:**
```javascript
console.log('API Key:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
```

**✅ Nếu hiển thị API key → Đã được load**
**❌ Nếu `undefined` hoặc rỗng → Chưa được set**

### 3. Kiểm Tra File .env.local

**Đảm bảo:**
- File nằm đúng vị trí: `petties-web/.env.local`
- Không có khoảng trắng thừa: `VITE_GOOGLE_MAPS_API_KEY=key` (không có space trước/sau `=`)
- API key không có quotes: `VITE_GOOGLE_MAPS_API_KEY=key` (không phải `VITE_GOOGLE_MAPS_API_KEY="key"`)

## Troubleshooting Chi Tiết

### Case 1: API Key Chưa Được Set

**Triệu chứng:**
- Console log: `API Key: undefined`
- Network request: `key=` (rỗng)

**Fix:**
1. Kiểm tra file `.env.local` có đúng tên không
2. Đảm bảo variable name là `VITE_GOOGLE_MAPS_API_KEY` (phải có prefix `VITE_`)
3. Restart frontend sau khi sửa `.env.local`

### Case 2: API Key Restrictions Chưa Đúng

**Triệu chứng:**
- Console error: `RefererNotAllowedMapError`
- API key hợp lệ nhưng bị reject

**Fix:**
1. Vào Google Cloud Console > Credentials
2. Click vào API key
3. Thêm `http://localhost:5173/*` vào HTTP referrers
4. Click Save
5. Đợi 1-2 phút để changes apply
6. Refresh browser

### Case 3: APIs Chưa Được Enable

**Triệu chứng:**
- Console error: `ApiNotActivatedMapError`
- Hoặc lỗi khi load Places API

**Fix:**
1. Vào Google Cloud Console > APIs & Services > Library
2. Enable các APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Distance Matrix API
3. Đợi 1-2 phút
4. Refresh browser

### Case 4: API Key Bị Disable

**Triệu chứng:**
- Console error: `InvalidKeyMapError`
- Hoặc không có response từ Google Maps

**Fix:**
1. Vào Google Cloud Console > Credentials
2. Kiểm tra API key có bị disable không
3. Nếu bị disable, click Enable
4. Hoặc tạo API key mới

## Checklist

Trước khi test lại, đảm bảo:

- [ ] File `.env.local` tồn tại trong `petties-web/`
- [ ] `VITE_GOOGLE_MAPS_API_KEY` có giá trị (không phải placeholder)
- [ ] API key đã được enable trong Google Cloud Console
- [ ] Các APIs đã được enable (Maps, Places, Geocoding, Distance Matrix)
- [ ] HTTP referrers đã thêm `http://localhost:5173/*`
- [ ] API restrictions đã set đúng APIs
- [ ] Frontend đã được restart sau khi sửa `.env.local`
- [ ] Browser đã được refresh (Ctrl+F5 để hard refresh)

## Test Sau Khi Fix

1. **Mở trang tạo/sửa clinic:**
   - URL: `http://localhost:5173/clinic-owner/clinics/new`
   - Test AddressAutocomplete → Xem có suggestions không

2. **Mở trang chi tiết clinic:**
   - URL: `http://localhost:5173/clinic-owner/clinics/:id`
   - Test ClinicMap → Xem có hiển thị map không

3. **Kiểm tra Console:**
   - Không có lỗi Google Maps
   - Network requests đến `maps.googleapis.com` có status 200

## Tóm Tắt

| Vấn Đề | Nguyên Nhân | Fix |
|--------|-------------|-----|
| "This page can't load Google Maps correctly" | API key chưa set hoặc restrictions chưa đúng | Set API key trong `.env.local` + cấu hình restrictions |
| RefererNotAllowedMapError | Domain chưa được thêm vào HTTP referrers | Thêm `http://localhost:5173/*` vào Google Cloud Console |
| ApiNotActivatedMapError | APIs chưa được enable | Enable Maps JavaScript API, Places API, etc. |
| InvalidKeyMapError | API key không hợp lệ hoặc bị disable | Kiểm tra API key, enable lại hoặc tạo mới |

---

**Ngày fix:** 2025-12-20  
**Status:** ✅ Ready - Follow checklist để fix lỗi


