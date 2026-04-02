export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

/** Legacy JSON shape; create/update reports use multipart in reportService. */
export interface ReportRequest {
  bookingId: string;
  reason: string;
  attachmentUrls?: string[];
}

export interface UpdateReportRequest {
  reason: string;
  attachmentUrls?: string[];
}

export interface ResolveReportRequest {
  status: ReportStatus;
  adminNote?: string;
}

export interface ReportResponse {
  id: string;
  
  // Booking Info
  bookingId: string;
  bookingCode: string;
  
  // Reporter Info
  reporterId: string;
  reporterName: string;
  reporterRole: string;
  reporterPhone?: string;
  
  // Reported User Info (if Pet Owner is reported)
  reportedUserId?: string;
  reportedUserName?: string;
  reportedUserRole?: string;
  reportedUserPhone?: string;

  // Reported Clinic Info (if Clinic is reported)
  reportedClinicId?: string;
  reportedClinicName?: string;
  reportedClinicPhone?: string;

  // Report details
  reason: string;
  attachmentUrls?: string[];
  status: ReportStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}
