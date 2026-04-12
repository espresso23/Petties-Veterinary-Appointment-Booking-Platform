package com.petties.petties.controller;

import com.petties.petties.dto.voucher.ClinicVoucherResponse;
import com.petties.petties.dto.voucher.VoucherCreateRequest;
import com.petties.petties.dto.voucher.VoucherResponse;
import com.petties.petties.service.VoucherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * VoucherController - Quản lý voucher giảm giá
 *
 * Endpoints:
 * - ADMIN: CRUD voucher, toggle active, toggle clinic enables
 * - CLINIC_MANAGER: xem & áp dụng voucher vào clinic
 * - PET_OWNER: xem voucher khả dụng khi thanh toán
 */
@RestController
@RequestMapping("/vouchers")
@RequiredArgsConstructor
@Slf4j
public class VoucherController {

    private final VoucherService voucherService;

    // ====================================================================
    // ADMIN ENDPOINTS
    // ====================================================================

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAllVouchers() {
        List<VoucherResponse> vouchers = voucherService.getAllVouchers();
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", vouchers.size());
        res.put("vouchers", vouchers);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> createVoucher(@Valid @RequestBody VoucherCreateRequest request) {
        VoucherResponse voucher = voucherService.createVoucher(request);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("voucher", voucher);
        res.put("message", "Tạo voucher thành công");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PatchMapping("/admin/{voucherId}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> toggleVoucherActive(@PathVariable UUID voucherId) {
        VoucherResponse voucher = voucherService.toggleVoucherActive(voucherId);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("voucher", voucher);
        res.put("message", Boolean.TRUE.equals(voucher.getIsActive())
                ? "Đã kích hoạt voucher" : "Đã vô hiệu hóa voucher");
        return ResponseEntity.ok(res);
    }

    @PutMapping("/admin/{voucherId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateVoucher(
            @PathVariable UUID voucherId,
            @Valid @RequestBody com.petties.petties.dto.voucher.VoucherUpdateRequest request) {
        VoucherResponse updated = voucherService.updateVoucher(voucherId, request);
        Map<String, Object> res = new HashMap<>(); res.put("success", true);
        res.put("message", "Cập nhật voucher thành công"); res.put("voucher", updated);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/admin/{voucherId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteVoucher(@PathVariable UUID voucherId) {
        voucherService.deleteVoucher(voucherId);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Đã xóa voucher");
        return ResponseEntity.ok(res);
    }

    @PatchMapping("/admin/clinic-vouchers/{clinicVoucherId}/toggle-enabled")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> toggleClinicVoucherEnabled(@PathVariable UUID clinicVoucherId) {
        ClinicVoucherResponse cv = voucherService.toggleClinicVoucherEnabled(clinicVoucherId);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("clinicVoucher", cv);
        res.put("message", Boolean.TRUE.equals(cv.getIsEnabled())
                ? "Đã bật voucher cho phòng khám" : "Đã tắt voucher cho phòng khám");
        return ResponseEntity.ok(res);
    }

    @GetMapping("/admin/clinic/{clinicId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getVouchersByClinic(@PathVariable UUID clinicId) {
        List<ClinicVoucherResponse> cvs = voucherService.getVouchersByClinic(clinicId);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", cvs.size());
        res.put("clinicVouchers", cvs);
        return ResponseEntity.ok(res);
    }

    // ====================================================================
    // CLINIC MANAGER ENDPOINTS
    // ====================================================================

    @GetMapping("/clinic-manager/my-vouchers")
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<Map<String, Object>> getMyClinicVouchers() {
        List<ClinicVoucherResponse> cvs = voucherService.getMyClinicVouchers();
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", cvs.size());
        res.put("clinicVouchers", cvs);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/clinic-manager/available")
    @PreAuthorize("hasRole('CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getAvailableVouchersForManager() {
        List<VoucherResponse> vouchers = voucherService.getAllAvailableVouchers();
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", vouchers.size());
        res.put("vouchers", vouchers);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/clinic-manager/apply/{voucherId}")
    @PreAuthorize("hasRole('CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> applyVoucherToMyClinic(@PathVariable UUID voucherId) {
        ClinicVoucherResponse cv = voucherService.applyVoucherToMyClinic(voucherId);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("clinicVoucher", cv);
        res.put("message", "Đã áp dụng voucher thành công");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @DeleteMapping("/clinic-manager/{clinicVoucherId}")
    @PreAuthorize("hasRole('CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> removeVoucherFromMyClinic(@PathVariable UUID clinicVoucherId) {
        voucherService.removeVoucherFromMyClinic(clinicVoucherId);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Đã gỡ voucher khỏi phòng khám");
        return ResponseEntity.ok(res);
    }

    // ====================================================================
    // PET OWNER ENDPOINTS
    // ====================================================================

    @GetMapping("/available")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Map<String, Object>> getAvailableVouchersForBooking(
            @RequestParam UUID clinicId,
            @RequestParam BigDecimal orderAmount,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) List<String> serviceCategories) {
        List<ClinicVoucherResponse> cvs = voucherService.getAvailableVouchersForBooking(
                clinicId, orderAmount, paymentMethod, serviceCategories);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", cvs.size());
        res.put("vouchers", cvs);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/calculate")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Map<String, Object>> calculateDiscount(
            @RequestParam UUID voucherId,
            @RequestParam UUID clinicId,
            @RequestParam BigDecimal orderAmount) {
        BigDecimal discount = voucherService.calculateVoucherDiscount(voucherId, clinicId, orderAmount);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("discountAmount", discount);
        res.put("finalAmount", orderAmount.subtract(discount));
        res.put("message", "Tính giảm giá thành công");
        return ResponseEntity.ok(res);
    }
}
