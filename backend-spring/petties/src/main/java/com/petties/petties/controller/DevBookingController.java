package com.petties.petties.controller;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.TransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/dev")
@RequiredArgsConstructor
@Slf4j
public class DevBookingController {

    private final AuthService authService;
    private final TransactionService transactionService;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PetRepository petRepository;
    private final ClinicRepository clinicRepository;

    @Value("${sepay.qr.acc:9624720102004}")
    private String qrAcc;

    @Value("${sepay.qr.bank:BIDV}")
    private String qrBank;

    @PostMapping("/qr-bookings")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Map<String, Object>> createQrBookingForTest() {
        User currentUser = authService.getCurrentUser();

        var clinic = clinicRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new BadRequestException("Chưa có phòng khám để tạo booking test"));

        Pet pet = Pet.builder()
                .name("Pet test")
                .species("Chó")
                .breed("Corgi")
                .gender("MALE")
                .dateOfBirth(LocalDate.of(2022, 1, 15))
                .weight(10.5)
                .user(currentUser)
                .build();
        pet = petRepository.save(pet);

        BigDecimal totalPrice = BigDecimal.valueOf(2000);

        String bookingCode = "BK-TEST-" + (System.currentTimeMillis() % 1_000_000);

        Booking booking = Booking.builder()
                .bookingCode(bookingCode)
                .pet(pet)
                .petOwner(currentUser)
                .clinic(clinic)
                .bookingDate(LocalDate.now().plusDays(1))
                .bookingTime(LocalTime.of(10, 0))
                .type(BookingType.IN_CLINIC)
                .totalPrice(totalPrice)
                .status(BookingStatus.PENDING)
                .notes("Booking test để kiểm tra thanh toán QR")
                .build();

        booking = bookingRepository.save(booking);

        Payment payment = Payment.builder()
                .booking(booking)
                .amount(totalPrice)
                .method(PaymentMethod.QR)
                .status(PaymentStatus.PENDING)
                .build();

        payment = paymentRepository.save(payment);
        booking.setPayment(payment);
        bookingRepository.save(booking);

        String paymentDescription = transactionService.generatePaymentDescription(booking.getBookingId());

        String amountParam = totalPrice.setScale(0, RoundingMode.HALF_UP).toPlainString();
        String qrImageUrl = UriComponentsBuilder
                .fromHttpUrl("https://qr.sepay.vn/img")
                .queryParam("acc", qrAcc)
                .queryParam("bank", qrBank)
                .queryParam("amount", amountParam)
                .queryParam("des", paymentDescription)
                .build(true)
                .toUriString();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("bookingId", booking.getBookingId());
        response.put("bookingCode", booking.getBookingCode());
        response.put("totalPrice", totalPrice);
        response.put("paymentDescription", paymentDescription);
        response.put("qrImageUrl", qrImageUrl);
        response.put("message", "Tạo booking test thành công");

        log.info("Created dev QR booking {} for user {}", booking.getBookingCode(), currentUser.getUserId());

        return ResponseEntity.ok(response);
    }
}
