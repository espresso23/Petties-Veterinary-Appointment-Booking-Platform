package com.petties.petties.dto.review;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ReviewResponseDTO {
    private UUID reviewId;
    private int rating;
    private String comment;
    private String userName;
    private String userAvatar;
    private LocalDateTime createdAt;
}
