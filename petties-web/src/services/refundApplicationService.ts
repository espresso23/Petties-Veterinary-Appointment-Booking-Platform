/**
 * API đơn hoàn tiền (rút tiền sau khấu trừ 5% nền tảng)
 */
import apiClient from './api/client'

const REFUND_APPLICATIONS = '/refund-applications'

export interface AdminFilterParams {
    status?: string
    clinicId?: string
    page?: number
    size?: number
    sort?: string
    from?: string // Add missing 'from'
    to?: string   // Add missing 'to'
}

export interface RefundApplicationRequest {
    monthRevenue: number
    qrRevenue: number
    cashRevenue: number
    requestedAmount: number
    periodYearMonth?: string
    clinicId?: string
}

export interface RefundApplicationItem {
    refundApplicationId: string
    clinicId: string
    clinicName: string
    bankName?: string
    accountNumber?: string
    periodYearMonth: string
    monthRevenue: number
    qrRevenue?: number
    cashRevenue?: number
    requestedAmount?: number
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

export const getClinicRefundApplications = async (clinicId: string): Promise<MyClinicRefundApplicationsResponse> => {
    const { data } = await apiClient.get<MyClinicRefundApplicationsResponse>(`${REFUND_APPLICATIONS}/clinic/${clinicId}`)
    return data
}

export const getPendingForAdmin = async (params: AdminFilterParams = {}) => {
    const { data } = await apiClient.get(`${REFUND_APPLICATIONS}/admin/pending`, { params })
    return data
}

export const getAllForAdmin = async (params: AdminFilterParams = {}) => {
    const { data } = await apiClient.get(`${REFUND_APPLICATIONS}/admin/all`, { params })
    return data
}

export const updateRefundApplicationStatus = async (id: string, status: string, reason?: string) => {
    const { data } = await apiClient.put(`${REFUND_APPLICATIONS}/${id}/status`, { status, rejectionReason: reason })
    return data
}
