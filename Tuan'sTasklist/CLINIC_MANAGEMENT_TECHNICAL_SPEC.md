# 🔧 CLINIC MANAGEMENT - Technical Specification

**Người thực hiện:** Nguyễn Đức Tuấn (DE180807)  
**Ngày:** 2025-12-18  
**Version:** 1.0.0

---

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Backend API Specification](#backend-api-specification)
3. [Frontend Component Specification](#frontend-component-specification)
4. [Google Maps Integration](#google-maps-integration)
5. [Testing Strategy](#testing-strategy)
6. [Security & Authorization](#security--authorization)

---

## 1. Database Schema

### 1.1 Clinic Entity

```java
@Entity
@Table(name = "clinics")
@SQLDelete(sql = "UPDATE clinics SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ?")
@Where(clause = "deleted_at IS NULL")
public class Clinic {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "clinic_id")
    private UUID clinicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "license_number", length = 50)
    private String licenseNumber;

    @Column(name = "license_document", length = 500)
    private String licenseDocument; // URL to document

    @Column(name = "operating_hours", columnDefinition = "JSONB")
    @Type(JsonType.class)
    private Map<String, OperatingHours> operatingHours;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ClinicStatus status = ClinicStatus.PENDING;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "rating_avg", precision = 2, scale = 1)
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(name = "rating_count")
    private Integer ratingCount = 0;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // Relationships
    @OneToMany(mappedBy = "clinic", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClinicImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "clinic")
    private List<ClinicStaff> staff = new ArrayList<>();

    @OneToMany(mappedBy = "clinic")
    private List<Service> services = new ArrayList<>();

    @OneToMany(mappedBy = "clinic")
    private List<Booking> bookings = new ArrayList<>();
}
```

### 1.2 ClinicStatus Enum

```java
public enum ClinicStatus {
    PENDING,      // Chờ duyệt
    APPROVED,     // Đã duyệt
    REJECTED,     // Từ chối
    SUSPENDED     // Tạm ngưng
}
```

### 1.3 ClinicStaff Entity

```java
@Entity
@Table(name = "clinic_staff")
@SQLDelete(sql = "UPDATE clinic_staff SET status = 'INACTIVE', left_at = CURRENT_TIMESTAMP WHERE staff_id = ?")
public class ClinicStaff {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "staff_id")
    private UUID staffId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StaffRole role; // VET, CLINIC_MANAGER

    @Column(length = 100)
    private String specialization; // Vet specialty: Noi khoa, Ngoai khoa, etc.

    @Column(name = "license_number", length = 50)
    private String licenseNumber;

    @Column(name = "license_document", length = 500)
    private String licenseDocument; // URL to document

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StaffStatus status = StaffStatus.ACTIVE;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
```

**Unique Constraint:** `(clinic_id, user_id)` - One user can only be staff at one clinic

### 1.4 ClinicImage Entity

```java
@Entity
@Table(name = "clinic_images")
public class ClinicImage {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "image_id")
    private UUID imageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(length = 200)
    private String caption;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "is_primary")
    private Boolean isPrimary = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

### 1.5 StaffRole Enum

```java
public enum StaffRole {
    VET,              // Bác sĩ thú y
    CLINIC_MANAGER    // Quản lý phòng khám
}
```

### 1.6 StaffStatus Enum

```java
public enum StaffStatus {
    ACTIVE,    // Đang làm việc
    INACTIVE   // Đã nghỉ việc
}
```

### 1.7 OperatingHours (Embedded)

```java
@Embeddable
public class OperatingHours {
    private String dayOfWeek; // MONDAY, TUESDAY, etc.
    private LocalTime openTime;
    private LocalTime closeTime;
    private Boolean isClosed;
}
```

**Note:** OperatingHours được lưu dưới dạng JSON trong database, structure:
```json
{
  "MONDAY": {
    "openTime": "08:00",
    "closeTime": "17:00",
    "isClosed": false
  },
  "TUESDAY": {
    "openTime": "08:00",
    "closeTime": "17:00",
    "isClosed": false
  }
}
```

---

## 2. Backend API Specification

### 2.1 Endpoints

#### 2.1.1 GET /api/clinics
**Description:** Lấy danh sách clinic với filters và pagination

**Query Parameters:**
- `page` (int, default: 0)
- `size` (int, default: 20)
- `status` (ClinicStatus, optional)
- `name` (String, optional) - Search by name
- `city` (String, optional) - Filter by city
- `latitude` (BigDecimal, optional) - For nearby search
- `longitude` (BigDecimal, optional) - For nearby search
- `radius` (double, optional, default: 10km) - Radius in km

**Response:**
```json
{
  "content": [
    {
      "clinicId": "uuid",
      "name": "Phòng khám thú y ABC",
      "address": "123 Đường XYZ, Quận 1, TP.HCM",
      "phone": "0901234567",
      "latitude": 10.762622,
      "longitude": 106.660172,
      "status": "APPROVED",
      "ratingAvg": 4.5,
      "ratingCount": 120,
      "distance": 2.5
    }
  ],
  "totalElements": 50,
  "totalPages": 3,
  "currentPage": 0
}
```

#### 2.1.2 GET /api/clinics/{id}
**Description:** Lấy chi tiết clinic

**Response:**
```json
{
  "clinicId": "uuid",
  "owner": {
    "userId": "uuid",
    "fullName": "Nguyễn Văn A"
  },
  "name": "Phòng khám thú y ABC",
  "description": "Phòng khám chuyên về chó mèo...",
  "address": "123 Đường XYZ, Quận 1, TP.HCM",
  "phone": "0901234567",
  "email": "contact@clinic.com",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "operatingHours": {
    "MONDAY": {"openTime": "08:00", "closeTime": "17:00", "isClosed": false},
    "TUESDAY": {"openTime": "08:00", "closeTime": "17:00", "isClosed": false}
  },
  "status": "APPROVED",
  "ratingAvg": 4.5,
  "ratingCount": 120,
  "images": ["url1", "url2"],
  "services": [...],
  "createdAt": "2025-12-18T10:00:00"
}
```

#### 2.1.3 POST /api/clinics
**Description:** Tạo clinic mới (CLINIC_OWNER only)

**Request Body:**
```json
{
  "name": "Phòng khám thú y ABC",
  "description": "Mô tả phòng khám",
  "address": "123 Đường XYZ, Quận 1, TP.HCM",
  "phone": "0901234567",
  "email": "contact@clinic.com",
  "licenseNumber": "123456789",
  "operatingHours": {
    "MONDAY": {"openTime": "08:00", "closeTime": "17:00", "isClosed": false}
  }
}
```

**Response:** 201 Created với ClinicResponse

#### 2.1.4 PUT /api/clinics/{id}
**Description:** Cập nhật clinic (CLINIC_OWNER chỉ có thể update clinic của mình)

**Request Body:** Same as POST

**Response:** 200 OK với ClinicResponse

#### 2.1.5 DELETE /api/clinics/{id}
**Description:** Xóa clinic (soft delete)

**Response:** 204 No Content

#### 2.1.6 GET /api/clinics/nearby
**Description:** Tìm clinic gần đây

**Query Parameters:**
- `latitude` (BigDecimal, required)
- `longitude` (BigDecimal, required)
- `radius` (double, default: 10km)
- `page` (int, default: 0)
- `size` (int, default: 20)

**Response:** Same as GET /api/clinics

#### 2.1.7 POST /api/clinics/{id}/geocode
**Description:** Geocode address → lat/lng (Backend service)

**Request Body:**
```json
{
  "address": "123 Đường XYZ, Quận 1, TP.HCM"
}
```

**Response:**
```json
{
  "latitude": 10.762622,
  "longitude": 106.660172,
  "formattedAddress": "123 Đường XYZ, Phường ABC, Quận 1, TP.HCM"
}
```

#### 2.1.8 GET /api/clinics/{id}/distance
**Description:** Tính khoảng cách từ điểm A đến clinic

**Query Parameters:**
- `latitude` (BigDecimal, required)
- `longitude` (BigDecimal, required)

**Response:**
```json
{
  "distance": 2.5,
  "unit": "km",
  "duration": 15,
  "durationUnit": "minutes"
}
```

### 2.2 DTOs

#### ClinicRequest.java
```java
public class ClinicRequest {
    @NotBlank(message = "Tên phòng khám không được để trống")
    @Size(max = 200, message = "Tên phòng khám không được vượt quá 200 ký tự")
    private String name;

    @Size(max = 2000, message = "Mô tả không được vượt quá 2000 ký tự")
    private String description;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 500, message = "Địa chỉ không được vượt quá 500 ký tự")
    private String address;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^[0-9]{10,11}$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @Email(message = "Email không hợp lệ")
    private String email;

    private String licenseNumber;
    private Map<String, OperatingHours> operatingHours;
}
```

#### ClinicResponse.java
```java
public class ClinicResponse {
    private UUID clinicId;
    private UserInfo owner;
    private String name;
    private String description;
    private String address;
    private String phone;
    private String email;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private ClinicStatus status;
    private BigDecimal ratingAvg;
    private Integer ratingCount;
    private List<String> images;
    private LocalDateTime createdAt;
    // ... other fields
}
```

---

## 3. Frontend Component Specification

### 3.1 ClinicList Component

**File:** `petties-web/src/pages/clinic-owner/clinics/ClinicList.tsx`

**Features:**
- Hiển thị danh sách clinic của owner
- Filters: status, search by name
- Pagination
- Action buttons: View, Edit, Delete
- Empty state

**Props:**
```typescript
interface ClinicListProps {
  // No props needed, fetch from store
}
```

**State Management:**
- Zustand store: `clinicStore.ts`
- Actions: `fetchClinics()`, `deleteClinic()`

### 3.2 ClinicForm Component

**File:** `petties-web/src/components/clinic/ClinicForm.tsx`

**Features:**
- Form tạo/sửa clinic
- Address autocomplete với Google Places
- Map picker (click to set location)
- Operating hours editor
- Image upload
- Validation

**Props:**
```typescript
interface ClinicFormProps {
  clinicId?: string; // undefined = create, defined = edit
  onSubmit: (data: ClinicRequest) => void;
  onCancel: () => void;
}
```

### 3.3 ClinicMap Component

**File:** `petties-web/src/components/clinic/ClinicMap.tsx`

**Features:**
- Hiển thị Google Map
- Marker cho clinic location
- Click marker để xem info
- Custom marker icon
- Map styling theo design system

**Props:**
```typescript
interface ClinicMapProps {
  latitude: number;
  longitude: number;
  clinicName?: string;
  zoom?: number; // default: 15
  height?: string; // default: "400px"
}
```

### 3.4 AddressAutocomplete Component

**File:** `petties-web/src/components/clinic/AddressAutocomplete.tsx`

**Features:**
- Google Places Autocomplete
- Auto geocode khi chọn address
- Display formatted address
- Integration với ClinicForm

**Props:**
```typescript
interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  required?: boolean;
}
```

### 3.5 Zustand Store

**File:** `petties-web/src/store/clinicStore.ts`

```typescript
interface ClinicStore {
  clinics: Clinic[];
  currentClinic: Clinic | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchClinics: (filters?: ClinicFilters) => Promise<void>;
  fetchClinicById: (id: string) => Promise<void>;
  createClinic: (data: ClinicRequest) => Promise<void>;
  updateClinic: (id: string, data: ClinicRequest) => Promise<void>;
  deleteClinic: (id: string) => Promise<void>;
  searchNearby: (lat: number, lng: number, radius?: number) => Promise<void>;
}
```

---

## 4. Google Maps Integration

### 4.1 Backend Service

**File:** `backend-spring/petties/src/main/java/com/petties/petties/service/GoogleMapsService.java`

**Methods:**
```java
public interface GoogleMapsService {
    /**
     * Geocode address to lat/lng
     */
    GeocodeResponse geocode(String address);
    
    /**
     * Reverse geocode lat/lng to address
     */
    String reverseGeocode(BigDecimal latitude, BigDecimal longitude);
    
    /**
     * Calculate distance between two points (Haversine formula)
     */
    double calculateDistance(BigDecimal lat1, BigDecimal lng1, 
                             BigDecimal lat2, BigDecimal lng2);
    
    /**
     * Calculate distance using Google Distance Matrix API (more accurate)
     */
    DistanceResponse calculateDistanceMatrix(
        BigDecimal originLat, BigDecimal originLng,
        BigDecimal destLat, BigDecimal destLng
    );
}
```

**Configuration:**
```properties
# application.properties
google.maps.api.key=${GOOGLE_MAPS_API_KEY}
google.maps.geocoding.url=https://maps.googleapis.com/maps/api/geocode/json
google.maps.distance.url=https://maps.googleapis.com/maps/api/distancematrix/json
```

### 4.2 Frontend Integration

**Setup:**
1. Install dependencies:
```bash
npm install @react-google-maps/api @googlemaps/js-api-loader
```

2. Environment variable:
```env
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

3. Google Maps Provider:
```typescript
// src/config/googleMaps.ts
import { Loader } from '@googlemaps/js-api-loader';

export const googleMapsLoader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places', 'geometry']
});
```

**Custom Hook:**
```typescript
// src/hooks/useGoogleMaps.ts
export const useGoogleMaps = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    googleMapsLoader.load().then(() => setIsLoaded(true));
  }, []);
  
  return { map, setMap, isLoaded };
};
```

---

## 5. Testing Strategy

### 5.1 Backend Tests

#### Unit Tests
- `ClinicServiceTest.java`
  - Test create clinic
  - Test update clinic
  - Test delete clinic (soft delete)
  - Test find nearby clinics
  - Test geocoding

#### Integration Tests
- `ClinicControllerTest.java`
  - Test all endpoints
  - Test authorization (role-based)
  - Test validation
  - Test exception handling

#### Mock Tests
- `GoogleMapsServiceTest.java`
  - Mock Google Maps API responses
  - Test geocoding
  - Test distance calculation

### 5.2 Frontend Tests

- Component tests với React Testing Library
- Integration tests cho form submission
- E2E tests cho clinic management flow

---

## 6. Security & Authorization

### 6.1 Role-Based Access Control

| Endpoint | PET_OWNER | VET | CLINIC_OWNER | CLINIC_MANAGER | ADMIN |
|----------|-----------|-----|-------------|----------------|-------|
| GET /api/clinics | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/clinics/{id} | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/clinics | ❌ | ❌ | ✅ | ❌ | ✅ |
| PUT /api/clinics/{id} | ❌ | ❌ | ✅* | ❌ | ✅ |
| DELETE /api/clinics/{id} | ❌ | ❌ | ✅* | ❌ | ✅ |
| POST /api/clinics/{id}/approve | ❌ | ❌ | ❌ | ❌ | ✅ |

*CLINIC_OWNER chỉ có thể update/delete clinic của chính mình

### 6.2 Validation Rules

1. **Name:** Required, max 200 chars (VARCHAR(200))
2. **Description:** Optional, TEXT (unlimited)
3. **Address:** Required, max 500 chars (VARCHAR(500))
4. **Phone:** Required, 10-20 chars (VARCHAR(20))
5. **Email:** Optional, max 100 chars (VARCHAR(100)), must be valid email format
6. **Latitude:** Optional, DECIMAL(10,8) - range -90 to 90
7. **Longitude:** Optional, DECIMAL(11,8) - range -180 to 180
8. **License Number:** Optional, max 50 chars (VARCHAR(50))
9. **License Document:** Optional, max 500 chars (VARCHAR(500)) - URL format
10. **Operating Hours:** Optional, JSON format
11. **Rating Avg:** Auto-calculated, DECIMAL(2,1) - range 0.0 to 5.0
12. **Rating Count:** Auto-calculated, INTEGER - default 0

### 6.3 Data Protection

- Soft delete (không xóa thực sự khỏi database)
- Audit trail (created_at, updated_at, deleted_at)
- Input sanitization để prevent XSS
- SQL injection prevention (sử dụng JPA)

---

## 7. Environment Variables

### Backend (.env)
```properties
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Frontend (.env)
```properties
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_API_URL=http://localhost:8080/api
```

---

## 8. API Documentation

Tất cả endpoints sẽ được document bằng Swagger/OpenAPI:
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

---

**Last Updated:** 2025-12-18


