/**
 * Report API Service
 */
import axios from './api/client';
import type { ResolveReportRequest, ReportResponse, ReportStatus } from '../types/report';

// Spring Page response type
interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

const REPORT_API = '/reports';
const ADMIN_REPORT_API = '/admin/reports';

/**
 * Tạo báo cáo (multipart): BE upload ảnh lên Cloudinary.
 */
export const createReport = async (
    bookingId: string,
    reason: string,
    imageFiles: File[]
): Promise<ReportResponse> => {
    const formData = new FormData();
    formData.append('bookingId', bookingId);
    formData.append('reason', reason);
    for (const file of imageFiles) {
        formData.append('files', file);
    }
    const response = await axios.post<ReportResponse>(REPORT_API, formData);
    return response.data;
};

/**
 * Get current user's reports
 */
export const getMyReports = async (
    page: number = 0,
    size: number = 20
): Promise<PageResponse<ReportResponse>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());

    const response = await axios.get(`${REPORT_API}/my?${params.toString()}`);
    return response.data;
};

/**
 * Get reports by clinic ID (Admin, Clinic Owner, Clinic Manager)
 */
export const getClinicReports = async (
    clinicId: string,
    page: number = 0,
    size: number = 20
): Promise<PageResponse<ReportResponse>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());

    const response = await axios.get(`${REPORT_API}/clinics/${clinicId}?${params.toString()}`);
    return response.data;
};

/**
 * Get all reports (Admin only)
 */
export const getAllReportsForAdmin = async (
    status?: ReportStatus,
    page: number = 0,
    size: number = 20
): Promise<PageResponse<ReportResponse>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());
    if (status) params.append('status', status);

    const response = await axios.get(`${ADMIN_REPORT_API}?${params.toString()}`);
    return response.data;
};

/**
 * Resolve report (Admin only)
 */
export const resolveReport = async (
    reportId: string,
    request: ResolveReportRequest
): Promise<ReportResponse> => {
    const response = await axios.put(`${ADMIN_REPORT_API}/${reportId}/resolve`, request);
    return response.data;
};

/**
 * Cập nhật báo cáo PENDING (multipart): ảnh giữ lại trong `existingAttachmentUrlsJson`, file mới trong `files`.
 * Dùng POST .../update (PUT + multipart thường bị client/proxy làm mất body).
 */
export const updateReport = async (
    reportId: string,
    reason: string,
    newImageFiles: File[],
    keptAttachmentUrls: string[]
): Promise<ReportResponse> => {
    const formData = new FormData();
    formData.append('reason', reason);
    formData.append('existingAttachmentUrlsJson', JSON.stringify(keptAttachmentUrls));
    for (const file of newImageFiles) {
        formData.append('files', file);
    }
    const response = await axios.post<ReportResponse>(`${REPORT_API}/${reportId}/update`, formData);
    return response.data;
};

/** Withdraw own pending report (sets status WITHDRAWN) */
export const withdrawReport = async (reportId: string): Promise<ReportResponse> => {
    const response = await axios.delete(`${REPORT_API}/${reportId}`);
    return response.data;
};

// Named export for backwards compatibility
export const reportService = {
    createReport,
    updateReport,
    withdrawReport,
    getMyReports,
    getClinicReports,
    getAllReportsForAdmin,
    resolveReport,
};
