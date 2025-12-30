package com.petties.petties.dto.clinic;

import com.petties.petties.model.OperatingHours;
import com.petties.petties.model.enums.ClinicStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO for clinic response
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicResponse {

    private UUID clinicId;
    private OwnerInfo owner;
    private String name;
    private String description;
    private String address;
    private String ward; // Phường/xã
    private String district; // Quận/huyện
    private String province; // Tỉnh/thành phố
    private String specificLocation; // Vị trí chính xác
    private String phone;
    private String email;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String logo; // URL to clinic logo
    private Map<String, OperatingHours> operatingHours;
    private ClinicStatus status;
    private String rejectionReason;
    private BigDecimal ratingAvg;
    private Integer ratingCount;
    private LocalDateTime approvedAt;
    private List<String> images;
    private List<ImageInfo> imageDetails;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Double distance; // For nearby search results

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OwnerInfo {
        private UUID userId;
        private String fullName;
        private String email;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ImageInfo {
        private UUID imageId;
        private UUID clinicId;
        private String imageUrl;
        private String caption;
        private Integer displayOrder;
        private Boolean isPrimary;
    }
}
