import api from './client'

// Match backend PetResponse exactly
export interface Pet {
    id: string // UUID as string
    name: string
    species: string
    breed: string
    dateOfBirth?: string // LocalDate as string
    weight?: number
    gender?: string
    color?: string
    allergies?: string
    imageUrl?: string
    ownerName?: string
    ownerPhone?: string
}

export interface PetListResponse {
    content: Pet[]
    totalElements: number
    totalPages: number
    size: number
    number: number
}

/**
 * Get all pets (for VET to see patient list)
 */
export const getAllPets = async (page: number = 0, size: number = 20): Promise<PetListResponse> => {
    const response = await api.get('/pets', {
        params: { page, size }
    })
    return response.data
}

/**
 * Get pet by ID
 */
export const getPetById = async (petId: string): Promise<Pet> => {
    const response = await api.get(`/pets/${petId}`)
    return response.data
}

/**
 * Search pets by name or owner
 */
export const searchPets = async (query: string): Promise<Pet[]> => {
    const response = await api.get('/pets/search', {
        params: { q: query }
    })
    return response.data
}

/**
 * VET: Update only pet allergies
 */
export const updateAllergies = async (petId: string, allergies: string): Promise<Pet> => {
    const response = await api.patch(`/pets/${petId}/allergies`, { allergies })
    return response.data
}

/**
 * VET: Update pet weight
 */
export const updateWeight = async (petId: string, weight: number): Promise<Pet> => {
    const response = await api.patch(`/pets/${petId}/weight`, { weight })
    return response.data
}

export interface VetPatient {
    petId: string
    petName: string
    species: string
    breed: string
    gender?: string
    ageYears: number
    ageMonths: number
    imageUrl?: string
    ownerName: string
    ownerPhone?: string
    isAssignedToMe: boolean
    nextAppointment?: string
    bookingStatus?: string
    lastVisitDate?: string
    weight?: number
    allergies?: string
}

/**
 * Get prioritized patients for Vet (Assigned first)
 */
export const getVetPatients = async (clinicId: string, vetId: string): Promise<VetPatient[]> => {
    const response = await api.get('/pets/vet', {
        params: { clinicId, vetId }
    })
    return response.data
}

export const petService = {
    getAllPets,
    getPetById,
    searchPets,
    updateAllergies,
    updateWeight,
    getVetPatients,

    /**
     * Get current user's pets
     */
    getMyPets: async (): Promise<Pet[]> => {
        const response = await api.get('/pets/me')
        return response.data
    }
}

export default petService
