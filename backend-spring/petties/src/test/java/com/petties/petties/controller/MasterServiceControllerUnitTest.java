package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.clinicService.WeightPriceDto;
import com.petties.petties.dto.masterService.MasterServiceRequest;
import com.petties.petties.dto.masterService.MasterServiceResponse;
import com.petties.petties.dto.masterService.MasterServiceUpdateRequest;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.MasterServiceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for MasterServiceController using @WebMvcTest and MockMvc.
 * Follows project standards (Flat structure, clear naming).
 */
@WebMvcTest(MasterServiceController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("MasterServiceController Unit Tests")
class MasterServiceControllerUnitTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private MasterServiceService masterServiceService;

	// Security mocks required for WebMvcTest when Filters are present
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

	private UUID testMasterServiceId;
	private MasterServiceRequest testRequest;
	private MasterServiceResponse testResponse;

	@BeforeEach
	void setUp() {
		testMasterServiceId = UUID.randomUUID();

		List<WeightPriceDto> weightPrices = Arrays.asList(
				new WeightPriceDto(new BigDecimal("0.0"), new BigDecimal("5.0"), new BigDecimal("10000.0")),
				new WeightPriceDto(new BigDecimal("5.0"), new BigDecimal("10.0"), new BigDecimal("20000.0")));

		testRequest = new MasterServiceRequest();
		testRequest.setName("Dịch vụ tắm rửa mẫu");
		testRequest.setDescription("Mô tả dịch vụ mẫu");
		testRequest.setDefaultPrice(new BigDecimal("100000.0"));
		testRequest.setDurationTime(60);
		testRequest.setSlotsRequired(2);
		testRequest.setIsHomeVisit(true);
		testRequest.setDefaultPricePerKm(new BigDecimal("5000.0"));
		testRequest.setServiceCategory("Grooming");
		testRequest.setPetType("Chó");
		testRequest.setWeightPrices(weightPrices);

		testResponse = new MasterServiceResponse();
		testResponse.setMasterServiceId(testMasterServiceId);
		testResponse.setName(testRequest.getName());
		testResponse.setDescription(testRequest.getDescription());
		testResponse.setDefaultPrice(testRequest.getDefaultPrice());
		testResponse.setDurationTime(testRequest.getDurationTime());
		testResponse.setSlotsRequired(testRequest.getSlotsRequired());
		testResponse.setIsHomeVisit(testRequest.getIsHomeVisit());
		testResponse.setDefaultPricePerKm(testRequest.getDefaultPricePerKm());
		testResponse.setServiceCategory(testRequest.getServiceCategory());
		testResponse.setPetType(testRequest.getPetType());
		testResponse.setWeightPrices(weightPrices);
	}

	// ==================== CREATE MASTER SERVICE TESTS ====================

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-001: Success - create master service")
	void createMasterService_validRequest_returns201() throws Exception {
		when(masterServiceService.createMasterService(any(MasterServiceRequest.class))).thenReturn(testResponse);

		mockMvc.perform(post("/master-services")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(testRequest)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.masterServiceId").value(testMasterServiceId.toString()))
				.andExpect(jsonPath("$.name").value("Dịch vụ tắm rửa mẫu"));
	}

	// ==================== LIST MASTER SERVICE TESTS ====================

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-002: Success - get all master services")
	void getAllMasterServices_returns200() throws Exception {
		when(masterServiceService.getAllMasterServices()).thenReturn(List.of(testResponse));

		mockMvc.perform(get("/master-services"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].masterServiceId").value(testMasterServiceId.toString()));
	}

	// ==================== GET BY ID TESTS ====================

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-003: Success - get master service by id")
	void getMasterServiceById_validId_returns200() throws Exception {
		when(masterServiceService.getMasterServiceById(testMasterServiceId)).thenReturn(testResponse);

		mockMvc.perform(get("/master-services/{id}", testMasterServiceId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.masterServiceId").value(testMasterServiceId.toString()))
				.andExpect(jsonPath("$.name").value(testResponse.getName()));
	}

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-004: Fail - get master service not found")
	void getMasterServiceById_notFound_returns404() throws Exception {
		when(masterServiceService.getMasterServiceById(testMasterServiceId))
				.thenThrow(new ResourceNotFoundException("Master service not found"));

		mockMvc.perform(get("/master-services/{id}", testMasterServiceId))
				.andExpect(status().isNotFound());
	}

	// ==================== UPDATE MASTER SERVICE TESTS ====================

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-005: Success - update master service")
	void updateMasterService_validRequest_returns200() throws Exception {
		MasterServiceUpdateRequest updateRequest = new MasterServiceUpdateRequest();
		updateRequest.setName("Updated Name");
		updateRequest.setDefaultPrice(new BigDecimal("120000.0"));

		testResponse.setName("Updated Name");
		testResponse.setDefaultPrice(new BigDecimal("120000.0"));

		when(masterServiceService.updateMasterService(eq(testMasterServiceId), any(MasterServiceUpdateRequest.class)))
				.thenReturn(testResponse);

		mockMvc.perform(put("/master-services/{id}", testMasterServiceId)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(updateRequest)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Updated Name"))
				.andExpect(jsonPath("$.defaultPrice").value(120000.0));
	}

	// ==================== DELETE MASTER SERVICE TESTS ====================

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-006: Success - delete master service")
	void deleteMasterService_validId_returns204() throws Exception {
		doNothing().when(masterServiceService).deleteMasterService(testMasterServiceId);

		mockMvc.perform(delete("/master-services/{id}", testMasterServiceId))
				.andExpect(status().isNoContent());
	}

	// ==================== SEARCH & FILTER TESTS ====================

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-007: Success - search by name")
	void searchMasterServices_returns200() throws Exception {
		when(masterServiceService.searchMasterServicesByName("tắm")).thenReturn(List.of(testResponse));

		mockMvc.perform(get("/master-services/search").param("name", "tắm"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].name").value(containsString("tắm")));
	}

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-008: Success - get by category")
	void getMasterServicesByCategory_returns200() throws Exception {
		when(masterServiceService.getMasterServicesByCategory("Grooming")).thenReturn(List.of(testResponse));

		mockMvc.perform(get("/master-services/category/{category}", "Grooming"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].serviceCategory").value("Grooming"));
	}

	@Test
	@DisplayName("TC-UNIT-MASTER-SERVICE-009: Success - get by pet type")
	void getMasterServicesByPetType_returns200() throws Exception {
		when(masterServiceService.getMasterServicesByPetType("Chó")).thenReturn(List.of(testResponse));

		mockMvc.perform(get("/master-services/pet-type/{petType}", "Chó"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].petType").value("Chó"));
	}
}