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
    useNavigate: () => vi.fn(),
    useLocation: () => ({
        state: null,
        pathname: '/staff/patients',
        search: '',
        hash: '',
        key: 'default'
    })
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
        calculateStatus: vi.fn(() => 'Valid')
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
    getBookingsByStaff: vi.fn().mockResolvedValue([]),
    getClinicTodayBookings: vi.fn().mockResolvedValue([])
}))

vi.mock('../../../services/api/vaccineTemplateService', () => ({
    vaccineTemplateService: {
        getTemplates: vi.fn().mockResolvedValue([]),
        getAllTemplates: vi.fn().mockResolvedValue([])
    }
}))

// Mock DatePicker since it can be problematic in JSDOM
interface DatePickerProps {
    onChange: (date: Date) => void;
    selected: Date | null;
}
vi.mock('react-datepicker', () => {
    return {
        default: (props: DatePickerProps) => <input data-testid="datepicker" onChange={e => props.onChange(new Date(e.target.value))} value={props.selected ? props.selected.toISOString().substr(0, 10) : ''} />,
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
            ageYears: 1,
            ageMonths: 0,
            ownerName: 'Lê Thị B',
            ownerPhone: '0909090909',
            isAssignedToMe: true
        }
    ]

    const mockVaccinations = [
        {
            id: 'vac-1',
            petId: 'pet-1',
            clinicId: 'clinic-001',
            clinicName: 'Test Clinic',
            vaccineName: 'Rabies',
            vaccinationDate: '2025-01-15',
            nextDueDate: '2026-01-15',
            batchNumber: 'RB-123',
            staffId: 'staff-002',
            staffName: 'Trần Văn B', // Target for verification
            status: 'Valid' as "Valid" | "Expiring Soon" | "Overdue" | "N/A",
            workflowStatus: 'COMPLETED' as const, // Required for list view filter
            notes: 'Không có phản ứng phụ',
            createdAt: '2025-01-15T10:00:00Z'
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
        } as ReturnType<typeof useAuthStore>)

        // Mock tokenStorage
        vi.mocked(tokenStorage.getUser).mockReturnValue({
            userId: 'staff-001',
            role: 'STAFF'
        } as ReturnType<typeof tokenStorage.getUser>)
    })

    it('renders list of patients and opens vaccination tab correctly', async () => {
        // Setup initial load
        vi.mocked(petService.getStaffPatients).mockResolvedValue(mockPatients)
        vi.mocked(emrService.getEmrsByPetId).mockResolvedValue([])
        vi.mocked(vaccinationService.getVaccinationsByPet).mockResolvedValue(mockVaccinations)
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
            // The component renders: NV. {staffName.split(' ').pop()}
            // "Trần Văn B" -> "B" -> "NV. B"
            expect(screen.getByText('NV. B')).toBeInTheDocument()
        })
    })
})
