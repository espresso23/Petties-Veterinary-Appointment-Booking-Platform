# PETTIES - Test Cases Document

**Version:** 3.0
**Last Updated:** 2025-12-20

---

## Feature Test Reports

| Feature | Report Location | Status |
|---------|-----------------|--------|
| User Profile API | [features/USER_PROFILE_API_TEST.md](features/USER_PROFILE_API_TEST.md) | Complete |
| Authentication API | [features/AUTH_API_TEST_REPORT.md](features/AUTH_API_TEST_REPORT.md) | Complete |

---

## 0. Test Case Naming Convention

### Unit Tests (Controller Tests with MockMvc)
- **Prefix:** `TC-UNIT-`
- **Format:** `TC-UNIT-[MODULE]-[NUMBER]`
- **File Name:** `*ControllerUnitTest.java`
- **Examples:**
  - `TC-UNIT-AUTH-001`: Login endpoint test
  - `TC-UNIT-USER-001`: Get profile endpoint test

### System/E2E Tests
- **Prefix:** `TC-E2E-`
- **Format:** `TC-E2E-[FLOW]-[NUMBER]`
- **Examples:**
  - `TC-E2E-BOOKING-001`: Full booking flow
  - `TC-E2E-PAYMENT-001`: Payment flow

---

## 1. Authentication API Test Cases

| Test ID | Endpoint | Description | Expected Result | Status |
|---------|----------|-------------|-----------------|--------|
| TC-UNIT-AUTH-001 | POST /api/auth/login | Valid credentials | 200 OK, JWT tokens returned | ✅ Pass |
| TC-UNIT-AUTH-002 | POST /api/auth/login | Blank email | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-AUTH-003 | POST /api/auth/login | Blank password | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-AUTH-004 | POST /api/auth/login | Invalid email format | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-AUTH-005 | POST /api/auth/login | Wrong password | 401 Unauthorized | ✅ Pass |
| TC-UNIT-AUTH-006 | POST /api/auth/register/send-otp | Valid registration data | 200 OK, OTP sent | ✅ Pass |
| TC-UNIT-AUTH-007 | POST /api/auth/register/send-otp | Duplicate email | 400 Bad Request | ✅ Pass |
| TC-UNIT-AUTH-008 | POST /api/auth/register/verify-otp | Valid OTP | 201 Created, tokens returned | ✅ Pass |
| TC-UNIT-AUTH-009 | POST /api/auth/register/verify-otp | Expired OTP | 400 Bad Request | ✅ Pass |
| TC-UNIT-AUTH-010 | POST /api/auth/register/verify-otp | Invalid OTP | 400 Bad Request | ✅ Pass |
| TC-UNIT-AUTH-011 | POST /api/auth/forgot-password | Valid email | 200 OK, OTP sent | ✅ Pass |
| TC-UNIT-AUTH-012 | POST /api/auth/forgot-password | Non-existent email | 404 Not Found | ✅ Pass |
| TC-UNIT-AUTH-013 | POST /api/auth/reset-password | Valid OTP and password | 200 OK, password reset | ✅ Pass |
| TC-UNIT-AUTH-014 | POST /api/auth/reset-password | Password mismatch | 400 Bad Request | ✅ Pass |

---

## 2. User Profile API Test Cases

