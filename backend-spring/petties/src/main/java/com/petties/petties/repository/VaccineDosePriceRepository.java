package com.petties.petties.repository;

import com.petties.petties.model.VaccineDosePrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VaccineDosePriceRepository extends JpaRepository<VaccineDosePrice, UUID> {

    /**
     * Lấy tất cả giá theo mũi của một dịch vụ
     */
    List<VaccineDosePrice> findByServiceServiceId(UUID serviceId);

    /**
     * Lấy giá theo mũi của một dịch vụ (chỉ active)
     */
    List<VaccineDosePrice> findByServiceServiceIdAndIsActiveTrue(UUID serviceId);

    /**
     * Lấy giá cụ thể theo service và số mũi
     */
    Optional<VaccineDosePrice> findByServiceServiceIdAndDoseNumber(UUID serviceId, Integer doseNumber);

    /**
     * Kiểm tra tồn tại
     */
    boolean existsByServiceServiceIdAndDoseNumber(UUID serviceId, Integer doseNumber);

    /**
     * Xóa tất cả giá của một dịch vụ
     */
    void deleteByServiceServiceId(UUID serviceId);
}
