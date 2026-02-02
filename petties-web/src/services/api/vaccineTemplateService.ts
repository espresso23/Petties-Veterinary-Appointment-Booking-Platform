import api from './client'

export type TargetSpecies = 'DOG' | 'CAT' | 'BOTH'

export interface VaccineTemplate {
    id: string
    name: string
    manufacturer: string
    description?: string
    defaultPrice?: number
    minAgeWeeks: number
    repeatIntervalDays: number
    seriesDoses: number
    isAnnualRepeat: boolean
    targetSpecies: TargetSpecies
}

export const vaccineTemplateService = {
    getAllTemplates: async (): Promise<VaccineTemplate[]> => {
        try {
            const response = await api.get<VaccineTemplate[]>('/vaccine-templates')
            return response.data
        } catch (error) {
            console.error('Failed to fetch vaccine templates:', error)
            return []
        }
    },

    getTemplateById: async (id: string): Promise<VaccineTemplate> => {
        const response = await api.get<VaccineTemplate>(`/vaccine-templates/${id}`)
        return response.data
    }
}
