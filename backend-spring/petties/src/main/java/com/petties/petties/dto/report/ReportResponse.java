package com.petties.petties.dto.report;

import com.petties.petties.model.enums.ReportStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportResponse {
    private UUID id;

    // Booking info
    private UUID bookingId;
    private String bookingCode;
    
    // Reporter info
    private UUID reporterId;
    private String reporterName;
    private String reporterRole;
    private String reporterPhone;
    
    // Reported object Info
    // 1. If it's a Pet Owner reported, it'll show their info
    private UUID reportedUserId;
    private String reportedUserName;
    private String reportedUserRole;
    
    // 2. If it's a Clinic reported, it'll show Clinic info
    private UUID reportedClinicId;
    private String reportedClinicName;
    private String reportedClinicPhone;

    // Details
    private String reason;
    private ReportStatus status;
    private String adminNote;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
