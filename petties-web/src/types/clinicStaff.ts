/**
 * ClinicStaff Types
 * For managing clinic staff (VET, CLINIC_MANAGER)
 */

export type StaffRole = 'VET' | 'CLINIC_MANAGER'

export interface StaffMember {
    userId: string
    fullName: string
    username: string
    email?: string
    role: StaffRole
    phone?: string
    avatar?: string
}

export interface QuickAddStaffRequest {
    fullName: string
    phone: string
    role: StaffRole
}

export interface AssignStaffRequest {
    usernameOrEmail: string
}
