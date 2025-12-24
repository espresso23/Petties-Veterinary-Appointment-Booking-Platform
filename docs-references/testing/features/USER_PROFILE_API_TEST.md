# User Profile API - Unit Test Report

**Version:** 2.1
**Last Updated:** 2025-12-20
**Feature:** User Profile Management
**Test Type:** Unit Test (Controller Layer with @WebMvcTest)

---

## 1. Overview

### 1.1 Feature Description

User Profile APIs cho phép người dùng quản lý thông tin cá nhân, bao gồm:
- Xem thông tin profile
- Cập nhật thông tin (fullName, phone)
- Upload/xóa avatar (Cloudinary integration)
- Đổi mật khẩu
- **Đổi Email** (yêu cầu OTP xác thực)

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
| GET | `/api/users/profile` | Lấy profile user hiện tại |
| PUT | `/api/users/profile` | Cập nhật fullName, phone |
| POST | `/api/users/profile/avatar` | Upload avatar mới |
| DELETE | `/api/users/profile/avatar` | Xóa avatar |
| PUT | `/api/users/profile/password` | Đổi mật khẩu |
| POST | `/api/users/profile/email/request-change` | Yêu cầu đổi email (Gửi OTP) |
| POST | `/api/users/profile/email/verify-change` | Xác thực đổi email (Validate OTP) |
| POST | `/api/users/profile/email/resend-otp` | Gửi lại mã OTP |

---

## 2. Test Environment

Use `UserControllerUnitTest` with JUnit 5 & Mockito.

---

## 3. Test Cases Service

### 3.1 GET /api/users/profile
* TC-001: Get Profile Success
* TC-002: Get Profile Unauthorized
* TC-003: Get Profile Not Found

### 3.2 PUT /api/users/profile
* TC-004: Update Profile Success
* TC-005: Update Profile Blank Name
* TC-006: Update Profile Invalid Phone
* TC-007: Update Profile Unauthorized

### 3.3 POST /api/users/profile/avatar
* TC-008: Upload Avatar Success
* TC-009: Upload Avatar Empty File
* TC-010: Upload Avatar Unauthorized

### 3.4 DELETE /api/users/profile/avatar
* TC-011: Delete Avatar Success
* TC-012: Delete Avatar Unauthorized

### 3.5 PUT /api/users/profile/password
* TC-013: Change Password Success
* TC-014: Change Password Wrong Current Pass
* TC-015: Change Password Unauthorized

### 3.6 POST /api/users/profile/email/request-change
* TC-016: Request Email Change Success
* TC-017: Request Email Change Blank Email
* TC-018: Request Email Change Invalid Email Format
* TC-019: Request Email Change Email Already Used
* TC-020: Request Email Change Same As Current
* TC-021: Request Email Change Unauthorized
* TC-022: Request Email Change Cooldown Active

### 3.7 POST /api/users/profile/email/verify-change
* TC-023: Verify Email Change Success
* TC-024: Verify Email Change Blank Email
* TC-025: Verify Email Change Invalid Email Format
* TC-026: Verify Email Change Blank OTP
* TC-027: Verify Email Change OTP Too Short
* TC-028: Verify Email Change OTP Too Long
* TC-029: Verify Email Change OTP Contains Letters
* TC-030: Verify Email Change Wrong OTP
* TC-031: Verify Email Change Expired OTP
* TC-032: Verify Email Change Max Attempts Reached
* TC-033: Verify Email Change Email Mismatch
* TC-034: Verify Email Change Unauthorized

### 3.8 POST /api/users/profile/email/resend-otp
* TC-035: Resend Email Change OTP Success
* TC-036: Resend Email Change OTP No Pending Request
* TC-037: Resend Email Change OTP Cooldown Active
* TC-038: Resend Email Change OTP Unauthorized
* TC-039: Resend Email Change OTP Email Already Taken

---

## 4. Test Execution Summary

### 4.1 Results

| Metric | Value |
|--------|-------|
| **Total Test Cases** | 39 |
| **Passed** | 39 |
| **Pass Rate** | 100% |

### 4.2 Run Command

```bash
mvn test -Dtest=UserControllerUnitTest
```

---
**Document Status:** Complete
