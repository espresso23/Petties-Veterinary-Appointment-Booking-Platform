package com.petties.petties.service;

import com.petties.petties.dto.ai.booking.AiBookingDraftRequest;
import com.petties.petties.dto.ai.booking.AiBookingDraftResponse;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiBookingDraftAssembler {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    public AiBookingDraftResponse buildDraftResponse(
            AiBookingDraftRequest request,
            Pet pet,
            Clinic clinic,
            List<String> serviceNames,
            BigDecimal estimatedTotal,
            int totalDurationMinutes) {
        LocalTime endTime = request.getStartTime() != null
                ? request.getStartTime().plusMinutes(Math.max(totalDurationMinutes, 30))
                : null;

        Map<String, Object> draftPayload = new LinkedHashMap<>();
        putIfPresent(draftPayload, "petId", stringifyUuid(request.getPetId()));
        putIfPresent(draftPayload, "clinicId", stringifyUuid(request.getClinicId()));
        putIfPresent(draftPayload, "bookingDate", request.getBookingDate() != null ? request.getBookingDate().toString() : null);
        putIfPresent(draftPayload, "bookingTime", formatTime(request.getStartTime()));
        putIfPresent(draftPayload, "type", request.getBookingType() != null ? request.getBookingType().name() : null);
        draftPayload.put("serviceIds", request.getServiceIds() == null
                ? List.of()
                : request.getServiceIds().stream().map(this::stringifyUuid).toList());
        putIfPresent(draftPayload, "notes", request.getNotes());
        putIfPresent(draftPayload, "homeAddress", request.getHomeAddress());
        putIfPresent(draftPayload, "homeLat", request.getHomeLat());
        putIfPresent(draftPayload, "homeLong", request.getHomeLong());
        putIfPresent(draftPayload, "distanceKm", request.getDistanceKm());

        return AiBookingDraftResponse.builder()
                .bookingSummary(AiBookingDraftResponse.BookingSummary.builder()
                        .petName(pet.getName())
                        .clinicName(clinic.getName())
                        .services(serviceNames)
                        .bookingDate(request.getBookingDate() != null ? request.getBookingDate().toString() : null)
                        .startTime(formatTime(request.getStartTime()))
                        .endTime(formatTime(endTime))
                        .bookingType(request.getBookingType())
                        .estimatedTotal(estimatedTotal)
                        .homeAddress(request.getHomeAddress())
                        .managerWillConfirm(true)
                        .note("Clinic Manager sẽ xác nhận thời gian cuối cùng.")
                        .build())
                .draftPayload(draftPayload)
                .readyToConfirm(true)
                .build();
    }

    private void putIfPresent(Map<String, Object> payload, String key, Object value) {
        if (value != null) {
            payload.put(key, value);
        }
    }

    private String formatTime(LocalTime value) {
        return value == null ? null : value.format(TIME_FORMATTER);
    }

    private String stringifyUuid(UUID value) {
        return value == null ? null : value.toString();
    }
}
