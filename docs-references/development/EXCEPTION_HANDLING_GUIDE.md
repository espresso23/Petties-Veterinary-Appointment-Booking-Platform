# Exception Handling Guide - Backend Spring

Tài liệu hướng dẫn cách xử lý Exception trong Backend Spring Boot của dự án Petties.

---

## Tổng Quan Kiến Trúc

```
Client Request
    ↓
Controller (@Valid validation)
    ↓
GlobalExceptionHandler (catch exceptions)
    ↓
ErrorResponse (standardized format)
    ↓
Client Response (JSON)
```

---

## Cấu Trúc Files

```
backend-spring/petties/src/main/java/com/petties/petties/exception/
├── GlobalExceptionHandler.java    # Xử lý tất cả exceptions
├── ErrorResponse.java             # Format response lỗi chuẩn
├── BadRequestException.java       # 400 Bad Request
├── UnauthorizedException.java     # 401 Unauthorized
├── ResourceNotFoundException.java # 404 Not Found
└── ResourceAlreadyExistsException.java # 409 Conflict
```

---

## ErrorResponse Format

Tất cả lỗi trả về theo format chuẩn:

```java
public class ErrorResponse {
    private LocalDateTime timestamp;  // Thời gian lỗi xảy ra
    private int status;               // HTTP status code
    private String error;             // Loại lỗi (Bad Request, Not Found, etc.)
    private String message;           // Message lỗi chi tiết (hiển thị cho user)
    private String path;              // API endpoint gây lỗi
    private Map<String, String> errors; // Chi tiết validation errors (optional)
}
```

**Ví dụ Response:**
```json
{
    "timestamp": "2025-12-14T10:30:00",
    "status": 400,
    "error": "Validation Failed",
    "message": "Tên đăng nhập phải từ 3 đến 50 ký tự",
    "path": "/auth/register",
    "errors": {
        "username": "Tên đăng nhập phải từ 3 đến 50 ký tự"
    }
}
```

---

## Các Loại Exception

### 1. Validation Exception (400 Bad Request)

**Khi xảy ra:** Request body không hợp lệ (validation annotations fail)

**Exception:** `MethodArgumentNotValidException`

**Cách sử dụng:** Thêm validation annotations vào DTO

```java
public class RegisterRequest {
    @NotBlank(message = "Tên đăng nhập không được để trống")
    @Size(min = 3, max = 50, message = "Tên đăng nhập phải từ 3 đến 50 ký tự")
    private String username;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    private String password;

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;
}
```

**Response:**
```json
{
    "status": 400,
    "error": "Validation Failed",
    "message": "Tên đăng nhập phải từ 3 đến 50 ký tự",
    "errors": {
        "username": "Tên đăng nhập phải từ 3 đến 50 ký tự"
    }
}
```

---

### 2. Bad Request Exception (400 Bad Request)

**Khi xảy ra:** Logic request không hợp lệ (không phải validation)

**Exception:** `BadRequestException`

**Cách sử dụng:**
```java
if (invalidCondition) {
    throw new BadRequestException("Mô tả lỗi chi tiết");
}
```

**Response:**
```json
{
    "status": 400,
    "error": "Bad Request",
    "message": "Mô tả lỗi chi tiết"
}
```

---

### 3. Unauthorized Exception (401 Unauthorized)

**Khi xảy ra:** User chưa đăng nhập hoặc token không hợp lệ

**Exception:** `UnauthorizedException`, `BadCredentialsException`, `AuthenticationException`

**Cách sử dụng:**
```java
if (!isAuthenticated) {
    throw new UnauthorizedException("Bạn cần đăng nhập để thực hiện thao tác này");
}
```

**Response:**
```json
{
    "status": 401,
    "error": "Unauthorized",
    "message": "Bạn cần đăng nhập để thực hiện thao tác này"
}
```

---

### 4. Resource Not Found Exception (404 Not Found)

**Khi xảy ra:** Không tìm thấy resource được yêu cầu

**Exception:** `ResourceNotFoundException`

**Cách sử dụng:**
```java
User user = userRepository.findById(userId)
    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId));
```

**Response:**
```json
{
    "status": 404,
    "error": "Not Found",
    "message": "Không tìm thấy người dùng với ID: abc123"
}
```

---

### 5. Resource Already Exists Exception (409 Conflict)

**Khi xảy ra:** Resource đã tồn tại (duplicate)

**Exception:** `ResourceAlreadyExistsException`

**Cách sử dụng:**
```java
if (userRepository.existsByUsername(username)) {
    throw new ResourceAlreadyExistsException("Tên đăng nhập đã được sử dụng");
}

if (userRepository.existsByEmail(email)) {
    throw new ResourceAlreadyExistsException("Email đã được sử dụng");
}
```

**Response:**
```json
{
    "status": 409,
    "error": "Conflict",
    "message": "Tên đăng nhập đã được sử dụng"
}
```

---

### 6. Internal Server Error (500 Internal Server Error)

**Khi xảy ra:** Lỗi không xác định (catch-all)

**Exception:** `Exception` (generic)

**Response:**
```json
{
    "status": 500,
    "error": "Internal Server Error",
    "message": "An unexpected error occurred"
}
```

---

## Validation Annotations Thường Dùng

