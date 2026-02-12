import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SmartVaccinationForm } from '../SmartVaccinationForm'
import { getAllServices } from '../../../services/endpoints/service'

// Mock the service call
vi.mock('../../../services/endpoints/service', () => ({
    getAllServices: vi.fn()
}))

// Mock scrollIntoView which is not implemented in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe('SmartVaccinationForm', () => {
    const mockPet = {
        id: 'pet-123',
        name: 'Buddy',
        species: 'Dog',
        breed: 'Golden Retriever',
        dob: '2020-01-01'
    }

    const mockRecords = [
        {
            id: 'rec-1',
            vaccineName: 'Rabies',
            vaccinationDate: '2023-01-01',
            workflowStatus: 'COMPLETED',
            doseNumber: 1
        }
    ]

    const mockTemplates = [
        {
            id: 'tpl-rabies',
            name: 'Rabies',
            seriesDoses: 1,
            repeatIntervalDays: 365,
            isAnnualRepeat: true,
            targetSpecies: 'DOG'
        },
        {
            id: 'tpl-5-bn',
            name: 'Vaccine 5 Bệnh',
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
            // Default mock implementation
            ; (getAllServices as any).mockResolvedValue(mockClinicServices)
    })

    it('renders correctly in create mode', () => {
        render(
            <SmartVaccinationForm
                pet={mockPet as any}
                records={mockRecords as any}
                templates={mockTemplates as any}
                isSubmitting={false}
                onSubmit={vi.fn()}
            />
        )

        expect(screen.getByPlaceholderText(/Nhập tên hoặc chọn từ danh mục/i)).toBeInTheDocument()
        expect(screen.getByText('MŨI 1')).toHaveClass('bg-white') // Default dose sequence
    })

    it('updates dose sequence when clicked', async () => {
        render(
            <SmartVaccinationForm
                pet={mockPet as any}
                records={mockRecords as any}
                templates={mockTemplates as any}
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
                pet={mockPet as any}
                records={mockRecords as any}
                templates={mockTemplates as any}
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

        // Verify dose prediction: Buddy has no "5 bệnh" record, so it should be Dose 1
        expect(screen.getByText('MŨI 1')).toHaveClass('bg-white')
    })

    it('predicts next dose correctly for existing records', async () => {
        // Add a completed record for "5 bệnh"
        const existingRecords = [
            {
                id: 'rec-1',
                vaccineName: 'Tiêm 5 bệnh',
                vaccinationDate: '2023-01-01',
                workflowStatus: 'COMPLETED',
                doseNumber: 1
            }
        ]

        render(
            <SmartVaccinationForm
                pet={mockPet as any}
                records={existingRecords as any}
                templates={mockTemplates as any}
                isSubmitting={false}
                onSubmit={vi.fn()}
            />
        )

        // Open modal and select "Tiêm 5 bệnh"
        fireEvent.click(screen.getByTitle('Mở danh mục dịch vụ'))
        await waitFor(() => screen.getByText('Tiêm 5 bệnh'))
        fireEvent.click(screen.getByText('Tiêm 5 bệnh'))

        // Should predict Dose 2
        expect(screen.getByText('MŨI 2')).toHaveClass('bg-white')
    })

    it('calculates nextDueDate based on template interval', async () => {
        // Fixed date for testing
        const testDate = new Date(2024, 0, 1) // Jan 1st, 2024

        render(
            <SmartVaccinationForm
                pet={mockPet as any}
                records={[]}
                templates={mockTemplates as any}
                isSubmitting={false}
                onSubmit={vi.fn()}
                initialData={{ vaccinationDate: testDate }}
            />
        )

        // Select "Tiêm 5 bệnh" which has 21 days interval
        fireEvent.click(screen.getByTitle('Mở danh mục dịch vụ'))
        await waitFor(() => screen.getByText('Tiêm 5 bệnh'))
        fireEvent.click(screen.getByText('Tiêm 5 bệnh'))

        // Jan 1st + 21 days = Jan 22nd
        const nextDueDateInput = screen.getByPlaceholderText('Chọn ngày...') as HTMLInputElement
        expect(nextDueDateInput.value).toBe('22/01/2024')
    })

    it('calls onSubmit with form data', async () => {
        const onSubmit = vi.fn()
        render(
            <SmartVaccinationForm
                pet={mockPet as any}
                records={[]}
                templates={mockTemplates as any}
                isSubmitting={false}
                onSubmit={onSubmit}
            />
        )

        // Fill required fields
        const nameInput = screen.getByPlaceholderText(/Nhập tên hoặc chọn từ danh mục/i)
        fireEvent.change(nameInput, { target: { value: 'Custom Vaccine' } })

        const submitBtn = screen.getByText('LƯU HỒ SƠ TIÊM')
        fireEvent.click(submitBtn)

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            vaccineName: 'Custom Vaccine',
            doseSequence: '1'
        }))
    })
})
