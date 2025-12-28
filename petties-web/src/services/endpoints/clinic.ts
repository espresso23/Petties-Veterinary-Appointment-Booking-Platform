import apiClient from '../api/client'

export interface ClinicResponse {
  clinicId: string
  name: string
  address: string
  phone: string
  email?: string
  description?: string
  latitude?: number
  longitude?: number
  // Optional per-clinic configured price per km for home visits
  pricePerKm?: number | null
  clinicStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Get clinics owned by current user
 * @returns Promise<ClinicResponse[]>
 */
export async function getMyClinics(): Promise<ClinicResponse[]> {
  // Call my-clinics endpoint first (returns ALL clinics of owner including PENDING, APPROVED, REJECTED)
  try {
    const resp = await apiClient.get<any>('/clinics/owner/my-clinics?size=100')
    const body = resp.data

    // Case A: backend returns Page<ClinicResponse> directly -> body.content
    if (body && typeof body === 'object' && Array.isArray((body as any).content)) {
      return (body as any).content as ClinicResponse[]
    }

    // Case B: backend wraps response in ApiResponse { data: { content: [...] } }
    if (body?.data && typeof body.data === 'object' && Array.isArray((body.data as any).content)) {
      return (body.data as any).content as ClinicResponse[]
    }

    // Case C: backend returns plain array under data or at top-level
    if (Array.isArray(body)) return body as ClinicResponse[]
    if (Array.isArray(body?.data)) return body.data as ClinicResponse[]

    // Otherwise continue to fallback
  } catch (e) {
    console.warn('getMyClinics: my-clinics endpoint failed, trying fallback', e)
  }

  // Fallback to owner/approved endpoint
  try {
    const resp2 = await apiClient.get<any>('/clinics/owner/approved?size=100')
    const body2 = resp2.data

    if (body2 && typeof body2 === 'object' && Array.isArray((body2 as any).content)) {
      return (body2 as any).content as ClinicResponse[]
    }
    if (body2?.data && typeof body2.data === 'object' && Array.isArray((body2.data as any).content)) {
      return (body2.data as any).content as ClinicResponse[]
    }
    if (Array.isArray(body2)) return body2 as ClinicResponse[]
    if (Array.isArray(body2?.data)) return body2.data as ClinicResponse[]
  } catch (e) {
    console.warn('getMyClinics: fallback endpoint failed', e)
  }

  return []
}

/**
 * Get stored price per km for a clinic
 */
export async function getClinicPricePerKm(clinicId: string): Promise<number | null> {
  try {
    const { data } = await apiClient.get<any>(`/clinics/${clinicId}/price-per-km`)
    // data expected: { clinicId: ..., pricePerKm: <number|null> }
    if (data && typeof data === 'object') {
      return data.pricePerKm ?? null
    }
  } catch (e) {
    console.warn('getClinicPricePerKm failed', clinicId, e)
  }
  return null
}

/**
 * Update stored price per km for a clinic (owner only)
 */
export async function updateClinicPricePerKm(clinicId: string, pricePerKm: number): Promise<number> {
  const { data } = await apiClient.patch(`/clinics/${clinicId}/price-per-km`, { pricePerKm })
  return data.pricePerKm
}
