import { apiClient } from './client'
import type { AdminUserFilters, AdminUserListResponse } from '../../types/adminUser'

export const adminUserService = {
  getUsers: async (filters?: AdminUserFilters): Promise<AdminUserListResponse> => {
    const params = new URLSearchParams()
    if (filters?.role) params.append('role', filters.role)
    if (filters?.search?.trim()) params.append('search', filters.search.trim())
    if (filters?.createdFrom) params.append('createdFrom', filters.createdFrom)
    if (filters?.createdTo) params.append('createdTo', filters.createdTo)
    if (filters?.strikeStatus) params.append('strikeStatus', filters.strikeStatus)
    params.append('page', String(filters?.page ?? 0))
    params.append('size', String(filters?.size ?? 20))

    const response = await apiClient.get<AdminUserListResponse>(`/admin/users?${params.toString()}`)
    return response.data
  },

  restrictUser: async (userId: string, payload: { reason: string; isPermanent: boolean; days?: number }) => {
    const response = await apiClient.post(`/admin/users/${userId}/restrict`, payload)
    return response.data
  },

  liftUserStrike: async (userId: string) => {
    const response = await apiClient.post(`/admin/users/${userId}/lift-strike`, {})
    return response.data
  },
}
