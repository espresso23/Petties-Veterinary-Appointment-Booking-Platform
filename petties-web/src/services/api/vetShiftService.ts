import { apiClient } from './client'
import type { VetShiftRequest, VetShiftResponse, SlotResponse } from '../../types/vetshift'

export const vetShiftService = {
    /**
     * Create one or more vet shifts
     */
    createShift: async (clinicId: string, data: VetShiftRequest): Promise<VetShiftResponse[]> => {
        const response = await apiClient.post<VetShiftResponse[]>(`/clinics/${clinicId}/shifts`, data)
        return response.data
    },

    /**
     * Get all shifts for a clinic in a date range
     */
    getShiftsByClinic: async (
        clinicId: string,
        startDate: string,
        endDate: string
    ): Promise<VetShiftResponse[]> => {
        const params = new URLSearchParams({
            startDate,
            endDate,
        })
        const url = `/clinics/${clinicId}/shifts?${params.toString()}`
        const response = await apiClient.get<VetShiftResponse[]>(url)
        return response.data
    },

    /**
     * Get shifts for the currently logged-in vet
     */
    getMyShifts: async (startDate: string, endDate: string): Promise<VetShiftResponse[]> => {
        const params = new URLSearchParams({ startDate, endDate })
        const response = await apiClient.get<VetShiftResponse[]>(`/shifts/me?${params.toString()}`)
        return response.data
    },

    /**
     * Get shift detail with slots
     */
    getShiftDetail: async (shiftId: string): Promise<VetShiftResponse> => {
        const response = await apiClient.get<VetShiftResponse>(`/shifts/${shiftId}`)
        return response.data
    },

    /**
     * Delete a shift
     */
    deleteShift: async (shiftId: string): Promise<void> => {
        await apiClient.delete(`/shifts/${shiftId}`)
    },

    /**
     * Delete multiple shifts
     */
    bulkDeleteShifts: async (shiftIds: string[]): Promise<void> => {
        await apiClient.delete('/shifts/bulk', { data: shiftIds })
    },

    /**
     * Block a slot
     */
    blockSlot: async (slotId: string): Promise<SlotResponse> => {
        const response = await apiClient.patch<SlotResponse>(`/slots/${slotId}/block`)
        return response.data
    },

    /**
     * Unblock a slot
     */
    unblockSlot: async (slotId: string): Promise<SlotResponse> => {
        const response = await apiClient.patch<SlotResponse>(`/slots/${slotId}/unblock`)
        return response.data
    },
}
