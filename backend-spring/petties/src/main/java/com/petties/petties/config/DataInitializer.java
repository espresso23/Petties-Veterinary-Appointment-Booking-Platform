package com.petties.petties.config;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.ChatConversationRepository;
import com.petties.petties.repository.ChatMessageRepository;
import com.petties.petties.model.ChatConversation;
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
    private final ChatConversationRepository conversationRepository;
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
        initializeVetUser("vet", "123456", "vet@clinic.com", "Dr. Vet User", StaffSpecialty.VET_GENERAL);

        // Initialize a clinic for the clinic owner
        Clinic clinic = null;
        if (clinicOwner != null) {
            initializeClinic(clinicOwner, "Petties Central Hospital", "123 Pet Street, Hanoi", "0123456789");
            // Sửa: lấy clinic đầu tiên của owner (nếu có)
            clinic = clinicRepository
                    .findByOwnerUserId(clinicOwner.getUserId(), org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst().orElse(null);

            // QUAN TRỌNG: Assign clinicManager và vet vào clinic này
            if (clinic != null) {
                if (clinicManager != null && clinicManager.getWorkingClinic() == null) {
                    clinicManager.setWorkingClinic(clinic);
                    userRepository.save(clinicManager);
                    log.info("   + Assigned clinicManager to clinic: {}", clinic.getName());
                }

                User vet = userRepository.findByUsername("vet").orElse(null);
                if (vet != null && vet.getWorkingClinic() == null) {
                    vet.setWorkingClinic(clinic);
                    userRepository.save(vet);
                    log.info("   + Assigned vet to clinic: {}", clinic.getName());
                }
            }
        }

        // Seed conversation & messages between pet owner và clinic manager (nếu đủ dữ
        // liệu)
        if (petOwner != null && clinicManager != null && clinic != null) {
            seedConversationAndMessages(petOwner, clinicManager, clinic);
        }
    }

    /**
     * Seed ChatConversation và ChatMessage mẫu giữa pet owner và clinic manager
     */
    private void seedConversationAndMessages(User petOwner, User clinicManager, Clinic clinic) {
        // Kiểm tra đã có Conversation chưa (1-1 giữa petOwner và clinic)
        ChatConversation conversation = conversationRepository
                .findByPetOwnerIdAndClinicId(petOwner.getUserId(), clinic.getClinicId())
                .orElse(null);
        if (conversation == null) {
            conversation = ChatConversation.builder()
                    .petOwnerId(petOwner.getUserId())
                    .clinicId(clinic.getClinicId())
                    .clinicName(clinic.getName())
                    .petOwnerName(petOwner.getFullName())
                    .build();
            conversation = conversationRepository.save(conversation);
        }

        // Tạo 2 tin nhắn mẫu (1 từ pet owner, 1 từ clinic manager)
        if (chatMessageRepository.countByChatBoxId(conversation.getId()) == 0) {
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            ChatMessage msg1 = new ChatMessage();
            msg1.setChatBoxId(conversation.getId());
            msg1.setSenderId(petOwner.getUserId());
            msg1.setSenderType(ChatMessage.SenderType.PET_OWNER);
            msg1.setContent("Xin chào phòng khám, tôi muốn đặt lịch khám cho thú cưng!");
            msg1.setCreatedAt(now.minusSeconds(120));
            msg1.setRead(false);
            chatMessageRepository.save(msg1);

            ChatMessage msg2 = new ChatMessage();
            msg2.setChatBoxId(conversation.getId());
            msg2.setSenderId(clinicManager.getUserId());
            msg2.setSenderType(ChatMessage.SenderType.CLINIC);
            msg2.setContent("Chào bạn, bạn muốn đặt lịch vào thời gian nào?");
            msg2.setCreatedAt(now.minusSeconds(60));
            msg2.setRead(false);
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

    /**
     * Helper method to initialize a VET user with specialty
     */
    private User initializeVetUser(String username, String password, String email, String fullName, StaffSpecialty specialty) {
        // Check by username
        if (userRepository.existsByUsername(username)) {
            // Update existing vet's specialty if null
            User existingVet = userRepository.findByUsername(username).orElse(null);
            if (existingVet != null && existingVet.getSpecialty() == null) {
                existingVet.setSpecialty(specialty);
                existingVet.setAvatar("https://ui-avatars.com/api/?name=" + fullName.replace(" ", "+") + "&background=86EFAC&color=1c1917");
                userRepository.save(existingVet);
                log.info("   + Updated vet specialty: {} -> {}", username, specialty);
            }
            return existingVet;
        }

        // Check by email to prevent duplicate key error
        if (userRepository.existsByEmail(email)) {
            log.info("   - User with email '{}' (VET) already exists.", email);
            return userRepository.findByEmail(email).orElse(null);
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setEmail(email);
        user.setPhone("0" + (long) (Math.random() * 1000000000L));
        user.setFullName(fullName);
        user.setRole(Role.VET);
        user.setSpecialty(specialty);
        user.setAvatar("https://ui-avatars.com/api/?name=" + fullName.replace(" ", "+") + "&background=86EFAC&color=1c1917");

        try {
            User savedUser = userRepository.save(user);
            log.info("   + Created VET user: {} with specialty {}", username, specialty);
            return savedUser;
        } catch (Exception e) {
            log.error("   x Failed to create vet user {}: {}", username, e.getMessage());
            return null;
        }
    }
}