| Test ID | Endpoint | Description | Expected Result | Status |
|---------|----------|-------------|-----------------|--------|
| TC-UNIT-USER-001 | GET /api/users/profile | Valid token | 200 OK, user data returned | ✅ Pass |
| TC-UNIT-USER-002 | GET /api/users/profile | No token | 401 Unauthorized | ✅ Pass |
| TC-UNIT-USER-003 | GET /api/users/profile | Invalid token | 401 Unauthorized | ✅ Pass |
| TC-UNIT-USER-004 | PUT /api/users/profile | Valid fullName and phone | 200 OK, updated data | ✅ Pass |
| TC-UNIT-USER-005 | PUT /api/users/profile | Blank fullName | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-006 | PUT /api/users/profile | Invalid phone format | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-007 | PUT /api/users/profile | Phone too short | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-008 | POST /api/users/profile/avatar | Valid image (JPEG) | 200 OK, avatar URL returned | ✅ Pass |
| TC-UNIT-USER-009 | POST /api/users/profile/avatar | Valid image (PNG) | 200 OK, avatar URL returned | ✅ Pass |
| TC-UNIT-USER-010 | POST /api/users/profile/avatar | Invalid format (PDF) | 400 Bad Request | ✅ Pass |
| TC-UNIT-USER-011 | POST /api/users/profile/avatar | File too large (>10MB) | 400 Bad Request | ✅ Pass |
| TC-UNIT-USER-012 | POST /api/users/profile/avatar | Empty file | 400 Bad Request | ✅ Pass |
| TC-UNIT-USER-013 | DELETE /api/users/profile/avatar | User has avatar | 200 OK, avatar null | ✅ Pass |
| TC-UNIT-USER-014 | DELETE /api/users/profile/avatar | User has no avatar | 400 Bad Request | ✅ Pass |
| TC-UNIT-USER-015 | PUT /api/users/profile/password | Valid passwords | 200 OK, success message | ✅ Pass |
| TC-UNIT-USER-016 | PUT /api/users/profile/password | Blank current password | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-017 | PUT /api/users/profile/password | Blank new password | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-018 | PUT /api/users/profile/password | Password too short (<8 chars) | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-019 | PUT /api/users/profile/password | No uppercase letter | 400 Bad Request, validation error | ✅ Pass |
| TC-UNIT-USER-020 | PUT /api/users/profile/password | No digit | 400 Bad Request, validation error | ✅ Pass |

---

## 3. Pet API Test Cases

| Test ID | Endpoint | Description | Expected Result | Status |
|---------|----------|-------------|-----------------|--------|
| TC-UNIT-PET-001 | POST /api/pets | Valid pet data | 201 Created, pet returned | ⏳ Pending |
| TC-UNIT-PET-002 | POST /api/pets | Blank name | 400 Bad Request, validation error | ⏳ Pending |
| TC-UNIT-PET-003 | POST /api/pets | Invalid species | 400 Bad Request, validation error | ⏳ Pending |
| TC-UNIT-PET-004 | POST /api/pets | No authentication | 401 Unauthorized | ⏳ Pending |
| TC-UNIT-PET-005 | GET /api/pets/my-pets | Valid token | 200 OK, pet list returned | ⏳ Pending |
| TC-UNIT-PET-006 | GET /api/pets/my-pets | No pets | 200 OK, empty array | ⏳ Pending |
| TC-UNIT-PET-007 | GET /api/pets/{petId} | Valid petId | 200 OK, pet data returned | ⏳ Pending |
| TC-UNIT-PET-008 | GET /api/pets/{petId} | Non-existent petId | 404 Not Found | ⏳ Pending |
| TC-UNIT-PET-009 | GET /api/pets/{petId} | Invalid UUID format | 400 Bad Request | ⏳ Pending |
| TC-UNIT-PET-010 | PUT /api/pets/{petId} | Valid update data | 200 OK, updated pet | ⏳ Pending |
| TC-UNIT-PET-011 | PUT /api/pets/{petId} | Not owner | 403 Forbidden | ⏳ Pending |
| TC-UNIT-PET-012 | DELETE /api/pets/{petId} | Valid petId | 204 No Content | ⏳ Pending |
| TC-UNIT-PET-013 | DELETE /api/pets/{petId} | Not owner | 403 Forbidden | ⏳ Pending |

---

## 4. Booking API Test Cases

