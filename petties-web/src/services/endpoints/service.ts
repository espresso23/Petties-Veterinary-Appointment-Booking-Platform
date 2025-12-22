/**
 * Service API Endpoints
 * Follows the same pattern as auth.ts
 * All endpoints automatically include JWT token via apiClient interceptor
 */

import { apiClient } from '../api/client'
import type {
  ServiceResponse,
  ServiceRequest,
  ServiceUpdateRequest,
} from '../../types/service'

/**
 * Get all services for the authenticated clinic owner
 * GET /api/services
 */
export async function getAllServices(): Promise<ServiceResponse[]> {
  const { data } = await apiClient.get<ServiceResponse[]>('/services')
  return data
}

/**
 * Get a single service by ID
 * GET /api/services/{serviceId}
 */
export async function getServiceById(
  serviceId: string,
): Promise<ServiceResponse> {
  const { data } = await apiClient.get<ServiceResponse>(`/services/${serviceId}`)
  return data
}

/**
 * Create a new service
 * POST /api/services
 */
export async function createService(
  payload: ServiceRequest,
): Promise<ServiceResponse> {
  const { data } = await apiClient.post<ServiceResponse>('/services', payload)
  return data
}

/**
 * Update an existing service
 * PUT /api/services/{serviceId}
 */
export async function updateService(
  serviceId: string,
  payload: ServiceUpdateRequest,
): Promise<ServiceResponse> {
  const { data } = await apiClient.put<ServiceResponse>(
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
  service: ServiceResponse,
): Promise<ServiceResponse> {
  const { data } = await apiClient.patch<ServiceResponse>(
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
