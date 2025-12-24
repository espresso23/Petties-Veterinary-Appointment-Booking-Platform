# 📋 CLINIC MANAGEMENT - Task List

**Người thực hiện:** Nguyễn Đức Tuấn (DE180807)  
**Ngày bắt đầu:** 2025-12-18  
**Trạng thái:** 📝 Planning Phase

---

## 🎯 Tổng quan

Task list này bao gồm việc xây dựng toàn bộ hệ thống quản lý Clinic (Phòng khám thú y) từ Backend đến Frontend, bao gồm tích hợp Google Maps API.

---

## ✅ Task List

### 1. 📦 Tạo Model Clinic
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 2 hours

**Mô tả:**
- Tạo Entity `Clinic` theo ERD specification
- Tạo các Enum classes liên quan (ClinicStatus, AppointmentType)
- Tạo JPA relationships với User, ClinicStaff, Service, Booking
- Implement soft delete với `@SQLDelete` và `@Where`

clinic_id	UUID	PK	Primary identifier
owner_id	UUID	FK -> USER, NOT NULL	Clinic owner
name	VARCHAR(200)	NOT NULL	Clinic name
description	TEXT	NULLABLE	Description
address	VARCHAR(500)	NOT NULL	Full address
phone	VARCHAR(20)	NOT NULL	Contact phone
email	VARCHAR(100)	NULLABLE	Contact email
latitude	DECIMAL(10,8)	NULLABLE	GPS latitude
longitude	DECIMAL(11,8)	NULLABLE	GPS longitude
license_number	VARCHAR(50)	NULLABLE	Business license
license_document	VARCHAR(500)	NULLABLE	License doc URL
operating_hours	JSON	NULLABLE	Weekly schedule
status	ENUM	NOT NULL, DEFAULT 'PENDING'	PENDING, APPROVED, REJECTED, SUSPENDED
rejection_reason	TEXT	NULLABLE	If rejected
rating_avg	DECIMAL(2,1)	DEFAULT 0	Average rating 1-5
rating_count	INTEGER	DEFAULT 0	Total ratings
approved_at	TIMESTAMP	NULLABLE	Approval time
created_at	TIMESTAMP	NOT NULL	Creation time
updated_at	TIMESTAMP	NULLABLE	Last update
deleted_at	TIMESTAMP	NULLABLE	Soft delete

**Deliverables:**
- `Clinic.java` entity
- `ClinicStatus.java` enum
-ClinicStaff nữa
Attribute	Type	Constraints	Description
staff_id	UUID	PK	Primary identifier
clinic_id	UUID	FK -> CLINIC, NOT NULL	Clinic reference
user_id	UUID	FK -> USER, NOT NULL	Staff user
role	ENUM	NOT NULL	VET, CLINIC_MANAGER
specialization	VARCHAR(100)	NULLABLE	Vet specialty (Noi khoa, Ngoai khoa, etc.)
license_number	VARCHAR(50)	NULLABLE	Professional license
license_document	VARCHAR(500)	NULLABLE	License doc URL
status	ENUM	NOT NULL, DEFAULT 'ACTIVE'	ACTIVE, INACTIVE
joined_at	TIMESTAMP	NOT NULL	When joined clinic
left_at	TIMESTAMP	NULLABLE	When left clinic
created_at	TIMESTAMP	NOT NULL	Creation time
updated_at	TIMESTAMP	NULLABLE	Last update
- `ClinicImage.java` entity (nếu cần)
- Database migration script (nếu cần)

---

### 2. 🔧 Tạo Backend Service liên quan của Clinic
**Priority:** High  
**Status:** ✅ Completed  
**Estimated Time:** 4 hours

**Mô tả:**
- Tạo `ClinicRepository` với custom queries
- Tạo `ClinicService` với business logic
- Tạo `ClinicController` với REST endpoints
- Tạo DTOs (Request/Response)
- Implement validation
- Implement exception handling
- Tích hợp Google Maps Geocoding API

**Endpoints cần implement:**
```
GET    /api/clinics                    - Lấy danh sách clinic (với filters)
GET    /api/clinics/{id}               - Chi tiết clinic
POST   /api/clinics                    - Tạo clinic mới (CLINIC_OWNER)
PUT    /api/clinics/{id}               - Cập nhật clinic (CLINIC_OWNER)
DELETE /api/clinics/{id}               - Xóa clinic (soft delete)
GET    /api/clinics/search             - Tìm kiếm clinic (name, address)
GET    /api/clinics/nearby              - Tìm clinic gần đây (lat, lng, radius)
POST   /api/clinics/{id}/geocode       - Geocode address → lat/lng
GET    /api/clinics/{id}/distance      - Tính khoảng cách từ điểm A đến clinic
```

**Deliverables:**
- `ClinicRepository.java`
- `ClinicService.java` và `ClinicServiceImpl.java`
- `ClinicController.java`
- DTOs: `ClinicRequest.java`, `ClinicResponse.java`, `ClinicListResponse.java`
- `GoogleMapsService.java` (Geocoding, Distance Calculation)
- Swagger documentation

