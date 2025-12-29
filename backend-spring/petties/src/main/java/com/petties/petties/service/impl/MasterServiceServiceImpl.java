package com.petties.petties.service.impl;

import com.petties.petties.dto.masterService.MasterServiceRequest;
import com.petties.petties.dto.masterService.MasterServiceResponse;
import com.petties.petties.dto.masterService.MasterServiceUpdateRequest;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.MasterService;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.MasterServiceRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.MasterServiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MasterServiceServiceImpl implements MasterServiceService {

    private final MasterServiceRepository masterServiceRepository;
    private final AuthService authService;

    /**
     * Validate that current user is CLINIC_OWNER
     */
    private void validateClinicOwner() {
        User currentUser = authService.getCurrentUser();
        if (currentUser.getRole() != Role.CLINIC_OWNER) {
            throw new ForbiddenException("Chỉ Clinic Owner mới có quyền thực hiện thao tác này");
        }
    }

    @Override
    @Transactional
    public MasterServiceResponse createMasterService(MasterServiceRequest request) {
        validateClinicOwner();


        MasterService masterService = new MasterService();
        masterService.setName(request.getName());
        masterService.setDescription(request.getDescription());
        masterService.setDefaultPrice(request.getDefaultPrice());
        masterService.setDurationTime(request.getDurationTime());
        masterService.setSlotsRequired(request.getSlotsRequired());
        masterService.setIsHomeVisit(request.getIsHomeVisit() != null ? request.getIsHomeVisit() : false);
        masterService.setDefaultPricePerKm(request.getDefaultPricePerKm());
        masterService.setServiceCategory(request.getServiceCategory());
        masterService.setPetType(request.getPetType());
        masterService.setIcon(request.getIcon());

        // Bổ sung: nhận và lưu weightPrices
        if (request.getWeightPrices() != null && !request.getWeightPrices().isEmpty()) {
            for (com.petties.petties.dto.clinicService.WeightPriceDto dto : request.getWeightPrices()) {
                com.petties.petties.model.ServiceWeightPrice weightPrice = new com.petties.petties.model.ServiceWeightPrice();
                weightPrice.setMasterService(masterService);
                weightPrice.setMinWeight(dto.getMinWeight());
                weightPrice.setMaxWeight(dto.getMaxWeight());
                weightPrice.setPrice(dto.getPrice());
                masterService.getWeightPrices().add(weightPrice);
            }
        }

        MasterService savedService = masterServiceRepository.save(masterService);
        log.info("Created master service: {} with ID: {}", savedService.getName(), savedService.getMasterServiceId());

        return convertToResponse(savedService);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MasterServiceResponse> getAllMasterServices() {
        validateClinicOwner();
        List<MasterService> services = masterServiceRepository.findAllWithWeightPrices();
        return services.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public MasterServiceResponse getMasterServiceById(UUID masterServiceId) {
        validateClinicOwner();
        MasterService service = masterServiceRepository.findByIdWithWeightPrices(masterServiceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy dịch vụ mẫu với ID: " + masterServiceId));
        return convertToResponse(service);
    }

    @Override
    @Transactional
    public MasterServiceResponse updateMasterService(UUID masterServiceId, MasterServiceUpdateRequest request) {
        validateClinicOwner();

        MasterService service = masterServiceRepository.findByIdWithWeightPrices(masterServiceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy dịch vụ mẫu với ID: " + masterServiceId));

        // Update only non-null fields
        if (request.getName() != null) {
            service.setName(request.getName());
        }
        if (request.getDescription() != null) {
            service.setDescription(request.getDescription());
        }
        if (request.getDefaultPrice() != null) {
            service.setDefaultPrice(request.getDefaultPrice());
        }
        if (request.getDurationTime() != null) {
            service.setDurationTime(request.getDurationTime());
        }
        if (request.getSlotsRequired() != null) {
            service.setSlotsRequired(request.getSlotsRequired());
        }
        if (request.getIsHomeVisit() != null) {
            service.setIsHomeVisit(request.getIsHomeVisit());
        }
        if (request.getDefaultPricePerKm() != null) {
            service.setDefaultPricePerKm(request.getDefaultPricePerKm());
        }
        if (request.getServiceCategory() != null) {
            service.setServiceCategory(request.getServiceCategory());
        }
        if (request.getPetType() != null) {
            service.setPetType(request.getPetType());
        }
        if (request.getIcon() != null) {
            service.setIcon(request.getIcon());
        }

        // Bổ sung: cập nhật weightPrices nếu có
        if (request.getWeightPrices() != null) {
            service.getWeightPrices().clear();
            for (com.petties.petties.dto.clinicService.WeightPriceDto dto : request.getWeightPrices()) {
                com.petties.petties.model.ServiceWeightPrice weightPrice = new com.petties.petties.model.ServiceWeightPrice();
                weightPrice.setMasterService(service);
                weightPrice.setMinWeight(dto.getMinWeight());
                weightPrice.setMaxWeight(dto.getMaxWeight());
                weightPrice.setPrice(dto.getPrice());
                service.getWeightPrices().add(weightPrice);
            }
        }
        MasterService updatedService = masterServiceRepository.save(service);
        log.info("Updated master service ID: {}", masterServiceId);

        return convertToResponse(updatedService);
    }

    @Override
    @Transactional
    public void deleteMasterService(UUID masterServiceId) {
        validateClinicOwner();

        // Không cần JOIN FETCH cho delete, chỉ cần ID
        MasterService service = masterServiceRepository.findById(masterServiceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy dịch vụ mẫu với ID: " + masterServiceId));

        masterServiceRepository.delete(service);
        log.info("Deleted master service ID: {}", masterServiceId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MasterServiceResponse> searchMasterServicesByName(String name) {
        validateClinicOwner();
        // findByNameContainingIgnoreCase đã có JOIN FETCH trong repository
        List<MasterService> services = masterServiceRepository.findByNameContainingIgnoreCase(name);
        return services.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<MasterServiceResponse> getMasterServicesByCategory(String category) {
        validateClinicOwner();
        // findByServiceCategory đã có JOIN FETCH trong repository
        List<MasterService> services = masterServiceRepository.findByServiceCategory(category);
        return services.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<MasterServiceResponse> getMasterServicesByPetType(String petType) {
        validateClinicOwner();
        // findByPetType đã có JOIN FETCH trong repository
        List<MasterService> services = masterServiceRepository.findByPetType(petType);
        return services.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Convert MasterService entity to MasterServiceResponse DTO
     */
    private MasterServiceResponse convertToResponse(MasterService service) {
        MasterServiceResponse response = new MasterServiceResponse();
        response.setMasterServiceId(service.getMasterServiceId());
        response.setName(service.getName());
        response.setDescription(service.getDescription());
        response.setDefaultPrice(service.getDefaultPrice());
        response.setDurationTime(service.getDurationTime());
        response.setSlotsRequired(service.getSlotsRequired());
        response.setIsHomeVisit(service.getIsHomeVisit());
        response.setDefaultPricePerKm(service.getDefaultPricePerKm());
        response.setServiceCategory(service.getServiceCategory());
        response.setPetType(service.getPetType());
        response.setIcon(service.getIcon());
        response.setCreatedAt(service.getCreatedAt());
        response.setUpdatedAt(service.getUpdatedAt());
        // Bổ sung: trả về weightPrices
        if (service.getWeightPrices() != null && !service.getWeightPrices().isEmpty()) {
            java.util.List<com.petties.petties.dto.clinicService.WeightPriceDto> weightPriceDtos = service.getWeightPrices().stream()
                .map(wp -> com.petties.petties.dto.clinicService.WeightPriceDto.builder()
                    .minWeight(wp.getMinWeight())
                    .maxWeight(wp.getMaxWeight())
                    .price(wp.getPrice())
                    .build())
                .collect(java.util.stream.Collectors.toList());
            response.setWeightPrices(weightPriceDtos);
        } else {
            response.setWeightPrices(new java.util.ArrayList<>());
        }
        return response;
    }
}
