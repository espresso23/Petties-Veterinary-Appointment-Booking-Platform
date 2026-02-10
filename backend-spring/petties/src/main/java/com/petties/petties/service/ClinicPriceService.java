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

    @Transactional
    public ClinicPricePerKm updatePricing(UUID clinicId, BigDecimal pricePerKm, BigDecimal sosFee) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new IllegalArgumentException("Clinic not found: " + clinicId));

        ClinicPricePerKm priceEntity = clinicPriceRepository.findById(clinicId)
                .orElseGet(() -> {
                    ClinicPricePerKm newEntity = new ClinicPricePerKm();
                    newEntity.setClinic(clinic);
                    return newEntity;
                });

        if (pricePerKm != null)
            priceEntity.setPricePerKm(pricePerKm);
        if (sosFee != null)
            priceEntity.setSosFee(sosFee);

        return clinicPriceRepository.save(priceEntity);
    }

    @Transactional
    public BigDecimal upsertPricePerKm(UUID clinicId, BigDecimal price) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new IllegalArgumentException("Clinic not found: " + clinicId));

        ClinicPricePerKm priceEntity = clinicPriceRepository.findById(clinicId)
                .orElseGet(() -> {
                    ClinicPricePerKm newEntity = new ClinicPricePerKm();
                    newEntity.setClinic(clinic);
                    return newEntity;
                });
        priceEntity.setPricePerKm(price);
        return clinicPriceRepository.save(priceEntity).getPricePerKm();
    }

    @Transactional
    public BigDecimal upsertSosFee(UUID clinicId, BigDecimal fee) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new IllegalArgumentException("Clinic not found: " + clinicId));

        ClinicPricePerKm priceEntity = clinicPriceRepository.findById(clinicId)
                .orElseGet(() -> {
                    ClinicPricePerKm newEntity = new ClinicPricePerKm();
                    newEntity.setClinic(clinic);
                    return newEntity;
                });
        priceEntity.setSosFee(fee);
        return clinicPriceRepository.save(priceEntity).getSosFee();
    }
}
