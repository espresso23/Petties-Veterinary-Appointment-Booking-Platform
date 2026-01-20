package com.petties.petties.config;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
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
            seedTestClinics();
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
        User petOwner2 = initializeUser("petOwner2", "owner2", "owner2@petties.world", "Jane Pet Owner",
                Role.PET_OWNER);
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

        // Seed a second conversation from petOwner2
        if (petOwner2 != null && clinicManager != null && clinic != null) {
            seedConversationAndMessages(petOwner2, clinicManager, clinic);
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
        user.setEmail(email);
        user.setPhone("0" + (long) (Math.random() * 1000000000L)); // Random valid-looking phone
        user.setFullName(fullName);
        user.setRole(role);

        // Add dummy FCM token for testing push notifications logic
        user.setFcmToken("dummy_token_" + username);

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
     * Seed test clinics for HCM City and Da Nang
     */
    private void seedTestClinics() {
        log.info("🏥 Seeding test clinics for HCM City and Da Nang...");

        // Create clinic owners if not exist
        User hcmOwner1 = initializeUser("clinic_hcm1", "123456", "hcm1@petclinic.vn", "Nguyễn Văn An",
                Role.CLINIC_OWNER);
        User hcmOwner2 = initializeUser("clinic_hcm2", "123456", "hcm2@petclinic.vn", "Trần Thị Bình",
                Role.CLINIC_OWNER);
        User dnOwner1 = initializeUser("clinic_dn1", "123456", "dn1@petclinic.vn", "Phạm Minh Đức", Role.CLINIC_OWNER);
        User dnOwner2 = initializeUser("clinic_dn2", "123456", "dn2@petclinic.vn", "Võ Thị Hoa", Role.CLINIC_OWNER);

        // HCM City Clinics
        if (hcmOwner1 != null) {
            createTestClinic(hcmOwner1, "Phòng Khám Thú Y Sài Gòn Pet Care",
                    "123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM", "02838123456",
                    "Quận 1", "TP. Hồ Chí Minh", 10.7731, 106.6980, 4.8, 156);

            createTestClinic(hcmOwner1, "Thú Y Thủ Đức 24h",
                    "456 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM", "02837456789",
                    "TP. Thủ Đức", "TP. Hồ Chí Minh", 10.8510, 106.7590, 4.5, 98);
        }

        if (hcmOwner2 != null) {
            createTestClinic(hcmOwner2, "Pet Hospital Quận 3",
                    "45 Võ Văn Tần, Phường 6, Quận 3, TP.HCM", "02839234567",
                    "Quận 3", "TP. Hồ Chí Minh", 10.7812, 106.6892, 4.9, 234);

            createTestClinic(hcmOwner2, "Phú Mỹ Hưng Pet Clinic",
                    "789 Nguyễn Đức Cảnh, Phường Tân Phong, Quận 7, TP.HCM", "02854345678",
                    "Quận 7", "TP. Hồ Chí Minh", 10.7295, 106.7186, 4.7, 189);

            createTestClinic(hcmOwner2, "Happy Pets Clinic Bình Thạnh",
                    "234 Đinh Bộ Lĩnh, Phường 26, Quận Bình Thạnh, TP.HCM", "02835567890",
                    "Quận Bình Thạnh", "TP. Hồ Chí Minh", 10.8015, 106.7120, 4.6, 112);
        }

        // Da Nang Clinics
        if (dnOwner1 != null) {
            createTestClinic(dnOwner1, "Phòng Khám Thú Y Đà Nẵng Pet",
                    "56 Trần Phú, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng", "02363123456",
                    "Quận Hải Châu", "Đà Nẵng", 16.0678, 108.2208, 4.7, 87);

            createTestClinic(dnOwner1, "Thú Y Thanh Khê Care",
                    "78 Điện Biên Phủ, Phường Thanh Khê Đông, Quận Thanh Khê, Đà Nẵng", "02363345678",
                    "Quận Thanh Khê", "Đà Nẵng", 16.0712, 108.1892, 4.4, 56);

            createTestClinic(dnOwner1, "Liên Chiểu Animal Hospital",
                    "456 Nguyễn Lương Bằng, Phường Hòa Khánh Bắc, Quận Liên Chiểu, Đà Nẵng", "02363567890",
                    "Quận Liên Chiểu", "Đà Nẵng", 16.0834, 108.1456, 4.5, 92);
        }

        if (dnOwner2 != null) {
            createTestClinic(dnOwner2, "Biển Xanh Pet Hospital",
                    "123 Võ Nguyên Giáp, Phường Phước Mỹ, Quận Sơn Trà, Đà Nẵng", "02363234567",
                    "Quận Sơn Trà", "Đà Nẵng", 16.0544, 108.2456, 4.8, 134);

            createTestClinic(dnOwner2, "Ngũ Hành Sơn Pet Clinic",
                    "234 Lê Văn Hiến, Phường Khuê Mỹ, Quận Ngũ Hành Sơn, Đà Nẵng", "02363456789",
                    "Quận Ngũ Hành Sơn", "Đà Nẵng", 16.0189, 108.2512, 4.6, 78);
        }

        log.info("✅ Test clinics seeded successfully!");
    }

    /**
     * Helper to create a test clinic with full details
     */
    private void createTestClinic(User owner, String name, String address, String phone,
            String district, String province, double lat, double lng,
            double rating, int ratingCount) {
        // Check if clinic with this name already exists
        if (clinicRepository.findByName(name).isPresent()) {
            log.info("   - Clinic '{}' already exists.", name);
            return;
        }

        Clinic clinic = new Clinic();
        clinic.setOwner(owner);
        clinic.setName(name);
        clinic.setAddress(address);
        clinic.setPhone(phone);
        clinic.setDistrict(district);
        clinic.setProvince(province);
        clinic.setLatitude(java.math.BigDecimal.valueOf(lat));
        clinic.setLongitude(java.math.BigDecimal.valueOf(lng));
        clinic.setRatingAvg(java.math.BigDecimal.valueOf(rating));
        clinic.setRatingCount(ratingCount);
        clinic.setStatus(ClinicStatus.APPROVED);
        clinic.setDescription("Phòng khám thú y chuyên nghiệp với đội ngũ bác sĩ giàu kinh nghiệm.");
        clinic.setLogo("https://picsum.photos/seed/" + name.hashCode() + "/400/400");

        // Set operating hours using proper OperatingHours objects
        java.util.Map<String, com.petties.petties.model.OperatingHours> operatingHours = new java.util.HashMap<>();
        String[] days = { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" };
        for (String day : days) {
            com.petties.petties.model.OperatingHours hours = new com.petties.petties.model.OperatingHours();
            hours.setOpenTime(java.time.LocalTime.of(8, 0));
            hours.setCloseTime(day.equals("sunday") ? java.time.LocalTime.of(17, 0) : java.time.LocalTime.of(20, 0));
            hours.setIsClosed(false);
            operatingHours.put(day, hours);
        }
        clinic.setOperatingHours(operatingHours);

        try {
            clinicRepository.save(clinic);
            log.info("   + Created clinic '{}' in {} - Rating: {}", name, district, rating);
        } catch (Exception e) {
            log.error("   x Failed to create clinic '{}': {}", name, e.getMessage());
        }
    }
}
