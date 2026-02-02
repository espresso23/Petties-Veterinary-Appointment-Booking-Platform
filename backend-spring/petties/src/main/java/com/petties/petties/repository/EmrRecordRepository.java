package com.petties.petties.repository;

import com.petties.petties.model.EmrRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * EMR Record Repository - MongoDB
 */
@Repository
public interface EmrRecordRepository extends MongoRepository<EmrRecord, String> {

    List<EmrRecord> findByPetIdOrderByCreatedAtDesc(UUID petId);

    List<EmrRecord> findByBookingId(UUID bookingId);

    List<EmrRecord> findByClinicIdOrderByExaminationDateDesc(UUID clinicId);

    List<EmrRecord> findByStaffIdOrderByExaminationDateDesc(UUID staffId);

    boolean existsByBookingId(UUID bookingId);

    List<EmrRecord> findByReExaminationDateBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);
}
