package com.petties.petties.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO response cho avatar upload
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AvatarResponse {

    private String avatarUrl;
    private String publicId;
    private String message;
}
