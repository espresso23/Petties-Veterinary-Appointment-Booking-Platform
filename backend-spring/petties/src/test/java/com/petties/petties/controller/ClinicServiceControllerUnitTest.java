package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.clinicService.ClinicServiceRequest;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.dto.clinicService.ClinicServiceUpdateRequest;
import com.petties.petties.dto.clinicService.WeightPriceDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.ClinicServiceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for ClinicServiceController using @WebMvcTest and MockMvc.
 * Follows CONTROLLER_TESTING_GUIDE.md standards (Flat structure).
 */
@WebMvcTest(ClinicServiceController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicServiceController Unit Tests")
class ClinicServiceControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private ClinicServiceService clinicServiceService;

        // Security mocks required for WebMvcTest when JwtAuthenticationFilter is
        // present
        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;
        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;
        @MockitoBean
        private UserDetailsServiceImpl userDetailsService;
        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        @Autowired
        private ObjectMapper objectMapper;

        private UUID testServiceId;
        private UUID testClinicId;
        private ClinicServiceRequest testServiceRequest;
        private ClinicServiceResponse testServiceResponse;

        @BeforeEach
        void setUp() {
                testServiceId = UUID.randomUUID();
                testClinicId = UUID.randomUUID();

                List<WeightPriceDto> weightPrices = Arrays.asList(
                                WeightPriceDto.builder()
                                                .minWeight(new BigDecimal("0.0"))
                                                .maxWeight(new BigDecimal("5.0"))
                                                .price(new BigDecimal("100000.0"))
                                                .build(),
                                WeightPriceDto.builder()
                                                .minWeight(new BigDecimal("5.0"))
                                                .maxWeight(new BigDecimal("10.0"))
                                                .price(new BigDecimal("150000.0"))
                                                .build());

                testServiceRequest = new ClinicServiceRequest();
                testServiceRequest.setName("Khám tổng quát");
                testServiceRequest.setBasePrice(new BigDecimal("200000.0"));
                testServiceRequest.setDurationTime(30);
                testServiceRequest.setSlotsRequired(1);
                testServiceRequest.setIsActive(true);
                testServiceRequest.setIsHomeVisit(false);
                testServiceRequest.setPricePerKm(new BigDecimal("10000.0"));
                testServiceRequest.setServiceCategory("Khám bệnh");
                testServiceRequest.setPetType("Chó");
                testServiceRequest.setWeightPrices(weightPrices);

                testServiceResponse = ClinicServiceResponse.builder()
                                .serviceId(testServiceId)
                                .clinicId(testClinicId)
                                .name("Khám tổng quát")
                                .basePrice(new BigDecimal("200000.0"))
                                .durationTime(30)
                                .slotsRequired(1)
                                .isActive(true)
                                .isHomeVisit(false)
                                .pricePerKm(new BigDecimal("10000.0"))
                                .serviceCategory("Khám bệnh")
                                .petType("Chó")
                                .weightPrices(weightPrices)
                                .build();
        }

        // ==================== CREATE SERVICE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-SERVICE-001: Success - create service")
        void createService_validRequest_returns201() throws Exception {
                when(clinicServiceService.createService(any(ClinicServiceRequest.class)))
                                .thenReturn(testServiceResponse);

                mockMvc.perform(post("/services")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(testServiceRequest)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.serviceId").exists())
                                .andExpect(jsonPath("$.name").value(containsString("Khám")));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-002: Fail - validation error")
        void createService_invalidRequest_returns400() throws Exception {
                ClinicServiceRequest invalidRequest = new ClinicServiceRequest();
                mockMvc.perform(post("/services")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("Validation Failed"));
        }

        // ==================== LIST SERVICE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-SERVICE-016: Success - list all services")
        void getAllServices_returns200() throws Exception {
                when(clinicServiceService.getAllServices()).thenReturn(List.of(testServiceResponse));

                mockMvc.perform(get("/services"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isArray())
                                .andExpect(jsonPath("$[0].name").value(containsString("Khám")));
        }

        // ==================== GET BY ID TESTS ====================

        @Test
        @DisplayName("TC-UNIT-SERVICE-019: Success - get service detail")
        void getServiceById_validId_returns200() throws Exception {
                when(clinicServiceService.getServiceById(testServiceId)).thenReturn(testServiceResponse);

                mockMvc.perform(get("/services/{serviceId}", testServiceId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.serviceId").value(testServiceId.toString()));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-020: Fail - not found")
        void getServiceById_notFound_returns404() throws Exception {
                when(clinicServiceService.getServiceById(testServiceId))
                                .thenThrow(new ResourceNotFoundException("Service not found"));

                mockMvc.perform(get("/services/{serviceId}", testServiceId))
                                .andExpect(status().isNotFound());
        }

        // ==================== UPDATE SERVICE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-SERVICE-023: Success - update service detail")
        void updateService_validRequest_returns200() throws Exception {
                ClinicServiceUpdateRequest updateRequest = new ClinicServiceUpdateRequest();
                updateRequest.setName("Updated Name");
                updateRequest.setBasePrice(new BigDecimal("250000.0"));

                testServiceResponse.setName("Updated Name");
                testServiceResponse.setBasePrice(new BigDecimal("250000.0"));

                when(clinicServiceService.updateService(eq(testServiceId), any(ClinicServiceUpdateRequest.class)))
                                .thenReturn(testServiceResponse);

                mockMvc.perform(put("/services/{serviceId}", testServiceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(updateRequest)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.name").value("Updated Name"))
                                .andExpect(jsonPath("$.basePrice").value(250000.0));
        }

        // ==================== PATCH & DELETE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-SERVICE-033: Success - update isActive status")
        void updateServiceStatus_valid_returns200() throws Exception {
                testServiceResponse.setIsActive(false);
                when(clinicServiceService.updateServiceStatus(testServiceId, false))
                                .thenReturn(testServiceResponse);

                mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                                .param("isActive", "false"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.isActive").value(false));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-029: Success - delete service")
        void deleteService_validId_returns204() throws Exception {
                doNothing().when(clinicServiceService).deleteService(testServiceId);

                mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                                .andExpect(status().isNoContent());
        }
}
