import { create } from 'zustand'
import { isAxiosError } from 'axios'
import type { UserProfile, UpdateProfileRequest, ChangePasswordRequest } from '../services/api/userService'
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
} from '../services/api/userService'

interface UserState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchProfile: () => Promise<void>
  updateUserProfile: (data: UpdateProfileRequest) => Promise<void>
  uploadUserAvatar: (file: File) => Promise<void>
  deleteUserAvatar: () => Promise<void>
  changeUserPassword: (data: ChangePasswordRequest) => Promise<{ success: boolean; message: string }>
  clearError: () => void
  clearProfile: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const profile = await getProfile()
      set({ profile, isLoading: false })
    } catch (error) {
      let message = 'Lỗi khi tải profile'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      set({ error: message, isLoading: false })
    }
  },

  updateUserProfile: async (data: UpdateProfileRequest) => {
    set({ isLoading: true, error: null })
    try {
      const updatedProfile = await updateProfile(data)
      set({ profile: updatedProfile, isLoading: false })
    } catch (error) {
      let message = 'Lỗi khi cập nhật profile'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      set({ error: message, isLoading: false })
      throw error
    }
  },

  uploadUserAvatar: async (file: File) => {
    set({ isLoading: true, error: null })
    try {
      await uploadAvatar(file)
      // Refetch profile to get the updated avatar URL with fresh timestamp
      await get().fetchProfile()
    } catch (error) {
      let message = 'Lỗi khi upload avatar'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      set({ error: message, isLoading: false })
      throw error
    }
  },

  deleteUserAvatar: async () => {
    set({ isLoading: true, error: null })
    try {
      await deleteAvatar()
      // Refetch profile to ensure avatar is cleared
      await get().fetchProfile()
    } catch (error) {
      let message = 'Lỗi khi xóa avatar'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      set({ error: message, isLoading: false })
      throw error
    }
  },

  changeUserPassword: async (data: ChangePasswordRequest) => {
    set({ isLoading: true, error: null })
    try {
      const response = await changePassword(data)
      set({ isLoading: false })
      return { success: true, message: response.message }
    } catch (error) {
      let message = 'Lỗi khi đổi mật khẩu'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      set({ error: message, isLoading: false })
      return { success: false, message }
    }
  },

  clearError: () => set({ error: null }),

  clearProfile: () => set({ profile: null, error: null }),
}))
