package com.petties.petties.model.enums;

/**
 * Staff Specialty - Chuyên môn của nhân viên
 *
 * Đơn giản hóa còn 2 loại: VET (bác sĩ thú y) và GROOMER (nhân viên chăm sóc thú cưng)
 * Filter dịch vụ và gán staff thuận tiện hơn
 */
public enum StaffSpecialty {
    VET("Bác sĩ thú y"),
    GROOMER("Nhân viên chăm sóc thú cưng");

    private final String vietnameseLabel;

    StaffSpecialty(String vietnameseLabel) {
        this.vietnameseLabel = vietnameseLabel;
    }

    public String getVietnameseLabel() {
        return vietnameseLabel;
    }
}
