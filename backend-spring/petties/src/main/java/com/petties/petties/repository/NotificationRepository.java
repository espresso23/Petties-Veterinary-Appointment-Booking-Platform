package com.petties.petties.repository;

import com.petties.petties.model.Notification;
import com.petties.petties.model.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Find all notifications for a user (including VetShift notifications without clinic)
     * Load notifications for non-deleted clinics OR notifications without clinic
     */
    @Query("SELECT n FROM Notification n LEFT JOIN n.clinic c WHERE n.user.userId = :userId AND (c IS NULL OR c.deletedAt IS NULL) ORDER BY n.createdAt DESC")
    Page<Notification> findByUserUserIdOrderByCreatedAtDesc(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Count unread notifications for a user
     */
    long countByUserUserIdAndReadFalse(UUID userId);

    /**
     * Mark all notifications as read for a user
     */
    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.user.userId = :userId AND n.read = false")
    int markAllAsReadByUserId(@Param("userId") UUID userId);

    /**
     * Mark a specific notification as read
     */
    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.notificationId = :notificationId")
    int markAsRead(@Param("notificationId") UUID notificationId);

    /**
     * Check if notification exists for clinic and type
     * Used to prevent duplicate notifications - simple check without time window
     */
    @Query("SELECT COUNT(n) > 0 FROM Notification n WHERE n.clinic.clinicId = :clinicId AND n.type = :type")
    boolean existsByClinicClinicIdAndType(@Param("clinicId") UUID clinicId, @Param("type") NotificationType type);

    /**
     * Check if notification exists for user + clinic + type
     * Used to prevent duplicate admin notifications for same clinic
     */
    @Query("SELECT COUNT(n) > 0 FROM Notification n WHERE n.user.userId = :userId AND n.clinic.clinicId = :clinicId AND n.type = :type")
    boolean existsByUserUserIdAndClinicClinicIdAndType(
            @Param("userId") UUID userId,
            @Param("clinicId") UUID clinicId,
            @Param("type") NotificationType type);
}

