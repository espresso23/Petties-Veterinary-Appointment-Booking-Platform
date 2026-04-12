package com.petties.petties.controller;

import com.petties.petties.dto.ai.booking.AiBookingContextRequest;
import com.petties.petties.dto.ai.booking.AiBookingContextResponse;
import com.petties.petties.dto.ai.booking.AiBookingDraftRequest;
import com.petties.petties.dto.ai.booking.AiBookingDraftResponse;
import com.petties.petties.dto.ai.booking.AiClinicOptionsRequest;
import com.petties.petties.dto.ai.booking.AiClinicOptionsResponse;
import com.petties.petties.dto.ai.booking.AiCreateBookingRequest;
import com.petties.petties.dto.ai.booking.AiCreateBookingResponse;
import com.petties.petties.dto.ai.booking.AiSlotOptionsRequest;
import com.petties.petties.dto.ai.booking.AiSlotOptionsResponse;
import com.petties.petties.service.AiToolBookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI-first booking orchestration endpoints.
 * Base path: /api/ai-tools/booking
 */
@RestController
@RequestMapping("/ai-tools/booking")
@RequiredArgsConstructor
public class AiToolBookingController {

    private final AiToolBookingService aiToolBookingService;

    /**
     * Resolve booking context from the whole conversation transcript and the latest user message.
     */
    @PostMapping("/context")
    public ResponseEntity<AiBookingContextResponse> resolveContext(@Valid @RequestBody AiBookingContextRequest request) {
        return ResponseEntity.ok(aiToolBookingService.resolveContext(request));
    }

    /**
     * Return clinic options tailored for the current booking context.
     */
    @PostMapping("/clinic-options")
    public ResponseEntity<AiClinicOptionsResponse> getClinicOptions(@Valid @RequestBody AiClinicOptionsRequest request) {
        return ResponseEntity.ok(aiToolBookingService.getClinicOptions(request));
    }

    /**
     * Return recommended and alternative slots for the selected clinic and services.
     */
    @PostMapping("/slot-options")
    public ResponseEntity<AiSlotOptionsResponse> getSlotOptions(@Valid @RequestBody AiSlotOptionsRequest request) {
        return ResponseEntity.ok(aiToolBookingService.getSlotOptions(request));
    }

    /**
     * Build booking summary and draft payload before user confirmation.
     */
    @PostMapping("/draft")
    public ResponseEntity<AiBookingDraftResponse> buildDraft(@Valid @RequestBody AiBookingDraftRequest request) {
        return ResponseEntity.ok(aiToolBookingService.buildDraft(request));
    }

    /**
     * Create the booking request after the user has confirmed the summary.
     */
    @PostMapping("/create")
    public ResponseEntity<AiCreateBookingResponse> createBooking(@Valid @RequestBody AiCreateBookingRequest request) {
        return ResponseEntity.ok(aiToolBookingService.createBooking(request));
    }
}
