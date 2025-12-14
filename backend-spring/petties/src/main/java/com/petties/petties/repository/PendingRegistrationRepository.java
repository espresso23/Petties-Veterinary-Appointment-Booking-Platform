package com.petties.petties.repository;

import com.petties.petties.model.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, UUID> {

    /**
     * Find pending registration by email
     */
    Optional<PendingRegistration> findByEmail(String email);

    /**
     * Find pending registration by email and OTP code
     */
    Optional<PendingRegistration> findByEmailAndOtpCode(String email, String otpCode);

    /**
     * Check if email exists in pending registrations
     */
    boolean existsByEmail(String email);

    /**
     * Check if username exists in pending registrations
     */
    boolean existsByUsername(String username);

    /**
     * Delete pending registration by email
     */
    @Modifying
    @Transactional
    void deleteByEmail(String email);

    /**
     * Cleanup expired pending registrations
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM PendingRegistration p WHERE p.otpExpiresAt < :now")
    int deleteAllExpired(LocalDateTime now);

    /**
     * Increment attempts counter for a pending registration
     * Uses REQUIRES_NEW to commit immediately, independent of parent transaction
     */
    @Modifying
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @Query("UPDATE PendingRegistration p SET p.attempts = p.attempts + 1 WHERE p.email = :email")
    int incrementAttemptsByEmail(String email);

    /**
     * Delete pending registration by email (with new transaction)
     * Used when max attempts reached to ensure deletion is committed
     */
    @Modifying
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @Query("DELETE FROM PendingRegistration p WHERE p.email = :email")
    int deleteByEmailWithNewTransaction(String email);
}
