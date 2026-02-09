import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ClinicForm } from '../ClinicForm'

// Mock dependencies
vi.mock('../AddressAutocompleteOSM', () => ({
    AddressAutocompleteOSM: ({ value, onChange, placeholder }: any) => (
        <input
            data-testid="address-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    ),
}))

vi.mock('../ClinicImageUpload', () => ({
    ClinicImageUpload: () => <div data-testid="image-upload">Mock Image Upload</div>,
}))

vi.mock('../ClinicLogoUpload', () => ({
    ClinicLogoUpload: () => <div data-testid="logo-upload">Mock Logo Upload</div>,
}))

vi.mock('../../common', () => ({
    LocationSelector: () => <div data-testid="location-selector">Mock Location Selector</div>,
}))

vi.mock('../../../services/endpoints/file', () => ({
    uploadBusinessLicense: vi.fn(),
}))

vi.mock('../../Toast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

describe('ClinicForm - SOS Fee Feature', () => {
    const mockOnSubmit = vi.fn()
    const mockOnCancel = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-CF-SOS-001: renders SOS fee input field', () => {
        render(
            <ClinicForm
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        )

        const sosFeeLabel = screen.getByText(/Phí Dịch Vụ SOS/i)
        expect(sosFeeLabel).toBeInTheDocument()

        const sosFeeInput = screen.getByPlaceholderText('Ví dụ: 200000')
        expect(sosFeeInput).toBeInTheDocument()
    })

    it('TC-CF-SOS-002: renders SOS fee with initial value', () => {
        render(
            <ClinicForm
                initialData={{
                    name: 'Test Clinic',
                    phone: '0901234567',
                    address: 'Test Address',
                    sosFee: 200000
                }}
                onSubmit={mockOnSubmit}
            />
        )

        const sosFeeInput = screen.getByPlaceholderText('Ví dụ: 200000')
        expect(sosFeeInput).toHaveValue(200000)
    })

    it('TC-CF-SOS-003: updates SOS fee value on change', () => {
        render(
            <ClinicForm
                onSubmit={mockOnSubmit}
            />
        )

        const sosFeeInput = screen.getByPlaceholderText('Ví dụ: 200000')
        fireEvent.change(sosFeeInput, { target: { value: '150000' } })

        expect(sosFeeInput).toHaveValue(150000)
    })

    it('TC-CF-SOS-004: displays helper text for SOS fee', () => {
        render(
            <ClinicForm
                onSubmit={mockOnSubmit}
            />
        )

        const helperText = screen.getByText(/Phí này sẽ được cộng thêm vào tổng hóa đơn cho các yêu cầu cứu hộ khẩn cấp/i)
        expect(helperText).toBeInTheDocument()
    })

    it('TC-CF-SOS-005: renders Payment & SOS section header', () => {
        render(
            <ClinicForm
                onSubmit={mockOnSubmit}
            />
        )

        const sectionHeader = screen.getByText(/THANH TOÁN & DỊCH VỤ SOS/i)
        expect(sectionHeader).toBeInTheDocument()
    })

    it('TC-CF-SOS-006: SOS fee input accepts only numbers', () => {
        render(
            <ClinicForm
                onSubmit={mockOnSubmit}
            />
        )

        const sosFeeInput = screen.getByPlaceholderText('Ví dụ: 200000')
        expect(sosFeeInput).toHaveAttribute('type', 'number')
        expect(sosFeeInput).toHaveAttribute('min', '0')
    })
})
