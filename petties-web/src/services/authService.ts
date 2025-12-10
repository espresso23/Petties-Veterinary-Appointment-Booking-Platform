/**
 * Auth Service - Authentication API calls to Spring Boot
 * 
 * Routes through API Gateway:
 * - /api/auth/login
 * - /api/auth/register
 * - /api/auth/me
 * - /api/auth/refresh
 * - /api/auth/logout
 */

import { env } from '../config/env'

// ✅ Define AUTH_BASE từ env (env.API_BASE_URL đã có /api rồi)
const AUTH_BASE = `${env.API_BASE_URL}/auth`

// ===== TYPES =====

export interface User {
    userId: number
    username: string
    email: string
    fullName?: string
    phoneNumber?: string
    role: 'ADMIN' | 'VET' | 'CLINIC_MANAGER' | 'CLINIC_OWNER' | 'PET_OWNER'
    enabled: boolean
    createdAt?: string
}

export interface LoginRequest {
    email: string
    password: string
}

export interface RegisterRequest {
    email: string
    password: string
    fullName: string
    phoneNumber?: string
    role?: string
}

export interface AuthResponse {
    accessToken: string
    refreshToken: string
    tokenType: string
    expiresIn: number
    user: User
}

// ===== TOKEN STORAGE =====

const TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

export const tokenStorage = {
    getAccessToken: (): string | null => localStorage.getItem(TOKEN_KEY),
    getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
    getUser: (): User | null => {
        const user = localStorage.getItem(USER_KEY)
        return user ? JSON.parse(user) : null
    },

    setTokens: (response: AuthResponse) => {
        localStorage.setItem(TOKEN_KEY, response.accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify(response.user))
    },

    clearTokens: () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
    },

    isAuthenticated: (): boolean => {
        return !!localStorage.getItem(TOKEN_KEY)
    }
}

// ===== HELPER =====

const getAuthHeaders = (): Record<string, string> => {
    const token = tokenStorage.getAccessToken()
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
}

// ===== API CALLS =====

export const authApi = {
    /**
     * Login with email and password
     */
    async login(credentials: LoginRequest): Promise<AuthResponse> {
        const response = await fetch(`${AUTH_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.message || 'Login failed')
        }

        const data: AuthResponse = await response.json()
        tokenStorage.setTokens(data)
        return data
    },

    /**
     * Register new user
     */
    async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await fetch(`${AUTH_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.message || 'Registration failed')
        }

        const result: AuthResponse = await response.json()
        tokenStorage.setTokens(result)
        return result
    },

    /**
     * Get current user info
     */
    async getCurrentUser(): Promise<User> {
        const response = await fetch(`${AUTH_BASE}/me`, {
            headers: getAuthHeaders()
        })

        if (!response.ok) {
            if (response.status === 401) {
                tokenStorage.clearTokens()
            }
            throw new Error('Failed to get user info')
        }

        return response.json()
    },

    /**
     * Refresh access token
     */
    async refreshToken(): Promise<AuthResponse> {
        const refreshToken = tokenStorage.getRefreshToken()
        if (!refreshToken) {
            throw new Error('No refresh token')
        }

        const response = await fetch(`${AUTH_BASE}/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${refreshToken}` }
        })

        if (!response.ok) {
            tokenStorage.clearTokens()
            throw new Error('Token refresh failed')
        }

        const data: AuthResponse = await response.json()
        tokenStorage.setTokens(data)
        return data
    },

    /**
     * Logout
     */
    async logout(): Promise<void> {
        try {
            await fetch(`${AUTH_BASE}/logout`, {
                method: 'POST',
                headers: getAuthHeaders()
            })
        } finally {
            tokenStorage.clearTokens()
        }
    }
}

export default authApi
