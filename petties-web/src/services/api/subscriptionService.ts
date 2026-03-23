import { apiClient } from './client'

export type UserSubscriptionStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED'
export type PaymentMethod = 'CASH' | 'QR' | 'CARD'

export interface SubscriptionPlan {
    planId: string
    name: string
    description: string
    price: number
    durationDays: number
    features: string
    isActive: boolean
    totalPurchases: number
}

export interface CreateSubscriptionPlanDto {
    name: string
    description?: string
    price: number
    durationDays: number
    features?: string
}

export interface UserSubscription {
    subscriptionId: string
    clinicId: string
    clinicName: string
    plan: SubscriptionPlan
    status: UserSubscriptionStatus
    paymentMethod: PaymentMethod
    startDate?: string
    endDate?: string
    cancelAtPeriodEnd: boolean
    qrUrl?: string
    paymentDescription?: string
}

export interface SubscribeRequest {
    planId: string
    clinicId: string
    paymentMethod: PaymentMethod
}

export const subscriptionService = {
    getAllPlans: async (): Promise<SubscriptionPlan[]> => {
        const response = await apiClient.get('/subscriptions/plans')
        return response.data
    },

    getActivePlans: async (): Promise<SubscriptionPlan[]> => {
        const response = await apiClient.get('/subscriptions/plans/active')
        return response.data
    },

    getPlanById: async (planId: string): Promise<SubscriptionPlan> => {
        const response = await apiClient.get(`/subscriptions/plans/${planId}`)
        return response.data
    },

    createPlan: async (data: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> => {
        const response = await apiClient.post('/subscriptions/plans', data)
        return response.data
    },

    updatePlan: async (planId: string, data: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> => {
        const response = await apiClient.put(`/subscriptions/plans/${planId}`, data)
        return response.data
    },

    deactivatePlan: async (planId: string): Promise<void> => {
        await apiClient.patch(`/subscriptions/plans/${planId}/deactivate`)
    },

    // Clinic Owner Methods
    subscribe: async (data: SubscribeRequest): Promise<UserSubscription> => {
        const response = await apiClient.post('/subscriptions/subscribe', data)
        return response.data
    },

    getClinicSubscription: async (clinicId: string): Promise<UserSubscription> => {
        const response = await apiClient.get(`/subscriptions/my-clinic/${clinicId}`)
        return response.data
    },

    getClinicSubscriptionStatus: async (clinicId: string): Promise<{ active: UserSubscription | null, pending: UserSubscription | null }> => {
        const response = await apiClient.get(`/subscriptions/my-clinic/${clinicId}/status`)
        return response.data
    },

    getMySubscriptionStatus: async (): Promise<UserSubscription> => {
        const response = await apiClient.get('/subscriptions/my-status')
        return response.data
    },

    cancelClinicSubscription: async (clinicId: string): Promise<UserSubscription> => {
        const response = await apiClient.put(`/subscriptions/my-clinic/${clinicId}/cancel`)
        return response.data
    },

    cancelSubscription: async (subscriptionId: string): Promise<UserSubscription> => {
        const response = await apiClient.put(`/subscriptions/${subscriptionId}/cancel`)
        return response.data
    },

    getClinicSubscriptionHistory: async (clinicId: string): Promise<UserSubscription[]> => {
        const response = await apiClient.get(`/subscriptions/my-clinic/${clinicId}/history`)
        return response.data
    },

    checkPaymentStatus: async (subscriptionId: string): Promise<any> => {
        const response = await apiClient.get(`/payments/subscription/${subscriptionId}/status`)
        return response.data
    },

    // Admin Methods
    getAllUserSubscriptions: async (): Promise<UserSubscription[]> => {
        const response = await apiClient.get('/subscriptions/admin/all')
        return response.data
    },
}
