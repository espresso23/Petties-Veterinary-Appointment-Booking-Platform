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
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;

/**
 * Unit tests for ClinicServiceController using @WebMvcTest and MockMvc.
 */
@WebMvcTest(value = ClinicServiceController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicServiceController Unit Tests")
class ClinicServiceControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private ClinicServiceService clinicServiceService;

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

        @Test
        @DisplayName("TC-UNIT-SERVICE-001: Create Service Success")
        void createService_validRequest_returns201() throws Exception {
                when(clinicServiceService.createService(any(ClinicServiceRequest.class)))
                                .thenReturn(testServiceResponse);

                mockMvc.perform(post("/services")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(testServiceRequest)))
                                .andDo(print())
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.serviceId").exists())
                                .andExpect(jsonPath("$.name").value(containsString("Khám")))
                                .andExpect(jsonPath("$.basePrice").value(is(200000.0)))
                                .andExpect(jsonPath("$.durationTime").value(is(30)));

                verify(clinicServiceService).createService(any(ClinicServiceRequest.class));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-016: Get All Services Success")
        void getAllServices_validRequest_returns200() throws Exception {
                List<ClinicServiceResponse> services = Arrays.asList(testServiceResponse);
                when(clinicServiceService.getAllServices()).thenReturn(services);

                mockMvc.perform(get("/services"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isArray())
                                .andExpect(jsonPath("$[0].name").value(containsString("Khám")));

                verify(clinicServiceService).getAllServices();
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-019: Get Service By ID Success")
        void getServiceById_validId_returns200() throws Exception {
                when(clinicServiceService.getServiceById(testServiceId))
                                .thenReturn(testServiceResponse);

                mockMvc.perform(get("/services/{serviceId}", testServiceId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.serviceId").value(is(testServiceId.toString())));

                verify(clinicServiceService).getServiceById(testServiceId);
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-020: Get Service By ID - Not Found")
        void getServiceById_nonExistentId_returns404() throws Exception {
                when(clinicServiceService.getServiceById(testServiceId))
                                .thenThrow(new ResourceNotFoundException("Service not found"));

                mockMvc.perform(get("/services/{serviceId}", testServiceId))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.error").value("Not Found"));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-023: Update Service Success")
        void updateService_validRequest_returns200() throws Exception {
                ClinicServiceUpdateRequest updateRequest = new ClinicServiceUpdateRequest();
                updateRequest.setName("Khám tổng quát cập nhật");
                updateRequest.setBasePrice(new BigDecimal("250000.0"));

                ClinicServiceResponse updatedResponse = ClinicServiceResponse.builder()
                                .serviceId(testServiceId)
                                .name("Khám tổng quát cập nhật")
                                .basePrice(new BigDecimal("250000.0"))
                                .build();

                when(clinicServiceService.updateService(eq(testServiceId), any(ClinicServiceUpdateRequest.class)))
                                .thenReturn(updatedResponse);

                mockMvc.perform(put("/services/{serviceId}", testServiceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(updateRequest)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.name").value(containsString("Khám")))
                                .andExpect(jsonPath("$.basePrice").value(is(250000.0)));

                verify(clinicServiceService).updateService(eq(testServiceId), any(ClinicServiceUpdateRequest.class));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-029: Delete Service Success")
        void deleteService_validId_returns204() throws Exception {
                doNothing().when(clinicServiceService).deleteService(testServiceId);

                mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                                .andExpect(status().isNoContent());

                verify(clinicServiceService).deleteService(testServiceId);
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-033: Update Service Status To Active Success")
        void updateServiceStatus_toActive_returns200() throws Exception {
                ClinicServiceResponse updatedResponse = ClinicServiceResponse.builder()
                                .serviceId(testServiceId)
                                .isActive(true)
                                .build();

                when(clinicServiceService.updateServiceStatus(testServiceId, true))
                                .thenReturn(updatedResponse);

                mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                                .param("isActive", "true"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.isActive").value(true));

                verify(clinicServiceService).updateServiceStatus(testServiceId, true);
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-042: Update Price Per Km Success")
        void updatePricePerKm_valid_returns200() throws Exception {
                BigDecimal newPrice = new BigDecimal("12000.0");
                ClinicServiceResponse updatedResponse = ClinicServiceResponse.builder()
                                .serviceId(testServiceId)
                                .pricePerKm(newPrice)
                                .build();

                when(clinicServiceService.updatePricePerKm(testServiceId, newPrice))
                                .thenReturn(updatedResponse);

                mockMvc.perform(patch("/services/{serviceId}/price-per-km", testServiceId)
                                .param("pricePerKm", "12000.0"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.pricePerKm").value(12000.0));

                verify(clinicServiceService).updatePricePerKm(testServiceId, newPrice);
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-045: Bulk Update Price Per Km Success")
        void updateBulkPricePerKm_valid_returns200() throws Exception {
                BigDecimal newPrice = new BigDecimal("15000.0");
                doNothing().when(clinicServiceService).updateBulkPricePerKm(newPrice);

                mockMvc.perform(patch("/services/bulk/price-per-km")
                                .param("pricePerKm", "15000.0"))
                                .andExpect(status().isOk());

                verify(clinicServiceService).updateBulkPricePerKm(newPrice);
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-002: Create Service - Validation Error")
        void createService_invalidRequest_returns400() throws Exception {
                ClinicServiceRequest invalidRequest = new ClinicServiceRequest();
                // Name is blank, basePrice is null - should trigger validation errors

                mockMvc.perform(post("/services")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("Validation Failed"));
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-024: Update Service - Not Found")
        void updateService_nonExistentId_returns404() throws Exception {
                when(clinicServiceService.updateService(eq(testServiceId), any(ClinicServiceUpdateRequest.class)))
                                .thenThrow(new ResourceNotFoundException("Service not found"));

                ClinicServiceUpdateRequest updateRequest = new ClinicServiceUpdateRequest();
                updateRequest.setName("Updated Name");

                mockMvc.perform(put("/services/{serviceId}", testServiceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(updateRequest)))
                                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("TC-UNIT-SERVICE-034: Update Service Status - Bad Request")
        void updateServiceStatus_invalidRequest_returns400() throws Exception {
                when(clinicServiceService.updateServiceStatus(eq(testServiceId), anyBoolean()))
                                .thenThrow(new BadRequestException("Invalid status transition"));

                mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                                .param("isActive", "true"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("Bad Request"))
                                .andExpect(jsonPath("$.message").value("Invalid status transition"));
        }
}
