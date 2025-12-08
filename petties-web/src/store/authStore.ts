import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: {
    userId: string
    username: string
    email: string
    role: string
  } | null
  isAuthenticated: boolean
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthState['user']) => void
  clearAuth: () => void
  initializeAuth: () => void
}

// Load tokens từ localStorage khi khởi tạo
const loadTokensFromStorage = () => {
  if (typeof window === 'undefined') return null
  try {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')
    const userStr = localStorage.getItem('user')
    const user = userStr ? JSON.parse(userStr) : null
    
    return { accessToken, refreshToken, user }
  } catch {
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

export const useAuthStore = create<AuthState>((set) => {
  // Initialize từ localStorage
  const stored = loadTokensFromStorage()
  
  return {
    accessToken: stored?.accessToken || null,
    refreshToken: stored?.refreshToken || null,
    user: stored?.user || null,
    isAuthenticated: !!(stored?.accessToken && stored?.user),
    setTokens: (accessToken, refreshToken) => {
      const currentUser = useAuthStore.getState().user
      saveTokensToStorage(accessToken, refreshToken, currentUser)
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
      })
    },
    setUser: (user) => {
      const currentAccessToken = useAuthStore.getState().accessToken
      const currentRefreshToken = useAuthStore.getState().refreshToken
      saveTokensToStorage(currentAccessToken, currentRefreshToken, user)
      set({
        user,
        isAuthenticated: !!user,
      })
    },
    clearAuth: () => {
      saveTokensToStorage(null, null, null)
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      })
    },
    initializeAuth: () => {
      const stored = loadTokensFromStorage()
      if (stored) {
        set({
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          user: stored.user,
          isAuthenticated: !!(stored.accessToken && stored.user),
        })
      }
    },
  }
})

