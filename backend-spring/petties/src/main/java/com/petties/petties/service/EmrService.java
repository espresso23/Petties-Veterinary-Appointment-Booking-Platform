package com.petties.petties.service;

import com.petties.petties.dto.emr.*;
import com.petties.petties.model.*;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
        private final BookingRepository bookingRepository;
        private final AiCaseMemorySyncService aiCaseMemorySyncService;

        /**
         * Create a new EMR record
         *
         * SHARED VISIBILITY RULES:
         * - Any staff in the same clinic can create EMR for IN_PROGRESS bookings
         * - Staff doesn't need to be assigned to the booking
         * - Each EMR records the staffId of the creator for audit trail
         */
        @org.springframework.transaction.annotation.Transactional
        public EmrResponse createEmr(CreateEmrRequest request, UUID staffId) {
                // Get staff info
                User staff = userRepository.findById(staffId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên"));

                // Get clinic from staff's working clinic
                Clinic clinic = staff.getWorkingClinic();
                if (clinic == null) {
                        throw new BadRequestException("Bạn chưa được gán vào phòng khám nào");
                }

                // SHARED VISIBILITY: Validate booking is IN_PROGRESS and belongs to same clinic
                if (request.getBookingId() != null) {
                        Booking booking = bookingRepository.findById(request.getBookingId())
                                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                        // Rule 1: Booking must be IN_PROGRESS to add EMR
                        if (booking.getStatus() != com.petties.petties.model.enums.BookingStatus.IN_PROGRESS) {
                                throw new BadRequestException(
                                        "Chỉ có thể thêm bệnh án khi lịch hẹn đang ở trạng thái 'Đang khám' (IN_PROGRESS)");
                        }

                        // Rule 2: Staff must belong to the same clinic as the booking
                        if (!booking.getClinic().getClinicId().equals(clinic.getClinicId())) {
                                throw new ForbiddenException(
                                        "Bạn không có quyền thêm bệnh án cho lịch hẹn của phòng khám khác");
                        }

                        log.info("Staff {} creating EMR for booking {} (Shared Visibility enabled)",
                                        staffId, booking.getBookingCode());
                }

        // Allow multiple EMR records per booking (different staff can add their own records)

                // Get pet info
                Pet pet = petRepository.findById(request.getPetId())
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng"));

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
                                .staffId(staffId)
                                .clinicId(clinic != null ? clinic.getClinicId() : null)
                                .clinicName(clinic != null ? clinic.getName() : "N/A")
                                .staffName(staff.getFullName())
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
                                .aiDiagnosisContext(request.getAiDiagnosisContext())
                                .images(images)
                                .examinationDate(request.getExaminationDate() != null
                                                ? request.getExaminationDate()
                                                : LocalDateTime.now())
                                .reExaminationDate(request.getReExaminationDate())
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build();

                EmrRecord saved = emrRecordRepository.save(emr);
                log.info("Created EMR record {} for pet {}", saved.getId(), pet.getName());

                // Sync pet weight if provided in EMR
                if (request.getWeightKg() != null && request.getWeightKg().doubleValue() > 0) {
                        pet.setWeight(request.getWeightKg().doubleValue());
                        petRepository.save(pet);
                        log.info("Updated pet {} weight to {} kg", pet.getName(), request.getWeightKg());
                }

                syncConfirmedCase(saved);

                return mapToResponse(saved, pet);
        }

        /**
         * Update EMR record (Only creator Staff & within 24h)
         */
        @org.springframework.transaction.annotation.Transactional
        public EmrResponse updateEmr(String emrId, CreateEmrRequest request, UUID currentStaffId) {
                EmrRecord emr = emrRecordRepository.findById(emrId)
                                .orElseThrow(() -> new ResourceNotFoundException("EMR not found"));

                // Rule 1: Only the creating Staff can edit
                if (!emr.getStaffId().equals(currentStaffId)) {
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
                emr.setUpdatedAt(LocalDateTime.now());
                emr.setAiDiagnosisContext(request.getAiDiagnosisContext());

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

                syncConfirmedCase(saved);

                return mapToResponse(saved, pet);
        }

        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        public CaseMemoryResyncResponse resyncConfirmedCaseMemory(int limit) {
                if (limit < 1 || limit > 2000) {
                        throw new BadRequestException("Giới hạn đồng bộ phải từ 1 đến 2000 bệnh án");
                }

                List<EmrRecord> eligibleRecords = emrRecordRepository.findAll().stream()
                                .filter(this::isEligibleForCaseMemorySync)
                                .sorted(Comparator.comparing(
                                                this::resolveCaseMemorySortTime,
                                                Comparator.nullsLast(Comparator.naturalOrder()))
                                                .reversed())
                                .collect(Collectors.toList());

                int totalEligible = eligibleRecords.size();
                int processedCount = 0;
                int syncedCount = 0;

                for (EmrRecord emr : eligibleRecords.stream().limit(limit).toList()) {
                        processedCount++;
                        try {
                                if (aiCaseMemorySyncService.syncConfirmedEmr(mapToInternalConfirmedItem(emr))) {
                                        syncedCount++;
                                }
                        } catch (Exception ex) {
                                log.warn("Failed to resync EMR {} to AI case memory: {}", emr.getId(), ex.getMessage());
                        }
                }

                int failedCount = processedCount - syncedCount;
                return CaseMemoryResyncResponse.builder()
                                .success(failedCount == 0)
                                .totalEligible(totalEligible)
                                .processedCount(processedCount)
                                .syncedCount(syncedCount)
                                .failedCount(failedCount)
                                .message(String.format(
                                                "Đã đồng bộ %d/%d bệnh án đủ điều kiện vào Case Memory",
                                                syncedCount,
                                                processedCount))
                                .build();
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
                java.util.List<EmrRecord> emrs = emrRecordRepository.findByBookingId(bookingId);
                EmrRecord emr = emrs.stream().findFirst()
                                .orElseThrow(() -> new ResourceNotFoundException("Chưa có bệnh án cho lịch hẹn này"));

                Pet pet = petRepository.findById(emr.getPetId()).orElse(null);
                return mapToResponse(emr, pet);
        }

        /**
         * Map EmrRecord to EmrResponse
         */
        private EmrResponse mapToResponse(EmrRecord emr, Pet pet) {
                String petName = pet != null ? pet.getName() : "Unknown";
                String petSpecies = pet != null && pet.getSpecies() != null ? pet.getSpecies().name() : "";
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

                String bookingCode = null;
                if (emr.getBookingId() != null) {
                        bookingCode = bookingRepository.findById(emr.getBookingId())
                                        .map(com.petties.petties.model.Booking::getBookingCode)
                                        .orElse(null);
                }

                return EmrResponse.builder()
                                .id(emr.getId())
                                .petId(emr.getPetId())
                                .bookingId(emr.getBookingId())
                                .bookingCode(bookingCode)
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

        private InternalConfirmedEmrItemDto mapToInternalConfirmedItem(EmrRecord emr) {
                Pet pet = petRepository.findById(emr.getPetId()).orElse(null);

                List<EmrImage> validImages = emr.getImages() != null
                                ? emr.getImages().stream()
                                                .filter(image -> image != null
                                                                && image.getUrl() != null
                                                                && !image.getUrl().isBlank())
                                                .toList()
                                : List.of();

                List<String> imageUrls = validImages.stream()
                                .map(EmrImage::getUrl)
                                .collect(Collectors.toList());

                List<String> imageDescriptions = validImages.stream()
                                .map(EmrImage::getDescription)
                                .map(description -> description != null ? description.trim() : "")
                                .collect(Collectors.toList());

                Map<String, Object> attachments = new LinkedHashMap<>();
                attachments.put("image_urls", imageUrls);
                attachments.put("image_descriptions", imageDescriptions);

                Map<String, Object> soap = new LinkedHashMap<>();
                soap.put("subjective", emr.getSubjective());
                soap.put("objective", emr.getObjective());
                soap.put("assessment", emr.getAssessment());
                soap.put("plan", emr.getPlan());
                soap.put("notes", emr.getNotes());

                Map<String, Object> vitals = new LinkedHashMap<>();
                vitals.put("weight_kg", emr.getWeightKg());
                vitals.put("temperature_c", emr.getTemperatureC());
                vitals.put("heart_rate", emr.getHeartRate());
                vitals.put("bcs", emr.getBcs());

                List<Map<String, Object>> prescriptions = emr.getPrescriptions() != null
                                ? emr.getPrescriptions().stream()
                                                .filter(prescription -> prescription != null)
                                                .map(prescription -> {
                                                        Map<String, Object> rx = new LinkedHashMap<>();
                                                        rx.put("medicine_name", prescription.getMedicineName());
                                                        rx.put("dosage", prescription.getDosage());
                                                        rx.put("frequency", prescription.getFrequency());
                                                        rx.put("duration_days", prescription.getDurationDays());
                                                        rx.put("instructions", prescription.getInstructions());
                                                        return rx;
                                                })
                                                .collect(Collectors.toList())
                                : List.of();

                return InternalConfirmedEmrItemDto.builder()
                                .emrId(emr.getId())
                                .petId(emr.getPetId())
                                .clinicId(emr.getClinicId())
                                .bookingId(emr.getBookingId())
                                .doctorId(emr.getStaffId())
                                .species(resolvePetSpecies(pet))
                                .breed(pet != null ? pet.getBreed() : null)
                                .chiefComplaint(firstNonBlank(emr.getSubjective(), emr.getNotes()))
                                .symptoms(toSignalList(emr.getSubjective()))
                                .physicalExam(toSignalList(emr.getObjective()))
                                .clinicalNotes(firstNonBlank(emr.getNotes(), emr.getPlan(), emr.getObjective()))
                                .finalDiagnosisText(emr.getAssessment())
                                .soap(soap)
                                .vitals(vitals)
                                .prescriptions(prescriptions)
                                .aiDiagnosisContext(emr.getAiDiagnosisContext() != null ? emr.getAiDiagnosisContext() : Map.of())
                                .verified(true)
                                .examAt(emr.getExaminationDate())
                                .updatedAt(emr.getUpdatedAt() != null ? emr.getUpdatedAt() : emr.getCreatedAt())
                                .reExaminationDate(emr.getReExaminationDate())
                                .attachments(attachments)
                                .build();
        }

        private void syncConfirmedCase(EmrRecord emr) {
                if (emr == null || emr.getAssessment() == null || emr.getAssessment().isBlank()) {
                        return;
                }

                try {
                        aiCaseMemorySyncService.syncConfirmedEmr(mapToInternalConfirmedItem(emr));
                } catch (Exception ex) {
                        log.warn("Failed to trigger AI case memory sync for EMR {}: {}", emr.getId(), ex.getMessage());
                }
        }

        private boolean isEligibleForCaseMemorySync(EmrRecord emr) {
                return emr != null
                                && emr.getAssessment() != null
                                && !emr.getAssessment().isBlank();
        }

        private LocalDateTime resolveCaseMemorySortTime(EmrRecord emr) {
                if (emr == null) {
                        return null;
                }
                if (emr.getUpdatedAt() != null) {
                        return emr.getUpdatedAt();
                }
                if (emr.getExaminationDate() != null) {
                        return emr.getExaminationDate();
                }
                return emr.getCreatedAt();
        }

        private String resolvePetSpecies(Pet pet) {
                if (pet == null || pet.getSpecies() == null) {
                        return null;
                }
                return pet.getSpecies().name().toLowerCase();
        }

        private List<String> toSignalList(String value) {
                if (value == null || value.isBlank()) {
                        return List.of();
                }
                return Arrays.stream(value.split("[\\r\\n,;]+"))
                                .map(String::trim)
                                .filter(part -> !part.isBlank())
                                .limit(8)
                                .collect(Collectors.toList());
        }

        private String firstNonBlank(String... values) {
                for (String value : values) {
                        if (value != null && !value.isBlank()) {
                                return value;
                        }
                }
                return null;
        }
}
