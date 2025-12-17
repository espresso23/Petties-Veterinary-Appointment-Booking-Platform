# PETTIES - Test Cases Document

**Version:** 1.0  
**Last Updated:** 2025-12-17

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

### TC-AUTH-003: Register New User

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/auth/register |
| **Description** | New user registration |
| **Request** | `{"email": "new@test.com", "password": "Password123", "fullName": "Test User"}` |
| **Expected** | Status 201, user created |

### TC-AUTH-004: Register with Existing Email

| Field | Value |
|-------|-------|
| **Endpoint** | POST /api/auth/register |
| **Description** | Register with email already in use |
| **Preconditions** | Email already registered |
| **Expected** | Status 409, message: "Email already exists" |

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

## 5. Test Execution Log

| Test ID | Date | Tester | Result | Notes |
|---------|------|--------|--------|-------|
| TC-AUTH-001 | | | | |
| TC-AUTH-002 | | | | |
| TC-AUTH-003 | | | | |
| ... | | | | |

---

**Document Status:** Template Ready
