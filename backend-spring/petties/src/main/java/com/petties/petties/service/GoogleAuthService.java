package com.petties.petties.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.petties.petties.exception.UnauthorizedException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service for Google ID Token verification
 */
@Slf4j
@Service
public class GoogleAuthService {

    @Value("${google.client-id}")
    private String googleWebClientId;

    // Android Client IDs for different signing keys (debug/release/production)
    @Value("${google.android-client-ids:}")
    private String androidClientIds;

    // iOS Client ID
    @Value("${google.ios-client-id:}")
    private String iosClientId;

    private GoogleIdTokenVerifier verifier;

    @PostConstruct
    public void init() {
        // Build list of all valid audience IDs
        java.util.List<String> validAudiences = new java.util.ArrayList<>();

        // Add Web Client ID (always required)
        validAudiences.add(googleWebClientId);

        // Add Android Client IDs if configured
        if (androidClientIds != null && !androidClientIds.isBlank()) {
            for (String id : androidClientIds.split(",")) {
                if (!id.isBlank()) {
                    validAudiences.add(id.trim());
                }
            }
        }

        // Add iOS Client ID if configured
        if (iosClientId != null && !iosClientId.isBlank()) {
            validAudiences.add(iosClientId.trim());
        }

        verifier = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance())
                .setAudience(validAudiences)
                .build();

        log.info("GoogleAuthService initialized with {} valid audience(s): {}",
                validAudiences.size(),
                validAudiences.stream()
                        .map(id -> id.substring(0, Math.min(20, id.length())) + "...")
                        .toList());
    }

    /**
     * Verify Google ID Token and extract user information
     * 
     * @param idToken The ID token from Google Sign-In
     * @return GoogleUserInfo containing email, name, and picture
     * @throws UnauthorizedException if token is invalid
     */
    public GoogleUserInfo verifyIdToken(String idToken) {
        try {
            GoogleIdToken googleIdToken = verifier.verify(idToken);

            if (googleIdToken == null) {
                log.error("Invalid Google ID token - verification returned null");
                throw new UnauthorizedException("Token Google không hợp lệ");
            }

            GoogleIdToken.Payload payload = googleIdToken.getPayload();

            // Verify email is verified
            Boolean emailVerified = payload.getEmailVerified();
            if (emailVerified == null || !emailVerified) {
                log.error("Google account email not verified");
                throw new UnauthorizedException("Email tài khoản Google chưa được xác minh");
            }

            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String picture = (String) payload.get("picture");
            String googleId = payload.getSubject();

            log.info("Successfully verified Google ID token for email: {}", email);

            return new GoogleUserInfo(googleId, email, name, picture);

        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error verifying Google ID token: {}", e.getMessage());
            throw new UnauthorizedException("Không thể xác minh token Google: " + e.getMessage());
        }
    }

    /**
     * Data class for Google user information
     */
    public record GoogleUserInfo(
            String googleId,
            String email,
            String name,
            String picture) {
    }
}
