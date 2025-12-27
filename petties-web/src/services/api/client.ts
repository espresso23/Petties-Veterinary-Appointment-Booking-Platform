import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { env } from '../../config/env'
import { useAuthStore } from '../../store/authStore'
import { parseApiError } from '../../utils/errorHandler'

export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Export for use in services
export { apiClient as default }

// Request interceptor: Tự động thêm access token vào header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    
    // If data is FormData, remove Content-Type to let browser set it with boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type']
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor: Tự động refresh token khi 401 và parse errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    // Nếu lỗi 401 và chưa retry, và không phải là request auth
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !(originalRequest as any)._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      ;(originalRequest as any)._retry = true

      try {
        const refreshToken = useAuthStore.getState().refreshToken

        if (!refreshToken) {
          // Không có refresh token → logout
          useAuthStore.getState().clearAuth()
          window.location.href = '/auth/login'
          return Promise.reject(error)
        }

        // Gọi API refresh token
        const response = await axios.post(
          `${env.API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          },
        )

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data

        // Lưu tokens mới (đồng bộ với localStorage)
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken)

        // Retry request ban đầu với token mới
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        // Refresh failed → logout (clear all tokens)
        useAuthStore.getState().clearAuth()
        window.location.href = '/auth/login'
        return Promise.reject(refreshError)
      }
    }

    // Parse error và attach userMessage vào error object
    const userMessage = parseApiError(error)
    ;(error as any).userMessage = userMessage

    // Log error trong dev mode
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('API error', error)
      // eslint-disable-next-line no-console
      console.error('User message:', userMessage)
    }

    return Promise.reject(error)
  },
)

