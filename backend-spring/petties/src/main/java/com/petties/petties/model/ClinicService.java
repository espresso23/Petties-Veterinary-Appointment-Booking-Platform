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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "clinic_services")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClinicService {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "service_id", updatable = false, nullable = false)
    private UUID serviceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false, updatable = false)
    private Clinic clinic;

    // NEW: Reference to Master Service (nullable - chỉ có khi inherit)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_service_id")
    private MasterService masterService;

    // NEW: Phân biệt Custom vs Inherited
    @Column(name = "is_custom", nullable = false)
    private Boolean isCustom = true;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "base_price", nullable = false, precision = 19, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "duration_time", nullable = false)
    private Integer durationTime;

    @Column(name = "slots_required", nullable = false)
    private Integer slotsRequired;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "is_home_visit", nullable = false)
    private Boolean isHomeVisit = false;

    @Column(name = "price_per_km", precision = 19, scale = 2)
    private BigDecimal pricePerKm;

    @Column(name = "service_category", length = 100)
    private String serviceCategory;

    @Column(name = "pet_type", length = 100)
    private String petType;

    @OneToMany(mappedBy = "service", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ServiceWeightPrice> weightPrices = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
