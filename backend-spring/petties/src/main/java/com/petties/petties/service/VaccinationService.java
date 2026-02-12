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
    private final com.petties.petties.repository.VaccineTemplateRepository vaccineTemplateRepository;

    @Transactional
    public VaccinationResponse createVaccination(CreateVaccinationRequest request, UUID staffId) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff not found"));

        Clinic clinic = staff.getWorkingClinic();

        Pet pet = petRepository.findById(request.getPetId())
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

        // 1. Check if Template is used
        com.petties.petties.model.VaccineTemplate template = null;
        if (request.getVaccineTemplateId() != null) {
            template = vaccineTemplateRepository.findById(request.getVaccineTemplateId())
                    .orElse(null);
        } else if (request.getVaccineName() != null) {
            // Fuzzy match by name
            String normalizedInput = normalizeName(request.getVaccineName());
            if (!normalizedInput.isEmpty()) {
                List<com.petties.petties.model.VaccineTemplate> all = vaccineTemplateRepository.findAll();
                template = all.stream()
                        .filter(t -> {
                            String normalizedT = normalizeName(t.getName());
                            return normalizedT.contains(normalizedInput) || normalizedInput.contains(normalizedT);
                        })
                        .findFirst()
                        .orElse(null);
            }
        }
        if (template != null) {
            log.info("Matched vaccine template: {} (ID: {})", template.getName(), template.getId());
        } else {
            log.warn("No vaccine template matched for: {}", request.getVaccineName());
        }

        UUID seriesId = UUID.randomUUID(); // Generate series ID for linking

        // --- DOSE PREDICTION / OVERRIDE LOGIC ---
        int doseNumber = 1;
        String doseSeq = request.getDoseSequence();

        if (doseSeq != null) {
            switch (doseSeq.toUpperCase()) {
                case "1":
                    doseNumber = 1;
                    break;
                case "2":
                    doseNumber = 2;
                    break;
                case "3":
                    doseNumber = 3;
                    break;
                case "BOOSTER":
                case "ANNUAL":
                    doseNumber = 4;
                    break;
                case "AD_HOC":
                    doseNumber = 0;
                    break;
                default:
                    doseNumber = 1;
            }
        } else if (template != null) {
            // Predict based on history
            List<VaccinationRecord> history = vaccinationRecordRepository
                    .findByPetIdOrderByVaccinationDateDesc(request.getPetId());
            String normalizedT = normalizeName(template.getName());

            long existingCount = history.stream()
                    .filter(r -> "COMPLETED".equals(r.getStatus())
                            && normalizeName(r.getVaccineName()).equals(normalizedT))
                    .count();

            if (existingCount > 0) {
                if (existingCount >= (template.getSeriesDoses() != null ? template.getSeriesDoses() : 1)) {
                    doseNumber = 4; // Suggest annual/booster
                } else {
                    doseNumber = (int) existingCount + 1;
                }
            }
        }

        // --- FUTURE DATE CHECK ---
        if (request.getVaccinationDate() != null && request.getVaccinationDate().isAfter(java.time.LocalDate.now())) {
            throw new IllegalArgumentException("Ngày tiêm không thể ở tương lai.");
        }

        // --- INTERVAL SAFETY CHECK ---
        if (template != null && template.getMinIntervalDays() != null && request.getVaccinationDate() != null) {
            List<VaccinationRecord> history = vaccinationRecordRepository
                    .findByPetIdOrderByVaccinationDateDesc(request.getPetId());
            String normalizedT = normalizeName(template.getName());

            VaccinationRecord lastCompletedDose = history.stream()
                    .filter(r -> "COMPLETED".equals(r.getStatus())
                            && normalizeName(r.getVaccineName()).equals(normalizedT)
                            && r.getVaccinationDate() != null)
                    .max(java.util.Comparator.comparing(VaccinationRecord::getVaccinationDate))
                    .orElse(null);

            if (lastCompletedDose != null) {
                long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(
                        lastCompletedDose.getVaccinationDate(), request.getVaccinationDate());
                if (daysBetween < template.getMinIntervalDays()) {
                    throw new IllegalArgumentException(
                            String.format(
                                    "Không thể tiêm vắc-xin này quá sớm. Khoảng cách tối thiểu là %d ngày (còn %d ngày nữa).",
                                    template.getMinIntervalDays(),
                                    template.getMinIntervalDays() - daysBetween));
                }
            }
        }

        // 2. Create Primary Record
        VaccinationRecord record = VaccinationRecord.builder()
                .petId(request.getPetId())
                .bookingId(request.getBookingId())
                .staffId(staffId)
                .clinicId(clinic != null ? clinic.getClinicId() : null)
                .clinicName(clinic != null ? clinic.getName() : "N/A")
                .staffName(staff.getFullName())
                .vaccineName(template != null ? template.getName() : request.getVaccineName())
                .vaccineTemplateId(template != null ? template.getId() : null)
                .batchNumber(request.getBatchNumber())
                .vaccinationDate(request.getVaccinationDate())
                .nextDueDate(request.getNextDueDate())
                .notes(request.getNotes())
                .status("COMPLETED")
                .doseNumber(doseNumber)
                .totalDoses(template != null ? template.getSeriesDoses() : (request.getVaccineName() != null ? 1 : 0))
                .seriesId(seriesId)
                .createdAt(LocalDateTime.now())
                .build();

        VaccinationRecord saved = vaccinationRecordRepository.save(record);
        log.info("Created vaccination record {} for pet {}", saved.getId(), pet.getName());

        return mapToResponse(saved);
    }

    /**
     * Auto-create draft vaccination records from booking
     */
    /**
     * Auto-create draft vaccination records from booking
     */
    @Transactional
    public void createDraftFromBooking(com.petties.petties.model.Booking booking,
            com.petties.petties.model.BookingServiceItem item) {
        // Only create drafts for active/pending bookings
        if (booking.getStatus() == com.petties.petties.model.enums.BookingStatus.COMPLETED ||
                booking.getStatus() == com.petties.petties.model.enums.BookingStatus.CANCELLED ||
                booking.getStatus() == com.petties.petties.model.enums.BookingStatus.NO_SHOW) {
            return;
        }

        if (item.getService() == null || item.getService()
                .getServiceCategory() != com.petties.petties.model.enums.ServiceCategory.VACCINATION) {
            return;
        }

        // Check if record already exists for this booking item
        // Since we don't have item identifier in record, we check by bookingId and
        // vaccineName
        List<VaccinationRecord> existing = vaccinationRecordRepository
                .findByPetIdOrderByVaccinationDateDesc(booking.getPet().getId());
        boolean alreadyCreated = existing.stream()
                .anyMatch(r -> r.getBookingId() != null && r.getBookingId().equals(booking.getBookingId())
                        && r.getVaccineName() != null && r.getVaccineName().equals(item.getService().getName()));

        if (alreadyCreated) {
            log.info("Draft vaccination record already exists for booking {}", booking.getBookingId());
            return;
        }

        com.petties.petties.model.VaccineTemplate template = item.getService().getVaccineTemplate();

        // Predict dose
        int doseNumber = 1;
        String notes = "Tự động tạo từ lịch hẹn";

        if (template != null) {
            VaccinationResponse prediction = predictNextDose(template, existing, booking.getPet().getId());
            if (prediction != null) {
                doseNumber = prediction.getDoseNumber();
                notes = prediction.getNotes();
            }
        }

        VaccinationRecord record = VaccinationRecord.builder()
                .petId(booking.getPet().getId())
                .bookingId(booking.getBookingId())
                .staffId(booking.getAssignedStaff() != null ? booking.getAssignedStaff().getUserId() : null)
                .staffName(booking.getAssignedStaff() != null ? booking.getAssignedStaff().getFullName() : null)
                .clinicId(booking.getClinic().getClinicId())
                .clinicName(booking.getClinic().getName())
                .vaccineName(item.getService().getName()) // Use service name as vaccine name (e.g. "Tiêm Dại")
                .vaccineTemplateId(template != null ? template.getId() : null)
                .vaccinationDate(booking.getBookingDate())
                .status("PENDING") // Draft status
                .doseNumber(doseNumber)
                .totalDoses(template != null ? template.getSeriesDoses() : 1)
                .notes(notes)
                .createdAt(LocalDateTime.now())
                .build();

        vaccinationRecordRepository.save(record);
        log.info("Auto-created DRAFT vaccination record for booking {}", booking.getBookingCode());
    }

    private String normalizeName(String name) {
        if (name == null)
            return "";
        // Remove accents
        String nfdNormalizedString = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD);
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String simplified = pattern.matcher(nfdNormalizedString).replaceAll("")
                .toLowerCase()
                .replaceAll("[^a-z0-9]", "");

        return simplified.replaceAll("^vaccine", "").replaceAll("^vacxin", "").trim();
    }

    @Transactional(readOnly = true)
    public List<VaccinationResponse> getUpcomingVaccinations(UUID petId) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

        List<com.petties.petties.model.VaccineTemplate> templates = vaccineTemplateRepository.findAll();
        List<VaccinationRecord> history = vaccinationRecordRepository.findByPetIdOrderByVaccinationDateDesc(petId);

        log.info("[UPCOMING] Pet: {} (species: {})", pet.getName(), pet.getSpecies());
        log.info("[UPCOMING] Total templates: {}, Total history: {}", templates.size(), history.size());

        List<VaccinationResponse> result = templates.stream()
                .filter(t -> {
                    boolean suitable = isTemplateSuitableForPet(t, pet);
                    log.info("[UPCOMING] Template '{}' (target: {}) suitable for pet: {}",
                            t.getName(), t.getTargetSpecies(), suitable);
                    return suitable;
                })
                .map(t -> predictNextDose(t, history, petId))
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());

        log.info("[UPCOMING] Returning {} predicted vaccinations", result.size());
        return result;
    }

    private boolean isTemplateSuitableForPet(com.petties.petties.model.VaccineTemplate t, Pet pet) {
        if (t.getTargetSpecies() == null || t.getTargetSpecies().name().equalsIgnoreCase("BOTH")) {
            return true;
        }
        String petSpecies = pet.getSpecies() != null ? pet.getSpecies().toLowerCase() : "";
        String normalizedSpecies = java.text.Normalizer.normalize(petSpecies, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "").toLowerCase();

        boolean isDog = normalizedSpecies.contains("dog") || normalizedSpecies.contains("cho")
                || petSpecies.contains("chó");
        boolean isCat = normalizedSpecies.contains("cat") || normalizedSpecies.contains("meo")
                || petSpecies.contains("mèo");

        if (isDog) {
            return t.getTargetSpecies().name().equalsIgnoreCase("DOG");
        }
        if (isCat) {
            return t.getTargetSpecies().name().equalsIgnoreCase("CAT");
        }

        // Fallback: check template name if pet species is unknown
        String templateName = t.getName().toLowerCase();
        if (templateName.contains("(chó)") && isCat)
            return false;
        if (templateName.contains("(mèo)") && isDog)
            return false;

        return false;
    }

    private VaccinationResponse predictNextDose(com.petties.petties.model.VaccineTemplate t,
            List<VaccinationRecord> history, UUID petId) {
        String normalizedT = normalizeName(t.getName());

        // Find COMPLETED records for this vaccine
        List<VaccinationRecord> vaccineHistory = history.stream()
                .filter(r -> "COMPLETED".equals(r.getStatus()) && normalizeName(r.getVaccineName()).equals(normalizedT))
                .sorted(java.util.Comparator.comparing(VaccinationRecord::getVaccinationDate).reversed())
                .collect(Collectors.toList());

        int doseNumber;
        LocalDate nextDueDate;
        String notes;

        if (vaccineHistory.isEmpty()) {
            // Suggest Dose 1
            doseNumber = 1;
            // No default date for first dose to avoid confusion
            nextDueDate = null;
            notes = "Dự kiến: Mũi 1 (Chưa có lịch sử)";
        } else {
            VaccinationRecord lastRecord = vaccineHistory.get(0);
            int lastDose = lastRecord.getDoseNumber() != null ? lastRecord.getDoseNumber() : 1;
            int totalDoses = t.getSeriesDoses() != null ? t.getSeriesDoses() : 1;

            if (lastDose < totalDoses) {
                // Next in series
                doseNumber = lastDose + 1;
                int interval = t.getRepeatIntervalDays() != null ? t.getRepeatIntervalDays() : 21;
                nextDueDate = lastRecord.getVaccinationDate() != null
                        ? lastRecord.getVaccinationDate().plusDays(interval)
                        : LocalDate.now().plusDays(interval);
                notes = "Dự kiến: Mũi " + doseNumber + " (Sau mũi " + lastDose + ")";
            } else if (Boolean.TRUE.equals(t.getIsAnnualRepeat())) {
                // Annual Booster
                doseNumber = 4; // Use 4 for Annual
                nextDueDate = lastRecord.getVaccinationDate() != null
                        ? lastRecord.getVaccinationDate().plusYears(1)
                        : LocalDate.now().plusYears(1);
                notes = "Dự kiến: Tái chủng hằng năm";
            } else {
                return null; // No more doses needed
            }
        }

        return VaccinationResponse.builder()
                .petId(petId)
                .vaccineName(t.getName())
                .vaccineTemplateId(t.getId())
                .doseNumber(doseNumber)
                .totalDoses(t.getSeriesDoses())
                .nextDueDate(nextDueDate)
                .status("PLANNED") // New status for prediction
                .notes(notes)
                .build();
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
    public VaccinationResponse updateVaccination(String id, CreateVaccinationRequest request, UUID staffId) {
        VaccinationRecord record = vaccinationRecordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vaccination record not found"));

        // Update staff info if provided
        if (staffId != null) {
            User staff = userRepository.findById(staffId).orElse(null);
            if (staff != null) {
                record.setStaffId(staffId);
                record.setStaffName(staff.getFullName());
                if (staff.getWorkingClinic() != null) {
                    record.setClinicId(staff.getWorkingClinic().getClinicId());
                    record.setClinicName(staff.getWorkingClinic().getName());
                }
            }
        }

        // Update vaccine template if provided
        if (request.getVaccineTemplateId() != null) {
            com.petties.petties.model.VaccineTemplate template = vaccineTemplateRepository
                    .findById(request.getVaccineTemplateId()).orElse(null);
            if (template != null) {
                record.setVaccineTemplateId(template.getId());
                record.setVaccineName(template.getName());
                record.setTotalDoses(template.getSeriesDoses());
            }
        } else if (request.getVaccineName() != null) {
            record.setVaccineName(request.getVaccineName());
        }

        // Update dates
        if (request.getVaccinationDate() != null) {
            if (request.getVaccinationDate().isAfter(LocalDate.now())) {
                throw new IllegalArgumentException("Ngày tiêm không thể ở tương lai.");
            }
            record.setVaccinationDate(request.getVaccinationDate());
        }
        if (request.getNextDueDate() != null) {
            record.setNextDueDate(request.getNextDueDate());
        }

        // Update dose sequence
        if (request.getDoseSequence() != null) {
            int doseNumber;
            switch (request.getDoseSequence().toUpperCase()) {
                case "1":
                    doseNumber = 1;
                    break;
                case "2":
                    doseNumber = 2;
                    break;
                case "3":
                    doseNumber = 3;
                    break;
                case "BOOSTER":
                case "ANNUAL":
                    doseNumber = 4;
                    break;
                default:
                    doseNumber = record.getDoseNumber() != null ? record.getDoseNumber() : 1;
            }
            record.setDoseNumber(doseNumber);
        }

        // Update notes
        if (request.getNotes() != null) {
            record.setNotes(request.getNotes());
        }

        // Update status (workflow)
        if (request.getWorkflowStatus() != null) {
            record.setStatus(request.getWorkflowStatus());
        }

        VaccinationRecord saved = vaccinationRecordRepository.save(record);
        log.info("Updated vaccination record {}", saved.getId());

        return mapToResponse(saved);
    }

    @Transactional
    public void deleteVaccination(String id) {
        if (!vaccinationRecordRepository.existsById(id)) {
            throw new ResourceNotFoundException("Vaccination record not found");
        }
        vaccinationRecordRepository.deleteById(id);
    }

    private VaccinationResponse mapToResponse(VaccinationRecord record) {
        String status = record.getStatus(); // Use stored status first
        if (status == null)
            status = "Valid"; // Default legacy

        // Recalculate logic display status if needed, or just use stored status.
        // For PENDING, it is PENDING.
        // For Valid/Overdue, we can still compute property.
        // Let's stick to the stored status for now as it's explicit.

        return VaccinationResponse.builder()
                .id(record.getId())
                .petId(record.getPetId())
                .bookingId(record.getBookingId())
                .staffId(record.getStaffId())
                .clinicId(record.getClinicId())
                .clinicName(record.getClinicName())
                .staffName(record.getStaffName())
                .vaccineName(record.getVaccineName())
                .vaccineTemplateId(record.getVaccineTemplateId())
                .doseNumber(record.getDoseNumber())
                .totalDoses(record.getTotalDoses())
                .seriesId(record.getSeriesId())
                // batchNumber removed
                .vaccinationDate(record.getVaccinationDate())
                .nextDueDate(record.getNextDueDate())
                .notes(record.getNotes())
                .createdAt(record.getCreatedAt())
                .status(status)
                .build();
    }
}
