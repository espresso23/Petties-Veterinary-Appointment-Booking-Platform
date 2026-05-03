package com.petties.petties.config;

import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Data seed configuration for development environments.
 * Creates default admin user if not exists for easy local development.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeedConfig {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;

        @Bean
        public CommandLineRunner seedData() {
                return args -> {
                        // 1. Seed ADMIN
                        seedUser("admin", "admin", "admin@petties.world", Role.ADMIN, "System Administrator");

                        // 2. Seed CLINIC_OWNER
                        seedUser("owner1", "123456", "owner1@petties.com", Role.CLINIC_OWNER, "Demo Clinic Owner");

                        // 3. Seed PET_OWNER
                        seedUser("petowner1", "123456", "petowner1@petties.com", Role.PET_OWNER, "Demo Pet Owner");
                };
        }

        private void seedUser(String username, String rawPassword, String email, Role role, String fullName) {
                if (userRepository.findByUsername(username).isEmpty()) {
                        User user = User.builder()
                                        .username(username)
                                        .password(passwordEncoder.encode(rawPassword))
                                        .email(email)
                                        .role(role)
                                        .fullName(fullName)
                                        .createdAt(LocalDateTime.now())
                                        .build();

                        userRepository.save(user);
                        log.info("=== SEED: {} '{}' created successfully (Pass: {}) ===", role, username, rawPassword);
                } else {
                        log.debug("=== SEED: {} '{}' already exists, skipping ===", role, username);
                }
        }}