# Notification API - Unit Test Report

**Version:** 1.0
**Last Updated:** 2025-01-27
**Feature:** Clinic Notification Management
**Test Type:** Unit Test (Controller Layer with @WebMvcTest)

---

## 1. Overview

### 1.1 Feature Description

Notification API cho phép CLINIC_OWNER quản lý thông báo về trạng thái phòng khám của họ, bao gồm:
- Xem danh sách thông báo (phân trang)
- Xem số lượng thông báo chưa đọc
- Đánh dấu một thông báo đã đọc
- Đánh dấu tất cả thông báo đã đọc

Thông báo được tạo tự động khi:
- Phòng khám được duyệt (APPROVED)
- Phòng khám bị từ chối (REJECTED)
- Phòng khám đang chờ duyệt (PENDING)

### 1.2 Applicable Roles

| Role | Platform | Access |
|------|----------|--------|
| CLINIC_OWNER | Web | Full access - chỉ xem thông báo của chính mình |

### 1.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/clinic` | Lấy danh sách thông báo của clinic owner (phân trang) |
| GET | `/api/notifications/clinic/unread-count` | Lấy số lượng thông báo chưa đọc |
| PUT | `/api/notifications/{id}/read` | Đánh dấu một thông báo đã đọc |
| PUT | `/api/notifications/clinic/mark-all-read` | Đánh dấu tất cả thông báo đã đọc |

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
└── NotificationControllerUnitTest.java
```

### 2.3 Dependencies Mocked

| Dependency | Purpose |
|------------|---------|
| `NotificationService` | Mock business logic quản lý thông báo |
| `AuthService` | Mock lấy thông tin user hiện tại |
| `JwtTokenProvider` | Mock token generation (nếu cần) |
| `UserDetailsServiceImpl` | Mock user details loading |
| `BlacklistedTokenRepository` | Mock token blacklist check |

---

## 3. Test Cases

### 3.1 GET /api/notifications/clinic

#### TC-UNIT-NOTIF-001: Success - Returns Paged Clinic Notifications
- **Method**: `getClinicNotifications_validRequest_returns200`
- **Scenario**: Lấy danh sách thông báo với phân trang hợp lệ.
- **Expected**: Status 200, trả về danh sách thông báo có phân trang.
- **Status**: ✅ PASSED

#### TC-UNIT-NOTIF-002: Success - Empty Notifications
- **Method**: `getClinicNotifications_emptyResult_returns200`
- **Scenario**: User chưa có thông báo nào.
- **Expected**: Status 200, trả về danh sách rỗng.
- **Status**: ✅ PASSED

#### TC-UNIT-NOTIF-003: Success - With Pagination
- **Method**: `getClinicNotifications_withPagination_returns200`
- **Scenario**: Lấy thông báo với pagination parameters (page, size).
- **Expected**: Status 200, trả về đúng số lượng thông báo theo pagination.
- **Status**: ✅ PASSED

### 3.2 GET /api/notifications/clinic/unread-count

#### TC-UNIT-NOTIF-004: Success - Returns Unread Count
- **Method**: `getUnreadCount_hasUnread_returns200`
- **Scenario**: User có thông báo chưa đọc.
- **Expected**: Status 200, trả về số lượng thông báo chưa đọc > 0.
- **Status**: ✅ PASSED

#### TC-UNIT-NOTIF-005: Success - Zero Unread Count
- **Method**: `getUnreadCount_noUnread_returns200`
- **Scenario**: User không có thông báo chưa đọc.
- **Expected**: Status 200, trả về count = 0.
- **Status**: ✅ PASSED

### 3.3 PUT /api/notifications/{id}/read

#### TC-UNIT-NOTIF-006: Success - Mark Notification As Read
- **Method**: `markAsRead_validRequest_returns200`
- **Scenario**: Đánh dấu một thông báo đã đọc thành công.
- **Expected**: Status 200, message "Notification marked as read".
- **Status**: ✅ PASSED

#### TC-UNIT-NOTIF-007: Fail - Notification Not Found
- **Method**: `markAsRead_notificationNotFound_returns404`
- **Scenario**: Thông báo không tồn tại.
- **Expected**: Status 404 Not Found.
- **Status**: ✅ PASSED

#### TC-UNIT-NOTIF-008: Fail - Not Owner Of Notification
- **Method**: `markAsRead_notOwner_returns403`
- **Scenario**: User cố gắng đánh dấu thông báo không thuộc về mình.
- **Expected**: Status 403 Forbidden.
- **Status**: ✅ PASSED

### 3.4 PUT /api/notifications/clinic/mark-all-read

#### TC-UNIT-NOTIF-009: Success - Mark All Notifications As Read
- **Method**: `markAllAsRead_validRequest_returns200`
- **Scenario**: Đánh dấu tất cả thông báo đã đọc thành công.
- **Expected**: Status 200, message "All notifications marked as read".
- **Status**: ✅ PASSED

#### TC-UNIT-NOTIF-010: Success - Mark All When No Notifications
- **Method**: `markAllAsRead_noNotifications_returns200`
- **Scenario**: User không có thông báo nào, vẫn gọi API mark all.
- **Expected**: Status 200, không có lỗi xảy ra.
- **Status**: ✅ PASSED

---

## 4. Test Execution Summary

### 4.1 Results (Latest Run)

| Metric | Value |
|--------|-------|
| **Total Test Cases** | 10 |
| **Passed** | 10 |
| **Failed** | 0 |
| **Pass Rate** | 100% |

### 4.2 Run Command

```bash
mvn test -Dtest=NotificationControllerUnitTest
```

### 4.3 Test Coverage

| Endpoint | Test Cases | Coverage |
|----------|------------|----------|
| GET `/api/notifications/clinic` | 3 | ✅ Complete |
| GET `/api/notifications/clinic/unread-count` | 2 | ✅ Complete |
| PUT `/api/notifications/{id}/read` | 3 | ✅ Complete |
| PUT `/api/notifications/clinic/mark-all-read` | 2 | ✅ Complete |

---

## 5. Notes

- Tất cả endpoints yêu cầu role `CLINIC_OWNER`.
- Thông báo chỉ hiển thị cho chủ sở hữu phòng khám tương ứng.
- Thông báo được sắp xếp theo `createdAt DESC` (mới nhất trước).
- API hỗ trợ phân trang với default `page=0`, `size=20`.

---

**Document Status:** Complete
**Reviewed By:** Auto-generated from test code

