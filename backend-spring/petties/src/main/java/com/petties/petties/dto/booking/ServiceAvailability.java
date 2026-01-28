package com.petties.petties.dto.booking;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO for service availability check result
 * Shows whether a specific service in a booking has an available vet
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceAvailability {

    /**
     * BookingServiceItem ID (junction table PK)
     */
    private UUID bookingServiceId;

    /**
     * Service name (e.g., "Khám da liễu", "Cạo vôi răng")
     */
    private String serviceName;

    /**
     * Service category enum name (e.g., "DENTAL", "DERMATOLOGY")
     */
    private String serviceCategory;

    /**
     * Required specialty enum name (e.g., "VET_DENTAL", "VET_DERMATOLOGY")
     */
    private String requiredSpecialty;

    /**
     * Required specialty Vietnamese label (e.g., "Bác sĩ nha khoa thú y")
     */
    private String requiredSpecialtyLabel;

    /**
     * Service price
     */
    private BigDecimal price;

    /**
     * Whether there's an available vet with the required specialty
     */
    private boolean hasAvailableVet;

    /**
     * Suggested vet ID if available
     */
    private UUID suggestedVetId;

    /**
     * Suggested vet name if available
     */
    private String suggestedVetName;

    /**
     * Suggested vet avatar URL if available
     */
    private String suggestedVetAvatarUrl;

    /**
     * Suggested vet specialty enum name (e.g., "VET_GENERAL", "VET_DENTAL")
     */
    private String suggestedVetSpecialty;

    /**
     * Reason why no vet is available (e.g., "Không có bác sĩ nha khoa có ca làm việc vào ngày này")
     */
    private String unavailableReason;
}
