package com.petties.petties.config;

import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Data Initializer - Insert sample users for testing
 * Runs automatically on application startup
 */
// @Component  // Temporarily disabled to allow backend to start
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("🚀 Starting data initialization...");

        // Create ADMIN user
        createUserIfNotExists(
            "admin",
            "admin123",
            "admin@petties.com",
            "Admin User",
            "+84123456789",
            Role.ADMIN
        );

        // Create CLINIC_OWNER users
        createUserIfNotExists(
            "owner1",
            "owner123",
            "owner1@petties.com",
            "Clinic Owner 1",
            "+84987654321",
            Role.CLINIC_OWNER
        );

        createUserIfNotExists(
            "owner2",
            "owner123",
            "owner2@petties.com",
            "Clinic Owner 2",
            "+84987654322",
            Role.CLINIC_OWNER
        );

        // Create VET users
        createUserIfNotExists(
            "vet1",
            "vet123",
            "vet1@petties.com",
            "Veterinarian 1",
            "+84987654330",
            Role.VET
        );

        createUserIfNotExists(
            "vet2",
            "vet123",
            "vet2@petties.com",
            "Veterinarian 2",
            "+84987654331",
            Role.VET
        );

        // Create PET_OWNER users
        createUserIfNotExists(
            "petowner1",
            "petowner123",
            "petowner1@petties.com",
            "Pet Owner 1",
            "+84987654340",
            Role.PET_OWNER
        );

        createUserIfNotExists(
            "petowner2",
            "petowner123",
            "petowner2@petties.com",
            "Pet Owner 2",
            "+84987654341",
            Role.PET_OWNER
        );

        // Create CLINIC_MANAGER user
        createUserIfNotExists(
            "manager1",
            "manager123",
            "manager1@petties.com",
            "Clinic Manager 1",
            "+84987654350",
            Role.CLINIC_MANAGER
        );

        log.info("✅ Data initialization completed!");
        log.info("📝 Sample users created:");
        log.info("   - admin / admin123 (ADMIN)");
        log.info("   - owner1 / owner123 (CLINIC_OWNER)");
        log.info("   - owner2 / owner123 (CLINIC_OWNER)");
        log.info("   - vet1 / vet123 (VET)");
        log.info("   - vet2 / vet123 (VET)");
        log.info("   - petowner1 / petowner123 (PET_OWNER)");
        log.info("   - petowner2 / petowner123 (PET_OWNER)");
        log.info("   - manager1 / manager123 (CLINIC_MANAGER)");
    }

    private void createUserIfNotExists(
            String username,
            String password,
            String email,
            String fullName,
            String phone,
            Role role) {

        // Check if user already exists
        if (userRepository.existsByUsername(username) ||
            userRepository.existsByEmail(email)) {
            log.debug("User {} already exists, skipping...", username);
            return;
        }

        // Create new user
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password)); // Hash password
        user.setEmail(email);
        user.setFullName(fullName);
        user.setPhone(phone);
        user.setRole(role);
        // createdAt and updatedAt will be set automatically by JPA Auditing

        userRepository.save(user);
        log.info("✅ Created user: {} ({})", username, role);
    }
}
