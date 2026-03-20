package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.ai.booking.AiBookingContextRequest;
import com.petties.petties.dto.ai.booking.AiBookingContextResponse;
import com.petties.petties.dto.ai.booking.AiBookingDraftRequest;
import com.petties.petties.dto.ai.booking.AiBookingDraftResponse;
import com.petties.petties.dto.ai.booking.AiClinicOptionsResponse;
import com.petties.petties.dto.ai.booking.AiCreateBookingRequest;
import com.petties.petties.dto.ai.booking.AiCreateBookingResponse;
import com.petties.petties.dto.ai.booking.AiSlotOptionsResponse;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AiToolBookingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AiToolBookingController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AiToolBookingController Unit Tests")
class AiToolBookingControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiToolBookingService aiToolBookingService;

    @MockitoBean private JwtTokenProvider jwtTokenProvider;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean private UserDetailsServiceImpl userDetailsService;
    @MockitoBean private BlacklistedTokenRepository blacklistedTokenRepository;

    @Test
    @DisplayName("Resolve context with transcript and GPS returns 200")
    void resolveContext_validRequest_returns200() throws Exception {
        AiBookingContextResponse response = AiBookingContextResponse.builder()
                .resolvedPet(AiBookingContextResponse.ResolvedPet.builder()
                        .petId(UUID.randomUUID())
                        .name("Hadine")
                        .species(PetSpecies.DOG)
                        .ageYears(2)
                        .weightKg(8.5)
                        .build())
                .resolvedBookingType(BookingType.IN_CLINIC)
                .resolvedLocation(AiBookingContextResponse.ResolvedLocation.builder()
                        .latitude(new BigDecimal("15.9575"))
                        .longitude(new BigDecimal("108.2575"))
                        .address("Ngu Hanh Son, Da Nang")
                        .build())
                .resolvedServiceHint("kham benh")
                .missingFields(List.of())
                .readyForClinicSearch(true)
                .build();

        when(aiToolBookingService.resolveContext(any())).thenReturn(response);

        AiBookingContextRequest request = AiBookingContextRequest.builder()
                .transcript("Toi muon dat lich cho Hadine")
                .latestMessage("Toi o Ngu Hanh Son Da Nang")
                .latitude(new BigDecimal("15.9575"))
                .longitude(new BigDecimal("108.2575"))
                .serviceHint("kham benh")
                .build();

        mockMvc.perform(post("/ai-tools/booking/context")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolvedPet.name").value("Hadine"))
                .andExpect(jsonPath("$.readyForClinicSearch").value(true));
    }

    @Test
    @DisplayName("Build draft missing required fields returns 400")
    void buildDraft_missingRequiredFields_returns400() throws Exception {
        AiBookingDraftRequest request = AiBookingDraftRequest.builder()
                .clinicId(UUID.randomUUID())
                .bookingDate(LocalDate.of(2026, 3, 21))
                .startTime(LocalTime.of(9, 0))
                .serviceIds(List.of(UUID.randomUUID()))
                .build();

        mockMvc.perform(post("/ai-tools/booking/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Create booking after confirmation returns 200")
    void createBooking_confirmedRequest_returns200() throws Exception {
        when(aiToolBookingService.createBooking(any())).thenReturn(
                AiCreateBookingResponse.builder()
                        .bookingId(UUID.randomUUID().toString())
                        .bookingCode("BK-AI-001")
                        .status("PENDING")
                        .petName("Hadine")
                        .clinicName("Benh Vien Thu Y PetCare")
                        .bookingDate("2026-03-21")
                        .bookingTime("09:00")
                        .managerWillConfirm(true)
                        .build());

        AiCreateBookingRequest request = new AiCreateBookingRequest();
        request.setPetId(UUID.randomUUID());
        request.setClinicId(UUID.randomUUID());
        request.setBookingDate(LocalDate.of(2026, 3, 21));
        request.setStartTime(LocalTime.of(9, 0));
        request.setServiceIds(List.of(UUID.randomUUID()));
        request.setBookingType(BookingType.IN_CLINIC);
        request.setConfirmed(true);

        mockMvc.perform(post("/ai-tools/booking/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingCode").value("BK-AI-001"))
                .andExpect(jsonPath("$.managerWillConfirm").value(true));
    }

    @Test
    @DisplayName("Get slot options with valid request returns 200")
    void getSlotOptions_validRequest_returns200() throws Exception {
        when(aiToolBookingService.getSlotOptions(any())).thenReturn(
                AiSlotOptionsResponse.builder()
                        .resolvedServiceNames(List.of("Kham benh"))
                        .recommendedSlots(List.of(
                                AiSlotOptionsResponse.SlotOption.builder()
                                        .startTime("09:00")
                                        .endTime("09:30")
                                        .durationMinutes(30)
                                        .exactRequested(false)
                                        .build()))
                        .alternatives(List.of())
                        .exactMatch(false)
                        .managerConfirmationRequired(true)
                        .totalAvailable(1)
                        .build());

        String payload = objectMapper.writeValueAsString(Map.of(
                "clinicId", UUID.randomUUID(),
                "bookingDate", "2026-03-21",
                "serviceHint", "kham benh",
                "petHint", "Hadine"
        ));

        mockMvc.perform(post("/ai-tools/booking/slot-options")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendedSlots[0].startTime").value("09:00"));
    }

    @Test
    @DisplayName("Get clinic options returns matched clinic cards")
    void getClinicOptions_validRequest_returns200() throws Exception {
        when(aiToolBookingService.getClinicOptions(any())).thenReturn(
                AiClinicOptionsResponse.builder()
                        .totalFound(1)
                        .clinics(List.of(
                                AiClinicOptionsResponse.ClinicOption.builder()
                                        .clinicId(UUID.randomUUID())
                                        .clinicName("Benh Vien Thu Y PetCare")
                                        .address("FPT Complex Da Nang")
                                        .distanceKm(0.2)
                                        .reasonMatched("Phong kham gan vi tri hien tai cua ban")
                                        .build()))
                        .build());

        String payload = objectMapper.writeValueAsString(Map.of(
                "latitude", 15.9575,
                "longitude", 108.2575,
                "serviceHint", "kham benh"
        ));

        mockMvc.perform(post("/ai-tools/booking/clinic-options")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalFound").value(1))
                .andExpect(jsonPath("$.clinics[0].clinicName").value("Benh Vien Thu Y PetCare"));
    }
}
