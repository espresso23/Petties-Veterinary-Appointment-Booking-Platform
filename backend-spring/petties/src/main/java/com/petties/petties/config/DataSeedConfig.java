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
        public CommandLineRunner seedAdmin() {
                return args -> {
                        String adminUsername = System.getenv("ADMIN_USERNAME") != null 
                                        ? System.getenv("ADMIN_USERNAME") 
                                        : "admin";
                        
                        boolean adminExists = userRepository.existsByUsername(adminUsername);
                        
                        if (!adminExists) {
                                User admin = new User();
                                admin.setUsername(adminUsername);
                                admin.setPassword(passwordEncoder.encode("admin"));
                                admin.setEmail("admin@petties.world");
                                admin.setFullName("Administrator");
                                admin.setRole(Role.ADMIN);
                                admin.setCreatedAt(LocalDateTime.now());
                                
                                userRepository.save(admin);
                                log.info("=== SEED: Admin user '{}' created successfully ===", adminUsername);
                        } else {
                                log.debug("=== SEED: Admin user '{}' already exists, skipping ===", adminUsername);
                        }
                };
        }
}