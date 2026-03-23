package com.petties.petties.service;

import com.petties.petties.dto.voucher.ClinicVoucherResponse;
import com.petties.petties.dto.voucher.VoucherCreateRequest;
import com.petties.petties.dto.voucher.VoucherResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicVoucher;
import com.petties.petties.model.User;
import com.petties.petties.model.Voucher;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicVoucherRepository;
import com.petties.petties.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class VoucherService {

    private final VoucherRepository voucherRepository;
    private final ClinicVoucherRepository clinicVoucherRepository;
    private final ClinicRepository clinicRepository;
    private final com.petties.petties.repository.BookingRepository bookingRepository;
    private final AuthService authService;

    // ==================== ADMIN: VOUCHER MANAGEMENT ====================

    /**
     * Admin: Lấy toàn bộ danh sách voucher
     */
    @Transactional(readOnly = true)
    public List<VoucherResponse> getAllVouchers() {
        return voucherRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(VoucherResponse::from)
                .toList();
    }

    /**
     * Admin: Tạo voucher mới
     */
    @Transactional
    public VoucherResponse createVoucher(VoucherCreateRequest request) {
        // Validate code trùng
        if (voucherRepository.existsByCode(request.getCode().toUpperCase())) {
            throw new BadRequestException("Mã voucher '" + request.getCode() + "' đã tồn tại");
        }
        // Validate ngày
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new BadRequestException("Ngày kết thúc phải sau ngày bắt đầu");
        }
        // Validate discount percentage <= 100
        if (request.getDiscountType() != null &&
                request.getDiscountType().name().equals("PERCENTAGE") &&
                request.getDiscountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BadRequestException("Phần trăm giảm không thể vượt quá 100%");
        }

        User admin = authService.getCurrentUser();

        Voucher voucher = Voucher.builder()
                .code(request.getCode().toUpperCase().trim())
                .name(request.getName().trim())
                .description(request.getDescription())
                .discountType(request.getDiscountType())
                .discountValue(request.getDiscountValue())
                .maxDiscountAmount(request.getMaxDiscountAmount())
                .minOrderAmount(request.getMinOrderAmount() != null ? request.getMinOrderAmount() : BigDecimal.ZERO)
                .applicableCategory(request.getApplicableCategory())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .requireOnlinePayment(request.getRequireOnlinePayment() != null && request.getRequireOnlinePayment())
                .limitOnePerUser(request.getLimitOnePerUser() != null && request.getLimitOnePerUser())
                .isActive(true)
                .createdBy(admin)
                .build();

        Voucher saved = voucherRepository.save(voucher);
        log.info("Admin {} created voucher: {}", admin.getUserId(), saved.getCode());
        return VoucherResponse.from(saved);
    }

    /**
     * Admin: Bật/tắt voucher toàn hệ thống
     */
    @Transactional
    public VoucherResponse toggleVoucherActive(UUID voucherId) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy voucher"));
        voucher.setIsActive(!voucher.getIsActive());
        Voucher saved = voucherRepository.save(voucher);
        log.info("Voucher {} toggled active -> {}", saved.getCode(), saved.getIsActive());
        return VoucherResponse.from(saved);
    }

    /**
     * Admin: Xóa voucher
     */
    @Transactional
    public void deleteVoucher(UUID voucherId) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy voucher"));
        boolean hasBookings = bookingRepository.existsByVoucher_VoucherId(voucherId);
        if (hasBookings) {
            throw new BadRequestException("Voucher này đã được khách hàng lưu/sử dụng trên hệ thống, KHÔNG THỂ XÓA MẤT (nhằm bảo toàn hóa đơn cũ). Xin hãy nhấp nút 'Tắt' thay vì xoá!");
        }
        
        clinicVoucherRepository.deleteAll(voucher.getClinicVouchers());
        voucherRepository.delete(voucher);
        log.info("Voucher {} deleted", voucher.getCode());
    }

    /**
     * Admin: Cập nhật voucher
     */
    @Transactional
    public VoucherResponse updateVoucher(UUID voucherId, com.petties.petties.dto.voucher.VoucherUpdateRequest request) {
        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new BadRequestException("Ngày bắt đầu không thể sau ngày kết thúc");
        }
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy voucher"));
        
        voucher.setName(request.getName().trim());
        voucher.setDescription(request.getDescription());
        voucher.setDiscountType(request.getDiscountType());
        voucher.setDiscountValue(request.getDiscountValue());
        voucher.setMaxDiscountAmount(request.getMaxDiscountAmount());
        voucher.setMinOrderAmount(request.getMinOrderAmount() != null ? request.getMinOrderAmount() : BigDecimal.ZERO);
        voucher.setApplicableCategory(request.getApplicableCategory());
        voucher.setStartDate(request.getStartDate());
        voucher.setEndDate(request.getEndDate());
        voucher.setRequireOnlinePayment(request.getRequireOnlinePayment() != null && request.getRequireOnlinePayment());
        voucher.setLimitOnePerUser(request.getLimitOnePerUser() != null && request.getLimitOnePerUser());
        
        Voucher saved = voucherRepository.save(voucher);
        return VoucherResponse.from(saved);
    }

    /**
     * Admin: Bật/tắt voucher trên clinic cụ thể
     */
    @Transactional
    public ClinicVoucherResponse toggleClinicVoucherEnabled(UUID clinicVoucherId) {
        ClinicVoucher cv = clinicVoucherRepository.findById(clinicVoucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy liên kết voucher-clinic"));
        cv.setIsEnabled(!cv.getIsEnabled());
        ClinicVoucher saved = clinicVoucherRepository.save(cv);
        log.info("ClinicVoucher {} toggled enabled -> {}", clinicVoucherId, saved.getIsEnabled());
        return ClinicVoucherResponse.from(saved);
    }

    /**
     * Admin: Xem voucher theo clinic
     */
    @Transactional(readOnly = true)
    public List<ClinicVoucherResponse> getVouchersByClinic(UUID clinicId) {
        return clinicVoucherRepository.findByClinicClinicIdOrderByAppliedAtDesc(clinicId)
                .stream()
                .map(ClinicVoucherResponse::from)
                .toList();
    }

    // ==================== CLINIC MANAGER: APPLY VOUCHER ====================

    /**
     * Clinic Manager: Lấy danh sách voucher của clinic mình
     */
    @Transactional(readOnly = true)
    public List<ClinicVoucherResponse> getMyClinicVouchers() {
        User manager = authService.getCurrentUser();
        if (manager.getWorkingClinic() == null) {
            throw new BadRequestException("Bạn chưa được gán vào phòng khám nào");
        }
        UUID clinicId = manager.getWorkingClinic().getClinicId();
        return clinicVoucherRepository.findByClinicClinicIdOrderByAppliedAtDesc(clinicId)
                .stream()
                .map(ClinicVoucherResponse::from)
                .toList();
    }

    /**
     * Clinic Manager: Xem tất cả voucher có thể apply (toàn bộ voucher active)
     */
    @Transactional(readOnly = true)
    public List<VoucherResponse> getAllAvailableVouchers() {
        return voucherRepository.findAllValid()
                .stream()
                .map(VoucherResponse::from)
                .toList();
    }

    /**
     * Clinic Manager: Áp dụng voucher vào clinic của mình
     */
    @Transactional
    public ClinicVoucherResponse applyVoucherToMyClinic(UUID voucherId) {
        User manager = authService.getCurrentUser();
        if (manager.getWorkingClinic() == null) {
            throw new BadRequestException("Bạn chưa được gán vào phòng khám nào");
        }
        Clinic clinic = manager.getWorkingClinic();

        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy voucher"));

        if (!Boolean.TRUE.equals(voucher.getIsActive())) {
            throw new BadRequestException("Voucher này đang bị vô hiệu hóa");
        }

        if (clinicVoucherRepository.existsByVoucherVoucherIdAndClinicClinicId(voucherId, clinic.getClinicId())) {
            throw new BadRequestException("Phòng khám đã áp dụng voucher này rồi");
        }

        ClinicVoucher cv = ClinicVoucher.builder()
                .voucher(voucher)
                .clinic(clinic)
                .appliedBy(manager)
                .isEnabled(true)
                .build();

        ClinicVoucher saved = clinicVoucherRepository.save(cv);
        log.info("ClinicManager {} applied voucher {} to clinic {}",
                manager.getUserId(), voucher.getCode(), clinic.getClinicId());
        return ClinicVoucherResponse.from(saved);
    }

    /**
     * Clinic Manager: Gỡ voucher khỏi clinic mình
     */
    @Transactional
    public void removeVoucherFromMyClinic(UUID clinicVoucherId) {
        User manager = authService.getCurrentUser();
        if (manager.getWorkingClinic() == null) {
            throw new BadRequestException("Bạn chưa được gán vào phòng khám nào");
        }
        ClinicVoucher cv = clinicVoucherRepository.findById(clinicVoucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy liên kết voucher-clinic"));
        // Kiểm tra clinic đúng manager
        if (!cv.getClinic().getClinicId().equals(manager.getWorkingClinic().getClinicId())) {
            throw new BadRequestException("Bạn không có quyền gỡ voucher này");
        }
        clinicVoucherRepository.delete(cv);
        log.info("ClinicManager {} removed clinicVoucher {}", manager.getUserId(), clinicVoucherId);
    }

    // ==================== PET OWNER: USE VOUCHER ====================

    /**
     * Pet Owner: Lấy danh sách voucher khả dụng cho booking (clinic + tổng tiền)
     * Filter thêm theo:
     * - paymentMethod: nếu CASH → ẩn voucher yêu cầu online payment
     * - serviceCategories: chỉ hiện voucher phù hợp với loại dịch vụ trong booking
     * - limitOnePerUser: ẩn voucher đã dùng rồi
     */
    @Transactional(readOnly = true)
    public List<ClinicVoucherResponse> getAvailableVouchersForBooking(
            UUID clinicId, BigDecimal orderAmount,
            String paymentMethod, List<String> serviceCategories) {
        User petOwner = authService.getCurrentUser();
        List<ClinicVoucher> availableCvs = clinicVoucherRepository.findAvailableForBooking(clinicId, orderAmount);
        
        return availableCvs.stream()
                .filter(cv -> {
                    com.petties.petties.model.Voucher voucher = cv.getVoucher();
                    
                    // 1. Filter requireOnlinePayment: nếu user chọn CASH thì ẩn voucher yêu cầu online
                    if ("CASH".equalsIgnoreCase(paymentMethod) && Boolean.TRUE.equals(voucher.getRequireOnlinePayment())) {
                        return false;
                    }
                    
                    // 2. Filter applicableCategory: voucher chỉ áp dụng cho loại dịch vụ cụ thể
                    if (voucher.getApplicableCategory() != null && serviceCategories != null && !serviceCategories.isEmpty()) {
                        boolean categoryMatch = serviceCategories.stream()
                                .anyMatch(cat -> voucher.getApplicableCategory().name().equalsIgnoreCase(cat));
                        if (!categoryMatch) return false;
                    }
                    
                    // 3. Filter limitOnePerUser
                    if (Boolean.TRUE.equals(voucher.getLimitOnePerUser())) {
                        boolean alreadyUsed = bookingRepository.hasUserUsedVoucher(petOwner.getUserId(), voucher.getVoucherId());
                        if (alreadyUsed) return false;
                    }
                    return true;
                })
                .map(cv -> ClinicVoucherResponse.fromWithDiscount(cv, orderAmount))
                .toList();
    }

    /**
     * Tính toán discount khi áp dụng voucher (dùng trong preview, không lưu DB)
     * Returns: discountAmount
     */
    @Transactional(readOnly = true)
    public BigDecimal calculateVoucherDiscount(UUID voucherId, UUID clinicId, BigDecimal orderAmount) {
        ClinicVoucher cv = clinicVoucherRepository
                .findByVoucherVoucherIdAndClinicClinicId(voucherId, clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Voucher không áp dụng cho phòng khám này"));

        if (!Boolean.TRUE.equals(cv.getIsEnabled())) {
            throw new BadRequestException("Voucher này đã bị vô hiệu hóa");
        }
        if (!cv.getVoucher().isValid()) {
            throw new BadRequestException("Voucher không còn hiệu lực");
        }
        if (orderAmount.compareTo(cv.getVoucher().getMinOrderAmount()) < 0) {
            throw new BadRequestException(
                    "Đơn hàng chưa đạt tối thiểu " + cv.getVoucher().getMinOrderAmount() + " để dùng voucher này");
        }
        
        // Check limitOnePerUser
        if (Boolean.TRUE.equals(cv.getVoucher().getLimitOnePerUser())) {
            User petOwner = authService.getCurrentUser();
            boolean alreadyUsed = bookingRepository.hasUserUsedVoucher(petOwner.getUserId(), voucherId);
            if (alreadyUsed) {
                throw new BadRequestException("Bạn đã sử dụng voucher này rồi. Mỗi khách hàng chỉ được dùng 1 lần.");
            }
        }
        
        return cv.getVoucher().calculateDiscount(orderAmount);
    }
}
