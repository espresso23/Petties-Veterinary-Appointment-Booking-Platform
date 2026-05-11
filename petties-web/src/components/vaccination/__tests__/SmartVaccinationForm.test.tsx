import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SmartVaccinationForm } from '../SmartVaccinationForm'
import { getAllServices } from '../../../services/endpoints/service'
import type { Pet } from '../../../services/api/petService'
import type { VaccinationRecord } from '../../../services/vaccinationService'
import type { VaccineTemplate } from '../../../services/api/vaccineTemplateService'

// Mock the service call
vi.mock('../../../services/endpoints/service', () => ({
    getAllServices: vi.fn()
}))

describe('SmartVaccinationForm', () => {
    const mockPet: Pet = {
        id: 'pet-123',
        name: 'Buddy',
        species: 'DOG',
        breed: 'Golden Retriever',
        dateOfBirth: '2020-01-01'
    }

    const mockRecords: VaccinationRecord[] = [
        {
            id: 'rec-1',
            petId: 'pet-123',
            staffId: 'staff-001',
            clinicId: 'clinic-001',
            clinicName: 'Test Clinic',
            staffName: 'Bác sĩ A',
            vaccineName: 'Rabies',
            vaccinationDate: '2023-01-01',
            workflowStatus: 'COMPLETED',
            doseNumber: 1,
            createdAt: '2023-01-01T00:00:00Z',
            status: 'Valid'
        }
    ]

    const mockTemplates: VaccineTemplate[] = [
        {
            id: 'tpl-rabies',
            name: 'Rabies',
            manufacturer: 'Test Pharma',
            minAgeWeeks: 8,
            seriesDoses: 1,
            repeatIntervalDays: 365,
            isAnnualRepeat: true,
            targetSpecies: 'DOG'
        },
        {
            id: 'tpl-5-bn',
            name: 'Vaccine 5 Bệnh',
            manufacturer: 'Test Pharma',
            minAgeWeeks: 8,
            seriesDoses: 3,
            repeatIntervalDays: 21,
            isAnnualRepeat: true,
            targetSpecies: 'DOG'
        }
    ]

    const mockClinicServices = [
        {
            serviceId: 'svc-1',
            name: 'Tiêm Dại (Rabies)',
            serviceCategory: 'VACCINATION',
            vaccineTemplateId: 'tpl-rabies',
            basePrice: 150000
        },
        {
            serviceId: 'svc-2',
            name: 'Tiêm 5 bệnh',
            serviceCategory: 'VACCINATION',
            vaccineTemplateId: 'tpl-5-bn',
            basePrice: 200000
        }
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        // Mock scrollIntoView which is not implemented in JSDOM
        if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
            window.HTMLElement.prototype.scrollIntoView = vi.fn()
        }
        // Default mock implementation
        ;(getAllServices as any).mockResolvedValue(mockClinicServices)
    })

    afterEach(() => {
        cleanup()
    })

    it('renders correctly in create mode', () => {
        render(
            <SmartVaccinationForm
                pet={mockPet}
                records={mockRecords}
                templates={mockTemplates}
                isSubmitting={false}
                onSubmit={vi.fn()}
            />
        )

        expect(screen.getByPlaceholderText(/Chọn dịch vụ từ danh mục phòng khám.../i)).toBeInTheDocument()
        expect(screen.getByText('MŨI 1')).toHaveClass('bg-white')
    })

    it('updates dose sequence when clicked', async () => {
        render(
            <SmartVaccinationForm
                pet={mockPet}
                records={mockRecords}
                templates={mockTemplates}
                isSubmitting={false}
                onSubmit={vi.fn()}
            />
        )

        const dose2Btn = screen.getByText('MŨI 2')
        fireEvent.click(dose2Btn)

        expect(dose2Btn).toHaveClass('bg-white')
    })

    it('opens template modal and selects a service', async () => {
        const onSubmit = vi.fn()
        render(
            <SmartVaccinationForm
                pet={mockPet}
                records={mockRecords}
                templates={mockTemplates}
                isSubmitting={false}
                onSubmit={onSubmit}
            />
        )

        // Open modal
        const openModalBtn = screen.getByTitle('Mở danh mục dịch vụ')
        fireEvent.click(openModalBtn)

        // Wait for services to load and modal to show them
        await waitFor(() => {
            expect(screen.getByText('Danh Mục Dịch Vụ Clinic')).toBeInTheDocument()
        })

        const serviceItem = screen.getByText('Tiêm 5 bệnh')
        fireEvent.click(serviceItem)

        // Modal should close and form should be populated
        expect(screen.queryByText('Danh Mục Dịch Vụ Clinic')).not.toBeInTheDocument()
        expect(screen.getByDisplayValue('Tiêm 5 bệnh')).toBeInTheDocument()
        expect(screen.getByText('MŨI 1')).toHaveClass('bg-white')
    })

    it('predicts next dose correctly for existing records', async () => {
        const existingRecords: VaccinationRecord[] = [
            {
                id: 'rec-1',
                petId: 'pet-123',
                staffId: 'staff-001',
                clinicId: 'clinic-001',
                clinicName: 'Test Clinic',
                staffName: 'Bác sĩ A',
                vaccineName: 'Tiêm 5 bệnh',
                vaccinationDate: '2023-01-01',
                workflowStatus: 'COMPLETED',
                doseNumber: 1,
                createdAt: '2023-01-01T00:00:00Z',
                status: 'Valid'
            }
        ]

        render(
            <SmartVaccinationForm
                pet={mockPet}
                records={existingRecords}
                templates={mockTemplates}
                isSubmitting={false}
                onSubmit={vi.fn()}
            />
        )

        fireEvent.click(screen.getByTitle('Mở danh mục dịch vụ'))
        await waitFor(() => expect(screen.getByText('Tiêm 5 bệnh')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Tiêm 5 bệnh'))

        expect(screen.getByText('MŨI 2')).toHaveClass('bg-white')
    })

    it('calculates nextDueDate based on template interval', async () => {
        const testDate = new Date(2024, 0, 1)

        render(
            <SmartVaccinationForm
                pet={mockPet}
                records={[]}
                templates={mockTemplates}
                isSubmitting={false}
                onSubmit={vi.fn()}
                initialData={{ vaccinationDate: testDate }}
            />
        )

        fireEvent.click(screen.getByTitle('Mở danh mục dịch vụ'))
        await waitFor(() => expect(screen.getByText('Tiêm 5 bệnh')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Tiêm 5 bệnh'))

        const nextDueDateInput = screen.getByPlaceholderText('Chọn ngày...') as HTMLInputElement
        expect(nextDueDateInput.value).toBe('22/01/2024')
    })

    it('calls onSubmit with form data', async () => {
        const onSubmit = vi.fn()
        render(
            <SmartVaccinationForm
                pet={mockPet}
                records={[]}
                templates={mockTemplates}
                isSubmitting={false}
                onSubmit={onSubmit}
            />
        )

        fireEvent.click(screen.getByTitle('Mở danh mục dịch vụ'))
        await waitFor(() => expect(screen.getByText('Tiêm 5 bệnh')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Tiêm 5 bệnh'))

        const submitBtn = screen.getByText('LƯU HỒ SƠ TIÊM')
        fireEvent.click(submitBtn)

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            vaccineName: 'Tiêm 5 bệnh',
            doseSequence: '1'
        }))
    })
})
