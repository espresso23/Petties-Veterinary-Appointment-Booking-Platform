# Clinic Admin API - Unit Test Report

**Version:** 1.0
**Last Updated:** 2025-01-27
**Feature:** Clinic Approval Management (Admin)
**Test Type:** Unit Test (Controller Layer with @WebMvcTest)

---

## 1. Overview

### 1.1 Feature Description

Clinic Admin API cho phép ADMIN quản lý quy trình duyệt phòng khám, bao gồm:
- Xem danh sách phòng khám đang chờ duyệt (PENDING)
- Duyệt phòng khám (APPROVED) - có thể kèm lý do
- Từ chối phòng khám (REJECTED) - bắt buộc phải có lý do

Khi phòng khám được duyệt hoặc từ chối, hệ thống sẽ tự động tạo thông báo cho CLINIC_OWNER.

### 1.2 Applicable Roles

| Role | Platform | Access |
|------|----------|--------|
| ADMIN | Web | Full access - chỉ ADMIN mới có quyền duyệt/từ chối phòng khám |

### 1.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clinics/admin/pending` | Lấy danh sách phòng khám đang chờ duyệt (phân trang) |
| POST | `/api/clinics/{id}/approve` | Duyệt phòng khám (reason là optional) |
| POST | `/api/clinics/{id}/reject` | Từ chối phòng khám (reason là required) |

---

## 2. Test Environment

### 2.1 Test Configuration

| Item | Value |
|------|-------|
| Test Framework | JUnit 5 + Spring Boot Test |
| Test Context | `@WebMvcTest` (Legacy Slice Test) |
| Mocking | `@MockitoBean` (Spring Boot 3.4) |
| Security | `@AutoConfigureMockMvc(addFilters = false)` (Bypass Security Filter Chain) |

### 2.2 Test File Location

```
backend-spring/petties/src/test/java/com/petties/petties/controller/
└── ClinicControllerUnitTest.java
```

### 2.3 Dependencies Mocked

| Dependency | Purpose |
|------------|---------|
| `ClinicService` | Mock business logic quản lý phòng khám |
| `AuthService` | Mock lấy thông tin user hiện tại (nếu cần) |
| `CloudinaryService` | Mock upload image (không dùng trong admin actions) |
| `JwtTokenProvider` | Mock token generation (nếu cần) |
| `UserDetailsServiceImpl` | Mock user details loading |
| `BlacklistedTokenRepository` | Mock token blacklist check |

---

## 3. Test Cases

### 3.1 GET /api/clinics/admin/pending

#### TC-UNIT-CLINIC-048: Success - Get Pending Clinics
- **Method**: `getPendingClinics_validRequest_returns200`
- **Scenario**: Lấy danh sách phòng khám đang chờ duyệt với phân trang hợp lệ.
- **Expected**: Status 200, trả về danh sách phòng khám có status PENDING.
- **Status**: ✅ PASSED

#### TC-UNIT-CLINIC-049: Success - Empty Pending Clinics
- **Method**: `getPendingClinics_emptyResult_returns200`
- **Scenario**: Không có phòng khám nào đang chờ duyệt.
- **Expected**: Status 200, trả về danh sách rỗng.
- **Status**: ✅ PASSED

### 3.2 POST /api/clinics/{id}/approve

#### TC-UNIT-CLINIC-029: Success - Approve Clinic Without Reason
- **Method**: `approveClinic_validRequestWithoutReason_returns200`
- **Scenario**: Duyệt phòng khám không kèm lý do (reason là optional).
- **Expected**: Status 200, clinic status chuyển thành APPROVED.
- **Status**: ✅ PASSED

#### TC-UNIT-CLINIC-030: Success - Approve Clinic With Reason
- **Method**: `approveClinic_validRequestWithReason_returns200`
- **Scenario**: Duyệt phòng khám kèm lý do.
- **Expected**: Status 200, clinic status chuyển thành APPROVED, reason được lưu.
- **Status**: ✅ PASSED

### 3.3 POST /api/clinics/{id}/reject

#### TC-UNIT-CLINIC-032: Success - Reject Clinic
- **Method**: `rejectClinic_validReason_returns200`
- **Scenario**: Từ chối phòng khám với lý do hợp lệ (reason là required).
- **Expected**: Status 200, clinic status chuyển thành REJECTED, reason được lưu.
- **Status**: ✅ PASSED

---

## 4. Test Execution Summary

### 4.1 Results (Latest Run)

| Metric | Value |
|--------|-------|
| **Total Test Cases** | 5 |
| **Passed** | 5 |
| **Failed** | 0 |
| **Pass Rate** | 100% |

### 4.2 Run Command

```bash
mvn test -Dtest=ClinicControllerUnitTest
```

### 4.3 Test Coverage

| Endpoint | Test Cases | Coverage |
|----------|------------|----------|
| GET `/api/clinics/admin/pending` | 2 | ✅ Complete |
| POST `/api/clinics/{id}/approve` | 2 | ✅ Complete |
| POST `/api/clinics/{id}/reject` | 1 | ✅ Complete |

---

## 5. Business Rules

### 5.1 Approval Flow

1. **PENDING → APPROVED**: 
   - Admin có thể duyệt phòng khám
   - Reason là optional
   - Tự động tạo notification cho CLINIC_OWNER

2. **PENDING → REJECTED**:
   - Admin có thể từ chối phòng khám
   - Reason là required (validation ở DTO level)
   - Tự động tạo notification cho CLINIC_OWNER

3. **Không thể thay đổi status**:
   - APPROVED → REJECTED: Không được phép
   - REJECTED → APPROVED: Không được phép
   - APPROVED → PENDING: Không được phép

### 5.2 Notification Integration

- Khi approve/reject thành công, hệ thống tự động tạo notification
- Notification type: `APPROVED`, `REJECTED`, hoặc `PENDING`
- CLINIC_OWNER sẽ nhận được thông báo trong Notification API

---

## 6. Notes

- Tất cả endpoints yêu cầu role `ADMIN`.
- Chỉ phòng khám có status `PENDING` mới có thể được approve/reject.
- Request body cho approve có thể là `{}` (empty) hoặc `{"reason": "..."}`.
- Request body cho reject bắt buộc phải có `{"reason": "..."}` (validated bởi `@NotBlank`).
- API hỗ trợ phân trang với default `page=0`, `size=20`, sort by `createdAt DESC`.

---

**Document Status:** Complete
**Reviewed By:** Auto-generated from test code

