export type UserRole =
  | 'PET_OWNER'
  | 'VET'
  | 'CLINIC_MANAGER'
  | 'CLINIC_OWNER'
  | 'ADMIN'

export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  avatarUrl?: string
  phone?: string
}

