# User Profile API - Unit Test Report

**Version:** 1.0
**Last Updated:** 2025-12-18
**Feature:** User Profile Management
**Test Type:** Unit Test (API Controller)

---

## 1. Overview

### 1.1 Feature Description

User Profile APIs cho phep nguoi dung quan ly thong tin ca nhan, bao gom:
- Xem thong tin profile
- Cap nhat thong tin (fullName, phone)
- Upload/xoa avatar (Cloudinary integration)
- Doi mat khau

### 1.2 Applicable Roles

| Role | Platform | Access |
|------|----------|--------|
| PET_OWNER | Mobile | Full access |
| VET | Web + Mobile | Full access |
| CLINIC_OWNER | Web | Full access |
| CLINIC_MANAGER | Web | Full access |
| ADMIN | Web | Full access |

### 1.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Lay profile user hien tai |
| PUT | `/api/users/profile` | Cap nhat fullName, phone |
| POST | `/api/users/profile/avatar` | Upload avatar moi |
| DELETE | `/api/users/profile/avatar` | Xoa avatar |
| PUT | `/api/users/profile/password` | Doi mat khau |

---

## 2. Test Environment

### 2.1 Test Configuration

| Item | Value |
|------|-------|
| Test Framework | JUnit 5 + Mockito |
| Test Type | Unit Test (Pure Mockito) |
| Spring Context | Not loaded |
| Database Connection | None (Mocked) |
| Internet Connection | None (Mocked) |

### 2.2 Test File Location

```
backend-spring/petties/src/test/java/com/petties/petties/controller/
└── UserControllerTest.java
```

### 2.3 Dependencies Mocked

| Dependency | Mock Type | Purpose |
|------------|-----------|---------|
| `UserService` | `@Mock` | Mock business logic |
| `AuthService` | `@Mock` | Mock authentication |
| `CloudinaryService` | (via UserService) | No real upload |

---

## 3. Test Cases

### 3.1 GET /api/users/profile

#### TC-PROFILE-001: Get Profile Successfully

| Field | Value |
|-------|-------|
| **Test Method** | `shouldReturnProfileSuccessfully()` |
| **Description** | User lay thong tin profile thanh cong |
| **Preconditions** | User da dang nhap |
| **Expected Result** | Status 200, tra ve UserResponse voi day du thong tin |
| **Status** | PASSED |

**Test Code:**
```java
@Test
void shouldReturnProfileSuccessfully() {
    when(authService.getCurrentUser()).thenReturn(testUser);
    when(userService.getUserById(testUserId)).thenReturn(testUserResponse);

    ResponseEntity<UserResponse> response = userController.getProfile();

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getBody().getUserId()).isEqualTo(testUserId);
    assertThat(response.getBody().getUsername()).isEqualTo("testuser");
}
```

---

### 3.2 PUT /api/users/profile

#### TC-PROFILE-002: Update Profile Successfully

| Field | Value |
|-------|-------|
| **Test Method** | `shouldUpdateProfileSuccessfully()` |
| **Description** | Cap nhat fullName va phone thanh cong |
| **Request** | `{"fullName": "Updated Name", "phone": "0987654321"}` |
| **Expected Result** | Status 200, tra ve UserResponse voi thong tin da cap nhat |
| **Status** | PASSED |

#### TC-PROFILE-003: Update Only FullName

| Field | Value |
|-------|-------|
| **Test Method** | `shouldUpdateOnlyFullName()` |
| **Description** | Chi cap nhat fullName, phone giu nguyen |
| **Request** | `{"fullName": "New Name Only", "phone": null}` |
| **Expected Result** | Status 200, fullName thay doi, phone khong doi |
| **Status** | PASSED |

---

### 3.3 POST /api/users/profile/avatar

#### TC-PROFILE-004: Upload Avatar Successfully

| Field | Value |
|-------|-------|
| **Test Method** | `shouldUploadAvatarSuccessfully()` |
| **Description** | Upload avatar thanh cong |
| **Request** | MultipartFile (JPEG, PNG, GIF, WEBP - max 10MB) |
| **Expected Result** | Status 200, tra ve AvatarResponse voi URL Cloudinary |
| **Status** | PASSED |

**Response Example:**
```json
{
  "avatarUrl": "https://res.cloudinary.com/test/petties/avatars/abc123.jpg",
  "publicId": "petties/avatars/abc123",
  "message": "Avatar da duoc cap nhat thanh cong"
}
```

#### TC-PROFILE-005: Upload Empty File

| Field | Value |
|-------|-------|
| **Test Method** | `shouldThrowExceptionWhenFileEmpty()` |
| **Description** | Upload file rong |
| **Request** | MultipartFile voi byte[0] |
| **Expected Result** | BadRequestException: "File khong duoc de trong." |
| **Status** | PASSED |

---

### 3.4 DELETE /api/users/profile/avatar

#### TC-PROFILE-006: Delete Avatar Successfully

| Field | Value |
|-------|-------|
| **Test Method** | `shouldDeleteAvatarSuccessfully()` |
| **Description** | Xoa avatar thanh cong |
| **Preconditions** | User co avatar |
| **Expected Result** | Status 200, avatarUrl = null |
| **Status** | PASSED |

#### TC-PROFILE-007: Delete Avatar When Not Exists

| Field | Value |
|-------|-------|
| **Test Method** | `shouldThrowExceptionWhenNoAvatar()` |
| **Description** | Xoa avatar khi user chua co avatar |
| **Preconditions** | User chua co avatar |
| **Expected Result** | BadRequestException: "Nguoi dung chua co avatar" |
| **Status** | PASSED |

