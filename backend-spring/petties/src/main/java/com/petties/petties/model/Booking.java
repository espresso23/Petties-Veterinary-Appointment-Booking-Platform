package com.petties.petties.model;

import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Booking entity - Lịch hẹn khám bệnh
 *
 * Relationships:
 * - ManyToOne: Pet, User (petOwner), Clinic, User (assignedStaff)
 * - OneToMany: BookingSlot (slots used), BookingService (services)
 * - OneToOne: Payment
 */
@Entity
@Table(name = "bookings")
@NamedEntityGraph(
        name = "Booking.withDetails",
        attributeNodes = {
                @NamedAttributeNode("pet"),
                @NamedAttributeNode("petOwner"),
                @NamedAttributeNode("clinic"),
                @NamedAttributeNode("assignedStaff"),
                @NamedAttributeNode(value = "bookingServices", subgraph = "bsItem")
        },
        subgraphs = @NamedSubgraph(
                name = "bsItem",
                type = BookingServiceItem.class,
                attributeNodes = {
                        @NamedAttributeNode("pet"),
                        @NamedAttributeNode("service"),
                        @NamedAttributeNode("assignedStaff")
                }
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(name = "booking_code", unique = true, nullable = false, length = 20)
    private String bookingCode;

    // ========== RELATIONSHIPS ==========

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pet_id", nullable = false)
    private Pet pet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pet_owner_id", nullable = false)
    private User petOwner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    /**
     * User who created this booking on behalf of petOwner (for proxy booking).
     * NULL if booking was created by pet owner themselves.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proxy_booker_id")
    private User proxyBooker;

    // ========== BOOKING INFO ==========

    @Column(name = "booking_date", nullable = false)
    private LocalDate bookingDate;

    @Column(name = "booking_time", nullable = false)
    private LocalTime bookingTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private BookingType type;

    // ========== HOME VISIT / SOS INFO ==========

    @Column(name = "home_address")
    private String homeAddress;

    @Column(name = "home_lat", precision = 10, scale = 7)
    private BigDecimal homeLat;

    @Column(name = "home_long", precision = 10, scale = 7)
    private BigDecimal homeLong;

    @Column(name = "distance_km", precision = 5, scale = 2)
    private BigDecimal distanceKm;

    @Column(name = "distance_fee", precision = 12, scale = 2)
    private BigDecimal distanceFee;

    // ========== PRICING ==========

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    // ========== STATUS ==========

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "cancellation_reason")
    private String cancellationReason;

    @Column(name = "cancelled_by")
    private UUID cancelledBy;

    // ========== NOTES ==========

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // ========== TIMESTAMPS ==========

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // ========== CHILD RELATIONSHIPS ==========

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BookingSlot> bookingSlots = new ArrayList<>();

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BookingServiceItem> bookingServices = new ArrayList<>();

    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL)
    private Payment payment;

    // ========== HELPER METHODS ==========

    /**
     * Generate booking code: BK-YYYYMMDD-XXXX
     */
    public static String generateBookingCode(LocalDate date, int sequence) {
        return String.format("BK-%s-%04d",
                date.toString().replace("-", ""),
                sequence);
    }

    /**
     * Check if booking can be cancelled
     */
    public boolean canBeCancelled() {
        return status == BookingStatus.PENDING ||
                status == BookingStatus.CONFIRMED;
    }

    /**
     * Check if booking is for home visit or SOS
     */
    public boolean isHomeService() {
        return type == BookingType.HOME_VISIT || type == BookingType.SOS;
    }
}
