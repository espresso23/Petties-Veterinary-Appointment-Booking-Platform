import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { env } from '../../config/env'
import { useAuthStore } from '../../store/authStore'
import { useSandboxStore } from '../../store/sandboxStore'
import { parseApiError } from '../../utils/errorHandler'

export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 60_000, // Increased for image uploads
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
})

// Export for use in services
export { apiClient as default }

// Request interceptor: Tự động thêm access token vào header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken
    const { isSandboxMode, currentSandboxClinic } = useSandboxStore.getState()

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }

    if (isSandboxMode && config.headers) {
      config.headers['X-Sandbox-Mode'] = 'true'
      if (currentSandboxClinic?.clinicId) {
        config.headers['X-Sandbox-Clinic-Id'] = currentSandboxClinic.clinicId
      }
    }

    const method = (config.method || 'get').toLowerCase()
    const isMutationMethod = ['post', 'put', 'patch', 'delete'].includes(method)
    const isSandboxEndpoint = config.url?.includes('/sandbox/')

    if (isSandboxMode && isMutationMethod && !isSandboxEndpoint) {
      const blockMessage = 'Bạn đang ở chế độ dùng thử. Hệ thống đã chặn thao tác ghi dữ liệu thật.'
      return Promise.reject(new Error(blockMessage))
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
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    // Nếu lỗi 401 và chưa retry, và không phải là request auth
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      originalRequest._retry = true

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
      ; (error as AxiosError & { userMessage?: string }).userMessage = userMessage

    // Log error trong dev mode
    if (import.meta.env.DEV) {

      console.error('API error', error)

      console.error('User message:', userMessage)
    }

    return Promise.reject(error)
  },
)

