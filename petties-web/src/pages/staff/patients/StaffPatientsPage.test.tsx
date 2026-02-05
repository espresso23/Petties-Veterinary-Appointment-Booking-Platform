import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { StaffPatientsPage } from './StaffPatientsPage'
import { emrService } from '../../../services/emrService'
import { vaccinationService } from '../../../services/vaccinationService'
import * as petService from '../../../services/api/petService'
import { tokenStorage } from '../../../services/authService'
import { useAuthStore } from '../../../store/authStore'

// Mock dependencies
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn()
}))

vi.mock('../../../components/Toast', () => ({
    useToast: () => ({ showToast: vi.fn() })
}))

vi.mock('../../../services/emrService', () => ({
    emrService: {
        getEmrsByPetId: vi.fn()
    }
}))

vi.mock('../../../services/vaccinationService', () => ({
    vaccinationService: {
        getVaccinationsByPet: vi.fn(),
        getUpcomingVaccinations: vi.fn(),
        formatDate: vi.fn((d: string) => d || '—'),
        calculateStatus: vi.fn((_d: string) => 'Valid')
    }
}))

vi.mock('../../../services/api/petService', () => ({
    getStaffPatients: vi.fn()
}))

vi.mock('../../../services/authService', () => ({
    tokenStorage: {
        getUser: vi.fn()
    }
}))

vi.mock('../../../store/authStore', () => ({
    useAuthStore: vi.fn()
}))

vi.mock('../../../services/bookingService', () => ({
    getBookingsByStaff: vi.fn().mockResolvedValue([])
}))

vi.mock('../../../services/api/vaccineTemplateService', () => ({
    vaccineTemplateService: {
        getTemplates: vi.fn().mockResolvedValue([]),
        getAllTemplates: vi.fn().mockResolvedValue([])
    }
}))

// Mock DatePicker since it can be problematic in JSDOM
vi.mock('react-datepicker', () => {
    return {
        default: (props: any) => <input data-testid="datepicker" onChange={e => props.onChange(new Date(e.target.value))} value={props.selected ? props.selected.toISOString().substr(0, 10) : ''} />,
        registerLocale: vi.fn()
    }
})

describe('StaffPatientsPage', () => {
    const mockPatients = [
        {
            petId: 'pet-1',
            petName: 'Mimi',
            species: 'CAT',
            breed: 'Mướp',
            age: '1 tuổi',
            ownerName: 'Lê Thị B',
            ownerPhone: '0909090909',
            isAssignedToMe: true
        }
    ]

    const mockVaccinations = [
        {
            id: 'vac-1',
            vaccineName: 'Rabies',
            vaccinationDate: '2025-01-15',
            nextDueDate: '2026-01-15',
            batchNumber: 'RB-123',
            staffId: 'staff-002',
            staffName: 'Trần Văn B', // Target for verification
            status: 'Valid',
            notes: 'Không có phản ứng phụ'
        }
    ]

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock auth store with user data
        vi.mocked(useAuthStore).mockReturnValue({
            user: {
                userId: 'staff-001',
                workingClinicId: 'clinic-001',
                role: 'STAFF'
            }
        } as any)

        // Mock tokenStorage
        vi.mocked(tokenStorage.getUser).mockReturnValue({
            userId: 'staff-001',
            role: 'STAFF'
        } as any)
    })

    it('renders list of patients and opens vaccination tab correctly', async () => {
        // Setup initial load
        vi.mocked(petService.getStaffPatients).mockResolvedValue(mockPatients as any)
        vi.mocked(emrService.getEmrsByPetId).mockResolvedValue([])
        vi.mocked(vaccinationService.getVaccinationsByPet).mockResolvedValue(mockVaccinations as any)
        vi.mocked(vaccinationService.getUpcomingVaccinations).mockResolvedValue([])

        render(<StaffPatientsPage />)

        // 1. Verify Patient List loads
        await waitFor(() => {
            expect(screen.getByText('Mimi')).toBeInTheDocument()
            expect(screen.getByText('Lê Thị B')).toBeInTheDocument()
        })

        // 2. Click on the patient row to open modal
        const row = screen.getByText('Mimi').closest('tr')
        fireEvent.click(row!)

        // 3. Verify Modal Opened - Look for the EMR tab button
        const emrTab = await screen.findByRole('button', { name: /Lịch sử bệnh án/i })
        expect(emrTab).toBeInTheDocument()

        // 4. Switch to Vaccinations Tab
        const vaccineTab = screen.getByRole('button', { name: /Tiêm phòng/i })
        fireEvent.click(vaccineTab)

        // 5. Verify Vaccination Data Loading & Rendering
        await waitFor(() => {
            // Check Vaccine Name
            expect(screen.getByText('Rabies')).toBeInTheDocument()
            // Check Staff Name (Data Integrity Check)
            // The component renders: Dr. {staffName.split(' ').pop()}
            // "Trần Văn B" -> "B" -> "Dr. B"
            expect(screen.getByText('Dr. B')).toBeInTheDocument()
        })
    })
})
