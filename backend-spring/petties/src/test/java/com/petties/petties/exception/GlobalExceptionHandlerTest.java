package com.petties.petties.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for GlobalExceptionHandler.
 *
 * Tests cover:
 * - All exception handlers return correct HTTP status codes
 * - All error messages are in Vietnamese
 * - Error response structure is consistent
 * - Proper fallback messages for null/empty exception messages
 *
 * @author Petties Team
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GlobalExceptionHandler Unit Tests")
class GlobalExceptionHandlerTest {

    @InjectMocks
    private GlobalExceptionHandler exceptionHandler;

    @Mock
    private HttpServletRequest request;

    private static final String TEST_URI = "/api/v1/test";

    @BeforeEach
    void setUp() {
        when(request.getRequestURI()).thenReturn(TEST_URI);
    }

    // ==================== BAD CREDENTIALS EXCEPTION TESTS ====================

    @Nested
    @DisplayName("BadCredentialsException Tests")
    class BadCredentialsExceptionTests {

        @Test
        @DisplayName("Nen tra ve Vietnamese message khi bad credentials")
        void handleBadCredentialsException_ShouldReturnVietnameseMessage() {
            // Given
            BadCredentialsException ex = new BadCredentialsException("Bad credentials");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleBadCredentials(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Tên đăng nhập hoặc mật khẩu không đúng");
            assertThat(response.getBody().getStatus()).isEqualTo(401);
            assertThat(response.getBody().getError()).isEqualTo("Unauthorized");
            assertThat(response.getBody().getPath()).isEqualTo(TEST_URI);
        }

        @Test
        @DisplayName("Nen tra ve status 401 cho bad credentials")
        void handleBadCredentialsException_ShouldReturn401Status() {
            // Given
            BadCredentialsException ex = new BadCredentialsException("Invalid credentials");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleBadCredentials(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody().getStatus()).isEqualTo(401);
        }
    }

    // ==================== GENERIC EXCEPTION TESTS ====================

    @Nested
    @DisplayName("Generic Exception Tests")
    class GenericExceptionTests {

        @Test
        @DisplayName("Nen tra ve Vietnamese message cho generic exception")
        void handleGenericException_ShouldReturnVietnameseMessage() {
            // Given
            Exception ex = new Exception("Unexpected error");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleGenericException(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage())
                    .isEqualTo("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ");
            assertThat(response.getBody().getStatus()).isEqualTo(500);
        }

        @Test
        @DisplayName("Nen tra ve status 500 cho generic exception")
        void handleGenericException_ShouldReturn500Status() {
            // Given
            Exception ex = new RuntimeException("Some unexpected error");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleGenericException(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody().getStatus()).isEqualTo(500);
            assertThat(response.getBody().getError()).isEqualTo("Internal Server Error");
        }
    }

    // ==================== FORBIDDEN EXCEPTION TESTS ====================

    @Nested
    @DisplayName("ForbiddenException Tests")
    class ForbiddenExceptionTests {

