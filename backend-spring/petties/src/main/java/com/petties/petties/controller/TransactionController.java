package com.petties.petties.controller;

import com.petties.petties.model.Booking;
import com.petties.petties.service.TransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Transaction Controller - API endpoints cho transaction processing
 * 
 * Main endpoints:
 * - GET /api/transactions/payment-description/{bookingId}
 * - GET /api/transactions/total-price/{bookingId}
 * - GET /api/transactions/is-qr/{bookingId}
 * - GET /api/transactions/all
 */
@RestController
@RequestMapping({"/api/transactions", "/transactions"})
@RequiredArgsConstructor
@Slf4j
public class TransactionController {

    private final TransactionService transactionService;

    /**
     * Tạo payment description cho SePay
     * 
     * @param bookingId ID của booking
     * @return Payment description hoặc null nếu không phải QR payment
     */
    @GetMapping("/payment-description/{bookingId}")
    public ResponseEntity<Map<String, Object>> getPaymentDescription(
            @PathVariable UUID bookingId) {
        
        log.info("Request payment description for booking: {}", bookingId);
        
        try {
            String paymentDescription = transactionService.generatePaymentDescription(bookingId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", paymentDescription != null);
            response.put("bookingId", bookingId.toString());
            response.put("paymentDescription", paymentDescription);
            
            if (paymentDescription == null) {
                response.put("message", "Booking không sử dụng phương thức thanh toán QR");
                return ResponseEntity.badRequest().body(response);
            }
            
            response.put("message", "Tạo payment description thành công");
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            log.error("Error generating payment description: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
    
    /**
     * Lấy total price của booking
     * 
     * @param bookingId ID của booking
     * @return Total price
     */
    @GetMapping("/total-price/{bookingId}")
    public ResponseEntity<Map<String, Object>> getTotalPrice(
            @PathVariable UUID bookingId) {
        
        log.info("Request total price for booking: {}", bookingId);
        
        BigDecimal totalPrice = transactionService.getBookingTotalPrice(bookingId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", totalPrice != null);
        response.put("bookingId", bookingId.toString());
        response.put("totalPrice", totalPrice);
        
        if (totalPrice == null) {
            response.put("message", "Không tìm thấy booking");
            return ResponseEntity.notFound().build();
        }
        
        response.put("message", "Lấy total price thành công");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Check if booking uses QR payment
     * 
     * @param bookingId ID của booking
     * @return true/false
     */
    @GetMapping("/is-qr/{bookingId}")
    public ResponseEntity<Map<String, Object>> isQrPayment(
            @PathVariable UUID bookingId) {
        
        log.info("Check QR payment for booking: {}", bookingId);
        
        boolean isQr = transactionService.isQrPayment(bookingId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("bookingId", bookingId.toString());
        response.put("isQrPayment", isQr);
        response.put("paymentMethod", isQr ? "QR" : "CASH/CARD");
        response.put("message", "Kiểm tra phương thức thanh toán thành công");
        
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy tất cả bookings
     * 
     * @return List of all bookings
     */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAllBookings() {
        
        log.info("Request all bookings");
        
        try {
            List<Booking> bookings = transactionService.getAllBookings();
            List<Map<String, Object>> bookingItems = bookings.stream().map(booking -> {
                Map<String, Object> item = new HashMap<>();
                item.put("bookingId", booking.getBookingId());
                item.put("bookingCode", booking.getBookingCode());
                item.put("bookingDate", booking.getBookingDate());
                item.put("bookingTime", booking.getBookingTime());
                item.put("type", booking.getType());
                item.put("totalPrice", booking.getTotalPrice());
                item.put("status", booking.getStatus());

                if (booking.getClinic() != null) {
                    Map<String, Object> clinic = new HashMap<>();
                    clinic.put("clinicId", booking.getClinic().getClinicId());
                    clinic.put("name", booking.getClinic().getName());
                    item.put("clinic", clinic);
                }

                if (booking.getPetOwner() != null) {
                    Map<String, Object> petOwner = new HashMap<>();
                    petOwner.put("userId", booking.getPetOwner().getUserId());
                    petOwner.put("username", booking.getPetOwner().getUsername());
                    item.put("petOwner", petOwner);
                }

                if (booking.getPet() != null) {
                    Map<String, Object> pet = new HashMap<>();
                    pet.put("id", booking.getPet().getId());
                    pet.put("name", booking.getPet().getName());
                    item.put("pet", pet);
                }

                if (booking.getAssignedVet() != null) {
                    Map<String, Object> assignedVet = new HashMap<>();
                    assignedVet.put("userId", booking.getAssignedVet().getUserId());
                    assignedVet.put("username", booking.getAssignedVet().getUsername());
                    item.put("assignedVet", assignedVet);
                }

                if (booking.getPayment() != null) {
                    Map<String, Object> payment = new HashMap<>();
                    payment.put("paymentId", booking.getPayment().getPaymentId());
                    payment.put("amount", booking.getPayment().getAmount());
                    payment.put("method", booking.getPayment().getMethod());
                    payment.put("status", booking.getPayment().getStatus());
                    item.put("payment", payment);
                }

                return item;
            }).toList();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("count", bookingItems.size());
            response.put("bookings", bookingItems);
            response.put("message", "Lấy tất cả bookings thành công");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error getting all bookings: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Lỗi khi lấy danh sách bookings: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
}
