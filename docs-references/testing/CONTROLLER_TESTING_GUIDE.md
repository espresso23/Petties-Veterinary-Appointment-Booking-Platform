# PETTIES - Controller Testing Guide

**Version:** 1.0
**Last Updated:** 2025-12-20
**Project:** Petties - Veterinary Appointment Booking Platform

---

## 1. Overview

Tất cả controller tests trong Petties dùng **MockMvc + @WebMvcTest** pattern. Đây là **Unit Tests** (không connect database, không connect internet), nhưng test HTTP layer hoàn chỉnh.

**Mục tiêu:**
- Test HTTP endpoints hoạt động đúng
- Verify validation, status codes, JSON serialization
- Fast, isolated, repeatable

---

## 2. Quick Start Template

### Basic Setup

```java
package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(YourController.class)
@DisplayName("YourController Unit Tests")
class YourControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private YourService yourService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void methodName_condition_expectedResult() throws Exception {
        // Arrange: Mock service
        when(yourService.method(any())).thenReturn(mockData);

        // Act & Assert: Test HTTP
        mockMvc.perform(post("/api/endpoint")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.field").value("expected"));
    }
}
```

---

## 3. Common Patterns

### 3.1 Testing GET Request

```java
@Test
void getProfile_authenticatedUser_returns200() throws Exception {
    // Arrange
    UserResponse mockResponse = UserResponse.builder()
        .userId(UUID.randomUUID())
        .username("testuser")
        .email("test@example.com")
        .build();

    when(userService.getUserById(any())).thenReturn(mockResponse);

    // Act & Assert
    mockMvc.perform(get("/api/users/profile")
            .header("Authorization", "Bearer token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value("testuser"))
        .andExpect(jsonPath("$.email").value("test@example.com"));
}
```

### 3.2 Testing POST with Request Body

```java
@Test
void createPet_validData_returns201() throws Exception {
    // Arrange
    CreatePetRequest request = CreatePetRequest.builder()
        .name("Buddy")
        .species("DOG")
        .build();

    PetResponse mockResponse = PetResponse.builder()
        .petId(UUID.randomUUID())
        .name("Buddy")
        .species("DOG")
        .build();

    when(petService.createPet(any())).thenReturn(mockResponse);

    // Act & Assert
    mockMvc.perform(post("/api/pets")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer token")
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Buddy"))
        .andExpect(jsonPath("$.species").value("DOG"));
}
```

### 3.3 Testing Validation (400 Bad Request)

```java
@Test
void updateProfile_blankFullName_returns400() throws Exception {
    // Arrange
    UpdateProfileRequest request = UpdateProfileRequest.builder()
        .fullName("") // Blank - violates @NotBlank
        .phone("0987654321")
        .build();

    // Act & Assert
    mockMvc.perform(put("/api/users/profile")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer token")
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").exists());
}
```

### 3.4 Testing Unauthorized (401)

```java
@Test
void getProfile_noToken_returns401() throws Exception {
    // Act & Assert
    mockMvc.perform(get("/api/users/profile"))
        .andExpect(status().isUnauthorized());
}
```

### 3.5 Testing Not Found (404)

```java
@Test
void getPet_notFound_returns404() throws Exception {
    // Arrange
    UUID petId = UUID.randomUUID();
    when(petService.getPetById(petId))
        .thenThrow(new ResourceNotFoundException("Không tìm thấy thú cưng"));

    // Act & Assert
    mockMvc.perform(get("/api/pets/{petId}", petId)
            .header("Authorization", "Bearer token"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Không tìm thấy thú cưng"));
}
```

### 3.6 Testing Multipart File Upload

```java
@Test
void uploadAvatar_validImage_returns200() throws Exception {
    // Arrange
    MockMultipartFile file = new MockMultipartFile(
        "file",
        "avatar.jpg",
        "image/jpeg",
        "test image content".getBytes()
    );

    UserResponse mockResponse = UserResponse.builder()
        .avatar("https://cloudinary.com/avatar.jpg")
        .build();

    when(userService.uploadAvatar(any(), any())).thenReturn(mockResponse);

    // Act & Assert
    mockMvc.perform(multipart("/api/users/profile/avatar")
            .file(file)
            .header("Authorization", "Bearer token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.avatar").exists());
}
```

