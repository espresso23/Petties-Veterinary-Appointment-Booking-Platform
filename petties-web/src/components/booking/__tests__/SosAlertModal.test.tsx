import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SosAlertModal from '../SosAlertModal'
import type { SosAlertMessage } from '../../../services/websocket/sosWebSocket'

const mockNavigate = vi.fn()
const mockShowToast = vi.fn()
const mockConfirmSosRequest = vi.fn()
const mockDeclineSosRequest = vi.fn()
const mockGetActiveSosAlerts = vi.fn()
const mockGetAvailableStaffForConfirm = vi.fn()
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()

let alertHandler: ((message: SosAlertMessage) => void) | undefined

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}))

vi.mock('../../Toast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('../../../services/bookingService', () => ({
    confirmSosRequest: (...args: unknown[]) => mockConfirmSosRequest(...args),
    declineSosRequest: (...args: unknown[]) => mockDeclineSosRequest(...args),
    getActiveSosAlerts: (...args: unknown[]) => mockGetActiveSosAlerts(...args),
    getAvailableStaffForConfirm: (...args: unknown[]) => mockGetAvailableStaffForConfirm(...args),
}))

vi.mock('../../../services/websocket/sosWebSocket', () => ({
    sosWebSocket: {
        connect: (...args: unknown[]) => mockConnect(...args),
        disconnect: (...args: unknown[]) => mockDisconnect(...args),
        addAlertHandler: (handler: (message: SosAlertMessage) => void) => {
            alertHandler = handler
            return () => {
                if (alertHandler === handler) {
                    alertHandler = undefined
                }
            }
        },
    },
}))

describe('SosAlertModal', () => {
    const defaultAlert: SosAlertMessage = {
        bookingId: 'booking-1',
        event: 'CLINIC_NOTIFIED',
        petName: 'Milu',
        petOwnerName: 'Nguyễn Văn A',
        symptoms: 'Khó thở',
        remainingSeconds: 45,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        alertHandler = undefined
        mockConnect.mockResolvedValue(undefined)
        mockGetActiveSosAlerts.mockResolvedValue([])
        mockGetAvailableStaffForConfirm.mockResolvedValue([
            { staffId: 'staff-1', fullName: 'Bác sĩ Lan', isSuggested: true },
        ])
        mockConfirmSosRequest.mockResolvedValue({ bookingId: 'booking-1' })
        mockDeclineSosRequest.mockResolvedValue(undefined)

        vi.stubGlobal('Audio', vi.fn(() => ({
            currentTime: 0,
            play: vi.fn().mockResolvedValue(undefined),
        })))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('không thêm alert trùng vào queue khi alert hiện tại nhận lại cùng booking', async () => {
        mockGetActiveSosAlerts.mockResolvedValue([defaultAlert])

        render(<SosAlertModal clinicId="clinic-1" />)

        expect(await screen.findByText('Milu')).toBeInTheDocument()
        expect(alertHandler).toBeTypeOf('function')

        await act(async () => {
            alertHandler?.({
                ...defaultAlert,
                remainingSeconds: 30,
            })
        })

        await waitFor(() => {
            expect(screen.getByText(/Cần phản hồi trong 30s/i)).toBeInTheDocument()
        })

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'XÁC NHẬN CẤP CỨU' }))

        await waitFor(() => {
            expect(mockConfirmSosRequest).toHaveBeenCalledWith('booking-1', 'staff-1')
            expect(mockNavigate).toHaveBeenCalledWith('/clinic-manager/bookings?bookingId=booking-1')
        })

        await waitFor(() => {
            expect(screen.queryByText('Milu')).not.toBeInTheDocument()
        })
    })

    it('ưu tiên hiển thị alert sắp hết thời gian hơn khi sync nhiều SOS', async () => {
        mockGetActiveSosAlerts.mockResolvedValue([
            {
                ...defaultAlert,
                bookingId: 'booking-60',
                petName: 'Bé Cún',
                remainingSeconds: 60,
            },
            {
                ...defaultAlert,
                bookingId: 'booking-15',
                petName: 'Bé Mèo',
                remainingSeconds: 15,
            },
        ])

        render(<SosAlertModal clinicId="clinic-1" />)

        expect(await screen.findByText('Bé Mèo')).toBeInTheDocument()
        expect(screen.queryByText('Bé Cún')).not.toBeInTheDocument()
        expect(screen.getByText(/Cần phản hồi trong 15s/i)).toBeInTheDocument()
    })
})
