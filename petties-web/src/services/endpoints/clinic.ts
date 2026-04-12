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
  // Optional per-clinic configured prices
  pricePerKm?: number | null
  sosFee?: number | null
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
  // Call my-clinics endpoint (returns ALL clinics of owner including PENDING, APPROVED, REJECTED)
  try {
    const resp = await apiClient.get<unknown>('/clinics/owner/my-clinics?size=100')
    const body = resp.data

    // Case A: backend returns Page<ClinicResponse> directly -> body.content
    if (body && typeof body === 'object' && 'content' in body && Array.isArray(body.content)) {
      return body.content as ClinicResponse[]
    }

    // Case B: backend wraps response in ApiResponse { data: { content: [...] } }
    if (body && typeof body === 'object' && 'data' in body && typeof body.data === 'object' && body.data && 'content' in body.data && Array.isArray(body.data.content)) {
      return body.data.content as ClinicResponse[]
    }

    // Case C: backend returns plain array under data or at top-level
    if (Array.isArray(body)) return body as ClinicResponse[]
    if (body && typeof body === 'object' && 'data' in body && Array.isArray(body.data)) return body.data as ClinicResponse[]
  } catch (e) {
    console.warn('getMyClinics: my-clinics endpoint failed', e)
  }

  return []
}

/**
 * Get stored pricing info for a clinic (pricePerKm and sosFee)
 */
export async function getClinicPricing(clinicId: string): Promise<{ pricePerKm: number | null, sosFee: number | null }> {
  try {
    const { data } = await apiClient.get<unknown>(`/clinics/${clinicId}/pricing`)
    if (data && typeof data === 'object' && 'pricePerKm' in data && 'sosFee' in data) {
      return {
        pricePerKm: typeof data.pricePerKm === 'number' ? data.pricePerKm : null,
        sosFee: typeof data.sosFee === 'number' ? data.sosFee : null
      }
    }
  } catch (e) {
    console.warn('getClinicPricing failed', clinicId, e)
  }
  return { pricePerKm: null, sosFee: null }
}

/**
 * Update stored pricing for a clinic (owner only)
 */
export async function updateClinicPricing(clinicId: string, pricing: { pricePerKm?: number, sosFee?: number }): Promise<unknown> {
  const { data } = await apiClient.patch(`/clinics/${clinicId}/pricing`, pricing)
  return data
}

