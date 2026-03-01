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
 * Multi-pet: each item is for one pet and one service. Enables one booking
 * to contain multiple pets with different services. Slot/duration is calculated
 * from all items.
 *
 * Stores:
 * - Link to booking, service, and pet (pet nullable for backward compatibility)
 * - unit_price: Snapshot of price at booking time (service price may change later)
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

    /**
     * Pet this service is for. Enables multi-pet booking.
     * Nullable for backward compatibility with existing data (use booking.pet as fallback).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pet_id")
    private Pet pet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    private ClinicService service;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    // ========== PRICING BREAKDOWN FIELDS ==========
    /**
     * Base price of the service (before weight-based pricing)
     */
    @Column(name = "base_price", precision = 12, scale = 2)
    private BigDecimal basePrice;

    /**
     * Weight-based price (may differ from basePrice based on pet weight tier)
     */
    @Column(name = "weight_price", precision = 12, scale = 2)
    private BigDecimal weightPrice;

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    /**
     * Flag to indicate if this service was added after initial booking (Arising
     * Service)
     * If true, it may not have an assigned staff initially
     */
    @Column(name = "is_add_on")
    @Builder.Default
    private Boolean isAddOn = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * Assigned staff for this specific service
     * Different services in the same booking can have different staff members
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    // ========== HELPER METHODS ==========

    /**
     * Calculate subtotal for this service item
     */
    public BigDecimal getSubtotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
