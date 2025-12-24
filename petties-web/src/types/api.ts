export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  userId: string
  username: string
  email: string
  fullName?: string
  role: string
}

export interface UserResponse {
  userId: string
  username: string
  email: string
  fullName?: string
  phone?: string
  avatar?: string
  role: string
  createdAt: string
  updatedAt: string
}

/**
 * Backend API Error Response Format
 * Follows Spring Boot GlobalExceptionHandler error structure
 */
export interface ApiErrorResponse {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  errors?: Record<string, string> // Validation errors (field -> message)
}

