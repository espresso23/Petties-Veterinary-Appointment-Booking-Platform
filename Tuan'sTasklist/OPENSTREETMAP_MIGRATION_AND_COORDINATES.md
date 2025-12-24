# 🗺️ OPENSTREETMAP MIGRATION & COORDINATES IMPLEMENTATION

**Người thực hiện:** Nguyễn Đức Tuấn (DE180807)  
**Ngày thực hiện:** 2025-01-XX  
**Trạng thái:** ✅ Completed

---

## 🎯 Tổng quan

Migration từ Google Maps API sang OpenStreetMap (OSM) do yêu cầu billing của Google Maps, và implement tính năng lưu trữ tọa độ (latitude/longitude) khi người dùng chọn địa chỉ.

---

## ✅ Task List

### 1. 📦 Cài đặt Dependencies
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 5 minutes

**Mô tả:**
- Cài đặt `leaflet` - Map library cho OpenStreetMap
- Cài đặt `react-leaflet` - React wrapper (optional, chưa sử dụng)
- Cài đặt `@types/leaflet` - TypeScript types

**Deliverables:**
- Dependencies đã được cài đặt trong `petties-web/package.json`

**Commands:**
```bash
npm install leaflet react-leaflet
npm install --save-dev @types/leaflet
```

---

### 2. 🗺️ Tạo AddressAutocompleteOSM Component
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 2 hours

**Mô tả:**
- Tạo component autocomplete địa chỉ sử dụng Nominatim API (OpenStreetMap)
- Không cần API key
- Debounce 800ms để tuân thủ rate limit (1 req/second)
- Hiển thị suggestions dropdown với brutalist style
- Map preview khi chọn địa chỉ
- Trả về latitude/longitude qua callback `onPlaceSelect`

**Deliverables:**
- `petties-web/src/components/clinic/AddressAutocompleteOSM.tsx`

**Tính năng:**
- ✅ Autocomplete với Nominatim API
- ✅ Debounce để tránh rate limit
- ✅ Map preview với Leaflet
- ✅ Custom marker brutalist style
- ✅ Trả về lat/lon khi chọn địa chỉ
- ✅ User-Agent header (required by Nominatim)

**API Endpoint:**
```
https://nominatim.openstreetmap.org/search?format=json&q={query}&countrycodes=vn&limit=5
```

---

### 3. 🗺️ Tạo ClinicMapOSM Component
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 1 hour

**Mô tả:**
- Tạo component hiển thị map của clinic sử dụng Leaflet
- Custom marker với brutalist style
- Popup với thông tin clinic
- Attribution tự động

**Deliverables:**
- `petties-web/src/components/clinic/ClinicMapOSM.tsx`

**Tính năng:**
- ✅ Hiển thị clinic location trên map
- ✅ Custom marker brutalist style
- ✅ Popup với thông tin clinic
- ✅ Zoom control
- ✅ Attribution tự động

---

### 4. 🔄 Cập nhật Components để sử dụng OSM
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 30 minutes

**Mô tả:**
- Cập nhật `ClinicForm.tsx` để sử dụng `AddressAutocompleteOSM`
- Cập nhật `ClinicDetailPage.tsx` để sử dụng `ClinicMapOSM`
- Export components mới trong `index.ts`

**Deliverables:**
- `petties-web/src/components/clinic/ClinicForm.tsx` (updated)
- `petties-web/src/pages/clinic-owner/clinics/ClinicDetailPage.tsx` (updated)
- `petties-web/src/components/clinic/index.ts` (updated)

---

### 5. 🎨 Thêm CSS Styling cho Leaflet
**Priority:** Medium  
**Status:** ✅ Completed  
**Estimated Time:** 15 minutes

**Mô tả:**
- Thêm styles cho Leaflet markers
- Popup brutalist style
- Custom marker với border và shadow

**Deliverables:**
- `petties-web/src/index.css` (updated)

**CSS Features:**
- Custom marker styles
- Brutalist popup design
- Border và shadow effects

---

### 6. 📍 Backend: Thêm Latitude/Longitude vào ClinicRequest
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 15 minutes

**Mô tả:**
- Thêm fields `latitude` và `longitude` (BigDecimal) vào `ClinicRequest` DTO
- Optional fields (nullable)

**Deliverables:**
- `backend-spring/petties/src/main/java/com/petties/petties/dto/clinic/ClinicRequest.java` (updated)

**Changes:**
```java
private BigDecimal latitude;
private BigDecimal longitude;
```

---

### 7. 🔧 Backend: Cập nhật ClinicServiceImpl
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 30 minutes

**Mô tả:**
- Cập nhật `createClinic` để ưu tiên lat/lon từ request, chỉ geocode nếu không có
- Cập nhật `updateClinic` tương tự
- Logging để track việc sử dụng coordinates

**Deliverables:**
- `backend-spring/petties/src/main/java/com/petties/petties/service/impl/ClinicServiceImpl.java` (updated)

