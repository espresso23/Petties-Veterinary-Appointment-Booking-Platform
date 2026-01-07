package com.petties.petties.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StringUtils;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Firebase Configuration for Push Notifications
 */
@Configuration
@Slf4j
public class FirebaseConfig {

    @Value("${firebase.credentials-path:}")
    private String credentialsPath;

    @Value("${firebase.project-id:petties-app}")
    private String projectId;

    @PostConstruct
    public void initialize() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                InputStream serviceAccount = getCredentialsStream();

                if (serviceAccount != null) {
                    FirebaseOptions options = FirebaseOptions.builder()
                            .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                            .setProjectId(projectId)
                            .build();

                    FirebaseApp.initializeApp(options);
                    log.info("Firebase initialized successfully with project: {}", projectId);
                } else {
                    log.warn("Firebase credentials not found. Push notifications will be disabled.");
                }
            }
        } catch (IOException e) {
            log.error("Error initializing Firebase: {}", e.getMessage());
        }
    }

    private InputStream getCredentialsStream() {
        try {
            // First try external path
            if (StringUtils.hasText(credentialsPath)) {
                return new FileInputStream(credentialsPath);
            }

            // Try classpath
            ClassPathResource resource = new ClassPathResource("firebase-service-account.json");
            if (resource.exists()) {
                return resource.getInputStream();
            }
        } catch (IOException e) {
            log.debug("Could not load Firebase credentials: {}", e.getMessage());
        }
        return null;
    }

    @Bean
    public FirebaseMessaging firebaseMessaging() {
        if (FirebaseApp.getApps().isEmpty()) {
            log.warn("FirebaseApp not initialized. FirebaseMessaging bean will be null.");
            return null;
        }
        return FirebaseMessaging.getInstance();
    }
}
