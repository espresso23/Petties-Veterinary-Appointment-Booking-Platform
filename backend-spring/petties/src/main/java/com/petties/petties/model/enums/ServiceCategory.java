package com.petties.petties.model.enums;

/**
 * Service Category - Loại dịch vụ
 *
 * Mỗi category map đến StaffSpecialty (VET hoặc GROOMER) để auto-assign staff
 */
public enum ServiceCategory {
    KHAM(StaffSpecialty.VET), // Legacy alias: Khám
    GROOMING_SPA(StaffSpecialty.GROOMER), // Làm đẹp & Spa
    VACCINATION(StaffSpecialty.VET), // Tiêm phòng
    CHECK_UP(StaffSpecialty.VET), // Khám tổng quát
    SURGERY(StaffSpecialty.VET), // Phẫu thuật
    DENTAL(StaffSpecialty.VET), // Nha khoa
    DERMATOLOGY(StaffSpecialty.VET), // Da liễu
    OTHER(StaffSpecialty.VET); // Khác - fallback

    private final StaffSpecialty requiredSpecialty;

    ServiceCategory(StaffSpecialty requiredSpecialty) {
        this.requiredSpecialty = requiredSpecialty;
    }

    public StaffSpecialty getRequiredSpecialty() {
        return requiredSpecialty;
    }
}
