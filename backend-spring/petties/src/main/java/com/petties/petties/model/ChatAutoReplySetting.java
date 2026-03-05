package com.petties.petties.model;

import com.petties.petties.model.enums.AutoReplyCondition;
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

/**
 * Entity storing chat auto-reply configuration per clinic.
 *
 * Design:
 * - One row per clinic
 * - Supports quick reply (welcome) and away message (off-hours)
 */
@Entity
@Table(name = "chat_auto_reply_settings")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatAutoReplySetting {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "setting_id", updatable = false, nullable = false)
    private UUID settingId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @Column(name = "quick_reply_enabled", nullable = false)
    @Builder.Default
    private boolean quickReplyEnabled = true;

    @Column(name = "quick_reply_message", columnDefinition = "TEXT")
    private String quickReplyMessage;

    @Column(name = "away_message_enabled", nullable = false)
    @Builder.Default
    private boolean awayMessageEnabled = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "away_condition", nullable = false, length = 50)
    @Builder.Default
    private AutoReplyCondition awayCondition = AutoReplyCondition.OFF_HOURS;

    @Column(name = "away_message", columnDefinition = "TEXT")
    private String awayMessage;

    @Column(name = "action_buttons", columnDefinition = "TEXT")
    private String actionButtonsJson;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
