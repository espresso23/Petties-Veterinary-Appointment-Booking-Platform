package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Vaccine Master Data - Dữ liệu mẫu Vắc-xin
 * Configuration for vaccine rules, intervals, and series.
 */
@Entity
@Table(name = "vaccine_templates")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VaccineTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "vaccine_template_id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 100)
    private String name; // e.g. "Vaccine 5-in-1 (Puppy)"

    @Column(name = "manufacturer", length = 100)
    private String manufacturer; // e.g. "Zoetis"

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "default_price", precision = 19, scale = 2)
    private java.math.BigDecimal defaultPrice;

    // Rules for scheduling
    @Column(name = "min_age_weeks")
    private Integer minAgeWeeks; // Minimum age in weeks to start (e.g. 6)

    @Column(name = "repeat_interval_days")
    private Integer repeatIntervalDays; // Days until next dose (e.g. 21)

    @Column(name = "series_doses")
    private Integer seriesDoses; // Total doses in series (e.g. 3)

    @Column(name = "is_annual_repeat")
    private Boolean isAnnualRepeat = false; // Is this an annual booster?

    @Column(name = "min_interval_days")
    private Integer minIntervalDays; // Minimum days between doses for safety

    @Enumerated(EnumType.STRING)
    @Column(name = "target_species", nullable = false, length = 10)
    private com.petties.petties.model.enums.TargetSpecies targetSpecies; // DOG, CAT, or BOTH

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
