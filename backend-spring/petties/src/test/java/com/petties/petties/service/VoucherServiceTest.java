package com.petties.petties.service;

import com.petties.petties.dto.voucher.ClinicVoucherResponse;
import com.petties.petties.dto.voucher.VoucherCreateRequest;
import com.petties.petties.dto.voucher.VoucherResponse;
import com.petties.petties.dto.voucher.VoucherUpdateRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicVoucher;
import com.petties.petties.model.User;
import com.petties.petties.model.Voucher;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.VoucherDiscountType;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicVoucherRepository;
import com.petties.petties.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VoucherServiceTest {

    @Mock
    private VoucherRepository voucherRepository;

    @Mock
    private ClinicVoucherRepository clinicVoucherRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private AuthService authService;

    @InjectMocks
    private VoucherService voucherService;

    private User admin;
    private User clinicManager;
    private User petOwner;
    private Clinic clinic;
    private Voucher voucherPercentage;
    private Voucher voucherFixed;
    private ClinicVoucher clinicVoucher;

    @BeforeEach
    void setUp() {
        UUID adminId = UUID.randomUUID();
        UUID managerId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();
        UUID voucherId1 = UUID.randomUUID();
        UUID voucherId2 = UUID.randomUUID();
        UUID cvId = UUID.randomUUID();

        admin = User.builder().userId(adminId).username("admin").build();

        clinic = Clinic.builder().clinicId(clinicId).name("Test Clinic").build();

        clinicManager = User.builder().userId(managerId).username("manager").workingClinic(clinic).build();

        petOwner = User.builder().userId(ownerId).username("owner").build();

        voucherPercentage = Voucher.builder()
                .voucherId(voucherId1)
                .code("SALE10")
                .name("Sale 10%")
                .discountType(VoucherDiscountType.PERCENTAGE)
                .discountValue(BigDecimal.valueOf(10))
                .maxDiscountAmount(BigDecimal.valueOf(50000))
                .minOrderAmount(BigDecimal.valueOf(100000))
                .startDate(LocalDate.now().minusDays(1))
                .endDate(LocalDate.now().plusDays(10))
                .isActive(true)
                .requireOnlinePayment(false)
                .applicableCategory(ServiceCategory.CHECK_UP)
                .limitOnePerUser(true)
                .createdBy(admin)
                .build();

        voucherFixed = Voucher.builder()
                .voucherId(voucherId2)
                .code("SALE50K")
                .name("Giảm 50K")
                .discountType(VoucherDiscountType.FIXED_AMOUNT)
                .discountValue(BigDecimal.valueOf(50000))
                .minOrderAmount(BigDecimal.valueOf(200000))
                .startDate(LocalDate.now().minusDays(1))
                .endDate(LocalDate.now().plusDays(10))
                .isActive(true)
                .requireOnlinePayment(true)
                .limitOnePerUser(false)
                .createdBy(admin)
                .build();

        clinicVoucher = ClinicVoucher.builder()
                .clinicVoucherId(cvId)
                .clinic(clinic)
                .voucher(voucherPercentage)
                .isEnabled(true)
                .appliedBy(clinicManager)
                .build();
    }

    // ==================== ADMIN: VOUCHER MANAGEMENT ====================

    @Test
    @DisplayName("TC-UNIT-VOUCHER-001: Admin lấy toàn bộ voucher thành công")
    void getAllVouchers_Success() {
        when(voucherRepository.findAllByOrderByCreatedAtDesc()).thenReturn(Arrays.asList(voucherPercentage, voucherFixed));

        List<VoucherResponse> results = voucherService.getAllVouchers();

        assertEquals(2, results.size());
        assertEquals("SALE10", results.get(0).getCode());
        verify(voucherRepository).findAllByOrderByCreatedAtDesc();
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-002: Admin tạo voucher hợp lệ thành công")
    void createVoucher_Success() {
        VoucherCreateRequest req = new VoucherCreateRequest();
        req.setCode("NEW15");
        req.setName("Giam 15%");
        req.setDiscountType(VoucherDiscountType.PERCENTAGE);
        req.setDiscountValue(BigDecimal.valueOf(15));
        req.setStartDate(LocalDate.now().plusDays(1));
        req.setEndDate(LocalDate.now().plusDays(5));

        when(voucherRepository.existsByCode("NEW15")).thenReturn(false);
        when(authService.getCurrentUser()).thenReturn(admin);
        
        Voucher savedVoucher = Voucher.builder()
                .voucherId(UUID.randomUUID())
                .code("NEW15")
                .discountType(VoucherDiscountType.PERCENTAGE)
                .discountValue(BigDecimal.valueOf(15))
                .startDate(LocalDate.now().plusDays(1))
                .endDate(LocalDate.now().plusDays(5))
                .isActive(true)
                .build();
        when(voucherRepository.save(any(Voucher.class))).thenReturn(savedVoucher);

        VoucherResponse res = voucherService.createVoucher(req);

        assertNotNull(res);
        assertEquals("NEW15", res.getCode());
        verify(voucherRepository).save(any(Voucher.class));
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-003: Admin tạo voucher lỗi do trùng code")
    void createVoucher_DuplicateCode() {
        VoucherCreateRequest req = new VoucherCreateRequest();
        req.setCode("SALE10");

        when(voucherRepository.existsByCode("SALE10")).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> voucherService.createVoucher(req));
        assertTrue(ex.getMessage().contains("đã tồn tại"));
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-004: Admin tạo voucher lỗi do ngày kết thúc trước ngày bắt đầu")
    void createVoucher_InvalidDates() {
        VoucherCreateRequest req = new VoucherCreateRequest();
        req.setCode("TEST");
        req.setStartDate(LocalDate.now().plusDays(5));
        req.setEndDate(LocalDate.now().plusDays(1));

        when(voucherRepository.existsByCode("TEST")).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> voucherService.createVoucher(req));
        assertTrue(ex.getMessage().contains("Ngày kết thúc phải sau"));
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-005: Admin tắt trạng thái voucher thành công")
    void toggleVoucherActive_Success() {
        when(voucherRepository.findById(voucherPercentage.getVoucherId())).thenReturn(Optional.of(voucherPercentage));
        when(voucherRepository.save(any(Voucher.class))).thenAnswer(i -> i.getArguments()[0]);

        VoucherResponse res = voucherService.toggleVoucherActive(voucherPercentage.getVoucherId());

        assertFalse(res.getIsActive());
        verify(voucherRepository).save(voucherPercentage);
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-006: Admin cập nhật voucher thành công")
    void updateVoucher_Success() {
        VoucherUpdateRequest req = new VoucherUpdateRequest();
        req.setName("Updated Name");
        req.setDiscountType(VoucherDiscountType.PERCENTAGE);
        req.setDiscountValue(BigDecimal.valueOf(20));
        req.setStartDate(LocalDate.now().minusDays(1));
        req.setEndDate(LocalDate.now().plusDays(10));

        when(voucherRepository.findById(voucherPercentage.getVoucherId())).thenReturn(Optional.of(voucherPercentage));
        when(voucherRepository.save(any(Voucher.class))).thenAnswer(i -> i.getArguments()[0]);

        VoucherResponse res = voucherService.updateVoucher(voucherPercentage.getVoucherId(), req);

        assertEquals("Updated Name", res.getName());
        assertEquals(0, BigDecimal.valueOf(20).compareTo(res.getDiscountValue()));
        verify(voucherRepository).save(voucherPercentage);
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-007: Admin xóa voucher thành công khi chưa có booking")
    void deleteVoucher_Success() {
        when(voucherRepository.findById(voucherPercentage.getVoucherId())).thenReturn(Optional.of(voucherPercentage));
        when(bookingRepository.existsByVoucher_VoucherId(voucherPercentage.getVoucherId())).thenReturn(false);

        voucherService.deleteVoucher(voucherPercentage.getVoucherId());

        verify(clinicVoucherRepository).deleteAll(any());
        verify(voucherRepository).delete(voucherPercentage);
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-008: Admin xóa voucher thất bại do đã có booking")
    void deleteVoucher_HasBookings() {
        when(voucherRepository.findById(voucherPercentage.getVoucherId())).thenReturn(Optional.of(voucherPercentage));
        when(bookingRepository.existsByVoucher_VoucherId(voucherPercentage.getVoucherId())).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> voucherService.deleteVoucher(voucherPercentage.getVoucherId()));
        assertTrue(ex.getMessage().contains("đã được khách hàng lưu/sử dụng"));
    }

    // ==================== CLINIC MANAGER ====================

    @Test
    @DisplayName("TC-UNIT-VOUCHER-009: Clinic Manager lấy danh sách voucher của clinic thành công")
    void getMyClinicVouchers_Success() {
        when(authService.getCurrentUser()).thenReturn(clinicManager);
        when(clinicVoucherRepository.findByClinicClinicIdOrderByAppliedAtDesc(clinic.getClinicId()))
                .thenReturn(Collections.singletonList(clinicVoucher));

        List<ClinicVoucherResponse> results = voucherService.getMyClinicVouchers();

        assertEquals(1, results.size());
        assertEquals(voucherPercentage.getCode(), results.get(0).getCode());
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-010: Clinic Manager áp dụng voucher vào clinic thành công")
    void applyVoucherToMyClinic_Success() {
        when(authService.getCurrentUser()).thenReturn(clinicManager);
        when(voucherRepository.findById(voucherFixed.getVoucherId())).thenReturn(Optional.of(voucherFixed));
        when(clinicVoucherRepository.existsByVoucherVoucherIdAndClinicClinicId(voucherFixed.getVoucherId(), clinic.getClinicId()))
                .thenReturn(false);
        
        ClinicVoucher savedCv = ClinicVoucher.builder()
                .clinicVoucherId(UUID.randomUUID())
                .voucher(voucherFixed)
                .isEnabled(true)
                .build();
        when(clinicVoucherRepository.save(any(ClinicVoucher.class))).thenReturn(savedCv);

        ClinicVoucherResponse res = voucherService.applyVoucherToMyClinic(voucherFixed.getVoucherId());

        assertNotNull(res);
        assertTrue(res.getIsEnabled());
        verify(clinicVoucherRepository).save(any(ClinicVoucher.class));
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-011: Clinic Manager gỡ voucher khỏi clinic thành công")
    void removeVoucherFromMyClinic_Success() {
        when(authService.getCurrentUser()).thenReturn(clinicManager);
        when(clinicVoucherRepository.findById(clinicVoucher.getClinicVoucherId())).thenReturn(Optional.of(clinicVoucher));

        voucherService.removeVoucherFromMyClinic(clinicVoucher.getClinicVoucherId());

        verify(clinicVoucherRepository).delete(clinicVoucher);
    }

    // ==================== PET OWNER ====================

    @Test
    @DisplayName("TC-UNIT-VOUCHER-012: Pet Owner lọc danh sách voucher khả dụng (lọc CASH)")
    void getAvailableVouchersForBooking_FilterCash() {
        when(authService.getCurrentUser()).thenReturn(petOwner);
        
        ClinicVoucher cv1 = ClinicVoucher.builder().voucher(voucherPercentage).build(); // requireOnline = false
        ClinicVoucher cv2 = ClinicVoucher.builder().voucher(voucherFixed).build(); // requireOnline = true

        when(clinicVoucherRepository.findAvailableForBooking(eq(clinic.getClinicId()), any(BigDecimal.class)))
                .thenReturn(Arrays.asList(cv1, cv2));
        
        when(bookingRepository.hasUserUsedVoucher(petOwner.getUserId(), voucherPercentage.getVoucherId()))
                .thenReturn(false); // Chưa dùng

        // Lọc với CASH và category CHECK_UP (khớp với cv1)
        List<ClinicVoucherResponse> results = voucherService.getAvailableVouchersForBooking(
                clinic.getClinicId(), BigDecimal.valueOf(300000), "CASH", Arrays.asList("CHECK_UP"));

        // Chỉ trả về cv1, vì cv2 requireOnlinePayment = true
        assertEquals(1, results.size());
        assertEquals("SALE10", results.get(0).getCode());
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-013: Pet Owner tính toán discount voucher hợp lệ (percentage)")
    void calculateVoucherDiscount_Success() {
        when(clinicVoucherRepository.findByVoucherVoucherIdAndClinicClinicId(voucherPercentage.getVoucherId(), clinic.getClinicId()))
                .thenReturn(Optional.of(clinicVoucher));
        when(authService.getCurrentUser()).thenReturn(petOwner);
        when(bookingRepository.hasUserUsedVoucher(petOwner.getUserId(), voucherPercentage.getVoucherId()))
                .thenReturn(false);

        // Đơn 300k, giảm 10% = 30k (chưa vượt max 50k)
        BigDecimal discount = voucherService.calculateVoucherDiscount(voucherPercentage.getVoucherId(), clinic.getClinicId(), BigDecimal.valueOf(300000));
        
        assertEquals(0, BigDecimal.valueOf(30000).compareTo(discount));
    }

    @Test
    @DisplayName("TC-UNIT-VOUCHER-014: Pet Owner tính toán discount voucher lỗi do chưa đạt tối thiểu")
    void calculateVoucherDiscount_BelowMinOrder() {
        when(clinicVoucherRepository.findByVoucherVoucherIdAndClinicClinicId(voucherPercentage.getVoucherId(), clinic.getClinicId()))
                .thenReturn(Optional.of(clinicVoucher));

        // Đơn 50k, yêu cầu min 100k
        BadRequestException ex = assertThrows(BadRequestException.class, () -> 
            voucherService.calculateVoucherDiscount(voucherPercentage.getVoucherId(), clinic.getClinicId(), BigDecimal.valueOf(50000))
        );
        assertTrue(ex.getMessage().contains("chưa đạt tối thiểu"));
    }
}
