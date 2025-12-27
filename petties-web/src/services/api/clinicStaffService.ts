import { apiClient } from './client'
import type { StaffMember, QuickAddStaffRequest } from '../../types/clinicStaff'

/**
 * ClinicStaff Service
 * Manages staff for clinics (VET, CLINIC_MANAGER)
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
     * Quick add a new staff member (creates account and assigns to clinic)
     */
    quickAddStaff: async (clinicId: string, data: QuickAddStaffRequest): Promise<void> => {
        await apiClient.post(`/clinics/${clinicId}/staff/quick-add`, data)
    },

    /**
     * Assign an existing user as Manager (Clinic Owner only)
     */
    assignManager: async (clinicId: string, usernameOrEmail: string): Promise<void> => {
        await apiClient.post(`/clinics/${clinicId}/staff/manager/${encodeURIComponent(usernameOrEmail)}`)
    },

    /**
     * Assign an existing user as Vet
     */
    assignVet: async (clinicId: string, usernameOrEmail: string): Promise<void> => {
        await apiClient.post(`/clinics/${clinicId}/staff/vet/${encodeURIComponent(usernameOrEmail)}`)
    },

    /**
     * Remove a staff member from clinic
     */
    removeStaff: async (clinicId: string, userId: string): Promise<void> => {
        await apiClient.delete(`/clinics/${clinicId}/staff/${userId}`)
    },
}
