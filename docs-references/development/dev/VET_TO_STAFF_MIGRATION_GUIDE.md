# VET → STAFF Terminology Migration Guide

**Phiên bản:** 2.0
**Ngày cập nhật:** 2026-01-29
**Tác giả:** Tân (SE181717)
**Trạng thái:** ✅ MIGRATION HOÀN THÀNH

---

## 📊 TỔNG QUAN TRẠNG THÁI MIGRATION

### Kết quả Migration (29/01/2026)

| Thành phần | Trạng thái | Tiến độ |
|------------|------------|---------|
| **Database** | ✅ Hoàn thành | 100% |
| **Backend (Spring Boot)** | ✅ Hoàn thành | 98% |
| **Frontend (React)** | ✅ Hoàn thành | 100% |
| **Mobile (Flutter)** | ✅ Hoàn thành | 100% |
| **Unit Tests** | ✅ Pass | 62/62 tests |

### Verification Results
```
✅ Backend: mvn clean compile - SUCCESS
✅ Backend: mvn test - 62 tests PASSED
✅ Frontend: npm run build - SUCCESS
✅ Mobile: flutter analyze - 180 info issues (no errors)
```

---

## 1. Lý do Refactor

Ban đầu, hệ thống sử dụng thuật ngữ `Vet` (Bác sĩ thú y) để chỉ người thực hiện dịch vụ. Tuy nhiên, hệ thống Petties hỗ trợ nhiều loại dịch vụ hơn (Grooming, Spa, v.v.) nên `Staff` (Nhân viên) là thuật ngữ chính xác và linh hoạt hơn.

### Phạm vi thay đổi
| Thành phần | Mô tả | Mức ảnh hưởng |
|------------|-------|---------------|
| **Backend (Java)** | Entities, DTOs, Services, Controllers | Cao |
| **Frontend (React)** | Types, Services, Components | Trung bình |
| **Mobile (Flutter)** | Models, Services, Screens | Trung bình |
| **Database** | Column names, Table names | Cao |

---

## 2. Chi tiết Migration đã thực hiện

### 2.1 Database Migrations ✅

**3 migration files đã tạo:**

```sql
-- V202601270001__rename_vet_to_staff.sql
-- Cập nhật role: VET → STAFF trong bảng users
-- Cập nhật CHECK CONSTRAINT

-- V202601270002__rename_vet_tables_to_staff.sql
-- Rename table: vet_shifts → staff_shifts
-- Rename columns: vet_id → staff_id, assigned_vet_id → assigned_staff_id
-- Cập nhật indexes và constraints

-- V202601271107__rename_vet_notification_types_to_staff.sql
-- VET_SHIFT_ASSIGNED → STAFF_SHIFT_ASSIGNED
-- VET_SHIFT_UPDATED → STAFF_SHIFT_UPDATED
-- VET_SHIFT_DELETED → STAFF_SHIFT_DELETED
-- VET_ON_WAY → STAFF_ON_WAY
```

### 2.2 Backend Changes ✅

#### Files đã Rename:
| Cũ | Mới |
|----|-----|
| `VetShift.java` | `StaffShift.java` |
| `VetShiftRepository.java` | `StaffShiftRepository.java` |
| `VetShiftService.java` | `StaffShiftService.java` |
| `VetShiftController.java` | `StaffShiftController.java` |
| `VetAssignmentService.java` | `StaffAssignmentService.java` |
| `VetShiftRequest.java` | `StaffShiftRequest.java` |
| `VetShiftResponse.java` | `StaffShiftResponse.java` |
| `VetHomeSummaryResponse.java` | `StaffHomeSummaryResponse.java` |
| `AvailableVetResponse.java` | `AvailableStaffResponse.java` |
| `ReassignVetRequest.java` | `ReassignStaffRequest.java` |

#### Field Name Changes:
| Cũ | Mới | Files affected |
|----|-----|----------------|
| `vetId` | `staffId` | Booking, BookingServiceItem, EmrRecord, etc. |
| `vetName` | `staffName` | DTOs, Responses |
| `assignedVet` | `assignedStaff` | Booking, BookingServiceItem |
| `assignedVetId` | `assignedStaffId` | BookingResponse, BookingServiceItem |
| `assignedVetAvatarUrl` | `assignedStaffAvatarUrl` | BookingResponse |

