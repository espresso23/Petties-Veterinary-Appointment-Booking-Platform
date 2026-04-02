package com.petties.petties.mapper;

import com.petties.petties.dto.report.ReportResponse;
import com.petties.petties.model.Report;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class ReportMapper {

    public ReportResponse mapToResponse(Report report) {
        if (report == null) {
            return null;
        }

        var reporter = report.getReporter();
        String reporterDisplayName = reporter.getFullName() != null && !reporter.getFullName().isBlank()
                ? reporter.getFullName().trim()
                : reporter.getUsername();

        ReportResponse.ReportResponseBuilder builder = ReportResponse.builder()
                .id(report.getId())
                .bookingId(report.getBooking().getBookingId())
                .bookingCode(report.getBooking().getBookingCode())
                
                .reporterId(reporter.getUserId())
                .reporterName(reporterDisplayName)
                .reporterRole(reporter.getRole().name())
                .reporterPhone(reporter.getPhone())
                
                .reason(report.getReason())
                .attachmentUrls(attachmentList(report.getAttachmentUrls()))
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
                    ? u.getFullName().trim() : u.getUsername();
            builder.reportedUserId(u.getUserId())
                   .reportedUserName(displayName)
                   .reportedUserRole(u.getRole().name())
                   .reportedUserPhone(u.getPhone());
        }

        return builder.build();
    }

    private static List<String> attachmentList(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return Collections.emptyList();
        }
        return List.copyOf(urls);
    }
}
