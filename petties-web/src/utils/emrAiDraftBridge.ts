export const EMR_AI_DRAFT_STORAGE_KEY = 'petties:emr-ai-draft:v1'

export type EmrAiSoapField = 'subjective' | 'objective' | 'assessment' | 'plan'

export interface EmrAiDraft {
  version: 1
  updated_at: string
  pet_id?: string
  booking_id?: string
  species?: string
  breed?: string
  age_months?: number
  weight_kg?: number
  allergies?: string[]
  subjective: string
  objective: string
  assessment: string
  plan: string
  image_urls: string[]
}

export const createEmptyEmrAiDraft = (): EmrAiDraft => ({
  version: 1,
  updated_at: new Date().toISOString(),
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  image_urls: [],
})

export const loadEmrAiDraft = (): EmrAiDraft | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(EMR_AI_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EmrAiDraft
    if (parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export const saveEmrAiDraft = (draft: EmrAiDraft): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    EMR_AI_DRAFT_STORAGE_KEY,
    JSON.stringify({ ...draft, updated_at: new Date().toISOString(), version: 1 })
  )
}

export const buildEmrAiChatUrl = (draft: EmrAiDraft, returnTo?: string): string => {
  const params = new URLSearchParams()
  params.set('openMascot', '1')
  params.set('source', 'emr_draft_bridge')
  if (draft.pet_id) params.set('petId', draft.pet_id)
  if (draft.booking_id) params.set('bookingId', draft.booking_id)
  if (returnTo) params.set('returnTo', returnTo)
  return `/staff?${params.toString()}`
}

export const matchesEmrContext = (
  draft: EmrAiDraft | null,
  petId?: string,
  bookingId?: string
): boolean => {
  if (!draft) return false
  if (petId && draft.pet_id && draft.pet_id !== petId) return false
  if (bookingId && draft.booking_id && draft.booking_id !== bookingId) return false
  return true
}
