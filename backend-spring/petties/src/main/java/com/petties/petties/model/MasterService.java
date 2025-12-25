package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Master Service Entity - Template dịch vụ cho tất cả clinic
 * CLINIC_OWNER có thể tạo template dịch vụ ở đây
 * Các clinic sau đó có thể inherit (thừa hưởng) hoặc tự tạo custom service
 */
@Entity
@Table(name = "master_services")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MasterService {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "master_service_id", updatable = false, nullable = false)
    private UUID masterServiceId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "default_price", nullable = false, precision = 19, scale = 2)
    private BigDecimal defaultPrice;

    @Column(name = "duration_time", nullable = false)
    private Integer durationTime;

    @Column(name = "slots_required", nullable = false)
    private Integer slotsRequired;

    @Column(name = "is_home_visit", nullable = false)
    private Boolean isHomeVisit = false;

    @Column(name = "default_price_per_km", precision = 19, scale = 2)
    private BigDecimal defaultPricePerKm;

    @Column(name = "service_category", length = 100)
    private String serviceCategory;

    @Column(name = "pet_type", length = 100)
    private String petType;

    @Column(name = "icon", length = 100)
    private String icon;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
