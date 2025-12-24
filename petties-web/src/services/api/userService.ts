import { apiClient } from './client'

// Types
export interface UserProfile {
  userId: string
  username: string
  email: string
  fullName: string | null
  phone: string | null
  avatar: string | null
  role: string
  createdAt: string
  updatedAt: string
}

export interface UpdateProfileRequest {
  fullName?: string
  phone?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface EmailChangeRequest {
  newEmail: string
}

export interface EmailChangeVerifyRequest {
  newEmail: string
  otp: string
}

export interface AvatarResponse {
  avatarUrl: string | null
  publicId: string | null
  message: string
}

// API Functions

/**
 * Get current user profile
 */
export const getProfile = async (): Promise<UserProfile> => {
  const response = await apiClient.get<UserProfile>('/users/profile')
  return response.data
}

/**
 * Update user profile (fullName, phone)
 */
export const updateProfile = async (data: UpdateProfileRequest): Promise<UserProfile> => {
  const response = await apiClient.put<UserProfile>('/users/profile', data)
  return response.data
}

/**
 * Upload new avatar
 */
export const uploadAvatar = async (file: File): Promise<AvatarResponse> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<AvatarResponse>('/users/profile/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

/**
 * Delete current avatar
 */
export const deleteAvatar = async (): Promise<AvatarResponse> => {
  const response = await apiClient.delete<AvatarResponse>('/users/profile/avatar')
  return response.data
}

/**
 * Change password
 */
export const changePassword = async (data: ChangePasswordRequest): Promise<{ message: string }> => {
  const response = await apiClient.put<{ message: string }>('/users/profile/password', data)
  return response.data
}

/**
 * Request email change - send OTP
 */
export const requestEmailChange = async (newEmail: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/users/profile/email/request-change', {
    newEmail
  })
  return response.data
}

/**
 * Verify email change with OTP
 */
export const verifyEmailChange = async (newEmail: string, otp: string): Promise<UserProfile> => {
  const response = await apiClient.post<UserProfile>('/users/profile/email/verify-change', {
    newEmail,
    otp
  })
  return response.data
}
