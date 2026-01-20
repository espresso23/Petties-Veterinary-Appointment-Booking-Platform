/**
 * ClinicStaff Types
 * For managing clinic staff (VET, CLINIC_MANAGER)
 */

export type StaffRole = 'VET' | 'CLINIC_MANAGER'

// Chuyên môn của nhân viên
export type StaffSpecialty =
    | 'VET_GENERAL'      // Bác sĩ thú y tổng quát
    | 'VET_SURGERY'      // Bác sĩ phẫu thuật
    | 'VET_DENTAL'       // Bác sĩ nha khoa
    | 'VET_DERMATOLOGY'  // Bác sĩ da liễu
    | 'GROOMER'          // Nhân viên Grooming

export const SPECIALTY_LABELS: Record<StaffSpecialty, string> = {
    VET_GENERAL: 'Bác sĩ thú y tổng quát',
    VET_SURGERY: 'Bác sĩ phẫu thuật',
    VET_DENTAL: 'Bác sĩ nha khoa thú y',
    VET_DERMATOLOGY: 'Bác sĩ da liễu thú y',
    GROOMER: 'Nhân viên Grooming',
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


