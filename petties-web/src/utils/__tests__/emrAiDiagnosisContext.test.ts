import { describe, expect, it } from 'vitest'

import { buildEmrAiDiagnosisContext } from '../emrAiDiagnosisContext'

describe('emrAiDiagnosisContext', () => {
  it('builds snake_case payload for EMR sync context', () => {
    const payload = buildEmrAiDiagnosisContext(
      {
        request_id: 'req-123',
        evidence_mode: 'internal_grounded',
        evidence_banner: 'banner',
        score_label: 'score',
        top_differentials: [],
        supporting_evidence_from_kb: [],
        similar_confirmed_cases: [],
        vision_findings: [],
        image_descriptions: [],
        image_analysis: [],
        suggested_questions: [],
        soap_suggestions: {
          subjective_draft: '',
          objective_draft: '',
          assessment_draft: '',
          plan_draft: '',
        },
        prescription_suggestions: [
          {
            medicine_name: 'Cephalexin',
            dosage: '250 mg',
            frequency: '2 lan/ngay',
            duration_days: 14,
            instructions: 'Uong sau an',
            source: 'llm_fallback',
            source_detail: 'fallback',
          },
        ],
        disclaimer: 'tham khao',
      },
      {
        displayName: 'Viem da do vi khuan',
        canonicalCode: 'bacterial_dermatosis',
      },
      '2026-04-01T10:00:00.000Z'
    )

    expect(payload).toEqual({
      request_id: 'req-123',
      selected_diagnosis_code: 'bacterial_dermatosis',
      selected_diagnosis_label: 'Viem da do vi khuan',
      suggested_prescriptions: [
        {
          medicine_name: 'Cephalexin',
          dosage: '250 mg',
          frequency: '2 lan/ngay',
          duration_days: 14,
          instructions: 'Uong sau an',
          source: 'llm_fallback',
          source_detail: 'fallback',
        },
      ],
      generated_at: '2026-04-01T10:00:00.000Z',
    })
  })

  it('returns undefined when no AI diagnosis result exists', () => {
    expect(buildEmrAiDiagnosisContext(undefined, null)).toBeUndefined()
  })
})
