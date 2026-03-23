import { create } from 'zustand'
import { subscriptionService, type UserSubscription } from '../services/api/subscriptionService'

interface MembershipState {
    membership: UserSubscription | null
    isLoading: boolean
    error: string | null

    // Actions
    fetchMembershipStatus: () => Promise<void>
    setMembership: (membership: UserSubscription | null) => void
    clearMembership: () => void

    // Helpers
    isVIP: () => boolean
    getPlanName: () => string
    getRemainingDays: () => number | null
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
    membership: null,
    isLoading: false,
    error: null,

    fetchMembershipStatus: async () => {
        set({ isLoading: true, error: null })
        try {
            const status = await subscriptionService.getMySubscriptionStatus()
            set({ membership: status, isLoading: false })
        } catch (err: any) {
            // If 404, it means no subscription, which is a valid state (None)
            if (err.response?.status === 404) {
                set({ membership: null, isLoading: false })
            } else {
                set({
                    error: err.response?.data?.message || 'Không thể lấy thông tin hội viên',
                    isLoading: false
                })
            }
        }
    },

    setMembership: (membership) => set({ membership }),

    clearMembership: () => set({ membership: null, error: null }),

    isVIP: () => {
        const membership = get().membership
        if (!membership) return false

        const isActive = membership.status === 'ACTIVE' || membership.status === 'CANCELLED'
        if (!isActive) return false

        // Expiration check
        if (membership.endDate) {
            const end = new Date(membership.endDate)
            const now = new Date()
            if (end < now) return false
        }

        return true
    },

    getPlanName: () => {
        const membership = get().membership
        if (!get().isVIP()) return 'GÓI MIỄN PHÍ'
        return membership?.plan.name.toUpperCase() || 'GÓI MIỄN PHÍ'
    },

    getRemainingDays: () => {
        const membership = get().membership
        if (!membership?.endDate) return null

        const end = new Date(membership.endDate)
        const now = new Date()
        const diffTime = end.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return diffDays > 0 ? diffDays : 0
    }
}))