| Annotation | Mô tả | Ví dụ |
|------------|-------|-------|
| `@NotBlank` | Không được null hoặc trống | `@NotBlank(message = "Không được để trống")` |
| `@NotNull` | Không được null | `@NotNull(message = "Bắt buộc")` |
| `@Size` | Kiểm tra độ dài | `@Size(min = 3, max = 50, message = "Từ 3-50 ký tự")` |
| `@Min` / `@Max` | Kiểm tra số | `@Min(value = 0, message = "Phải >= 0")` |
| `@Email` | Kiểm tra email | `@Email(message = "Email không hợp lệ")` |
| `@Pattern` | Kiểm tra regex | `@Pattern(regexp = "^[0-9]{10}$", message = "SĐT 10 số")` |
| `@Past` / `@Future` | Kiểm tra ngày | `@Past(message = "Phải là ngày trong quá khứ")` |

---

## Cách Thêm Exception Mới

### Bước 1: Tạo Custom Exception Class

```java
// exception/ForbiddenException.java
package com.petties.petties.exception;

public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
```

### Bước 2: Thêm Handler trong GlobalExceptionHandler

```java
@ExceptionHandler(ForbiddenException.class)
public ResponseEntity<ErrorResponse> handleForbidden(
        ForbiddenException ex,
        HttpServletRequest request) {
    ErrorResponse error = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.FORBIDDEN.value())
            .error("Forbidden")
            .message(ex.getMessage())
            .path(request.getRequestURI())
            .build();
    return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
}
```

### Bước 3: Sử dụng trong Service

```java
if (!user.hasPermission(resource)) {
    throw new ForbiddenException("Bạn không có quyền truy cập tài nguyên này");
}
```

---

## Best Practices

### 1. Message rõ ràng, dễ hiểu cho user

```java
// Tốt
@NotBlank(message = "Tên đăng nhập không được để trống")
@Size(min = 3, message = "Tên đăng nhập phải có ít nhất 3 ký tự")

// Không tốt
@NotBlank(message = "Required")
@Size(min = 3, message = "Too short")
```

### 2. Sử dụng tiếng Việt cho user-facing messages

```java
// User-facing message - tiếng Việt
throw new BadRequestException("Mật khẩu không chính xác");

// Internal logging - tiếng Anh
log.error("Invalid password attempt for user: {}", username);
```

### 3. Validation ở DTO, không ở Service

```java
// Tốt - Validation ở DTO
public class CreatePetRequest {
    @NotBlank(message = "Tên thú cưng không được để trống")
    private String name;
}

// Không tốt - Validation thủ công trong Service
public void createPet(CreatePetRequest request) {
    if (request.getName() == null || request.getName().isBlank()) {
        throw new BadRequestException("Tên thú cưng không được để trống");
    }
}
```

### 4. Sử dụng @Valid trong Controller

```java
@PostMapping("/register")
public ResponseEntity<AuthResponse> register(
    @Valid @RequestBody RegisterRequest request  // @Valid triggers validation
) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(authService.register(request));
}
```

### 5. Không expose internal errors ra ngoài

```java
// GlobalExceptionHandler xử lý generic Exception
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
    // Log chi tiết để debug
    log.error("Unexpected error: ", ex);

    // Trả về message generic cho user (không expose stack trace)
    ErrorResponse error = ErrorResponse.builder()
            .message("Đã xảy ra lỗi. Vui lòng thử lại sau.")
            .build();
    return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
}
```

---

## HTTP Status Codes Summary

| Status | Tên | Khi sử dụng |
|--------|-----|-------------|
| 400 | Bad Request | Validation failed, invalid request |
| 401 | Unauthorized | Chưa đăng nhập, token invalid |
| 403 | Forbidden | Đã đăng nhập nhưng không có quyền |
| 404 | Not Found | Resource không tồn tại |
| 409 | Conflict | Resource đã tồn tại (duplicate) |
| 500 | Internal Server Error | Lỗi server không xác định |

---

## Frontend Integration

### React/TypeScript

```typescript
// services/api/client.ts
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data;

    // Hiển thị message từ backend
    if (errorData?.message) {
      toast.error(errorData.message);
    }

    // Xử lý validation errors
    if (errorData?.errors) {
      Object.entries(errorData.errors).forEach(([field, message]) => {
        setFieldError(field, message as string);
      });
    }

    return Promise.reject(error);
  }
);
```

### Flutter/Dart

```dart
// data/services/api_client.dart
try {
  final response = await dio.post('/auth/register', data: request);
  return response.data;
} on DioException catch (e) {
  final errorData = e.response?.data;

  // Hiển thị message từ backend
  if (errorData != null && errorData['message'] != null) {
    throw ApiException(errorData['message']);
  }

  throw ApiException('Đã xảy ra lỗi. Vui lòng thử lại.');
}
```

---

## Testing Exceptions

```java
@Test
void register_WithShortUsername_ShouldReturnValidationError() throws Exception {
    RegisterRequest request = new RegisterRequest();
    request.setUsername("ab");  // Too short
    request.setPassword("password123");
    request.setEmail("test@example.com");

    mockMvc.perform(post("/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.errors.username").exists());
}
```

---

**Last Updated:** 2025-12-14
**Maintained By:** Petties Team
