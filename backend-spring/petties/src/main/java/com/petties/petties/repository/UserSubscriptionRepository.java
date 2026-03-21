package com.petties.petties.repository;

import com.petties.petties.model.UserSubscription;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSubscriptionRepository extends JpaRepository<UserSubscription, UUID> {

        Optional<UserSubscription> findFirstByClinicClinicIdAndStatusOrderByCreatedAtDesc(UUID clinicId,
                        UserSubscriptionStatus status);

        @Query("SELECT s FROM UserSubscription s WHERE s.clinic.clinicId = :clinicId AND s.status = 'ACTIVE' ORDER BY s.createdAt DESC LIMIT 1")
        Optional<UserSubscription> findActiveSubscriptionByClinicId(@Param("clinicId") UUID clinicId);

        Optional<UserSubscription> findFirstByClinicClinicIdAndStatusNotOrderByCreatedAtDesc(UUID clinicId,
                        UserSubscriptionStatus status);

        Optional<UserSubscription> findFirstByClinicClinicIdOrderByCreatedAtDesc(UUID clinicId);

        java.util.List<UserSubscription> findAllByOrderByCreatedAtDesc();

        java.util.List<UserSubscription> findByClinicClinicIdOrderByCreatedAtDesc(UUID clinicId);

        long countByPlanPlanId(UUID planId);

        java.util.List<UserSubscription> findByStatusAndEndDateBetween(UserSubscriptionStatus status,
                        java.time.LocalDateTime start, java.time.LocalDateTime end);
}
