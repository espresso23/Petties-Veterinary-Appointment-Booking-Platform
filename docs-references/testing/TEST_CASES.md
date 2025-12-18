# PETTIES - Test Cases Document

**Version:** 1.2
**Last Updated:** 2025-12-19

---

## Feature Test Reports

| Feature | Report Location | Status |
|---------|-----------------|--------|
| User Profile API | [features/USER_PROFILE_API_TEST.md](features/USER_PROFILE_API_TEST.md) | Complete |
| Authentication API | [features/AUTH_API_TEST_REPORT.md](features/AUTH_API_TEST_REPORT.md) | Complete |

---

## 1. Authentication API Test Cases

### TC-AUTH-001: Login with Valid Credentials

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/auth/login |
| **Description** | User logs in with correct email and password |
| **Preconditions** | User exists and is ACTIVE |
| **Request** | `{"email": "user@test.com", "password": "Password123"}` |
| **Expected** | Status 200, returns accessToken and refreshToken |

### TC-AUTH-002: Login with Invalid Password

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/auth/login |
| **Description** | User logs in with wrong password |
| **Preconditions** | User exists |
| **Request** | `{"email": "user@test.com", "password": "wrongpass"}` |
| **Expected** | Status 401, message: "Invalid username or password" |

### TC-AUTH-003: Login with Different Roles

| Role | Expected Response |
|------|-------------------|
| **PET_OWNER** | Status 200, role: "PET_OWNER" |
| **VET** | Status 200, role: "VET" |
| **CLINIC_MANAGER** | Status 200, role: "CLINIC_MANAGER" |

### TC-AUTH-004: Registration Flow with OTP (2 Steps)

**Step 1: Send Registration OTP**
- **Endpoint:** POST /auth/register/send-otp
- **Request:** `{"username": "test", "email": "test@gmail.com", "password": "...", "fullName": "...", "role": "PET_OWNER"}`
- **Expected:** Status 200, returns SendOtpResponse (message: OTP sent)

**Step 2: Verify OTP & Register**
- **Endpoint:** POST /auth/register/verify-otp
- **Request:** `{"email": "test@gmail.com", "otpCode": "123456"}`
- **Expected:** Status 201, returns AuthResponse with tokens

### TC-AUTH-005: Password Reset Flow (2 Steps)

**Step 1: Forgot Password (Send OTP)**
- **Endpoint:** POST /auth/forgot-password
- **Request:** `{"email": "user@gmail.com"}`
- **Expected:** Status 200, returns SendOtpResponse

**Step 2: Reset Password**
- **Endpoint:** POST /auth/reset-password
- **Request:** `{"email": "user@gmail.com", "otpCode": "123456", "newPassword": "...", "confirmPassword": "..."}`
- **Expected:** Status 200, returns MessageResponse (Đổi mật khẩu thành công)

### TC-AUTH-006: OTP Cooldown & Resend

- **Endpoint:** POST /auth/register/resend-otp (or /forgot-password/resend-otp)
- **Condition:** Wait 60s cooldown before resending.
- **Expected:** Status 200, returns new OTP expiry info.

---

## 2. Pet API Test Cases

### TC-PET-001: Create Pet

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/pets |
| **Description** | Pet owner creates new pet profile |
| **Auth** | Bearer token (PET_OWNER role) |
| **Request** | `{"name": "Buddy", "species": "DOG", "breed": "Golden Retriever"}` |
| **Expected** | Status 201, returns pet with ID |

### TC-PET-002: Get My Pets

| Field | Value |
|-------|-------|
| **Endpoint** | GET /api/pets/my-pets |
| **Description** | Get list of pets owned by current user |
| **Auth** | Bearer token (PET_OWNER role) |
| **Expected** | Status 200, returns array of pets |

### TC-PET-003: Update Pet

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/pets/{petId} |
| **Description** | Update pet information |
| **Auth** | Bearer token (owner of pet) |
| **Expected** | Status 200, returns updated pet |

### TC-PET-004: Delete Pet

| Field | Value |
|-------|-------|
| **Endpoint** | DELETE /api/pets/{petId} |
| **Description** | Soft delete pet |
| **Auth** | Bearer token (owner of pet) |
| **Expected** | Status 204, no content |

---

## 3. Booking API Test Cases

### TC-BOOK-001: Create Booking

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/bookings |
| **Description** | Pet owner creates new booking |
| **Auth** | Bearer token (PET_OWNER role) |
| **Request** | `{"petId": "...", "clinicId": "...", "serviceId": "...", "date": "2025-12-20", "time": "09:00"}` |
| **Expected** | Status 201, booking status = PENDING |

