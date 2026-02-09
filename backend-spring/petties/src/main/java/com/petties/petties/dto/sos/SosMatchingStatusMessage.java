package com.petties.petties.dto.sos;

import com.petties.petties.model.enums.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * WebSocket message for SOS Auto-Match status updates
 * Pushed to /topic/sos-matching/{bookingId}
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SosMatchingStatusMessage {

    public enum MatchingEvent {
        SEARCHING, // Đang tìm phòng khám
        CLINIC_NOTIFIED, // Đã gửi thông báo cho phòng khám
        WAITING_NEXT, // Phòng khám hiện tại không phản hồi, chờ phòng khám tiếp
        CONFIRMED, // Phòng khám đã xác nhận
        DECLINED, // Phòng khám từ chối
        NO_CLINIC, // Không tìm thấy phòng khám nào
        CANCELLED, // Đã hủy
        STAFF_ASSIGNED // Staff đã được gán
    }

    private UUID bookingId;

    private BookingStatus bookingStatus;

    private MatchingEvent event;

    private String message;

    // Current clinic being notified (for transparency)
    private Integer currentClinicIndex;
    private Integer totalClinicsInRange;

    // Clinic info (when matched)
    private UUID clinicId;
    private String clinicName;
    private String clinicPhone;
    private Double distanceKm;
    private Integer estimatedMinutes;

    /**
     * Alias for distanceKm for mobile compatibility
     * Mobile reads 'distance', backend uses 'distanceKm'
     */
    public Double getDistance() {
        return distanceKm;
    }

    // Staff info (when assigned)
    private UUID staffId;
    private String staffName;
    private String staffPhone;

    // For NO_CLINIC scenario
    private String hotlineNumber;

    // Countdown info
    private Long remainingSeconds;
}
