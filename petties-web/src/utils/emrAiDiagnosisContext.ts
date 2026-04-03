import type { StaffDiagnosisResponse } from '../services/agentService'

export interface SelectedAiDiagnosisContext {
  displayName: string
  canonicalCode?: string | null
}

export interface EmrAiDiagnosisContextPrescription {
  medicine_name?: string
  dosage?: string
  frequency?: string
  duration_days?: number
  instructions?: string
  source?: string
  source_detail?: string
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

  return {
    request_id: aiDiagnosisResult.request_id,
    selected_diagnosis_code: selectedAiDiagnosis?.canonicalCode || undefined,
    selected_diagnosis_label: selectedAiDiagnosis?.displayName || undefined,
    suggested_prescriptions: (aiDiagnosisResult.prescription_suggestions || []).map((item) => ({
      medicine_name: item.medicine_name || undefined,
      dosage: item.dosage || undefined,
      frequency: item.frequency || undefined,
      duration_days: item.duration_days ?? undefined,
      instructions: item.instructions || item.caution || undefined,
      source: item.source || undefined,
      source_detail: item.source_detail || undefined,
    })),
    generated_at: generatedAt,
  }
}
