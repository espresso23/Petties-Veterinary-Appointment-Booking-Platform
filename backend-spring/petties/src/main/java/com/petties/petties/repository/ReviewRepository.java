package com.petties.petties.repository;

import com.petties.petties.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {
    List<Review> findByClinic_ClinicIdOrderByCreatedAtDesc(UUID clinicId);

    // Check if booking already reviewed
    boolean existsByBooking_BookingId(UUID bookingId);

    @org.springframework.data.jpa.repository.Query("SELECT AVG(r.rating) FROM Review r WHERE r.clinic.clinicId = :clinicId")
    Double getAverageRatingByClinicId(@org.springframework.data.repository.query.Param("clinicId") UUID clinicId);

    long countByClinic_ClinicId(UUID clinicId);
}
