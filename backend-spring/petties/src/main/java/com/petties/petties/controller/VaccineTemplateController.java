package com.petties.petties.controller;

import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.service.VaccineTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/vaccine-templates")
@RequiredArgsConstructor
public class VaccineTemplateController {

    private final VaccineTemplateService vaccineTemplateService;

    @GetMapping
    public ResponseEntity<List<VaccineTemplate>> getAllTemplates() {
        try {
            System.out.println("DEBUG: Entering getAllTemplates");
            List<VaccineTemplate> templates = vaccineTemplateService.getAllTemplates();
            System.out.println("DEBUG: Retrieved " + templates.size() + " templates");
            return ResponseEntity.ok(templates);
        } catch (Exception e) {
            System.err.println("DEBUG: Error in getAllTemplates controller: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<VaccineTemplate> getTemplateById(@PathVariable UUID id) {
        return ResponseEntity.ok(vaccineTemplateService.getTemplateById(id));
    }

    // Admin/Internal use only ideally
    @PostMapping
    public ResponseEntity<VaccineTemplate> createTemplate(@RequestBody VaccineTemplate template) {
        return ResponseEntity.ok(vaccineTemplateService.createTemplate(template));
    }
}
