# Clinic Staff Management API - Unit Test Report

**Version:** 1.0
**Last Updated:** 2025-12-25
**Feature:** Staff Management (Quick Add, Remove, Role Assignment)
**Test Type:** Unit Test (Controller Layer with @WebMvcTest)

---

## 1. Overview

### 1.1 Feature Description

Hệ thống quản lý nhân sự phòng khám cho Clinic Owner và Clinic Manager:
- **Xem danh sách nhân viên**: Lấy tất cả staff của một phòng khám
- **Thêm nhanh nhân viên (Quick Add)**: Tạo tài khoản mới và gán vào phòng khám
- **Gán nhân viên có sẵn**: Assign Manager hoặc Vet từ tài khoản đã tồn tại
- **Xóa nhân viên**: Gỡ staff khỏi phòng khám

### 1.2 Applicable Roles

| Role | Access | Note |
|------|--------|------|
| CLINIC_OWNER | Full | Thêm/Xóa cả VET và CLINIC_MANAGER |
| CLINIC_MANAGER | Limited | Chỉ thêm/xóa VET |
| ADMIN | Read Only | Xem danh sách |

### 1.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinics/{clinicId}/staff` | Lấy danh sách nhân viên |
| GET | `/clinics/{clinicId}/staff/has-manager` | Kiểm tra đã có Manager chưa |
| POST | `/clinics/{clinicId}/staff/quick-add` | Tạo tài khoản mới và gán vào clinic |
| POST | `/clinics/{clinicId}/staff/manager/{usernameOrEmail}` | Gán user có sẵn làm Manager |
| POST | `/clinics/{clinicId}/staff/vet/{usernameOrEmail}` | Gán user có sẵn làm Vet |
| DELETE | `/clinics/{clinicId}/staff/{userId}` | Xóa nhân viên khỏi clinic |

---

## 2. Test Environment

### 2.1 Test Configuration

| Item | Value |
|------|-------|
| Test Framework | JUnit 5 + Spring Boot Test |
| Test Context | `@WebMvcTest` (Controller Slice Test) |
| Mocking | `@MockitoBean` (Spring Boot 3.4) |
| Security | `@AutoConfigureMockMvc(addFilters = false)` |

### 2.2 Test File Location

```
backend-spring/petties/src/test/java/com/petties/petties/controller/
└── ClinicStaffControllerUnitTest.java
```

### 2.3 Dependencies Mocked

| Dependency | Purpose |
|------------|---------|
| `ClinicStaffService` | Mock business logic |
| `JwtTokenProvider` | Mock token validation |
| `JwtAuthenticationFilter` | Mock auth filter |
| `UserDetailsServiceImpl` | Mock user loading |
| `BlacklistedTokenRepository` | Mock token blacklist |

---

## 3. Test Cases - Success Scenarios

### TC-UNIT-STF-001: Get Staff List Success
- **Method**: `getStaff_Success`
- **Scenario**: Lấy danh sách nhân viên của phòng khám
- **Expected**: Status 200, trả về list StaffResponse
- **Status**: ✅ PASSED

### TC-UNIT-STF-002: Quick Add Staff Success
- **Method**: `quickAddStaff_Success`
- **Scenario**: Tạo tài khoản mới (VET hoặc MANAGER) và gán vào clinic
- **Input**: `{ fullName: "New Manager", phone: "0912345678", role: "CLINIC_MANAGER" }`
- **Expected**: Status 200, message "Staff account created and assigned successfully"
- **Status**: ✅ PASSED

### TC-UNIT-STF-003: Assign Manager Success
- **Method**: `assignManager_Success`
- **Scenario**: Gán user có sẵn làm Manager
- **Expected**: Status 200, message "Clinic Manager assigned successfully"
- **Status**: ✅ PASSED

### TC-UNIT-STF-004: Remove Staff Success
- **Method**: `removeStaff_Success`
- **Scenario**: Xóa nhân viên khỏi phòng khám
- **Expected**: Status 200, message "Staff removed successfully"
- **Status**: ✅ PASSED

---

## 4. Test Cases - Validation Errors

