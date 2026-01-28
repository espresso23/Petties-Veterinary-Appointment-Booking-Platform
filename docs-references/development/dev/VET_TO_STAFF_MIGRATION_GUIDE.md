# VET → STAFF Terminology Migration Guide

**Phiên bản:** 1.0  
**Ngày tạo:** 2026-01-29  
**Tác giả:** Tân (SE181717)  
**Mục đích:** Hướng dẫn refactor thuật ngữ từ `Vet` sang `Staff` trên branch `integrationFeature` trước khi merge.

---

## 1. Tổng quan về thay đổi

### Lý do refactor
Ban đầu, hệ thống sử dụng thuật ngữ `Vet` (Bác sĩ thú y) để chỉ người thực hiện dịch vụ. Tuy nhiên, hệ thống Petties hỗ trợ nhiều loại dịch vụ hơn (Grooming, Spa, v.v.) nên `Staff` (Nhân viên) là thuật ngữ chính xác và linh hoạt hơn.

### Phạm vi thay đổi
| Thành phần | Mô tả | Ảnh hưởng |
|------------|-------|-----------|
| **Backend (Java)** | Entities, DTOs, Services, Controllers | Cao |
| **Frontend (React)** | Types, Services, Components | Trung bình |
| **Mobile (Flutter)** | Models, Services, Screens | Trung bình |
| **Database** | Column names trong migration scripts | Cao |

---

## 2. Quy tắc đổi tên

### 2.1 Backend (Java/Spring Boot)

| Cũ | Mới | Ví dụ |
|----|-----|-------|
| `vetId` | `staffId` | `private UUID vetId;` → `private UUID staffId;` |
| `vetName` | `staffName` | `private String vetName;` → `private String staffName;` |
| `assignedVet` | `assignedStaff` | `private User assignedVet;` → `private User assignedStaff;` |
| `VetService` | *(không có - dùng UserService với role filter)* | Loại bỏ nếu tồn tại |
| `VetRepository` | *(không có)* | Loại bỏ nếu tồn tại |
| `VetShift` | `StaffShift` | Đã đổi tên entity |
| `VetSpecialty` | `StaffSpecialty` | Đã đổi tên enum |

### 2.2 Frontend (React/TypeScript)

| Cũ | Mới | File ảnh hưởng |
|----|-----|----------------|
| `vetId` | `staffId` | Types, API responses |
| `vetName` | `staffName` | Components hiển thị tên |
| `Vet` (interface) | `Staff` hoặc `User` với role | Types definitions |
| `getVets()` | `getStaffByClinic()` hoặc tương tự | Service files |

### 2.3 Mobile (Flutter/Dart)

| Cũ | Mới | File ảnh hưởng |
|----|-----|----------------|
| `vetId` | `staffId` | Models, API requests |
| `vetName` | `staffName` | UI widgets |
| `VetModel` | `StaffModel` hoặc `UserModel` | Data models |

### 2.4 API Endpoints

| Cũ | Mới | Ghi chú |
|----|-----|---------|
| `/api/vets` | `/api/staff` | Nếu có endpoint riêng |
| `?vetId=xxx` | `?staffId=xxx` | Query parameters |

---

## 3. Danh sách files cần kiểm tra

### Backend (Priority: High)
```
backend-spring/petties/src/main/java/com/petties/petties/
├── model/
│   ├── Booking.java           ✅ Đã có assignedStaff
│   ├── BookingServiceItem.java ✅ Đã có assignedStaff
│   ├── StaffShift.java        ✅ Đã đổi từ VetShift
│   └── Slot.java              ✅ 
├── dto/
│   ├── booking/               🔍 Kiểm tra các DTO
│   ├── emr/                   🔍 Kiểm tra staffId/staffName
│   └── vaccination/           🔍 Kiểm tra staffId/staffName
├── service/
│   ├── BookingService.java    🔍 Kiểm tra logic assign staff
│   ├── EmrService.java        ✅ Đã dùng staffId
│   └── VaccinationService.java 🔍 Kiểm tra
├── controller/
│   └── *Controller.java       🔍 Kiểm tra endpoints
└── repository/
    └── *Repository.java       🔍 Kiểm tra query methods
```

### Frontend (Priority: Medium)
```
petties-web/src/
├── types/                     🔍 Kiểm tra interfaces
├── services/
│   ├── api/                   🔍 Kiểm tra API calls
│   └── endpoints/             🔍 Kiểm tra endpoint definitions
├── pages/
│   ├── staff/                 ✅ Đã đổi từ /vet
│   └── clinic-owner/          🔍 Kiểm tra staff management pages
└── components/                🔍 Kiểm tra UI components
```

### Mobile (Priority: Medium)
```
petties_mobile/lib/
├── data/models/               🔍 Kiểm tra model classes
├── data/services/             🔍 Kiểm tra API services
├── domain/entities/           🔍 Kiểm tra domain entities
└── ui/                        🔍 Kiểm tra screen labels
```

---

## 4. Quy trình merge an toàn

