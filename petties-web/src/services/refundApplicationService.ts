/**
 * API đơn hoàn tiền (rút tiền sau khấu trừ 5% nền tảng)
 */
import apiClient from './api/client'

const REFUND_APPLICATIONS = '/refund-applications'

export interface RefundApplicationRequest {
    monthRevenue: number
    periodYearMonth?: string
}

export interface RefundApplicationItem {
    refundApplicationId: string
    clinicId: string
    clinicName: string
    periodYearMonth: string
    monthRevenue: number
    webDeductionPercent: number
    webDeductionAmount: number
    amountAfterDeduction: number
    status: string
    rejectionReason?: string
    reviewedAt?: string
    createdAt: string
}

export interface CreateRefundApplicationResponse {
    success: boolean
    message: string
    data: RefundApplicationItem
}

export interface MyClinicRefundApplicationsResponse {
    success: boolean
    items: RefundApplicationItem[]
    message: string
}

export const createRefundApplication = async (
    body: RefundApplicationRequest
): Promise<CreateRefundApplicationResponse> => {
    const { data } = await apiClient.post<CreateRefundApplicationResponse>(REFUND_APPLICATIONS, body)
    return data
}

export const getMyClinicRefundApplications = async (): Promise<MyClinicRefundApplicationsResponse> => {
    const { data } = await apiClient.get<MyClinicRefundApplicationsResponse>(`${REFUND_APPLICATIONS}/my-clinic`)
    return data
}
