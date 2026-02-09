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
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicServiceRepository;
import com.petties.petties.repository.MasterServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
        // Strictly for the Owner of the clinic associated with the service
        if (service.getClinic().getOwner() == null
                || !service.getClinic().getOwner().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên dịch vụ này");
        }
        return service;
    }

    /**
     * Validate that current user is CLINIC_OWNER and get their clinic
     */
    private Clinic getCurrentUserClinic() {
        User currentUser = getCurrentUser();
        if (currentUser.getRole() != Role.CLINIC_OWNER) {
            throw new ForbiddenException("Chỉ Clinic Owner mới có quyền thực hiện thao tác này");
        }

        return clinicRepository.findFirstByOwnerUserId(currentUser.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy clinic cho user này. Vui lòng tạo clinic trước."));
    }

    /**
     * Create a new service for the clinic
     */
    @Transactional
    public ClinicServiceResponse createService(ClinicServiceRequest request) {
        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy clinic với ID: " + request.getClinicId()));

        // Validate ownership
        User currentUser = getCurrentUser();
        if (clinic.getOwner() == null || !clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thêm dịch vụ cho clinic này");
        }

        ClinicService service = new ClinicService();
        service.setClinic(clinic);
        service.setName(request.getName());
        service.setDescription(request.getDescription());
        service.setBasePrice(request.getBasePrice());
        service.setSlotsRequired(request.getSlotsRequired());
        // Auto-calculate durationTime: 1 slot = 30 minutes
        service.setDurationTime(request.getSlotsRequired() * 30);
        service.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        service.setIsHomeVisit(request.getIsHomeVisit() != null ? request.getIsHomeVisit() : false);

        service.setServiceCategory(request.getServiceCategory());
        service.setPetType(request.getPetType());

        // Handle reminder schedule
        service.setReminderInterval(request.getReminderInterval());
        service.setReminderUnit(request.getReminderUnit());

        // Handle weight prices
        if (request.getWeightPrices() != null && !request.getWeightPrices().isEmpty()) {
            for (WeightPriceDto dto : request.getWeightPrices()) {
                ServiceWeightPrice weightPrice = new ServiceWeightPrice();
                weightPrice.setService(service);
                weightPrice.setMinWeight(dto.getMinWeight());
                weightPrice.setMaxWeight(dto.getMaxWeight());
                weightPrice.setPrice(dto.getPrice());
                service.getWeightPrices().add(weightPrice);
            }
        }

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
            // Auto-calculate durationTime: 1 slot = 30 minutes
            service.setDurationTime(request.getSlotsRequired() * 30);
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

        // Handle weight prices update
        if (request.getWeightPrices() != null) {
            // Clear existing weight prices
            service.getWeightPrices().clear();

            // Add new weight prices
            for (WeightPriceDto dto : request.getWeightPrices()) {
                ServiceWeightPrice weightPrice = new ServiceWeightPrice();
                weightPrice.setService(service);
                weightPrice.setMinWeight(dto.getMinWeight());
                weightPrice.setMaxWeight(dto.getMaxWeight());
                weightPrice.setPrice(dto.getPrice());
                service.getWeightPrices().add(weightPrice);
            }
        }

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
        if (masterService.getWeightPrices() != null && !masterService.getWeightPrices().isEmpty()) {
            for (ServiceWeightPrice masterWeightPrice : masterService.getWeightPrices()) {
                ServiceWeightPrice clinicWeightPrice = new ServiceWeightPrice();
                clinicWeightPrice.setService(clinicService); // Liên kết với clinic service
                clinicWeightPrice.setMinWeight(masterWeightPrice.getMinWeight());
                clinicWeightPrice.setMaxWeight(masterWeightPrice.getMaxWeight());
                clinicWeightPrice.setPrice(masterWeightPrice.getPrice());
                // KHÔNG set masterWeightPrice cho clinicWeightPrice
                clinicService.getWeightPrices().add(clinicWeightPrice);
            }
        }

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
        List<WeightPriceDto> weightPriceDtos = service.getWeightPrices().stream()
                .map(wp -> WeightPriceDto.builder()
                        .minWeight(wp.getMinWeight())
                        .maxWeight(wp.getMaxWeight())
                        .price(wp.getPrice())
                        .build())
                .collect(Collectors.toList());

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
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .build();
    }
}