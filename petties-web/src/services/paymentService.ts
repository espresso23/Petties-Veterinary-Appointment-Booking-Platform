/**
 * Payment API Service
 * Handles payment-related operations for the clinic manager checkout flow
 */
import axios from './api/client';

const PAYMENT_API = '/payments';

/**
 * Check QR payment status via SePay matching
 * Returns: { status: 'PENDING' | 'PAID', message: string, matchedTransactionId?: string }
 */
export const checkQrPaymentStatus = async (
    bookingId: string
): Promise<{ status: string; message: string; matchedTransactionId?: string }> => {
    const response = await axios.get(`${PAYMENT_API}/${bookingId}/status`);
    return response.data;
};

// ========== CLINIC PAYMENT HISTORY ==========

export interface ClinicPaymentItem {
    paymentId: string;
    amount: number;
    method: string;
    status: string;
    paymentDescription?: string;
    createdAt: string;
    paidAt?: string;
    bookingId: string;
    bookingCode: string;
    bookingStatus?: string;
    petOwnerId?: string;
    petOwnerName?: string;
    clinicId?: string;
    clinicName?: string;
}

export interface MyClinicPaymentsResponse {
    success: boolean;
    clinicId: string;
    clinicName: string;
    count: number;
    payments: ClinicPaymentItem[];
    message: string;
}

/**
 * Get payment history for current user's clinic (Manager/Owner).
 * Supports filter by payment status and booking status.
 */
export const getMyClinicPayments = async (
    limit: number = 100,
    status?: string,
    bookingStatus?: string[]
): Promise<MyClinicPaymentsResponse> => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (status) params.set('status', status);
    if (bookingStatus?.length) bookingStatus.forEach(s => params.append('bookingStatus', s));
    const response = await axios.get(`${PAYMENT_API}/history/my-clinic?${params.toString()}`);
    return response.data;
};

/**
 * Get payment history for a specific clinic (with permission check).
 */
export const getClinicPayments = async (
    clinicId: string,
    limit: number = 100,
    status?: string,
    bookingStatus?: string[]
): Promise<MyClinicPaymentsResponse> => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (status) params.set('status', status);
    if (bookingStatus?.length) bookingStatus.forEach(s => params.append('bookingStatus', s));
    const response = await axios.get(`${PAYMENT_API}/history/clinic/${clinicId}?${params.toString()}`);
    return response.data;
};

// ========== REVENUE SUMMARY ==========

export interface RevenueSummaryItem {
    label: string;
    total: number;
    periodStart: string;
}

export interface ClinicRevenueSummaryResponse {
    success: boolean;
    clinicId: string;
    clinicName: string;
    period: string;
    items: RevenueSummaryItem[];
    message: string;
}

/**
 * Get revenue summary for clinic by period: DAY | WEEK | MONTH | YEAR
 */
export const getClinicRevenueSummary = async (
    clinicId: string,
    period: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' = 'MONTH'
): Promise<ClinicRevenueSummaryResponse> => {
    const response = await axios.get(
        `${PAYMENT_API}/history/clinic/${clinicId}/revenue?period=${period}`
    );
    return response.data;
};
