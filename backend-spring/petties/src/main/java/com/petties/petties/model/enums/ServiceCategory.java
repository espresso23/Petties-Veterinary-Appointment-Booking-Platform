package com.petties.petties.model.enums;

/**
 * Service Category - Loại dịch vụ
 * 
 * Mỗi category map đến một StaffSpecialty để auto-assign staff
 */
public enum ServiceCategory {
    GROOMING_SPA(StaffSpecialty.GROOMER), // Làm đẹp & Spa
    VACCINATION(StaffSpecialty.VET_GENERAL), // Tiêm phòng
    CHECK_UP(StaffSpecialty.VET_GENERAL), // Khám tổng quát
    SURGERY(StaffSpecialty.VET_SURGERY), // Phẫu thuật
    DENTAL(StaffSpecialty.VET_DENTAL), // Nha khoa
    DERMATOLOGY(StaffSpecialty.VET_DERMATOLOGY), // Da liễu
    OTHER(StaffSpecialty.VET_GENERAL); // Khác - fallback

    private final StaffSpecialty requiredSpecialty;

    ServiceCategory(StaffSpecialty requiredSpecialty) {
        this.requiredSpecialty = requiredSpecialty;
    }

    public StaffSpecialty getRequiredSpecialty() {
        return requiredSpecialty;
    }
}
