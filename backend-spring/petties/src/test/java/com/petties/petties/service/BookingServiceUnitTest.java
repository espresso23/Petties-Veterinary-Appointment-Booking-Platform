package com.petties.petties.service;

import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

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
    @Mock
    private VaccinationService vaccinationService;
    @Mock
    private com.petties.petties.mapper.BookingMapper bookingMapper;
    @Mock
    private BookingNotificationService bookingNotificationService;

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
        pet.setSpecies(com.petties.petties.model.enums.PetSpecies.DOG);
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
        service.setIsHomeVisit(true); // HOME_VISIT add-on tests: chỉ dịch vụ tại nhà
    }

    @Nested
    @DisplayName("addServiceToBooking Specialty Validation")
    class AddServiceToBookingTests {

        @Test
        @DisplayName("TC-UNIT-BS-01: Clinic Manager can add any service")
        void addServiceToBooking_ClinicManager_Success() {
            User manager = new User();
            manager.setRole(Role.CLINIC_MANAGER);
            manager.setWorkingClinic(clinic);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(BigDecimal.valueOf(100000));
            when(bookingMapper.mapToResponse(any())).thenReturn(BookingResponse.builder().bookingId(bookingId).build());

            BookingResponse response = bookingService.addServiceToBooking(bookingId, serviceId, manager);

            assertNotNull(response);
            verify(bookingRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-02: Staff Home Visit - Matching specialty success")
        void addServiceToBooking_StaffHomeVisitMatch_Success() {
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.VET);
            staff.setWorkingClinic(clinic);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(BigDecimal.valueOf(100000));
            when(bookingMapper.mapToResponse(any())).thenReturn(BookingResponse.builder().bookingId(bookingId).build());

            BookingResponse response = bookingService.addServiceToBooking(bookingId, serviceId, staff);

            assertNotNull(response);
            verify(bookingRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-03: Staff Home Visit - Mismatching specialty fails")
        void addServiceToBooking_StaffHomeVisitMismatch_Fail() {
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.GROOMER); // Service is SURGERY
            staff.setWorkingClinic(clinic);

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
            staff.setSpecialty(StaffSpecialty.VET);
            staff.setWorkingClinic(clinic);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));
            when(pricingService.calculateServicePrice(any(), any())).thenReturn(BigDecimal.valueOf(100000));
            when(bookingMapper.mapToResponse(any())).thenReturn(BookingResponse.builder().bookingId(bookingId).build());

            BookingResponse response = bookingService.addServiceToBooking(bookingId, serviceId, staff);

            assertNotNull(response);
            verify(bookingRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("TC-UNIT-BS-08: HOME_VISIT cannot add clinic-only service (isHomeVisit=false)")
        void addServiceToBooking_HomeVisit_ClinicOnlyService_Fail() {
            service.setIsHomeVisit(false); // Dịch vụ chỉ tại phòng khám
            User manager = new User();
            manager.setRole(Role.CLINIC_MANAGER);
            manager.setWorkingClinic(clinic);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findById(serviceId)).thenReturn(Optional.of(service));

            Exception exception = assertThrows(IllegalArgumentException.class, () -> {
                bookingService.addServiceToBooking(bookingId, serviceId, manager);
            });

            assertTrue(exception.getMessage().contains("tại nhà"));
        }

        @Test
        @DisplayName("TC-UNIT-BS-09: Staff khác phòng khám không được thêm dịch vụ phát sinh")
        void addServiceToBooking_StaffDifferentClinic_Forbidden() {
            User staff = new User();
            staff.setRole(Role.STAFF);

            Clinic otherClinic = new Clinic();
            otherClinic.setClinicId(UUID.randomUUID());
            staff.setWorkingClinic(otherClinic);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            assertThrows(ForbiddenException.class,
                    () -> bookingService.addServiceToBooking(bookingId, serviceId, staff));
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
            staff.setSpecialty(StaffSpecialty.VET);
            staff.setWorkingClinic(clinic);

            com.petties.petties.model.ClinicService surgeryService = new com.petties.petties.model.ClinicService();
            surgeryService.setServiceId(UUID.randomUUID());
            surgeryService.setServiceCategory(ServiceCategory.SURGERY);
            surgeryService.setName("Surgery");
            surgeryService.setIsHomeVisit(true); // HOME_VISIT booking: chỉ dịch vụ tại nhà

            com.petties.petties.model.ClinicService dentalService = new com.petties.petties.model.ClinicService();
            dentalService.setServiceId(UUID.randomUUID());
            dentalService.setServiceCategory(ServiceCategory.DENTAL);
            dentalService.setName("Dental");
            dentalService.setIsHomeVisit(true);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId))
                    .thenReturn(Arrays.asList(surgeryService, dentalService));
            when(bookingMapper.mapServiceToResponse(surgeryService))
                    .thenReturn(ClinicServiceResponse.builder().name("Surgery").build());
            when(bookingMapper.mapServiceToResponse(dentalService))
                    .thenReturn(ClinicServiceResponse.builder().name("Dental").build());

            List<ClinicServiceResponse> result = bookingService.getAvailableServicesForAddOn(bookingId, staff);

            // VET staff sees both SURGERY and DENTAL (both map to VET specialty)
            assertEquals(2, result.size());
            assertTrue(result.stream().anyMatch(r -> "Surgery".equals(r.getName())));
            assertTrue(result.stream().anyMatch(r -> "Dental".equals(r.getName())));
        }

        @Test
        @DisplayName("TC-UNIT-BS-06: Exclude services already in booking")
        void getAvailableServicesForAddOn_ExcludeExisting() {
            User manager = new User();
            manager.setRole(Role.CLINIC_MANAGER);
            manager.setWorkingClinic(clinic);

            com.petties.petties.model.ClinicService service1 = new com.petties.petties.model.ClinicService();
            service1.setServiceId(serviceId);
            service1.setName("Existing");
            service1.setIsHomeVisit(true); // booking type HOME_VISIT trong setUp

            com.petties.petties.model.ClinicService service2 = new com.petties.petties.model.ClinicService();
            service2.setServiceId(UUID.randomUUID());
            service2.setName("New");
            service2.setIsHomeVisit(true);

            // Mock existing service in booking
            BookingServiceItem item = new BookingServiceItem();
            item.setService(service1);
            booking.getBookingServices().add(item);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId))
                    .thenReturn(Arrays.asList(service1, service2));
            when(bookingMapper.mapServiceToResponse(service2))
                    .thenReturn(ClinicServiceResponse.builder().name("New").build());

            List<ClinicServiceResponse> result = bookingService.getAvailableServicesForAddOn(bookingId, manager);

            assertEquals(1, result.size());
            assertEquals("New", result.get(0).getName());
        }

        @Test
        @DisplayName("TC-UNIT-BS-07: SOS booking should return all services regardless of staff specialty")
        void getAvailableServicesForAddOn_SOS_AllServices() {
            booking.setType(com.petties.petties.model.enums.BookingType.SOS);
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setSpecialty(StaffSpecialty.VET); // Only derma, but SOS
            staff.setWorkingClinic(clinic);

            com.petties.petties.model.ClinicService surgery = new com.petties.petties.model.ClinicService();
            surgery.setServiceCategory(ServiceCategory.SURGERY);
            surgery.setName("Surgery");

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinicId))
                    .thenReturn(Arrays.asList(surgery));
            when(bookingMapper.mapServiceToResponse(surgery))
                    .thenReturn(ClinicServiceResponse.builder().name("Surgery").build());

            List<ClinicServiceResponse> result = bookingService.getAvailableServicesForAddOn(bookingId, staff);

            assertEquals(1, result.size());
            assertEquals("Surgery", result.get(0).getName());
        }

        @Test
        @DisplayName("TC-UNIT-BS-10: Khác phòng khám không được xem dịch vụ phát sinh khả dụng")
        void getAvailableServicesForAddOn_DifferentClinic_Forbidden() {
            User staff = new User();
            staff.setRole(Role.STAFF);

            Clinic otherClinic = new Clinic();
            otherClinic.setClinicId(UUID.randomUUID());
            staff.setWorkingClinic(otherClinic);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            assertThrows(ForbiddenException.class,
                    () -> bookingService.getAvailableServicesForAddOn(bookingId, staff));
        }
    }

    @Nested
    @DisplayName("removeServiceFromBooking Permission Validation")
    class RemoveServiceFromBookingTests {

        @Test
        @DisplayName("TC-UNIT-BS-11: Staff cùng phòng khám có thể xóa dịch vụ phát sinh khi IN_PROGRESS")
        void removeServiceFromBooking_SameClinicStaff_Success() {
            UUID bookingServiceId = UUID.randomUUID();
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setWorkingClinic(clinic);

            BookingServiceItem addOnItem = new BookingServiceItem();
            addOnItem.setBookingServiceId(bookingServiceId);
            addOnItem.setService(service);
            addOnItem.setIsAddOn(true);
            addOnItem.setWeightPrice(BigDecimal.valueOf(100000));
            booking.setTotalPrice(BigDecimal.valueOf(100000));
            booking.getBookingServices().add(addOnItem);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(bookingMapper.mapToResponse(any())).thenReturn(BookingResponse.builder().bookingId(bookingId).build());

            BookingResponse response = bookingService.removeServiceFromBooking(bookingId, bookingServiceId);

            assertNotNull(response);
            verify(bookingServiceItemRepository).delete(addOnItem);
        }

        @Test
        @DisplayName("TC-UNIT-BS-12: Không thể xóa dịch vụ phát sinh sau khi booking đã hoàn tất")
        void removeServiceFromBooking_Completed_Fails() {
            UUID bookingServiceId = UUID.randomUUID();
            User staff = new User();
            staff.setRole(Role.STAFF);
            staff.setWorkingClinic(clinic);

            BookingServiceItem addOnItem = new BookingServiceItem();
            addOnItem.setBookingServiceId(bookingServiceId);
            addOnItem.setService(service);
            addOnItem.setIsAddOn(true);
            addOnItem.setWeightPrice(BigDecimal.valueOf(100000));
            booking.setStatus(BookingStatus.COMPLETED);
            booking.getBookingServices().add(addOnItem);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            assertThrows(IllegalStateException.class,
                    () -> bookingService.removeServiceFromBooking(bookingId, bookingServiceId));
        }
    }

    @Nested
    @DisplayName("processCheckout Tests")
    class ProcessCheckoutTests {

        @Mock
        private com.petties.petties.dto.booking.CheckoutRequest checkoutRequest;

        @Test
        @DisplayName("TC-UNIT-BS-13: Standard checkout success")
        void processCheckout_Standard_Success() {
            User staff = new User();
            staff.setUserId(UUID.randomUUID());
            booking.setStatus(BookingStatus.IN_PROGRESS);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(bookingMapper.mapToResponse(any()))
                    .thenReturn(BookingResponse.builder().status(BookingStatus.COMPLETED).build());

            BookingResponse response = bookingService.processCheckout(bookingId, checkoutRequest, staff);

            assertEquals(BookingStatus.COMPLETED, response.getStatus());
            verify(bookingRepository).save(booking);
        }

        @Test
        @DisplayName("TC-UNIT-BS-14: SOS checkout with fee override")
        void processCheckout_SOS_WithOverride() {
            User staff = new User();
            staff.setUserId(UUID.randomUUID());
            booking.setType(BookingType.SOS);
            booking.setStatus(BookingStatus.IN_PROGRESS);
            booking.setSosFee(new BigDecimal("100000"));
            booking.setTotalPrice(new BigDecimal("100000")); // Only fee, no services yet

            BigDecimal newFee = new BigDecimal("150000");
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(checkoutRequest.getOverriddenSosFee()).thenReturn(newFee);
            when(bookingMapper.mapToResponse(any())).thenAnswer(invocation -> {
                Booking b = invocation.getArgument(0);
                return BookingResponse.builder()
                        .status(b.getStatus())
                        .sosFee(b.getSosFee())
                        .totalPrice(b.getTotalPrice())
                        .build();
            });

            BookingResponse response = bookingService.processCheckout(bookingId, checkoutRequest, staff);

            assertEquals(BookingStatus.COMPLETED, response.getStatus());
            assertEquals(newFee, response.getSosFee());
            assertEquals(newFee, response.getTotalPrice());
            verify(bookingRepository).save(booking);
        }

        @Test
        @DisplayName("TC-UNIT-BS-15: Checkout fails for invalid status")
        void processCheckout_InvalidStatus_Fails() {
            User staff = new User();
            booking.setStatus(BookingStatus.PENDING); // Not valid for checkout

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            assertThrows(IllegalStateException.class, () -> {
                bookingService.processCheckout(bookingId, checkoutRequest, staff);
            });
        }
    }

    @Nested
    @DisplayName("confirmBooking Logic")
    class ConfirmBookingTests {

        @Test
        @DisplayName("Confirm Booking - Success and Trigger Vaccination Draft")
        void confirmBooking_Success_TriggersVaccinationDraft() {
            // Arrange
            booking.setStatus(BookingStatus.PENDING);
            booking.setBookingDate(LocalDate.now().plusDays(1)); // Future

            com.petties.petties.model.ClinicService vaccineService = new com.petties.petties.model.ClinicService();
            vaccineService.setName("Rabies");
            vaccineService.setServiceCategory(ServiceCategory.VACCINATION);

            BookingServiceItem item = new BookingServiceItem();
            item.setService(vaccineService);
            booking.getBookingServices().add(item);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(bookingRepository.save(any())).thenReturn(booking);
            when(staffAssignmentService.assignStaffToAllServices(any()))
                    .thenReturn(Map.of(UUID.randomUUID(), new User()));

            // Act
            bookingService.confirmBooking(bookingId, null);

            // Assert
            assertEquals(com.petties.petties.model.enums.BookingStatus.CONFIRMED, booking.getStatus());
            verify(vaccinationService, times(1)).createDraftFromBooking(eq(booking), eq(item));
            verify(bookingRepository).save(booking);
        }
    }
}
