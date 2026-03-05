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
     * Body: { "monthRevenue": number, "periodYearMonth": "yyyy-MM" (optional, mặc định tháng hiện tại) }
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody RefundApplicationRequest request) {
        RefundApplicationResponse created = refundApplicationService.create(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã nộp đơn hoàn tiền thành công. Đơn đang chờ admin duyệt.",
                "data", created
        ));
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
                "message", "Lấy danh sách đơn hoàn tiền thành công"
        ));
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
                "message", "Lấy danh sách đơn chờ duyệt thành công"
        ));
    }
}
