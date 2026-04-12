export type AdminStrikeStatus = 'ALL' | 'ACTIVE' | 'NONE' | 'PERMANENT'

export interface AdminUserSummaryResponse {
  userId: string
  username: string
  fullName?: string | null
  email?: string | null
  role: 'PET_OWNER' | 'STAFF' | 'CLINIC_MANAGER' | 'CLINIC_OWNER' | 'ADMIN'
  createdAt: string
  strikeUntil?: string | null
}

export interface AdminUserListResponse {
  content: AdminUserSummaryResponse[]
  totalPages: number
  totalElements: number
  size: number
  number: number
}

export interface AdminUserFilters {
  role?: string
  search?: string
  createdFrom?: string
  createdTo?: string
  strikeStatus?: AdminStrikeStatus
  page?: number
  size?: number
}
