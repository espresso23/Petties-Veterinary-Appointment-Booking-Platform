package com.petties.petties.service;

import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.PetServiceItemRequest;
import com.petties.petties.mapper.BookingMapper;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BookingService Retry Logic Tests")
class BookingServiceRetryLogicTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ClinicServiceRepository clinicServiceRepository;
    @Mock
    private PricingService pricingService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private PetRepository petRepository;
    @Mock
    private ClinicRepository clinicRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private StaffAssignmentService staffAssignmentService;
    @Mock
    private EmrRecordRepository emrRecordRepository;
    @Mock
    private BookingServiceItemRepository bookingServiceItemRepository;

    @Mock
    private BookingMapper bookingMapper;

    @Mock
    private BookingNotificationService bookingNotificationService;

    @Mock
    private SseEmitterService sseEmitterService;

    @InjectMocks
    private BookingService bookingService;

    private Pet pet;
    private User petOwner;
    private Clinic clinic;
    private com.petties.petties.model.ClinicService service;

    @BeforeEach
    void setUp() {
        pet = new Pet();
        pet.setId(UUID.randomUUID());
        pet.setWeight(5.0);

        petOwner = new User();
        petOwner.setUserId(UUID.randomUUID());
        petOwner.setRole(Role.PET_OWNER);
        pet.setUser(petOwner);

        clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());

        service = new com.petties.petties.model.ClinicService();
        service.setServiceId(UUID.randomUUID());
        service.setName("Vaccination");
        service.setBasePrice(new BigDecimal("100000"));
        service.setServiceCategory(ServiceCategory.VACCINATION);
        service.setClinic(clinic);

        // Mock bookingMapper to return non-null response (lenient to avoid
        // UnnecessaryStubbingException)
        lenient().when(bookingMapper.mapToResponse(any(Booking.class))).thenAnswer(invocation -> {
            Booking b = invocation.getArgument(0);
            return BookingResponse.builder()
                    .bookingId(b.getBookingId())
                    .bookingCode(b.getBookingCode())
                    .status(b.getStatus())
                    .type(b.getType())
                    .build();
        });
    }

    @Nested
    @DisplayName("Booking Code Collision Retry Tests")
    class BookingCodeRetryTests {

        @Test
        @DisplayName("TC-UNIT-BS-10: Retry on booking_code collision - Success on 2nd attempt")
        void createBooking_BookingCodeCollision_RetriesAndSucceeds() {
            // Arrange
            when(petRepository.findById(any())).thenReturn(Optional.of(pet));
            when(userRepository.findById(any())).thenReturn(Optional.of(petOwner));
            when(clinicRepository.findById(any())).thenReturn(Optional.of(clinic));
            when(clinicServiceRepository.findAllById(any())).thenReturn(List.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(new BigDecimal("100000"));
            when(pricingService.calculateBookingDistanceFee(any(), any(), any())).thenReturn(BigDecimal.ZERO);

            // Mock booking code generation
            when(bookingRepository.countByClinicAndDate(any(), any())).thenReturn(0L);
            when(bookingRepository.findByBookingCode(any())).thenReturn(Optional.empty());

            // First save throws DataIntegrityViolationException with booking_code
            // constraint
            DataIntegrityViolationException exception = mock(DataIntegrityViolationException.class);
            when(exception.getMostSpecificCause()).thenReturn(
                    new RuntimeException("duplicate key value violates unique constraint \"booking_code_key\""));

            Booking savedBooking = Booking.builder()
                    .bookingCode("BK-20260204-0002")
                    .build();

            when(bookingRepository.save(any(Booking.class)))
                    .thenThrow(exception) // First attempt fails
                    .thenReturn(savedBooking); // Second attempt succeeds

            // Act
            BookingRequest request = new BookingRequest();
            request.setPetId(pet.getId());
            request.setClinicId(clinic.getClinicId());
            request.setServiceIds(List.of(service.getServiceId()));
            request.setBookingDate(LocalDate.of(2026, 2, 4));
            request.setBookingTime(LocalTime.of(9, 0));
            request.setType(BookingType.IN_CLINIC);

            BookingResponse response = bookingService.createBooking(request, petOwner.getUserId());

            // Assert
            assertNotNull(response);
            verify(bookingRepository, times(2)).save(any(Booking.class)); // 2 attempts
            verify(notificationService, times(1)).sendBookingNotificationToClinic(any()); // Only after success
        }

        @Test
        @DisplayName("TC-UNIT-BS-11: Retry on booking_code collision - Fails after max retries")
        void createBooking_BookingCodeCollision_FailsAfterMaxRetries() {
            // Arrange
            when(petRepository.findById(any())).thenReturn(Optional.of(pet));
            when(userRepository.findById(any())).thenReturn(Optional.of(petOwner));
            when(clinicRepository.findById(any())).thenReturn(Optional.of(clinic));
            when(clinicServiceRepository.findAllById(any())).thenReturn(List.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(new BigDecimal("100000"));
            when(pricingService.calculateBookingDistanceFee(any(), any(), any())).thenReturn(BigDecimal.ZERO);

            when(bookingRepository.countByClinicAndDate(any(), any())).thenReturn(0L);
            when(bookingRepository.findByBookingCode(any())).thenReturn(Optional.empty());

            // All save attempts throw booking_code collision
            DataIntegrityViolationException exception = mock(DataIntegrityViolationException.class);
            when(exception.getMostSpecificCause()).thenReturn(
                    new RuntimeException("duplicate key value violates unique constraint \"booking_code_key\""));
            when(bookingRepository.save(any(Booking.class))).thenThrow(exception);

            // Act & Assert
            BookingRequest request = new BookingRequest();
            request.setPetId(pet.getId());
            request.setClinicId(clinic.getClinicId());
            request.setServiceIds(List.of(service.getServiceId()));
            request.setBookingDate(LocalDate.of(2026, 2, 4));
            request.setBookingTime(LocalTime.of(9, 0));
            request.setType(BookingType.IN_CLINIC);

            RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
                bookingService.createBooking(request, petOwner.getUserId());
            });

            assertTrue(thrown.getMessage().contains("Không thể tạo mã booking")
                    || thrown.getMessage().contains("booking_code"));
            verify(bookingRepository, times(3)).save(any(Booking.class)); // 3 attempts
            verify(notificationService, never()).sendBookingNotificationToClinic(any()); // No notification on failure
        }

        @Test
        @DisplayName("TC-UNIT-BS-12: DataIntegrityViolation on unique_active_booking - No retry")
        void createBooking_DuplicateActiveBooking_ThrowsImmediately() {
            // Arrange
            when(petRepository.findById(any())).thenReturn(Optional.of(pet));
            when(userRepository.findById(any())).thenReturn(Optional.of(petOwner));
            when(clinicRepository.findById(any())).thenReturn(Optional.of(clinic));
            when(clinicServiceRepository.findAllById(any())).thenReturn(List.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(new BigDecimal("100000"));
            when(pricingService.calculateBookingDistanceFee(any(), any(), any())).thenReturn(BigDecimal.ZERO);

            when(bookingRepository.countByClinicAndDate(any(), any())).thenReturn(0L);
            when(bookingRepository.findByBookingCode(any())).thenReturn(Optional.empty());

            // Save throws unique_active_booking_per_pet_time constraint violation
            DataIntegrityViolationException exception = mock(DataIntegrityViolationException.class);
            when(exception.getMostSpecificCause()).thenReturn(
                    new RuntimeException(
                            "duplicate key value violates unique index \"unique_active_booking_per_pet_time\""));
            when(bookingRepository.save(any(Booking.class))).thenThrow(exception);

            // Act & Assert
            BookingRequest request = new BookingRequest();
            request.setPetId(pet.getId());
            request.setClinicId(clinic.getClinicId());
            request.setServiceIds(List.of(service.getServiceId()));
            request.setBookingDate(LocalDate.of(2026, 2, 4));
            request.setBookingTime(LocalTime.of(9, 0));
            request.setType(BookingType.IN_CLINIC);

            // Should immediately throw without retry (not a booking_code issue)
            assertThrows(DataIntegrityViolationException.class, () -> {
                bookingService.createBooking(request, petOwner.getUserId());
            });

            verify(bookingRepository, times(1)).save(any(Booking.class)); // Only 1 attempt, no retry
            verify(notificationService, never()).sendBookingNotificationToClinic(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-13: Notification sent only after successful save")
        void createBooking_Success_NotificationSentAfterSave() {
            // Arrange
            when(petRepository.findById(any())).thenReturn(Optional.of(pet));
            when(userRepository.findById(any())).thenReturn(Optional.of(petOwner));
            when(clinicRepository.findById(any())).thenReturn(Optional.of(clinic));
            when(clinicServiceRepository.findAllById(any())).thenReturn(List.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(new BigDecimal("100000"));
            when(pricingService.calculateBookingDistanceFee(any(), any(), any())).thenReturn(BigDecimal.ZERO);

            when(bookingRepository.countByClinicAndDate(any(), any())).thenReturn(0L);
            when(bookingRepository.findByBookingCode(any())).thenReturn(Optional.empty());

            Booking savedBooking = Booking.builder()
                    .bookingCode("BK-20260204-0001")
                    .build();
            when(bookingRepository.save(any(Booking.class))).thenReturn(savedBooking);

            // Act
            BookingRequest request = new BookingRequest();
            request.setPetId(pet.getId());
            request.setClinicId(clinic.getClinicId());
            request.setServiceIds(List.of(service.getServiceId()));
            request.setBookingDate(LocalDate.of(2026, 2, 4));
            request.setBookingTime(LocalTime.of(9, 0));
            request.setType(BookingType.IN_CLINIC);

            BookingResponse response = bookingService.createBooking(request, petOwner.getUserId());

            // Assert
            assertNotNull(response);

            // Verify order of calls: save happens BEFORE notification
            var inOrder = inOrder(bookingRepository, notificationService);
            inOrder.verify(bookingRepository).save(any(Booking.class));
            inOrder.verify(notificationService).sendBookingNotificationToClinic(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-14: Multi-pet booking - each BookingServiceItem has correct pet")
        void createBooking_multiPet_setsPetOnEachItem() {
            // Arrange: two pets, two services (pet1 -> svc1, pet2 -> svc2)
            Pet pet2 = new Pet();
            pet2.setId(UUID.randomUUID());
            pet2.setWeight(3.0);
            pet2.setUser(petOwner);

            com.petties.petties.model.ClinicService service2 = new com.petties.petties.model.ClinicService();
            service2.setServiceId(UUID.randomUUID());
            service2.setName("Khám tổng quát");
            service2.setClinic(clinic);

            when(petRepository.findById(pet.getId())).thenReturn(Optional.of(pet));
            when(petRepository.findById(pet2.getId())).thenReturn(Optional.of(pet2));
            when(userRepository.findById(any())).thenReturn(Optional.of(petOwner));
            when(clinicRepository.findById(any())).thenReturn(Optional.of(clinic));
            when(clinicServiceRepository.findAllById(any())).thenReturn(List.of(service, service2));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(new BigDecimal("150000"));
            when(pricingService.calculateBookingDistanceFee(any(), any(), any())).thenReturn(BigDecimal.ZERO);
            when(bookingRepository.countByClinicAndDate(any(), any())).thenReturn(0L);
            when(bookingRepository.findByBookingCode(any())).thenReturn(Optional.empty());

            Booking savedBooking = Booking.builder()
                    .bookingCode("BK-20260208-0001")
                    .build();
            when(bookingRepository.save(any(Booking.class))).thenReturn(savedBooking);

            BookingRequest request = new BookingRequest();
            request.setClinicId(clinic.getClinicId());
            request.setBookingDate(LocalDate.of(2026, 2, 8));
            request.setBookingTime(LocalTime.of(9, 0));
            request.setType(BookingType.IN_CLINIC);
            request.setItems(List.of(
                    PetServiceItemRequest.builder().petId(pet.getId()).serviceIds(List.of(service.getServiceId())).build(),
                    PetServiceItemRequest.builder().petId(pet2.getId()).serviceIds(List.of(service2.getServiceId())).build()
            ));

            // Act
            bookingService.createBooking(request, petOwner.getUserId());

            // Assert: captured booking has 2 items, first item has pet, second has pet2
            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            Booking saved = captor.getValue();
            assertNotNull(saved.getBookingServices());
            assertEquals(2, saved.getBookingServices().size());
            assertEquals(pet.getId(), saved.getBookingServices().get(0).getPet().getId());
            assertEquals(pet2.getId(), saved.getBookingServices().get(1).getPet().getId());
            assertEquals(pet.getId(), saved.getPet().getId()); // primary pet = first in items
        }
    }
}
