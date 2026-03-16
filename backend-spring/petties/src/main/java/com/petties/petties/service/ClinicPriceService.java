package com.petties.petties.service;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicPricePerKm;
import com.petties.petties.repository.ClinicPricePerKmRepository;
import com.petties.petties.repository.ClinicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicPriceService {

    private final ClinicPricePerKmRepository clinicPriceRepository;
    private final ClinicRepository clinicRepository;

    public Optional<BigDecimal> getPricePerKm(UUID clinicId) {
        return clinicPriceRepository.findById(clinicId)
                .map(ClinicPricePerKm::getPricePerKm);
    }

    public Optional<BigDecimal> getSosFee(UUID clinicId) {
        return clinicPriceRepository.findById(clinicId)
                .map(ClinicPricePerKm::getSosFee);
    }

    public Optional<ClinicPricePerKm> getPricing(UUID clinicId) {
        return clinicPriceRepository.findById(clinicId);
    }

    @Transactional(readOnly = true)
    public java.util.Map<UUID, ClinicPricePerKm> getPricingBatch(java.util.List<UUID> clinicIds) {
        if (clinicIds == null || clinicIds.isEmpty()) return java.util.Collections.emptyMap();
        return clinicPriceRepository.findAllById(clinicIds).stream()
                .collect(java.util.stream.Collectors.toMap(ClinicPricePerKm::getClinicId, p -> p));
    }

    @Transactional
    public ClinicPricePerKm updatePricing(UUID clinicId, BigDecimal pricePerKm, BigDecimal sosFee) {
        log.info("Updating pricing for clinic {}: pricePerKm={}, sosFee={}", clinicId, pricePerKm, sosFee);
        
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng khám: " + clinicId));

        ClinicPricePerKm priceEntity = clinicPriceRepository.findById(clinicId)
                .orElseGet(() -> {
                    ClinicPricePerKm newEntity = new ClinicPricePerKm();
                    newEntity.setClinic(clinic);
                    newEntity.setClinicId(clinicId);
                    return newEntity;
                });

        if (pricePerKm != null) {
            priceEntity.setPricePerKm(pricePerKm);
        }
        if (sosFee != null) {
            priceEntity.setSosFee(sosFee);
        }

        return clinicPriceRepository.save(priceEntity);
    }
}
