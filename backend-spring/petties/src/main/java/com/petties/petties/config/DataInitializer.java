package com.petties.petties.config;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.ChatBoxRepository;
import com.petties.petties.repository.ChatMessageRepository;
import com.petties.petties.model.ChatBox;
import com.petties.petties.model.ChatMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Data Initializer - Seed data on application startup
 * 
 * PRODUCTION: Only creates admin user (admin/admin)
 * DEV/TEST: Creates test users for all roles
 * 
 * Control via environment: SPRING_PROFILES_ACTIVE=prod
 */
@Component
@RequiredArgsConstructor
@Slf4j

public class DataInitializer implements CommandLineRunner {
    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final PasswordEncoder passwordEncoder;
    private final ChatBoxRepository chatBoxRepository;
    private final ChatMessageRepository chatMessageRepository;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${app.init.seed-test-data:true}")
    private boolean seedTestData;

    @Override
    public void run(String... args) throws Exception {
        log.info("🚀 Starting data initialization...");
        log.info("   Active profile: {}", activeProfile);
        log.info("   Seed test data: {}", seedTestData);

        // ALWAYS create admin user (required for system operation)
        initializeAdminUser();

        // Only seed test data in non-production environments
        if (shouldSeedTestData()) {
            log.info("📦 Seeding test data for development/testing...");
            seedTestUsers();
        } else {
            log.info("🔒 Production mode - skipping test data seeding");
        }

        log.info("✅ Data initialization completed!");
    }

    /**
     * Determine if test data should be seeded
     * Returns false if:
     * - Profile is "prod" or "production"
     * - app.init.seed-test-data is explicitly set to false
     */
    private boolean shouldSeedTestData() {
        // Check if production profile
        if (activeProfile != null &&
                (activeProfile.equalsIgnoreCase("prod") ||
                        activeProfile.equalsIgnoreCase("production"))) {
            return false;
        }
        // Check explicit config
        return seedTestData;
    }

    /**
     * Initialize admin user - ALWAYS runs (required for system)
     * Uses environment variables for credentials in production
     */
    private void initializeAdminUser() {
        String adminUsername = System.getenv("ADMIN_USERNAME");
        String adminPassword = System.getenv("ADMIN_PASSWORD");
        String adminEmail = System.getenv("ADMIN_EMAIL");

        // Fallback to defaults if env vars not set
        if (adminUsername == null || adminUsername.isBlank()) {
            adminUsername = "admin";
        }
        if (adminPassword == null || adminPassword.isBlank()) {
            adminPassword = "admin";
        }
        if (adminEmail == null || adminEmail.isBlank()) {
            adminEmail = "admin@petties.world";
        }

        initializeUser(adminUsername, adminPassword, adminEmail, "System Admin", Role.ADMIN);
    }

    /**
     * Seed test users for development/testing
     */
    private void seedTestUsers() {
        User petOwner = initializeUser("petOwner", "owner", "owner@petties.world", "John Pet Owner", Role.PET_OWNER);
        User clinicOwner = initializeUser("clinicOwner", "123456", "owner@clinic.com", "Clinic Owner User",
                Role.CLINIC_OWNER);
        User clinicManager = initializeUser("clinicManager", "123456", "manager@clinic.com", "Clinic Manager User",
                Role.CLINIC_MANAGER);
        initializeUser("vet", "123456", "vet@clinic.com", "Dr. Vet User", Role.VET);

        // Initialize a clinic for the clinic owner
        Clinic clinic = null;
        if (clinicOwner != null) {
            initializeClinic(clinicOwner, "Petties Central Hospital", "123 Pet Street, Hanoi", "0123456789");
            // Sửa: lấy clinic đầu tiên của owner (nếu có)
            clinic = clinicRepository.findByOwnerUserId(clinicOwner.getUserId(), org.springframework.data.domain.PageRequest.of(0,1))
                    .stream().findFirst().orElse(null);
        }

        // Seed chat box & messages between pet owner và clinic manager (nếu đủ dữ liệu)
        if (petOwner != null && clinicManager != null && clinic != null) {
            seedChatBoxAndMessages(petOwner, clinicManager, clinic);
        }
    }

    /**
     * Seed ChatBox và ChatMessage mẫu giữa pet owner và clinic manager
     */
    private void seedChatBoxAndMessages(User petOwner, User clinicManager, Clinic clinic) {
        // Kiểm tra đã có ChatBox chưa (1-1 giữa petOwner và clinic)
        ChatBox chatBox = chatBoxRepository.findByPetOwnerIdAndClinicId(petOwner.getUserId(), clinic.getClinicId())
                .orElse(null);
        if (chatBox == null) {
            chatBox = new ChatBox();
            chatBox.setPetOwnerId(petOwner.getUserId());
            chatBox.setClinicId(clinic.getClinicId());
            chatBox.setClinicName(clinic.getName());
            chatBox.setClinicLogo(null);
            chatBox.setPetOwnerName(petOwner.getFullName());
            chatBox.setPetOwnerAvatar(null);
            chatBox.setUnreadCountPetOwner(0);
            chatBox.setUnreadCountClinic(0);
            chatBox.setPetOwnerOnline(false);
            chatBox.setClinicOnline(false);
            chatBox.setLastMessage(null);
            chatBox.setLastMessageAt(null);
            chatBox = chatBoxRepository.save(chatBox);
        }

        // Tạo 2 tin nhắn mẫu (1 từ pet owner, 1 từ clinic manager)
        if (chatMessageRepository.countByChatBoxId(chatBox.getId()) == 0) {
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            ChatMessage msg1 = new ChatMessage();
            msg1.setChatBoxId(chatBox.getId());
            msg1.setSenderId(petOwner.getUserId());
            msg1.setSenderType(ChatMessage.SenderType.PET_OWNER);
            msg1.setContent("Xin chào phòng khám, tôi muốn đặt lịch khám cho thú cưng!");
            msg1.setCreatedAt(now.minusSeconds(120));
            msg1.setRead(false); // Sửa đúng tên setter
            chatMessageRepository.save(msg1);

            ChatMessage msg2 = new ChatMessage();
            msg2.setChatBoxId(chatBox.getId());
            msg2.setSenderId(clinicManager.getUserId());
            msg2.setSenderType(ChatMessage.SenderType.CLINIC);
            msg2.setContent("Chào bạn, bạn muốn đặt lịch vào thời gian nào?");
            msg2.setCreatedAt(now.minusSeconds(60));
            msg2.setRead(false); // Sửa đúng tên setter
            chatMessageRepository.save(msg2);
        }
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
            log.info("   + Created {} user: {} / {}", role, username,
                    role == Role.ADMIN ? "***" : password); // Don't log admin password
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
