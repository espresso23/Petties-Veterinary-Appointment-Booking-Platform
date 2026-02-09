import api from './api/client'

export interface EmrRecord {
    id: string
    petId: string
    bookingId?: string
    bookingCode?: string
    staffId: string
    clinicId: string
    clinicName: string
    staffName: string
    petName: string
    petSpecies: string
    petBreed: string
    ownerName?: string
    subjective?: string
    objective?: string
    assessment: string
    plan: string
    notes?: string
    weightKg?: number
    temperatureC?: number
    heartRate?: number
    bcs?: number
    prescriptions: Prescription[]
    images: EmrImage[]
    examinationDate: string
    reExaminationDate?: string
    createdAt: string
    updatedAt?: string
    isLocked?: boolean
}

export interface Prescription {
    medicineName: string
    dosage?: string
    frequency: string
    durationDays?: number
    instructions?: string
}

export interface EmrImage {
    url: string
    description?: string
}

export interface CreateEmrRequest {
    petId: string
    bookingId?: string
    subjective?: string
    objective?: string
    assessment: string
    plan: string
    notes?: string
    weightKg?: number
    temperatureC?: number
    heartRate?: number
    bcs?: number
    prescriptions?: Prescription[]
    images?: EmrImage[]
    reExaminationDate?: string
    examinationDate?: string
}

export interface UploadResponse {
    url: string
    publicId: string
    format?: string
    width?: number
    height?: number
    bytes?: number
}

/**
 * EMR Service for Web
 */
export const emrService = {
    /**
     * Get EMR records for a pet
     */
    async getEmrsByPetId(petId: string): Promise<EmrRecord[]> {
        const response = await api.get<EmrRecord[]>(`/emr/pet/${petId}`)
        return response.data
    },

    /**
     * Get EMR by ID
     */
    async getEmrById(emrId: string): Promise<EmrRecord> {
        const response = await api.get<EmrRecord>(`/emr/${emrId}`)
        return response.data
    },

    /**
     * Get EMR by booking ID
     */
    async getEmrByBookingId(bookingId: string): Promise<EmrRecord> {
        const response = await api.get<EmrRecord>(`/emr/booking/${bookingId}`)
        return response.data
    },

    /**
     * Create a new EMR record (Staff only)
     */
    async createEmr(request: CreateEmrRequest): Promise<EmrRecord> {
        const response = await api.post<EmrRecord>('/emr', request)
        return response.data
    },

    /**
     * Update EMR record (Staff only)
     */
    async updateEmr(emrId: string, request: CreateEmrRequest): Promise<EmrRecord> {
        const response = await api.put<EmrRecord>(`/emr/${emrId}`, request)
        return response.data
    },

    /**
     * Upload EMR image
     */
    async uploadEmrImage(file: File, description?: string): Promise<UploadResponse> {
        const formData = new FormData()
        formData.append('file', file)
        if (description) {
            formData.append('description', description)
        }
        const response = await api.post<UploadResponse>('/emr/upload-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },
}

export default emrService