### 2.3 Frontend Changes ✅

#### Files đã Rename:
| Cũ | Mới |
|----|-----|
| `pages/vet/` | `pages/staff/` |
| `VetLayout.tsx` | `StaffLayout.tsx` |
| `VetBookingsPage.tsx` | `StaffBookingsPage.tsx` |
| `VetSchedulePage.tsx` | `StaffSchedulePage.tsx` |
| `VetPatientsPage.tsx` | `StaffPatientsPage.tsx` |
| `vetShiftService.ts` | `staffShiftService.ts` |
| `vetshift.ts` | `staffshift.ts` |
| `ReassignVetModal.tsx` | `ReassignStaffModal.tsx` |
| `VetAvailabilityWarningModal.tsx` | `StaffAvailabilityWarningModal.tsx` |

### 2.4 Mobile Changes ✅

#### Files đã Rename:
| Cũ | Mới |
|----|-----|
| `ui/vet/` | `ui/staff/` |
| `vet_home_screen.dart` | `staff_home_screen.dart` |
| `vet_booking_detail_screen.dart` | `staff_booking_detail_screen.dart` |
| `vet_schedule_screen.dart` | `staff_schedule_screen.dart` |
| `vet_shift.dart` | `staff_shift.dart` |
| `vet_shift_service.dart` | `staff_shift_service.dart` |

#### Model Field Changes:
| Cũ | Mới |
|----|-----|
| `assignedVetId` | `assignedStaffId` |
| `assignedVetName` | `assignedStaffName` |
| `assignedVetAvatarUrl` | `assignedStaffAvatarUrl` |

---

## 3. Lưu ý quan trọng

### 3.1 StaffSpecialty Enum (GIỮ NGUYÊN)

Các enum values `VET_GENERAL`, `VET_SURGERY`, `VET_DENTAL`, `VET_DERMATOLOGY` **KHÔNG được rename** vì đây là specialty của staff, không phải role:

```java
public enum StaffSpecialty {
    VET_GENERAL,      // Bác sĩ thú y tổng quát
    VET_SURGERY,      // Bác sĩ phẫu thuật
    VET_DENTAL,       // Bác sĩ nha khoa
    VET_DERMATOLOGY,  // Bác sĩ da liễu
    GROOMER           // Nhân viên grooming
}
```

**Lý do:**
- `VET_*` đại diện cho chuyên môn của nhân viên, không phải role
- Staff có thể có specialty là VET_GENERAL (họ vẫn là STAFF role nhưng có chuyên môn bác sĩ thú y)
- Rename sang `STAFF_GENERAL` sẽ không đúng ngữ nghĩa

### 3.2 Test Data Seeders (Đã update)

Các file seeder đã được update để sử dụng username `staff` thay vì `vet`:
- `DataInitializer.java`
- `BookingDataSeeder.java`

---

## 4. Checklist Verification ✅

- [x] Backend compile thành công (`mvn clean compile`)
- [x] Backend tests pass (`mvn test` - 62/62 passed)
- [x] Frontend build thành công (`npm run build`)
- [x] Mobile analyze pass (`flutter analyze` - no errors)
- [x] Database migration scripts created and applied
- [x] API endpoints updated (Swagger docs)
- [x] UI labels updated (Vet → Staff/Nhân viên)
- [x] Merge conflicts resolved (4 files)

---

## 5. Merge Conflicts đã Resolve

| File | Conflict Type | Resolution |
|------|---------------|------------|
| `StaffAssignmentService.java` | Missing helper method | Added `hasBookingInTimeRange()` |
| `BookingDashboardPage.tsx` | Vet vs Staff terminology | Hybrid: Staff fields + Avatar UI |
| `booking.dart` | Model fields (3 blocks) | Staff fields + avatarUrl |
| `pet_owner_home_screen.dart` | BottomNav (4 vs 5 tabs) | Keep state + Add Chat tab |

---

## 6. Liên hệ hỗ trợ

| Vấn đề | Liên hệ |
|--------|---------|
| Backend conflicts | Tuân (DE180807) / Triết (DE180687) |
| Frontend conflicts | Huyền (DE180773) |
| Mobile conflicts | Uyên (DE180893) |
| Architecture decisions | Tân (SE181717) |

---

**Document Status:** ✅ Migration Complete (29/01/2026)
