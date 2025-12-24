import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '../types/api'

/**
 * Error Messages Map - Vietnamese translations for common errors
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  ERR_NETWORK: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
  ERR_TIMEOUT: 'Yêu cầu hết thời gian chờ. Vui lòng thử lại.',
  ERR_CANCELED: 'Yêu cầu đã bị hủy.',
  ECONNABORTED: 'Kết nối bị gián đoạn. Vui lòng thử lại.',

  // HTTP Status Codes
  400: 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền truy cập tài nguyên này.',
  404: 'Không tìm thấy tài nguyên yêu cầu.',
  409: 'Dữ liệu đã tồn tại hoặc xung đột.',
  500: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
  502: 'Máy chủ không phản hồi. Vui lòng thử lại sau.',
  503: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',

  // Generic
  UNKNOWN: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.',
}

/**
 * Type guard to check if error is AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    error.isAxiosError === true
  )
}

/**
 * Parse API error to user-friendly Vietnamese message
 * @param error - Unknown error object (usually from try-catch)
 * @returns User-friendly Vietnamese error message
 */
export function parseApiError(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return ERROR_MESSAGES.UNKNOWN
  }

  // Handle AxiosError
  if (isAxiosError(error)) {
    // 1. Check for network/timeout errors (error.code)
    if (error.code && error.code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[error.code]
    }

    // 2. Check for backend error response
    if (error.response) {
      const { status, data } = error.response

      // Backend ApiErrorResponse format (Spring Boot)
      if (data && typeof data === 'object') {
        const errorData = data as ApiErrorResponse

        // Use backend message if available and meaningful
        if (errorData.message && errorData.message.trim() !== '') {
          return errorData.message
        }

        // Check for validation errors
        if (errorData.errors && Object.keys(errorData.errors).length > 0) {
          const firstError = Object.values(errorData.errors)[0]
          return firstError
        }
      }

      // 3. Fallback to HTTP status code message
      if (status in ERROR_MESSAGES) {
        return ERROR_MESSAGES[status]
      }

      // 4. Generic HTTP error
      return `Lỗi HTTP ${status}. Vui lòng thử lại.`
    }

    // 5. Request was made but no response (network issue)
    if (error.request) {
      return ERROR_MESSAGES.ERR_NETWORK
    }
  }

  // Handle Error object
  if (error instanceof Error) {
    // Check if error message is in our map
    if (error.message in ERROR_MESSAGES) {
      return ERROR_MESSAGES[error.message]
    }

    // Return error message if it's meaningful
    if (error.message && error.message.trim() !== '') {
      return error.message
    }
  }

  // Handle string error
  if (typeof error === 'string' && error.trim() !== '') {
    return error
  }

  // Fallback
  return ERROR_MESSAGES.UNKNOWN
}

/**
 * Toast Context Type (to avoid circular dependency)
 */
export interface ToastContextType {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => void
  hideToast: (id: string) => void
}

/**
 * Handle API error and show toast notification
 * @param error - Unknown error object
 * @param toast - Toast context from useToast()
 * @param customMessage - Optional custom message to override parsed message
 */
export function handleApiError(
  error: unknown,
  toast: ToastContextType,
  customMessage?: string,
): void {
  const message = customMessage || parseApiError(error)
  toast.showToast('error', message)

  // Log error in dev mode
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[Error Handler]', error)
  }
}
