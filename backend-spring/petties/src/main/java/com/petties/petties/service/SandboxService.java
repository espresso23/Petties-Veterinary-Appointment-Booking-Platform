package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * SandboxService - Manages sandbox/demo clinics for user learning
 *
 * Purpose:
 * - Allow Clinic Owners/Managers to practice with mock data before handling real patients
 * - Each feature has its own sandbox clinic with pre-seeded data
 * - Sandboxes auto-delete after 24 hours or when user exits
 *
 * Feature Types:
 * - clinic_info: Practice editing clinic information
 * - services: Practice viewing clinic services (manager sandbox)
 * - clinic_services: Practice adding/managing clinic services
 * - master_services: Practice creating and applying service templates
 * - scheduling: Practice creating staff shifts and booking slots
 * - bookings: Practice viewing and managing patient bookings
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class SandboxService {

    private final ClinicRepository clinicRepository;
    private final ClinicServiceRepository clinicServiceRepository;
    private final MasterServiceRepository masterServiceRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final StaffShiftRepository staffShiftRepository;
    private final SlotRepository slotRepository;

    private static final int SANDBOX_EXPIRY_HOURS = 24;

    /**
     * Enter Sandbox Mode: Create a new sandbox clinic for the user to practice with
     *
    * @param featureName Feature to practice (clinic_info, services, clinic_services, master_services, scheduling, bookings)
     * @param userId Current user ID (Clinic Owner or Clinic Manager)
     * @return Created sandbox clinic DTO
     */
    public ClinicResponse enterSandboxMode(String featureName, UUID userId) {
        log.info("User {} entering sandbox mode for feature: {}", userId, featureName);

        // Validate feature name
        if (!isValidFeature(featureName)) {
            throw new BadRequestException("Invalid feature name: " + featureName);
        }

        // Get user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Keep one active sandbox per user to avoid confusing duplicate demo clinics in the UI
        clinicRepository.findFirstByIsSandboxTrueAndSandboxOwnerUserIdOrderByCreatedAtDesc(userId)
                .ifPresent(existingSandbox -> {
                    try {
                        clinicRepository.delete(existingSandbox);
                        log.info("Removed previous active sandbox before creating a new one: {}", existingSandbox.getClinicId());
                    } catch (Exception e) {
                        log.warn("Failed to remove existing sandbox before creating a new one", e);
                    }
                });

        // Create sandbox clinic
        String clinicName = "Sandbox - " + featureName + " (" + user.getFullName() + ")";

        Clinic sandbox = Clinic.builder()
                .name(clinicName)
                .isSandbox(true)
                .sandboxOwner(user)
                .sandboxExpiresAt(LocalDateTime.now().plusHours(SANDBOX_EXPIRY_HOURS))
                .owner(user) // Use same user as owner (doesn't matter for sandbox)
                .status(ClinicStatus.APPROVED) // Bypass approval for sandbox
                .address("123 Demo Street, Demo City (This is sandbox data - not real)")
                .district("Demo District")
                .province("Demo Province")
                .phone("0123456789")
                .email("sandbox@petties.local")
                .latitude(BigDecimal.valueOf(10.7282))
                .longitude(BigDecimal.valueOf(106.6824))
                .ratingAvg(BigDecimal.valueOf(5.0))
                .ratingCount(0)
                .build();

        Clinic created = clinicRepository.save(sandbox);
        log.info("Sandbox clinic created: {} (ID: {})", clinicName, created.getClinicId());

        // Seed mock data based on feature
        seedSandboxData(created, featureName, user);

        return mapToResponse(created);
    }

    /**
     * Seed mock data appropriate for the feature
     */
    private void seedSandboxData(Clinic sandbox, String featureName, User currentUser) {
        try {
            switch (featureName) {
                case "clinic_info":
                    // No pre-seeding needed for clinic_info - user will edit
                    log.info("Sandbox clinic_info initialized (no pre-seeding)");
                    break;

                case "services":
                    // Seed example services
                    createSampleService(sandbox, "Khám tổng quát", new BigDecimal("150000"), "Kiểm tra sức khỏe toàn diện");
                    createSampleService(sandbox, "Tiêm vắc-xin", new BigDecimal("100000"), "Tiêm chủng phòng bệnh");
                    createSampleService(sandbox, "Cấy ghép", new BigDecimal("200000"), "Dịch vụ cấy ghép cho thú cưng");
                    log.info("Sandbox services initialized with 3 sample services");
                    break;

                case "clinic_services":
                    createSampleService(sandbox, "Khám tổng quát", new BigDecimal("150000"), "Kiểm tra sức khỏe toàn diện");
                    createSampleService(sandbox, "Tiêm vắc-xin", new BigDecimal("100000"), "Tiêm chủng phòng bệnh");
                    createSampleService(sandbox, "Cấy ghép", new BigDecimal("200000"), "Dịch vụ cấy ghép cho thú cưng");
                    log.info("Sandbox clinic_services initialized with 3 sample services");
                    break;

                case "master_services":
                    createSampleMasterService("Khám tổng quát", new BigDecimal("180000"), "Kiểm tra sức khỏe toàn diện");
                    createSampleMasterService("Tiêm vắc-xin", new BigDecimal("120000"), "Tiêm chủng phòng bệnh");
                    createSampleMasterService("Cắt tỉa lông", new BigDecimal("220000"), "Chăm sóc ngoại hình cho thú cưng");
                    log.info("Sandbox master_services initialized with 3 sample master services");
                    break;

                case "scheduling":
                    // Seed example shifts and slots with a valid STAFF account to avoid transactional rollback.
                    User sandboxStaff = resolveSandboxSchedulingStaff(sandbox, currentUser);
                    createSampleShiftsAndSlots(sandbox, sandboxStaff);
                    log.info("Sandbox scheduling initialized with sample staff and shifts");
                    break;

                case "bookings":
                    // Booking seeding requires pet data; skip for compile-safe sandbox initialization
                    log.info("Sandbox bookings initialized without sample bookings (pet seed not available)");
                    break;
            }
        } catch (Exception e) {
            log.error("Error seeding sandbox data for feature: {}", featureName, e);
            // Continue - don't fail if seeding fails
        }
    }

    /**
     * Create sample clinic service for sandbox
     */
    private void createSampleService(Clinic clinic, String name, BigDecimal price, String description) {
        try {
            com.petties.petties.model.ClinicService service = com.petties.petties.model.ClinicService.builder()
                    .clinic(clinic)
                    .masterService(null)
                    .isCustom(true)
                    .name(name)
                    .description(description)
                    .basePrice(price)
                    .durationTime(30)
                    .slotsRequired(1)
                    .isActive(true)
                    .isHomeVisit(false)
                    .build();

            clinicServiceRepository.save(service);
            log.debug("Created sample service: {}", name);
        } catch (Exception e) {
            log.warn("Failed to create sample service: {}", name, e);
        }
    }

    /**
     * Create sample master service for sandbox
     */
    private void createSampleMasterService(String name, BigDecimal price, String description) {
        try {
            MasterService service = new MasterService();
            service.setName(name);
            service.setDescription(description);
            service.setDefaultPrice(price);
            service.setDurationTime(30);
            service.setSlotsRequired(1);
            service.setIsHomeVisit(false);
            service.setServiceCategory("GENERAL");
            service.setPetType("Cả chó và mèo");
            service.setIcon("beaker");

            masterServiceRepository.save(service);
            log.debug("Created sample master service: {}", name);
        } catch (Exception e) {
            log.warn("Failed to create sample master service: {}", name, e);
        }
    }

    private User resolveSandboxSchedulingStaff(Clinic sandboxClinic, User currentUser) {
        if (currentUser != null && currentUser.getRole() == Role.STAFF) {
            return currentUser;
        }

        List<User> existingSandboxStaff = userRepository.findByWorkingClinicAndRole(sandboxClinic, Role.STAFF);
        if (!existingSandboxStaff.isEmpty()) {
            return existingSandboxStaff.get(0);
        }

        User sandboxStaff = User.builder()
                .username("sandbox_staff_" + sandboxClinic.getClinicId().toString().substring(0, 8))
                .password("sandbox-not-for-login")
                .email("sandbox.staff." + sandboxClinic.getClinicId().toString().substring(0, 8) + "@petties.local")
                .fullName("Nhân viên mẫu Sandbox")
                .role(Role.STAFF)
                .specialty(StaffSpecialty.VET)
                .workingClinic(sandboxClinic)
                .build();

        return userRepository.save(sandboxStaff);
    }

    /**
     * Create sample shifts and slots for sandbox
     */
    private void createSampleShiftsAndSlots(Clinic clinic, User staff) {
        try {
            if (staff == null) {
                log.warn("Cannot create shifts - staff not available");
                return;
            }

            LocalDate shiftDate = LocalDate.now().plusDays(1);
            LocalTime shiftStartTime = LocalTime.of(8, 0);
            LocalTime shiftEndTime = LocalTime.of(17, 0);

            StaffShift shift = StaffShift.builder()
                    .clinic(clinic)
                    .staff(staff)
                    .workDate(shiftDate)
                    .startTime(shiftStartTime)
                    .endTime(shiftEndTime)
                    .isOvernight(false)
                    .notes("Ca mẫu dùng thử")
                    .build();

            StaffShift savedShift = staffShiftRepository.save(shift);
            log.debug("Created sample shift for staff: {}", staff.getFullName());

            // Create slots
            for (int i = 0; i < 4; i++) {
                LocalTime startTime = LocalTime.of(8 + (i * 2), 0);
                LocalTime endTime = LocalTime.of(9 + (i * 2), 0);
                Slot slot = new Slot();
                slot.setShift(savedShift);
                slot.setStartTime(startTime);
                slot.setEndTime(endTime);
                slot.setStatus(com.petties.petties.model.enums.SlotStatus.AVAILABLE);
                slotRepository.save(slot);
            }
            log.debug("Created 4 sample slots for shift");
        } catch (Exception e) {
            log.warn("Failed to create sample shifts/slots", e);
        }
    }

    /**
     * Exit Sandbox Mode: Delete sandbox clinic and all associated data
     *
     * @param clinicId Sandbox clinic ID
     * @param userId Current user ID (must be sandbox owner)
     */
    public void exitSandboxMode(UUID clinicId, UUID userId) {
        log.info("User {} exiting sandbox mode for clinic: {}", userId, clinicId);

        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        // Validate: must be sandbox and user must own it
        if (!clinic.getIsSandbox()) {
            throw new BadRequestException("This clinic is not a sandbox");
        }

        if (clinic.getSandboxOwner() == null || !clinic.getSandboxOwner().getUserId().equals(userId)) {
            throw new ForbiddenException("You don't have permission to exit this sandbox");
        }

        // Delete clinic (CASCADE will remove all related data: bookings, services, shifts, etc.)
        clinicRepository.delete(clinic);
        log.info("Sandbox clinic deleted successfully: {}", clinicId);
    }

    /**
     * Get current active sandbox for user (if any)
     */
    public ClinicResponse getCurrentSandbox(UUID userId) {
        return clinicRepository.findFirstByIsSandboxTrueAndSandboxOwnerUserIdOrderByCreatedAtDesc(userId)
                .map(this::mapToResponse)
                .orElse(null);
    }

    /**
     * Cleanup expired sandboxes (CRON job)
     * Deletes sandboxes older than 24 hours
     */
    public void cleanupExpiredSandboxes() {
        log.info("Running scheduled sandbox cleanup task");

        LocalDateTime cutoffTime = LocalDateTime.now().minusHours(SANDBOX_EXPIRY_HOURS);

        List<Clinic> expiredSandboxes = clinicRepository.findExpiredSandboxes(cutoffTime);
        log.info("Found {} expired sandboxes to clean up", expiredSandboxes.size());

        for (Clinic clinic : expiredSandboxes) {
            try {
                clinicRepository.delete(clinic);
                log.info("Cleaned up expired sandbox clinic: {} (ID: {})", clinic.getName(), clinic.getClinicId());
            } catch (Exception e) {
                log.error("Error cleaning up sandbox clinic: {}", clinic.getClinicId(), e);
            }
        }

        log.info("Sandbox cleanup completed");
    }

    /**
     * Validate feature name
     */
    private boolean isValidFeature(String featureName) {
        return featureName.matches("^(clinic_info|services|clinic_services|master_services|scheduling|bookings)$");
    }

        private ClinicResponse mapToResponse(Clinic clinic) {
        ClinicResponse.OwnerInfo ownerInfo = clinic.getOwner() == null ? null : ClinicResponse.OwnerInfo.builder()
            .userId(clinic.getOwner().getUserId())
            .fullName(clinic.getOwner().getFullName())
            .email(clinic.getOwner().getEmail())
            .build();

        List<String> imageUrls = clinic.getImages() == null ? List.of() : clinic.getImages().stream()
            .map(ClinicImage::getImageUrl)
            .toList();

        List<ClinicResponse.ImageInfo> imageDetails = clinic.getImages() == null ? List.of() : clinic.getImages().stream()
            .map(img -> ClinicResponse.ImageInfo.builder()
                .imageId(img.getImageId())
                .clinicId(clinic.getClinicId())
                .imageUrl(img.getImageUrl())
                .caption(img.getCaption())
                .displayOrder(img.getDisplayOrder())
                .isPrimary(img.getIsPrimary())
                .build())
            .toList();

        return ClinicResponse.builder()
            .clinicId(clinic.getClinicId())
            .owner(ownerInfo)
            .name(clinic.getName())
            .description(clinic.getDescription())
            .address(clinic.getAddress())
            .ward(clinic.getWard())
            .district(clinic.getDistrict())
            .province(clinic.getProvince())
            .specificLocation(clinic.getSpecificLocation())
            .phone(clinic.getPhone())
            .email(clinic.getEmail())
            .bankName(clinic.getBankName())
            .accountNumber(clinic.getAccountNumber())
            .latitude(clinic.getLatitude())
            .longitude(clinic.getLongitude())
            .logo(clinic.getLogo())
            .businessLicenseUrl(clinic.getBusinessLicenseUrl())
            .operatingHours(clinic.getOperatingHours())
            .status(clinic.getStatus())
            .rejectionReason(clinic.getRejectionReason())
            .ratingAvg(clinic.getRatingAvg())
            .ratingCount(clinic.getRatingCount())
            .approvedAt(clinic.getApprovedAt())
            .strikeUntil(clinic.getStrikeUntil())
            .images(imageUrls)
            .imageDetails(imageDetails)
            .createdAt(clinic.getCreatedAt())
            .updatedAt(clinic.getUpdatedAt())
            .build();
        }
}
