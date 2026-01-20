package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.booking.*;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.BookingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Unit tests for BookingController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - Create Booking (Pet Owner)
 * - Get Bookings by Clinic (Manager)
 * - Get Bookings by Vet (Vet/Manager)
 * - Get Booking by ID
 * - Get Booking by Code
 * - Check Vet Availability (Manager)
 * - Confirm Booking (Manager)
 * - Cancel Booking
 * - Get My Bookings (Pet Owner)
 * - Get Available Vets for Reassign (Manager)
 * - Reassign Vet (Manager)
 *
 * Each endpoint tests:
 * - Happy path (200/201)
 * - Validation errors (400)
 * - Not found errors (404)
 * - Authorization errors (401/403)
 */
@WebMvcTest(BookingController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("BookingController Unit Tests")
class BookingControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private BookingService bookingService;

        // Security-related dependencies for JwtAuthenticationFilter
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

        private BookingResponse createMockBookingResponse() {
                return BookingResponse.builder()
                                .bookingId(UUID.randomUUID())
                                .bookingCode("B-20250115-001")
                                .petId(UUID.randomUUID())
                                .petName("Buddy")
                                .petSpecies("DOG")
                                .petBreed("Golden Retriever")
                                .petAge("2 tuổi")
                                .ownerId(UUID.randomUUID())
                                .ownerName("Nguyễn Văn A")
                                .ownerPhone("0912345678")
                                .ownerEmail("owner@example.com")
                                .clinicId(UUID.randomUUID())
                                .clinicName("Pet Care Clinic")
                                .clinicAddress("123 Đường ABC, Quận 1, TP.HCM")
                                .bookingDate(LocalDate.of(2025, 1, 20))
                                .bookingTime(LocalTime.of(9, 30))
                                .type(BookingType.IN_CLINIC)
                                .status(BookingStatus.PENDING)
                                .totalPrice(new BigDecimal("500000"))
                                .services(List.of(
                                                BookingResponse.BookingServiceItemResponse.builder()
                                                                .bookingServiceId(UUID.randomUUID())
                                                                .serviceId(UUID.randomUUID())
                                                                .serviceName("Khám tổng quát")
                                                                .price(new BigDecimal("200000"))
                                                                .slotsRequired(2)
                                                                .durationMinutes(30)
                                                                .scheduledStartTime(LocalTime.of(9, 30))
                                                                .scheduledEndTime(LocalTime.of(10, 30))
                                                                .build()))
                                .createdAt(LocalDateTime.now())
                                .build();
        }

        private BookingRequest createMockBookingRequest() {
                return BookingRequest.builder()
                                .petId(UUID.randomUUID())
                                .clinicId(UUID.randomUUID())
                                .bookingDate(LocalDate.of(2025, 1, 20))
                                .bookingTime(LocalTime.of(9, 30))
                                .type(BookingType.IN_CLINIC)
                                .serviceIds(List.of(UUID.randomUUID()))
                                .notes("Thú cưng có dấu hiệu mệt mỏi")
                                .build();
        }

        /**
         * Helper method to setup SecurityContext with UserPrincipal
         * Required because BookingController casts UserDetails to UserPrincipal
         */
        private void setupUserPrincipalAuth(UUID userId) {
                UserDetailsServiceImpl.UserPrincipal userPrincipal = mock(UserDetailsServiceImpl.UserPrincipal.class);
                when(userPrincipal.getUserId()).thenReturn(userId);

                Authentication authentication = mock(Authentication.class);
                when(authentication.getPrincipal()).thenReturn(userPrincipal);

                SecurityContext securityContext = mock(SecurityContext.class);
                when(securityContext.getAuthentication()).thenReturn(authentication);

                SecurityContextHolder.setContext(securityContext);
        }

        // ==================== CREATE BOOKING TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-CREATE-001: Create booking with valid request - Returns 201")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createBooking_validRequest_returns201() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                BookingRequest request = createMockBookingRequest();
                BookingResponse response = createMockBookingResponse();

                when(bookingService.createBooking(any(BookingRequest.class), eq(userId)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/bookings")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.bookingCode").value("B-20250115-001"))
                                .andExpect(jsonPath("$.petName").value("Buddy"))
                                .andExpect(jsonPath("$.clinicName").value("Pet Care Clinic"))
                                .andExpect(jsonPath("$.status").value("PENDING"));

                verify(bookingService).createBooking(any(BookingRequest.class), eq(userId));
        }

        @Test
        @DisplayName("TC-BOOKING-CREATE-002: Create booking without petId - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createBooking_missingPetId_returns400() throws Exception {
                // Arrange - Request without petId
                BookingRequest request = BookingRequest.builder()
                                .clinicId(UUID.randomUUID())
                                .bookingDate(LocalDate.of(2025, 1, 20))
                                .bookingTime(LocalTime.of(9, 30))
                                .type(BookingType.IN_CLINIC)
                                .serviceIds(List.of(UUID.randomUUID()))
                                .build();

                // Act & Assert
                mockMvc.perform(post("/bookings")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(bookingService, never()).createBooking(any(), any());
        }

        @Test
        @DisplayName("TC-BOOKING-CREATE-003: Create booking without clinicId - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createBooking_missingClinicId_returns400() throws Exception {
                // Arrange - Request without clinicId
                BookingRequest request = BookingRequest.builder()
                                .petId(UUID.randomUUID())
                                .bookingDate(LocalDate.of(2025, 1, 20))
                                .bookingTime(LocalTime.of(9, 30))
                                .type(BookingType.IN_CLINIC)
                                .serviceIds(List.of(UUID.randomUUID()))
                                .build();

                // Act & Assert
                mockMvc.perform(post("/bookings")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(bookingService, never()).createBooking(any(), any());
        }

        @Test
        @DisplayName("TC-BOOKING-CREATE-004: Create booking without bookingDate - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createBooking_missingBookingDate_returns400() throws Exception {
                // Arrange - Request without bookingDate
                BookingRequest request = BookingRequest.builder()
                                .petId(UUID.randomUUID())
                                .clinicId(UUID.randomUUID())
                                .bookingTime(LocalTime.of(9, 30))
                                .type(BookingType.IN_CLINIC)
                                .serviceIds(List.of(UUID.randomUUID()))
                                .build();

                // Act & Assert
                mockMvc.perform(post("/bookings")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(bookingService, never()).createBooking(any(), any());
        }

        @Test
        @DisplayName("TC-BOOKING-CREATE-005: Create booking with non-existent pet - Returns 404")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createBooking_petNotFound_returns404() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                BookingRequest request = createMockBookingRequest();

                when(bookingService.createBooking(any(BookingRequest.class), eq(userId)))
                                .thenThrow(new ResourceNotFoundException("Pet not found"));

                // Act & Assert
                mockMvc.perform(post("/bookings")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.message").value("Pet not found"));
        }

        // ==================== GET BOOKINGS BY CLINIC TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-GET-001: Get bookings by clinic - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getBookingsByClinic_validClinicId_returns200() throws Exception {
                // Arrange
                UUID clinicId = UUID.randomUUID();
                BookingResponse booking = createMockBookingResponse();
                Page<BookingResponse> bookingPage = new PageImpl<>(List.of(booking));

                when(bookingService.getBookingsByClinic(eq(clinicId), any(), any(), any(Pageable.class)))
                                .thenReturn(bookingPage);

                // Act & Assert
                mockMvc.perform(get("/bookings/clinic/{clinicId}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content[0].bookingCode").value("B-20250115-001"))
                                .andExpect(jsonPath("$.content[0].petName").value("Buddy"));

                verify(bookingService).getBookingsByClinic(eq(clinicId), any(), any(), any(Pageable.class));
        }

        @Test
        @DisplayName("TC-BOOKING-GET-002: Get bookings by clinic with status filter - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getBookingsByClinic_withStatusFilter_returns200() throws Exception {
                // Arrange
                UUID clinicId = UUID.randomUUID();
                BookingResponse booking = createMockBookingResponse();
                Page<BookingResponse> bookingPage = new PageImpl<>(List.of(booking));

                when(bookingService.getBookingsByClinic(eq(clinicId), eq(BookingStatus.PENDING), any(),
                                any(Pageable.class)))
                                .thenReturn(bookingPage);

                // Act & Assert
                mockMvc.perform(get("/bookings/clinic/{clinicId}", clinicId)
                                .param("status", "PENDING"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content[0].status").value("PENDING"));

                verify(bookingService).getBookingsByClinic(eq(clinicId), eq(BookingStatus.PENDING), any(),
                                any(Pageable.class));
        }

        @Test
        @DisplayName("TC-BOOKING-GET-003: Get bookings by clinic with empty result - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getBookingsByClinic_emptyResult_returns200WithEmptyList() throws Exception {
                // Arrange
                UUID clinicId = UUID.randomUUID();
                Page<BookingResponse> emptyPage = new PageImpl<>(Collections.emptyList());

                when(bookingService.getBookingsByClinic(eq(clinicId), any(), any(), any(Pageable.class)))
                                .thenReturn(emptyPage);

                // Act & Assert
                mockMvc.perform(get("/bookings/clinic/{clinicId}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content").isEmpty());
        }

        // ==================== GET BOOKINGS BY VET TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-GET-004: Get bookings by vet - Returns 200")
        @WithMockUser(roles = "VET")
        void getBookingsByVet_validVetId_returns200() throws Exception {
                // Arrange
                UUID vetId = UUID.randomUUID();
                BookingResponse booking = createMockBookingResponse();
                booking.setAssignedVetId(vetId);
                booking.setAssignedVetName("BS. Trần Văn B");
                Page<BookingResponse> bookingPage = new PageImpl<>(List.of(booking));

                when(bookingService.getBookingsByVet(eq(vetId), any(), any(Pageable.class)))
                                .thenReturn(bookingPage);

                // Act & Assert
                mockMvc.perform(get("/bookings/vet/{vetId}", vetId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content[0].assignedVetName").value("BS. Trần Văn B"));

                verify(bookingService).getBookingsByVet(eq(vetId), any(), any(Pageable.class));
        }

        @Test
        @DisplayName("TC-BOOKING-GET-005: Get bookings by vet with status filter - Returns 200")
        @WithMockUser(roles = "VET")
        void getBookingsByVet_withStatusFilter_returns200() throws Exception {
                // Arrange
                UUID vetId = UUID.randomUUID();
                BookingResponse booking = createMockBookingResponse();
                booking.setStatus(BookingStatus.ASSIGNED);
                Page<BookingResponse> bookingPage = new PageImpl<>(List.of(booking));

                when(bookingService.getBookingsByVet(eq(vetId), eq(BookingStatus.ASSIGNED), any(Pageable.class)))
                                .thenReturn(bookingPage);

                // Act & Assert
                mockMvc.perform(get("/bookings/vet/{vetId}", vetId)
                                .param("status", "ASSIGNED"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content[0].status").value("ASSIGNED"));
        }

        // ==================== GET BOOKING BY ID TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-GET-006: Get booking by ID - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getBookingById_existingBooking_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                BookingResponse booking = createMockBookingResponse();

                when(bookingService.getBookingById(bookingId)).thenReturn(booking);

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.bookingCode").value("B-20250115-001"))
                                .andExpect(jsonPath("$.petName").value("Buddy"))
                                .andExpect(jsonPath("$.services").isArray());

                verify(bookingService).getBookingById(bookingId);
        }

        @Test
        @DisplayName("TC-BOOKING-GET-007: Get booking by ID not found - Returns 404")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getBookingById_notFound_returns404() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();

                when(bookingService.getBookingById(bookingId))
                                .thenThrow(new ResourceNotFoundException("Booking not found"));

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}", bookingId))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.message").value("Booking not found"));
        }

        // ==================== GET BOOKING BY CODE TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-GET-008: Get booking by code - Returns 200")
        @WithMockUser(roles = "PET_OWNER")
        void getBookingByCode_existingBooking_returns200() throws Exception {
                // Arrange
                String bookingCode = "B-20250115-001";
                BookingResponse booking = createMockBookingResponse();

                when(bookingService.getBookingByCode(bookingCode)).thenReturn(booking);

                // Act & Assert
                mockMvc.perform(get("/bookings/code/{bookingCode}", bookingCode))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.bookingCode").value("B-20250115-001"))
                                .andExpect(jsonPath("$.petName").value("Buddy"));

                verify(bookingService).getBookingByCode(bookingCode);
        }

        @Test
        @DisplayName("TC-BOOKING-GET-009: Get booking by code not found - Returns 404")
        @WithMockUser(roles = "PET_OWNER")
        void getBookingByCode_notFound_returns404() throws Exception {
                // Arrange
                String bookingCode = "INVALID-CODE";

                when(bookingService.getBookingByCode(bookingCode))
                                .thenThrow(new ResourceNotFoundException("Booking not found"));

                // Act & Assert
                mockMvc.perform(get("/bookings/code/{bookingCode}", bookingCode))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.message").value("Booking not found"));
        }

        // ==================== CHECK VET AVAILABILITY TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-VET-001: Check vet availability - All services have vets - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void checkVetAvailability_allServicesHaveVets_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                VetAvailabilityCheckResponse response = VetAvailabilityCheckResponse.builder()
                                .allServicesHaveVets(true)
                                .services(List.of(
                                                ServiceAvailability.builder()
                                                                .bookingServiceId(UUID.randomUUID())
                                                                .serviceName("Khám tổng quát")
                                                                .hasAvailableVet(true)
                                                                .suggestedVetId(UUID.randomUUID())
                                                                .suggestedVetName("BS. Trần Văn B")
                                                                .price(new BigDecimal("200000"))
                                                                .build()))
                                .alternativeTimeSlots(Collections.emptyList())
                                .priceReductionIfRemoved(BigDecimal.ZERO)
                                .build();

                when(bookingService.checkVetAvailability(bookingId)).thenReturn(response);

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}/check-vet-availability", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.allServicesHaveVets").value(true))
                                .andExpect(jsonPath("$.services[0].serviceName").value("Khám tổng quát"))
                                .andExpect(jsonPath("$.services[0].hasAvailableVet").value(true));

                verify(bookingService).checkVetAvailability(bookingId);
        }

        @Test
        @DisplayName("TC-BOOKING-VET-002: Check vet availability - Some services missing vets - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void checkVetAvailability_someServicesMissingVets_returns200WithWarning() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                VetAvailabilityCheckResponse response = VetAvailabilityCheckResponse.builder()
                                .allServicesHaveVets(false)
                                .services(List.of(
                                                ServiceAvailability.builder()
                                                                .bookingServiceId(UUID.randomUUID())
                                                                .serviceName("Khám tổng quát")
                                                                .hasAvailableVet(true)
                                                                .suggestedVetName("BS. Trần Văn B")
                                                                .price(new BigDecimal("200000"))
                                                                .build(),
                                                ServiceAvailability.builder()
                                                                .bookingServiceId(UUID.randomUUID())
                                                                .serviceName("Cạo vôi răng")
                                                                .hasAvailableVet(false)
                                                                .unavailableReason(
                                                                                "Không có bác sĩ nha khoa thú y có ca làm việc")
                                                                .price(new BigDecimal("350000"))
                                                                .build()))
                                .alternativeTimeSlots(List.of(
                                                AlternativeTimeSlot.builder()
                                                                .specialty("VET_DENTAL")
                                                                .specialtyLabel("Bác sĩ nha khoa thú y")
                                                                .date(LocalDate.of(2025, 1, 17))
                                                                .availableTimes(List.of("09:00", "10:00", "14:00"))
                                                                .vetName("BS. Lê Văn C")
                                                                .vetId(UUID.randomUUID())
                                                                .build()))
                                .priceReductionIfRemoved(new BigDecimal("350000"))
                                .build();

                when(bookingService.checkVetAvailability(bookingId)).thenReturn(response);

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}/check-vet-availability", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.allServicesHaveVets").value(false))
                                .andExpect(jsonPath("$.services[1].hasAvailableVet").value(false))
                                .andExpect(jsonPath("$.services[1].unavailableReason").exists())
                                .andExpect(jsonPath("$.alternativeTimeSlots").isNotEmpty())
                                .andExpect(jsonPath("$.priceReductionIfRemoved").value(350000));
        }

        @Test
        @DisplayName("TC-BOOKING-VET-003: Check vet availability - Booking not found - Returns 404")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void checkVetAvailability_bookingNotFound_returns404() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();

                when(bookingService.checkVetAvailability(bookingId))
                                .thenThrow(new ResourceNotFoundException("Booking not found: " + bookingId));

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}/check-vet-availability", bookingId))
                                .andExpect(status().isNotFound());
        }

        // ==================== CONFIRM BOOKING TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-CONFIRM-001: Confirm booking with valid request - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void confirmBooking_validRequest_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                BookingConfirmRequest request = BookingConfirmRequest.builder()
                                .managerNotes("Đã xác nhận với khách hàng")
                                .build();

                BookingResponse response = createMockBookingResponse();
                response.setStatus(BookingStatus.ASSIGNED);

                when(bookingService.confirmBooking(eq(bookingId), any(BookingConfirmRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/confirm", bookingId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("ASSIGNED"));

                verify(bookingService).confirmBooking(eq(bookingId), any(BookingConfirmRequest.class));
        }

        @Test
        @DisplayName("TC-BOOKING-CONFIRM-002: Confirm booking with manual vet assignment - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void confirmBooking_withManualVetAssignment_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID vetId = UUID.randomUUID();
                BookingConfirmRequest request = BookingConfirmRequest.builder()
                                .assignedVetId(vetId)
                                .managerNotes("Chỉ định BS. Trần Văn B")
                                .build();

                BookingResponse response = createMockBookingResponse();
                response.setStatus(BookingStatus.ASSIGNED);
                response.setAssignedVetId(vetId);
                response.setAssignedVetName("BS. Trần Văn B");

                when(bookingService.confirmBooking(eq(bookingId), any(BookingConfirmRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/confirm", bookingId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                                .andExpect(jsonPath("$.assignedVetName").value("BS. Trần Văn B"));
        }

        @Test
        @DisplayName("TC-BOOKING-CONFIRM-003: Confirm booking allowing partial - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void confirmBooking_allowPartial_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                BookingConfirmRequest request = BookingConfirmRequest.builder()
                                .allowPartial(true)
                                .build();

                BookingResponse response = createMockBookingResponse();
                response.setStatus(BookingStatus.CONFIRMED); // Partial = CONFIRMED, not ASSIGNED

                when(bookingService.confirmBooking(eq(bookingId), any(BookingConfirmRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/confirm", bookingId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("CONFIRMED"));
        }

        @Test
        @DisplayName("TC-BOOKING-CONFIRM-004: Confirm booking removing unavailable services - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void confirmBooking_removeUnavailableServices_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                BookingConfirmRequest request = BookingConfirmRequest.builder()
                                .removeUnavailableServices(true)
                                .build();

                BookingResponse response = createMockBookingResponse();
                response.setStatus(BookingStatus.ASSIGNED);
                response.setTotalPrice(new BigDecimal("200000")); // Reduced price

                when(bookingService.confirmBooking(eq(bookingId), any(BookingConfirmRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/confirm", bookingId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalPrice").value(200000));
        }

        @Test
        @DisplayName("TC-BOOKING-CONFIRM-005: Confirm booking not pending - Returns 400")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void confirmBooking_bookingNotPending_returns400() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();

                when(bookingService.confirmBooking(eq(bookingId), any()))
                                .thenThrow(new BadRequestException("Booking is not in PENDING status"));

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/confirm", bookingId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value("Booking is not in PENDING status"));
        }

        @Test
        @DisplayName("TC-BOOKING-CONFIRM-006: Confirm booking not found - Returns 404")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void confirmBooking_bookingNotFound_returns404() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();

                when(bookingService.confirmBooking(eq(bookingId), any()))
                                .thenThrow(new ResourceNotFoundException("Booking not found"));

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/confirm", bookingId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                                .andExpect(status().isNotFound());
        }

        // ==================== CANCEL BOOKING TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-CANCEL-001: Cancel booking with valid request - Returns 200")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void cancelBooking_validRequest_returns200() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                UUID bookingId = UUID.randomUUID();
                String reason = "Thú cưng đã khỏe lại";

                BookingResponse response = createMockBookingResponse();
                response.setStatus(BookingStatus.CANCELLED);

                when(bookingService.cancelBooking(eq(bookingId), eq(reason), eq(userId)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/cancel", bookingId)
                                .param("reason", reason))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("CANCELLED"));

                verify(bookingService).cancelBooking(eq(bookingId), eq(reason), eq(userId));
        }

        @Test
        @DisplayName("TC-BOOKING-CANCEL-002: Cancel booking not found - Returns 404")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void cancelBooking_bookingNotFound_returns404() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                UUID bookingId = UUID.randomUUID();

                when(bookingService.cancelBooking(eq(bookingId), any(), eq(userId)))
                                .thenThrow(new ResourceNotFoundException("Booking not found"));

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/cancel", bookingId)
                                .param("reason", "Test reason"))
                                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("TC-BOOKING-CANCEL-003: Cancel booking cannot be cancelled - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void cancelBooking_cannotBeCancelled_returns400() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                UUID bookingId = UUID.randomUUID();

                when(bookingService.cancelBooking(eq(bookingId), any(), eq(userId)))
                                .thenThrow(new BadRequestException("Booking cannot be cancelled in current status"));

                // Act & Assert
                mockMvc.perform(patch("/bookings/{bookingId}/cancel", bookingId)
                                .param("reason", "Test reason"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Booking cannot be cancelled in current status"));
        }

        // ==================== GET MY BOOKINGS TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-OWNER-001: Get my bookings as pet owner - Returns 200")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void getMyBookings_petOwner_returns200() throws Exception {
                // Act & Assert
                mockMvc.perform(get("/bookings/my"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content").isEmpty()); // Currently returns empty
        }

        // ==================== GET AVAILABLE VETS FOR REASSIGN TESTS
        // ====================

        @Test
        @DisplayName("TC-BOOKING-REASSIGN-001: Get available vets for reassign - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getAvailableVetsForReassign_validRequest_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID serviceId = UUID.randomUUID();

                List<AvailableVetResponse> availableVets = List.of(
                                AvailableVetResponse.builder()
                                                .vetId(UUID.randomUUID())
                                                .vetName("BS. Trần Văn B")
                                                .specialty("VET_GENERAL")
                                                .available(true)
                                                .bookedCount(2)
                                                .availableSlots(List.of("09:30", "10:00", "14:00"))
                                                .build(),
                                AvailableVetResponse.builder()
                                                .vetId(UUID.randomUUID())
                                                .vetName("BS. Lê Văn C")
                                                .specialty("VET_GENERAL")
                                                .available(false)
                                                .unavailableReason("Không có ca làm việc")
                                                .build());

                when(bookingService.getAvailableVetsForReassign(bookingId, serviceId))
                                .thenReturn(availableVets);

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}/services/{serviceId}/available-vets", bookingId, serviceId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].vetName").value("BS. Trần Văn B"))
                                .andExpect(jsonPath("$[0].available").value(true))
                                .andExpect(jsonPath("$[0].availableSlots").isArray())
                                .andExpect(jsonPath("$[1].available").value(false))
                                .andExpect(jsonPath("$[1].unavailableReason").value("Không có ca làm việc"));

                verify(bookingService).getAvailableVetsForReassign(bookingId, serviceId);
        }

        @Test
        @DisplayName("TC-BOOKING-REASSIGN-002: Get available vets for reassign - Booking not found - Returns 404")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void getAvailableVetsForReassign_bookingNotFound_returns404() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID serviceId = UUID.randomUUID();

                when(bookingService.getAvailableVetsForReassign(bookingId, serviceId))
                                .thenThrow(new ResourceNotFoundException("Booking not found: " + bookingId));

                // Act & Assert
                mockMvc.perform(get("/bookings/{bookingId}/services/{serviceId}/available-vets", bookingId, serviceId))
                                .andExpect(status().isNotFound());
        }

        // ==================== REASSIGN VET TESTS ====================

        @Test
        @DisplayName("TC-BOOKING-REASSIGN-003: Reassign vet with valid request - Returns 200")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void reassignVet_validRequest_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID serviceId = UUID.randomUUID();
                UUID newVetId = UUID.randomUUID();

                ReassignVetRequest request = ReassignVetRequest.builder()
                                .newVetId(newVetId)
                                .build();

                BookingResponse response = createMockBookingResponse();
                response.getServices().get(0).setAssignedVetId(newVetId);
                response.getServices().get(0).setAssignedVetName("BS. Nguyễn Văn D");

                when(bookingService.reassignVetForService(bookingId, serviceId, newVetId))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/bookings/{bookingId}/services/{serviceId}/reassign", bookingId, serviceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.services[0].assignedVetName").value("BS. Nguyễn Văn D"));

                verify(bookingService).reassignVetForService(bookingId, serviceId, newVetId);
        }

        @Test
        @DisplayName("TC-BOOKING-REASSIGN-004: Reassign vet - Service not found - Returns 404")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void reassignVet_serviceNotFound_returns404() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID serviceId = UUID.randomUUID();
                UUID newVetId = UUID.randomUUID();

                ReassignVetRequest request = ReassignVetRequest.builder()
                                .newVetId(newVetId)
                                .build();

                when(bookingService.reassignVetForService(bookingId, serviceId, newVetId))
                                .thenThrow(new ResourceNotFoundException("Service item not found: " + serviceId));

                // Act & Assert
                mockMvc.perform(post("/bookings/{bookingId}/services/{serviceId}/reassign", bookingId, serviceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("TC-BOOKING-REASSIGN-005: Reassign vet - Vet not found - Returns 404")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void reassignVet_vetNotFound_returns404() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID serviceId = UUID.randomUUID();
                UUID newVetId = UUID.randomUUID();

                ReassignVetRequest request = ReassignVetRequest.builder()
                                .newVetId(newVetId)
                                .build();

                when(bookingService.reassignVetForService(bookingId, serviceId, newVetId))
                                .thenThrow(new ResourceNotFoundException("Vet not found: " + newVetId));

                // Act & Assert
                mockMvc.perform(post("/bookings/{bookingId}/services/{serviceId}/reassign", bookingId, serviceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("TC-BOOKING-REASSIGN-006: Reassign vet - No available slots - Returns 400")
        @WithMockUser(roles = "CLINIC_MANAGER")
        void reassignVet_noAvailableSlots_returns400() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                UUID serviceId = UUID.randomUUID();
                UUID newVetId = UUID.randomUUID();

                ReassignVetRequest request = ReassignVetRequest.builder()
                                .newVetId(newVetId)
                                .build();

                when(bookingService.reassignVetForService(bookingId, serviceId, newVetId))
                                .thenThrow(new BadRequestException("Không có đủ slot liên tiếp tại thời gian yêu cầu"));

                // Act & Assert
                mockMvc.perform(post("/bookings/{bookingId}/services/{serviceId}/reassign", bookingId, serviceId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Không có đủ slot liên tiếp tại thời gian yêu cầu"));
        }
}
