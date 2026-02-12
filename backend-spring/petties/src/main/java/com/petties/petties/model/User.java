package com.petties.petties.model;

import com.petties.petties.model.enums.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.springframework.data.annotation.CreatedDate;
import org.hibernate.annotations.SQLRestriction;

import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.enums.StaffSpecialty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(columnNames = "username"),
        @UniqueConstraint(columnNames = "email")
})
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@SQLDelete(sql = "UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?")
@SQLRestriction("deleted_at IS NULL")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "phone", unique = true, length = 20)
    private String phone;

    @Column(name = "email", unique = true, length = 100)
    private String email;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(name = "avatar", length = 500)
    private String avatar;

    @Column(name = "avatar_public_id", length = 100)
    private String avatarPublicId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // ========== STAFF-SPECIFIC FIELDS ==========

    // Chuyên môn của Staff (VET hoặc GROOMER)
    @Enumerated(EnumType.STRING)
    @Column(name = "specialty", length = 100)
    private StaffSpecialty specialty;

    // Rating trung bình của Staff (1.0 - 5.0)
    @Column(name = "rating_avg", precision = 2, scale = 1)
    private BigDecimal ratingAvg;

    // Số lượt đánh giá
    @Column(name = "rating_count")
    private Integer ratingCount;

    // FCM Token for push notifications
    @Column(name = "fcm_token", length = 500)
    private String fcmToken;

    // Address for Pet Owner (used in bookings)
    @Column(name = "address", length = 500)
    private String address;

    // For Clinic Owners: The clinics they own (1 owner can have multiple clinics)
    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL)
    private List<Clinic> ownedClinics = new ArrayList<>();

    // For Managers and Staff: The clinic they belong to
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "working_clinic_id")
    private Clinic workingClinic;

    // Manual Getter for Lombok issue workaround
    public UUID getUserId() {
        return this.userId;
    }

    public Clinic getWorkingClinic() {
        return this.workingClinic;
    }
}
