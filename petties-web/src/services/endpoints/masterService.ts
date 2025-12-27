/**
 * Master Service API Endpoints
 * Dịch vụ mẫu - Template cho tất cả clinic
 * Follows the same pattern as service.ts
 */

import { apiClient } from '../api/client'
import type {
  MasterServiceResponse,
  MasterServiceRequest,
  MasterServiceUpdateRequest,
} from '../../types/service'

/**
 * Get all master services
 * GET /api/master-services
 */
export async function getAllMasterServices(): Promise<MasterServiceResponse[]> {
  const { data } = await apiClient.get<MasterServiceResponse[]>('/master-services')
  return data
}

/**
 * Get a single master service by ID
 * GET /api/master-services/{masterServiceId}
 */
export async function getMasterServiceById(
  masterServiceId: string,
): Promise<MasterServiceResponse> {
  const { data } = await apiClient.get<MasterServiceResponse>(
    `/master-services/${masterServiceId}`,
  )
  return data
}

/**
 * Create a new master service
 * POST /api/master-services
 */
export async function createMasterService(
  payload: MasterServiceRequest,
): Promise<MasterServiceResponse> {
  const { data } = await apiClient.post<MasterServiceResponse>(
    '/master-services',
    payload,
  )
  return data
}

/**
 * Update an existing master service
 * PUT /api/master-services/{masterServiceId}
 */
export async function updateMasterService(
  masterServiceId: string,
  payload: MasterServiceUpdateRequest,
): Promise<MasterServiceResponse> {
  const { data } = await apiClient.put<MasterServiceResponse>(
    `/master-services/${masterServiceId}`,
    payload,
  )
  return data
}

/**
 * Delete a master service
 * DELETE /api/master-services/{masterServiceId}
 */
export async function deleteMasterService(masterServiceId: string): Promise<void> {
  await apiClient.delete(`/master-services/${masterServiceId}`)
}

/**
 * Search master services by name
 * GET /api/master-services/search?name={query}
 */
export async function searchMasterServices(
  name: string,
): Promise<MasterServiceResponse[]> {
  const { data } = await apiClient.get<MasterServiceResponse[]>(
    '/master-services/search',
    {
      params: { name },
    },
  )
  return data
}

/**
 * Get master services by category
 * GET /api/master-services/category/{category}
 */
export async function getMasterServicesByCategory(
  category: string,
): Promise<MasterServiceResponse[]> {
  const { data } = await apiClient.get<MasterServiceResponse[]>(
    `/master-services/category/${category}`,
  )
  return data
}

/**
 * Get master services by pet type
 * GET /api/master-services/pet-type/{petType}
 */
export async function getMasterServicesByPetType(
  petType: string,
): Promise<MasterServiceResponse[]> {
  const { data } = await apiClient.get<MasterServiceResponse[]>(
    `/master-services/pet-type/${petType}`,
  )
  return data
}
