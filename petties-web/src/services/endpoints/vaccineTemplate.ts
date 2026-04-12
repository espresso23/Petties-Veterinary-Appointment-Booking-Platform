import { apiClient } from '../api/client'

export interface VaccineTemplate {
    id: string
    name: string
    manufacturer?: string
    description?: string
    minAgeWeeks?: number
    repeatIntervalDays?: number
    minIntervalDays?: number
    seriesDoses?: number
    isAnnualRepeat?: boolean
    defaultPrice?: number
    targetSpecies: 'DOG' | 'CAT' | 'BOTH'
}

export const getAllVaccineTemplates = async (): Promise<VaccineTemplate[]> => {
    const response = await apiClient.get('/vaccine-templates')
    return response.data
}

export const getVaccineTemplateById = async (id: string): Promise<VaccineTemplate> => {
    const response = await apiClient.get(`/vaccine-templates/${id}`)
    return response.data
}
