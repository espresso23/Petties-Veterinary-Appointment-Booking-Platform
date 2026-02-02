package com.petties.petties.model;

import com.petties.petties.model.enums.NotificationType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity representing notifications for users
 *
 * Types:
 * - Clinic status (APPROVED, REJECTED, PENDING) - for Clinic Owners
 * - StaffShift notifications (STAFF_SHIFT_*) - for Staff
 */
@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notification_user", columnList = "user_id"),
        @Index(name = "idx_notification_type", columnList = "type"),
        @Index(name = "idx_notification_read", columnList = "read")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "notification_id", updatable = false, nullable = false)
    private UUID notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user; // User who receives the notification

    // For clinic-related notifications (APPROVED, REJECTED, PENDING)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id")
    @org.hibernate.annotations.SQLRestriction("deleted_at IS NULL")
    private Clinic clinic;

    // For StaffShift-related notifications
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id")
    private StaffShift shift;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private NotificationType type;

    // EMR ID reference (MongoDB ObjectId stored as String)
    // Cannot use @ManyToOne since EmrRecord is in MongoDB, not JPA
    @Column(name = "emr_id")
    private String emrId;

    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason; // Approval/rejection reason or additional info

    @Column(name = "read", nullable = false)
    @Builder.Default
    private Boolean read = false;

    @Column(name = "action_type")
    private String actionType; // e.g., "QUICK_BOOKING", "INFO_ONLY"

    @Column(name = "action_data", columnDefinition = "TEXT")
    private String actionData; // JSON payload for action

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
