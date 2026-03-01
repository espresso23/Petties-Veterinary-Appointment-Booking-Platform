/**
 * ClinicStaff Types
 * For managing clinic staff (STAFF, CLINIC_MANAGER)
 */

export type StaffRole = 'STAFF' | 'CLINIC_MANAGER'

// Labels for Role display (Vietnamese)
export const ROLE_LABELS: Record<StaffRole, string> = {
    STAFF: 'Nhân viên phòng khám',
    CLINIC_MANAGER: 'Quản lý phòng khám',
};

// Chuyên môn của nhân viên (đơn giản hóa: VET | GROOMER)
export type StaffSpecialty =
    | 'VET'      // Bác sĩ thú y (khám, tiêm, phẫu thuật, nha khoa, da liễu...)
    | 'GROOMER'  // Nhân viên Grooming

export const SPECIALTY_LABELS: Record<StaffSpecialty, string> = {
    VET: 'Bác sĩ thú y',
    GROOMER: 'Nhân viên Grooming',
};

// Legacy labels (API có thể trả về trước migration)
export const SPECIALTY_LABELS_LEGACY: Record<string, string> = {
    ...SPECIALTY_LABELS,
    VET_GENERAL: 'Bác sĩ thú y',
    VET_SURGERY: 'Bác sĩ thú y',
    VET_DENTAL: 'Bác sĩ thú y',
    VET_DERMATOLOGY: 'Bác sĩ thú y',
};

export interface StaffMember {
    userId: string
    fullName: string
    username: string
    email?: string
    role: StaffRole
    phone?: string
    avatar?: string
    specialty?: StaffSpecialty
}

export interface AssignStaffRequest {
    usernameOrEmail: string
}

export interface InviteByEmailRequest {
    email: string
    role: StaffRole
    specialty?: StaffSpecialty
}

export interface InviteByEmailRequest {
    email: string
    role: StaffRole
    specialty?: StaffSpecialty
}


