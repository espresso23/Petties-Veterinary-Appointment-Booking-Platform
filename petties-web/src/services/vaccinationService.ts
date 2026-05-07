import api from './api/client'

export interface VaccinationRecord {
    id: string
    petId: string
    bookingId?: string
    staffId: string
    clinicId: string

    clinicName: string
    staffName: string

    vaccineName: string;
    vaccineTemplateId?: string;
    clinicServiceId?: string;
    doseNumber?: number;
    totalDoses?: number;
    seriesId?: string;
    // batchNumber removed

    vaccinationDate?: string;
    nextDueDate?: string;

    notes?: string;
    createdAt: string;
    workflowStatus?: 'PENDING' | 'COMPLETED';
    status: 'Valid' | 'Expiring Soon' | 'Overdue' | 'N/A';
}

export interface CreateVaccinationRequest {
    petId: string
    bookingId?: string
    vaccineName: string
    vaccineTemplateId?: string
    clinicServiceId?: string
    vaccinationDate: string
    nextDueDate?: string
    doseSequence?: string
    notes?: string
    workflowStatus?: 'PENDING' | 'COMPLETED'
}

export const vaccinationService = {
    /**
     * Create a new vaccination record
     */
    async createVaccination(request: CreateVaccinationRequest): Promise<VaccinationRecord> {
        const response = await api.post<VaccinationRecord>('/vaccinations', request)
        const item = response.data
        return {
            ...item,
            workflowStatus: (item as unknown as { status?: string }).status as 'PENDING' | 'COMPLETED' || 'PENDING',
            status: this.calculateStatus(item.nextDueDate)
        }
    },

    /**
     * Update an existing vaccination record
     */
    async updateVaccination(id: string, request: Partial<CreateVaccinationRequest>): Promise<VaccinationRecord> {
        const response = await api.put<VaccinationRecord>(`/vaccinations/${id}`, request)
        const item = response.data
        return {
            ...item,
            workflowStatus: item.status as 'PENDING' | 'COMPLETED',
            status: this.calculateStatus(item.nextDueDate)
        }
    },

    /**
     * Get all vaccination records for a pet
     */
    async getVaccinationsByPet(petId: string): Promise<VaccinationRecord[]> {
        const response = await api.get<VaccinationRecord[]>(`/vaccinations/pet/${petId}`)
        return response.data.map(item => ({
            ...item,
            workflowStatus: (item as unknown as { status?: string }).status as 'PENDING' | 'COMPLETED' || 'PENDING',
            status: this.calculateStatus(item.nextDueDate)
        }))
    },

    /**
     * Get predicted upcoming vaccinations for a pet
     */
    async getUpcomingVaccinations(petId: string): Promise<VaccinationRecord[]> {
        const response = await api.get<Partial<VaccinationRecord>[]>(`/vaccinations/pet/${petId}/upcoming?t=${new Date().getTime()}`)
        return response.data.map(item => ({
            id: item.id || '',
            petId: item.petId || petId,
            staffId: item.staffId || '',
            clinicId: item.clinicId || '',
            clinicName: item.clinicName || '',
            staffName: item.staffName || '',
            vaccineName: item.vaccineName || '',
            createdAt: item.createdAt || new Date().toISOString(),
            workflowStatus: 'PENDING' as const,
            status: 'N/A' as const,
            ...item
        }))
    },

    /**
     * Delete a vaccination record
     */
    async deleteVaccination(id: string): Promise<void> {
        await api.delete(`/vaccinations/${id}`)
    },

    /**
     * Calculate vaccination status based on next due date
     * Rules: 
     * - Overdue: Date is today or in the past
     * - Expiring Soon: Date is within 7 days from now
     * - Valid: Date is more than 7 days in the future
     */
    calculateStatus(nextDueDate?: string): VaccinationRecord['status'] {
        if (!nextDueDate) return 'N/A';

        const nextDate = new Date(nextDueDate);
        if (isNaN(nextDate.getTime())) return 'N/A';
        if (nextDate.getFullYear() <= 1970) return 'N/A';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 'Overdue';
        if (diffDays <= 7) return 'Expiring Soon';
        return 'Valid';
    },

    /**
     * Format a date string safely for Vietnamese locale
     */
    formatDate(dateString?: string): string {
        if (!dateString) return '—';
        const date = new Date(dateString);
        if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return '—';
        return date.toLocaleDateString('vi-VN');
    }
}

export default vaccinationService

