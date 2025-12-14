package com.petties.petties.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GoogleSignInRequest {
    
    @NotBlank(message = "ID token is required")
    private String idToken;
    
    @NotBlank(message = "Platform is required")
    private String platform; // "mobile" or "web"
}

