import { create } from 'zustand'
import { isTokenValid, isTokenExpired } from '../utils/tokenUtils'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: {
    userId: string
    username: string
    fullName: string
    email: string
    role: string
    avatar?: string
    specialty?: string  // VET_GENERAL, VET_SURGERY, VET_DENTAL, VET_DERMATOLOGY, GROOMER
    workingClinicId?: string
    workingClinicName?: string
  } | null
  isAuthenticated: boolean
  isLoading: boolean
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthState['user']) => void
  clearAuth: () => void
  initializeAuth: () => void
  validateTokens: () => boolean
}

// Load tokens từ localStorage khi khởi tạo
const loadTokensFromStorage = () => {
  if (typeof window === 'undefined') return null
  try {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')
    const userStr = localStorage.getItem('user')
    const user = userStr ? JSON.parse(userStr) : null

    // Validate tokens before loading
    if (accessToken && isTokenExpired(accessToken)) {
      // Token expired, clear storage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      return null
    }

    return { accessToken, refreshToken, user }
  } catch {
    // Parse error, clear corrupted data
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    return null
  }
}

// Save tokens vào localStorage
const saveTokensToStorage = (
  accessToken: string | null,
  refreshToken: string | null,
  user: AuthState['user'] | null,
) => {
  if (typeof window === 'undefined') return

  if (accessToken) {
    localStorage.setItem('accessToken', accessToken)
  } else {
    localStorage.removeItem('accessToken')
  }

  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  } else {
    localStorage.removeItem('refreshToken')
  }

  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Initialize từ localStorage
  const stored = loadTokensFromStorage()

  // Helper to check if authenticated (with token validation)
  const checkAuthenticated = (accessToken: string | null, user: AuthState['user']): boolean => {
    if (!accessToken || !user) return false
    return isTokenValid(accessToken)
  }

  return {
    accessToken: stored?.accessToken || null,
    refreshToken: stored?.refreshToken || null,
    user: stored?.user || null,
    isAuthenticated: checkAuthenticated(stored?.accessToken || null, stored?.user || null),
    isLoading: false,
    setTokens: (accessToken, refreshToken) => {
      // Validate tokens before setting
      if (!isTokenValid(accessToken)) {
        console.warn('Setting expired access token')
      }

      const currentUser = get().user
      saveTokensToStorage(accessToken, refreshToken, currentUser)
      set({
        accessToken,
        refreshToken,
        isAuthenticated: checkAuthenticated(accessToken, currentUser),
      })
    },
    setUser: (user) => {
      const currentAccessToken = get().accessToken
      const currentRefreshToken = get().refreshToken
      saveTokensToStorage(currentAccessToken, currentRefreshToken, user)
      set({
        user,
        isAuthenticated: checkAuthenticated(currentAccessToken, user),
      })
    },
    clearAuth: () => {
      // Clear both localStorage and state
      saveTokensToStorage(null, null, null)
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      })
    },
    initializeAuth: () => {
      set({ isLoading: true })
      const stored = loadTokensFromStorage()
      if (stored && isTokenValid(stored.accessToken)) {
        set({
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          user: stored.user,
          isAuthenticated: checkAuthenticated(stored.accessToken, stored.user),
          isLoading: false,
        })
      } else {
        // Invalid or expired tokens, clear
        saveTokensToStorage(null, null, null)
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    },
    validateTokens: () => {
      const state = get()
      const isValid = checkAuthenticated(state.accessToken, state.user)

      if (!isValid && state.accessToken) {
        // Token exists but invalid, clear auth
        get().clearAuth()
      }

      return isValid
    },
  }
})

