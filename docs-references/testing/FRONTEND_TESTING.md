# Frontend Testing Documentation

## 📋 Tổng quan

Petties Frontend sử dụng **Vitest** + **React Testing Library** cho unit testing.

**Last Updated:** December 25, 2025

---

## 🛠️ Testing Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **Vitest** | Test runner | Latest |
| **React Testing Library** | Component testing | Latest |
| **@testing-library/jest-dom** | DOM matchers | Latest |
| **jsdom** | DOM environment | Latest |

---

## ✅ Implemented Tests

### Error Handler (`errorHandler.ts`)

**File:** `petties-web/src/utils/__tests__/errorHandler.test.ts`

**Status:** ✅ **26 tests passing** | Coverage: **94.73%**

#### Test Cases

| # | Test Case | Category | Status |
|---|-----------|----------|:------:|
| 1 | Parse backend error response with message | Backend Response | ✅ |
| 2 | Parse backend validation errors (first error) | Validation | ✅ |
| 3 | Handle ERR_NETWORK | Network Error | ✅ |
| 4 | Handle ERR_TIMEOUT | Network Error | ✅ |
| 5 | Handle ERR_CANCELED | Network Error | ✅ |
| 6 | Handle 403 Forbidden | HTTP Status | ✅ |
| 7 | Handle 404 Not Found | HTTP Status | ✅ |
| 8 | Handle 500 Internal Server Error | HTTP Status | ✅ |
| 9 | Handle 502 Bad Gateway | HTTP Status | ✅ |
| 10 | Handle 503 Service Unavailable | HTTP Status | ✅ |
| 11 | Handle unknown HTTP status code | HTTP Status | ✅ |
| 12 | Handle request without response | Network | ✅ |
| 13 | Handle regular Error object | Error Types | ✅ |
| 14 | Handle Error with empty message | Edge Cases | ✅ |
| 15 | Handle string error | Error Types | ✅ |
| 16 | Handle empty string error | Edge Cases | ✅ |
| 17 | Handle null error | Edge Cases | ✅ |
| 18 | Handle undefined error | Edge Cases | ✅ |
| 19 | Handle unknown object error | Edge Cases | ✅ |
| 20 | Fallback to status code message | Fallback | ✅ |
| 21 | Handle 409 Conflict | HTTP Status | ✅ |
| 22 | Handle 400 Bad Request | HTTP Status | ✅ |
| 23 | handleApiError calls showToast | Integration | ✅ |
| 24 | handleApiError with custom message | Integration | ✅ |
| 25 | handleApiError with backend error | Integration | ✅ |
| 26 | Handle null toast gracefully | Edge Cases | ✅ |

---

## 🔧 Error Handler Architecture

### Files

| File | Purpose |
|------|---------|
| `src/utils/errorHandler.ts` | Centralized error parsing utility |
| `src/utils/__tests__/errorHandler.test.ts` | Unit tests (26 cases) |

### Functions

#### `parseApiError(error: unknown): string`  
Parse any error to Vietnamese user-friendly message.

```typescript
// Input types supported:
- AxiosError (with response, code, etc.)
- Regular Error object
- String
- null/undefined

// Output: Vietnamese message string
```

#### `handleApiError(error, toast, customMessage?): void`
Parse error and show toast notification.

```typescript
// Usage in components:
catch (err: unknown) {
  handleApiError(err, toast)
}
```

---

## 📊 Error Messages Map

### Network Errors

| Code | Vietnamese Message |
|------|-------------------|
| `ERR_NETWORK` | Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng. |
| `ERR_TIMEOUT` | Yêu cầu hết thời gian chờ. Vui lòng thử lại. |
| `ERR_CANCELED` | Yêu cầu đã bị hủy. |
| `ECONNABORTED` | Kết nối bị gián đoạn. Vui lòng thử lại. |

### HTTP Status Codes

| Status | Vietnamese Message |
|--------|-------------------|
| 400 | Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin. |
| 401 | Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. |
| 403 | Bạn không có quyền truy cập tài nguyên này. |
| 404 | Không tìm thấy tài nguyên yêu cầu. |
| 409 | Dữ liệu đã tồn tại hoặc xung đột. |
| 500 | Lỗi máy chủ nội bộ. Vui lòng thử lại sau. |
| 502 | Máy chủ không phản hồi. Vui lòng thử lại sau. |
| 503 | Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau. |

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 📁 Refactored Components

Components using `parseApiError()` (DRY pattern):

| Component | Before | After |
|-----------|--------|-------|
| `LoginPage.tsx` | ❌ Manual parsing | ✅ `parseApiError(err)` |
| `RegisterPage.tsx` | ❌ Manual parsing | ✅ `parseApiError(err)` |
| `ForgotPasswordPage.tsx` | ❌ Manual parsing | ✅ `parseApiError(err)` |
| `ResetPasswordPage.tsx` | ❌ Manual parsing | ✅ `parseApiError(err)` |
| `ToolsPage.tsx` | ❌ `alert()` | ✅ `handleApiError(err, toast)` |

### Before (mỗi component)
```typescript
catch (err: any) {
  setError(
    err.response?.data?.message ||
    err.message ||
    'Fallback message'
  )
}
```

### After (centralized)
```typescript
catch (err: unknown) {
  setError(parseApiError(err))  // ← Vietnamese message
}
```

---

## 📈 Coverage Report

| File | Statements | Branches | Functions | Lines |
|------|:----------:|:--------:|:---------:|:-----:|
| `errorHandler.ts` | 94.73% | 92.31% | 100% | 94.73% |

**Target Coverage:** 80%  
**Current Coverage:** 94.73% ✅

---

## 🔗 Related Documentation

- [Backend Exception Handling](./BACKEND_TESTING.md)
- [AI Service Testing](./AI_SERVICE_TESTING.md)
