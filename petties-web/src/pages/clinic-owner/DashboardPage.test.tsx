import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ClinicOwnerDashboardPage } from './DashboardPage'
import { getClinicRevenueSummary, getClinicPayments } from '../../services/paymentService'
import { getBookingsByClinic } from '../../services/bookingService'
import { subscriptionService } from '../../services/api/subscriptionService'

vi.mock('../../components/clinic/ClinicDashboardCharts', () => ({
    ClinicDashboardCharts: () => <div data-testid="owner-charts-mock" />,
}))

vi.mock('../../store/authStore', () => ({
    useAuthStore: () => ({ user: { fullName: 'Owner test' } }),
}))

const mockClinic = {
    clinicId: 'clinic-1',
    name: 'Demo Clinic',
    ratingAvg: 4.5,
    ratingCount: 10,
    services: [{ serviceId: 's1' }],
}

vi.mock('../../store/clinicStore', () => ({
    useClinicStore: () => ({
        clinics: [mockClinic],
        getMyClinics: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../services/paymentService', () => ({
    getClinicRevenueSummary: vi.fn(),
    getClinicPayments: vi.fn(),
}))

vi.mock('../../services/bookingService', () => ({
    getBookingsByClinic: vi.fn(),
}))

vi.mock('../../services/api/subscriptionService', () => ({
    subscriptionService: {
        getClinicSubscriptionStatus: vi.fn(),
    },
}))

function todayYmd(): string {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

describe('ClinicOwnerDashboardPage', () => {
    beforeEach(() => {
        vi.mocked(getClinicRevenueSummary).mockImplementation(async (_id, period) => ({
            success: true,
            clinicId: 'clinic-1',
            clinicName: 'Demo',
            period: String(period),
            items:
                period === 'WEEK'
                    ? [
                          { label: 'Mon', total: 10000, periodStart: '' },
                          { label: 'Tue', total: 20000, periodStart: '' },
                      ]
                    : period === 'MONTH'
                      ? [{ label: 'W1', total: 5000000, periodStart: '' }]
                      : [{ label: 'day', total: 100000, periodStart: '' }],
            message: '',
        }))
        vi.mocked(getBookingsByClinic).mockResolvedValue({
            content: [
                {
                    bookingId: 'b1',
                    bookingCode: 'BK-01',
                    bookingDate: todayYmd(),
                    bookingTime: '09:00',
                    status: 'COMPLETED',
                    ownerName: 'Guest A',
                },
            ],
        } as Awaited<ReturnType<typeof getBookingsByClinic>>)
        vi.mocked(getClinicPayments).mockImplementation(async (_id, _limit, status) => {
            if (status === 'PENDING') {
                return {
                    payments: [{ paymentId: 'p-pend', bookingCode: 'X', amount: 1, status: 'PENDING', createdAt: '' }],
                } as Awaited<ReturnType<typeof getClinicPayments>>
            }
            return {
                payments: [
                    {
                        paymentId: 'pay-1',
                        bookingId: 'b-pay',
                        bookingCode: 'BK-P1',
                        amount: 200000,
                        paidAt: '2026-04-01T10:00:00Z',
                        method: 'QR',
                        status: 'PAID',
                        createdAt: '2026-04-01T09:00:00Z',
                    },
                ],
            } as Awaited<ReturnType<typeof getClinicPayments>>
        })
        vi.mocked(subscriptionService.getClinicSubscriptionStatus).mockResolvedValue({
            active: null,
            pending: null,
        })
    })

    it('renders title and clinic name', async () => {
        render(
            <MemoryRouter>
                <ClinicOwnerDashboardPage />
            </MemoryRouter>
        )

        expect(screen.getByRole('heading', { level: 1, name: 'Tổng quan phòng khám' })).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByText('Demo Clinic')).toBeInTheDocument()
        })
    })

    it('shows revenue after load (VND vi-VN)', async () => {
        render(
            <MemoryRouter>
                <ClinicOwnerDashboardPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText(/100\.000/)).toBeInTheDocument()
        })
    })

    it('renders chart placeholder', async () => {
        render(
            <MemoryRouter>
                <ClinicOwnerDashboardPage />
            </MemoryRouter>
        )
        await waitFor(() => {
            expect(screen.getByTestId('owner-charts-mock')).toBeInTheDocument()
        })
    })
})
