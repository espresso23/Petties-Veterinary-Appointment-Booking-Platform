package com.petties.petties.model;

import com.petties.petties.model.enums.SlotStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Entity representing a bookable time slot
 * 
 * Slots are auto-generated when a VetShift is created
 * Each slot is 30 minutes by default
 * 
 * Status:
 * - AVAILABLE: Can be booked
 * - BOOKED: Already has a booking
 * - BLOCKED: Manually blocked by vet/manager
 */
@Entity
@Table(name = "slots", indexes = {
        @Index(name = "idx_slot_shift", columnList = "shift_id"),
        @Index(name = "idx_slot_status", columnList = "status"),
        @Index(name = "idx_slot_time", columnList = "start_time, end_time")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Slot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "slot_id", updatable = false, nullable = false)
    private UUID slotId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id", nullable = false)
    private VetShift shift;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SlotStatus status = SlotStatus.AVAILABLE;

    // Reference to booking when status is BOOKED
    // Will be added when Booking entity is created
    // @ManyToOne(fetch = FetchType.LAZY)
    // @JoinColumn(name = "booking_id")
    // private Booking booking;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
