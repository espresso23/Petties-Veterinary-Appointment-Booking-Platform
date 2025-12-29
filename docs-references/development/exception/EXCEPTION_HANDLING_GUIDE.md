# Exception Handling Guide - Backend Spring

Tai lieu huong dan cach xu ly Exception trong Backend Spring Boot cua du an Petties.

---

## Tong Quan Kien Truc

```mermaid
flowchart TD
    A[Client Request] --> B[Controller]
    B -->|@Valid validation| C{Validation OK?}
    C -->|No| D[MethodArgumentNotValidException]
    C -->|Yes| E[Service Layer]
    E -->|Business Error| F[Custom Exception]
    E -->|Success| G[Response 2xx]
    D --> H[GlobalExceptionHandler]
    F --> H
    H --> I[ErrorResponse JSON]
    I --> J[Client Response]
```

---

## Cau Truc Files

```
backend-spring/petties/src/main/java/com/petties/petties/exception/
├── GlobalExceptionHandler.java       # Xu ly tat ca exceptions
├── ErrorResponse.java                # Format response loi chuan
├── BadRequestException.java          # 400 Bad Request
├── UnauthorizedException.java        # 401 Unauthorized
├── ForbiddenException.java           # 403 Forbidden
├── ResourceNotFoundException.java    # 404 Not Found
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

### 6. Forbidden Exception (403 Forbidden)

**Khi xay ra:** User da dang nhap nhung khong co quyen

**Exception:** `ForbiddenException`, `AccessDeniedException`

**Cach su dung:**
```java
if (!user.hasPermission(resource)) {
    throw new ForbiddenException("Ban khong co quyen truy cap tai nguyen nay");
}
```

**Response:**
```json
{
    "status": 403,
    "error": "Forbidden",
    "message": "Ban khong co quyen truy cap tai nguyen nay"
}
```

---

### 7. Internal Server Error (500 Internal Server Error)

**Khi xay ra:** Loi khong xac dinh (catch-all)

**Exception:** `Exception` (generic)

**Xu ly:** GlobalExceptionHandler se:
- Log full stack trace voi `log.error()` (khong dung `printStackTrace()`)
- Tra ve message tieng Viet cho user
- Khong expose chi tiet loi noi bo

**Response:**
```json
{
    "status": 500,
    "error": "Internal Server Error",
    "message": "Da xay ra loi khong mong muon. Vui long thu lai sau hoac lien he bo phan ho tro"
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

### Controller Integration Test
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

### GlobalExceptionHandler Unit Test

File: `src/test/java/com/petties/petties/exception/GlobalExceptionHandlerTest.java`

```java
@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @InjectMocks
    private GlobalExceptionHandler exceptionHandler;

    @Mock
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        when(request.getRequestURI()).thenReturn("/api/v1/test");
    }

    @Test
    void handleBadCredentialsException_ShouldReturnVietnameseMessage() {
        BadCredentialsException ex = new BadCredentialsException("Bad credentials");

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleBadCredentials(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().getMessage())
            .isEqualTo("Ten dang nhap hoac mat khau khong dung");
    }

    @Test
    void handleForbiddenException_WithNullMessage_ShouldUseFallback() {
        ForbiddenException ex = new ForbiddenException(null);

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleForbidden(ex, request);

        assertThat(response.getBody().getMessage())
            .isEqualTo("Ban khong co quyen truy cap tai nguyen nay");
    }
}
```

---

## Logging Best Practices

### DO: Su dung SLF4J Logger

```java
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        // Log full stack trace voi logger
        log.error("Unexpected error occurred at {}: ", request.getRequestURI(), ex);

        // Tra ve message generic cho user
        ErrorResponse error = ErrorResponse.builder()
                .message("Da xay ra loi khong mong muon...")
                .build();
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
```

### DON'T: Su dung printStackTrace()

```java
// KHONG LAM
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
    ex.printStackTrace();  // KHONG - khong production-ready
    // ...
}
```

### Log Levels

| Level | Khi su dung | Vi du |
|-------|-------------|-------|
| `log.error()` | 500 Internal Server Error | Unexpected exceptions |
| `log.warn()` | 401, 403, security events | Bad credentials, access denied |
| `log.info()` | Business events | User registered, order created |
| `log.debug()` | Development debugging | Request/response details |

---

## Vietnamese Message Guidelines

### Quy tac 1: Tat ca user-facing messages phai bang tieng Viet

```java
// TOT
throw new BadRequestException("Mat khau khong chinh xac");

// KHONG TOT
throw new BadRequestException("Invalid password");
```

### Quy tac 2: Fallback message khi null/empty

```java
@ExceptionHandler(ForbiddenException.class)
public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex, HttpServletRequest request) {
    String message = ex.getMessage();
    if (message == null || message.trim().isEmpty()) {
        message = "Ban khong co quyen truy cap tai nguyen nay";  // Fallback
    }
    // ...
}
```

### Quy tac 3: Internal logs co the bang tieng Anh

```java
// User-facing message - tieng Viet
throw new BadRequestException("Mat khau khong chinh xac");

// Internal logging - tieng Anh OK
log.warn("Bad credentials attempt for user: {}", username);
```

---

## HTTP Status Codes Summary

| Status | Ten | Khi su dung | Exception Class |
|--------|-----|-------------|-----------------|
| 400 | Bad Request | Validation failed, invalid request | `BadRequestException`, `MethodArgumentNotValidException` |
| 401 | Unauthorized | Chua dang nhap, token invalid | `UnauthorizedException`, `BadCredentialsException` |
| 403 | Forbidden | Da dang nhap nhung khong co quyen | `ForbiddenException`, `AccessDeniedException` |
| 404 | Not Found | Resource khong ton tai | `ResourceNotFoundException` |
| 409 | Conflict | Resource da ton tai (duplicate) | `ResourceAlreadyExistsException` |
| 500 | Internal Server Error | Loi server khong xac dinh | `Exception` (generic) |

---

**Last Updated:** 2025-12-24
**Maintained By:** Petties Team
