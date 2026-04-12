package com.petties.petties.controller;

import com.petties.petties.service.WithdrawalService;
import com.petties.petties.model.Withdrawal;
import com.petties.petties.model.enums.WithdrawalStatus;
import com.petties.petties.service.AuthService;
import com.petties.petties.model.User;
import com.petties.petties.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * API quản lý rút tiền thực tế
 * Admin có thể xem và cập nhật trạng thái các lần rút tiền
 */
@RestController
@RequestMapping("/withdrawals")
@RequiredArgsConstructor
@Slf4j
public class WithdrawalController {

    private final WithdrawalService withdrawalService;
    private final AuthService authService;

    /**
     * Lấy danh sách withdrawal của clinic hiện tại (Clinic Manager/Owner)
     */
    @GetMapping("/my-clinic")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getMyClinicWithdrawals() {
        User currentUser = authService.getCurrentUser();
        UUID clinicId;
        
        if (currentUser.getWorkingClinic() != null) {
            clinicId = currentUser.getWorkingClinic().getClinicId();
        } else {
            throw new BadRequestException("Bạn chưa được gán phòng khám.");
        }
        
        List<Withdrawal> withdrawals = withdrawalService.getClinicWithdrawals(clinicId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "items", withdrawals,
                "message", "Lấy danh sách rút tiền thành công"));
    }

    /**
     * Lấy danh sách withdrawal theo trạng thái (Admin)
     */
    @GetMapping("/admin/status/{status}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getWithdrawalsByStatus(@PathVariable WithdrawalStatus status) {
        List<Withdrawal> withdrawals = withdrawalService.getWithdrawalsByStatus(status);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "items", withdrawals,
                "message", "Lấy danh sách rút tiền theo trạng thái thành công"));
    }

    /**
     * Cập nhật trạng thái withdrawal (Admin)
     * Dùng khi chuyển tiền thành công hoặc thất bại
     */
    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateWithdrawalStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> request) {
        
        WithdrawalStatus status = WithdrawalStatus.valueOf(((String) request.get("status")).toUpperCase());
        String transferReference = (String) request.get("transferReference");
        String failureReason = (String) request.get("failureReason");

        Withdrawal updated = withdrawalService.updateWithdrawalStatus(id, status, transferReference, failureReason);
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", updated,
                "message", "Cập nhật trạng thái rút tiền thành công"));
    }

    /**
     * Lấy chi tiết một withdrawal (Admin/Clinic Owner/Manager)
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getWithdrawal(@PathVariable UUID id) {
        // TODO: Implement getWithdrawalById in WithdrawalService
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Tính năng đang phát triển"));
    }
}
