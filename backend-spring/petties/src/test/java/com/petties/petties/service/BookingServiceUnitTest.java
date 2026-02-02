package com.petties.petties.service;

import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BookingService Specialty Validation Unit Tests")
class BookingServiceUnitTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ClinicServiceRepository clinicServiceRepository;
    @Mock
    private PricingService pricingService;
    @Mock
    private BookingServiceItemRepository bookingServiceItemRepository;
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

    @InjectMocks
    private BookingService bookingService;

    private UUID bookingId;
    private UUID serviceId;
    private UUID clinicId;
    private Booking booking;
    private com.petties.petties.model.ClinicService service;
    private Clinic clinic;
    private Pet pet;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        serviceId = UUID.randomUUID();
        clinicId = UUID.randomUUID();

        clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setName("Test Clinic");
        clinic.setAddress("Test Address");

        pet = new Pet();
        pet.setId(UUID.randomUUID());
        pet.setName("Test Pet");
        pet.setSpecies("Dog");
        pet.setBreed("Golden Retriever");
        pet.setDateOfBirth(java.time.LocalDate.now().minusYears(2));
        pet.setWeight(10.0);

        // Create mock pet owner - required by mapToResponse
        User petOwner = new User();
        petOwner.setUserId(UUID.randomUUID());
        petOwner.setFullName("Pet Owner");
        petOwner.setPhone("0123456789");
        petOwner.setEmail("owner@test.com");

        booking = new Booking();
        booking.setBookingId(bookingId);
        booking.setBookingCode("BK-TEST-001");
        booking.setClinic(clinic);
        booking.setPet(pet);
        booking.setPetOwner(petOwner);
        booking.setStatus(BookingStatus.IN_PROGRESS);
        booking.setType(BookingType.HOME_VISIT);
        booking.setBookingServices(new ArrayList<>());
        booking.setTotalPrice(BigDecimal.ZERO);
        booking.setBookingDate(java.time.LocalDate.now());
        booking.setBookingTime(java.time.LocalTime.of(9, 0));

        service = new com.petties.petties.model.ClinicService();
        service.setServiceId(serviceId);
        service.setClinic(clinic);
        service.setName("Test Surgery");
        service.setBasePrice(BigDecimal.valueOf(100000));
        service.setIsActive(true);
        service.setServiceCategory(ServiceCategory.SURGERY);
        service.setDurationTime(30);
    }

    @Nested
    @DisplayName("addServiceToBooking Specialty Validation")
    class AddServiceToBookingTests {

        @Test
        @DisplayName("TC-UNIT-BS-01: Clinic Manager can add any service")
        void addServiceToBooking_ClinicManager_Success() {
            User manager = new User();
            manager.setRole(Role.CLINIC_MANAGER);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(BigDecimal.valueOf(100000));

            BookingResponse response = bookingService.addServiceToBooking(bookingId, serviceId, manager);

            assertNotNull(response);
            verify(bookingRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-02: Staff Home Visit - Matching specialty success")
        void addServiceToBooking_StaffHomeVisitMatch_Success() {
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.VET_SURGERY);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(BigDecimal.valueOf(100000));

            BookingResponse response = bookingService.addServiceToBooking(bookingId, serviceId, staff);

            assertNotNull(response);
            verify(bookingRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-03: Staff Home Visit - Mismatching specialty fails")
        void addServiceToBooking_StaffHomeVisitMismatch_Fail() {
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.VET_DENTAL); // Service is SURGERY

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));

            Exception exception = assertThrows(IllegalArgumentException.class, () -> {
                bookingService.addServiceToBooking(bookingId, serviceId, staff);
            });

            assertTrue(exception.getMessage().contains("nằm ngoài chuyên môn"));
        }

        @Test
        @DisplayName("TC-UNIT-BS-04: Staff General Home Visit - Success for any service")
        void addServiceToBooking_StaffGeneral_Success() {
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.VET_GENERAL);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(BigDecimal.valueOf(100000));

            BookingResponse response = bookingService.addServiceToBooking(bookingId, serviceId, staff);

            assertNotNull(response);
            verify(bookingRepository, times(1)).save(any());
        }
    }

    @Nested
    @DisplayName("getAvailableServicesForAddOn Filtering")
    class GetAvailableServicesTests {

        @Test
        @DisplayName("TC-UNIT-BS-05: Filter available services by specialty for Staff")
        void getAvailableServicesForAddOn_FilterBySpecialty() {
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.VET_SURGERY);

            com.petties.petties.model.ClinicService surgeryService = new com.petties.petties.model.ClinicService();
            surgeryService.setServiceId(UUID.randomUUID());
            surgeryService.setServiceCategory(ServiceCategory.SURGERY);
            surgeryService.setName("Surgery");

            com.petties.petties.model.ClinicService dentalService = new com.petties.petties.model.ClinicService();
            dentalService.setServiceId(UUID.randomUUID());
            dentalService.setServiceCategory(ServiceCategory.DENTAL);
            dentalService.setName("Dental");

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId))
                    .thenReturn(Arrays.asList(surgeryService, dentalService));

            List<ClinicServiceResponse> result = bookingService.getAvailableServicesForAddOn(bookingId, staff);

            assertEquals(1, result.size());
            assertEquals("Surgery", result.get(0).getName());
        }

        @Test
        @DisplayName("TC-UNIT-BS-06: Exclude services already in booking")
        void getAvailableServicesForAddOn_ExcludeExisting() {
            User manager = new User();
            manager.setRole(Role.CLINIC_MANAGER);

            com.petties.petties.model.ClinicService service1 = new com.petties.petties.model.ClinicService();
            service1.setServiceId(serviceId);
            service1.setName("Existing");

            com.petties.petties.model.ClinicService service2 = new com.petties.petties.model.ClinicService();
            service2.setServiceId(UUID.randomUUID());
            service2.setName("New");

            // Mock existing service in booking
            BookingServiceItem item = new BookingServiceItem();
            item.setService(service1);
            booking.getBookingServices().add(item);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId))
                    .thenReturn(Arrays.asList(service1, service2));

            List<ClinicServiceResponse> result = bookingService.getAvailableServicesForAddOn(bookingId, manager);

            assertEquals(1, result.size());
            assertEquals("New", result.get(0).getName());
        }
    }
}
