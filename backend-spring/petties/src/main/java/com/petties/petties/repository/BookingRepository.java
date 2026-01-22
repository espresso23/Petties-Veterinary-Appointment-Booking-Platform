package com.petties.petties.repository;

import com.petties.petties.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Booking Repository - Data Access Layer cho Booking entity
 * 
 * Cung cấp các phương thức để thao tác với bảng bookings trong database
 * Kế thừa từ JpaRepository để có sẵn các CRUD operations cơ bản
 */
@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    // ========== BASIC QUERIES ==========

    /**
     * Tìm booking theo booking code (unique)
     */
    Optional<Booking> findByBookingCode(String bookingCode);

    /**
     * Check xem booking code đã tồn tại chưa
     */
    boolean existsByBookingCode(String bookingCode);

    /**
     * Tìm booking theo pet owner
     */
    List<Booking> findByPetOwnerUserId(UUID petOwnerId);

    /**
     * Tìm booking theo clinic
     */
    List<Booking> findByClinicClinicId(UUID clinicId);

    @Query("select distinct b from Booking b " +
            "left join fetch b.pet " +
            "left join fetch b.petOwner " +
            "left join fetch b.clinic " +
            "left join fetch b.assignedVet " +
            "left join fetch b.payment")
    List<Booking> findAllWithToOneRelations();
}
