package com.petties.petties.service;

import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.CheckoutRequest;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import com.petties.petties.mapper.BookingMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SOS Booking Flow - Comprehensive Unit Tests")
class SosBookingUnitTest {

    @Mock
    private ClinicPriceService clinicPriceService;

    @InjectMocks
    private PricingService pricingService;

    @Mock
    private PricingService pricingServiceMock;

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private StaffShiftRepository staffShiftRepository;
    @Mock
    private SlotRepository slotRepository;

    @Mock
    private SosSessionManager sosSessionManagerForStaffAssignment; // Use a distinct name or just another mock

    @InjectMocks
    private StaffAssignmentService staffAssignmentService;

    @Mock
    private StaffAssignmentService staffAssignmentServiceMock;

    @Mock
    private ClinicServiceRepository clinicServiceRepository;
    @Mock
    private BookingMapper bookingMapper;
    @Mock
    private BookingNotificationService bookingNotificationService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private SosSessionManager sosSessionManager;
    @Mock
    private PaymentRepository paymentRepository;
    @InjectMocks
    private BookingService bookingService;

    private UUID clinicId;
    private UUID staffId;
    private UUID bookingId;
    private User staff;
    private Booking sosBooking;
    private LocalDate today = LocalDate.now();
    private LocalTime nowTime = LocalTime.of(10, 0);

    @BeforeEach
    void setUp() {
        clinicId = UUID.randomUUID();
        staffId = UUID.randomUUID();
        bookingId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        staff = new User();
        staff.setUserId(staffId);
        staff.setRole(Role.STAFF);
        staff.setSpecialty(StaffSpecialty.VET);
        staff.setFullName("SOS Staff");

        User petOwner = new User();
        petOwner.setUserId(UUID.randomUUID());
        petOwner.setRole(Role.PET_OWNER);

        sosBooking = new Booking();
        sosBooking.setBookingId(bookingId);
        sosBooking.setType(BookingType.SOS);
        sosBooking.setClinic(clinic);
        sosBooking.setPetOwner(petOwner);
        sosBooking.setBookingDate(today);
        sosBooking.setBookingTime(nowTime);
        sosBooking.setStatus(BookingStatus.IN_PROGRESS);
        sosBooking.setBookingServices(new ArrayList<>());

        lenient().when(paymentRepository.findByBookingBookingId(any(UUID.class))).thenReturn(Optional.empty());
        lenient().when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Nested
    @DisplayName("1. SOS Pricing Logic")
    class SosPricingTests {

        @Test
        @DisplayName("TC-SOS-PRICE-01: calculateSOSFee should return configured fee from clinic")
        void calculateSOSFee_ReturnsClinicConfig() {
            BigDecimal expectedFee = new BigDecimal("500000");
            when(clinicPriceService.getSosFee(clinicId)).thenReturn(Optional.of(expectedFee));

            BigDecimal actualFee = pricingService.calculateSOSFee(clinicId);
            assertEquals(expectedFee, actualFee);
        }

        @Test
        @DisplayName("TC-SOS-PRICE-02: calculateBookingDistanceFee should be ZERO for SOS bookings")
        void calculateDistanceFee_ShouldBeZeroForSos() {
            BigDecimal result = pricingService.calculateBookingDistanceFee(clinicId, new BigDecimal("10.5"),
                    BookingType.SOS);
            assertEquals(BigDecimal.ZERO, result);
        }
    }

    @Nested
    @DisplayName("2. SOS Staff Assignment (Bypass Specialty)")
    class SosAssignmentTests {

        @Test
        @DisplayName("TC-SOS-ASGN-01: autoAssignStaff should pick available staff regardless of specialty")
        void autoAssignStaff_BypassesSpecialty() {
            when(userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF))
                    .thenReturn(List.of(staff));

            StaffShift shift = StaffShift.builder()
                    .shiftId(UUID.randomUUID())
                    .clinic(sosBooking.getClinic())
                    .staff(staff)
                    .workDate(today)
                    .startTime(LocalTime.of(8, 0))
                    .endTime(LocalTime.of(17, 0))
                    .build();
            lenient().when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staffId, today))
                    .thenReturn(List.of(shift));

            User assignedStaff = staffAssignmentService.autoAssignStaff(sosBooking);

