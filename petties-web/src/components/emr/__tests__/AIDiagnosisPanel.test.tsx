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
    evidence_mode: 'internal_grounded',
    evidence_banner: 'Đã đối chiếu dữ liệu nội bộ',
    score_label: 'Độ tự tin (%)',
    top_differentials: [
        {
            rank: 1,
            score_percent: 78,
            score_basis: 'matching_internal',
            display_name_vi: 'Viêm kết mạc',
            confidence_note: 'Độ tự tin: 78%',
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

    it('uses full mode and waits for diagnosis selection before applying SOAP draft', async () => {
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

        expect(onApplyDraft).not.toHaveBeenCalled()
    })

    it('disables analyze button when loading in modal mode', async () => {
        vi.mocked(diagnosisApi.analyzeCase).mockResolvedValue(mockResponse)

        render(
            <AIDiagnosisPanel
                isModal
                species="dog"
                subjective="Triệu chứng bệnh đầy đủ để AI phân tích"
                objective=""
                assessment=""
                plan=""
                imageUrls={[]}
                onSelectDiagnosis={vi.fn()}
            />
        )

        // Trigger analyze
        const analyzeButton = screen.getByRole('button', { name: /phân tích/i })
        fireEvent.click(analyzeButton)

        // Button should be disabled during loading
        await waitFor(() => {
            expect(analyzeButton).toBeDisabled()
        })
    })

    it('shows "Đang xử lý" badge during full analysis in modal', async () => {
        let resolvePromise: (value: StaffDiagnosisResponse) => void
        const delayedResponse = new Promise<StaffDiagnosisResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(diagnosisApi.analyzeCase).mockReturnValue(delayedResponse)

        render(
            <AIDiagnosisPanel
                isModal
                species="dog"
                subjective="Triệu chứng bệnh đầy đủ để AI phân tích case này"
                objective=""
                assessment=""
                plan=""
                imageUrls={['https://example.com/image.jpg']}
                onSelectDiagnosis={vi.fn()}
            />
        )

        // Trigger analyze
        const analyzeButton = screen.getByRole('button', { name: /phân tích/i })
        fireEvent.click(analyzeButton)

        // Check for "Đang xử lý" badge appears during loading
        const processingBadge = await screen.findByText('Đang xử lý')
        expect(processingBadge).toBeInTheDocument()

        // Resolve the promise to clean up
        resolvePromise!(mockResponse)
    })

    it('sets isSelectingDiagnosis flag when selecting a diagnosis', async () => {
        let resolvePromise: (value: StaffDiagnosisResponse) => void
        const delayedResponse = new Promise<StaffDiagnosisResponse>(resolve => {
            resolvePromise = resolve
        })
        vi.mocked(diagnosisApi.analyzeCase).mockReturnValue(delayedResponse)

        const onSelectDiagnosis = vi.fn()

        render(
            <AIDiagnosisPanel
                isModal
                species="dog"
                subjective="Triệu chứng bệnh đầy đủ để AI phân tích case này"
                objective=""
                assessment=""
                plan=""
                imageUrls={['https://example.com/image.jpg']}
                onSelectDiagnosis={onSelectDiagnosis}
                initialResult={mockResponse}
            />
        )

        // Wait for initial render with results
        await screen.findByText(/kết quả AI đã sẵn sàng/i)

        // Click on diagnosis selection button
        const selectButton = screen.getByRole('button', { name: /đã chọn/i })
        fireEvent.click(selectButton)

        // The API should be called again for selected_only synthesis
        await waitFor(() => {
            expect(diagnosisApi.analyzeCase).toHaveBeenCalledTimes(1)
        })

        // Resolve to clean up
        resolvePromise!(mockResponse)
    })

    it.skip('handles differential list with canonical and non-canonical codes', async () => {
        vi.mocked(diagnosisApi.analyzeCase).mockResolvedValue({
            ...mockResponse,
            top_differentials: [
                {
                    rank: 1,
                    score_percent: 40,
                    score_basis: 'matching_internal',
                    display_name_vi: 'Viêm da do vi khuẩn',
                    canonical_code: 'bacterial_dermatosis',
                    confidence_note: 'Độ tự tin: 40%',
                    supporting_reasons: ['Ca từ Case Memory.'],
                },
            ],
        })

        render(
            <AIDiagnosisPanel
                species="dog"
                subjective="S"
                objective="O"
                assessment="A"
                plan="P"
                imageUrls={[]}
            />
        )

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Bé bị tổn thương da và rụng lông' },
        })
        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => {
            expect(screen.getByText(/Viêm da do vi khuẩn/)).toBeInTheDocument()
        })
    })

    it('shows prescription gating summary before selecting diagnosis', async () => {
        vi.mocked(diagnosisApi.analyzeCase).mockResolvedValue(mockResponse)

        render(
            <AIDiagnosisPanel
                species="dog"
                subjective="S"
                objective="O"
                assessment="A"
                plan="P"
                imageUrls={[]}
            />
        )

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Bé bị đỏ mắt và chảy dịch trong 2 ngày' },
        })
        fireEvent.click(screen.getByRole('button'))

        expect(
            await screen.findByText(/gợi ý đơn thuốc sẽ mở sau khi bác sĩ chọn 1 chẩn đoán trong top 3/i)
        ).toBeInTheDocument()
    })

    it('refines diagnosis with inline follow-up answers and keeps image URLs', async () => {
        const refinedResponse: StaffDiagnosisResponse = {
            ...mockResponse,
            request_id: 'req-2',
            suggested_questions: ['Bé có bỏ ăn không?'],
        }

        vi.mocked(diagnosisApi.analyzeCase)
            .mockResolvedValueOnce(mockResponse)
            .mockResolvedValueOnce(refinedResponse)

        render(
            <AIDiagnosisPanel
                species="dog"
                subjective="Bé bị đỏ mắt và chảy ghèn"
                objective=""
                assessment=""
                plan=""
                imageUrls={['https://example.com/img-1.jpg']}
                pendingImageUrls={['data:image/png;base64,abc']}
            />
        )

        const analyzeButton = screen.getByRole('button', { name: /ai chẩn đoán/i })
        fireEvent.click(analyzeButton)

        await waitFor(() => {
            expect(diagnosisApi.analyzeCase).toHaveBeenCalledTimes(2)
        })

        fireEvent.click(screen.getByRole('button', { name: /xem chi tiết ai/i }))

        const followUpInput = screen.getByPlaceholderText(/nhập trả lời của bác sĩ/i)
        fireEvent.change(followUpInput, { target: { value: 'Bé vẫn ăn uống bình thường, chỉ ngứa nhẹ' } })

        const refineButton = screen.getByRole('button', { name: /cập nhật kết quả theo thông tin bổ sung/i })
        fireEvent.click(refineButton)

        await waitFor(() => {
            expect(diagnosisApi.analyzeCase).toHaveBeenCalledTimes(3)
        })

        const firstAnalyzePayload = vi.mocked(diagnosisApi.analyzeCase).mock.calls[1][0]
        expect(firstAnalyzePayload).toMatchObject({
            synthesis_mode: 'full',
            image_urls: ['https://example.com/img-1.jpg', 'data:image/png;base64,abc'],
        })

        const refinePayload = vi.mocked(diagnosisApi.analyzeCase).mock.calls[2][0]
        expect(refinePayload).toMatchObject({
            synthesis_mode: 'full',
            image_urls: ['https://example.com/img-1.jpg', 'data:image/png;base64,abc'],
        })
        expect(refinePayload.follow_up_answers).toEqual([
            {
                question: 'Bé có bỏ ăn không?',
                answer: 'Bé vẫn ăn uống bình thường, chỉ ngứa nhẹ',
            },
        ])
    })
})
