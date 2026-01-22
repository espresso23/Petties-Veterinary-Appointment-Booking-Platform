package com.petties.petties.service;

import com.petties.petties.model.*;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @InjectMocks
    private TransactionService transactionService;

    private Booking qrBooking;
    private Booking cashBooking;
    private Booking cardBooking;
    private UUID bookingId;
    private UUID clinicId;
    private UUID petOwnerId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        clinicId = UUID.randomUUID();
        petOwnerId = UUID.randomUUID();

        // Create test bookings
        qrBooking = createTestBooking(PaymentMethod.QR);
        cashBooking = createTestBooking(PaymentMethod.CASH);
        cardBooking = createTestBooking(PaymentMethod.CARD);
    }

    private Booking createTestBooking(PaymentMethod paymentMethod) {
        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User petOwner = new User();
        petOwner.setUserId(petOwnerId);

        Payment payment = Payment.builder()
                .paymentId(UUID.randomUUID())
                .method(paymentMethod)
                .amount(BigDecimal.valueOf(500000))
                .build();

        return Booking.builder()
                .bookingId(bookingId)
                .bookingCode("BK-20240101-0001")
                .clinic(clinic)
                .petOwner(petOwner)
                .totalPrice(BigDecimal.valueOf(500000))
                .status(BookingStatus.PENDING)
                .type(BookingType.IN_CLINIC)
                .payment(payment)
                .build();
    }

    @Test
    void generatePaymentDescription_QRPayment_ShouldReturnDescription() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(qrBooking));

        // When
        String result = transactionService.generatePaymentDescription(bookingId);

        // Then
        assertNotNull(result);
        assertEquals(10, result.length());
        assertTrue(result.matches("^[A-Z0-9]{10}$"));
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void generatePaymentDescription_CashPayment_ShouldReturnNull() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(cashBooking));

        // When
        String result = transactionService.generatePaymentDescription(bookingId);

        // Then
        assertNull(result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void generatePaymentDescription_CardPayment_ShouldReturnNull() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(cardBooking));

        // When
        String result = transactionService.generatePaymentDescription(bookingId);

        // Then
        assertNull(result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void generatePaymentDescription_NoPayment_ShouldReturnNull() {
        // Given
        qrBooking.setPayment(null);
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(qrBooking));

        // When
        String result = transactionService.generatePaymentDescription(bookingId);

        // Then
        assertNull(result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void generatePaymentDescription_BookingNotFound_ShouldThrowException() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.empty());

        // When & Then
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> transactionService.generatePaymentDescription(bookingId)
        );

        assertEquals("Không tìm thấy booking với ID: " + bookingId, exception.getMessage());
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void getBookingTotalPrice_ExistingBooking_ShouldReturnPrice() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(qrBooking));

        // When
        BigDecimal result = transactionService.getBookingTotalPrice(bookingId);

        // Then
        assertEquals(BigDecimal.valueOf(500000), result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void getBookingTotalPrice_NonExistingBooking_ShouldReturnNull() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.empty());

        // When
        BigDecimal result = transactionService.getBookingTotalPrice(bookingId);

        // Then
        assertNull(result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void isQrPayment_QRPayment_ShouldReturnTrue() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(qrBooking));

        // When
        boolean result = transactionService.isQrPayment(bookingId);

        // Then
        assertTrue(result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void isQrPayment_CashPayment_ShouldReturnFalse() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(cashBooking));

        // When
        boolean result = transactionService.isQrPayment(bookingId);

        // Then
        assertFalse(result);
        verify(bookingRepository).findById(bookingId);
    }

    @Test
    void isQrPayment_NonExistingBooking_ShouldReturnFalse() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.empty());

        // When
        boolean result = transactionService.isQrPayment(bookingId);

        // Then
        assertFalse(result);
        verify(bookingRepository).findById(bookingId);
    }
}