### TC-UNIT-STF-005: Quick Add Staff - Duplicate Phone Fail
- **Method**: `quickAddStaff_DuplicatePhone_Fail`
- **Scenario**: SĐT đã được đăng ký
- **Expected**: Status 409 Conflict, message "Số điện thoại này đã được đăng ký tài khoản"
- **Status**: ✅ PASSED

### TC-UNIT-STF-006: Quick Add Staff - Invalid Phone Format Fail
- **Method**: `quickAddStaff_InvalidPhone_Fail`
- **Scenario**: SĐT không đúng format (< 10 số)
- **Expected**: Status 400 Bad Request, message "Số điện thoại không hợp lệ"
- **Status**: ✅ PASSED

### TC-UNIT-STF-007: Quick Add Staff - Empty Name Fail
- **Method**: `quickAddStaff_EmptyName_Fail`
- **Scenario**: Họ tên để trống
- **Expected**: Status 400 Bad Request, message "Họ tên không được để trống"
- **Status**: ✅ PASSED

### TC-UNIT-STF-008: Quick Add Staff - Invalid Role Fail
- **Method**: `quickAddStaff_InvalidRole_Fail`
- **Scenario**: Role không hợp lệ (không phải VET/CLINIC_MANAGER)
- **Expected**: Status 400 Bad Request
- **Status**: ✅ PASSED

---

## 5. Test Cases - Authorization Errors

### TC-UNIT-STF-009: Quick Add Staff - Forbidden Add ADMIN Fail
- **Method**: `quickAddStaff_AddAdmin_Forbidden_Fail`
- **Scenario**: Cố gắng tạo tài khoản ADMIN
- **Expected**: Status 403 Forbidden, message "Không thể tạo tài khoản ADMIN qua chức năng này"
- **Status**: ✅ PASSED

### TC-UNIT-STF-010: Quick Add Staff - Manager Add Manager Forbidden Fail
- **Method**: `quickAddStaff_ManagerAddManager_Forbidden_Fail`
- **Scenario**: Clinic Manager cố gắng thêm CLINIC_MANAGER khác
- **Expected**: Status 403 Forbidden, message "Quản lý phòng khám chỉ có quyền thêm Bác sĩ"
- **Status**: ✅ PASSED

### TC-UNIT-STF-011: Assign Vet - Forbidden Access Fail
- **Method**: `assignVet_Forbidden_Fail`
- **Scenario**: User không có quyền quản lý phòng khám này
- **Expected**: Status 403 Forbidden, message "Bạn không có quyền quản lý phòng khám này"
- **Status**: ✅ PASSED

### TC-UNIT-STF-012: Assign Manager - User Not Found Fail
- **Method**: `assignManager_NotFound_Fail`
- **Scenario**: Username/Email không tồn tại trong hệ thống
- **Expected**: Status 404 Not Found, message "User not found"
- **Status**: ✅ PASSED

---

## 6. Test Execution Summary

### 6.1 Results (Latest Run)

| Metric | Value |
|--------|-------|
| **Total Test Cases** | 12 |
| **Passed** | 12 |
| **Failed** | 0 |
| **Pass Rate** | 100% |

### 6.2 Coverage

| Category | Test Cases |
|----------|------------|
| Success Scenarios | 4 |
| Validation Errors | 4 |
| Authorization Errors | 4 |

### 6.3 Run Command

```bash
mvn test -Dtest=ClinicStaffControllerUnitTest
```

---

## 7. Business Rules Tested

| Rule ID | Description | Covered |
|---------|-------------|:-------:|
| BR-008-01 | Quick Add: Chỉ yêu cầu Họ tên, SĐT, Vai trò | ✅ |
| BR-008-03 | Owner thêm VET + MANAGER; Manager chỉ thêm VET | ✅ |
| BR-008-04 | Nhân viên chỉ thuộc 1 phòng khám | ✅ |
| BR-008-07 | Mỗi phòng khám chỉ có 1 Manager | ⏳ (Service layer) |

---

**Document Status:** Complete
**Reviewed By:** Development Team