| Test ID | Endpoint | Description | Expected Result | Status |
|---------|----------|-------------|-----------------|--------|
| TC-UNIT-BOOK-001 | POST /api/bookings | Valid booking data | 201 Created, booking returned | ⏳ Pending |
| TC-UNIT-BOOK-002 | POST /api/bookings | Blank petId | 400 Bad Request, validation error | ⏳ Pending |
| TC-UNIT-BOOK-003 | POST /api/bookings | Blank clinicId | 400 Bad Request, validation error | ⏳ Pending |
| TC-UNIT-BOOK-004 | POST /api/bookings | Invalid date (past) | 400 Bad Request | ⏳ Pending |
| TC-UNIT-BOOK-005 | POST /api/bookings | Slot not available | 400 Bad Request | ⏳ Pending |
| TC-UNIT-BOOK-006 | PUT /api/bookings/{id}/assign | Valid vetId | 200 OK, booking assigned | ⏳ Pending |
| TC-UNIT-BOOK-007 | PUT /api/bookings/{id}/assign | Not clinic manager | 403 Forbidden | ⏳ Pending |
| TC-UNIT-BOOK-008 | PUT /api/bookings/{id}/confirm | Staff confirms | 200 OK, status CONFIRMED | ⏳ Pending |
| TC-UNIT-BOOK-009 | PUT /api/bookings/{id}/confirm | Not assigned vet | 403 Forbidden | ⏳ Pending |
| TC-UNIT-BOOK-010 | PUT /api/bookings/{id}/cancel | Pet owner cancels | 200 OK, status CANCELLED | ⏳ Pending |
| TC-UNIT-BOOK-011 | PUT /api/bookings/{id}/cancel | Already confirmed | 400 Bad Request | ⏳ Pending |

---

## 5. Clinic API Test Cases

| Test ID | Endpoint | Description | Expected Result | Status |
|---------|----------|-------------|-----------------|--------|
| TC-UNIT-CLINIC-001 | POST /api/clinics | Valid clinic data | 201 Created, clinic returned | ⏳ Pending |
| TC-UNIT-CLINIC-002 | POST /api/clinics | Blank name | 400 Bad Request, validation error | ⏳ Pending |
| TC-UNIT-CLINIC-003 | POST /api/clinics | Invalid phone | 400 Bad Request, validation error | ⏳ Pending |
| TC-UNIT-CLINIC-004 | POST /api/clinics | Not clinic owner | 403 Forbidden | ⏳ Pending |
| TC-UNIT-CLINIC-005 | PUT /api/clinics/{id}/approve | Admin approves | 200 OK, status APPROVED | ⏳ Pending |
| TC-UNIT-CLINIC-006 | PUT /api/clinics/{id}/approve | Not admin | 403 Forbidden | ⏳ Pending |
| TC-UNIT-CLINIC-007 | GET /api/clinics | List all clinics | 200 OK, clinic list | ⏳ Pending |
| TC-UNIT-CLINIC-008 | GET /api/clinics/{id} | Valid clinicId | 200 OK, clinic data | ⏳ Pending |
| TC-UNIT-CLINIC-009 | GET /api/clinics/{id} | Non-existent clinic | 404 Not Found | ⏳ Pending |

---

## 6. Test Execution Log

### Unit Tests (Implemented)

