/**
 * Report API Service
 */
import axios from './api/client';
import type { 
  ReportRequest, 
  ResolveReportRequest, 
  ReportResponse, 
  ReportStatus 
} from '../types/report';

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
 * Pet Owner, Vet, Clinic Manager, or Clinic Owner create a report
 */
export const createReport = async (request: ReportRequest): Promise<ReportResponse> => {
    const response = await axios.post(REPORT_API, request);
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

// Named export for backwards compatibility
export const reportService = {
    createReport,
    getMyReports,
    getClinicReports,
    getAllReportsForAdmin,
    resolveReport
};
