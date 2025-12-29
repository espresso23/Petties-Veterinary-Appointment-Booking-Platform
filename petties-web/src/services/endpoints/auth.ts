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

export interface SendOtpRequest {
  username: string
  password: string
  email: string
  phone?: string
  fullName: string
  role: 'PET_OWNER' | 'CLINIC_OWNER'
}

export interface SendOtpResponse {
  message: string
  email: string
  expiryMinutes: number
  resendCooldownSeconds: number
}

export interface VerifyOtpRequest {
  email: string
  otpCode: string
}

/**
 * Step 1: Gửi OTP đến email để đăng ký
 */
export async function sendRegistrationOtp(payload: SendOtpRequest): Promise<SendOtpResponse> {
  const { data } = await apiClient.post<SendOtpResponse>('/auth/register/send-otp', payload)
  return data
}

/**
 * Step 2: Xác thực OTP và hoàn tất đăng ký
 */
export async function verifyOtpAndRegister(payload: VerifyOtpRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register/verify-otp', payload)

  // Lưu tokens vào store
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)

  // Lưu user info
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    workingClinicId: data.workingClinicId,
    workingClinicName: data.workingClinicName,
  })

  return data
}

/**
 * Gửi lại OTP
 */
export async function resendOtp(email: string): Promise<SendOtpResponse> {
  const { data } = await apiClient.post<SendOtpResponse>(`/auth/register/resend-otp?email=${encodeURIComponent(email)}`)
  return data
}

/**
 * Đăng nhập
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)

  // Lưu tokens vào store (đồng bộ)
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)

  // Lưu user info (đồng bộ)
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    workingClinicId: data.workingClinicId,
    workingClinicName: data.workingClinicName,
  })

  return data
}

/**
 * [DEPRECATED] Đăng ký trực tiếp (không cần xác thực email)
 * Sử dụng sendRegistrationOtp + verifyOtpAndRegister thay thế
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
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    workingClinicId: data.workingClinicId,
    workingClinicName: data.workingClinicName,
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

  // Lưu tokens mới (đồng bộ với localStorage)
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)

  // Update user info if available in response
  if (data.userId || data.username) {
    const currentUser = useAuthStore.getState().user
    if (currentUser) {
      // Keep existing user, just update tokens
      useAuthStore.getState().setUser(currentUser)
    }
  }

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

  // Cập nhật user info trong store (đồng bộ với localStorage)
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    workingClinicId: data.workingClinicId,
    workingClinicName: data.workingClinicName,
  })

  return data
}

/**
 * Đăng nhập bằng Google
 * Platform "web" → CLINIC_OWNER role
 */
export async function googleSignIn(idToken: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/google', {
    idToken,
    platform: 'web'  // Web → CLINIC_OWNER
  })

  // Lưu tokens vào store
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)

  // Lưu user info
  useAuthStore.getState().setUser({
    userId: data.userId,
    username: data.username,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    workingClinicId: data.workingClinicId,
    workingClinicName: data.workingClinicName,
  })

  return data
}

/**
 * Forgot Password - Gửi OTP để reset mật khẩu
 */
export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponse {
  message: string
  email: string
  expiryMinutes: number
  resendCooldownSeconds: number
}

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const { data } = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', payload)
  return data
}

/**
 * Reset Password - Xác thực OTP và đổi mật khẩu
 */
export interface ResetPasswordRequest {
  email: string
  otpCode: string
  newPassword: string
  confirmPassword: string
}

export interface ResetPasswordResponse {
  message: string
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const { data } = await apiClient.post<ResetPasswordResponse>('/auth/reset-password', payload)
  return data
}

/**
 * Resend Password Reset OTP
 */
export async function resendPasswordResetOtp(email: string): Promise<SendOtpResponse> {
  const { data } = await apiClient.post<SendOtpResponse>(`/auth/forgot-password/resend-otp?email=${encodeURIComponent(email)}`)
  return data
}