            assertNotNull(assignedStaff);
            assertEquals(staffId, assignedStaff.getUserId());
        }
    }

    @Nested
    @DisplayName("3. SOS Checkout Logic (Fee Override)")
    class SosCheckoutTests {

        @Test
        @DisplayName("TC-SOS-CKOUT-01: processCheckout should allow overriding SOS Fee")
        void processCheckout_SupportsFeeOverride() {
            CheckoutRequest request = new CheckoutRequest();
            BigDecimal overriddenFee = new BigDecimal("300000");
            request.setOverriddenSosFee(overriddenFee);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
            when(bookingMapper.mapToResponse(any())).thenAnswer(inv -> {
                Booking b = inv.getArgument(0);
                return BookingResponse.builder()
                        .bookingId(b.getBookingId())
                        .sosFee(b.getSosFee())
                        .totalPrice(b.getTotalPrice())
                        .status(b.getStatus())
                        .build();
            });

            BookingResponse response = bookingService.processCheckout(bookingId, request, staff);

            assertNotNull(response);
            assertEquals(overriddenFee, response.getSosFee());
            assertEquals(overriddenFee, response.getTotalPrice());
            assertEquals(BookingStatus.COMPLETED, response.getStatus());
            verify(bookingRepository).save(sosBooking);
        }

        @Test
        @DisplayName("TC-SOS-CKOUT-02: processCheckout should use automated fee if not overridden")
        void processCheckout_UsesAutomatedFee() {
            BigDecimal automatedFee = new BigDecimal("500000");
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
            when(pricingServiceMock.calculateSOSFee(clinicId)).thenReturn(automatedFee);
            when(bookingMapper.mapToResponse(any())).thenAnswer(inv -> {
                Booking b = inv.getArgument(0);
                return BookingResponse.builder()
                        .bookingId(b.getBookingId())
                        .sosFee(b.getSosFee())
                        .totalPrice(b.getTotalPrice())
                        .status(b.getStatus())
                        .build();
            });

            BookingResponse response = bookingService.processCheckout(bookingId, null, staff);

            assertNotNull(response);
            assertEquals(automatedFee, response.getSosFee());
            assertEquals(automatedFee, response.getTotalPrice());
            assertEquals(BookingStatus.COMPLETED, response.getStatus());
            verify(bookingRepository).save(sosBooking);
        }
    }

    @Nested
    @DisplayName("4. Cancellation Logic")
    class CancellationTests {

        @Test
        @DisplayName("TC-CANCEL-01: canBeCancelled should be true for PENDING or CONFIRMED")
        void canBeCancelled_PendingOrConfirmed_ReturnsTrue() {
            sosBooking.setStatus(BookingStatus.PENDING);
            assertTrue(sosBooking.canBeCancelled());

            sosBooking.setStatus(BookingStatus.CONFIRMED);
            assertTrue(sosBooking.canBeCancelled());
        }

        @Test
        @DisplayName("TC-CANCEL-02: canBeCancelled should be true for SOS IN_PROGRESS without arrivedAt")
        void canBeCancelled_SosInProgressNoArrivedAt_ReturnsTrue() {
            sosBooking.setType(BookingType.SOS);
            sosBooking.setStatus(BookingStatus.IN_PROGRESS);
            sosBooking.setArrivedAt(null);
            assertTrue(sosBooking.canBeCancelled());
        }

        @Test
        @DisplayName("TC-CANCEL-03: canBeCancelled should be true for SOS IN_PROGRESS even with arrivedAt")
        void canBeCancelled_SosInProgressWithArrivedAt_ReturnsTrue() {
            sosBooking.setType(BookingType.SOS);
            sosBooking.setStatus(BookingStatus.IN_PROGRESS);
            sosBooking.setArrivedAt(java.time.LocalDateTime.now());
            assertTrue(sosBooking.canBeCancelled());
        }

        @Test
        @DisplayName("TC-CANCEL-04: cancelBooking should transition status to CANCELLED")
        void cancelBooking_TransitionsToCancelled() {
            sosBooking.setStatus(BookingStatus.CONFIRMED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
            when(bookingRepository.save(any())).thenReturn(sosBooking);
            
            bookingService.cancelBooking(bookingId, "Customer request", UUID.randomUUID());
            
            assertEquals(BookingStatus.CANCELLED, sosBooking.getStatus());
            assertEquals("Customer request", sosBooking.getCancellationReason());
            verify(bookingNotificationService).pushBookingUpdateToUsers(any(), eq("CANCELLED"));
        }
    }
}
