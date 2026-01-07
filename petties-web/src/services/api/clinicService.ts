import { apiClient } from './client'
import type {
  ClinicResponse,
  ClinicRequest,
  ClinicListResponse,
  GeocodeResponse,
  DistanceResponse,
  ClinicFilters,
  NearbyClinicsParams,
} from '../../types/clinic'

export const clinicService = {
  /**
   * Get all clinics with filters and pagination
   */
  getAllClinics: async (filters?: ClinicFilters): Promise<ClinicListResponse> => {
    const params = new URLSearchParams()

    if (filters?.status) {
      params.append('status', filters.status)
    }
    if (filters?.name) {
      params.append('name', filters.name)
    }
    params.append('page', String(filters?.page ?? 0))
    params.append('size', String(filters?.size ?? 20))

    const response = await apiClient.get<ClinicListResponse>(`/clinics?${params.toString()}`)
    return response.data
  },

  /**
   * Get clinic by ID
   */
  getClinicById: async (clinicId: string): Promise<ClinicResponse> => {
    const response = await apiClient.get<ClinicResponse>(`/clinics/${clinicId}`)
    return response.data
  },

  /**
   * Create new clinic
   */
  createClinic: async (data: ClinicRequest): Promise<ClinicResponse> => {
    const response = await apiClient.post<ClinicResponse>('/clinics', data)
    return response.data
  },

  /**
   * Update clinic
   */
  updateClinic: async (clinicId: string, data: ClinicRequest): Promise<ClinicResponse> => {
    const response = await apiClient.put<ClinicResponse>(`/clinics/${clinicId}`, data)
    return response.data
  },

  /**
   * Delete clinic (soft delete)
   */
  deleteClinic: async (clinicId: string): Promise<void> => {
    await apiClient.delete(`/clinics/${clinicId}`)
  },

  /**
   * Search clinics by name
   */
  searchClinics: async (name: string, page = 0, size = 20): Promise<ClinicListResponse> => {
    const params = new URLSearchParams({
      name,
      page: String(page),
      size: String(size),
    })
    const response = await apiClient.get<ClinicListResponse>(`/clinics/search?${params.toString()}`)
    return response.data
  },

  /**
   * Find nearby clinics
   */
  findNearbyClinics: async (params: NearbyClinicsParams): Promise<ClinicListResponse> => {
    const queryParams = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius: String(params.radius ?? 10),
      page: String(params.page ?? 0),
      size: String(params.size ?? 20),
    })
    const response = await apiClient.get<ClinicListResponse>(`/clinics/nearby?${queryParams.toString()}`)
    return response.data
  },

  /**
   * Geocode address to lat/lng
   */
  geocodeAddress: async (clinicId: string, address: string): Promise<GeocodeResponse> => {
    const response = await apiClient.post<GeocodeResponse>(`/clinics/${clinicId}/geocode`, { address })
    return response.data
  },

  /**
   * Calculate distance from point to clinic
   */
  calculateDistance: async (
    clinicId: string,
    latitude: number,
    longitude: number,
  ): Promise<DistanceResponse> => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
    })
    const response = await apiClient.get<DistanceResponse>(`/clinics/${clinicId}/distance?${params.toString()}`)
    return response.data
  },

  /**
   * Get clinics owned by current user
   */
  getMyClinics: async (page = 0, size = 20): Promise<ClinicListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    })
    const response = await apiClient.get<ClinicListResponse>(`/clinics/owner/my-clinics?${params.toString()}`)
    return response.data
  },

  /**
   * Get pending clinics for admin approval (ADMIN only)
   */
  getPendingClinics: async (page = 0, size = 20, sortBy = 'createdAt', sortDir: 'ASC' | 'DESC' = 'DESC'): Promise<ClinicListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
      sortBy,
      sortDir,
    })
    const response = await apiClient.get<ClinicListResponse>(`/clinics/admin/pending?${params.toString()}`)
    return response.data
  },

  /**
   * Get count of pending clinics for admin badge (ADMIN only)
   */
  getPendingClinicsCount: async (): Promise<number> => {
    const response = await apiClient.get<number>('/clinics/admin/pending/count')
    return response.data
  },

  /**
   * Approve clinic (ADMIN only)
   */
  approveClinic: async (clinicId: string, reason?: string): Promise<ClinicResponse> => {
    const response = await apiClient.post<ClinicResponse>(`/clinics/${clinicId}/approve`, reason ? { reason } : {})
    return response.data
  },

  /**
   * Reject clinic (ADMIN only)
   */
  rejectClinic: async (clinicId: string, reason: string): Promise<ClinicResponse> => {
    const response = await apiClient.post<ClinicResponse>(`/clinics/${clinicId}/reject`, { reason })
    return response.data
  },

  /**
   * Upload image for clinic
   */
  uploadClinicImage: async (
    clinicId: string,
    file: File,
    caption?: string,
    displayOrder?: number,
    isPrimary = false,
  ): Promise<ClinicResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    if (caption) {
      formData.append('caption', caption)
    }
    if (displayOrder !== undefined) {
      formData.append('displayOrder', String(displayOrder))
    }
    formData.append('isPrimary', String(isPrimary))

    // Use FormData - must remove Content-Type header completely
    // Axios will automatically set Content-Type to multipart/form-data with boundary for FormData
    const config: any = {
      headers: {},
    }
    // Delete Content-Type header - axios will set it automatically for FormData
    delete config.headers['Content-Type']

    const response = await apiClient.post<ClinicResponse>(
      `/clinics/${clinicId}/images`,
      formData,
      config
    )
    return response.data
  },

  /**
   * Delete clinic image
   */
  deleteClinicImage: async (clinicId: string, imageId: string): Promise<void> => {
    await apiClient.delete(`/clinics/${clinicId}/images/${imageId}`)
  },

  /**
   * Set clinic image as primary
   */
  setPrimaryClinicImage: async (clinicId: string, imageId: string): Promise<ClinicResponse> => {
    const response = await apiClient.post<ClinicResponse>(`/clinics/${clinicId}/images/${imageId}/primary`)
    return response.data
  },

  /**
   * Upload logo for clinic
   */
  uploadClinicLogo: async (clinicId: string, file: File): Promise<ClinicResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    // Use FormData - delete Content-Type header to let browser set it automatically with boundary
    const config: any = {
      headers: {},
    }
    delete (config.headers as any)['Content-Type']

    const response = await apiClient.post<ClinicResponse>(
      `/clinics/${clinicId}/logo`,
      formData,
      config
    )
    return response.data
  },
}

