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
export async function deleteService(serviceId: string, clinicId?: string): Promise<void> {
  const config = clinicId ? { params: { clinicId } } : undefined
  await apiClient.delete(`/services/${serviceId}`, config)
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
 * Update home visit status
 * PATCH /api/services/{serviceId}/home-visit?isHomeVisit={value}
 */
export async function updateHomeVisitStatus(
  serviceId: string,
  isHomeVisit: boolean,
): Promise<ClinicServiceResponse> {
  const { data } = await apiClient.patch<ClinicServiceResponse>(
    `/services/${serviceId}/home-visit`,
    null,
    { params: { isHomeVisit } },
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

/**
 * NEW: Inherit service from Master Service
 * POST /api/services/inherit/{masterServiceId}?clinicId={clinicId}&clinicPrice={price}&clinicPricePerKm={pricePerKm}
 */
export async function inheritFromMasterService(
  masterServiceId: string,
  clinicId?: string,
  clinicPrice?: number,
  clinicPricePerKm?: number,
): Promise<ClinicServiceResponse> {
  const params: { clinicId?: string; clinicPrice?: string; clinicPricePerKm?: string } = {}
  if (clinicId) params.clinicId = clinicId
  if (clinicPrice) params.clinicPrice = clinicPrice.toString()
  if (clinicPricePerKm) params.clinicPricePerKm = clinicPricePerKm.toString()

  const { data } = await apiClient.post<ClinicServiceResponse>(
    `/services/inherit/${masterServiceId}`,
    null,
    { params },
  )
  return data
}

/**
 * NEW: Get all services for a specific clinic
 * GET /api/services/by-clinic/{clinicId}
 */
export async function getServicesByClinicId(
  clinicId: string,
): Promise<ClinicServiceResponse[]> {
  const { data } = await apiClient.get<ClinicServiceResponse[]>(
    `/services/by-clinic/${clinicId}`,
  )
  return data
}
