package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entity representing a Vet's work shift
 * 
 * One VetShift = one work period for a vet on a specific date
 * System auto-generates 30-minute Slots when a shift is created
 * 
 * Business Rules:
 * - A vet can have MULTIPLE shifts per day (no time overlap allowed)
 * - Shift must be within clinic's operating hours
 * - Break time is optional (slots won't be created during break)
 * - Overnight shifts (isOvernight=true): endTime is on the following day
 */
@Entity
@Table(name = "vet_shifts", indexes = {
        @Index(name = "idx_shift_vet_date", columnList = "vet_id, work_date"),
        @Index(name = "idx_shift_clinic_date", columnList = "clinic_id, work_date")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter // Dùng cái này thay vì @Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VetShift {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "shift_id", updatable = false, nullable = false)
    private UUID shiftId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vet_id", nullable = false)
    private User vet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    // Optional break time
    @Column(name = "break_start")
    private LocalTime breakStart;

    @Column(name = "break_end")
    private LocalTime breakEnd;

    // Overnight shift flag - if true, endTime is on the following day
    // Example: startTime=22:00, endTime=06:00, isOvernight=true means 22:00 ->
    // 06:00 next day
    @Column(name = "is_overnight", nullable = false)
    @Builder.Default
    private Boolean isOvernight = false;

    // Notes for this shift
    @Column(name = "notes", length = 500)
    private String notes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // One shift has many slots
    @OneToMany(mappedBy = "shift", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Slot> slots = new ArrayList<>();
}
