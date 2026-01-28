package com.petties.petties.model;

import com.petties.petties.model.enums.ClinicStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Entity representing a veterinary clinic
 * According to ERD specification
 */
@Entity
@Table(name = "clinics")
@SQLDelete(sql = "UPDATE clinics SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ?")
@SQLRestriction("deleted_at IS NULL")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Clinic {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "clinic_id", updatable = false, nullable = false)
    private UUID clinicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false, unique = false)
    private User owner;

    @OneToMany(mappedBy = "workingClinic", cascade = CascadeType.ALL)
    private List<User> staff;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "address", nullable = false, length = 500)
    private String address;

    @Column(name = "ward", length = 100)
    private String ward; // Phường/Xã

    @Column(name = "district", length = 100)
    private String district; // Quận/huyện

    @Column(name = "province", length = 100)
    private String province; // Tỉnh/thành phố

    @Column(name = "specific_location", length = 200)
    private String specificLocation; // Vị trí chính xác (khu phố, tầng lầu, số nhà, etc.)

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "latitude", precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "logo", length = 500)
    private String logo; // URL to clinic logo (nullable, single file like images but only one)

    @Column(name = "business_license_url", length = 500)
    private String businessLicenseUrl; // URL to business license/veterinary practice certificate

    @Convert(converter = com.petties.petties.converter.OperatingHoursConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "operating_hours", columnDefinition = "jsonb")
    private Map<String, OperatingHours> operatingHours = new HashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ClinicStatus status = ClinicStatus.PENDING;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "rating_avg", precision = 2, scale = 1)
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(name = "rating_count")
    private Integer ratingCount = 0;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // Relationships
    @OneToMany(mappedBy = "clinic", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClinicImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "clinic")
    private List<ClinicService> services = new ArrayList<>();

}
