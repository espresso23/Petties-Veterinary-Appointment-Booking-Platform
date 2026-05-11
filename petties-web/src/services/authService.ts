/**
 * DEPRECATED: Use src/services/endpoints/auth.ts and useAuthStore instead.
 * 
 * This service is kept for backward compatibility during refactoring.
 * It now proxies all calls to the unified useAuthStore (Zustand).
 */

import { useAuthStore } from '../store/authStore'
import * as unifiedAuth from './endpoints/auth'
import type { User, AuthResponse } from '../types'
import type { LoginRequest, RegisterRequest } from './endpoints/auth'

// ===== TYPES =====
export type { User, LoginRequest, RegisterRequest, AuthResponse }

/**
 * DEPRECATED: Access user and tokens via useAuthStore or useAuth hook.
 */
export const tokenStorage = {
    getAccessToken: (): string | null => useAuthStore.getState().accessToken,
    getRefreshToken: (): string | null => useAuthStore.getState().refreshToken,
    getUser: () => useAuthStore.getState().user,

    setTokens: (response: any) => {
        useAuthStore.getState().setTokens(response.accessToken, response.refreshToken)
        if (response.user) {
            useAuthStore.getState().setUser(response.user)
        }
    },

    clearTokens: () => {
        useAuthStore.getState().clearAuth()
    },

    isAuthenticated: (): boolean => {
        return useAuthStore.getState().isAuthenticated
    }
}

/**
 * DEPRECATED: Use src/services/endpoints/auth.ts functions directly.
 */
export const authApi = {
    login: unifiedAuth.login,
    register: unifiedAuth.register,
    getCurrentUser: unifiedAuth.getCurrentUser,
    refreshToken: unifiedAuth.refreshToken,
    logout: unifiedAuth.logout,
    googleSignIn: unifiedAuth.googleSignIn
}

export default authApi
