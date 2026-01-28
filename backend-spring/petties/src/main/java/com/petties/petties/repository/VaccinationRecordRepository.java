package com.petties.petties.repository;

import com.petties.petties.model.VaccinationRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface VaccinationRecordRepository extends MongoRepository<VaccinationRecord, String> {
    List<VaccinationRecord> findByPetIdOrderByVaccinationDateDesc(UUID petId);
}
