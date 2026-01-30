import { apiClient } from './client'
import type { StaffMember, InviteByEmailRequest } from '../../types/clinicStaff'

/**
 * ClinicStaff Service
 * Manages staff for clinics (STAFF, CLINIC_MANAGER)
 */
export const clinicStaffService = {
    /**
     * Get all staff members of a clinic
     */
    getClinicStaff: async (clinicId: string): Promise<StaffMember[]> => {
        const response = await apiClient.get<StaffMember[]>(`/clinics/${clinicId}/staff`)
        return response.data
    },

    /**
     * Check if clinic already has a manager
     */
    hasManager: async (clinicId: string): Promise<boolean> => {
        const response = await apiClient.get<boolean>(`/clinics/${clinicId}/staff/has-manager`)
        return response.data
    },

    /**
     * Invite staff by email - Staff login with Google
     * FullName and Avatar auto-filled from Google profile
     */
    inviteByEmail: async (clinicId: string, data: InviteByEmailRequest): Promise<void> => {
        await apiClient.post(`/clinics/${clinicId}/staff/invite-by-email`, data)
    },

    /**
     * Assign an existing user as Manager (Clinic Owner only)
     */
    assignManager: async (clinicId: string, usernameOrEmail: string): Promise<void> => {
        await apiClient.post(`/clinics/${clinicId}/staff/manager/${encodeURIComponent(usernameOrEmail)}`)
    },

    /**
     * Assign an existing user as Staff
     */
    assignStaff: async (clinicId: string, usernameOrEmail: string): Promise<void> => {
        await apiClient.post(`/clinics/${clinicId}/staff/staff/${encodeURIComponent(usernameOrEmail)}`)
    },

    /**
     * Remove a staff member from clinic
     */
    removeStaff: async (clinicId: string, userId: string): Promise<void> => {
        await apiClient.delete(`/clinics/${clinicId}/staff/${userId}`)
    },

    /**
     * Update staff specialty
     */
    updateStaffSpecialty: async (clinicId: string, userId: string, specialty: string): Promise<void> => {
        await apiClient.patch(`/clinics/${clinicId}/staff/${userId}/specialty`, { specialty })
    },
}
