package com.petties.petties.service;

import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.repository.VaccineTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VaccineTemplateService {

    private final VaccineTemplateRepository vaccineTemplateRepository;

    public List<VaccineTemplate> getAllTemplates() {
        try {
            return vaccineTemplateRepository.findAll();
        } catch (Exception e) {
            System.err.println("Error fetching vaccine templates: " + e.getMessage());
            e.printStackTrace();
            return List.of();
        }
    }

    public VaccineTemplate getTemplateById(UUID id) {
        return vaccineTemplateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vaccine Template not found"));
    }

    public VaccineTemplate createTemplate(VaccineTemplate template) {
        return vaccineTemplateRepository.save(template);
    }
}
