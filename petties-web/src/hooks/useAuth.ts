/**
 * useAuth Hook - Authentication state and actions
 * 
 * Provides:
 * - Login/logout functions
 * - Current user state
 * - Role checking
 */

import { useState, useEffect, useCallback } from 'react'
import { authApi, tokenStorage } from '../services/authService'
import type { User, LoginRequest, RegisterRequest } from '../services/authService'

export interface UseAuthReturn {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginRequest) => Promise<boolean>
  register: (data: RegisterRequest) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>

  // Role checks
  isAdmin: boolean
  isVet: boolean
  isClinicManager: boolean
  isClinicOwner: boolean
  isPetOwner: boolean
  hasRole: (role: string) => boolean
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(tokenStorage.getUser())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!user

  // Role checks
  const hasRole = useCallback((role: string) => user?.role === role, [user])
  const isAdmin = hasRole('ADMIN')
  const isVet = hasRole('VET')
  const isClinicManager = hasRole('CLINIC_MANAGER')
  const isClinicOwner = hasRole('CLINIC_OWNER')
  const isPetOwner = hasRole('PET_OWNER')

  // Initialize from storage on mount
  useEffect(() => {
    const storedUser = tokenStorage.getUser()
    if (storedUser) {
      setUser(storedUser)
    }
  }, [])

  // Login
  const login = useCallback(async (credentials: LoginRequest): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.login(credentials)
      setUser(response.user)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Register
  const register = useCallback(async (data: RegisterRequest): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.register(data)
      setUser(response.user)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  // Refresh user info
  const refreshUser = useCallback(async (): Promise<void> => {
    if (!tokenStorage.isAuthenticated()) return

    try {
      const currentUser = await authApi.getCurrentUser()
      setUser(currentUser)
      localStorage.setItem('user', JSON.stringify(currentUser))
    } catch {
      // If refresh fails, try to refresh token
      try {
        await authApi.refreshToken()
        const currentUser = await authApi.getCurrentUser()
        setUser(currentUser)
      } catch {
        // Token refresh also failed, logout
        setUser(null)
        tokenStorage.clearTokens()
      }
    }
  }, [])

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    isAdmin,
    isVet,
    isClinicManager,
    isClinicOwner,
    isPetOwner,
    hasRole,
  }
}

export default useAuth
