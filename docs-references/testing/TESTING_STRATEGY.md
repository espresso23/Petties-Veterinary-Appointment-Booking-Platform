# PETTIES - Testing Strategy Document

**Version:** 1.0  
**Last Updated:** 2025-12-17  
**Project:** Petties - Veterinary Appointment Booking Platform

---

## 1. Overview

This document outlines the testing strategy for the Petties project, covering all testing levels from unit testing to system testing. The goal is to ensure software quality, reliability, and maintainability throughout the development lifecycle.

---

## 2. Testing Levels

### 2.1 Unit Testing (API Testing)

**Objective:** Verify individual API endpoints function correctly in isolation.

**Scope:**
- REST API endpoints (Controllers)
- Request validation
- Response format and status codes
- Error handling

**Tools:**

| Tool | Purpose |
|------|---------|
| JUnit 5 | Primary test framework |
| MockMvc | Simulate HTTP requests |
| Mockito | Mock service dependencies |
| Spring Boot Test | Test context configuration |

**Test Naming Convention:**
```
methodName_condition_expectedResult

Examples:
- login_validCredentials_returnsToken
- login_invalidPassword_returns401
- createPet_missingName_returns400
```

**Coverage Target:** 70% for critical API modules (Auth, Booking, Payment)

---

### 2.2 Integration Testing

**Objective:** Verify multiple components work together correctly.

**Scope:**
- Controller → Service → Repository flow
- Database operations (CRUD)
- Transaction management
- External service integrations

**Tools:**

| Tool | Purpose |
|------|---------|
| Spring Boot Test | Full application context |
| H2 Database | In-memory test database |
| TestContainers | PostgreSQL container (optional) |

**Test Scenarios:**

| Flow | Components Tested |
|------|------------------|
| User Registration | AuthController → AuthService → UserRepository → Database |
| Booking Creation | BookingController → BookingService → SlotService → Database |
| Payment Processing | PaymentController → PaymentService → Stripe API |

---

### 2.3 System Testing

**Objective:** Validate the complete application in a production-like environment.

**Types:**

| Type | Description | Tools |
|------|-------------|-------|
| Functional Testing | Verify features match requirements | Manual, Postman |
| API Testing | Validate all REST endpoints | Postman Collections |
| UI Testing | Test web and mobile interfaces | Manual, Browser DevTools |
| Performance Testing | Verify response times | JMeter (if needed) |
| Security Testing | Identify vulnerabilities | OWASP guidelines |

**Test Environment:**

| Environment | URL | Purpose |
|-------------|-----|---------|
| Test | api-test.petties.world | QA verification |
| Production | www.petties.world | Live environment |

---

## 3. Test Execution Process

### 3.1 Automated Testing (CI Pipeline)

```
Developer Push Code
       ↓
GitHub Actions (ci.yml)
       ↓
Build Application
       ↓
Run Unit Tests
       ↓
Run Integration Tests
       ↓
Report Results
       ↓
Pass/Fail Status on PR
```

### 3.2 Manual Testing

1. **Before PR:** Developer tests feature locally
2. **After PR Approved:** QA tests on Test environment
3. **Before Release:** Full regression testing

---

## 4. Test Case Template

### 4.1 API Test Case

| Field | Value |
|-------|-------|
| **Test ID** | TC-AUTH-001 |
| **API Endpoint** | POST /api/auth/login |
| **Description** | Verify successful login with valid credentials |
| **Preconditions** | User exists with email: test@example.com |
| **Request Body** | `{"email": "test@example.com", "password": "password123"}` |
| **Expected Response** | Status: 200, Body contains accessToken and refreshToken |
| **Actual Result** | (To be filled during execution) |
| **Status** | Pass/Fail |

---

## 5. Defect Management

### 5.1 Defect Severity

| Severity | Description | Example |
|----------|-------------|---------|
| Critical | System crash, data loss | Payment fails silently |
| High | Major feature not working | Cannot create booking |
| Medium | Feature partially working | Validation message incorrect |
| Low | Minor issues, cosmetic | Typo in error message |

### 5.2 Defect Workflow

```
New → Assigned → In Progress → Fixed → Verified → Closed
                      ↓
                  Reopened
```

---

## 6. Test Metrics

| Metric | Target |
|--------|--------|
| Unit Test Coverage | ≥ 70% |
| Test Pass Rate | ≥ 95% |
| Critical Bugs at Release | 0 |
| High Bugs at Release | 0 |
| Defect Detection Rate | ≥ 80% before production |

---

## 7. Testing Schedule

| Sprint | Testing Activities |
|--------|-------------------|
| Sprint 1-3 | Unit tests for Auth, Pet, Clinic APIs |
| Sprint 4-6 | Integration tests for Booking flow |
| Sprint 7-9 | System testing, Performance testing |
| Sprint 10-12 | Regression testing, Security testing |
| Sprint 13 | Final QA, User Acceptance Testing |

---

## 8. Responsibilities

| Role | Responsibilities |
|------|-----------------|
| **Developers** | Write unit tests, fix defects |
| **Team Leader** | Review test coverage, approve releases |
| **QA (All members)** | Execute manual tests, report defects |

---

**Document Status:** Approved  
**Maintained By:** Petties Team
