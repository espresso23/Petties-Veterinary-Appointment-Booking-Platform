package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.clinic.ClinicRequest;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ClinicService;
import com.petties.petties.service.CloudinaryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for ClinicController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - GET /clinics (list with filters)
 * - GET /clinics/{id} (get by id)
 * - POST /clinics (create)
 * - PUT /clinics/{id} (update)
 * - DELETE /clinics/{id} (delete)
 * - GET /clinics/search (search)
 * - GET /clinics/nearby (find nearby)
 * - POST /clinics/{id}/geocode (geocode address)
 * - GET /clinics/{id}/distance (calculate distance)
 * - POST /clinics/{id}/approve (approve clinic - ADMIN only)
 * - POST /clinics/{id}/reject (reject clinic - ADMIN only)
 * - GET /clinics/owner/my-clinics (get owner's clinics)
 * - POST /clinics/{id}/images (upload image)
 * - POST /clinics/{id}/logo (upload logo)
 * - DELETE /clinics/{id}/images/{imageId} (delete image)
 * - POST /clinics/{id}/images/{imageId}/primary (set primary image)
 *
 * Each endpoint tests:
 * - Happy path (200/201)
 * - Validation errors (400)
 * - Not found errors (404)
 * - Forbidden errors (403)
 * - Business logic errors from service layer
 */
@WebMvcTest(ClinicController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicController Unit Tests")
class ClinicControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ClinicService clinicService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private CloudinaryService cloudinaryService;

    @Autowired
    private ObjectMapper objectMapper;

    private User mockUser() {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        return u;
    }

    private ClinicResponse mockClinic(UUID id, String name) {
        return ClinicResponse.builder()
                .clinicId(id)
                .name(name)
                .status(ClinicStatus.PENDING)
                .address("123 Street")
                .phone("0900000000")
                .build();
    }

    @Test
    @DisplayName("GET /clinics - return paged clinics")
    void getAllClinics_returns200() throws Exception {
        Page<ClinicResponse> page = new PageImpl<>(List.of(
                mockClinic(UUID.randomUUID(), "Clinic A"),
                mockClinic(UUID.randomUUID(), "Clinic B")
        ));
        when(clinicService.getAllClinics(any(), any(), any())).thenReturn(page);

        mockMvc.perform(get("/clinics")
                        .param("status", "PENDING")
                        .param("name", "Clinic")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].name").value("Clinic A"));
    }

    @Test
    @DisplayName("GET /clinics/{id} - return clinic detail")
    void getClinicById_returns200() throws Exception {
        UUID id = UUID.randomUUID();
        when(clinicService.getClinicById(id)).thenReturn(mockClinic(id, "Clinic Detail"));

        mockMvc.perform(get("/clinics/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Clinic Detail"));
    }

    @Test
    @DisplayName("POST /clinics - create clinic returns 201")
    void createClinic_returns201() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("New Clinic")
                .address("123 Street")
                .phone("0900000000")
                .build();

        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);
        when(clinicService.createClinic(any(ClinicRequest.class), eq(user.getUserId())))
                .thenReturn(mockClinic(UUID.randomUUID(), "New Clinic"));

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("New Clinic"));
    }

    @Test
    @DisplayName("POST /clinics/{id}/images - upload clinic image returns 201")
    void uploadClinicImage_returns201() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "image.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-image".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/image.jpg")
                .publicId("publicId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        ClinicResponse resp = mockClinic(clinicId, "With Image");
        resp.setImages(List.of("http://cloudinary.com/image.jpg"));
        when(clinicService.uploadClinicImage(eq(clinicId), anyString(), any(), any(), any(), eq(user.getUserId())))
                .thenReturn(resp);

        mockMvc.perform(multipart("/clinics/{id}/images", clinicId)
                        .file(file)
                        .param("isPrimary", "true"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.images", hasSize(1)));
    }

    @Test
    @DisplayName("POST /clinics/{id}/images/{imageId}/primary - set primary image returns 200")
    void setPrimaryImage_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        ClinicResponse resp = mockClinic(clinicId, "Primary");
        resp.setImages(List.of("http://cloudinary.com/primary.jpg"));
        when(clinicService.setPrimaryClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId())))
                .thenReturn(resp);

        mockMvc.perform(post("/clinics/{id}/images/{imageId}/primary", clinicId, imageId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images", hasSize(1)));
    }

    @Test
    @DisplayName("DELETE /clinics/{id}/images/{imageId} - delete image returns 200")
    void deleteImage_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        when(authService.getCurrentUser()).thenReturn(mockUser());

        mockMvc.perform(delete("/clinics/{id}/images/{imageId}", clinicId, imageId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Image deleted successfully"));
    }

    // ==================== GET ALL CLINICS TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-001: GET /clinics - empty result returns 200")
    void getAllClinics_emptyResult_returns200() throws Exception {
        Page<ClinicResponse> emptyPage = new PageImpl<>(List.of());
        when(clinicService.getAllClinics(any(), any(), any())).thenReturn(emptyPage);

        mockMvc.perform(get("/clinics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-002: GET /clinics - with status filter returns 200")
    void getAllClinics_withStatusFilter_returns200() throws Exception {
        Page<ClinicResponse> page = new PageImpl<>(List.of(
                mockClinic(UUID.randomUUID(), "Approved Clinic")
        ));
        when(clinicService.getAllClinics(eq(ClinicStatus.APPROVED), any(), any())).thenReturn(page);

        mockMvc.perform(get("/clinics")
                        .param("status", "APPROVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));
    }

    // ==================== GET CLINIC BY ID TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-003: GET /clinics/{id} - not found returns 404")
    void getClinicById_notFound_returns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(clinicService.getClinicById(id))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(get("/clinics/{id}", id))
                .andExpect(status().isNotFound());
    }

    // ==================== CREATE CLINIC TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-004: POST /clinics - blank name returns 400")
    void createClinic_blankName_returns400() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("")
                .address("123 Street")
                .phone("0900000000")
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-005: POST /clinics - null name returns 400")
    void createClinic_nullName_returns400() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name(null)
                .address("123 Street")
                .phone("0900000000")
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-006: POST /clinics - blank address returns 400")
    void createClinic_blankAddress_returns400() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("New Clinic")
                .address("")
                .phone("0900000000")
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-007: POST /clinics - blank phone returns 400")
    void createClinic_blankPhone_returns400() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("New Clinic")
                .address("123 Street")
                .phone("")
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-008: POST /clinics - invalid phone format returns 400")
    void createClinic_invalidPhoneFormat_returns400() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("New Clinic")
                .address("123 Street")
                .phone("123456789") // Invalid: không bắt đầu bằng 0
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-009: POST /clinics - invalid email format returns 400")
    void createClinic_invalidEmailFormat_returns400() throws Exception {
        ClinicRequest request = ClinicRequest.builder()
                .name("New Clinic")
                .address("123 Street")
                .phone("0900000000")
                .email("invalid-email") // Invalid email format
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-010: POST /clinics - name too long returns 400")
    void createClinic_nameTooLong_returns400() throws Exception {
        String longName = "A".repeat(201); // Exceeds 200 character limit
        ClinicRequest request = ClinicRequest.builder()
                .name(longName)
                .address("123 Street")
                .phone("0900000000")
                .build();

        mockMvc.perform(post("/clinics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).createClinic(any(), any());
    }

    // ==================== UPDATE CLINIC TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-011: PUT /clinics/{id} - update clinic returns 200")
    void updateClinic_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        ClinicRequest request = ClinicRequest.builder()
                .name("Updated Clinic")
                .address("456 Street")
                .phone("0911111111")
                .build();

        ClinicResponse response = mockClinic(clinicId, "Updated Clinic");
        when(clinicService.updateClinic(eq(clinicId), any(ClinicRequest.class), eq(user.getUserId())))
                .thenReturn(response);

        mockMvc.perform(put("/clinics/{id}", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Clinic"));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-012: PUT /clinics/{id} - clinic not found returns 404")
    void updateClinic_notFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        ClinicRequest request = ClinicRequest.builder()
                .name("Updated Clinic")
                .address("456 Street")
                .phone("0911111111")
                .build();

        when(clinicService.updateClinic(eq(clinicId), any(ClinicRequest.class), eq(user.getUserId())))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(put("/clinics/{id}", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-013: PUT /clinics/{id} - forbidden (not owner) returns 403")
    void updateClinic_forbidden_returns403() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        ClinicRequest request = ClinicRequest.builder()
                .name("Updated Clinic")
                .address("456 Street")
                .phone("0911111111")
                .build();

        when(clinicService.updateClinic(eq(clinicId), any(ClinicRequest.class), eq(user.getUserId())))
                .thenThrow(new ForbiddenException("You can only update your own clinic"));

        mockMvc.perform(put("/clinics/{id}", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-014: PUT /clinics/{id} - blank name returns 400")
    void updateClinic_blankName_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        ClinicRequest request = ClinicRequest.builder()
                .name("")
                .address("456 Street")
                .phone("0911111111")
                .build();

        mockMvc.perform(put("/clinics/{id}", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(clinicService, never()).updateClinic(any(), any(), any());
    }

    // ==================== DELETE CLINIC TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-015: DELETE /clinics/{id} - delete clinic returns 200")
    void deleteClinic_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);
        doNothing().when(clinicService).deleteClinic(eq(clinicId), eq(user.getUserId()));

        mockMvc.perform(delete("/clinics/{id}", clinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Clinic deleted successfully"));

        verify(clinicService).deleteClinic(eq(clinicId), eq(user.getUserId()));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-016: DELETE /clinics/{id} - clinic not found returns 404")
    void deleteClinic_notFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);
        doThrow(new ResourceNotFoundException("Clinic not found"))
                .when(clinicService).deleteClinic(eq(clinicId), eq(user.getUserId()));

        mockMvc.perform(delete("/clinics/{id}", clinicId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-017: DELETE /clinics/{id} - forbidden (not owner) returns 403")
    void deleteClinic_forbidden_returns403() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);
        doThrow(new ForbiddenException("You can only delete your own clinic"))
                .when(clinicService).deleteClinic(eq(clinicId), eq(user.getUserId()));

        mockMvc.perform(delete("/clinics/{id}", clinicId))
                .andExpect(status().isForbidden());
    }

    // ==================== SEARCH CLINICS TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-018: GET /clinics/search - search clinics returns 200")
    void searchClinics_validRequest_returns200() throws Exception {
        Page<ClinicResponse> page = new PageImpl<>(List.of(
                mockClinic(UUID.randomUUID(), "Clinic Search Result")
        ));
        when(clinicService.searchClinics(eq("Clinic"), any())).thenReturn(page);

        mockMvc.perform(get("/clinics/search")
                        .param("name", "Clinic"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-019: GET /clinics/search - blank name returns 200 (empty result)")
    void searchClinics_blankName_returns200() throws Exception {
        Page<ClinicResponse> emptyPage = new PageImpl<>(List.of());
        when(clinicService.searchClinics(eq(""), any())).thenReturn(emptyPage);

        mockMvc.perform(get("/clinics/search")
                        .param("name", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    // ==================== NEARBY CLINICS TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-020: GET /clinics/nearby - find nearby clinics returns 200")
    void findNearbyClinics_validRequest_returns200() throws Exception {
        Page<ClinicResponse> page = new PageImpl<>(List.of(
                mockClinic(UUID.randomUUID(), "Nearby Clinic")
        ));
        when(clinicService.findNearbyClinics(any(BigDecimal.class), any(BigDecimal.class), anyDouble(), any()))
                .thenReturn(page);

        mockMvc.perform(get("/clinics/nearby")
                        .param("latitude", "10.762622")
                        .param("longitude", "106.660172")
                        .param("radius", "5.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-021: GET /clinics/nearby - missing latitude returns 400")
    void findNearbyClinics_missingLatitude_returns400() throws Exception {
        mockMvc.perform(get("/clinics/nearby")
                        .param("longitude", "106.660172"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-022: GET /clinics/nearby - missing longitude returns 400")
    void findNearbyClinics_missingLongitude_returns400() throws Exception {
        mockMvc.perform(get("/clinics/nearby")
                        .param("latitude", "10.762622"))
                .andExpect(status().isBadRequest());
    }

    // ==================== GEOCODE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-023: POST /clinics/{id}/geocode - geocode address returns 200")
    void geocodeClinicAddress_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();

        GeocodeResponse geocodeResponse = GeocodeResponse.builder()
                .latitude(new BigDecimal("10.762622"))
                .longitude(new BigDecimal("106.660172"))
                .formattedAddress("123 Street, District 1, Ho Chi Minh City")
                .build();

        when(clinicService.geocodeAddress("123 Street")).thenReturn(geocodeResponse);

        mockMvc.perform(post("/clinics/{id}/geocode", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("address", "123 Street"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(10.762622))
                .andExpect(jsonPath("$.longitude").value(106.660172));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-024: POST /clinics/{id}/geocode - blank address returns 500 (IllegalArgumentException)")
    void geocodeClinicAddress_blankAddress_returns500() throws Exception {
        UUID clinicId = UUID.randomUUID();

        mockMvc.perform(post("/clinics/{id}/geocode", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("address", ""))))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-025: POST /clinics/{id}/geocode - missing address returns 500 (IllegalArgumentException)")
    void geocodeClinicAddress_missingAddress_returns500() throws Exception {
        UUID clinicId = UUID.randomUUID();

        mockMvc.perform(post("/clinics/{id}/geocode", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isInternalServerError());
    }

    // ==================== DISTANCE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-026: GET /clinics/{id}/distance - calculate distance returns 200")
    void calculateDistance_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        DistanceResponse distanceResponse = DistanceResponse.builder()
                .distance(5.5)
                .unit("km")
                .build();

        when(clinicService.calculateDistance(eq(clinicId), any(BigDecimal.class), any(BigDecimal.class)))
                .thenReturn(distanceResponse);

        mockMvc.perform(get("/clinics/{id}/distance", clinicId)
                        .param("latitude", "10.762622")
                        .param("longitude", "106.660172"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distance").value(5.5))
                .andExpect(jsonPath("$.unit").value("km"));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-027: GET /clinics/{id}/distance - clinic not found returns 404")
    void calculateDistance_clinicNotFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        when(clinicService.calculateDistance(eq(clinicId), any(BigDecimal.class), any(BigDecimal.class)))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(get("/clinics/{id}/distance", clinicId)
                        .param("latitude", "10.762622")
                        .param("longitude", "106.660172"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-028: GET /clinics/{id}/distance - missing latitude returns 400")
    void calculateDistance_missingLatitude_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();

        mockMvc.perform(get("/clinics/{id}/distance", clinicId)
                        .param("longitude", "106.660172"))
                .andExpect(status().isBadRequest());
    }

    // ==================== APPROVE CLINIC TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-029: POST /clinics/{id}/approve - approve clinic returns 200")
    void approveClinic_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        ClinicResponse response = mockClinic(clinicId, "Approved Clinic");
        response.setStatus(ClinicStatus.APPROVED);

        when(clinicService.approveClinic(clinicId)).thenReturn(response);

        mockMvc.perform(post("/clinics/{id}/approve", clinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-030: POST /clinics/{id}/approve - clinic not found returns 404")
    void approveClinic_notFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        when(clinicService.approveClinic(clinicId))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(post("/clinics/{id}/approve", clinicId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-031: POST /clinics/{id}/approve - invalid status returns 400")
    void approveClinic_invalidStatus_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        when(clinicService.approveClinic(clinicId))
                .thenThrow(new BadRequestException("Only PENDING clinics can be approved"));

        mockMvc.perform(post("/clinics/{id}/approve", clinicId))
                .andExpect(status().isBadRequest());
    }

    // ==================== REJECT CLINIC TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-032: POST /clinics/{id}/reject - reject clinic returns 200")
    void rejectClinic_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        ClinicResponse response = mockClinic(clinicId, "Rejected Clinic");
        response.setStatus(ClinicStatus.REJECTED);

        when(clinicService.rejectClinic(eq(clinicId), eq("Invalid information"))).thenReturn(response);

        mockMvc.perform(post("/clinics/{id}/reject", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Invalid information"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-033: POST /clinics/{id}/reject - blank reason returns 500 (IllegalArgumentException)")
    void rejectClinic_blankReason_returns500() throws Exception {
        UUID clinicId = UUID.randomUUID();

        mockMvc.perform(post("/clinics/{id}/reject", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", ""))))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-034: POST /clinics/{id}/reject - missing reason returns 500 (IllegalArgumentException)")
    void rejectClinic_missingReason_returns500() throws Exception {
        UUID clinicId = UUID.randomUUID();

        mockMvc.perform(post("/clinics/{id}/reject", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-035: POST /clinics/{id}/reject - clinic not found returns 404")
    void rejectClinic_notFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        when(clinicService.rejectClinic(eq(clinicId), anyString()))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(post("/clinics/{id}/reject", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Invalid"))))
                .andExpect(status().isNotFound());
    }

    // ==================== GET MY CLINICS TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-036: GET /clinics/owner/my-clinics - get my clinics returns 200")
    void getMyClinics_validRequest_returns200() throws Exception {
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        Page<ClinicResponse> page = new PageImpl<>(List.of(
                mockClinic(UUID.randomUUID(), "My Clinic 1"),
                mockClinic(UUID.randomUUID(), "My Clinic 2")
        ));
        when(clinicService.getClinicsByOwner(eq(user.getUserId()), any())).thenReturn(page);

        mockMvc.perform(get("/clinics/owner/my-clinics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-037: GET /clinics/owner/my-clinics - empty result returns 200")
    void getMyClinics_emptyResult_returns200() throws Exception {
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        Page<ClinicResponse> emptyPage = new PageImpl<>(List.of());
        when(clinicService.getClinicsByOwner(eq(user.getUserId()), any())).thenReturn(emptyPage);

        mockMvc.perform(get("/clinics/owner/my-clinics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    // ==================== UPLOAD IMAGE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-038: POST /clinics/{id}/images - empty file returns 400")
    void uploadClinicImage_emptyFile_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "empty.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                new byte[0]
        );

        doThrow(new BadRequestException("File không được để trống"))
                .when(cloudinaryService).uploadClinicImage(any());

        mockMvc.perform(multipart("/clinics/{id}/images", clinicId)
                        .file(emptyFile))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-039: POST /clinics/{id}/images - clinic not found returns 404")
    void uploadClinicImage_clinicNotFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "image.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-image".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/image.jpg")
                .publicId("publicId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        when(clinicService.uploadClinicImage(eq(clinicId), anyString(), any(), any(), any(), eq(user.getUserId())))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(multipart("/clinics/{id}/images", clinicId)
                        .file(file))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-040: POST /clinics/{id}/images - forbidden (not owner) returns 403")
    void uploadClinicImage_forbidden_returns403() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "image.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-image".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/image.jpg")
                .publicId("publicId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        when(clinicService.uploadClinicImage(eq(clinicId), anyString(), any(), any(), any(), eq(user.getUserId())))
                .thenThrow(new ForbiddenException("You can only upload images for your own clinic"));

        mockMvc.perform(multipart("/clinics/{id}/images", clinicId)
                        .file(file))
                .andExpect(status().isForbidden());
    }

    // ==================== UPLOAD LOGO TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-041: POST /clinics/{id}/logo - upload logo returns 200")
    void uploadClinicLogo_validRequest_returns200() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "logo.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-logo".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/logo.jpg")
                .publicId("logoId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        ClinicResponse resp = mockClinic(clinicId, "With Logo");
        resp.setLogo("http://cloudinary.com/logo.jpg");
        when(clinicService.updateClinicLogo(eq(clinicId), anyString(), eq(user.getUserId())))
                .thenReturn(resp);

        mockMvc.perform(multipart("/clinics/{id}/logo", clinicId)
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logo").value("http://cloudinary.com/logo.jpg"));
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-042: POST /clinics/{id}/logo - clinic not found returns 404")
    void uploadClinicLogo_clinicNotFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "logo.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-logo".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/logo.jpg")
                .publicId("logoId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        when(clinicService.updateClinicLogo(eq(clinicId), anyString(), eq(user.getUserId())))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(multipart("/clinics/{id}/logo", clinicId)
                        .file(file))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-043: POST /clinics/{id}/logo - forbidden (not owner) returns 403")
    void uploadClinicLogo_forbidden_returns403() throws Exception {
        UUID clinicId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "logo.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "fake-logo".getBytes()
        );

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("http://cloudinary.com/logo.jpg")
                .publicId("logoId")
                .build();
        given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

        when(clinicService.updateClinicLogo(eq(clinicId), anyString(), eq(user.getUserId())))
                .thenThrow(new ForbiddenException("You can only update logo for your own clinic"));

        mockMvc.perform(multipart("/clinics/{id}/logo", clinicId)
                        .file(file))
                .andExpect(status().isForbidden());
    }

    // ==================== DELETE IMAGE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-044: DELETE /clinics/{id}/images/{imageId} - image not found returns 404")
    void deleteImage_imageNotFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        doThrow(new ResourceNotFoundException("Clinic image not found"))
                .when(clinicService).deleteClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId()));

        mockMvc.perform(delete("/clinics/{id}/images/{imageId}", clinicId, imageId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-045: DELETE /clinics/{id}/images/{imageId} - forbidden (not owner) returns 403")
    void deleteImage_forbidden_returns403() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        doThrow(new ForbiddenException("You can only delete images from your own clinic"))
                .when(clinicService).deleteClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId()));

        mockMvc.perform(delete("/clinics/{id}/images/{imageId}", clinicId, imageId))
                .andExpect(status().isForbidden());
    }

    // ==================== SET PRIMARY IMAGE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-CLINIC-046: POST /clinics/{id}/images/{imageId}/primary - image not found returns 404")
    void setPrimaryImage_imageNotFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        when(clinicService.setPrimaryClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId())))
                .thenThrow(new ResourceNotFoundException("Clinic image not found"));

        mockMvc.perform(post("/clinics/{id}/images/{imageId}/primary", clinicId, imageId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-047: POST /clinics/{id}/images/{imageId}/primary - forbidden (not owner) returns 403")
    void setPrimaryImage_forbidden_returns403() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        when(clinicService.setPrimaryClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId())))
                .thenThrow(new ForbiddenException("You can only update images for your own clinic"));

        mockMvc.perform(post("/clinics/{id}/images/{imageId}/primary", clinicId, imageId))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TC-UNIT-CLINIC-048: POST /clinics/{id}/images/{imageId}/primary - clinic not found returns 404")
    void setPrimaryImage_clinicNotFound_returns404() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID imageId = UUID.randomUUID();
        User user = mockUser();
        when(authService.getCurrentUser()).thenReturn(user);

        when(clinicService.setPrimaryClinicImage(eq(clinicId), eq(imageId), eq(user.getUserId())))
                .thenThrow(new ResourceNotFoundException("Clinic not found"));

        mockMvc.perform(post("/clinics/{id}/images/{imageId}/primary", clinicId, imageId))
                .andExpect(status().isNotFound());
    }
}

