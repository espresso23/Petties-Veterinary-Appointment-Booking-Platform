package com.petties.petties.service;

import com.petties.petties.dto.clinicService.ClinicServiceRequest;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.dto.clinicService.ClinicServiceUpdateRequest;
import com.petties.petties.dto.clinicService.WeightPriceDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.MasterService;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicServiceRepository;
import com.petties.petties.repository.MasterServiceRepository;
import com.petties.petties.util.SpeciesUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClinicServiceService {

    private final ClinicServiceRepository clinicServiceRepository;
    private final ClinicRepository clinicRepository;
    private final AuthService authService;
    private final MasterServiceRepository masterServiceRepository;
    private final com.petties.petties.repository.VaccineTemplateRepository vaccineTemplateRepository;

    private static final int MINUTES_PER_SLOT = 30;

    /**
     * Get current authenticated user
     */
    private User getCurrentUser() {
        return authService.getCurrentUser();
    }

    /**
     * Helper to find service by ID and validate that current user owns its clinic
     */
    private ClinicService getServiceAndValidateOwnership(UUID serviceId) {
        ClinicService service = clinicServiceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        User currentUser = getCurrentUser();

        // Ownership check:
        // 1. User is the Owner of the clinic
        boolean isOwner = service.getClinic().getOwner() != null
                && service.getClinic().getOwner().getUserId().equals(currentUser.getUserId());

        // 2. User is Staff/Manager of this clinic
        boolean isStaffOfClinic = (currentUser.getRole() == Role.STAFF || currentUser.getRole() == Role.CLINIC_MANAGER)
                && currentUser.getWorkingClinic() != null
                && currentUser.getWorkingClinic().getClinicId().equals(service.getClinic().getClinicId());

        if (!isOwner && !isStaffOfClinic) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên dịch vụ này");
        }
        return service;
    }

    /**
     * Validate that current user is CLINIC_OWNER and get their clinic
     */
    private Clinic getCurrentUserClinic() {
        User currentUser = getCurrentUser();

        // If Owner: get their primary clinic
        if (currentUser.getRole() == Role.CLINIC_OWNER) {
            return clinicRepository.findFirstByOwnerUserId(currentUser.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Không tìm thấy clinic cho user này. Vui lòng tạo clinic trước."));
        }

        // If Staff/Manager: get their working clinic
        if ((currentUser.getRole() == Role.STAFF || currentUser.getRole() == Role.CLINIC_MANAGER)
                && currentUser.getWorkingClinic() != null) {
            return currentUser.getWorkingClinic();
        }

        throw new ForbiddenException("Chỉ Clinic Owner hoặc nhân viên phòng khám mới có quyền thực hiện thao tác này");
    }

    private void validateClinicModificationPermission(Clinic clinic) {
        User currentUser = getCurrentUser();
        boolean isOwner = clinic.getOwner() != null && clinic.getOwner().getUserId().equals(currentUser.getUserId());
        boolean isManager = currentUser.getRole() == Role.CLINIC_MANAGER && currentUser.getWorkingClinic() != null
                && currentUser.getWorkingClinic().getClinicId().equals(clinic.getClinicId());

        if (!isOwner && !isManager) {
            throw new ForbiddenException("Bạn không có quyền thêm dịch vụ cho clinic này");
        }
    }

    private void applyCreateFields(ClinicService service, ClinicServiceRequest request) {
        service.setName(request.getName());
        service.setDescription(request.getDescription());
        service.setBasePrice(request.getBasePrice());
        service.setSlotsRequired(request.getSlotsRequired());
        service.setDurationTime(calculateDurationTime(request.getSlotsRequired()));
        service.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        service.setIsHomeVisit(request.getIsHomeVisit() != null ? request.getIsHomeVisit() : false);
        service.setServiceCategory(request.getServiceCategory());
        service.setPetType(request.getPetType());
        service.setReminderInterval(request.getReminderInterval());
        service.setReminderUnit(request.getReminderUnit());
        assignVaccineTemplate(service, request.getVaccineTemplateId());
        syncWeightPrices(service, request.getWeightPrices());
        syncDosePrices(service, request.getDosePrices());
    }

    private void applyUpdateFields(ClinicService service, ClinicServiceUpdateRequest request) {
        if (request.getName() != null) {
            service.setName(request.getName());
        }
        if (request.getDescription() != null) {
            service.setDescription(request.getDescription());
        }
        if (request.getBasePrice() != null) {
            service.setBasePrice(request.getBasePrice());
        }
        if (request.getSlotsRequired() != null) {
            service.setSlotsRequired(request.getSlotsRequired());
            service.setDurationTime(calculateDurationTime(request.getSlotsRequired()));
        }
        if (request.getIsActive() != null) {
            service.setIsActive(request.getIsActive());
        }
        if (request.getIsHomeVisit() != null) {
            service.setIsHomeVisit(request.getIsHomeVisit());
        }
        if (request.getServiceCategory() != null) {
            service.setServiceCategory(request.getServiceCategory());
        }
        if (request.getPetType() != null) {
            service.setPetType(request.getPetType());
        }
        if (request.getReminderInterval() != null) {
            service.setReminderInterval(request.getReminderInterval());
        }
        if (request.getReminderUnit() != null) {
            service.setReminderUnit(request.getReminderUnit());
        }
        if (request.getWeightPrices() != null) {
            syncWeightPrices(service, request.getWeightPrices());
        }
        if (request.getVaccineTemplateId() != null) {
            assignVaccineTemplate(service, request.getVaccineTemplateId());
        }
        if (request.getDosePrices() != null) {
            syncDosePrices(service, request.getDosePrices());
        }
    }

    private int calculateDurationTime(Integer slotsRequired) {
        return slotsRequired * MINUTES_PER_SLOT;
    }

    private void assignVaccineTemplate(ClinicService service, UUID vaccineTemplateId) {
        if (vaccineTemplateId == null) {
            service.setVaccineTemplate(null);
            return;
        }

        com.petties.petties.model.VaccineTemplate template = vaccineTemplateRepository
                .findById(vaccineTemplateId)
                .orElse(null);
        service.setVaccineTemplate(template);
    }

    private void syncWeightPrices(ClinicService service, List<WeightPriceDto> weightPrices) {
        service.getWeightPrices().clear();

        if (weightPrices == null || weightPrices.isEmpty()) {
            return;
        }

        weightPrices.stream()
                .map(dto -> toWeightPriceEntity(service, dto))
                .forEach(service.getWeightPrices()::add);
    }

    private ServiceWeightPrice toWeightPriceEntity(ClinicService service, WeightPriceDto dto) {
        ServiceWeightPrice weightPrice = new ServiceWeightPrice();
        weightPrice.setService(service);
        weightPrice.setMinWeight(dto.getMinWeight());
        weightPrice.setMaxWeight(dto.getMaxWeight());
        weightPrice.setPrice(dto.getPrice());
        return weightPrice;
    }

    private void syncDosePrices(ClinicService service,
            List<com.petties.petties.dto.clinicService.VaccineDosePriceDTO> dosePrices) {
        service.getDosePrices().clear();

        if (dosePrices == null || dosePrices.isEmpty()) {
            return;
        }

        dosePrices.stream()
                .map(dto -> toDosePriceEntity(service, dto))
                .forEach(service.getDosePrices()::add);
    }

    private com.petties.petties.model.VaccineDosePrice toDosePriceEntity(ClinicService service,
            com.petties.petties.dto.clinicService.VaccineDosePriceDTO dto) {
        com.petties.petties.model.VaccineDosePrice dosePrice = new com.petties.petties.model.VaccineDosePrice();
        dosePrice.setService(service);
        dosePrice.setDoseNumber(dto.doseNumber());
        dosePrice.setDoseLabel(dto.doseLabel());
        dosePrice.setPrice(dto.price() != null ? dto.price() : BigDecimal.ZERO);
        dosePrice.setIsActive(dto.isActive() != null ? dto.isActive() : true);
        return dosePrice;
    }

    private List<WeightPriceDto> mapWeightPrices(List<ServiceWeightPrice> weightPrices) {
        return weightPrices == null ? Collections.emptyList() : weightPrices.stream()
                .map(wp -> WeightPriceDto.builder()
                        .minWeight(wp.getMinWeight())
                        .maxWeight(wp.getMaxWeight())
                        .price(wp.getPrice())
                        .build())
                .collect(Collectors.toList());
    }

    private void copyWeightPricesFromMasterService(ClinicService clinicService, MasterService masterService) {
        if (masterService.getWeightPrices() == null || masterService.getWeightPrices().isEmpty()) {
            return;
        }

        masterService.getWeightPrices().stream()
                .map(masterWeightPrice -> {
                    ServiceWeightPrice clinicWeightPrice = new ServiceWeightPrice();
                    clinicWeightPrice.setService(clinicService);
                    clinicWeightPrice.setMinWeight(masterWeightPrice.getMinWeight());
                    clinicWeightPrice.setMaxWeight(masterWeightPrice.getMaxWeight());
                    clinicWeightPrice.setPrice(masterWeightPrice.getPrice());
                    return clinicWeightPrice;
                })
                .forEach(clinicService.getWeightPrices()::add);
    }

    /**
     * Create a new service for the clinic
     */
    @Transactional
    public ClinicServiceResponse createService(ClinicServiceRequest request) {
        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy clinic với ID: " + request.getClinicId()));

        validateClinicModificationPermission(clinic);

        ClinicService service = new ClinicService();
        service.setClinic(clinic);
        applyCreateFields(service, request);

        ClinicService savedService = clinicServiceRepository.save(service);
        log.info("Service created: {} by user: {} for clinic: {}",
                savedService.getServiceId(), getCurrentUser().getUserId(), clinic.getClinicId());

        return mapToResponse(savedService);
    }

    /**
     * Get all services for the clinic
     */
    @Transactional(readOnly = true)
    public List<ClinicServiceResponse> getAllServices() {
        Clinic clinic = getCurrentUserClinic();
        List<ClinicService> services = clinicServiceRepository.findByClinic(clinic);
        return services.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get a service by ID
     */
    @Transactional(readOnly = true)
    public ClinicServiceResponse getServiceById(UUID serviceId) {
        return mapToResponse(getServiceAndValidateOwnership(serviceId));
    }

    /**
     * Update a service
     */
    @Transactional
    public ClinicServiceResponse updateService(UUID serviceId, ClinicServiceUpdateRequest request) {
        ClinicService service = getServiceAndValidateOwnership(serviceId);

        applyUpdateFields(service, request);

        ClinicService updatedService = clinicServiceRepository.save(service);
        log.info("Service updated: {} by user: {}", updatedService.getServiceId(), getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Delete a service (hard delete currently)
     */
    @Transactional
    public void deleteService(UUID serviceId) {
        deleteService(serviceId, null);
    }

    @Transactional
    public void deleteService(UUID serviceId, UUID clinicId) {
        Clinic clinic;

        if (clinicId != null) {
            clinic = clinicRepository.findById(clinicId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy clinic với ID: " + clinicId));

            // Validate user has permission for this clinic
            User currentUser = getCurrentUser();
            if (clinic.getOwner() == null || !clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền xóa dịch vụ cho clinic này");
            }
        } else {
            clinic = getCurrentUserClinic();
        }

        ClinicService service = clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        clinicServiceRepository.delete(service);
        log.info("Service deleted: {} by user: {}", serviceId, getCurrentUser().getUserId());
    }

    /**
     * Update service active status
     */
    @Transactional
    public ClinicServiceResponse updateServiceStatus(UUID serviceId, Boolean isActive) {
        ClinicService service = getServiceAndValidateOwnership(serviceId);

        service.setIsActive(isActive);
        ClinicService updatedService = clinicServiceRepository.save(service);
        log.info("Service status updated: {} to {} by user: {}",
                serviceId, isActive, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Update home visit status
     */
    @Transactional
    public ClinicServiceResponse updateHomeVisitStatus(UUID serviceId, Boolean isHomeVisit) {
        ClinicService service = getServiceAndValidateOwnership(serviceId);

        service.setIsHomeVisit(isHomeVisit);
        ClinicService updatedService = clinicServiceRepository.save(service);
        log.info("Service home visit status updated: {} to {} by user: {}",
                serviceId, isHomeVisit, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    @Transactional
    public ClinicServiceResponse inheritFromMasterService(UUID masterServiceId, UUID clinicId, BigDecimal clinicPrice,
            BigDecimal clinicPricePerKm) {
        log.info("Starting inherit master service {} to clinic {} with price {}", masterServiceId, clinicId,
                clinicPrice);

        // Lấy master service
        MasterService masterService = masterServiceRepository.findById(masterServiceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy dịch vụ mẫu với ID: " + masterServiceId));

        // Lấy clinic - nếu clinicId được cung cấp, dùng đó; ngược lại dùng clinic của
        // current user
        Clinic clinic;
        if (clinicId != null) {
            clinic = clinicRepository.findById(clinicId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy clinic với ID: " + clinicId));

            // Validate user có quyền thao tác với clinic này
            User currentUser = getCurrentUser();
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền thêm dịch vụ cho clinic này");
            }

            // NOTE: Cho phép thêm dịch vụ cho clinic PENDING để Clinic Owner có thể chuẩn
            // bị trước khi được duyệt
            log.info("Found clinic: {} with status: {}", clinic.getClinicId(), clinic.getStatus());
        } else {
            clinic = getCurrentUserClinic();
        }

        // Kiểm tra xem clinic service đã tồn tại chưa (để tránh duplicate)
        boolean exists = clinicServiceRepository.existsByClinicAndMasterService(clinic, masterService);
        if (exists) {
            throw new BadRequestException("Dịch vụ mẫu này đã được áp dụng cho phòng khám này rồi");
        }

        // Tạo clinic service mới từ master service
        ClinicService clinicService = new ClinicService();
        clinicService.setClinic(clinic);
        clinicService.setMasterService(masterService);
        clinicService.setIsCustom(false); // Inherited
        clinicService.setName(masterService.getName());
        clinicService.setDescription(masterService.getDescription());

        // Sử dụng giá clinic nếu được cung cấp, ngược lại dùng giá mặc định từ master
        clinicService.setBasePrice(clinicPrice != null ? clinicPrice : masterService.getDefaultPrice());

        clinicService.setDurationTime(masterService.getDurationTime());
        clinicService.setSlotsRequired(masterService.getSlotsRequired());
        clinicService.setIsActive(true); // Mặc định active khi inherit
        clinicService.setIsHomeVisit(masterService.getIsHomeVisit());
        // pricePerKm is now managed at clinic level via ClinicPriceService
        // Convert string to enum for serviceCategory
        if (masterService.getServiceCategory() != null) {
            try {
                clinicService.setServiceCategory(
                        com.petties.petties.model.enums.ServiceCategory.valueOf(masterService.getServiceCategory()));
            } catch (IllegalArgumentException e) {
                log.warn("Unknown service category from master: {}", masterService.getServiceCategory());
            }
        }
        clinicService.setPetType(masterService.getPetType());

        // Sửa: Copy weightPrices từ master service sang clinic service, set đúng quan
        // hệ JPA
        copyWeightPricesFromMasterService(clinicService, masterService);

        log.info("Saving clinic service for clinic {} and master {}", clinic.getClinicId(),
                masterService.getMasterServiceId());
        ClinicService savedService = clinicServiceRepository.save(clinicService);
        log.info("Saved clinic service with ID: {}", savedService.getServiceId());

        log.info("Inherited service from master {} to clinic {} by user: {}",
                masterServiceId, clinic.getClinicId(), getCurrentUser().getUserId());

        return mapToResponse(savedService);
    }

    /**
     * PUBLIC: Get all ACTIVE services for a specific clinic
     * Pet Owner cần xem services để đặt lịch
     * Chỉ trả về services đang active
     */
    @Transactional(readOnly = true)
    public List<ClinicServiceResponse> getPublicServicesByClinicId(UUID clinicId) {
        // Verify clinic exists
        if (!clinicRepository.existsById(clinicId)) {
            throw new ResourceNotFoundException("Không tìm thấy clinic với ID: " + clinicId);
        }

        // Only return active services for public view
        List<ClinicService> services = clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId);
        return services.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * PUBLIC: Get services compatible with a specific pet species
     * Filters out vaccines that are not compatible with the pet's species
     *
     * @param clinicId    Clinic ID
     * @param petSpecies  Pet species to filter by (optional, if null returns all)
     * @param isHomeVisit Only return home visit services (optional)
     * @return List of compatible services
     */
    @Transactional(readOnly = true)
    public List<ClinicServiceResponse> getCompatibleServices(UUID clinicId, PetSpecies petSpecies, Boolean isHomeVisit) {
        // Verify clinic exists
        if (!clinicRepository.existsById(clinicId)) {
            throw new ResourceNotFoundException("Không tìm thấy clinic với ID: " + clinicId);
        }

        List<ClinicService> services = clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId);

        return services.stream()
                // Filter by home visit if specified
                .filter(s -> isHomeVisit == null || !isHomeVisit || Boolean.TRUE.equals(s.getIsHomeVisit()))
                // Filter by species compatibility
                .filter(s -> {
                    // If no vaccine template, service is compatible with all species
                    if (s.getVaccineTemplate() == null) {
                        return true;
                    }
                    // If no petSpecies specified, return all services
                    if (petSpecies == null) {
                        return true;
                    }
                    // Check vaccine compatibility
                    return SpeciesUtils.isVaccineCompatible(s.getVaccineTemplate().getTargetSpecies(), petSpecies);
                })
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * INTERNAL: Get all services for a specific clinic (including inactive)
     * Admin hoặc Clinic Owner/Manager có thể xem tất cả services
     */
    @Transactional(readOnly = true)
    public List<ClinicServiceResponse> getServicesByClinicId(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy clinic với ID: " + clinicId));

        // Validate user has permission: owner OR manager of this clinic
        User currentUser = getCurrentUser();
        boolean isOwner = clinic.getOwner() != null && clinic.getOwner().getUserId().equals(currentUser.getUserId());
        boolean isManager = currentUser.getWorkingClinic() != null
                && currentUser.getWorkingClinic().getClinicId().equals(clinicId);
        if (!isOwner && !isManager) {
            throw new ForbiddenException("Bạn không có quyền xem dịch vụ của clinic này");
        }

        List<ClinicService> services = clinicServiceRepository.findByClinic(clinic);
        return services.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Map ClinicService entity to ClinicServiceResponse DTO
     */
    private ClinicServiceResponse mapToResponse(ClinicService service) {
        List<WeightPriceDto> weightPriceDtos = mapWeightPrices(service.getWeightPrices());

        // Map vaccine dose prices
        List<com.petties.petties.dto.clinicService.VaccineDosePriceDTO> dosePriceDtos = service.getDosePrices() != null
                ? service.getDosePrices().stream()
                        .filter(dp -> dp.getIsActive() != null && dp.getIsActive())
                        .map(com.petties.petties.dto.clinicService.VaccineDosePriceDTO::fromEntity)
                        .collect(Collectors.toList())
                : java.util.Collections.emptyList();

        return ClinicServiceResponse.builder()
                .serviceId(service.getServiceId())
                .clinicId(service.getClinic().getClinicId())
                .masterServiceId(
                        service.getMasterService() != null ? service.getMasterService().getMasterServiceId() : null) // NEW
                .isCustom(service.getIsCustom()) // NEW
                .name(service.getName())
                .description(service.getDescription())
                .basePrice(service.getBasePrice())
                .durationTime(service.getDurationTime())
                .slotsRequired(service.getSlotsRequired())
                .isActive(service.getIsActive())
                .isHomeVisit(service.getIsHomeVisit())
                .serviceCategory(service.getServiceCategory())
                .petType(service.getPetType())
                .reminderInterval(service.getReminderInterval())
                .reminderUnit(service.getReminderUnit())
                .weightPrices(weightPriceDtos)
                .vaccineTemplateId(service.getVaccineTemplate() != null ? service.getVaccineTemplate().getId() : null)
                .dosePrices(dosePriceDtos)
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .build();
    }
}