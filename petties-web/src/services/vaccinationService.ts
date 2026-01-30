import api from './api/client'

export interface VaccinationRecord {
    id: string
    petId: string
    bookingId?: string
    staffId: string
    clinicId: string

    clinicName: string
    staffName: string

    vaccineName: string
    batchNumber?: string

    vaccinationDate: string
    nextDueDate?: string

    notes?: string
    createdAt: string
    status: 'Valid' | 'Expiring Soon' | 'Overdue' | 'N/A'
}

export interface CreateVaccinationRequest {
    petId: string
    bookingId?: string
    vaccineName: string
    batchNumber?: string
    vaccinationDate: string
    nextDueDate?: string
    notes?: string
}

export const vaccinationService = {
    /**
     * Create a new vaccination record
     */
    async createVaccination(request: CreateVaccinationRequest): Promise<VaccinationRecord> {
        const response = await api.post<VaccinationRecord>('/vaccinations', request)
        return response.data
    },

    /**
     * Get all vaccination records for a pet
     */
    async getVaccinationsByPet(petId: string): Promise<VaccinationRecord[]> {
        const response = await api.get<VaccinationRecord[]>(`/vaccinations/pet/${petId}`)
        return response.data
    },

    /**
     * Delete a vaccination record
     */
    async deleteVaccination(id: string): Promise<void> {
        await api.delete(`/vaccinations/${id}`)
    },
}

export default vaccinationService
