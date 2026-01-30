package com.petties.petties.controller;

import com.petties.petties.dto.emr.CreateEmrRequest;
import com.petties.petties.dto.emr.EmrResponse;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.CloudinaryService;
import com.petties.petties.service.EmrService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * EMR Controller - REST API for Electronic Medical Records
 */
@RestController
@RequestMapping("/emr")
@RequiredArgsConstructor
@Slf4j
public class EmrController {

    private final EmrService emrService;
    private final AuthService authService;
    private final CloudinaryService cloudinaryService;

    @jakarta.annotation.PostConstruct
    public void init() {
        log.info("EMR Controller initialized and mapped to /emr");
    }

    /**
     * Create a new EMR record (Vet only)
     */
    @PostMapping
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<EmrResponse> createEmr(@Valid @RequestBody CreateEmrRequest request) {
        User currentUser = authService.getCurrentUser();
        log.info("Vet {} creating EMR for pet {}", currentUser.getUserId(), request.getPetId());
        EmrResponse response = emrService.createEmr(request, currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    /**
     * Update EMR record (Vet only)
     */
    @PutMapping("/{emrId}")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<EmrResponse> updateEmr(
            @PathVariable String emrId,
            @Valid @RequestBody CreateEmrRequest request) {
        User currentUser = authService.getCurrentUser();
        log.info("Vet {} updating EMR {}", currentUser.getUserId(), emrId);
        EmrResponse response = emrService.updateEmr(emrId, request, currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    /**
     * Upload ảnh lâm sàng cho EMR (Vet only)
     * Trả về URL ảnh để frontend thêm vào danh sách images khi tạo EMR
     */
    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<UploadResponse> uploadEmrImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "description", required = false) String description) {
        log.info("Uploading EMR image, size: {} bytes", file.getSize());
        UploadResponse response = cloudinaryService.uploadEmrImage(file);
        return ResponseEntity.ok(response);
    }

    /**
     * Get EMR by ID
     */
    @GetMapping("/{emrId}")
    @PreAuthorize("hasAnyRole('STAFF', 'PET_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<EmrResponse> getEmrById(@PathVariable String emrId) {
        EmrResponse response = emrService.getEmrById(emrId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all EMR records for a pet (medical history)
     */
    @GetMapping("/pet/{petId}")
    @PreAuthorize("hasAnyRole('STAFF', 'PET_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<List<EmrResponse>> getEmrsByPetId(@PathVariable UUID petId) {
        List<EmrResponse> responses = emrService.getEmrsByPetId(petId);
        return ResponseEntity.ok(responses);
    }

    /**
     * Get EMR by booking ID
     */
    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("hasAnyRole('STAFF', 'PET_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<EmrResponse> getEmrByBookingId(@PathVariable UUID bookingId) {
        EmrResponse response = emrService.getEmrByBookingId(bookingId);
        return ResponseEntity.ok(response);
    }
}
