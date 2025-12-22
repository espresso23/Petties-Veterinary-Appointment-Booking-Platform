package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.config.JpaConfig;
import com.petties.petties.dto.service.ServiceRequest;
import com.petties.petties.dto.service.ServiceResponse;
import com.petties.petties.dto.service.ServiceUpdateRequest;
import com.petties.petties.dto.service.WeightPriceDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.ServiceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for ServiceController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - Create service
 * - Get all services
 * - Get service by ID
 * - Update service
 * - Delete service
 * - Update service status
 * - Update home visit status
 * - Update price per km
 * - Bulk update price per km
 */
@WebMvcTest(value = ServiceController.class, 
    excludeAutoConfiguration = {
        org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration.class,
        org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration.class,
        org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration.class,
        org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration.class
    },
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE, 
        classes = JpaConfig.class
    ))
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ServiceController Unit Tests")
class ServiceControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ServiceService serviceService;

    // Security-related dependencies for JwtAuthenticationFilter
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
    private ServiceRequest testServiceRequest;
    private ServiceResponse testServiceResponse;

    @BeforeEach
    void setUp() {
        testServiceId = UUID.randomUUID();
        testClinicId = UUID.randomUUID();

        // Setup weight prices
        List<WeightPriceDto> weightPrices = Arrays.asList(
                WeightPriceDto.builder()
                        .minWeight("0")
                        .maxWeight("5")
                        .price("100000")
                        .build(),
                WeightPriceDto.builder()
                        .minWeight("5")
                        .maxWeight("10")
                        .price("150000")
                        .build()
        );

        testServiceRequest = new ServiceRequest();
        testServiceRequest.setName("Khám tổng quát");
        testServiceRequest.setBasePrice("200000");
        testServiceRequest.setDurationTime(30);
        testServiceRequest.setSlotsRequired(1);
        testServiceRequest.setIsActive(true);
        testServiceRequest.setIsHomeVisit(false);
        testServiceRequest.setPricePerKm("10000");
        testServiceRequest.setServiceCategory("Khám bệnh");
        testServiceRequest.setPetType("Chó");
        testServiceRequest.setWeightPrices(weightPrices);

        testServiceResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .clinicId(testClinicId)
                .name("Khám tổng quát")
                .basePrice("200000")
                .durationTime(30)
                .slotsRequired(1)
                .isActive(true)
                .isHomeVisit(false)
                .pricePerKm("10000")
                .serviceCategory("Khám bệnh")
                .petType("Chó")
                .weightPrices(weightPrices)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    // ==================== CREATE SERVICE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-001: Create Service Success")
    void createService_validRequest_returns201() throws Exception {
        // Arrange
        when(serviceService.createService(any(ServiceRequest.class)))
                .thenReturn(testServiceResponse);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.serviceId").exists())
                .andExpect(jsonPath("$.name").value("Khám tổng quát"))
                .andExpect(jsonPath("$.basePrice").value("200000"))
                .andExpect(jsonPath("$.durationTime").value(30))
                .andExpect(jsonPath("$.slotsRequired").value(1))
                .andExpect(jsonPath("$.isActive").value(true))
                .andExpect(jsonPath("$.isHomeVisit").value(false));

        verify(serviceService).createService(any(ServiceRequest.class));
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-002: Create Service Blank Name")
    void createService_blankName_returns400() throws Exception {
        // Arrange
        testServiceRequest.setName("");

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-003: Create Service Null Name")
    void createService_nullName_returns400() throws Exception {
        // Arrange
        testServiceRequest.setName(null);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-004: Create Service Name Too Long")
    void createService_nameTooLong_returns400() throws Exception {
        // Arrange
        testServiceRequest.setName("A".repeat(201));

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-005: Create Service Blank Base Price")
    void createService_blankBasePrice_returns400() throws Exception {
        // Arrange
        testServiceRequest.setBasePrice("");

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-006: Create Service Null Duration Time")
    void createService_nullDurationTime_returns400() throws Exception {
        // Arrange
        testServiceRequest.setDurationTime(null);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-007: Create Service Negative Duration Time")
    void createService_negativeDurationTime_returns400() throws Exception {
        // Arrange
        testServiceRequest.setDurationTime(-10);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-008: Create Service Zero Duration Time")
    void createService_zeroDurationTime_returns400() throws Exception {
        // Arrange
        testServiceRequest.setDurationTime(0);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-009: Create Service Null Slots Required")
    void createService_nullSlotsRequired_returns400() throws Exception {
        // Arrange
        testServiceRequest.setSlotsRequired(null);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-010: Create Service Negative Slots Required")
    void createService_negativeSlotsRequired_returns400() throws Exception {
        // Arrange
        testServiceRequest.setSlotsRequired(-1);

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-011: Create Service Price Per Km Too Long")
    void createService_pricePerKmTooLong_returns400() throws Exception {
        // Arrange
        testServiceRequest.setPricePerKm("1".repeat(51));

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-012: Create Service Service Category Too Long")
    void createService_serviceCategoryTooLong_returns400() throws Exception {
        // Arrange
        testServiceRequest.setServiceCategory("A".repeat(101));

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-013: Create Service Pet Type Too Long")
    void createService_petTypeTooLong_returns400() throws Exception {
        // Arrange
        testServiceRequest.setPetType("A".repeat(101));

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).createService(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-014: Create Service Duplicate Name")
    void createService_duplicateName_returns400() throws Exception {
        // Arrange
        when(serviceService.createService(any(ServiceRequest.class)))
                .thenThrow(new BadRequestException("Tên dịch vụ đã tồn tại"));

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService).createService(any(ServiceRequest.class));
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-015: Create Service No Clinic Associated")
    void createService_noClinicAssociated_returns403() throws Exception {
        // Arrange
        when(serviceService.createService(any(ServiceRequest.class)))
                .thenThrow(new ForbiddenException("Bạn chưa có phòng khám"));

        // Act & Assert
        mockMvc.perform(post("/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(testServiceRequest)))
                .andExpect(status().isForbidden());

        verify(serviceService).createService(any(ServiceRequest.class));
    }

    // ==================== GET ALL SERVICES TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-016: Get All Services Success")
    void getAllServices_validRequest_returns200() throws Exception {
        // Arrange
        List<ServiceResponse> services = Arrays.asList(testServiceResponse);
        when(serviceService.getAllServices()).thenReturn(services);

        // Act & Assert
        mockMvc.perform(get("/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].serviceId").exists())
                .andExpect(jsonPath("$[0].name").value("Khám tổng quát"));

        verify(serviceService).getAllServices();
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-017: Get All Services Empty List")
    void getAllServices_emptyList_returns200() throws Exception {
        // Arrange
        when(serviceService.getAllServices()).thenReturn(new ArrayList<>());

        // Act & Assert
        mockMvc.perform(get("/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());

        verify(serviceService).getAllServices();
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-018: Get All Services No Clinic")
    void getAllServices_noClinic_returns403() throws Exception {
        // Arrange
        when(serviceService.getAllServices())
                .thenThrow(new ForbiddenException("Bạn chưa có phòng khám"));

        // Act & Assert
        mockMvc.perform(get("/services"))
                .andExpect(status().isForbidden());

        verify(serviceService).getAllServices();
    }

    // ==================== GET SERVICE BY ID TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-019: Get Service By ID Success")
    void getServiceById_validId_returns200() throws Exception {
        // Arrange
        when(serviceService.getServiceById(testServiceId))
                .thenReturn(testServiceResponse);

        // Act & Assert
        mockMvc.perform(get("/services/{serviceId}", testServiceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceId").value(testServiceId.toString()))
                .andExpect(jsonPath("$.name").value("Khám tổng quát"));

        verify(serviceService).getServiceById(testServiceId);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-020: Get Service By ID Not Found")
    void getServiceById_notFound_returns404() throws Exception {
        // Arrange
        when(serviceService.getServiceById(testServiceId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy dịch vụ"));

        // Act & Assert
        mockMvc.perform(get("/services/{serviceId}", testServiceId))
                .andExpect(status().isNotFound());

        verify(serviceService).getServiceById(testServiceId);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-021: Get Service By ID Wrong Clinic")
    void getServiceById_wrongClinic_returns403() throws Exception {
        // Arrange
        when(serviceService.getServiceById(testServiceId))
                .thenThrow(new ForbiddenException("Dịch vụ không thuộc phòng khám của bạn"));

        // Act & Assert
        mockMvc.perform(get("/services/{serviceId}", testServiceId))
                .andExpect(status().isForbidden());

        verify(serviceService).getServiceById(testServiceId);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-022: Get Service By ID Invalid UUID Format")
    void getServiceById_invalidUuidFormat_returns400() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/services/{serviceId}", "invalid-uuid"))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).getServiceById(any());
    }

    // ==================== UPDATE SERVICE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-023: Update Service Success")
    void updateService_validRequest_returns200() throws Exception {
        // Arrange
        ServiceUpdateRequest updateRequest = new ServiceUpdateRequest();
        updateRequest.setName("Khám tổng quát cập nhật");
        updateRequest.setBasePrice("250000");

        ServiceResponse updatedResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .name("Khám tổng quát cập nhật")
                .basePrice("250000")
                .build();

        when(serviceService.updateService(eq(testServiceId), any(ServiceUpdateRequest.class)))
                .thenReturn(updatedResponse);

        // Act & Assert
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Khám tổng quát cập nhật"))
                .andExpect(jsonPath("$.basePrice").value("250000"));

        verify(serviceService).updateService(eq(testServiceId), any(ServiceUpdateRequest.class));
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-024: Update Service Name Too Long")
    void updateService_nameTooLong_returns400() throws Exception {
        // Arrange
        ServiceUpdateRequest updateRequest = new ServiceUpdateRequest();
        updateRequest.setName("A".repeat(201));

        // Act & Assert
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).updateService(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-025: Update Service Negative Duration Time")
    void updateService_negativeDurationTime_returns400() throws Exception {
        // Arrange
        ServiceUpdateRequest updateRequest = new ServiceUpdateRequest();
        updateRequest.setDurationTime(-10);

        // Act & Assert
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).updateService(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-026: Update Service Not Found")
    void updateService_notFound_returns404() throws Exception {
        // Arrange
        ServiceUpdateRequest updateRequest = new ServiceUpdateRequest();
        updateRequest.setName("Updated Name");

        when(serviceService.updateService(eq(testServiceId), any(ServiceUpdateRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy dịch vụ"));

        // Act & Assert
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isNotFound());

        verify(serviceService).updateService(eq(testServiceId), any(ServiceUpdateRequest.class));
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-027: Update Service Wrong Clinic")
    void updateService_wrongClinic_returns403() throws Exception {
        // Arrange
        ServiceUpdateRequest updateRequest = new ServiceUpdateRequest();
        updateRequest.setName("Updated Name");

        when(serviceService.updateService(eq(testServiceId), any(ServiceUpdateRequest.class)))
                .thenThrow(new ForbiddenException("Dịch vụ không thuộc phòng khám của bạn"));

        // Act & Assert
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isForbidden());

        verify(serviceService).updateService(eq(testServiceId), any(ServiceUpdateRequest.class));
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-028: Update Service Duplicate Name")
    void updateService_duplicateName_returns400() throws Exception {
        // Arrange
        ServiceUpdateRequest updateRequest = new ServiceUpdateRequest();
        updateRequest.setName("Existing Name");

        when(serviceService.updateService(eq(testServiceId), any(ServiceUpdateRequest.class)))
                .thenThrow(new BadRequestException("Tên dịch vụ đã tồn tại"));

        // Act & Assert
        mockMvc.perform(put("/services/{serviceId}", testServiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isBadRequest());

        verify(serviceService).updateService(eq(testServiceId), any(ServiceUpdateRequest.class));
    }

    // ==================== DELETE SERVICE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-029: Delete Service Success")
    void deleteService_validId_returns204() throws Exception {
        // Arrange
        doNothing().when(serviceService).deleteService(testServiceId);

        // Act & Assert
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isNoContent());

        verify(serviceService).deleteService(testServiceId);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-030: Delete Service Not Found")
    void deleteService_notFound_returns404() throws Exception {
        // Arrange
        doThrow(new ResourceNotFoundException("Không tìm thấy dịch vụ"))
                .when(serviceService).deleteService(testServiceId);

        // Act & Assert
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isNotFound());

        verify(serviceService).deleteService(testServiceId);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-031: Delete Service Wrong Clinic")
    void deleteService_wrongClinic_returns403() throws Exception {
        // Arrange
        doThrow(new ForbiddenException("Dịch vụ không thuộc phòng khám của bạn"))
                .when(serviceService).deleteService(testServiceId);

        // Act & Assert
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isForbidden());

        verify(serviceService).deleteService(testServiceId);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-032: Delete Service Has Active Appointments")
    void deleteService_hasActiveAppointments_returns400() throws Exception {
        // Arrange
        doThrow(new BadRequestException("Không thể xóa dịch vụ có lịch hẹn đang hoạt động"))
                .when(serviceService).deleteService(testServiceId);

        // Act & Assert
        mockMvc.perform(delete("/services/{serviceId}", testServiceId))
                .andExpect(status().isBadRequest());

        verify(serviceService).deleteService(testServiceId);
    }

    // ==================== UPDATE SERVICE STATUS TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-033: Update Service Status To Active Success")
    void updateServiceStatus_toActive_returns200() throws Exception {
        // Arrange
        ServiceResponse updatedResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .isActive(true)
                .build();

        when(serviceService.updateServiceStatus(testServiceId, true))
                .thenReturn(updatedResponse);

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                        .param("isActive", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(true));

        verify(serviceService).updateServiceStatus(testServiceId, true);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-034: Update Service Status To Inactive Success")
    void updateServiceStatus_toInactive_returns200() throws Exception {
        // Arrange
        ServiceResponse updatedResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .isActive(false)
                .build();

        when(serviceService.updateServiceStatus(testServiceId, false))
                .thenReturn(updatedResponse);

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                        .param("isActive", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(false));

        verify(serviceService).updateServiceStatus(testServiceId, false);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-035: Update Service Status Missing Parameter")
    void updateServiceStatus_missingParameter_returns400() throws Exception {
        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).updateServiceStatus(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-036: Update Service Status Not Found")
    void updateServiceStatus_notFound_returns404() throws Exception {
        // Arrange
        when(serviceService.updateServiceStatus(testServiceId, true))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy dịch vụ"));

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                        .param("isActive", "true"))
                .andExpect(status().isNotFound());

        verify(serviceService).updateServiceStatus(testServiceId, true);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-037: Update Service Status Wrong Clinic")
    void updateServiceStatus_wrongClinic_returns403() throws Exception {
        // Arrange
        when(serviceService.updateServiceStatus(testServiceId, true))
                .thenThrow(new ForbiddenException("Dịch vụ không thuộc phòng khám của bạn"));

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/status", testServiceId)
                        .param("isActive", "true"))
                .andExpect(status().isForbidden());

        verify(serviceService).updateServiceStatus(testServiceId, true);
    }

    // ==================== UPDATE HOME VISIT STATUS TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-038: Update Home Visit Status Enable Success")
    void updateHomeVisitStatus_enable_returns200() throws Exception {
        // Arrange
        ServiceResponse updatedResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .isHomeVisit(true)
                .build();

        when(serviceService.updateHomeVisitStatus(testServiceId, true))
                .thenReturn(updatedResponse);

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/home-visit", testServiceId)
                        .param("isHomeVisit", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isHomeVisit").value(true));

        verify(serviceService).updateHomeVisitStatus(testServiceId, true);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-039: Update Home Visit Status Disable Success")
    void updateHomeVisitStatus_disable_returns200() throws Exception {
        // Arrange
        ServiceResponse updatedResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .isHomeVisit(false)
                .build();

        when(serviceService.updateHomeVisitStatus(testServiceId, false))
                .thenReturn(updatedResponse);

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/home-visit", testServiceId)
                        .param("isHomeVisit", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isHomeVisit").value(false));

        verify(serviceService).updateHomeVisitStatus(testServiceId, false);
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-040: Update Home Visit Status Missing Parameter")
    void updateHomeVisitStatus_missingParameter_returns400() throws Exception {
        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/home-visit", testServiceId))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).updateHomeVisitStatus(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-041: Update Home Visit Status Not Found")
    void updateHomeVisitStatus_notFound_returns404() throws Exception {
        // Arrange
        when(serviceService.updateHomeVisitStatus(testServiceId, true))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy dịch vụ"));

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/home-visit", testServiceId)
                        .param("isHomeVisit", "true"))
                .andExpect(status().isNotFound());

        verify(serviceService).updateHomeVisitStatus(testServiceId, true);
    }

    // ==================== UPDATE PRICE PER KM TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-042: Update Price Per Km Success")
    void updatePricePerKm_validPrice_returns200() throws Exception {
        // Arrange
        ServiceResponse updatedResponse = ServiceResponse.builder()
                .serviceId(testServiceId)
                .pricePerKm("15000")
                .build();

        when(serviceService.updatePricePerKm(testServiceId, "15000"))
                .thenReturn(updatedResponse);

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/price-per-km", testServiceId)
                        .param("pricePerKm", "15000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pricePerKm").value("15000"));

        verify(serviceService).updatePricePerKm(testServiceId, "15000");
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-043: Update Price Per Km Missing Parameter")
    void updatePricePerKm_missingParameter_returns400() throws Exception {
        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/price-per-km", testServiceId))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).updatePricePerKm(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-044: Update Price Per Km Not Found")
    void updatePricePerKm_notFound_returns404() throws Exception {
        // Arrange
        when(serviceService.updatePricePerKm(testServiceId, "15000"))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy dịch vụ"));

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/price-per-km", testServiceId)
                        .param("pricePerKm", "15000"))
                .andExpect(status().isNotFound());

        verify(serviceService).updatePricePerKm(testServiceId, "15000");
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-045: Update Price Per Km Service Not Home Visit")
    void updatePricePerKm_serviceNotHomeVisit_returns400() throws Exception {
        // Arrange
        when(serviceService.updatePricePerKm(testServiceId, "15000"))
                .thenThrow(new BadRequestException("Dịch vụ không hỗ trợ khám tại nhà"));

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/price-per-km", testServiceId)
                        .param("pricePerKm", "15000"))
                .andExpect(status().isBadRequest());

        verify(serviceService).updatePricePerKm(testServiceId, "15000");
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-046: Update Price Per Km Invalid Price Format")
    void updatePricePerKm_invalidPriceFormat_returns400() throws Exception {
        // Arrange
        when(serviceService.updatePricePerKm(testServiceId, "invalid"))
                .thenThrow(new BadRequestException("Giá không hợp lệ"));

        // Act & Assert
        mockMvc.perform(patch("/services/{serviceId}/price-per-km", testServiceId)
                        .param("pricePerKm", "invalid"))
                .andExpect(status().isBadRequest());

        verify(serviceService).updatePricePerKm(testServiceId, "invalid");
    }

    // ==================== BULK UPDATE PRICE PER KM TESTS ====================

    @Test
    @DisplayName("TC-UNIT-SERVICE-047: Bulk Update Price Per Km Success")
    void updateBulkPricePerKm_validPrice_returns200() throws Exception {
        // Arrange
        doNothing().when(serviceService).updateBulkPricePerKm("20000");

        // Act & Assert
        mockMvc.perform(patch("/services/bulk/price-per-km")
                        .param("pricePerKm", "20000"))
                .andExpect(status().isOk());

        verify(serviceService).updateBulkPricePerKm("20000");
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-048: Bulk Update Price Per Km Missing Parameter")
    void updateBulkPricePerKm_missingParameter_returns400() throws Exception {
        // Act & Assert
        mockMvc.perform(patch("/services/bulk/price-per-km"))
                .andExpect(status().isBadRequest());

        verify(serviceService, never()).updateBulkPricePerKm(any());
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-049: Bulk Update Price Per Km No Clinic")
    void updateBulkPricePerKm_noClinic_returns403() throws Exception {
        // Arrange
        doThrow(new ForbiddenException("Bạn chưa có phòng khám"))
                .when(serviceService).updateBulkPricePerKm("20000");

        // Act & Assert
        mockMvc.perform(patch("/services/bulk/price-per-km")
                        .param("pricePerKm", "20000"))
                .andExpect(status().isForbidden());

        verify(serviceService).updateBulkPricePerKm("20000");
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-050: Bulk Update Price Per Km No Home Visit Services")
    void updateBulkPricePerKm_noHomeVisitServices_returns400() throws Exception {
        // Arrange
        doThrow(new BadRequestException("Không có dịch vụ khám tại nhà nào"))
                .when(serviceService).updateBulkPricePerKm("20000");

        // Act & Assert
        mockMvc.perform(patch("/services/bulk/price-per-km")
                        .param("pricePerKm", "20000"))
                .andExpect(status().isBadRequest());

        verify(serviceService).updateBulkPricePerKm("20000");
    }

    @Test
    @DisplayName("TC-UNIT-SERVICE-051: Bulk Update Price Per Km Invalid Price Format")
    void updateBulkPricePerKm_invalidPriceFormat_returns400() throws Exception {
        // Arrange
        doThrow(new BadRequestException("Giá không hợp lệ"))
                .when(serviceService).updateBulkPricePerKm("invalid");

        // Act & Assert
        mockMvc.perform(patch("/services/bulk/price-per-km")
                        .param("pricePerKm", "invalid"))
                .andExpect(status().isBadRequest());

        verify(serviceService).updateBulkPricePerKm("invalid");
    }
}
