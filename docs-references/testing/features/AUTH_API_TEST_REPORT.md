# Authentication & Password Reset API - Unit Test Report

**Version:** 2.0
**Last Updated:** 2025-12-20
**Feature:** Authentication, Registration (OTP), Password Reset (OTP), Google Sign-In
**Test Type:** Unit Test (Controller Layer with @WebMvcTest)

---

## 1. Overview

### 1.1 Feature Description

Hệ thống Authentication hỗ trợ các quy trình bảo mật dựa trên OTP và JWT:
- **Đăng nhập đa vai trò**: Hỗ trợ PET_OWNER, VET, CLINIC_MANAGER.
- **Đăng ký với OTP**: Quy trình 2 bước (Gửi OTP -> Xác thực & Tạo tài khoản).
- **Quên mật khẩu với OTP**: Quy trình 2 bước để đặt lại mật khẩu an toàn.
- **Google Sign-In**: Đăng nhập nhanh thông qua Google ID Token.

### 1.2 Applicable Roles

| Role | Access | Note |
|------|--------|------|
| ALL | Full | Tất cả người dùng đều có quyền truy cập các API Auth |

### 1.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Đăng nhập truyền thống (username/password) |
| POST | `/auth/register/send-otp` | Bước 1: Gửi mã OTP đăng ký |
| POST | `/auth/register/verify-otp` | Bước 2: Xác thực OTP và hoàn tất đăng ký |
| POST | `/auth/register/resend-otp` | Gửi lại OTP đăng ký |
| POST | `/auth/forgot-password` | Bước 1: Gửi mã OTP quên mật khẩu |
| POST | `/auth/forgot-password/resend-otp` | Gửi lại OTP quên mật khẩu |
| POST | `/auth/reset-password` | Bước 2: Xác thực OTP và đặt mật khẩu mới |
| POST | `/auth/google` | Đăng nhập/Đăng ký qua Google |

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
└── AuthControllerUnitTest.java
```

### 2.3 Dependencies Mocked

| Dependency | Purpose |
|------------|---------|
| `AuthService` | Mock business logic login/google auth |
| `RegistrationOtpService` | Mock logic gửi và verify OTP đăng ký |
| `PasswordResetService` | Mock logic gửi và verify OTP quên mật khẩu |
| `UserService` | Mock các thao tác user liên quan |
| `JwtTokenProvider` | Mock token generation (nếu cần) |
| `UserDetailsServiceImpl` | Mock user details loading |
| `BlacklistedTokenRepository` | Mock token blacklist check |

---

## 3. Test Cases - Authentication

### 3.1 Login

#### TC-UNIT-AUTH-001: Valid Credentials
- **Method**: `login_validCredentials_returns200`
- **Scenario**: Đăng nhập với username/password đúng.
- **Expected**: Status 200, JWT tokens returned.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-002: Blank Username
- **Method**: `login_blankUsername_returns400`
- **Scenario**: Username để trống.
- **Expected**: Status 400 Bad Request.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-003: Blank Password
- **Method**: `login_blankPassword_returns400`
- **Scenario**: Password để trống.
- **Expected**: Status 400 Bad Request.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-005: Invalid Credentials
- **Method**: `login_invalidCredentials_returns401`
- **Scenario**: Sai username hoặc password.
- **Expected**: Status 401 Unauthorized.
- **Status**: ✅ PASSED

### 3.2 Registration (OTP Flow)

#### TC-UNIT-AUTH-006: Send Registration OTP (Valid)
- **Method**: `sendRegistrationOtp_validRequest_returns200`
- **Scenario**: Gửi yêu cầu OTP hợp lệ.
- **Expected**: Status 200, OTP sent.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-007: Send OTP - Duplicate Email
- **Method**: `sendRegistrationOtp_emailAlreadyExists_returns400`
- **Scenario**: Email đã tồn tại trong hệ thống.
- **Expected**: Status 400 Bad Request.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-008: Verify OTP (Valid)
- **Method**: `verifyOtpAndRegister_validRequest_returns201`
- **Scenario**: OTP đúng, tạo tài khoản thành công.
- **Expected**: Status 201 Created, Tokens returned.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-009: Verify OTP (Expired)
- **Method**: `verifyOtpAndRegister_expiredOtpCode_returns400`
- **Scenario**: OTP đã hết hạn.
- **Expected**: Status 400 Bad Request.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-010: Verify OTP (Invalid Code)
- **Method**: `verifyOtpAndRegister_invalidOtpCode_returns400`
- **Scenario**: Mã OTP sai.
- **Expected**: Status 400 Bad Request.
- **Status**: ✅ PASSED

---

## 4. Test Cases - Password Reset

### 4.1 Forgot Password Flow

#### TC-UNIT-AUTH-011: Forgot Password (Valid Email)
- **Method**: `forgotPassword_validEmail_returns200`
- **Scenario**: Email tồn tại trong hệ thống.
- **Expected**: Status 200, OTP sent.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-012: Forgot Password (Non-existent Email)
- **Method**: `forgotPassword_emailNotFound_returns400`
- **Scenario**: Email không tồn tại.
- **Expected**: Status 400 Bad Request (Security note: In prod typically return 200 to prevent enumeration, but current requirement is 400).
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-013: Reset Password (Valid)
- **Method**: `resetPassword_validRequest_returns200`
- **Scenario**: OTP đúng, password mới hợp lệ.
- **Expected**: Status 200, Password changed.
- **Status**: ✅ PASSED

#### TC-UNIT-AUTH-014: Reset Password (Mismatch)
- **Method**: `resetPassword_passwordMismatch_returns400`
- **Scenario**: Confirm password không khớp New password.
- **Expected**: Status 400 Bad Request.
- **Status**: ✅ PASSED

---

## 5. Test Execution Summary

### 5.1 Results (Latest Run)

| Metric | Value |
|--------|-------|
| **Total Test Cases** | 14 |
| **Passed** | 14 |
| **Pass Rate** | 100% |

### 5.2 Run Command

```bash
mvn test -Dtest=AuthControllerUnitTest
```

---

**Document Status:** Complete
**Reviewed By:** Auto-generated by CI System
