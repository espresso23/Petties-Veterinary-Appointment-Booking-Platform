package com.petties.petties.service;

import com.petties.petties.dto.clinicService.ClinicServiceRequest;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.dto.clinicService.ClinicServiceUpdateRequest;
import com.petties.petties.dto.clinicService.WeightPriceDto;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicServiceRepository;
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

    /**
     * Get current authenticated user
     */
    private User getCurrentUser() {
        return authService.getCurrentUser();
    }

    /**
     * Validate that current user is CLINIC_OWNER and get their clinic
     */
    private Clinic getCurrentUserClinic() {
        User currentUser = getCurrentUser();
        if (currentUser.getRole() != Role.CLINIC_OWNER) {
            throw new ForbiddenException("Chỉ Clinic Owner mới có quyền thực hiện thao tác này");
        }

        return clinicRepository.findByOwnerUserId(currentUser.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy clinic cho user này. Vui lòng tạo clinic trước."));
    }

    /**
     * Create a new service for the clinic
     */
    @Transactional
    public ClinicServiceResponse createService(ClinicServiceRequest request) {
        Clinic clinic = getCurrentUserClinic();

        ClinicService service = new ClinicService();
        service.setClinic(clinic);
        service.setName(request.getName());
        service.setBasePrice(request.getBasePrice());
        service.setSlotsRequired(request.getSlotsRequired());
        // Auto-calculate durationTime: 1 slot = 30 minutes
        service.setDurationTime(request.getSlotsRequired() * 30);
        service.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        service.setIsHomeVisit(request.getIsHomeVisit() != null ? request.getIsHomeVisit() : false);

        // Auto-set pricePerKm for home visit services
        if (service.getIsHomeVisit()) {
            // If request has pricePerKm > 0, use it; otherwise use common price
            if (request.getPricePerKm() != null && request.getPricePerKm().compareTo(BigDecimal.ZERO) > 0) {
                service.setPricePerKm(request.getPricePerKm());
            } else {
                service.setPricePerKm(getCommonPricePerKm(clinic));
            }
        } else {
            service.setPricePerKm(BigDecimal.ZERO);
        }

        service.setServiceCategory(request.getServiceCategory());
        service.setPetType(request.getPetType());

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
                savedService.getServiceId(), getCurrentUser().getUserId(), clinic.getId());

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
        Clinic clinic = getCurrentUserClinic();
        ClinicService service = clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));
        return mapToResponse(service);
    }

    /**
     * Update a service
     */
    @Transactional
    public ClinicServiceResponse updateService(UUID serviceId, ClinicServiceUpdateRequest request) {
        Clinic clinic = getCurrentUserClinic();

        ClinicService service = clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        if (request.getName() != null) {
            service.setName(request.getName());
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
        if (request.getPricePerKm() != null) {
            service.setPricePerKm(request.getPricePerKm());
        }
        if (request.getServiceCategory() != null) {
            service.setServiceCategory(request.getServiceCategory());
        }
        if (request.getPetType() != null) {
            service.setPetType(request.getPetType());
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
        Clinic clinic = getCurrentUserClinic();

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
        Clinic clinic = getCurrentUserClinic();

        ClinicService service = clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

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
        Clinic clinic = getCurrentUserClinic();

        ClinicService service = clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        service.setIsHomeVisit(isHomeVisit);
        ClinicService updatedService = clinicServiceRepository.save(service);
        log.info("Service home visit status updated: {} to {} by user: {}",
                serviceId, isHomeVisit, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Update price per km
     */
    @Transactional
    public ClinicServiceResponse updatePricePerKm(UUID serviceId, BigDecimal pricePerKm) {
        Clinic clinic = getCurrentUserClinic();

        ClinicService service = clinicServiceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        service.setPricePerKm(pricePerKm);
        ClinicService updatedService = clinicServiceRepository.save(service);
        log.info("Service price per km updated: {} to {} by user: {}",
                serviceId, pricePerKm, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Update price per km for all home visit services
     */
    @Transactional
    public void updateBulkPricePerKm(BigDecimal pricePerKm) {
        Clinic clinic = getCurrentUserClinic();

        List<ClinicService> homeVisitServices = clinicServiceRepository
                .findByClinicAndIsHomeVisit(clinic, true);

        for (ClinicService service : homeVisitServices) {
            service.setPricePerKm(pricePerKm);
        }

        clinicServiceRepository.saveAll(homeVisitServices);

        log.info("Bulk updated price per km for {} home visit services. New price: {} by user: {}",
                homeVisitServices.size(), pricePerKm, getCurrentUser().getUserId());
    }

    /**
     * Get common price per km from existing home visit services
     * Returns the first found pricePerKm > 0, or default 5000 VND if none exists
     */
    private BigDecimal getCommonPricePerKm(Clinic clinic) {
        return clinicServiceRepository.findByClinicAndIsHomeVisit(clinic, true)
                .stream()
                .filter(s -> s.getPricePerKm() != null && s.getPricePerKm().compareTo(BigDecimal.ZERO) > 0)
                .findFirst()
                .map(ClinicService::getPricePerKm)
                .orElse(BigDecimal.valueOf(5000)); // Default 5000 VND
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
                .clinicId(service.getClinic().getId())
                .name(service.getName())
                .basePrice(service.getBasePrice())
                .durationTime(service.getDurationTime())
                .slotsRequired(service.getSlotsRequired())
                .isActive(service.getIsActive())
                .isHomeVisit(service.getIsHomeVisit())
                .pricePerKm(service.getPricePerKm())
                .serviceCategory(service.getServiceCategory())
                .petType(service.getPetType())
                .weightPrices(weightPriceDtos)
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .build();
    }
}