package com.petties.petties.service;

import com.petties.petties.dto.service.ServiceRequest;
import com.petties.petties.dto.service.ServiceResponse;
import com.petties.petties.dto.service.ServiceUpdateRequest;
import com.petties.petties.dto.service.WeightPriceDto;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class ServiceService {

    private final ServiceRepository serviceRepository;
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
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy clinic cho user này. Vui lòng tạo clinic trước."));
    }

    /**
     * Create a new service for the clinic
     */
    @Transactional
    public ServiceResponse createService(ServiceRequest request) {
        Clinic clinic = getCurrentUserClinic();
        
        com.petties.petties.model.Service service = new com.petties.petties.model.Service();
        service.setClinic(clinic);
        service.setName(request.getName());
        service.setBasePrice(request.getBasePrice());
        service.setDurationTime(request.getDurationTime());
        service.setSlotsRequired(request.getSlotsRequired());
        service.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        service.setIsHomeVisit(request.getIsHomeVisit() != null ? request.getIsHomeVisit() : false);
        service.setPricePerKm(request.getPricePerKm());
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

        com.petties.petties.model.Service savedService = serviceRepository.save(service);
        log.info("Service created: {} by user: {} for clinic: {}", 
                savedService.getServiceId(), getCurrentUser().getUserId(), clinic.getId());

        return mapToResponse(savedService);
    }

    /**
     * Get all services for the clinic
     */
    @Transactional(readOnly = true)
    public List<ServiceResponse> getAllServices() {
        Clinic clinic = getCurrentUserClinic();
        List<com.petties.petties.model.Service> services = serviceRepository.findByClinic(clinic);
        return services.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get a service by ID
     */
    @Transactional(readOnly = true)
    public ServiceResponse getServiceById(UUID serviceId) {
        Clinic clinic = getCurrentUserClinic();
        com.petties.petties.model.Service service = serviceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));
        return mapToResponse(service);
    }

    /**
     * Update a service
     */
    @Transactional
    public ServiceResponse updateService(UUID serviceId, ServiceUpdateRequest request) {
        Clinic clinic = getCurrentUserClinic();
        
        com.petties.petties.model.Service service = serviceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        if (request.getName() != null) {
            service.setName(request.getName());
        }
        if (request.getBasePrice() != null) {
            service.setBasePrice(request.getBasePrice());
        }
        if (request.getDurationTime() != null) {
            service.setDurationTime(request.getDurationTime());
        }
        if (request.getSlotsRequired() != null) {
            service.setSlotsRequired(request.getSlotsRequired());
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

        com.petties.petties.model.Service updatedService = serviceRepository.save(service);
        log.info("Service updated: {} by user: {}", updatedService.getServiceId(), getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Delete a service (soft delete)
     */
    @Transactional
    public void deleteService(UUID serviceId) {
        Clinic clinic = getCurrentUserClinic();
        
        com.petties.petties.model.Service service = serviceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        serviceRepository.delete(service);
        log.info("Service deleted: {} by user: {}", serviceId, getCurrentUser().getUserId());
    }

    /**
     * Update service active status
     */
    @Transactional
    public ServiceResponse updateServiceStatus(UUID serviceId, Boolean isActive) {
        Clinic clinic = getCurrentUserClinic();
        
        com.petties.petties.model.Service service = serviceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        service.setIsActive(isActive);
        com.petties.petties.model.Service updatedService = serviceRepository.save(service);
        log.info("Service status updated: {} to {} by user: {}", 
                serviceId, isActive, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Update home visit status
     */
    @Transactional
    public ServiceResponse updateHomeVisitStatus(UUID serviceId, Boolean isHomeVisit) {
        Clinic clinic = getCurrentUserClinic();
        
        com.petties.petties.model.Service service = serviceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        service.setIsHomeVisit(isHomeVisit);
        com.petties.petties.model.Service updatedService = serviceRepository.save(service);
        log.info("Service home visit status updated: {} to {} by user: {}", 
                serviceId, isHomeVisit, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Update price per km
     */
    @Transactional
    public ServiceResponse updatePricePerKm(UUID serviceId, String pricePerKm) {
        Clinic clinic = getCurrentUserClinic();
        
        com.petties.petties.model.Service service = serviceRepository.findByServiceIdAndClinic(serviceId, clinic)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));

        service.setPricePerKm(pricePerKm);
        com.petties.petties.model.Service updatedService = serviceRepository.save(service);
        log.info("Service price per km updated: {} to {} by user: {}", 
                serviceId, pricePerKm, getCurrentUser().getUserId());

        return mapToResponse(updatedService);
    }

    /**
     * Update price per km for all home visit services
     */
    @Transactional
    public void updateBulkPricePerKm(String pricePerKm) {
        Clinic clinic = getCurrentUserClinic();
        
        List<com.petties.petties.model.Service> homeVisitServices = serviceRepository
                .findByClinicAndIsHomeVisit(clinic, true);
        
        for (com.petties.petties.model.Service service : homeVisitServices) {
            service.setPricePerKm(pricePerKm);
        }
        
        serviceRepository.saveAll(homeVisitServices);
        
        log.info("Bulk updated price per km for {} home visit services. New price: {} by user: {}", 
                homeVisitServices.size(), pricePerKm, getCurrentUser().getUserId());
    }

    /**
     * Map Service entity to ServiceResponse DTO
     */
    private ServiceResponse mapToResponse(com.petties.petties.model.Service service) {
        List<WeightPriceDto> weightPriceDtos = service.getWeightPrices().stream()
                .map(wp -> WeightPriceDto.builder()
                        .minWeight(wp.getMinWeight())
                        .maxWeight(wp.getMaxWeight())
                        .price(wp.getPrice())
                        .build())
                .collect(Collectors.toList());
        
        return ServiceResponse.builder()
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