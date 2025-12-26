import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseApiError, handleApiError, type ToastContextType } from '../errorHandler'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '../../types/api'

/**
 * Helper to create mock AxiosError
 */
function createAxiosError(overrides?: Partial<AxiosError>): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed',
    config: {} as any,
    toJSON: () => ({}),
    ...overrides,
  } as AxiosError
}

describe('errorHandler', () => {
  describe('parseApiError', () => {
    // Test 1: Backend error response with message
    it('should parse backend error response with message', () => {
      const backendError: ApiErrorResponse = {
        timestamp: '2025-12-24T10:00:00',
        status: 400,
        error: 'Bad Request',
        message: 'Tên đăng nhập đã tồn tại',
        path: '/auth/register',
      }

      const error = createAxiosError({
        response: {
          status: 400,
          data: backendError,
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Tên đăng nhập đã tồn tại')
    })

    // Test 2: Backend error with validation errors
    it('should parse backend validation errors and return first error', () => {
      const backendError: ApiErrorResponse = {
        timestamp: '2025-12-24T10:00:00',
        status: 400,
        error: 'Bad Request',
        message: '',
        path: '/auth/register',
        errors: {
          username: 'Tên đăng nhập phải có ít nhất 3 ký tự',
          email: 'Email không hợp lệ',
        },
      }

      const error = createAxiosError({
        response: {
          status: 400,
          data: backendError,
        } as any,
      })

      const result = parseApiError(error)
      // Should return first validation error
      expect(result).toBe('Tên đăng nhập phải có ít nhất 3 ký tự')
    })

    // Test 3: Network error (ERR_NETWORK)
    it('should handle network error (ERR_NETWORK)', () => {
      const error = createAxiosError({
        code: 'ERR_NETWORK',
        message: 'Network Error',
        request: {} as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.')
    })

    // Test 4: Timeout error (ERR_TIMEOUT)
    it('should handle timeout error (ERR_TIMEOUT)', () => {
      const error = createAxiosError({
        code: 'ERR_TIMEOUT',
        message: 'Timeout exceeded',
        request: {} as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Yêu cầu hết thời gian chờ. Vui lòng thử lại.')
    })

    // Test 5: Canceled error (ERR_CANCELED)
    it('should handle canceled error (ERR_CANCELED)', () => {
      const error = createAxiosError({
        code: 'ERR_CANCELED',
        message: 'Request canceled',
      })

      const result = parseApiError(error)
      expect(result).toBe('Yêu cầu đã bị hủy.')
    })

    // Test 6: HTTP 403 Forbidden
    it('should handle 403 Forbidden error', () => {
      const error = createAxiosError({
        response: {
          status: 403,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Bạn không có quyền truy cập tài nguyên này.')
    })

    // Test 7: HTTP 404 Not Found
    it('should handle 404 Not Found error', () => {
      const error = createAxiosError({
        response: {
          status: 404,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Không tìm thấy tài nguyên yêu cầu.')
    })

    // Test 8: HTTP 500 Internal Server Error
    it('should handle 500 Internal Server Error', () => {
      const error = createAxiosError({
        response: {
          status: 500,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Lỗi máy chủ nội bộ. Vui lòng thử lại sau.')
    })

    // Test 9: HTTP 502 Bad Gateway
    it('should handle 502 Bad Gateway error', () => {
      const error = createAxiosError({
        response: {
          status: 502,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Máy chủ không phản hồi. Vui lòng thử lại sau.')
    })

    // Test 10: HTTP 503 Service Unavailable
    it('should handle 503 Service Unavailable error', () => {
      const error = createAxiosError({
        response: {
          status: 503,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.')
    })

    // Test 11: Unknown HTTP status code
    it('should handle unknown HTTP status code', () => {
      const error = createAxiosError({
        response: {
          status: 418, // I'm a teapot
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Lỗi HTTP 418. Vui lòng thử lại.')
    })

    // Test 12: AxiosError with request but no response (network issue)
    it('should handle request without response', () => {
      const error = createAxiosError({
        request: {} as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.')
    })

    // Test 13: Regular Error object
    it('should handle regular Error object with message', () => {
      const error = new Error('Something went wrong')

      const result = parseApiError(error)
      expect(result).toBe('Something went wrong')
    })

    // Test 14: Error object with empty message
    it('should handle Error object with empty message', () => {
      const error = new Error('')

      const result = parseApiError(error)
      expect(result).toBe('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    })

    // Test 15: String error
    it('should handle string error', () => {
      const error = 'Custom error message'

      const result = parseApiError(error)
      expect(result).toBe('Custom error message')
    })

    // Test 16: Empty string error
    it('should handle empty string error', () => {
      const error = '   '

      const result = parseApiError(error)
      expect(result).toBe('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    })

    // Test 17: Null error
    it('should handle null error', () => {
      const result = parseApiError(null)
      expect(result).toBe('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    })

    // Test 18: Undefined error
    it('should handle undefined error', () => {
      const result = parseApiError(undefined)
      expect(result).toBe('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    })

    // Test 19: Unknown object error
    it('should handle unknown object error', () => {
      const error = { foo: 'bar' }

      const result = parseApiError(error)
      expect(result).toBe('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    })

    // Test 20: Backend error with empty message but has error field
    it('should fallback to status code message when backend message is empty', () => {
      const backendError: ApiErrorResponse = {
        timestamp: '2025-12-24T10:00:00',
        status: 401,
        error: 'Unauthorized',
        message: '',
        path: '/api/protected',
      }

      const error = createAxiosError({
        response: {
          status: 401,
          data: backendError,
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    })

    // Test 21: HTTP 409 Conflict
    it('should handle 409 Conflict error', () => {
      const error = createAxiosError({
        response: {
          status: 409,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Dữ liệu đã tồn tại hoặc xung đột.')
    })

    // Test 22: HTTP 400 Bad Request
    it('should handle 400 Bad Request error', () => {
      const error = createAxiosError({
        response: {
          status: 400,
          data: {},
        } as any,
      })

      const result = parseApiError(error)
      expect(result).toBe('Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.')
    })
  })

  describe('handleApiError', () => {
    let mockToast: ToastContextType

    beforeEach(() => {
      // Reset mock before each test
      mockToast = {
        showToast: vi.fn(),
        hideToast: vi.fn(),
      }
    })

    // Test 23: handleApiError calls showToast with parsed message
    it('should call showToast with parsed error message', () => {
      const error = createAxiosError({
        code: 'ERR_NETWORK',
      })

      handleApiError(error, mockToast)

      expect(mockToast.showToast).toHaveBeenCalledWith(
        'error',
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
      )
      expect(mockToast.showToast).toHaveBeenCalledTimes(1)
    })

    // Test 24: handleApiError with custom message
    it('should call showToast with custom message when provided', () => {
      const error = createAxiosError({
        response: {
          status: 500,
          data: {},
        } as any,
      })

      const customMessage = 'Không thể tải dữ liệu. Vui lòng thử lại.'

      handleApiError(error, mockToast, customMessage)

      expect(mockToast.showToast).toHaveBeenCalledWith('error', customMessage)
      expect(mockToast.showToast).toHaveBeenCalledTimes(1)
    })

    // Test 25: handleApiError with backend error
    it('should call showToast with backend error message', () => {
      const backendError: ApiErrorResponse = {
        timestamp: '2025-12-24T10:00:00',
        status: 400,
        error: 'Bad Request',
        message: 'Email đã được sử dụng',
        path: '/auth/register',
      }

      const error = createAxiosError({
        response: {
          status: 400,
          data: backendError,
        } as any,
      })

      handleApiError(error, mockToast)

      expect(mockToast.showToast).toHaveBeenCalledWith('error', 'Email đã được sử dụng')
    })

    // Test 26: handleApiError should not throw if toast is undefined
    it('should handle null/undefined toast gracefully', () => {
      const error = createAxiosError({
        code: 'ERR_NETWORK',
      })

      // This should not throw
      expect(() => {
        handleApiError(error, null as any)
      }).toThrow()
    })
  })
})
