/**
 * Service API Endpoints
 * Follows the same pattern as auth.ts
 * All endpoints automatically include JWT token via apiClient interceptor
 */

import { apiClient } from '../api/client'
import type {
  ClinicServiceResponse,
  ClinicServiceRequest,
  ClinicServiceUpdateRequest,
} from '../../types/service'

/**
 * Get all services for the authenticated clinic owner
 * GET /api/services
 */
export async function getAllServices(): Promise<ClinicServiceResponse[]> {
  const { data } = await apiClient.get<ClinicServiceResponse[]>('/services')
  return data
}

/**
 * Get a single service by ID
 * GET /api/services/{serviceId}
 */
export async function getServiceById(
  serviceId: string,
): Promise<ClinicServiceResponse> {
  const { data } = await apiClient.get<ClinicServiceResponse>(`/services/${serviceId}`)
  return data
}

/**
 * Create a new service
 * POST /api/services
 */
export async function createService(
  payload: ClinicServiceRequest,
): Promise<ClinicServiceResponse> {
  const { data } = await apiClient.post<ClinicServiceResponse>('/services', payload)
  return data
}

/**
 * Update an existing service
 * PUT /api/services/{serviceId}
 */
export async function updateService(
  serviceId: string,
  payload: ClinicServiceUpdateRequest,
): Promise<ClinicServiceResponse> {
  const { data } = await apiClient.put<ClinicServiceResponse>(
    `/services/${serviceId}`,
    payload,
  )
  return data
}

/**
 * Delete a service (soft delete)
 * DELETE /api/services/{serviceId}
 */
export async function deleteService(serviceId: string): Promise<void> {
  await apiClient.delete(`/services/${serviceId}`)
}

/**
 * Toggle service active status
 * PATCH /api/services/{serviceId}/status?isActive={value}
 */
export async function toggleServiceStatus(
  service: ClinicServiceResponse,
): Promise<ClinicServiceResponse> {
  const { data } = await apiClient.patch<ClinicServiceResponse>(
    `/services/${service.serviceId}/status`,
    null,
    {
      params: { isActive: !service.isActive },
    },
  )
  return data
}

/**
 * Update price per km for all home visit services
 * PATCH /api/services/bulk/price-per-km?pricePerKm={value}
 */
export async function updateBulkPricePerKm(pricePerKm: number): Promise<void> {
  await apiClient.patch('/services/bulk/price-per-km', null, {
    params: { pricePerKm: pricePerKm.toString() },
  })
}
