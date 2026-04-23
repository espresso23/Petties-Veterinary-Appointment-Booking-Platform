import apiClient from './client'

/**
 * Sandbox API Service
 * Handles all API calls related to sandbox workspace functionality
 */

export interface SandboxClinicDTO {
  clinicId: string
  name: string
  isSandbox: boolean
  sandboxOwnerId?: string
  sandboxExpiresAt?: string
  // ... other clinic fields
}

export const sandboxApi = {
  /**
   * Enter sandbox mode for a specific feature
   * Creates a new sandbox clinic with pre-seeded mock data
   *
   * @param feature Feature name: clinic_info, services, clinic_services, master_services, scheduling, or bookings
   * @returns Created sandbox clinic
   */
  enter: async (feature: 'clinic_info' | 'services' | 'clinic_services' | 'master_services' | 'scheduling' | 'bookings') => {
    const response = await apiClient.post<SandboxClinicDTO>(`/sandbox/enter?feature=${feature}`)
    return response.data
  },

  /**
   * Exit sandbox mode and delete all mock data
   * Ensures cascade deletion of all related data
   *
   * @param clinicId ID of sandbox clinic to delete
   */
  exit: async (clinicId: string) => {
    await apiClient.delete(`/sandbox/exit/${clinicId}`)
  },

  /**
   * Get currently active sandbox for the authenticated user
   * Returns the most recently created sandbox, or null if none active
   *
   * @returns Active sandbox clinic or null
   */
  getCurrent: async () => {
    try {
      const response = await apiClient.get<SandboxClinicDTO>(`/sandbox/current`)
      return response.data
    } catch (error: any) {
      // 404 means no active sandbox
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },
}
