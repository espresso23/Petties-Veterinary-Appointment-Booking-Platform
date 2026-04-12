import type { StaffDiagnosisResponse } from '../services/agentService'

export interface SelectedAiDiagnosisContext {
  displayName: string
  canonicalCode?: string | null
}

export interface EmrAiDiagnosisContextPrescription {
  medicine_name?: string
  dosage?: string
  frequency?: string
  times_of_day?: Array<'sang' | 'trua' | 'chieu'>
  before_after_meal?: 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'NONE'
  duration_days?: number
  instructions?: string
  source?: string
  source_detail?: string
}

const normalizeTimesOfDay = (
  value?: string[]
): Array<'sang' | 'trua' | 'chieu'> | undefined => {
  if (!value?.length) return undefined
  const allowed = new Set(['sang', 'trua', 'chieu'])
  const normalized = value.filter((item): item is 'sang' | 'trua' | 'chieu' =>
    allowed.has(item)
  )
  return normalized.length ? normalized : undefined
}

const normalizeBeforeAfterMeal = (
  value?: string
): 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'NONE' | undefined => {
  if (!value) return undefined
  if (
    value === 'BEFORE_MEAL' ||
    value === 'AFTER_MEAL' ||
    value === 'WITH_MEAL' ||
    value === 'NONE'
  ) {
    return value
  }
  return undefined
}

export interface EmrAiDiagnosisContextPayload {
  request_id: string
  selected_diagnosis_code?: string
  selected_diagnosis_label?: string
  suggested_prescriptions: EmrAiDiagnosisContextPrescription[]
  generated_at: string
}

export const buildEmrAiDiagnosisContext = (
  aiDiagnosisResult?: StaffDiagnosisResponse | null,
  selectedAiDiagnosis?: SelectedAiDiagnosisContext | null,
  generatedAt: string = new Date().toISOString()
): EmrAiDiagnosisContextPayload | undefined => {
  if (!aiDiagnosisResult) {
    return undefined
  }
  if (aiDiagnosisResult.payload_status === 'incomplete') {
    return undefined
  }

  return {
    request_id: aiDiagnosisResult.request_id,
    selected_diagnosis_code: selectedAiDiagnosis?.canonicalCode || undefined,
    selected_diagnosis_label: selectedAiDiagnosis?.displayName || undefined,
    suggested_prescriptions: (aiDiagnosisResult.prescription_suggestions || []).map((item) => ({
      medicine_name: item.medicine_name || undefined,
      dosage: item.dosage || undefined,
      frequency: item.frequency || undefined,
      times_of_day: normalizeTimesOfDay(item.times_of_day || item.timesOfDay),
      before_after_meal: normalizeBeforeAfterMeal(
        item.before_after_meal || item.beforeAfterMeal
      ),
      duration_days: item.duration_days ?? undefined,
      instructions: item.instructions || item.caution || undefined,
      source: item.source || undefined,
      source_detail: item.source_detail || undefined,
    })),
    generated_at: generatedAt,
  }
}