### TC-BOOK-002: Assign Vet to Booking

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/bookings/{bookingId}/assign |
| **Description** | Manager assigns vet to booking |
| **Auth** | Bearer token (CLINIC_MANAGER role) |
| **Request** | `{"vetId": "..."}` |
| **Expected** | Status 200, booking status = ASSIGNED |

### TC-BOOK-003: Vet Accepts Booking

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/bookings/{bookingId}/confirm |
| **Description** | Vet accepts assigned booking |
| **Auth** | Bearer token (VET role) |
| **Expected** | Status 200, booking status = CONFIRMED |

### TC-BOOK-004: Cancel Booking

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/bookings/{bookingId}/cancel |
| **Description** | Pet owner cancels booking |
| **Auth** | Bearer token (PET_OWNER role) |
| **Expected** | Status 200, booking status = CANCELLED |

---

## 4. Clinic API Test Cases

### TC-CLINIC-001: Register Clinic

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/clinics |
| **Description** | Clinic owner registers new clinic |
| **Auth** | Bearer token (CLINIC_OWNER role) |
| **Expected** | Status 201, clinic status = PENDING |

### TC-CLINIC-002: Admin Approves Clinic

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/clinics/{clinicId}/approve |
| **Description** | Admin approves clinic registration |
| **Auth** | Bearer token (ADMIN role) |
| **Expected** | Status 200, clinic status = APPROVED |

---

## 5. User Profile API Test Cases

> **Full Report:** [features/USER_PROFILE_API_TEST.md](features/USER_PROFILE_API_TEST.md)

### TC-PROFILE-001: Get Profile

| Field | Value |
|-------|-------|
| **Endpoint** | GET /api/users/profile |
| **Description** | User lay thong tin profile hien tai |
| **Auth** | Bearer token (any authenticated user) |
| **Expected** | Status 200, returns UserResponse |

### TC-PROFILE-002: Update Profile

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/users/profile |
| **Description** | Cap nhat fullName va phone |
| **Auth** | Bearer token |
| **Request** | `{"fullName": "New Name", "phone": "0987654321"}` |
| **Expected** | Status 200, returns updated UserResponse |

### TC-PROFILE-003: Upload Avatar

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/users/profile/avatar |
| **Description** | Upload avatar moi (Cloudinary) |
| **Auth** | Bearer token |
| **Request** | MultipartFile (JPEG, PNG, GIF, WEBP - max 10MB) |
| **Expected** | Status 200, returns AvatarResponse with URL |

### TC-PROFILE-004: Delete Avatar

| Field | Value |
|-------|-------|
| **Endpoint** | DELETE /api/users/profile/avatar |
| **Description** | Xoa avatar hien tai |
| **Auth** | Bearer token |
| **Expected** | Status 200, avatarUrl = null |

### TC-PROFILE-005: Change Password

| Field | Value |
|-------|-------|
| **Endpoint** | PUT /api/users/profile/password |
| **Description** | Doi mat khau |
| **Auth** | Bearer token |
| **Request** | `{"currentPassword": "...", "newPassword": "...", "confirmPassword": "..."}` |
| **Expected** | Status 200, message: "Doi mat khau thanh cong" |

---

## 6. Test Execution Log

| Test ID | Date | Tester | Result | Notes |
|---------|------|--------|--------|-------|
| TC-AUTH-003 | 2025-12-19 | Auto | PASSED | Login by Role (VET, OWNER, MANAGER) |
| TC-AUTH-004 | 2025-12-19 | Auto | PASSED | Registration OTP Flow |
| TC-AUTH-005 | 2025-12-19 | Auto | PASSED | Password Reset OTP Flow |
| TC-AUTH-006 | 2025-12-19 | Auto | PASSED | OTP Resend & Cooldown |
| TC-PROFILE-001 | 2025-12-18 | Auto | PASSED | Unit Test |
| TC-PROFILE-002 | 2025-12-18 | Auto | PASSED | Unit Test |
| TC-PROFILE-003 | 2025-12-18 | Auto | PASSED | Unit Test |
| TC-PROFILE-004 | 2025-12-18 | Auto | PASSED | Unit Test |
| TC-PROFILE-005 | 2025-12-18 | Auto | PASSED | Unit Test |

---

**Document Status:** In Progress
