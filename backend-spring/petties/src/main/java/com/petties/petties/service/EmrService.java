package com.petties.petties.service;

import com.petties.petties.dto.emr.*;
import com.petties.petties.model.*;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * EMR Service - Business logic for Electronic Medical Records
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmrService {

        private final EmrRecordRepository emrRecordRepository;
        private final PetRepository petRepository;
        private final UserRepository userRepository;

        /**
         * Create a new EMR record
         */
        @org.springframework.transaction.annotation.Transactional
        public EmrResponse createEmr(CreateEmrRequest request, UUID vetId) {
                // Get vet info
                User vet = userRepository.findById(vetId)
                                .orElseThrow(() -> new ResourceNotFoundException("Vet not found"));

                // Get clinic from vet's working clinic (Optional for Dev/Test)
                Clinic clinic = vet.getWorkingClinic();
                // if (clinic == null) {
                // throw new RuntimeException("Vet is not assigned to any clinic");
                // }

                // Get pet info
                Pet pet = petRepository.findById(request.getPetId())
                                .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

                // Map prescriptions
                List<Prescription> prescriptions = request.getPrescriptions() != null
                                ? request.getPrescriptions().stream()
                                                .map(p -> Prescription.builder()
                                                                .medicineName(p.getMedicineName())
                                                                .dosage(p.getDosage())
                                                                .frequency(p.getFrequency())
                                                                .durationDays(p.getDurationDays())
                                                                .instructions(p.getInstructions())
                                                                .build())
                                                .collect(Collectors.toList())
                                : List.of();

                // Map images
                List<EmrImage> images = request.getImages() != null
                                ? request.getImages().stream()
                                                .map(i -> EmrImage.builder()
                                                                .url(i.getUrl())
                                                                .description(i.getDescription())
                                                                .build())
                                                .collect(Collectors.toList())
                                : List.of();

                // Build EMR record
                EmrRecord emr = EmrRecord.builder()
                                .petId(request.getPetId())
                                .bookingId(request.getBookingId())
                                .vetId(vetId)
                                .clinicId(clinic != null ? clinic.getClinicId() : null)
                                .clinicName(clinic != null ? clinic.getName() : "N/A")
                                .vetName(vet.getFullName())
                                .subjective(request.getSubjective())
                                .objective(request.getObjective())
                                .assessment(request.getAssessment())
                                .plan(request.getPlan())
                                .notes(request.getNotes())
                                .weightKg(request.getWeightKg())
                                .temperatureC(request.getTemperatureC())
                                .heartRate(request.getHeartRate())
                                .bcs(request.getBcs())
                                .prescriptions(prescriptions)
                                .images(images)
                                .examinationDate(request.getExaminationDate() != null
                                                ? request.getExaminationDate()
                                                : LocalDateTime.now())
                                .reExaminationDate(request.getReExaminationDate())
                                .createdAt(LocalDateTime.now())
                                .build();

                EmrRecord saved = emrRecordRepository.save(emr);
                log.info("Created EMR record {} for pet {}", saved.getId(), pet.getName());

                // Sync pet weight if provided in EMR
                if (request.getWeightKg() != null && request.getWeightKg().doubleValue() > 0) {
                        pet.setWeight(request.getWeightKg().doubleValue());
                        petRepository.save(pet);
                        log.info("Updated pet {} weight to {} kg", pet.getName(), request.getWeightKg());
                }

                return mapToResponse(saved, pet);
        }

        /**
         * Update EMR record (Only creator Vet & within 24h)
         */
        @org.springframework.transaction.annotation.Transactional
        public EmrResponse updateEmr(String emrId, CreateEmrRequest request, UUID currentVetId) {
                EmrRecord emr = emrRecordRepository.findById(emrId)
                                .orElseThrow(() -> new ResourceNotFoundException("EMR not found"));

                // Rule 1: Only the creating Staff can edit
                if (!emr.getStaffId().equals(currentVetId)) {
                        throw new ForbiddenException(
                                        "Bạn không có quyền chỉnh sửa bệnh án này (Chỉ người tạo mới được sửa)");
                }

                // Rule 2: Only editable within 24 hours
                if (emr.getCreatedAt().plusHours(24).isBefore(LocalDateTime.now())) {
                        throw new BadRequestException("Bệnh án đã quá 24h và không thể chỉnh sửa");
                }

                // Update fields
                emr.setSubjective(request.getSubjective());
                emr.setObjective(request.getObjective());
                emr.setAssessment(request.getAssessment());
                emr.setPlan(request.getPlan());
                emr.setNotes(request.getNotes());
                emr.setWeightKg(request.getWeightKg());
                emr.setTemperatureC(request.getTemperatureC());
                emr.setHeartRate(request.getHeartRate());
                emr.setBcs(request.getBcs());
                emr.setReExaminationDate(request.getReExaminationDate());

                // Update prescriptions if provided
                if (request.getPrescriptions() != null) {
                        List<Prescription> prescriptions = request.getPrescriptions().stream()
                                        .map(p -> Prescription.builder()
                                                        .medicineName(p.getMedicineName())
                                                        .dosage(p.getDosage())
                                                        .frequency(p.getFrequency())
                                                        .durationDays(p.getDurationDays())
                                                        .instructions(p.getInstructions())
                                                        .build())
                                        .collect(Collectors.toList());
                        emr.setPrescriptions(prescriptions);
                }

                // Update images if provided
                if (request.getImages() != null) {
                        List<EmrImage> images = request.getImages().stream()
                                        .map(i -> EmrImage.builder()
                                                        .url(i.getUrl())
                                                        .description(i.getDescription())
                                                        .build())
                                        .collect(Collectors.toList());
                        emr.setImages(images);
                }

                EmrRecord saved = emrRecordRepository.save(emr);
                Pet pet = petRepository.findById(emr.getPetId()).orElse(null);

                // Sync pet weight if provided in EMR update
                if (pet != null && request.getWeightKg() != null && request.getWeightKg().doubleValue() > 0) {
                        pet.setWeight(request.getWeightKg().doubleValue());
                        petRepository.save(pet);
                        log.info("Updated pet {} weight to {} kg", pet.getName(), request.getWeightKg());
                }

                return mapToResponse(saved, pet);
        }

        /**
         * Get EMR by ID
         */
        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        public EmrResponse getEmrById(String emrId) {
                EmrRecord emr = emrRecordRepository.findById(emrId)
                                .orElseThrow(() -> new RuntimeException("EMR not found"));

                Pet pet = petRepository.findById(emr.getPetId()).orElse(null);
                return mapToResponse(emr, pet);
        }

        /**
         * Get all EMR records for a pet
         */
        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        public List<EmrResponse> getEmrsByPetId(UUID petId) {
                Pet pet = petRepository.findById(petId).orElse(null);

                return emrRecordRepository.findByPetIdOrderByCreatedAtDesc(petId)
                                .stream()
                                .map(emr -> mapToResponse(emr, pet))
                                .collect(Collectors.toList());
        }

        /**
         * Get EMR by booking ID
         */
        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        public EmrResponse getEmrByBookingId(UUID bookingId) {
                EmrRecord emr = emrRecordRepository.findByBookingId(bookingId)
                                .orElseThrow(() -> new RuntimeException("EMR not found for booking"));

                Pet pet = petRepository.findById(emr.getPetId()).orElse(null);
                return mapToResponse(emr, pet);
        }

        /**
         * Map EmrRecord to EmrResponse
         */
        private EmrResponse mapToResponse(EmrRecord emr, Pet pet) {
                String petName = pet != null ? pet.getName() : "Unknown";
                String petSpecies = pet != null ? pet.getSpecies() : "";
                String petBreed = pet != null ? pet.getBreed() : "";
                String ownerName = pet != null && pet.getUser() != null ? pet.getUser().getFullName() : "";

                List<PrescriptionDto> prescriptionDtos = emr.getPrescriptions() != null
                                ? emr.getPrescriptions().stream()
                                                .map(p -> PrescriptionDto.builder()
                                                                .medicineName(p.getMedicineName())
                                                                .dosage(p.getDosage())
                                                                .frequency(p.getFrequency())
                                                                .durationDays(p.getDurationDays())
                                                                .instructions(p.getInstructions())
                                                                .build())
                                                .collect(Collectors.toList())
                                : List.of();

                List<EmrImageDto> imageDtos = emr.getImages() != null
                                ? emr.getImages().stream()
                                                .map(i -> EmrImageDto.builder()
                                                                .url(i.getUrl())
                                                                .description(i.getDescription())
                                                                .build())
                                                .collect(Collectors.toList())
                                : List.of();

                return EmrResponse.builder()
                                .id(emr.getId())
                                .petId(emr.getPetId())
                                .bookingId(emr.getBookingId())
                                .staffId(emr.getStaffId())
                                .clinicId(emr.getClinicId())
                                .clinicName(emr.getClinicName())
                                .staffName(emr.getStaffName())
                                .petName(petName)
                                .petSpecies(petSpecies)
                                .petBreed(petBreed)
                                .ownerName(ownerName)
                                .subjective(emr.getSubjective())
                                .objective(emr.getObjective())
                                .assessment(emr.getAssessment())
                                .plan(emr.getPlan())
                                .notes(emr.getNotes())
                                .weightKg(emr.getWeightKg())
                                .weightKg(emr.getWeightKg())
                                .temperatureC(emr.getTemperatureC())
                                .heartRate(emr.getHeartRate())
                                .bcs(emr.getBcs())
                                .prescriptions(prescriptionDtos)
                                .images(imageDtos)
                                .examinationDate(emr.getExaminationDate())
                                .reExaminationDate(emr.getReExaminationDate())
                                .createdAt(emr.getCreatedAt())
                                // EMR is locked after 24 hours from creation
                                .isLocked(emr.getCreatedAt() != null &&
                                                emr.getCreatedAt().plusHours(24).isBefore(LocalDateTime.now()))
                                .build();
        }
}