| Test ID | Date | Result | Notes |
|---------|------|--------|-------|
| TC-UNIT-AUTH-001 | 2025-12-19 | PASSED | Login endpoint test |
| TC-UNIT-AUTH-002 | 2025-12-20 | PASSED | Blank Username |
| TC-UNIT-AUTH-003 | 2025-12-20 | PASSED | Blank Password |
| TC-UNIT-AUTH-005 | 2025-12-20 | PASSED | Invalid Credentials |
| TC-UNIT-AUTH-006 | 2025-12-19 | PASSED | Send registration OTP |
| TC-UNIT-AUTH-007 | 2025-12-20 | PASSED | Email already exists |
| TC-UNIT-AUTH-008 | 2025-12-19 | PASSED | Verify OTP |
| TC-UNIT-AUTH-009 | 2025-12-20 | PASSED | Expired OTP |
| TC-UNIT-AUTH-010 | 2025-12-20 | PASSED | Invalid OTP |
| TC-UNIT-AUTH-011 | 2025-12-20 | PASSED | Forgot Password Valid |
| TC-UNIT-AUTH-012 | 2025-12-20 | PASSED | Forgot Password NotFound |
| TC-UNIT-AUTH-013 | 2025-12-19 | PASSED | Reset password |
| TC-UNIT-AUTH-014 | 2025-12-20 | PASSED | Reset Password Mismatch |
| TC-UNIT-USER-001 | 2025-12-18 | PASSED | Get profile |
| TC-UNIT-USER-002 | 2025-12-20 | PASSED | Get profile (unauth) |
| TC-UNIT-USER-004 | 2025-12-18 | PASSED | Update profile |
| TC-UNIT-USER-005 | 2025-12-20 | PASSED | Update profile (blank name) |
| TC-UNIT-USER-006 | 2025-12-20 | PASSED | Update profile (bad phone) |
| TC-UNIT-USER-007 | 2025-12-20 | PASSED | Update profile (phone length) |
| TC-UNIT-USER-008 | 2025-12-18 | PASSED | Upload avatar |
| TC-UNIT-USER-009 | 2025-12-20 | PASSED | Upload PNG |
| TC-UNIT-USER-010 | 2025-12-20 | PASSED | Upload Bad Type |
| TC-UNIT-USER-011 | 2025-12-20 | PASSED | Upload Large File |
| TC-UNIT-USER-012 | 2025-12-18 | PASSED | Upload empty file (validation) |
| TC-UNIT-USER-013 | 2025-12-18 | PASSED | Delete avatar |
| TC-UNIT-USER-014 | 2025-12-18 | PASSED | Delete non-existent avatar |
| TC-UNIT-USER-015 | 2025-12-18 | PASSED | Change password |
| TC-UNIT-USER-016 | 2025-12-20 | PASSED | Change pass (blank old) |
| TC-UNIT-USER-017 | 2025-12-20 | PASSED | Change pass (blank new) |
| TC-UNIT-USER-018 | 2025-12-20 | PASSED | Change pass (short) |
| TC-UNIT-USER-019 | 2025-12-20 | PASSED | Change pass (upp) |
| TC-UNIT-USER-020 | 2025-12-20 | PASSED | Change pass (digit) |

### System/E2E Tests

| Test ID | Date | Result | Notes |
|---------|------|--------|-------|
| TC-E2E-BOOKING-001 | TBD | PENDING | Full booking flow |
| TC-E2E-PAYMENT-001 | TBD | PENDING | Payment flow |

---

## 7. Summary Statistics

### Current Test Coverage (as of 2025-12-20)

| Module | Unit Tests Implemented | Unit Tests Pending | Total Tests |
|--------|----------------------|-------------------|-------------|
| **Authentication** | 14 ✅ | 0 ⏳ | 14 |
| **User Profile** | 20 ✅ | 0 ⏳ | 20 |
| **Pet Management** | 0 ✅ | 13 ⏳ | 13 |
| **Booking** | 0 ✅ | 11 ⏳ | 11 |
| **Clinic** | 0 ✅ | 9 ⏳ | 9 |
| **TOTAL** | **34 ✅** | **33 ⏳** | **67** |

**Legend:**
- ✅ Implemented and passing
- ⏳ Pending implementation
- ❌ Failed

### Next Steps

1. **Sprint 5-6:** Complete remaining Unit Tests for Auth and User modules (DONE)
2. **Sprint 7-8:** Implement Unit Tests for Pet and Booking modules
3. **Sprint 9-10:** Implement Unit Tests for Clinic module
4. **Sprint 11-12:** E2E System Testing with Postman/Manual testing
5. **Sprint 13:** Regression testing and final QA

---

**Document Status:** In Progress
