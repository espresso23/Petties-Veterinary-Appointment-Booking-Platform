import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AIDiagnosisPanel } from '../AIDiagnosisPanel'
import { diagnosisApi, type StaffDiagnosisResponse } from '../../../services/agentService'

vi.mock('../../../services/agentService', () => ({
    diagnosisApi: {
        analyzeCase: vi.fn(),
    },
}))

const mockResponse: StaffDiagnosisResponse = {
    request_id: 'req-1',
    top_differentials: [
        {
            display_name_vi: 'Viêm kết mạc',
            confidence_note: 'Mức gợi ý: trung bình',
            supporting_reasons: ['Có dấu hiệu đỏ mắt'],
        },
    ],
    supporting_evidence_from_kb: ['Evidence 1'],
    similar_confirmed_cases: ['Case 1'],
    vision_findings: ['Đỏ mắt'],
    image_descriptions: ['Mô tả ảnh'],
    image_analysis: [],
    suggested_questions: ['Bé bị bao lâu rồi?'],
    soap_suggestions: {
        subjective_draft: 'Subjective',
        objective_draft: 'Objective',
        assessment_draft: 'Assessment',
        plan_draft: 'Plan',
    },
    prescription_suggestions: [],
    disclaimer: 'Chỉ dùng tham khảo',
}

describe('AIDiagnosisPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses describe_only for pending single-image preview', async () => {
        vi.mocked(diagnosisApi.analyzeCase).mockResolvedValue(mockResponse)

        render(
            <AIDiagnosisPanel
                species="dog"
                subjective=""
                objective=""
                assessment=""
                plan=""
                imageUrls={[]}
                pendingImageUrls={['data:image/png;base64,abc']}
            />
        )

        await waitFor(() => {
            expect(diagnosisApi.analyzeCase).toHaveBeenCalled()
        })

        expect(vi.mocked(diagnosisApi.analyzeCase).mock.calls[0][0]).toMatchObject({
            image_analysis_mode: 'describe_only',
            image_urls: ['data:image/png;base64,abc'],
        })
    })

    it('uses full mode and applies SOAP draft on full analysis', async () => {
        const onApplyDraft = vi.fn()
        vi.mocked(diagnosisApi.analyzeCase).mockResolvedValue(mockResponse)

        render(
            <AIDiagnosisPanel
                species="dog"
                petId="pet-1"
                bookingId="booking-1"
                subjective="S"
                objective="O"
                assessment="A"
                plan="P"
                imageUrls={[]}
                onApplyDraft={onApplyDraft}
            />
        )

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Bé đỏ mắt và chảy ghèn' },
        })
        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => {
            expect(diagnosisApi.analyzeCase).toHaveBeenCalled()
        })

        expect(vi.mocked(diagnosisApi.analyzeCase).mock.calls[0][0]).toMatchObject({
            pet_id: 'pet-1',
            booking_id: 'booking-1',
            image_analysis_mode: 'full',
            soap_draft: {
                subjective: 'S',
                objective: 'O',
                assessment: 'A',
                plan: 'P',
            },
        })

        await waitFor(() => {
            expect(onApplyDraft).toHaveBeenCalledWith(mockResponse.soap_suggestions)
        })
    })
})
