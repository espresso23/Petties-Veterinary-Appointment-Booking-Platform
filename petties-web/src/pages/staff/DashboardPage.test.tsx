import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { StaffDashboardPage } from './DashboardPage'
import { getStaffHomeSummary, getBookingsByStaff } from '../../services/bookingService'
import { notificationService } from '../../services/api/notificationService'
import { chatService } from '../../services/api/chatService'

vi.mock('../../components/clinic/StaffWorkloadDonut', () => ({
    StaffWorkloadDonut: () => <div data-testid="workload-donut-mock" />,
}))

vi.mock('../../store/authStore', () => ({
    useAuthStore: () => ({
        user: { fullName: 'Staff test', workingClinicName: 'Work clinic', userId: 'staff-user-1' },
    }),
}))

vi.mock('../../services/bookingService', () => ({
    getStaffHomeSummary: vi.fn(),
    getBookingsByStaff: vi.fn(),
}))

vi.mock('../../services/api/notificationService', () => ({
    notificationService: {
        getUnreadCount: vi.fn(),
    },
}))

vi.mock('../../services/api/chatService', () => ({
    chatService: {
        getUnreadCount: vi.fn(),
    },
}))

describe('StaffDashboardPage', () => {
    beforeEach(() => {
        vi.mocked(getStaffHomeSummary).mockResolvedValue({
            todayBookingsCount: 4,
            pendingCount: 2,
            inProgressCount: 1,
            upcomingBookings: [
                {
                    bookingId: 'u1',
                    bookingCode: 'ST-99',
                    petName: 'Miu',
                    ownerName: 'Owner Miu',
                    bookingDate: '2026-04-02',
                    bookingTime: '09:00:00',
                    status: 'CONFIRMED',
                    primaryServiceName: 'Check-up',
                },
            ],
        })
        vi.mocked(notificationService.getUnreadCount).mockResolvedValue(2)
        vi.mocked(chatService.getUnreadCount).mockResolvedValue({
            totalUnreadMessages: 1,
            totalUnreadConversations: 0,
        })
        vi.mocked(getBookingsByStaff).mockResolvedValue({
            content: [
                {
                    bookingId: 'sb1',
                    bookingCode: 'SB-1',
                    bookingDate: '2026-04-03',
                    bookingTime: '10:00',
                    status: 'CONFIRMED',
                    ownerName: 'O',
                },
            ],
        } as Awaited<ReturnType<typeof getBookingsByStaff>>)
    })

    it('renders title, stats, and upcoming after API resolves', async () => {
        render(
            <MemoryRouter>
                <StaffDashboardPage />
            </MemoryRouter>
        )
        expect(screen.getByRole('heading', { level: 1, name: 'Staff dashboard' })).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByText('4')).toBeInTheDocument()
        })
        expect(screen.getByText('ST-99')).toBeInTheDocument()
    })

    it('shows English error when home summary fails', async () => {
        vi.mocked(getStaffHomeSummary).mockRejectedValueOnce(new Error('fail'))

        render(
            <MemoryRouter>
                <StaffDashboardPage />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText(/Could not load overview/)).toBeInTheDocument()
        })
    })

    it('renders workload donut placeholder', async () => {
        render(
            <MemoryRouter>
                <StaffDashboardPage />
            </MemoryRouter>
        )
        await waitFor(() => {
            expect(screen.getByTestId('workload-donut-mock')).toBeInTheDocument()
        })
    })
})
