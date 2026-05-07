import { create } from 'zustand'
import { subscriptionService, type UserSubscription } from '../services/api/subscriptionService'

const isDevMode = import.meta.env.VITE_APP_ENV === 'development' || import.meta.env.VITE_ENV === 'dev'
const forceVipEnv = import.meta.env.VITE_FORCE_VIP === 'true'
const shouldForceVip = isDevMode || forceVipEnv

interface MembershipState {
    membership: UserSubscription | null
    isLoading: boolean
    error: string | null

    // Actions
    fetchMembershipStatus: (clinicId?: string) => Promise<void>
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

    fetchMembershipStatus: async (clinicId?: string) => {
        // DEV MODE BYPASS: Always return VIP in dev mode or when VITE_FORCE_VIP=true
        if (shouldForceVip) {
            set({
                membership: {
                    subscriptionId: 'dev-subscription',
                    clinicId: clinicId || 'dev-clinic',
                    clinicName: 'Phòng Khám DEV',
                    status: 'ACTIVE',
                    paymentMethod: 'CASH',
                    plan: {
                        planId: 'dev-plan',
                        name: 'GÓI VIP',
                        price: 0,
                        description: 'Gói dành cho development',
                        durationDays: 365,
                        features: 'Tất cả tính năng',
                        isActive: true,
                        totalPurchases: 0
                    },
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    cancelAtPeriodEnd: false
                },
                isLoading: false
            })
            return
        }

        set({ isLoading: true, error: null })
        try {
            if (clinicId) {
                // Use the safer status endpoint for clinic-specific checks to avoid 404s
                const status = await subscriptionService.getClinicSubscriptionStatus(clinicId)
                // Prioritize active, then pending
                set({ membership: status.active || status.pending, isLoading: false })
            } else {
                const status = await subscriptionService.getMySubscriptionStatus()
                set({ membership: status, isLoading: false })
            }
        } catch (err: unknown) {
            // If 404, it means no subscription, which is a valid state (None)
            if (err && typeof err === 'object' && 'response' in err) {
                const error = err as { response?: { status?: number; data?: { message?: string } } }
                if (error.response?.status === 404) {
                    set({ membership: null, isLoading: false })
                } else {
                    set({
                        error: error.response?.data?.message || 'Không thể lấy thông tin hội viên',
                        isLoading: false
                    })
                }
            } else {
                set({ error: 'Không thể lấy thông tin hội viên', isLoading: false })
            }
        }
    },

    setMembership: (membership) => set({ membership }),

    clearMembership: () => set({ membership: null, error: null }),

    isVIP: () => {
        // DEV MODE / FORCE VIP: Always return true
        if (shouldForceVip) return true

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
        // DEV MODE / FORCE VIP: Return DEV plan
        if (shouldForceVip) return 'GÓI VIP'

        const membership = get().membership
        if (!get().isVIP()) return 'GÓI MIỄN PHÍ'
        const planName = membership?.plan?.name?.trim()
        return planName ? planName.toUpperCase() : 'GÓI MIỄN PHÍ'
    },

    getRemainingDays: () => {
        // DEV MODE: Return large number
        if (isDevMode) return 365

        const membership = get().membership
        if (!membership?.endDate) return null

        const end = new Date(membership.endDate)
        const now = new Date()
        const diffTime = end.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return diffDays > 0 ? diffDays : 0
    }
}))
