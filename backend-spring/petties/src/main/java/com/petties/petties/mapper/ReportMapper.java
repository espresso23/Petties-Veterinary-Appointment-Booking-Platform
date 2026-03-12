package com.petties.petties.mapper;

import com.petties.petties.dto.report.ReportResponse;
import com.petties.petties.model.Report;
import org.springframework.stereotype.Component;

@Component
public class ReportMapper {

    public ReportResponse mapToResponse(Report report) {
        if (report == null) {
            return null;
        }

        ReportResponse.ReportResponseBuilder builder = ReportResponse.builder()
                .id(report.getId())
                .bookingId(report.getBooking().getBookingId())
                .bookingCode(report.getBooking().getBookingCode())
                
                .reporterId(report.getReporter().getUserId())
                .reporterName(report.getReporter().getFullName())
                .reporterRole(report.getReporter().getRole().name())
                .reporterPhone(report.getReporter().getPhone())
                
                .reason(report.getReason())
                .status(report.getStatus())
                .adminNote(report.getAdminNote())
                .createdAt(report.getCreatedAt())
                .updatedAt(report.getUpdatedAt());

        if (report.getReportedClinic() != null) {
            builder.reportedClinicId(report.getReportedClinic().getClinicId())
                   .reportedClinicName(report.getReportedClinic().getName())
                   .reportedClinicPhone(report.getReportedClinic().getPhone());
        }

        if (report.getReportedUser() != null) {
            var u = report.getReportedUser();
            String displayName = u.getFullName() != null && !u.getFullName().isBlank()
                    ? u.getFullName() : u.getUsername();
            builder.reportedUserId(u.getUserId())
                   .reportedUserName(displayName)
                   .reportedUserRole(u.getRole().name());
        }

        return builder.build();
    }
}