**Logic:**
1. Nếu request có `latitude` và `longitude` → sử dụng trực tiếp
2. Nếu không có → geocode address bằng Google Maps Service (fallback)
3. Log để track việc sử dụng coordinates

---

### 8. 📍 Frontend: Thêm Latitude/Longitude vào ClinicRequest Interface
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 5 minutes

**Mô tả:**
- Thêm fields `latitude?: number` và `longitude?: number` vào `ClinicRequest` interface

**Deliverables:**
- `petties-web/src/types/clinic.ts` (updated)

---

### 9. 🔄 Frontend: Cập nhật ClinicForm để lưu Coordinates
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 30 minutes

**Mô tả:**
- Cập nhật `formData` initialization để include `latitude` và `longitude`
- Thêm `onPlaceSelect` callback vào `AddressAutocompleteOSM` để nhận và lưu lat/lon
- Khi user chọn địa chỉ từ autocomplete, tự động lưu coordinates vào formData

**Deliverables:**
- `petties-web/src/components/clinic/ClinicForm.tsx` (updated)

**Implementation:**
```typescript
<AddressAutocompleteOSM
  value={formData.address}
  onChange={(address) => handleChange('address', address)}
  onPlaceSelect={(place) => {
    if (place.latitude && place.longitude) {
      setFormData((prev) => ({
        ...prev,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      }))
    }
  }}
  placeholder="Nhập địa chỉ đầy đủ"
/>
```

---

## 📊 So sánh Google Maps vs OpenStreetMap

### Google Maps API
- ❌ Cần API key
- ❌ Cần billing enabled
- ❌ Có giới hạn free tier
- ✅ Autocomplete tốt hơn
- ✅ Geocoding chính xác hơn

### OpenStreetMap (Nominatim)
- ✅ Không cần API key
- ✅ Miễn phí hoàn toàn
- ✅ Không cần billing
- ⚠️ Rate limit: 1 req/second (đã debounce 800ms)
- ⚠️ Cần User-Agent header
- ✅ Attribution tự động

---

## 🔍 Technical Details

### Nominatim API Rate Limit
- **Limit:** 1 request per second
- **Solution:** Debounce 800ms trong `AddressAutocompleteOSM`
- **User-Agent:** Required header `'User-Agent': 'Petties-Veterinary-App'`

### Leaflet Map Tiles
- **Provider:** OpenStreetMap tiles
- **URL:** `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Attribution:** Tự động hiển thị "© OpenStreetMap contributors"

### Coordinates Flow
1. User nhập địa chỉ → Nominatim search
2. User chọn suggestion → Lấy lat/lon từ response
3. `onPlaceSelect` callback → Update formData với lat/lon
4. Submit form → Gửi lat/lon lên backend
5. Backend ưu tiên lat/lon từ request → Lưu vào database

---

## 🐛 Issues & Solutions

### Issue 1: Rate Limit
**Problem:** Nominatim giới hạn 1 req/second  
**Solution:** Debounce 800ms trong search function

### Issue 2: User-Agent Header
**Problem:** Nominatim yêu cầu User-Agent header  
**Solution:** Thêm header `'User-Agent': 'Petties-Veterinary-App'`

### Issue 3: Coordinates không được lưu
**Problem:** Frontend không lưu lat/lon khi chọn địa chỉ  
**Solution:** Thêm `onPlaceSelect` callback và update formData

---

## 📝 Notes

- Components cũ (Google Maps) vẫn được giữ lại để có thể rollback nếu cần
- Backend vẫn có Google Maps Service làm fallback nếu không có coordinates
- OpenStreetMap hoàn toàn miễn phí và không cần billing
- Attribution tự động được hiển thị bởi Leaflet

---

## ✅ Checklist

- [x] Cài đặt dependencies (leaflet, react-leaflet, @types/leaflet)
- [x] Tạo AddressAutocompleteOSM component
- [x] Tạo ClinicMapOSM component
- [x] Cập nhật ClinicForm để sử dụng AddressAutocompleteOSM
- [x] Cập nhật ClinicDetailPage để sử dụng ClinicMapOSM
- [x] Thêm CSS styling cho Leaflet
- [x] Thêm latitude/longitude vào backend ClinicRequest
- [x] Cập nhật ClinicServiceImpl để lưu coordinates
- [x] Thêm latitude/longitude vào frontend ClinicRequest interface
- [x] Cập nhật ClinicForm để lưu coordinates từ autocomplete
- [x] Test tạo clinic với coordinates
- [x] Test update clinic với coordinates
- [x] Test hiển thị map với coordinates

---

## 🚀 Next Steps (Optional)

- [ ] Thêm reverse geocoding (click trên map để chọn địa chỉ)
- [ ] Thêm routing với OSRM (Open Source Routing Machine)
- [ ] Thêm distance calculation với OSRM thay vì Google Maps
- [ ] Optimize map performance với clustering cho nhiều clinics
- [ ] Thêm custom map styles

---

**Last Updated:** 2025-01-XX

