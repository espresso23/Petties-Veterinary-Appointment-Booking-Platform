package com.petties.petties.dto.notification;

import com.petties.petties.model.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * DTO for notification response
 *
 * Supports both clinic notifications and StaffShift notifications
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponse {

    private UUID notificationId;
    private NotificationType type;
    private String message;
    private String reason;
    private Boolean read;
    private LocalDateTime createdAt;

    // Clinic-related fields (for APPROVED, REJECTED, PENDING types)
    private UUID clinicId;
    private String clinicName;

    // StaffShift-related fields (for STAFF_SHIFT_* types)
    private UUID shiftId;
    private LocalDate shiftDate;
    private LocalTime shiftStartTime;
    private LocalTime shiftEndTime;
}

