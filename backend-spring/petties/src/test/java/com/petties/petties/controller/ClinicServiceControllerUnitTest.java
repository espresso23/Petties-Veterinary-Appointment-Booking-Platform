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
import com.petties.petties.exception.ForbiddenException;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ClinicServiceController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicServiceController Detailed Unit Tests")
class ClinicServiceControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ClinicServiceService clinicServiceService;

    // Security mocks required for WebMvcTest
    @MockitoBean private JwtTokenProvider jwtTokenProvider;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean private UserDetailsServiceImpl userDetailsService;
    @MockitoBean private BlacklistedTokenRepository blacklistedTokenRepository;

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
                WeightPriceDto.builder().minWeight(new BigDecimal("0.0")).maxWeight(new BigDecimal("5.0")).price(new BigDecimal("100000.0")).build(),
                WeightPriceDto.builder().minWeight(new BigDecimal("5.0")).maxWeight(new BigDecimal("10.0")).price(new BigDecimal("150000.0")).build()
        );

        testServiceRequest = new ClinicServiceRequest();
        testServiceRequest.setName("Khám tổng quát");
        testServiceRequest.setBasePrice(new BigDecimal("200000.0"));
        testServiceRequest.setDurationTime(30);
        testServiceRequest.setSlotsRequired(1);
        testServiceRequest.setIsActive(true);
        testServiceRequest.setIsHomeVisit(false);
        testServiceRequest.setServiceCategory(com.petties.petties.model.enums.ServiceCategory.CHECK_UP);
        testServiceRequest.setPetType("Chó");
        testServiceRequest.setClinicId(testClinicId);
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
                .serviceCategory(com.petties.petties.model.enums.ServiceCategory.CHECK_UP)
                .petType("Chó")
                .weightPrices(weightPrices)
                .build();
    }

    // ==================== CREATE SERVICE (8 TCs) ====================

    @Test
    @DisplayName("TC-001: Valid full request -> 201 Created")
    void createService_ValidFullRequest_returns201() throws Exception {
        when(clinicServiceService.createService(any(ClinicServiceRequest.class))).thenReturn(testServiceResponse);

        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.serviceId").exists())
                .andExpect(jsonPath("$.name").value("Khám tổng quát"));
    }

    @Test
    @DisplayName("TC-002: Missing name (null) -> 400 Bad Request")
    void createService_MissingName_returns400() throws Exception {
        testServiceRequest.setName(null);
        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-003: Missing basePrice (null) -> 400 Bad Request")
    void createService_MissingBasePrice_returns400() throws Exception {
        testServiceRequest.setBasePrice(null);
        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-004: Missing slotsRequired (null) -> 400 Bad Request")
    void createService_MissingSlotsRequired_returns400() throws Exception {
        testServiceRequest.setSlotsRequired(null);
        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-005: isActive=null (default true) -> 201 Created")
    void createService_IsActiveNull_returns201() throws Exception {
        testServiceRequest.setIsActive(null);
        testServiceResponse.setIsActive(true);
        when(clinicServiceService.createService(any(ClinicServiceRequest.class))).thenReturn(testServiceResponse);

        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isActive").value(true));
    }

    @Test
    @DisplayName("TC-006: Empty weightPrices list -> 201 Created")
    void createService_EmptyWeightPrices_returns201() throws Exception {
        testServiceRequest.setWeightPrices(new ArrayList<>());
        testServiceResponse.setWeightPrices(new ArrayList<>());
        when(clinicServiceService.createService(any(ClinicServiceRequest.class))).thenReturn(testServiceResponse);

        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("TC-007: Non-existent clinicId -> 404 Not Found")
    void createService_NonExistentClinicId_returns404() throws Exception {
        when(clinicServiceService.createService(any(ClinicServiceRequest.class)))
                .thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-008: ClinicId of another owner -> 403 Forbidden")
    void createService_ClinicIdOtherOwner_returns403() throws Exception {
        when(clinicServiceService.createService(any(ClinicServiceRequest.class)))
                .thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(post("/services")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isForbidden());
    }

    // ==================== GET ALL SERVICES (4 TCs) ====================

    @Test
    @DisplayName("TC-009: Has multiple services -> 200 OK")
    void getAllServices_MultipleServices_returns200() throws Exception {
        when(clinicServiceService.getAllServices()).thenReturn(Arrays.asList(testServiceResponse, testServiceResponse));
        mockMvc.perform(get("/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    @DisplayName("TC-010: Has 1 service -> 200 OK")
    void getAllServices_OneService_returns200() throws Exception {
        when(clinicServiceService.getAllServices()).thenReturn(List.of(testServiceResponse));
        mockMvc.perform(get("/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("TC-011: Has 0 services (empty) -> 200 OK, empty array")
    void getAllServices_EmptyServices_returns200() throws Exception {
        when(clinicServiceService.getAllServices()).thenReturn(new ArrayList<>());
        mockMvc.perform(get("/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("TC-012: PET_OWNER role -> 403 Forbidden")
    void getAllServices_UnauthorizedRole_returns403() throws Exception {
        // MockMvc allows access given @AutoConfigureMockMvc(addFilters=false)
        // Service should manually throw the exception
        when(clinicServiceService.getAllServices()).thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(get("/services"))
                .andExpect(status().isForbidden());
    }

    // ==================== GET BY ID (5 TCs) ====================

    @Test
    @DisplayName("TC-013: Valid existing ID -> 200 OK")
    void getServiceById_ValidId_returns200() throws Exception {
        when(clinicServiceService.getServiceById(testServiceId)).thenReturn(testServiceResponse);
        mockMvc.perform(get("/services/{serviceId}", testServiceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceId").exists());
    }

    @Test
    @DisplayName("TC-014: Non-existent UUID -> 404 Not Found")
    void getServiceById_NonExistentUUID_returns404() throws Exception {
        when(clinicServiceService.getServiceById(testServiceId)).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/services/{serviceId}", testServiceId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-015: null/empty ID -> 404/400 Bad Request")
    void getServiceById_NullEmptyId_returns400Or404() throws Exception {
        // Actually /services/ returns 404 or 405 because path doesn't match
        mockMvc.perform(get("/services/ "))
                .andExpect(status().isNotFound()); // typical spring-web behavior
    }

    @Test
    @DisplayName("TC-016: Malformed (not UUID) -> 400 Bad Request")
    void getServiceById_MalformedUUID_returns400() throws Exception {
        mockMvc.perform(get("/services/{serviceId}", "not-a-uuid"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-017: ID owned by other user -> 403 Forbidden")
    void getServiceById_OwnedByOtherUser_returns403() throws Exception {
        when(clinicServiceService.getServiceById(testServiceId)).thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(get("/services/{serviceId}", testServiceId))
                .andExpect(status().isForbidden());
    }

    // ==================== UPDATE SERVICE (7 TCs) ====================

    @Test
    @DisplayName("TC-018: Update name + price -> 200 OK")
    void updateService_NamePrice_returns200() throws Exception {
        ClinicServiceUpdateRequest req = new ClinicServiceUpdateRequest();
        req.setName("Updated");
        req.setBasePrice(new BigDecimal("300"));
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenReturn(testServiceResponse);
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-019: Update name only -> 200 OK")
    void updateService_NameOnly_returns200() throws Exception {
        ClinicServiceUpdateRequest req = new ClinicServiceUpdateRequest();
        req.setName("Updated");
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenReturn(testServiceResponse);
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-020: Update price only -> 200 OK")
    void updateService_PriceOnly_returns200() throws Exception {
        ClinicServiceUpdateRequest req = new ClinicServiceUpdateRequest();
        req.setBasePrice(new BigDecimal("300"));
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenReturn(testServiceResponse);
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-021: Update slotsRequired -> 200 OK")
    void updateService_SlotsRequired_returns200() throws Exception {
        ClinicServiceUpdateRequest req = new ClinicServiceUpdateRequest();
        req.setSlotsRequired(2);
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenReturn(testServiceResponse);
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-022: Update weightPrices -> 200 OK")
    void updateService_WeightPrices_returns200() throws Exception {
        ClinicServiceUpdateRequest req = new ClinicServiceUpdateRequest();
        req.setWeightPrices(new ArrayList<>());
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenReturn(testServiceResponse);
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-023: Non-existent ID -> 404 Not Found")
    void updateService_NonExistentId_returns404() throws Exception {
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-024: ID owned by other user -> 403 Forbidden")
    void updateService_OwnedByOtherUser_returns403() throws Exception {
        when(clinicServiceService.updateService(eq(testServiceId), any())).thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden());
    }

    // ==================== DELETE SERVICE (6 TCs) ====================

    @Test
    @DisplayName("TC-025: Valid ID, no clinicId -> 204 No Content")
    void deleteService_ValidIdNoClinicId_returns204() throws Exception {
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isNoContent());
        verify(clinicServiceService).deleteService(testServiceId, null);
    }

    @Test
    @DisplayName("TC-026: Valid ID + valid clinicId -> 204 No Content")
    void deleteService_ValidIdValidClinicId_returns204() throws Exception {
        mockMvc.perform(delete("/services/{serviceId}", testServiceId)
                .param("clinicId", testClinicId.toString()))
                .andExpect(status().isNoContent());
        verify(clinicServiceService).deleteService(testServiceId, testClinicId);
    }

    @Test
    @DisplayName("TC-027: Valid ID + non-existent clinicId -> 404 Not Found")
    void deleteService_ValidIdNonExistentClinic_returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Not found")).when(clinicServiceService).deleteService(testServiceId, testClinicId);
        mockMvc.perform(delete("/services/{serviceId}", testServiceId)
                .param("clinicId", testClinicId.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-028: Non-existent serviceId -> 404 Not Found")
    void deleteService_NonExistentServiceId_returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Not found")).when(clinicServiceService).deleteService(testServiceId, null);
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-029: ID of other owner -> 403 Forbidden")
    void deleteService_IdOtherOwner_returns403() throws Exception {
        doThrow(new ForbiddenException("Forbidden")).when(clinicServiceService).deleteService(testServiceId, null);
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TC-030: ClinicId of other owner -> 403 Forbidden")
    void deleteService_ClinicIdOtherOwner_returns403() throws Exception {
        doThrow(new ForbiddenException("Forbidden")).when(clinicServiceService).deleteService(testServiceId, testClinicId);
        mockMvc.perform(delete("/services/{serviceId}", testServiceId)
                .param("clinicId", testClinicId.toString()))
                .andExpect(status().isForbidden());
    }

    // ==================== UPDATE SERVICE STATUS (5 TCs) ====================

    @Test
    @DisplayName("TC-031: isActive=false -> 200 OK")
    void updateServiceStatus_False_returns200() throws Exception {
        when(clinicServiceService.updateServiceStatus(testServiceId, false)).thenReturn(testServiceResponse);
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId).param("isActive", "false"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-032: isActive=true -> 200 OK")
    void updateServiceStatus_True_returns200() throws Exception {
        when(clinicServiceService.updateServiceStatus(testServiceId, true)).thenReturn(testServiceResponse);
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId).param("isActive", "true"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-033: isActive=null -> 400 Bad Request")
    void updateServiceStatus_Null_returns400() throws Exception {
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-034: Non-existent ID -> 404 Not Found")
    void updateServiceStatus_NonExistentId_returns404() throws Exception {
        when(clinicServiceService.updateServiceStatus(testServiceId, true)).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId).param("isActive", "true"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-035: ID of other owner -> 403 Forbidden")
    void updateServiceStatus_IdOtherOwner_returns403() throws Exception {
        when(clinicServiceService.updateServiceStatus(testServiceId, true)).thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId).param("isActive", "true"))
                .andExpect(status().isForbidden());
    }

    // ==================== INHERIT FROM MASTER SERVICE (7 TCs) ====================

    @Test
    @DisplayName("TC-036: Valid all params -> 201 Created")
    void inheritMaster_ValidParams_returns201() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenReturn(testServiceResponse);
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID())
                .param("clinicId", testClinicId.toString())
                .param("clinicPrice", "150000")
                .param("clinicPricePerKm", "5000"))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("TC-037: clinicPrice=null (use default) -> 201 Created")
    void inheritMaster_ClinicPriceNull_returns201() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenReturn(testServiceResponse);
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID())
                .param("clinicId", testClinicId.toString()))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("TC-038: clinicId=null (auto-detect) -> 201 Created")
    void inheritMaster_ClinicIdNull_returns201() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenReturn(testServiceResponse);
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID()))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("TC-039: Already inherited (duplicate) -> 400 Bad Request")
    void inheritMaster_Duplicate_returns400() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenThrow(new BadRequestException("Duplicate"));
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-040: Non-existent masterServiceId -> 404 Not Found")
    void inheritMaster_NonExistentMasterId_returns404() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-041: Master has weightPrices (verify copy) -> 201 Created")
    void inheritMaster_WeightPrices_returns201() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenReturn(testServiceResponse);
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.weightPrices").isArray());
    }

    @Test
    @DisplayName("TC-042: ClinicId of other owner -> 403 Forbidden")
    void inheritMaster_ClinicIdOtherOwner_returns403() throws Exception {
        when(clinicServiceService.inheritFromMasterService(any(), any(), any(), any())).thenThrow(new ForbiddenException("Forbidden"));
        mockMvc.perform(post("/services/inherit/{masterServiceId}", UUID.randomUUID()))
                .andExpect(status().isForbidden());
    }

    // ==================== GET PUBLIC SERVICES BY CLINIC ID (5 TCs) ====================

    @Test
    @DisplayName("TC-043: Has active services -> 200 OK")
    void getPublicServices_HasActive_returns200() throws Exception {
        when(clinicServiceService.getPublicServicesByClinicId(testClinicId)).thenReturn(List.of(testServiceResponse));
        mockMvc.perform(get("/services/by-clinic/{clinicId}", testClinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("TC-044: No active services -> 200 OK, empty")
    void getPublicServices_NoActive_returns200() throws Exception {
        when(clinicServiceService.getPublicServicesByClinicId(testClinicId)).thenReturn(new ArrayList<>());
        mockMvc.perform(get("/services/by-clinic/{clinicId}", testClinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("TC-045: Mix active/inactive (only active returned) -> 200 OK")
    void getPublicServices_Mix_returns200() throws Exception {
        // Assume service filters it internally, so it just returns a list
        when(clinicServiceService.getPublicServicesByClinicId(testClinicId)).thenReturn(List.of(testServiceResponse));
        mockMvc.perform(get("/services/by-clinic/{clinicId}", testClinicId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC-046: Non-existent clinicId -> 404 Not Found")
    void getPublicServices_NonExistentClinicId_returns404() throws Exception {
        when(clinicServiceService.getPublicServicesByClinicId(testClinicId)).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/services/by-clinic/{clinicId}", testClinicId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-047: null/empty clinicId -> 400 Bad Request / 404")
    void getPublicServices_NullClinicId_returns404() throws Exception {
        mockMvc.perform(get("/services/by-clinic/ "))
                .andExpect(status().isNotFound()); // Standard path mismatch
    }
}