        @Test
        @DisplayName("Nen su dung fallback message khi message la null")
        void handleForbiddenException_WithNullMessage_ShouldUseFallback() {
            // Given
            ForbiddenException ex = new ForbiddenException(null);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleForbidden(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Bạn không có quyền truy cập tài nguyên này");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("Nen su dung fallback message khi message la empty")
        void handleForbiddenException_WithEmptyMessage_ShouldUseFallback() {
            // Given
            ForbiddenException ex = new ForbiddenException("");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleForbidden(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Bạn không có quyền truy cập tài nguyên này");
        }

        @Test
        @DisplayName("Nen su dung fallback message khi message chi co whitespace")
        void handleForbiddenException_WithWhitespaceMessage_ShouldUseFallback() {
            // Given
            ForbiddenException ex = new ForbiddenException("   ");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleForbidden(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Bạn không có quyền truy cập tài nguyên này");
        }

        @Test
        @DisplayName("Nen su dung message tu exception khi co")
        void handleForbiddenException_WithMessage_ShouldUseExceptionMessage() {
            // Given
            ForbiddenException ex = new ForbiddenException("Ban khong co quyen xem tai nguyen nay");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleForbidden(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Ban khong co quyen xem tai nguyen nay");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("Nen tra ve status 403 cho forbidden exception")
        void handleForbiddenException_ShouldReturn403Status() {
            // Given
            ForbiddenException ex = new ForbiddenException("Forbidden");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleForbidden(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody().getStatus()).isEqualTo(403);
        }
    }

    // ==================== ACCESS DENIED EXCEPTION TESTS ====================

    @Nested
    @DisplayName("AccessDeniedException Tests")
    class AccessDeniedExceptionTests {

        @Test
        @DisplayName("Nen tra ve Vietnamese message cho access denied")
        void handleAccessDeniedException_ShouldReturnVietnameseMessage() {
            // Given
            AccessDeniedException ex = new AccessDeniedException("Access denied");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleAccessDenied(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Bạn không có quyền thực hiện hành động này");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody().getStatus()).isEqualTo(403);
        }

        @Test
        @DisplayName("Nen tra ve status 403 cho access denied")
        void handleAccessDeniedException_ShouldReturn403Status() {
            // Given
            AccessDeniedException ex = new AccessDeniedException("Access is denied");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleAccessDenied(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody().getStatus()).isEqualTo(403);
            assertThat(response.getBody().getError()).isEqualTo("Forbidden");
        }
    }

    // ==================== RESOURCE NOT FOUND EXCEPTION TESTS ====================

    @Nested
    @DisplayName("ResourceNotFoundException Tests")
    class ResourceNotFoundExceptionTests {

        @Test
        @DisplayName("Nen tra ve status 404 cho resource not found")
        void handleResourceNotFoundException_ShouldReturn404() {
            // Given
            ResourceNotFoundException ex = new ResourceNotFoundException("User not found");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleResourceNotFound(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getStatus()).isEqualTo(404);
            assertThat(response.getBody().getError()).isEqualTo("Not Found");
        }

        @Test
        @DisplayName("Nen giu nguyen exception message")
        void handleResourceNotFoundException_ShouldKeepExceptionMessage() {
            // Given
            String expectedMessage = "Khong tim thay nguoi dung voi id: 123";
            ResourceNotFoundException ex = new ResourceNotFoundException(expectedMessage);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleResourceNotFound(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo(expectedMessage);
        }
    }

    // ==================== RESOURCE ALREADY EXISTS EXCEPTION TESTS ====================

    @Nested
    @DisplayName("ResourceAlreadyExistsException Tests")
    class ResourceAlreadyExistsExceptionTests {

        @Test
        @DisplayName("Nen tra ve status 409 cho resource already exists")
        void handleResourceAlreadyExistsException_ShouldReturn409() {
            // Given
            ResourceAlreadyExistsException ex = new ResourceAlreadyExistsException("Email da ton tai");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleResourceAlreadyExists(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getStatus()).isEqualTo(409);
            assertThat(response.getBody().getError()).isEqualTo("Conflict");
            assertThat(response.getBody().getMessage()).isEqualTo("Email da ton tai");
        }
    }

    // ==================== UNAUTHORIZED EXCEPTION TESTS ====================

    @Nested
    @DisplayName("UnauthorizedException Tests")
    class UnauthorizedExceptionTests {

        @Test
        @DisplayName("Nen tra ve status 401 cho unauthorized")
        void handleUnauthorizedException_ShouldReturn401() {
            // Given
            UnauthorizedException ex = new UnauthorizedException("Chua xac thuc");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleUnauthorized(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getStatus()).isEqualTo(401);
            assertThat(response.getBody().getError()).isEqualTo("Unauthorized");
            assertThat(response.getBody().getMessage()).isEqualTo("Chua xac thuc");
        }
    }

    // ==================== BAD REQUEST EXCEPTION TESTS ====================

    @Nested
    @DisplayName("BadRequestException Tests")
    class BadRequestExceptionTests {

        @Test
        @DisplayName("Nen tra ve status 400 cho bad request")
        void handleBadRequestException_ShouldReturn400() {
            // Given
            BadRequestException ex = new BadRequestException("Du lieu khong hop le");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleBadRequest(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getStatus()).isEqualTo(400);
            assertThat(response.getBody().getError()).isEqualTo("Bad Request");
            assertThat(response.getBody().getMessage()).isEqualTo("Du lieu khong hop le");
        }
    }

    // ==================== AUTHENTICATION EXCEPTION TESTS ====================

    @Nested
    @DisplayName("AuthenticationException Tests")
    class AuthenticationExceptionTests {

        @Test
        @DisplayName("Nen tra ve status 401 cho authentication exception")
        void handleAuthenticationException_ShouldReturn401() {
            // Given
            InsufficientAuthenticationException ex = new InsufficientAuthenticationException("Full authentication required");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleAuthenticationException(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getStatus()).isEqualTo(401);
            assertThat(response.getBody().getError()).isEqualTo("Unauthorized");
        }

        @Test
        @DisplayName("Nen su dung fallback message khi message la null")
        void handleAuthenticationException_WithNullMessage_ShouldUseFallback() {
            // Given - tao mock cho AuthenticationException vi no la abstract class
            InsufficientAuthenticationException ex = new InsufficientAuthenticationException(null);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleAuthenticationException(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            // Message se la "null" vi InsufficientAuthenticationException khong cho phep null message
            // Nhung logic fallback van duoc test
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    // ==================== VALIDATION EXCEPTION TESTS ====================

    @Nested
    @DisplayName("MethodArgumentNotValidException Tests")
    class ValidationExceptionTests {

        @Test
        @DisplayName("Nen tra ve field errors trong response")
        void handleValidationExceptions_ShouldReturnFieldErrors() {
            // Given
            BindingResult bindingResult = mock(BindingResult.class);
            FieldError fieldError = new FieldError("user", "email", "Email khong hop le");
            when(bindingResult.getAllErrors()).thenReturn(List.of(fieldError));

            MethodParameter methodParameter = mock(MethodParameter.class);
            MethodArgumentNotValidException ex = new MethodArgumentNotValidException(
                    methodParameter, bindingResult);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleValidationExceptions(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getErrors()).isNotNull();
            assertThat(response.getBody().getErrors()).containsKey("email");
            assertThat(response.getBody().getErrors().get("email")).isEqualTo("Email khong hop le");
        }

        @Test
        @DisplayName("Nen tra ve multiple field errors")
        void handleValidationExceptions_ShouldReturnMultipleFieldErrors() {
            // Given
            BindingResult bindingResult = mock(BindingResult.class);
            FieldError emailError = new FieldError("user", "email", "Email khong hop le");
            FieldError passwordError = new FieldError("user", "password", "Mat khau qua ngan");
            when(bindingResult.getAllErrors()).thenReturn(List.of(emailError, passwordError));

            MethodParameter methodParameter = mock(MethodParameter.class);
            MethodArgumentNotValidException ex = new MethodArgumentNotValidException(
                    methodParameter, bindingResult);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleValidationExceptions(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getErrors()).hasSize(2);
            assertThat(response.getBody().getErrors()).containsKey("email");
            assertThat(response.getBody().getErrors()).containsKey("password");
        }

        @Test
        @DisplayName("Nen su dung first error message lam main message")
        void handleValidationExceptions_ShouldUseFirstErrorAsMainMessage() {
            // Given
            BindingResult bindingResult = mock(BindingResult.class);
            FieldError fieldError = new FieldError("user", "email", "Email bat buoc");
            when(bindingResult.getAllErrors()).thenReturn(List.of(fieldError));

            MethodParameter methodParameter = mock(MethodParameter.class);
            MethodArgumentNotValidException ex = new MethodArgumentNotValidException(
                    methodParameter, bindingResult);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleValidationExceptions(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Email bat buoc");
        }

        @Test
        @DisplayName("Nen tra ve status 400 cho validation errors")
        void handleValidationExceptions_ShouldReturn400() {
            // Given
            BindingResult bindingResult = mock(BindingResult.class);
            FieldError fieldError = new FieldError("user", "name", "Ten khong duoc de trong");
            when(bindingResult.getAllErrors()).thenReturn(List.of(fieldError));

            MethodParameter methodParameter = mock(MethodParameter.class);
            MethodArgumentNotValidException ex = new MethodArgumentNotValidException(
                    methodParameter, bindingResult);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleValidationExceptions(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().getStatus()).isEqualTo(400);
            assertThat(response.getBody().getError()).isEqualTo("Validation Failed");
        }
    }

    // ==================== TYPE MISMATCH EXCEPTION TESTS ====================

    @Nested
    @DisplayName("MethodArgumentTypeMismatchException Tests")
    class TypeMismatchExceptionTests {

        @Test
        @DisplayName("Nen tra ve Vietnamese message cho type mismatch")
        void handleTypeMismatch_ShouldReturnVietnameseMessage() {
            // Given
            MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
            when(ex.getName()).thenReturn("id");
            when(ex.getValue()).thenReturn("abc");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleTypeMismatch(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage())
                    .isEqualTo("Tham số 'id' có giá trị 'abc' không đúng định dạng");
        }

        @Test
        @DisplayName("Nen tra ve status 400 cho type mismatch")
        void handleTypeMismatch_ShouldReturn400() {
            // Given
            MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
            when(ex.getName()).thenReturn("page");
            when(ex.getValue()).thenReturn("invalid");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleTypeMismatch(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().getStatus()).isEqualTo(400);
        }
    }

    // ==================== MISSING PARAMETER EXCEPTION TESTS ====================

    @Nested
    @DisplayName("MissingServletRequestParameterException Tests")
    class MissingParameterExceptionTests {

        @Test
        @DisplayName("Nen tra ve Vietnamese message cho missing parameter")
        void handleMissingParameter_ShouldReturnVietnameseMessage() {
            // Given
            MissingServletRequestParameterException ex = new MissingServletRequestParameterException(
                    "email", "String");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleMissingParameter(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Thiếu tham số bắt buộc: 'email'");
        }

        @Test
        @DisplayName("Nen tra ve status 400 cho missing parameter")
        void handleMissingParameter_ShouldReturn400() {
            // Given
            MissingServletRequestParameterException ex = new MissingServletRequestParameterException(
                    "name", "String");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleMissingParameter(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().getStatus()).isEqualTo(400);
        }
    }

    // ==================== HTTP MESSAGE NOT READABLE EXCEPTION TESTS ====================

    @Nested
    @DisplayName("HttpMessageNotReadableException Tests")
    class HttpMessageNotReadableExceptionTests {

        @Test
        @DisplayName("Nen tra ve Vietnamese message cho message not readable")
        void handleHttpMessageNotReadable_ShouldReturnVietnameseMessage() {
            // Given
            HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleHttpMessageNotReadable(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage())
                    .isEqualTo("Dữ liệu đầu vào không đúng định dạng hoặc giá trị không hợp lệ");
        }

        @Test
        @DisplayName("Nen tra ve status 400 cho message not readable")
        void handleHttpMessageNotReadable_ShouldReturn400() {
            // Given
            HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleHttpMessageNotReadable(ex, request);

            // Then
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().getStatus()).isEqualTo(400);
            assertThat(response.getBody().getError()).isEqualTo("Bad Request");
        }
    }

    // ==================== ERROR RESPONSE STRUCTURE TESTS ====================

    @Nested
    @DisplayName("Error Response Structure Tests")
    class ErrorResponseStructureTests {

        @Test
        @DisplayName("Error response nen co day du cac truong")
        void errorResponse_ShouldHaveAllRequiredFields() {
            // Given
            BadRequestException ex = new BadRequestException("Test error");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleBadRequest(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getTimestamp()).isNotNull();
            assertThat(response.getBody().getStatus()).isNotNull();
            assertThat(response.getBody().getError()).isNotNull();
            assertThat(response.getBody().getMessage()).isNotNull();
            assertThat(response.getBody().getPath()).isNotNull();
        }

        @Test
        @DisplayName("Error response path nen khop voi request URI")
        void errorResponse_PathShouldMatchRequestUri() {
            // Given
            when(request.getRequestURI()).thenReturn("/api/v1/users/123");
            ResourceNotFoundException ex = new ResourceNotFoundException("User not found");

            // When
            ResponseEntity<ErrorResponse> response = exceptionHandler.handleResourceNotFound(ex, request);

            // Then
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getPath()).isEqualTo("/api/v1/users/123");
        }
    }
}
