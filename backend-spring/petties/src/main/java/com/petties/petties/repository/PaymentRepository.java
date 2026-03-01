package com.petties.petties.repository;

import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.PaymentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Payment Repository - Data Access Layer cho Payment entity
 * 
 * Cung cấp các phương thức để thao tác với bảng payments trong database
 */
@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    // ========== BASIC QUERIES ==========

    /**
     * Tìm payment theo booking ID (1-1 relationship)
     */
    Optional<Payment> findByBookingBookingId(UUID bookingId);

    /**
     * Check xem booking đã có payment chưa
     */
    boolean existsByBookingBookingId(UUID bookingId);

    boolean existsByPaymentDescription(String paymentDescription);

    /**
     * Tìm payment theo payment method
     */
    List<Payment> findByMethod(com.petties.petties.model.enums.PaymentMethod method);

    @EntityGraph(attributePaths = { "booking", "booking.petOwner" })
    List<Payment> findByBookingPetOwnerUserIdOrderByCreatedAtDesc(UUID petOwnerId, Pageable pageable);

    @EntityGraph(attributePaths = { "booking", "booking.petOwner" })
    List<Payment> findByBookingPetOwnerUserIdAndStatusOrderByCreatedAtDesc(UUID petOwnerId, PaymentStatus status,
            Pageable pageable);

    // ========== CLINIC-BASED QUERIES ==========

    /**
     * Find payments by clinic ID
     */
    @EntityGraph(attributePaths = { "booking", "booking.clinic", "booking.petOwner" })
    List<Payment> findByBookingClinicClinicIdOrderByCreatedAtDesc(UUID clinicId, Pageable pageable);

    @EntityGraph(attributePaths = { "booking", "booking.clinic", "booking.petOwner" })
    List<Payment> findByBookingClinicClinicIdAndStatusOrderByCreatedAtDesc(UUID clinicId, PaymentStatus status,
            Pageable pageable);
}
