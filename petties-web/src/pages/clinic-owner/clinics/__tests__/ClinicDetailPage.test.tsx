import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { ClinicResponse } from '../../../../types/clinic'

// Mock data for testing
const mockClinicWithSosFee: Partial<ClinicResponse> = {
    clinicId: 'test-clinic-id',
    ownerId: 'test-owner-id',
    name: 'Test Clinic',
    description: 'A test clinic',
    address: '123 Test Street',
    phone: '0901234567',
    status: 'APPROVED',
    ratingAvg: 4.5,
    ratingCount: 10,
    createdAt: '2024-01-01T00:00:00Z',
    sosFee: 200000,
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
}

// Simple component to test SOS Fee display logic
const SOSFeeDisplay = ({ clinic }: { clinic: Partial<ClinicResponse> }) => {
    const hasSosFee = clinic.sosFee && clinic.sosFee > 0
    const hasBankInfo = clinic.bankName && clinic.accountNumber

    if (!hasSosFee && !hasBankInfo) return null

    return (
        <div data-testid="sos-payment-section">
            <h2>THANH TOÁN & DỊCH VỤ SOS</h2>

            {hasSosFee && (
                <div data-testid="sos-fee-card">
                    <div data-testid="sos-fee-label">PHÍ CẤP CỨU (SOS)</div>
                    <div data-testid="sos-fee-description">Áp dụng khẩn cấp cho các dịch vụ cứu hộ lưu động</div>
                    <div data-testid="sos-fee-value">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(clinic.sosFee!)}
                    </div>
                </div>
            )}

            {hasBankInfo && (
                <div data-testid="bank-info-card">
                    <div data-testid="bank-name">{clinic.bankName}</div>
                    <div data-testid="account-number">{clinic.accountNumber}</div>
                    <img
                        src={`https://img.vietqr.io/image/${clinic.bankName}-${clinic.accountNumber}-compact2.jpg`}
                        alt="VietQR Code"
                        data-testid="vietqr-image"
                    />
                </div>
            )}
        </div>
    )
}

describe('SOSFeeDisplay - SOS Fee Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-SOS-DISPLAY-001: displays section when SOS fee > 0', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        expect(screen.getByTestId('sos-payment-section')).toBeInTheDocument()
        expect(screen.getByText(/THANH TOÁN & DỊCH VỤ SOS/i)).toBeInTheDocument()
    })

    it('TC-SOS-DISPLAY-002: displays SOS fee label correctly', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        expect(screen.getByTestId('sos-fee-label')).toHaveTextContent('PHÍ CẤP CỨU (SOS)')
    })

    it('TC-SOS-DISPLAY-003: displays SOS fee description', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        expect(screen.getByTestId('sos-fee-description')).toHaveTextContent(
            'Áp dụng khẩn cấp cho các dịch vụ cứu hộ lưu động'
        )
    })

    it('TC-SOS-DISPLAY-004: formats SOS fee as Vietnamese currency', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        const feeValue = screen.getByTestId('sos-fee-value')
        expect(feeValue).toHaveTextContent('200.000')
        expect(feeValue).toHaveTextContent('₫')
    })

    it('TC-SOS-DISPLAY-005: hides section when SOS fee is 0', () => {
        render(<SOSFeeDisplay clinic={{ ...mockClinicWithSosFee, sosFee: 0, bankName: undefined, accountNumber: undefined }} />)

        expect(screen.queryByTestId('sos-payment-section')).not.toBeInTheDocument()
    })

    it('TC-SOS-DISPLAY-006: hides section when SOS fee is undefined', () => {
        render(<SOSFeeDisplay clinic={{ ...mockClinicWithSosFee, sosFee: undefined, bankName: undefined, accountNumber: undefined }} />)

        expect(screen.queryByTestId('sos-payment-section')).not.toBeInTheDocument()
    })

    it('TC-SOS-DISPLAY-007: shows section with only bank info (no SOS fee)', () => {
        render(<SOSFeeDisplay clinic={{ ...mockClinicWithSosFee, sosFee: 0 }} />)

        expect(screen.getByTestId('sos-payment-section')).toBeInTheDocument()
        expect(screen.queryByTestId('sos-fee-card')).not.toBeInTheDocument()
        expect(screen.getByTestId('bank-info-card')).toBeInTheDocument()
    })
})

describe('SOSFeeDisplay - Bank Info', () => {
    it('TC-BANK-DISPLAY-001: displays bank name', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        expect(screen.getByTestId('bank-name')).toHaveTextContent('Vietcombank')
    })

    it('TC-BANK-DISPLAY-002: displays account number', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        expect(screen.getByTestId('account-number')).toHaveTextContent('1234567890')
    })

    it('TC-BANK-DISPLAY-003: renders VietQR image with correct src', () => {
        render(<SOSFeeDisplay clinic={mockClinicWithSosFee} />)

        const qrImage = screen.getByTestId('vietqr-image')
        expect(qrImage).toHaveAttribute('src', 'https://img.vietqr.io/image/Vietcombank-1234567890-compact2.jpg')
        expect(qrImage).toHaveAttribute('alt', 'VietQR Code')
    })
})
