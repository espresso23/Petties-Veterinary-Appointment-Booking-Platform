import { create } from 'zustand'
import { clinicService } from '../services/api/clinicService'
import type {
  ClinicResponse,
  ClinicRequest,
  ClinicFilters,
} from '../types/clinic'

interface ClinicState {
  // State
  clinics: ClinicResponse[]
  currentClinic: ClinicResponse | null
  totalElements: number
  totalPages: number
  currentPage: number
  pageSize: number
  isLoading: boolean
  error: string | null
  filters: ClinicFilters
  pendingCount: number

  // Actions
  fetchClinics: (filters?: ClinicFilters) => Promise<void>
  fetchClinicById: (clinicId: string) => Promise<void>
  createClinic: (data: ClinicRequest) => Promise<ClinicResponse>
  updateClinic: (clinicId: string, data: ClinicRequest) => Promise<ClinicResponse>
  deleteClinic: (clinicId: string) => Promise<void>
  searchClinics: (name: string) => Promise<void>
  getMyClinics: () => Promise<void>
  approveClinic: (clinicId: string) => Promise<void>
  rejectClinic: (clinicId: string, reason: string) => Promise<void>
  fetchPendingCount: () => Promise<void>
  setPendingCount: (count: number) => void
  setFilters: (filters: ClinicFilters) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  clinics: [],
  currentClinic: null,
  totalElements: 0,
  totalPages: 0,
  currentPage: 0,
  pageSize: 20,
  isLoading: false,
  error: null,
  filters: {},
  pendingCount: 0,
}

export const useClinicStore = create<ClinicState>((set, get) => ({
  ...initialState,

  fetchClinics: async (filters?: ClinicFilters) => {
    set({ isLoading: true, error: null })
    try {
      const mergedFilters = { ...get().filters, ...filters }
      const response = await clinicService.getAllClinics(mergedFilters)
      set({
        clinics: response.content,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
        currentPage: response.number,
        pageSize: response.size,
        filters: mergedFilters,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch clinics',
        isLoading: false,
      })
    }
  },

  fetchClinicById: async (clinicId: string) => {
    set({ isLoading: true, error: null })
    try {
      const clinic = await clinicService.getClinicById(clinicId)
      set({ currentClinic: clinic, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch clinic',
        isLoading: false,
      })
    }
  },

  createClinic: async (data: ClinicRequest) => {
    set({ isLoading: true, error: null })
    try {
      const clinic = await clinicService.createClinic(data)
      set({ isLoading: false })
      return clinic
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create clinic'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  updateClinic: async (clinicId: string, data: ClinicRequest) => {
    set({ isLoading: true, error: null })
    try {
      const clinic = await clinicService.updateClinic(clinicId, data)
      // Update in list if exists
      const clinics = get().clinics.map((c) => (c.clinicId === clinicId ? clinic : c))
      set({ clinics, currentClinic: clinic, isLoading: false })
      return clinic
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update clinic'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  deleteClinic: async (clinicId: string) => {
    set({ isLoading: true, error: null })
    try {
      await clinicService.deleteClinic(clinicId)
      // Remove from list
      const clinics = get().clinics.filter((c) => c.clinicId !== clinicId)
      set({ clinics, currentClinic: null, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete clinic'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  searchClinics: async (name: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await clinicService.searchClinics(name, get().currentPage, get().pageSize)
      set({
        clinics: response.content,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
        currentPage: response.number,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to search clinics',
        isLoading: false,
      })
    }
  },

  getMyClinics: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await clinicService.getMyClinics(get().currentPage, get().pageSize)
      set({
        clinics: response.content,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
        currentPage: response.number,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch my clinics',
        isLoading: false,
      })
    }
  },

  approveClinic: async (clinicId: string) => {
    set({ isLoading: true, error: null })
    try {
      const clinic = await clinicService.approveClinic(clinicId)
      // Update in list if exists
      const clinics = get().clinics.map((c) => (c.clinicId === clinicId ? clinic : c))
      set({ clinics, currentClinic: clinic, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to approve clinic'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  rejectClinic: async (clinicId: string, reason: string) => {
    set({ isLoading: true, error: null })
    try {
      const clinic = await clinicService.rejectClinic(clinicId, reason)
      // Update in list if exists
      const clinics = get().clinics.map((c) => (c.clinicId === clinicId ? clinic : c))
      set({ clinics, currentClinic: clinic, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reject clinic'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  fetchPendingCount: async () => {
    try {
      const pendingCount = await clinicService.getPendingClinicsCount()
      set({ pendingCount })
    } catch (error) {
      console.error('Failed to fetch pending clinics count:', error)
    }
  },

  setPendingCount: (pendingCount: number) => {
    set({ pendingCount })
  },

  setFilters: (filters: ClinicFilters) => {
    set({ filters: { ...get().filters, ...filters } })
  },

  clearError: () => {
    set({ error: null })
  },

  reset: () => {
    set(initialState)
  },
}))

