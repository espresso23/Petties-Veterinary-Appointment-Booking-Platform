# Google Maps API Key Setup Guide

## Vị Trí Đặt API Key

### 1. File Environment Variables (Khuyến nghị)

**Tạo file `.env.local` trong thư mục `petties-web/`:**

```bash
cd petties-web
copy .env.example .env.local
```

**Nội dung file `.env.local`:**
```env
# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### 2. Cách Lấy Google Maps API Key

1. **Truy cập Google Cloud Console:**
   - https://console.cloud.google.com/google/maps-apis

2. **Tạo Project mới hoặc chọn Project có sẵn**

3. **Enable các APIs cần thiết:**
   - ✅ **Maps JavaScript API** (cho ClinicMap component)
   - ✅ **Places API** (cho AddressAutocomplete component)
   - ✅ **Geocoding API** (cho chuyển đổi địa chỉ → tọa độ)
   - ✅ **Distance Matrix API** (cho DistanceCalculator component)

4. **Tạo API Key:**
   - Vào **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **API Key**
   - Copy API key

5. **Cấu hình API Key Restrictions (Production):**
   - **Application restrictions:** HTTP referrers
   - **Website restrictions:** 
     - `http://localhost:5173/*` (Development)
     - `https://petties.world/*` (Production)
     - `https://test.petties.world/*` (Test)
   - **API restrictions:** Chỉ enable các APIs cần thiết (Maps, Places, Geocoding, Distance Matrix)

### 3. Cách Sử Dụng Trong Code

API key được sử dụng trong các component sau:

#### a) AddressAutocomplete.tsx
```typescript
// Line 36
script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places`
```

#### b) ClinicMap.tsx
```typescript
// Line 25
script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`
```

#### c) DistanceCalculator.tsx
```typescript
// Sử dụng API key qua env.GOOGLE_MAPS_API_KEY từ env.ts
```

### 4. Cấu Hình Trong env.ts

File `src/config/env.ts` đã được cập nhật để export Google Maps API key:

```typescript
export const env = {
  // ... other configs
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
}
```

**Lưu ý:** Các component hiện tại vẫn dùng trực tiếp `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`. Có thể refactor để dùng `env.GOOGLE_MAPS_API_KEY` để quản lý tập trung hơn.

## Environment Variables Priority

Vite sẽ load environment variables theo thứ tự:

1. `.env.local` (local overrides, **không commit vào Git**)
2. `.env.development` (development mode)
3. `.env.production` (production mode)
4. `.env` (default, **không commit vào Git**)

**Khuyến nghị:** Dùng `.env.local` cho local development.

## Production Setup (Vercel)

### Vercel Environment Variables

1. Vào **Vercel Dashboard** > **Project Settings** > **Environment Variables**

2. Thêm biến:
   ```
   Name: VITE_GOOGLE_MAPS_API_KEY
   Value: your-production-api-key
   Environment: Production, Preview, Development
   ```

3. **Redeploy** để apply changes

### API Key Restrictions cho Production

Trong Google Cloud Console, cấu hình API key restrictions:

**HTTP referrers:**
```
https://petties.world/*
https://www.petties.world/*
https://test.petties.world/*
```

**API restrictions:**
- Maps JavaScript API
- Places API
- Geocoding API
- Distance Matrix API

## Kiểm Tra API Key Hoạt Động

### 1. Kiểm Tra Console Logs

Mở Browser DevTools > Console, nếu thấy lỗi:
```
Google Maps JavaScript API error: RefererNotAllowedMapError
```
→ API key restrictions chưa đúng

### 2. Kiểm Tra Network Tab

Trong Network tab, tìm request đến `maps.googleapis.com`:
- ✅ Status 200: API key hợp lệ
- ❌ Status 403: API key bị reject (check restrictions)
- ❌ Status 400: API key không hợp lệ

### 3. Test Components

1. **AddressAutocomplete:**
   - Vào trang tạo/sửa clinic
   - Nhập địa chỉ → Xem có autocomplete suggestions không

2. **ClinicMap:**
   - Vào trang chi tiết clinic
   - Xem có hiển thị map không

3. **DistanceCalculator:**
   - Tính khoảng cách giữa 2 clinics
   - Xem có trả về kết quả không

## Troubleshooting

### Lỗi: "Google Maps JavaScript API error: RefererNotAllowedMapError"

**Nguyên nhân:** API key restrictions không cho phép domain hiện tại

**Giải pháp:**
1. Vào Google Cloud Console > APIs & Services > Credentials
2. Click vào API key
3. Thêm domain vào **HTTP referrers**:
   - `http://localhost:5173/*` (Development)
   - `https://petties.world/*` (Production)

### Lỗi: "This API project is not authorized to use this API"

**Nguyên nhân:** Chưa enable API trong project

**Giải pháp:**
1. Vào Google Cloud Console > APIs & Services > Library
2. Enable các APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Distance Matrix API

### Lỗi: "You have exceeded your quota"

**Nguyên nhân:** Vượt quá quota miễn phí ($200 credit/tháng)

**Giải pháp:**
1. Kiểm tra usage trong Google Cloud Console
2. Set up billing alerts
3. Optimize API calls (cache results, debounce requests)

## Billing & Quotas

### Free Tier (Google Maps Platform)

- **$200 credit/tháng** (tương đương ~28,000 map loads)
- Sau khi hết credit, sẽ tính phí theo usage

### Pricing (sau khi hết free credit)

- **Maps JavaScript API:** $7 per 1,000 requests
- **Places API:** $17 per 1,000 requests
- **Geocoding API:** $5 per 1,000 requests
- **Distance Matrix API:** $5 per 1,000 requests

### Best Practices để Tiết Kiệm Chi Phí

1. **Cache map results** (không reload map mỗi lần render)
2. **Debounce autocomplete requests** (đợi user ngừng gõ 300ms)
3. **Lazy load maps** (chỉ load khi user scroll đến)
4. **Set up billing alerts** trong Google Cloud Console

## Tóm Tắt

| Item | Location | File |
|------|----------|------|
| **Environment Variable** | `petties-web/.env.local` | `.env.local` |
| **Example Template** | `petties-web/.env.example` | `.env.example` |
| **Config Export** | `petties-web/src/config/env.ts` | `env.ts` |
| **Usage** | `AddressAutocomplete.tsx`, `ClinicMap.tsx`, `DistanceCalculator.tsx` | Component files |

---

**Ngày tạo:** 2025-12-20  
**Status:** ✅ Ready - Chỉ cần tạo `.env.local` và thêm API key


