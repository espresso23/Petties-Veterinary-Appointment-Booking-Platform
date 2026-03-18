package com.petties.petties.controller;

import com.petties.petties.dto.refund.RefundApplicationRequest;
import com.petties.petties.dto.refund.RefundApplicationResponse;
import com.petties.petties.service.RefundApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * API đơn hoàn tiền: Clinic nộp đơn rút tiền (sau khấu trừ 5%), Admin duyệt.
 */
@RestController
@RequestMapping("/refund-applications")
@RequiredArgsConstructor
@Slf4j
public class RefundApplicationController {

    private final RefundApplicationService refundApplicationService;

    /**
     * Tạo đơn hoàn tiền (Clinic Manager/Owner).
     * Body: { "monthRevenue": number, "periodYearMonth": "yyyy-MM" (optional, mặc
     * định tháng hiện tại) }
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody RefundApplicationRequest request) {
        RefundApplicationResponse created = refundApplicationService.create(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã nộp đơn hoàn tiền thành công. Đơn đang chờ admin duyệt.",
                "data", created));
    }

    /**
     * Danh sách đơn hoàn tiền của phòng khám hiện tại.
     */
    @GetMapping("/my-clinic")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getMyClinicApplications() {
        List<RefundApplicationResponse> list = refundApplicationService.getMyClinicApplications();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "items", list,
                "message", "Lấy danh sách đơn hoàn tiền thành công"));
    }

    /**
     * Danh sách đơn PENDING cho Admin duyệt.
     */
    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getPendingForAdmin() {
        List<RefundApplicationResponse> list = refundApplicationService.getPendingForAdmin();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "items", list,
                "message", "Lấy danh sách đơn chờ duyệt thành công"));
    }

    /**
     * Lấy toàn bộ đơn (Admin) kèm filter: status, clinicId, period, date range.
     */
    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAllForAdmin(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID clinicId,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        List<RefundApplicationResponse> list = refundApplicationService.getAllForAdmin(status, clinicId, period, from,
                to);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "items", list,
                "message", "Lấy toàn bộ danh sách đơn thành công"));
    }

    /**
     * Cập nhật trạng thái đơn (APPROVED/REJECTED).
     */
    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody com.petties.petties.dto.refund.RefundApplicationStatusUpdateRequest request) {
        RefundApplicationResponse updated = refundApplicationService.updateStatus(id, request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Cập nhật trạng thái đơn hoàn tiền thành công",
                "data", updated));
    }

    /**
     * Danh sách đơn của một phòng khám cụ thể (Dành cho Owner/Admin).
     */
    @GetMapping("/clinic/{clinicId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getClinicApplications(@PathVariable UUID clinicId) {
        List<RefundApplicationResponse> list = refundApplicationService.getClinicApplications(clinicId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "items", list,
                "message", "Lấy lịch sử đơn của phòng khám thành công"));
    }
}
