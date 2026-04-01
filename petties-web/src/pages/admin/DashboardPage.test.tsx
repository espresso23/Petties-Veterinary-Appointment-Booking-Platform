import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AdminDashboardPage } from './DashboardPage'
import { clinicService } from '../../services/api/clinicService'
import { getAllReportsForAdmin } from '../../services/reportService'
import { getPendingForAdmin } from '../../services/refundApplicationService'
import { getStruckPetOwners } from '../../services/api/userService'
import { subscriptionService } from '../../services/api/subscriptionService'

vi.mock('../../components/admin/AdminDashboardCharts', () => ({
    AdminDashboardCharts: () => <div data-testid="admin-charts-mock" />,
}))

vi.mock('../../config/env', () => ({
    env: {
        API_BASE_URL: 'http://localhost:8080',
        AGENT_API_BASE_URL: 'http://localhost:8000',
    },
}))

vi.mock('../../store/authStore', () => ({
    useAuthStore: () => ({ user: { username: 'admin_test' } }),
}))

vi.mock('../../services/api/clinicService', () => ({
    clinicService: {
        getPendingClinicsCount: vi.fn(),
        getStruckClinics: vi.fn(),
        getAllClinics: vi.fn(),
        getPendingClinics: vi.fn(),
    },
}))

vi.mock('../../services/reportService', () => ({
    getAllReportsForAdmin: vi.fn(),
}))

vi.mock('../../services/refundApplicationService', () => ({
    getPendingForAdmin: vi.fn(),
}))

vi.mock('../../services/api/userService', () => ({
    getStruckPetOwners: vi.fn(),
}))

vi.mock('../../services/api/subscriptionService', () => ({
    subscriptionService: {
        getAllUserSubscriptions: vi.fn(),
    },
}))

describe('AdminDashboardPage', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.includes('/health') && !url.includes('actuator')) {
                return {
                    ok: true,
                    json: async () => ({ service: 'agent', version: '1.0.0' }),
                } as Response
            }
            return {
                ok: true,
                json: async () => ({ status: 'UP' }),
            } as Response
        }) as typeof fetch

        vi.mocked(clinicService.getPendingClinicsCount).mockResolvedValue(2)
        vi.mocked(clinicService.getStruckClinics).mockResolvedValue({
            content: [],
            totalElements: 1,
            totalPages: 1,
            number: 0,
            size: 1,
            first: true,
            last: true,
        })
        vi.mocked(clinicService.getAllClinics).mockResolvedValue({
            content: [],
            totalElements: 10,
            totalPages: 1,
            number: 0,
            size: 1,
            first: true,
            last: true,
        })
        vi.mocked(clinicService.getPendingClinics).mockResolvedValue({
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: 0,
            size: 5,
            first: true,
            last: true,
        })

        vi.mocked(getAllReportsForAdmin).mockImplementation(async (status) => {
            if (status === 'PENDING') {
                return { totalElements: 5, content: [], totalPages: 0, number: 0, size: 1, first: true, last: true } as Awaited<
                    ReturnType<typeof getAllReportsForAdmin>
                >
            }
            if (status === 'APPROVED') {
                return { totalElements: 3, content: [], totalPages: 0, number: 0, size: 1, first: true, last: true } as Awaited<
                    ReturnType<typeof getAllReportsForAdmin>
                >
            }
            return { totalElements: 1, content: [], totalPages: 0, number: 0, size: 1, first: true, last: true } as Awaited<
                ReturnType<typeof getAllReportsForAdmin>
            >
        })

        vi.mocked(getPendingForAdmin).mockResolvedValue({ items: [{ id: 'a' }, { id: 'b' }] } as Awaited<ReturnType<typeof getPendingForAdmin>>)
        vi.mocked(getStruckPetOwners).mockResolvedValue({
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: 0,
            size: 1,
            first: true,
            last: true,
        })
        vi.mocked(subscriptionService.getAllUserSubscriptions).mockResolvedValue([
            { status: 'PENDING_PAYMENT' } as never,
            { status: 'ACTIVE' } as never,
        ])
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        vi.clearAllMocks()
    })

    it('renders English title and health status', async () => {
        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        )
        expect(screen.getByRole('heading', { level: 1, name: 'Admin dashboard' })).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getAllByText('Up').length).toBeGreaterThanOrEqual(1)
        })
    })

    it('shows platform KPIs after load', async () => {
        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
        })
        await waitFor(() => {
            expect(screen.getByText('10')).toBeInTheDocument()
        })
    })

    it('renders charts section', async () => {
        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        )
        await waitFor(() => {
            expect(screen.getByTestId('admin-charts-mock')).toBeInTheDocument()
        })
    })

    it('shows partial warning when some APIs fail', async () => {
        vi.mocked(clinicService.getPendingClinicsCount).mockRejectedValueOnce(new Error('network'))

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText(/Partial data/)).toBeInTheDocument()
        })
    })
})
