package com.petties.petties.model;

import com.petties.petties.model.enums.ClinicSuspendRequestStatus;
import com.petties.petties.model.enums.ClinicSuspendRequestType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "clinic_suspend_requests", indexes = {
        @Index(name = "idx_clinic_suspend_requests_clinic", columnList = "clinic_id"),
        @Index(name = "idx_clinic_suspend_requests_status", columnList = "status"),
        @Index(name = "idx_clinic_suspend_requests_created", columnList = "created_at")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicSuspendRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "clinic_suspend_request_id", updatable = false, nullable = false)
    private UUID clinicSuspendRequestId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private User requestedBy;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ClinicSuspendRequestStatus status = ClinicSuspendRequestStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 20)
    @Builder.Default
    private ClinicSuspendRequestType requestType = ClinicSuspendRequestType.SUSPEND;

    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}