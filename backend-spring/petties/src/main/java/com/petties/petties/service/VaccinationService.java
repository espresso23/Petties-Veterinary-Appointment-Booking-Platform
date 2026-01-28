package com.petties.petties.service;

import com.petties.petties.dto.vaccination.CreateVaccinationRequest;
import com.petties.petties.dto.vaccination.VaccinationResponse;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.VaccinationRecord;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.VaccinationRecordRepository;
import com.petties.petties.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VaccinationService {

    private final VaccinationRecordRepository vaccinationRecordRepository;
    private final PetRepository petRepository;
    private final UserRepository userRepository;

    @Transactional
    public VaccinationResponse createVaccination(CreateVaccinationRequest request, UUID vetId) {
        User vet = userRepository.findById(vetId)
                .orElseThrow(() -> new ResourceNotFoundException("Vet not found"));

        Clinic clinic = vet.getWorkingClinic();

        Pet pet = petRepository.findById(request.getPetId())
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

        VaccinationRecord record = VaccinationRecord.builder()
                .petId(request.getPetId())
                .bookingId(request.getBookingId())
                .vetId(vetId)
                .clinicId(clinic != null ? clinic.getClinicId() : null)
                .clinicName(clinic != null ? clinic.getName() : "N/A")
                .vetName(vet.getFullName())
                .vaccineName(request.getVaccineName())
                .batchNumber(request.getBatchNumber())
                .vaccinationDate(request.getVaccinationDate())
                .nextDueDate(request.getNextDueDate())
                .notes(request.getNotes())
                .createdAt(LocalDateTime.now())
                .build();

        VaccinationRecord saved = vaccinationRecordRepository.save(record);
        log.info("Created vaccination record {} for pet {}", saved.getId(), pet.getName());

        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<VaccinationResponse> getVaccinationsByPet(UUID petId) {
        if (!petRepository.existsById(petId)) {
            throw new ResourceNotFoundException("Pet not found");
        }

        return vaccinationRecordRepository.findByPetIdOrderByVaccinationDateDesc(petId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteVaccination(String id) {
        if (!vaccinationRecordRepository.existsById(id)) {
            throw new ResourceNotFoundException("Vaccination record not found");
        }
        vaccinationRecordRepository.deleteById(id);
    }

    private VaccinationResponse mapToResponse(VaccinationRecord record) {
        String status = "Valid";
        if (record.getNextDueDate() != null) {
            LocalDate today = LocalDate.now();
            if (record.getNextDueDate().isBefore(today)) {
                status = "Overdue";
            } else if (record.getNextDueDate().isBefore(today.plusDays(30))) {
                status = "Expiring Soon";
            }
        } else {
            status = "N/A";
        }

        return VaccinationResponse.builder()
                .id(record.getId())
                .petId(record.getPetId())
                .bookingId(record.getBookingId())
                .vetId(record.getVetId())
                .clinicId(record.getClinicId())
                .clinicName(record.getClinicName())
                .vetName(record.getVetName())
                .vaccineName(record.getVaccineName())
                .batchNumber(record.getBatchNumber())
                .vaccinationDate(record.getVaccinationDate())
                .nextDueDate(record.getNextDueDate())
                .notes(record.getNotes())
                .createdAt(record.getCreatedAt())
                .status(status)
                .build();
    }
}
