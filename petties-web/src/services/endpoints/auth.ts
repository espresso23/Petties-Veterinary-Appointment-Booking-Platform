import { apiClient } from '../api/client'
import type { AuthResponse, UserResponse } from '../../types'
import { useAuthStore } from '../../store/authStore'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
  phone?: string
  avatar?: string
  role: 'PET_OWNER' | 'VET' | 'CLINIC_MANAGER' | 'CLINIC_OWNER' | 'ADMIN'
}

/**
 * Đăng nhập
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)
  
  // Lưu tokens vào store
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)
  
  // Lưu user info
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    email: data.email,
    role: data.role,
  })
  
  return data
}

/**
 * Đăng ký
 */
export async function register(
  payload: RegisterRequest,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload)
  
  // Lưu tokens vào store
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)
  
  // Lưu user info
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    email: data.email,
    role: data.role,
  })
  
  return data
}

/**
 * Refresh token
 */
export async function refreshToken(): Promise<AuthResponse> {
  const refreshToken = useAuthStore.getState().refreshToken
  
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }
  
  const { data } = await apiClient.post<AuthResponse>(
    '/auth/refresh',
    {},
    {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    },
  )
  
  // Lưu tokens mới
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)
  
  return data
}

/**
 * Đăng xuất
 */
export async function logout(): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken
  
  try {
    if (accessToken) {
      await apiClient.post(
        '/auth/logout',
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )
    }
  } catch (error) {
    // Logout failed nhưng vẫn clear local state
    console.error('Logout error:', error)
  } finally {
    // Xóa tokens khỏi store
    useAuthStore.getState().clearAuth()
  }
}

/**
 * Lấy thông tin user hiện tại
 */
export async function getCurrentUser(): Promise<UserResponse> {
  const { data } = await apiClient.get<UserResponse>('/auth/me')
  
  // Cập nhật user info trong store
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    email: data.email,
    role: data.role,
  })
  
  return data
}

