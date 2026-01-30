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

export const petService = {
    getAllPets,
    getPetById,
    searchPets,
    updateAllergies,
    updateWeight,
}

export default petService
