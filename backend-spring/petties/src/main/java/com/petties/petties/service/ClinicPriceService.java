package com.petties.petties.service;

import com.petties.petties.model.ClinicPricePerKm;
import com.petties.petties.repository.ClinicPricePerKmRepository;
import com.petties.petties.repository.ClinicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ClinicPriceService {

    private final ClinicPricePerKmRepository repository;
    private final ClinicRepository clinicRepository;

    public Optional<BigDecimal> getPricePerKm(UUID clinicId) {
        return repository.findByClinicId(clinicId).map(ClinicPricePerKm::getPricePerKm);
    }

    @Transactional
    public BigDecimal upsertPricePerKm(UUID clinicId, BigDecimal pricePerKm) {
        // ensure clinic exists
        var clinicOpt = clinicRepository.findByIdAndNotDeleted(clinicId);
        if (clinicOpt.isEmpty()) throw new IllegalArgumentException("Clinic not found: " + clinicId);
        if (pricePerKm == null) {
            // remove existing record if any
            repository.findByClinicId(clinicId).ifPresent(repository::delete);
            return null;
        }

        ClinicPricePerKm entity = repository.findByClinicId(clinicId)
                .orElseGet(() -> {
                    ClinicPricePerKm cp = new ClinicPricePerKm();
                    // Do not set clinicId manually. With @MapsId, setting the clinic is enough
                    // Setting clinicId before persisting can mark the entity as detached and
                    // cause Hibernate to attempt a merge on a detached instance.
                    cp.setClinic(clinicOpt.get());
                    return cp;
                });

        entity.setPricePerKm(pricePerKm);
        repository.save(entity);
        return entity.getPricePerKm();
    }
}
