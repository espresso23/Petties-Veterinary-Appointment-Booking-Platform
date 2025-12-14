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

