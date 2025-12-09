/**
 * useAuth Hook - Authentication state and actions
 * 
 * Now uses authStore as single source of truth
 * Provides:
 * - Login/logout functions
 * - Current user state
 * - Role checking
 */

import { useCallback, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { login as loginApi, register as registerApi, logout as logoutApi, getCurrentUser } from '../services/endpoints/auth'
import type { LoginRequest, RegisterRequest } from '../services/endpoints/auth'

export interface UseAuthReturn {
  // State
  user: { userId: string; username: string; email: string; role: string } | null
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
  // Use authStore as single source of truth
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const setUser = useAuthStore((state) => state.setUser)
  const setTokens = useAuthStore((state) => state.setTokens)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const validateTokens = useAuthStore((state) => state.validateTokens)

  // Validate tokens on mount and periodically
  useEffect(() => {
    validateTokens()
    
    // Validate every 5 minutes
    const interval = setInterval(() => {
      validateTokens()
    }, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [validateTokens])

  // Role checks
  const hasRole = useCallback((role: string) => user?.role === role, [user])
  const isAdmin = hasRole('ADMIN')
  const isVet = hasRole('VET')
  const isClinicManager = hasRole('CLINIC_MANAGER')
  const isClinicOwner = hasRole('CLINIC_OWNER')
  const isPetOwner = hasRole('PET_OWNER')

  // Login
  const login = useCallback(async (credentials: LoginRequest): Promise<boolean> => {
    try {
      await loginApi(credentials)
      // loginApi already updates authStore via setTokens and setUser
      return true
    } catch (err) {
      console.error('Login error:', err)
      return false
    }
  }, [])

  // Register
  const register = useCallback(async (data: RegisterRequest): Promise<boolean> => {
    try {
      await registerApi(data)
      // registerApi already updates authStore via setTokens and setUser
      return true
    } catch (err) {
      console.error('Register error:', err)
      return false
    }
  }, [])

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutApi()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Always clear local auth regardless of API call success
      clearAuth()
    }
  }, [clearAuth])

  // Refresh user info
  const refreshUser = useCallback(async (): Promise<void> => {
    if (!accessToken || !isAuthenticated) return

    try {
      const currentUser = await getCurrentUser()
      // getCurrentUser already updates authStore via setUser
    } catch (err) {
      console.error('Refresh user error:', err)
      // If refresh fails, validate tokens (might trigger clear if expired)
      validateTokens()
    }
  }, [accessToken, isAuthenticated, validateTokens])

  return {
    user,
    isAuthenticated,
    isLoading,
    error: null, // Errors handled in components
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
