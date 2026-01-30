import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import EmrDetailPage from './EmrDetailPage'
import { emrService } from '../../../services/emrService'
import { tokenStorage } from '../../../services/authService'

// Mock dependencies
vi.mock('react-router-dom', () => ({
    useParams: () => ({ emrId: 'emr-123' }),
    useNavigate: () => vi.fn()
}))

vi.mock('../../../services/emrService', () => ({
    emrService: {
        getEmrById: vi.fn()
    }
}))

vi.mock('../../../services/authService', () => ({
    tokenStorage: {
        getUser: vi.fn()
    }
}))

describe('EmrDetailPage', () => {
    const mockEmrData = {
        id: 'emr-123',
        petId: 'pet-456',
        clinicId: 'clinic-789',
        examinationDate: '2025-01-20T09:30:00',
        clinicName: 'Pet Care Clinic',
        staffId: 'staff-001',
        staffName: 'Nguyễn Văn A', // This is what we want to verify is displayed
        petName: 'Buddy',
        petSpecies: 'Chó',
        petBreed: 'Golden Retriever',
        weightKg: 25.5,
        temperatureC: 38.5,
        assessment: 'Sức khỏe tốt, không có bất thường',
        plan: 'Tái khám sau 1 tháng',
        prescriptions: [],
        images: [],
        subjective: 'Chó mệt mỏi',
        createdAt: '2025-01-20T09:30:00'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        // Default staff is NOT different from viewer
        vi.mocked(tokenStorage.getUser).mockReturnValue({ userId: 'staff-999', role: 'STAFF' } as any)
    })

    it('renders loading state initially', () => {
        vi.mocked(emrService.getEmrById).mockImplementation(() => new Promise(() => { })) // Never resolves
        render(<EmrDetailPage />)
        expect(screen.getByText('Đang tải...')).toBeInTheDocument()
    })

    it('renders EMR details including Staff Name correctly', async () => {
        vi.mocked(emrService.getEmrById).mockResolvedValue(mockEmrData)

        render(<EmrDetailPage />)

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument()
        })

        // Verify Header Info
        expect(screen.getByText('CHI TIẾT BỆNH ÁN')).toBeInTheDocument()

        // Verify Pet Info
        expect(screen.getByText('Buddy')).toBeInTheDocument()
        expect(screen.getByText(/Chó • Golden Retriever/)).toBeInTheDocument()

        // Data Integrity Check: Verify Staff Name is displayed with Prefix "BS."
        // The component renders: <span>BS. {emr.staffName}</span>
        const staffElement = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'span' && content.includes('BS. Nguyễn Văn A')
        })
        expect(staffElement).toBeInTheDocument()

        // Verify Vitals
        expect(screen.getByText('25.5 kg')).toBeInTheDocument()
        expect(screen.getByText('38.5°C')).toBeInTheDocument()
    })

    it('renders error state when API fails', async () => {
        vi.mocked(emrService.getEmrById).mockRejectedValue({ response: { data: { message: 'Lỗi tải dữ liệu' } } })

        render(<EmrDetailPage />)

        await waitFor(() => {
            expect(screen.getByText('Lỗi tải dữ liệu')).toBeInTheDocument()
        })
    })
})
