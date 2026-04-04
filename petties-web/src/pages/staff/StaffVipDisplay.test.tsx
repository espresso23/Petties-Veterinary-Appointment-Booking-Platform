import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StaffLayout } from '../../layouts/StaffLayout'
import { ClinicManagerLayout } from '../../layouts/ClinicManagerLayout'
import { MemoryRouter } from 'react-router-dom'

// --- Mocks ---

// Mock useMembershipStore
const mockMembership = {
    isVIP: vi.fn(),
    getPlanName: vi.fn(),
    getRemainingDays: vi.fn(),
    fetchMembershipStatus: vi.fn()
}
vi.mock('../../store/membershipStore', () => ({
    useMembershipStore: (fn: (state: typeof mockMembership) => void) => fn(mockMembership)
}))

// Mock useAuthStore 
const mockUser = {
    user: { fullName: 'Dr. Hoang Dat', role: 'STAFF', email: 'dat@test.com' },
    clearAuth: vi.fn()
}
vi.mock('../../store/authStore', () => ({
    useAuthStore: (fn: (state: typeof mockUser) => void) => fn(mockUser)
}))

// Mock other stores
vi.mock('../../store/notificationStore', () => ({
    useNotificationStore: (fn: (state: { unreadCount: number; refreshUnreadCount: () => Promise<void> }) => void) => fn({ unreadCount: 0, refreshUnreadCount: vi.fn() })
}))
vi.mock('../../store/bookingStore', () => ({
    useBookingStore: (fn: (state: { assignedBookingCount: number; refreshAssignedBookingCount: () => Promise<void>; pendingBookingCount: number; refreshPendingBookingCount: () => Promise<void>; incrementPendingBookingCount: () => void }) => void) => fn({
        assignedBookingCount: 0,
        refreshAssignedBookingCount: vi.fn(),
        pendingBookingCount: 0,
        refreshPendingBookingCount: vi.fn(),
        incrementPendingBookingCount: vi.fn()
    })
}))
vi.mock('../../store/chatStore', () => ({
    useChatStore: (fn: (state: { unreadCount: number; refreshUnreadCount: () => Promise<void>; incrementUnreadCount: () => void }) => void) => fn({ unreadCount: 0, refreshUnreadCount: vi.fn(), incrementUnreadCount: vi.fn() }),
    useChatStoreState: { getState: () => ({ activeConversationId: null }) }
}))
vi.mock('../../store/aiChatStore', () => ({
    useAIChatStore: (fn: (state: { sessionId: string | null; messages: unknown[]; setSessionId: (id: string) => void; setMessages: (msgs: unknown[]) => void; addMessage: (msg: unknown) => void; updateLastMessage: (msg: unknown) => void; setConnectionStatus: (status: string) => void }) => void) => {
        const state = {
            sessionId: null,
            messages: [],
            setSessionId: vi.fn(),
            setMessages: vi.fn(),
            addMessage: vi.fn(),
            updateLastMessage: vi.fn(),
            setConnectionStatus: vi.fn()
        };
        return typeof fn === 'function' ? fn(state) : state;
    }
}))

// Mock hooks
vi.mock('../../hooks/useSidebar', () => ({
    useSidebar: () => ({ state: 'expanded', toggleSidebar: vi.fn(), isMobile: false })
}))
vi.mock('../../hooks/useSseNotification', () => ({
    useSseNotification: vi.fn()
}))
vi.mock('../../hooks/useSyncProfile', () => ({
    useSyncProfile: vi.fn()
}))
vi.mock('../../hooks/useToast', () => ({
    useToast: () => ({ showToast: vi.fn() })
}))
vi.mock('../../components/Toast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('Staff VIP Display Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-FRONT-VIP-001: Should show VIP badge for VIP Staff', () => {
        mockMembership.isVIP.mockReturnValue(true)
        mockMembership.getPlanName.mockReturnValue('GÓI CHUYÊN NGHIỆP')

        render(
            <MemoryRouter>
                <StaffLayout />
            </MemoryRouter>
        )

        // VIP badge in Sidebar Header/Footer should exist
        const vipBadges = screen.getAllByText(/VIP/i)
        expect(vipBadges.length).toBeGreaterThan(0)
        expect(screen.getByText(/GÓI CHUYÊN NGHIỆP/i)).toBeInTheDocument()
    })

    it('TC-FRONT-VIP-002: Should NOT show VIP and LOCK AI for Non-VIP Staff', () => {
        mockMembership.isVIP.mockReturnValue(false)

        render(
            <MemoryRouter>
                <StaffLayout />
            </MemoryRouter>
        )

        // VIP badge should not exist
        expect(screen.queryByText(/VIP/i)).not.toBeInTheDocument()

        // AI Sidebar should be locked with subscription guard
        expect(screen.getByText(/Tính năng Trợ lý AI/i)).toBeInTheDocument()
        expect(screen.getByText(/Gói Hội Viên/i)).toBeInTheDocument()
    })

    it('TC-FRONT-VIP-003: Clinic Manager should NEVER see VIP badge', () => {
        mockMembership.isVIP.mockReturnValue(true) // System has VIP
        mockUser.user.role = 'CLINIC_MANAGER'

        render(
            <MemoryRouter>
                <ClinicManagerLayout />
            </MemoryRouter>
        )

        // VIP badge should not exist
        expect(screen.queryByText(/VIP/i)).not.toBeInTheDocument()
    })
})
