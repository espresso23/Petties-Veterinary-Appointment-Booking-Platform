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
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private StaffShiftRepository staffShiftRepository;
    @Mock
    private SlotRepository slotRepository;

    @InjectMocks
    private StaffAssignmentService staffAssignmentService;

    @Mock
    private ClinicServiceRepository clinicServiceRepository;
    @Mock
    private BookingMapper bookingMapper;
    @Mock
    private BookingNotificationService bookingNotificationService;
    @Mock
    private NotificationService notificationService;

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

        clinicId = UUID.randomUUID();
        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        staff = new User();
        staff.setUserId(staffId);
        staff.setRole(Role.STAFF);
        staff.setSpecialty(StaffSpecialty.VET_GENERAL);
        staff.setFullName("SOS Staff");

        sosBooking = new Booking();
        sosBooking.setBookingId(bookingId);
        sosBooking.setType(BookingType.SOS);
        sosBooking.setClinic(clinic);
        sosBooking.setBookingDate(today);
        sosBooking.setBookingTime(nowTime);
        sosBooking.setStatus(BookingStatus.IN_PROGRESS);
        sosBooking.setBookingServices(new ArrayList<>());
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
            // Staff is VET_GENERAL, but SOS might need SURGERY.
            // The logic should pick any available staff for SOS.
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
            when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staffId, today))
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
            sosBooking.setSosFee(new BigDecimal("500000"));
            sosBooking.setTotalPrice(new BigDecimal("500000")); // Only fee for now

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
            assertEquals(overriddenFee, response.getTotalPrice()); // Since no services
            assertEquals(BookingStatus.COMPLETED, response.getStatus());
            verify(bookingRepository).save(sosBooking);
        }
    }
}