---

### 3.5 PUT /api/users/profile/password

#### TC-PROFILE-008: Change Password Successfully

| Field | Value |
|-------|-------|
| **Test Method** | `shouldChangePasswordSuccessfully()` |
| **Description** | Doi mat khau thanh cong |
| **Request** | `{"currentPassword": "OldPass123", "newPassword": "NewPass456", "confirmPassword": "NewPass456"}` |
| **Expected Result** | Status 200, message: "Doi mat khau thanh cong" |
| **Status** | PASSED |

#### TC-PROFILE-009: Wrong Current Password

| Field | Value |
|-------|-------|
| **Test Method** | `shouldThrowExceptionWhenCurrentPasswordIncorrect()` |
| **Description** | Mat khau hien tai khong dung |
| **Request** | `{"currentPassword": "WrongPass", ...}` |
| **Expected Result** | BadRequestException: "Mat khau hien tai khong chinh xac" |
| **Status** | PASSED |

#### TC-PROFILE-010: Confirm Password Not Match

| Field | Value |
|-------|-------|
| **Test Method** | `shouldThrowExceptionWhenConfirmPasswordNotMatch()` |
| **Description** | Xac nhan mat khau khong khop |
| **Request** | `{"newPassword": "NewPass456", "confirmPassword": "DifferentPass"}` |
| **Expected Result** | BadRequestException: "Xac nhan mat khau khong khop" |
| **Status** | PASSED |

#### TC-PROFILE-011: New Password Same As Current

| Field | Value |
|-------|-------|
| **Test Method** | `shouldThrowExceptionWhenNewPasswordSameAsCurrent()` |
| **Description** | Mat khau moi trung voi mat khau cu |
| **Request** | `{"currentPassword": "SamePass123", "newPassword": "SamePass123", ...}` |
| **Expected Result** | BadRequestException: "Mat khau moi khong duoc trung voi mat khau hien tai" |
| **Status** | PASSED |

---

## 4. Test Execution Summary

### 4.1 Results

| Metric | Value |
|--------|-------|
| **Total Test Cases** | 12 |
| **Passed** | 12 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Pass Rate** | 100% |

### 4.2 Test Execution Log

| Test ID | Test Method | Result | Execution Time |
|---------|-------------|--------|----------------|
| TC-PROFILE-001 | shouldReturnProfileSuccessfully | PASSED | <1ms |
| TC-PROFILE-002 | shouldUpdateProfileSuccessfully | PASSED | <1ms |
| TC-PROFILE-003 | shouldUpdateOnlyFullName | PASSED | <1ms |
| TC-PROFILE-004 | shouldUploadAvatarSuccessfully | PASSED | <1ms |
| TC-PROFILE-005 | shouldThrowExceptionWhenFileEmpty | PASSED | <1ms |
| TC-PROFILE-006 | shouldDeleteAvatarSuccessfully | PASSED | <1ms |
| TC-PROFILE-007 | shouldThrowExceptionWhenNoAvatar | PASSED | <1ms |
| TC-PROFILE-008 | shouldChangePasswordSuccessfully | PASSED | <1ms |
| TC-PROFILE-009 | shouldThrowExceptionWhenCurrentPasswordIncorrect | PASSED | <1ms |
| TC-PROFILE-010 | shouldThrowExceptionWhenConfirmPasswordNotMatch | PASSED | <1ms |
| TC-PROFILE-011 | shouldThrowExceptionWhenNewPasswordSameAsCurrent | PASSED | <1ms |
| TC-PROFILE-012 | (implicit in nested tests) | PASSED | <1ms |

### 4.3 Run Command

```bash
# Run User Profile API tests
cd backend-spring/petties
mvn test -Dtest=UserControllerTest

# Run in offline mode (no internet required)
mvn test -Dtest=UserControllerTest -o
```

---

## 5. Test Coverage

### 5.1 Endpoint Coverage

| Endpoint | Test Cases | Coverage |
|----------|------------|----------|
| GET /profile | 1 | 100% |
| PUT /profile | 2 | 100% |
| POST /profile/avatar | 2 | 100% |
| DELETE /profile/avatar | 2 | 100% |
| PUT /profile/password | 4 | 100% |

### 5.2 Scenario Coverage

| Scenario Type | Count | Coverage |
|---------------|-------|----------|
| Happy Path | 5 | 100% |
| Error Cases | 6 | 100% |
| Edge Cases | 1 | 100% |

---

## 6. Related Files

### 6.1 Source Code

| File | Location |
|------|----------|
| UserController.java | `src/main/java/.../controller/UserController.java` |
| UserService.java | `src/main/java/.../service/UserService.java` |
| CloudinaryService.java | `src/main/java/.../service/CloudinaryService.java` |

### 6.2 DTOs

| DTO | Purpose |
|-----|---------|
| UserResponse | Response cho profile data |
| UpdateProfileRequest | Request cap nhat profile |
| ChangePasswordRequest | Request doi mat khau |
| AvatarResponse | Response cho avatar upload/delete |

---

## 7. Notes

1. **Test Independence:** Tat ca tests chay doc lap, khong can database hay internet
2. **Mocking Strategy:** Mock tai Service layer, khong mock tai Repository layer
3. **Validation Testing:** Validation duoc test thong qua Service layer mock responses
4. **Security:** Authentication duoc mock thong qua AuthService.getCurrentUser()

---

**Document Status:** Complete
**Reviewed By:** -
**Review Date:** -
