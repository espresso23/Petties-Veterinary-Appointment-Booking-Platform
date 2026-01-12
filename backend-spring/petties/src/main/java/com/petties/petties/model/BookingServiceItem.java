package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * BookingServiceItem - Junction table for Booking ↔ Service (M:N)
 * 
 * Stores:
 * - Link to booking and service
 * - unit_price: Snapshot of price at booking time (service price may change
 * later)
 * - quantity: Number of times this service is used (usually 1)
 */
@Entity
@Table(name = "booking_services")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingServiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "booking_service_id")
    private UUID bookingServiceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    private ClinicService service;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // ========== HELPER METHODS ==========

    /**
     * Calculate subtotal for this service item
     */
    public BigDecimal getSubtotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
