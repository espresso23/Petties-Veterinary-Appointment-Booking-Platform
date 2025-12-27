package com.petties.petties.config;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Data Initializer - Insert sample users for testing
 * Runs automatically on application startup
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        log.info("🚀 Starting data initialization...");

        // Initialize users for all roles for testing
        initializeUser("admin", "admin", "admin@petties.world", "System Admin", Role.ADMIN);
        initializeUser("petOwner", "owner", "owner@petties.world", "John Pet Owner", Role.PET_OWNER);
        User clinicOwner = initializeUser("clinicOwner", "clinicowner", "owner@clinic.com", "Clinic Owner User",
                Role.CLINIC_OWNER);
        initializeUser("clinicManager", "clinicmanager", "manager@clinic.com", "Clinic Manager User",
                Role.CLINIC_MANAGER);
        initializeUser("vet", "vet123", "vet@clinic.com", "Dr. Vet User", Role.VET);

        // Initialize a clinic for the clinic owner
        if (clinicOwner != null) {
            initializeClinic(clinicOwner, "Petties Central Hospital", "123 Pet Street, Hanoi", "0123456789");
        }

        log.info("✅ Data initialization completed!");
    }

    /**
     * Helper method to initialize a user if they don't exist
     */
    private User initializeUser(String username, String password, String email, String fullName, Role role) {
        // Check by username
        if (userRepository.existsByUsername(username)) {
            log.info("   - User with username '{}' ({}) already exists.", username, role);
            return userRepository.findByUsername(username).orElse(null);
        }

        // Check by email to prevent duplicate key error
        if (userRepository.existsByEmail(email)) {
            log.info("   - User with email '{}' ({}) already exists.", email, role);
            return userRepository.findByEmail(email).orElse(null);
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setEmail(email);
        user.setPhone("0" + (long) (Math.random() * 1000000000L)); // Random valid-looking phone
        user.setFullName(fullName);
        user.setRole(role);

        try {
            User savedUser = userRepository.save(user);
            log.info("   + Created {} user: {} / {}", role, username, password);
            return savedUser;
        } catch (Exception e) {
            log.error("   x Failed to create user {}: {}", username, e.getMessage());
            return null;
        }
    }

    /**
     * Helper method to initialize a clinic if owner doesn't have one
     */
    private void initializeClinic(User owner, String name, String address, String phone) {
        if (clinicRepository.existsByOwnerUserId(owner.getUserId())) {
            log.info("   - Clinic for '{}' already exists.", owner.getUsername());
            return;
        }

        Clinic clinic = new Clinic();
        clinic.setOwner(owner);
        clinic.setName(name);
        clinic.setAddress(address);
        clinic.setPhone(phone);
        clinic.setStatus(ClinicStatus.APPROVED);

        try {
            clinicRepository.save(clinic);
            log.info("   + Created clinic '{}' for user '{}'", name, owner.getUsername());
        } catch (Exception e) {
            log.error("   x Failed to create clinic: {}", e.getMessage());
        }
    }
}
