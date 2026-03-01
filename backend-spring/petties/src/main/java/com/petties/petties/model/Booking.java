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

    @Version
    @Column(name = "version")
    private Long version;

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
    @JoinColumn(name = "clinic_id") // nullable for SOS bookings during SEARCHING status
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

    @Column(name = "sos_fee", precision = 12, scale = 2)
    private BigDecimal sosFee;

    // ========== PRICING ==========

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    // ========== STATUS ==========

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "cancellation_reason")
    private String cancellationReason;

    @Column(name = "cancelled_by")
    private UUID cancelledBy;

    // ========== NOTES ==========

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // ========== SOS-SPECIFIC FIELDS ==========

    @Column(name = "symptoms", columnDefinition = "TEXT")
    private String symptoms;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "arrived_at")
    private LocalDateTime arrivedAt;

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

    @OneToOne(mappedBy = "booking")
    private Review review;

    // ========== HELPER METHODS ==========

    /**
     * Generate booking code: BK-YYYYMMDD-XXXX (sequence-based, for backward compat)
     */
    public static String generateBookingCode(LocalDate date, int sequence) {
        return String.format("BK-%s-%04d",
                date.toString().replace("-", ""),
                sequence);
    }

    /**
     * Generate unique booking code using UUID to avoid race condition.
     * Format: BK-YYYYMMDD-XXXXXXXX (8 hex chars from UUID)
     */
    public static String generateUniqueBookingCode(LocalDate date) {
        String uuid8 = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return String.format("BK-%s-%s", date.toString().replace("-", ""), uuid8);
    }

    /**
     * Check if booking can be cancelled
     */
    public boolean canBeCancelled() {
        if (status == BookingStatus.PENDING ||
                status == BookingStatus.CONFIRMED ||
                status == BookingStatus.SEARCHING ||
                status == BookingStatus.PENDING_CLINIC_CONFIRM) {
            return true;
        }

        // Cho phép hủy khi đang di chuyển (IN_PROGRESS)
        // - SOS: luôn cho hủy ở trạng thái IN_PROGRESS (kể cả bác sĩ đã đến nơi)
        // - HOME_VISIT: chỉ cho hủy trước khi bác sĩ báo đã đến (arrivedAt == null)
        if (status == BookingStatus.IN_PROGRESS) {
            if (type == BookingType.SOS) {
                return true;
            }
            if (type == BookingType.HOME_VISIT && arrivedAt == null) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if booking is for home visit or SOS
     */
    public boolean isHomeService() {
        return type == BookingType.HOME_VISIT || type == BookingType.SOS;
    }
}