### Bước 1: Chuẩn bị
```bash
# 1. Đảm bảo branch hiện tại clean
git status

# 2. Commit hoặc stash any uncommitted changes
git stash save "WIP before merge preparation"

# 3. Fetch latest từ remote
git fetch origin
```

### Bước 2: Checkout và cập nhật integrationFeature
```bash
# 1. Checkout sang integrationFeature
git checkout integrationFeature

# 2. Pull latest changes
git pull origin integrationFeature

# 3. Tạo branch backup (phòng trường hợp)
git checkout -b backup/integrationFeature-before-vet-refactor
git checkout integrationFeature
```

### Bước 3: Apply refactor trên integrationFeature

#### Sử dụng IDE "Find and Replace" (Khuyến khích)
1. Mở project trong IDE (IntelliJ/VSCode)
2. Sử dụng **Find and Replace in Files** (Ctrl+Shift+H)
3. Thực hiện theo thứ tự sau (**QUAN TRỌNG: Thứ tự này tránh replace sai**):

| # | Tìm | Thay bằng | Match Case | Whole Word | Scope |
|---|-----|-----------|------------|------------|-------|
| 1 | `VetShift` | `StaffShift` | ✅ | ✅ | `*.java` |
| 2 | `VetSpecialty` | `StaffSpecialty` | ✅ | ✅ | `*.java` |
| 3 | `vetShift` | `staffShift` | ✅ | ✅ | `*.java` |
| 4 | `assignedVet` | `assignedStaff` | ✅ | ✅ | All files |
| 5 | `vetId` | `staffId` | ✅ | ✅ | All files |
| 6 | `vetName` | `staffName` | ✅ | ✅ | All files |
| 7 | `getVet` | `getStaff` | ✅ | ✅ | `*.java, *.ts, *.tsx` |
| 8 | `setVet` | `setStaff` | ✅ | ✅ | `*.java` |

> ⚠️ **CẢNH BÁO:** Không dùng "Replace All" mù quáng. Luôn review từng thay đổi!

### Bước 4: Build và Test
```bash
# Backend
cd backend-spring/petties
mvn clean compile
mvn test

# Frontend
cd petties-web
npm install
npm run build
npm test

# Mobile (nếu applicable)
cd petties_mobile
flutter pub get
flutter analyze
flutter test
```

### Bước 5: Commit và Push
```bash
git add .
git commit -m "refactor: migrate Vet terminology to Staff across codebase

- Rename VetShift -> StaffShift
- Rename VetSpecialty -> StaffSpecialty  
- Update field names: vetId -> staffId, vetName -> staffName
- Update all related DTOs, services, and components

This change prepares for merge with feature branch that already uses Staff terminology."

git push origin integrationFeature
```

### Bước 6: Merge feature branch
```bash
# Quay lại feature branch của bạn
git checkout <your-feature-branch>

# Merge integrationFeature vào (hoặc rebase)
git merge integrationFeature
# HOẶC
git rebase integrationFeature

# Resolve conflicts nếu có
# ...

# Push
git push origin <your-feature-branch>
```

### Bước 7: Tạo PR
Tạo Pull Request từ `<your-feature-branch>` → `integrationFeature` theo quy trình bình thường.

---

## 5. Checklist sau khi refactor

- [ ] Backend compile thành công (`mvn clean compile`)
- [ ] Backend tests pass (`mvn test`)
- [ ] Frontend build thành công (`npm run build`)
- [ ] Frontend tests pass (`npm test`)
- [ ] Mobile analyze pass (`flutter analyze`)
- [ ] Database migration scripts updated (nếu cần)
- [ ] API documentation updated (Swagger/OpenAPI)
- [ ] UI labels đã đổi từ "Bác sĩ" sang "Nhân viên" (nếu applicable)

---

## 6. Troubleshooting

### Lỗi compile "Cannot find symbol vetId"
**Nguyên nhân:** Một số file chưa được refactor.  
**Giải pháp:** Grep toàn bộ project để tìm các reference còn sót.
```bash
grep -rn "vetId" --include="*.java" --include="*.ts" --include="*.tsx"
```

### Lỗi runtime "Unknown column 'vet_id'"
**Nguyên nhân:** Database chưa được migrate.  
**Giải pháp:** Tạo Flyway migration script để rename column.
```sql
-- V202601290001__rename_vet_to_staff_columns.sql
ALTER TABLE booking RENAME COLUMN vet_id TO staff_id;
ALTER TABLE emr_record RENAME COLUMN vet_id TO staff_id;
-- etc.
```

### Frontend TypeScript error "Property 'vetId' does not exist"
**Nguyên nhân:** Type definitions chưa update.  
**Giải pháp:** Update interface definitions trong `/types`.

---

## 7. Liên hệ hỗ trợ

| Vấn đề | Liên hệ |
|--------|---------|
| Backend conflicts | Tuân (DE180807) / Triết (DE180687) |
| Frontend conflicts | Huyền (DE180773) |
| Mobile conflicts | Uyên (DE180893) |
| Architecture decisions | Tân (SE181717) |

---

**Document Status:** ✅ Ready for use
