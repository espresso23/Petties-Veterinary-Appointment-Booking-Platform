package com.petties.petties.service;

import com.petties.petties.dto.clinicService.VaccineDosePriceDTO;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.User;
import com.petties.petties.model.VaccineDosePrice;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.repository.ClinicServiceRepository;
import com.petties.petties.repository.VaccineDosePriceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service quản lý giá vắc-xin theo mũi tiêm
 * Clinic Owner cấu hình giá, Staff chọn khi tiêm
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VaccineDosePriceService {

    private final VaccineDosePriceRepository dosePriceRepository;
    private final ClinicServiceRepository clinicServiceRepository;
    private final AuthService authService;

    /**
     * Lấy tất cả giá theo mũi của một dịch vụ vắc-xin
     */
    @Transactional(readOnly = true)
    public List<VaccineDosePriceDTO> getDosePrices(UUID serviceId) {
        // Validate service exists
        if (!clinicServiceRepository.existsById(serviceId)) {
            throw new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId);
        }
        return dosePriceRepository.findByServiceServiceIdAndIsActiveTrue(serviceId)
                .stream()
                .map(VaccineDosePriceDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Lấy giá cụ thể theo số mũi
     */
    @Transactional(readOnly = true)
    public VaccineDosePriceDTO getDosePrice(UUID serviceId, Integer doseNumber) {
        return dosePriceRepository.findByServiceServiceIdAndDoseNumber(serviceId, doseNumber)
                .map(VaccineDosePriceDTO::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy giá cho mũi " + doseNumber + " của dịch vụ này"));
    }

    /**
     * Lấy giá (BigDecimal) để sử dụng trong PricingService
     */
    @Transactional(readOnly = true)
    public BigDecimal getDosePriceAmount(UUID serviceId, Integer doseNumber) {
        return dosePriceRepository.findByServiceServiceIdAndDoseNumber(serviceId, doseNumber)
                .filter(dp -> dp.getIsActive())
                .map(VaccineDosePrice::getPrice)
                .orElse(null);
    }

    /**
     * Thêm hoặc cập nhật giá cho một mũi tiêm
     * Chỉ Clinic Owner có quyền
     */
    @Transactional
    public VaccineDosePriceDTO setDosePrice(UUID serviceId, Integer doseNumber, String doseLabel, BigDecimal price) {
        ClinicService service = validateOwnershipAndGetService(serviceId);

        // Validate dịch vụ là loại VACCINATION
        if (service.getServiceCategory() != ServiceCategory.VACCINATION) {
            throw new BadRequestException("Chỉ dịch vụ tiêm chủng mới có thể cấu hình giá theo mũi");
        }

        VaccineDosePrice dosePrice = dosePriceRepository
                .findByServiceServiceIdAndDoseNumber(serviceId, doseNumber)
                .orElse(null);

        if (dosePrice == null) {
            // Create new
            dosePrice = new VaccineDosePrice();
            dosePrice.setService(service);
            dosePrice.setDoseNumber(doseNumber);
        }

        dosePrice.setDoseLabel(doseLabel != null ? doseLabel : getDefaultDoseLabel(doseNumber));
        dosePrice.setPrice(price);
        dosePrice.setIsActive(true);

        VaccineDosePrice saved = dosePriceRepository.save(dosePrice);
        log.info("Set dose price for service {} dose {} = {} by user {}",
                serviceId, doseNumber, price, authService.getCurrentUser().getUserId());

        return VaccineDosePriceDTO.fromEntity(saved);
    }

    /**
     * Cập nhật nhiều giá cùng lúc
     */
    @Transactional
    public List<VaccineDosePriceDTO> setDosePrices(UUID serviceId, List<VaccineDosePriceRequest> requests) {
        ClinicService service = validateOwnershipAndGetService(serviceId);

        if (service.getServiceCategory() != ServiceCategory.VACCINATION) {
            throw new BadRequestException("Chỉ dịch vụ tiêm chủng mới có thể cấu hình giá theo mũi");
        }

        return requests.stream()
                .map(req -> setDosePrice(serviceId, req.doseNumber(), req.doseLabel(), req.price()))
                .collect(Collectors.toList());
    }

    /**
     * Xóa giá của một mũi (soft delete - set isActive = false)
     */
    @Transactional
    public void deleteDosePrice(UUID serviceId, Integer doseNumber) {
        validateOwnershipAndGetService(serviceId);

        VaccineDosePrice dosePrice = dosePriceRepository
                .findByServiceServiceIdAndDoseNumber(serviceId, doseNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy giá cho mũi " + doseNumber));

        dosePrice.setIsActive(false);
        dosePriceRepository.save(dosePrice);
        log.info("Deleted dose price for service {} dose {} by user {}",
                serviceId, doseNumber, authService.getCurrentUser().getUserId());
    }

    // ===== Helper methods =====

    private ClinicService getServiceById(UUID serviceId) {
        return clinicServiceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + serviceId));
    }

    private ClinicService validateOwnershipAndGetService(UUID serviceId) {
        ClinicService service = getServiceById(serviceId);
        User currentUser = authService.getCurrentUser();

        if (service.getClinic().getOwner() == null ||
                !service.getClinic().getOwner().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền cấu hình giá cho dịch vụ này");
        }
        return service;
    }

    private String getDefaultDoseLabel(Integer doseNumber) {
        return switch (doseNumber) {
            case 1 -> "Mũi 1";
            case 2 -> "Mũi 2";
            case 3 -> "Mũi 3";
            case 4 -> "Nhắc lại hằng năm";
            default -> "Mũi " + doseNumber;
        };
    }

    // Request record for batch update
    public record VaccineDosePriceRequest(
            Integer doseNumber,
            String doseLabel,
            BigDecimal price) {
    }
}