---

### 3. 🧪 Tạo Testing Clinic
**Priority:** High  
**Status:** ⏳ Pending  
**Estimated Time:** 3 hours

**Mô tả:**
- Unit tests cho `ClinicService`
- Integration tests cho `ClinicController`
- Test Google Maps integration (mock)
- Test validation
- Test exception handling
- Test authorization (role-based access)

**Deliverables:**
- `ClinicServiceTest.java` (Unit tests)
- `ClinicControllerTest.java` (Integration tests)
- `GoogleMapsServiceTest.java` (Mock tests)
- Test coverage ≥ 80%

---

### 4. 🎨 Tạo Web Frontend
**Priority:** High  
**Status:** ⏳ Pending  
**Estimated Time:** 6 hours

**Mô tả:**
- Tạo Clinic Management pages cho CLINIC_OWNER
- Tạo Clinic List/Detail pages
- Tích hợp Google Maps (hiển thị marker, autocomplete)
- Implement form validation
- Implement error handling
- Follow Neobrutalism design system

**Pages cần tạo:**
- `/clinic-owner/clinics` - Danh sách clinic của owner
- `/clinic-owner/clinics/new` - Tạo clinic mới
- `/clinic-owner/clinics/{id}/edit` - Chỉnh sửa clinic
- `/clinic-owner/clinics/{id}` - Chi tiết clinic
- `/admin/clinics` - Admin quản lý tất cả clinic (approve/reject)

**Components cần tạo:**
- `ClinicList.tsx` - Danh sách clinic với filters
- `ClinicForm.tsx` - Form tạo/sửa clinic
- `ClinicDetail.tsx` - Chi tiết clinic
- `ClinicMap.tsx` - Google Maps component với marker
- `AddressAutocomplete.tsx` - Google Places Autocomplete
- `DistanceCalculator.tsx` - Hiển thị khoảng cách

**Deliverables:**
- React components với TypeScript
- Zustand store cho clinic state management
- API service integration
- Google Maps integration
- Responsive design (Neobrutalism)

---

### 5. 🗺️ Tích hợp Google Maps API
**Priority:** High  
**Status:** ⏳ Pending  
**Estimated Time:** 4 hours

**Mô tả:**
- Geocoding: Convert address → lat/lng
- Reverse Geocoding: Convert lat/lng → address
- Hiển thị marker trên map
- Distance calculation (Haversine formula hoặc Google Distance Matrix API)
- Places Autocomplete cho address input
- Map styling theo design system

**APIs sử dụng:**
- Google Maps Geocoding API
- Google Places API (Autocomplete)
- Google Distance Matrix API (optional)
- Google Maps JavaScript API

**Deliverables:**
- `GoogleMapsService.java` (Backend - Geocoding)
- `useGoogleMaps.ts` hook (Frontend)
- `MapComponent.tsx` với marker support
- `AddressAutocomplete.tsx` component
- Environment variables configuration
- API key setup guide

---

## 📊 Tổng thời gian ước tính

| Task | Time Estimate |
|------|---------------|
| Model Clinic | 2 hours |
| Backend Service | 4 hours |
| Testing | 3 hours |
| Web Frontend | 6 hours |
| Google Maps Integration | 4 hours |
| **Tổng cộng** | **19 hours** |

---

## 🔗 Dependencies

### Backend Dependencies
- Spring Boot 4.0.0 ✅
- Spring Data JPA ✅
- Spring Security 6.x ✅
- PostgreSQL 16 ✅
- Jackson (JSON) ✅
- Validation ✅
- **Google Maps Java Client** (cần thêm)

### Frontend Dependencies
- React 19 ✅
- TypeScript ✅
- Tailwind CSS v4 ✅
- Zustand ✅
- Axios ✅
- **@react-google-maps/api** (cần thêm)
- **@googlemaps/js-api-loader** (cần thêm)

---

## 📝 Notes

1. **Google Maps API Key:**
   - Cần tạo API key từ Google Cloud Console
   - Enable: Geocoding API, Places API, Maps JavaScript API
   - Restrict API key cho production

2. **Design System:**
   - Follow Neobrutalism design (no rounded corners, thick borders)
   - Map styling theo `GOOGLE_MAPS_STYLING.md`

3. **Security:**
   - CLINIC_OWNER chỉ có thể quản lý clinic của mình
   - ADMIN có thể approve/reject clinic
   - Validate input data

4. **Performance:**
   - Cache geocoding results
   - Lazy load map component
   - Optimize database queries

---

## ✅ Checklist

- [x] Task 1: Model Clinic ✅
- [x] Task 2: Backend Service ✅
- [ ] Task 3: Testing
- [ ] Task 4: Web Frontend
- [ ] Task 5: Google Maps Integration
- [ ] Code review
- [ ] Update documentation
- [ ] Deploy to test environment

---

**Last Updated:** 2025-12-18


