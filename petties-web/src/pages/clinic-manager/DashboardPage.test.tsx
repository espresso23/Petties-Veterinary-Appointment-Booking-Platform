import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ClinicManagerDashboardPage } from './DashboardPage'
import { getBookingsByClinic, getActiveSosAlerts } from '../../services/bookingService'
import { getClinicRevenueSummary, getClinicPayments } from '../../services/paymentService'
import { getClinicRefundApplications } from '../../services/refundApplicationService'

vi.mock('../../components/clinic/ClinicDashboardCharts', () => ({
    ClinicDashboardCharts: () => <div data-testid="manager-charts-mock" />,
}))

vi.mock('../../store/authStore', () => ({
    useAuthStore: () => ({ user: { fullName: 'Manager test' } }),
}))

const mockClinic = {
    clinicId: 'cm-1',
    name: 'Managed Clinic',
}

vi.mock('../../store/clinicStore', () => ({
    useClinicStore: () => ({
        clinics: [mockClinic],
        getMyClinics: vi.fn(),
        isLoading: false,
    }),
}))

vi.mock('../../services/bookingService', () => ({
    getBookingsByClinic: vi.fn(),
    getActiveSosAlerts: vi.fn(),
}))

vi.mock('../../services/paymentService', () => ({
    getClinicRevenueSummary: vi.fn(),
    getClinicPayments: vi.fn(),
}))

vi.mock('../../services/refundApplicationService', () => ({
    getClinicRefundApplications: vi.fn(),
}))

function todayYmd(): string {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

describe('ClinicManagerDashboardPage', () => {
    beforeEach(() => {
        vi.mocked(getClinicRevenueSummary).mockImplementation(async (_id, period) => ({
            success: true,
            clinicId: 'cm-1',
            clinicName: 'Managed',
            period: String(period),
            items:
                period === 'WEEK'
                    ? [{ label: 'Mon', total: 10000, periodStart: '' }]
                    : period === 'MONTH'
                      ? [{ label: 'M1', total: 200000, periodStart: '' }]
                      : [{ total: 50000, label: 'd', periodStart: '' }],
            message: '',
        }))
        vi.mocked(getClinicRefundApplications).mockResolvedValue({
            items: [{ status: 'PENDING' }],
        } as Awaited<ReturnType<typeof getClinicRefundApplications>>)
        vi.mocked(getClinicPayments).mockResolvedValue({
            payments: [{ paymentId: 'pp1', bookingCode: 'P', amount: 1, status: 'PENDING', createdAt: '' }],
        } as Awaited<ReturnType<typeof getClinicPayments>>)
        vi.mocked(getActiveSosAlerts).mockResolvedValue([])
        vi.mocked(getBookingsByClinic).mockResolvedValue({
            content: [
                {
                    bookingId: 'x1',
                    bookingCode: 'CM-001',
                    bookingDate: todayYmd(),
                    bookingTime: '14:30',
                    status: 'CONFIRMED',
                    ownerName: 'Guest B',
                    assignedStaffId: undefined,
                    paymentStatus: 'PENDING',
                },
            ],
        } as Awaited<ReturnType<typeof getBookingsByClinic>>)
    })

    it('renders manager dashboard title and clinic name', async () => {
        render(
            <MemoryRouter>
                <ClinicManagerDashboardPage />
            </MemoryRouter>
        )

        expect(screen.getByRole('heading', { level: 1, name: 'Clinic manager dashboard' })).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByText('Managed Clinic')).toBeInTheDocument()
        })
    })

    it('shows booking code in recent table', async () => {
        render(
            <MemoryRouter>
                <ClinicManagerDashboardPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText('CM-001')).toBeInTheDocument()
        })
    })

    it('renders chart placeholder', async () => {
        render(
            <MemoryRouter>
                <ClinicManagerDashboardPage />
            </MemoryRouter>
        )
        await waitFor(() => {
            expect(screen.getByTestId('manager-charts-mock')).toBeInTheDocument()
        })
    })
})
