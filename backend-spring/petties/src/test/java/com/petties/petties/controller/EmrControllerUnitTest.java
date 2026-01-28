package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.emr.*;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.CloudinaryService;
import com.petties.petties.service.EmrService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for EmrController using @WebMvcTest and MockMvc.
 *
 * Test Coverage:
 * 1. Create EMR (VET only)
 * 2. Update EMR (VET only, within 24h, creator only)
 * 3. Upload EMR Image (VET only)
 * 4. Get EMR by ID
 * 5. Get EMR by Pet ID (Medical History)
 * 6. Get EMR by Booking ID
 *
 * Edge Cases:
 * - Authorization checks (VET vs PET_OWNER vs CLINIC_MANAGER)
 * - Validation errors (missing required fields)
 * - Not found scenarios
 * - Update restrictions (24h window, creator-only)
 */
@WebMvcTest(EmrController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("EmrController Unit Tests")
class EmrControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmrService emrService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private CloudinaryService cloudinaryService;

    // Security-related dependencies
    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @MockitoBean
    private com.petties.petties.repository.UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // ==================== HELPER METHODS ====================

    private CreateEmrRequest createMockEmrRequest() {
        return CreateEmrRequest.builder()
                .petId(UUID.randomUUID())
                .bookingId(UUID.randomUUID())
                .subjective("Mệt mỏi, Chán ăn")
                .assessment("Nhiễm khuẩn đường ruột")
                .plan("Kháng sinh + bồi phục")
                .notes("Theo dõi trong 3 ngày")
                .prescriptions(Arrays.asList(PrescriptionDto.builder()
                        .medicineName("Amoxicillin")
                        .dosage("250mg")
                        .frequency("2 lần/ngày")
                        .durationDays(5)
                        .instructions("Uống sau ăn")
                        .build()))
                .reExaminationDate(LocalDateTime.now().plusDays(7))
                .images(Arrays.asList(EmrImageDto.builder()
                        .url("https://example.com/xray1.jpg")
                        .description("X-ray")
                        .build()))
                .build();
    }

    private EmrResponse createMockEmrResponse() {
        return EmrResponse.builder()
                .id("emr_123456")
                .petId(UUID.randomUUID())
                .petName("Buddy")
                .bookingId(UUID.randomUUID())
                .vetId(UUID.randomUUID())
                .vetName("BS. Nguyễn Văn A")
                .clinicId(UUID.randomUUID())
                .clinicName("Pet Care Clinic")
                .examinationDate(LocalDateTime.now())
                .subjective("Mệt mỏi, Chán ăn")
                .assessment("Nhiễm khuẩn đường ruột")
                .plan("Kháng sinh + bồi phục")
                .notes("Theo dõi trong 3 ngày")
                .prescriptions(Arrays.asList(PrescriptionDto.builder()
                        .medicineName("Amoxicillin")
                        .dosage("250mg")
                        .frequency("2 lần/ngày")
                        .durationDays(5)
                        .instructions("Uống sau ăn")
                        .build()))
                .reExaminationDate(LocalDateTime.now().plusDays(7))
                .images(Arrays.asList(EmrImageDto.builder()
                        .url("https://example.com/xray1.jpg")
                        .description("X-ray")
                        .build()))
                .build();
    }

    private User createMockVet() {
        User vet = new User();
        vet.setUserId(UUID.randomUUID());
        vet.setFullName("BS. Nguyễn Văn A");
        return vet;
    }

    // ==================== CREATE EMR TESTS ====================

    @Test
    @DisplayName("TC-EMR-CREATE-001: Create EMR with valid request - Returns 200")
    @WithMockUser(roles = "VET")
    void createEmr_validRequest_returns200() throws Exception {
        // Arrange
        CreateEmrRequest request = createMockEmrRequest();
        EmrResponse response = createMockEmrResponse();
        User mockVet = createMockVet();

        when(authService.getCurrentUser()).thenReturn(mockVet);
        when(emrService.createEmr(any(CreateEmrRequest.class), eq(mockVet.getUserId())))
                .thenReturn(response);

        // Act & Assert
        mockMvc.perform(post("/emr")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("emr_123456"))
                .andExpect(jsonPath("$.petName").value("Buddy"))
                .andExpect(jsonPath("$.assessment").value("Nhiễm khuẩn đường ruột"))
                .andExpect(jsonPath("$.prescriptions").exists());

        verify(emrService).createEmr(any(CreateEmrRequest.class), eq(mockVet.getUserId()));
    }

    @Test
    @DisplayName("TC-EMR-CREATE-002: Create EMR with missing petId - Returns 400")
    @WithMockUser(roles = "VET")
    void createEmr_missingPetId_returns400() throws Exception {
        // Arrange - Request without petId
        CreateEmrRequest request = CreateEmrRequest.builder()
                .bookingId(UUID.randomUUID())
                .subjective("Mệt mỏi")
                .assessment("Test")
                .build();

        // Act & Assert
        mockMvc.perform(post("/emr")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(emrService, never()).createEmr(any(), any());
    }

    @Test
    @DisplayName("TC-EMR-CREATE-004: Create EMR with non-existent pet - Returns 404")
    @WithMockUser(roles = "VET")
    void createEmr_petNotFound_returns404() throws Exception {
        // Arrange
        CreateEmrRequest request = createMockEmrRequest();
        User mockVet = createMockVet();

        when(authService.getCurrentUser()).thenReturn(mockVet);
        when(emrService.createEmr(any(CreateEmrRequest.class), any()))
                .thenThrow(new ResourceNotFoundException("Pet not found"));

        // Act & Assert
        mockMvc.perform(post("/emr")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Pet not found"));
    }

    // ==================== UPDATE EMR TESTS ====================

    @Test
    @DisplayName("TC-EMR-UPDATE-001: Update EMR within 24h by creator - Returns 200")
    @WithMockUser(roles = "VET")
    void updateEmr_validRequest_returns200() throws Exception {
        // Arrange
        String emrId = "emr_123456";
        CreateEmrRequest request = createMockEmrRequest();
        EmrResponse response = createMockEmrResponse();
        User mockVet = createMockVet();

        when(authService.getCurrentUser()).thenReturn(mockVet);
        when(emrService.updateEmr(eq(emrId), any(CreateEmrRequest.class), eq(mockVet.getUserId())))
                .thenReturn(response);

        // Act & Assert
        mockMvc.perform(put("/emr/{emrId}", emrId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(emrId));

        verify(emrService).updateEmr(eq(emrId), any(CreateEmrRequest.class), eq(mockVet.getUserId()));
    }

    @Test
    @DisplayName("TC-EMR-UPDATE-002: Update EMR after 24h - Returns 400")
    @WithMockUser(roles = "VET")
    void updateEmr_after24Hours_returns400() throws Exception {
        // Arrange
        String emrId = "emr_123456";
        CreateEmrRequest request = createMockEmrRequest();
        User mockVet = createMockVet();

        when(authService.getCurrentUser()).thenReturn(mockVet);
        when(emrService.updateEmr(eq(emrId), any(CreateEmrRequest.class), any()))
                .thenThrow(new BadRequestException("Cannot edit EMR after 24 hours"));

        // Act & Assert
        mockMvc.perform(put("/emr/{emrId}", emrId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot edit EMR after 24 hours"));
    }

    @Test
    @DisplayName("TC-EMR-UPDATE-003: Update EMR by non-creator vet - Returns 400")
    @WithMockUser(roles = "VET")
    void updateEmr_byNonCreator_returns400() throws Exception {
        // Arrange
        String emrId = "emr_123456";
        CreateEmrRequest request = createMockEmrRequest();
        User mockVet = createMockVet();

        when(authService.getCurrentUser()).thenReturn(mockVet);
        when(emrService.updateEmr(eq(emrId), any(CreateEmrRequest.class), any()))
                .thenThrow(new BadRequestException("Only creator vet can edit EMR"));

        // Act & Assert
        mockMvc.perform(put("/emr/{emrId}", emrId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only creator vet can edit EMR"));
    }

    // ==================== UPLOAD IMAGE TESTS ====================

    @Test
    @DisplayName("TC-EMR-UPLOAD-001: Upload EMR image successfully - Returns 200")
    @WithMockUser(roles = "VET")
    void uploadEmrImage_validFile_returns200() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "xray.jpg",
                "image/jpeg",
                "test image content".getBytes());

        UploadResponse uploadResponse = UploadResponse.builder()
                .url("https://cloudinary.com/emr/xray_12345.jpg")
                .publicId("emr/xray_12345")
                .build();

        when(cloudinaryService.uploadEmrImage(any())).thenReturn(uploadResponse);

        // Act & Assert
        mockMvc.perform(multipart("/emr/upload-image")
                .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://cloudinary.com/emr/xray_12345.jpg"))
                .andExpect(jsonPath("$.publicId").value("emr/xray_12345"));

        verify(cloudinaryService).uploadEmrImage(any());
    }

    // ==================== GET EMR BY ID TESTS ====================

    @Test
    @DisplayName("TC-EMR-GET-001: Get EMR by ID as VET - Returns 200")
    @WithMockUser(roles = "VET")
    void getEmrById_asVet_returns200() throws Exception {
        // Arrange
        String emrId = "emr_123456";
        EmrResponse response = createMockEmrResponse();

        when(emrService.getEmrById(emrId)).thenReturn(response);

        // Act & Assert
        mockMvc.perform(get("/emr/{emrId}", emrId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(emrId))
                .andExpect(jsonPath("$.petName").value("Buddy"));

        verify(emrService).getEmrById(emrId);
    }

    @Test
    @DisplayName("TC-EMR-GET-002: Get EMR by ID as PET_OWNER - Returns 200")
    @WithMockUser(roles = "PET_OWNER")
    void getEmrById_asPetOwner_returns200() throws Exception {
        // Arrange
        String emrId = "emr_123456";
        EmrResponse response = createMockEmrResponse();

        when(emrService.getEmrById(emrId)).thenReturn(response);

        // Act & Assert
        mockMvc.perform(get("/emr/{emrId}", emrId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(emrId));

        verify(emrService).getEmrById(emrId);
    }

    @Test
    @DisplayName("TC-EMR-GET-003: Get non-existent EMR - Returns 404")
    @WithMockUser(roles = "VET")
    void getEmrById_notFound_returns404() throws Exception {
        // Arrange
        String emrId = "emr_nonexistent";

        when(emrService.getEmrById(emrId))
                .thenThrow(new ResourceNotFoundException("EMR not found: " + emrId));

        // Act & Assert
        mockMvc.perform(get("/emr/{emrId}", emrId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("EMR not found: " + emrId));
    }

    // ==================== GET EMR BY PET ID TESTS ====================

    @Test
    @DisplayName("TC-EMR-HISTORY-001: Get medical history for pet - Returns 200 with list")
    @WithMockUser(roles = "PET_OWNER")
    void getEmrsByPetId_withHistory_returns200() throws Exception {
        // Arrange
        UUID petId = UUID.randomUUID();
        List<EmrResponse> emrList = Arrays.asList(
                createMockEmrResponse(),
                createMockEmrResponse());

        when(emrService.getEmrsByPetId(petId)).thenReturn(emrList);

        // Act & Assert
        mockMvc.perform(get("/emr/pet/{petId}", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2));

        verify(emrService).getEmrsByPetId(petId);
    }

    @Test
    @DisplayName("TC-EMR-HISTORY-002: Get medical history for pet with no records - Returns 200 with empty list")
    @WithMockUser(roles = "VET")
    void getEmrsByPetId_noHistory_returns200WithEmptyList() throws Exception {
        // Arrange
        UUID petId = UUID.randomUUID();

        when(emrService.getEmrsByPetId(petId)).thenReturn(Collections.emptyList());

        // Act & Assert
        mockMvc.perform(get("/emr/pet/{petId}", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));

        verify(emrService).getEmrsByPetId(petId);
    }

    // ==================== GET EMR BY BOOKING ID TESTS ====================

    @Test
    @DisplayName("TC-EMR-BOOKING-001: Get EMR by booking ID - Returns 200")
    @WithMockUser(roles = "CLINIC_MANAGER")
    void getEmrByBookingId_found_returns200() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();
        EmrResponse response = createMockEmrResponse();
        response.setBookingId(bookingId);

        when(emrService.getEmrByBookingId(bookingId)).thenReturn(response);

        // Act & Assert
        mockMvc.perform(get("/emr/booking/{bookingId}", bookingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingId").value(bookingId.toString()));

        verify(emrService).getEmrByBookingId(bookingId);
    }

    @Test
    @DisplayName("TC-EMR-BOOKING-002: Get EMR for booking with no EMR - Returns 404")
    @WithMockUser(roles = "VET")
    void getEmrByBookingId_notFound_returns404() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();

        when(emrService.getEmrByBookingId(bookingId))
                .thenThrow(new ResourceNotFoundException("No EMR found for booking: " + bookingId));

        // Act & Assert
        mockMvc.perform(get("/emr/booking/{bookingId}", bookingId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No EMR found for booking: " + bookingId));
    }
}