---

## 4. Best Practices

### ✅ DO:

1. **Test HTTP layer only** - status codes, validation, serialization
2. **Mock all services** - với `@MockBean`
3. **Use descriptive test names** - `methodName_condition_expectedResult`
4. **Test all status codes** - 200, 400, 401, 403, 404
5. **Test validation annotations** - `@NotBlank`, `@Size`, `@Pattern`
6. **Use @Nested classes** - group tests by endpoint

```java
@Nested
@DisplayName("POST /api/auth/login")
class LoginTests {

    @Test
    void login_validCredentials_returns200() { }

    @Test
    void login_blankEmail_returns400() { }

    @Test
    void login_wrongPassword_returns401() { }
}
```

### ❌ DON'T:

1. **Don't test business logic** - đó là service layer responsibility
2. **Don't use real database** - mock services instead
3. **Don't make network calls** - isolated tests only
4. **Don't test service layer logic** - focus on HTTP contract

---

## 5. File Structure

```
backend-spring/petties/src/test/java/com/petties/petties/
└── controller/
    ├── AuthControllerUnitTest.java
    ├── UserControllerUnitTest.java
    ├── PetControllerUnitTest.java
    ├── BookingControllerUnitTest.java
    └── ClinicControllerUnitTest.java
```

**Naming Convention:**
- Files: `*ControllerUnitTest.java`
- Methods: `methodName_condition_expectedResult`

---

## 6. Running Tests

### Run all controller tests
```bash
cd backend-spring/petties
mvn test -Dtest="*ControllerUnitTest"
```

### Run single test class
```bash
mvn test -Dtest=UserControllerUnitTest
```

### Run specific test method
```bash
mvn test -Dtest=UserControllerUnitTest#getProfile_authenticatedUser_returns200
```

### Run with coverage
```bash
mvn clean test jacoco:report
# Report: target/site/jacoco/index.html
```

---

## 7. Testing Authentication/Authorization

### With @WithMockUser (Simple)

```java
@Test
@DisplayName("GET /api/admin/dashboard - Admin role should return 200")
@WithMockUser(username = "admin", roles = "ADMIN")
void adminDashboard_adminRole_returns200() throws Exception {
    mockMvc.perform(get("/api/admin/dashboard"))
        .andExpect(status().isOk());
}
```

### Testing Role-Based Access

```java
@Test
@DisplayName("DELETE /api/clinics/{id} - Non-admin should return 403")
@WithMockUser(roles = "CLINIC_OWNER")
void deleteClinic_nonAdmin_returns403() throws Exception {
    mockMvc.perform(delete("/api/clinics/{id}", UUID.randomUUID()))
        .andExpect(status().isForbidden());
}
```

---

## 8. Testing GlobalExceptionHandler

```java
@Test
void createPet_duplicateName_returns400() throws Exception {
    // Arrange
    CreatePetRequest request = new CreatePetRequest("Buddy", "DOG");

    when(petService.createPet(any()))
        .thenThrow(new BadRequestException("Tên thú cưng đã tồn tại"));

    // Act & Assert
    mockMvc.perform(post("/api/pets")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer token")
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Tên thú cưng đã tồn tại"));
}
```

---

## 9. Summary

| Aspect | Details |
|--------|---------|
| **Purpose** | Test HTTP layer (không test business logic) |
| **Annotation** | `@WebMvcTest(Controller.class)` |
| **Speed** | Fast (~100ms/test) |
| **Database** | NO - mock services with `@MockBean` |
| **Network** | NO - in-memory HTTP simulation |
| **Coverage Target** | ≥ 80% for controller classes |

---

**Next Steps:**
1. Read this guide before writing tests
2. Use templates from Section 2 & 3
3. Follow best practices in Section 4
4. Run tests before committing

---

**Document Status:** Active
**Maintained By:** Petties Team
