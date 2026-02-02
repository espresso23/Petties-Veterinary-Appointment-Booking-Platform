package com.petties.petties.config;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.model.Prescription;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.repository.ClinicServiceRepository;
import com.petties.petties.repository.ChatConversationRepository;
import com.petties.petties.repository.ChatMessageRepository;
import com.petties.petties.model.ChatConversation;
import com.petties.petties.model.ChatMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
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
@Order(1) // Run BEFORE BookingDataSeeder (Order 2)
public class DataInitializer implements CommandLineRunner {
    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final PetRepository petRepository;
    private final EmrRecordRepository emrRecordRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final ClinicServiceRepository clinicServiceRepository;
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

        User clinicOwner = initializeUser("clinicOwner", "123456", "owner@clinic.com", "Clinic Owner User",
                Role.CLINIC_OWNER);
        User clinicManager = initializeUser("clinicManager", "123456", "manager@clinic.com", "Clinic Manager User",
                Role.CLINIC_MANAGER);
        initializeStaffUser("vet", "123456", "vet@clinic.com", "Dr. Vet User", StaffSpecialty.VET_GENERAL);

        // Create more pet owners for testing
        User petOwner2 = initializeUser("petOwner2", "owner", "nguyen.an@gmail.com", "Nguyễn Văn An", Role.PET_OWNER);
        User petOwner3 = initializeUser("petOwner3", "owner", "tran.binh@gmail.com", "Trần Thị Bình", Role.PET_OWNER);

        // Initialize a clinic for the clinic owner
        Clinic clinic = null;
        if (clinicOwner != null) {
            initializeClinic(clinicOwner, "Petties Central Hospital", "123 Pet Street, Hanoi", "0123456789");
            // Sửa: lấy clinic đầu tiên của owner (nếu có)
            clinic = clinicRepository
                    .findByOwnerUserId(clinicOwner.getUserId(), org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst().orElse(null);

            // QUAN TRỌNG: Assign clinicManager và staff vào clinic này
            if (clinic != null) {
                if (clinicManager != null && clinicManager.getWorkingClinic() == null) {
                    clinicManager.setWorkingClinic(clinic);
                    userRepository.save(clinicManager);
                    log.info("   + Assigned clinicManager to clinic: {}", clinic.getName());
                }

                User staff = userRepository.findByUsername("vet").orElse(null);
                if (staff != null && staff.getWorkingClinic() == null) {
                    staff.setWorkingClinic(clinic);
                    userRepository.save(staff);
                    log.info("   + Assigned staff to clinic: {}", clinic.getName());
                }

                // Ensure specific user has access to Clinic Data
                String targetEmail = "datdat13112004@gmail.com";
                User targetUser = userRepository.findByEmail(targetEmail).orElse(null);

                if (targetUser == null) {
                    // Create if not exists
                    targetUser = initializeUser("hoangdat", "123456", targetEmail, "Dr. Hoang Dat", Role.STAFF);
                }

                if (targetUser != null) {
                    boolean changed = false;
                    // Force Role STAFF
                    if (targetUser.getRole() != Role.STAFF && targetUser.getRole() != Role.ADMIN) {
                        targetUser.setRole(Role.STAFF);
                        changed = true;
                    }
                    // Assign Clinic
                    if (targetUser.getWorkingClinic() == null
                            || !targetUser.getWorkingClinic().getClinicId().equals(clinic.getClinicId())) {
                        targetUser.setWorkingClinic(clinic);
                        changed = true;
                    }

                    if (changed) {
                        userRepository.save(targetUser);
                        log.info("   + Updated existing user '{}' to Role STAFF and assigned Clinic '{}'", targetEmail,
                                clinic.getName());
                    }
                }
            }
        }

        // Seed pets for pet owners
        seedTestPets(petOwner, petOwner2, petOwner3);

        // Seed EMR records for pets
        User staffForEmr = userRepository.findByEmail("congnvde180639@fpt.edu.vn").orElse(null);
        if (staffForEmr == null) {
            staffForEmr = userRepository.findByUsername("vet").orElse(null);
        }

        if (staffForEmr != null && clinic != null) {
            seedTestEmrRecords(staffForEmr, clinic);
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

        // Seed transaction test data for TransactionService (from Payment branch)
        if (petOwner != null && clinic != null) {
            seedTransactionTestData(petOwner, clinic, clinicManager);
        }
    }

    /**
     * Seed test pets for development/testing
     */
    private void seedTestPets(User petOwner1, User petOwner2, User petOwner3) {
        log.info("🐾 Seeding test pets...");

        // Pets for petOwner1 (John Pet Owner)
        if (petOwner1 != null && !petRepository.existsByUserUserId(petOwner1.getUserId())) {
            createPet(petOwner1, "Bella", "Chó", "Golden Retriever", "2022-03-15", 15.5, "Cái", "Vàng kem",
                    "Dị ứng Penicillin");
            createPet(petOwner1, "Mimi", "Mèo", "Mèo Anh lông ngắn", "2023-06-20", 4.2, "Cái", "Xám", null);
        }

        // Pets for petOwner2 (Nguyễn Văn An)
        if (petOwner2 != null && !petRepository.existsByUserUserId(petOwner2.getUserId())) {
            createPet(petOwner2, "Rocky", "Chó", "French Bulldog", "2021-11-10", 12.0, "Đực", "Trắng đen", null);
            createPet(petOwner2, "Lucky", "Chó", "Corgi", "2023-01-05", 10.5, "Đực", "Vàng trắng",
                    "Dị ứng thức ăn biển");
        }

        // Pets for petOwner3 (Trần Thị Bình)
        if (petOwner3 != null && !petRepository.existsByUserUserId(petOwner3.getUserId())) {
            createPet(petOwner3, "Bunny", "Thỏ", "Holland Lop", "2024-02-14", 2.5, "Cái", "Trắng nâu", null);
        }
    }

    /**
     * Helper to create a pet
     */
    private void createPet(User owner, String name, String species, String breed, String dob, double weight,
            String gender, String color, String allergies) {
        try {
            Pet pet = new Pet();
            pet.setUser(owner);
            pet.setName(name);
            pet.setSpecies(species);
            pet.setBreed(breed);
            pet.setDateOfBirth(java.time.LocalDate.parse(dob));
            pet.setWeight(weight);
            pet.setGender(gender);
            pet.setColor(color);
            pet.setAllergies(allergies);
            petRepository.save(pet);
            log.info("   + Created pet '{}' ({}) for owner '{}'", name, species, owner.getFullName());
        } catch (Exception e) {
            log.error("   x Failed to create pet '{}': {}", name, e.getMessage());
        }
    }

    /**
     * Seed test EMR records for development/testing
     */
    private void seedTestEmrRecords(User staff, Clinic clinic) {
        log.info("📋 Seeding test EMR records...");

        // Get all pets to create EMR records for
        java.util.List<Pet> allPets = petRepository.findAll();
        if (allPets.isEmpty()) {
            log.info("   - No pets found, skipping EMR seeding");
            return;
        }

        // Check if EMR records already exist
        if (emrRecordRepository.count() > 0) {
            log.info("   - EMR records already exist, skipping");
            return;
        }

        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        for (Pet pet : allPets) {
            if (pet.getName().equals("Bella")) {
                // EMR 1 for Bella - Viêm tai ngoài
                EmrRecord emr1 = EmrRecord.builder()
                        .petId(pet.getId())
                        .staffId(staff.getUserId())
                        .clinicId(clinic.getClinicId())
                        .clinicName(clinic.getName())
                        .staffName(staff.getFullName())
                        .subjective(
                                "Chủ nuôi báo cáo: Bé gãi tai nhiều trong 3 ngày qua, có mùi hôi từ tai, lắc đầu thường xuyên.")
                        .objective(
                                "Kiểm tra lâm sàng: Tai trái đỏ, có dịch màu nâu đen, mùi hôi. Nhiệt độ 39.2°C. Phản xạ đau khi sờ tai. Cân nặng: 15.2kg.")
                        .assessment(
                                "Chẩn đoán: Viêm tai ngoài (Otitis Externa) do nhiễm nấm Malassezia. Khuyến nghị xét nghiệm tế bào học để xác nhận.")
                        .plan("1. Vệ sinh tai bằng dung dịch chuyên dụng 2 lần/ngày\n2. Thuốc nhỏ tai Otomax 5-7 giọt/tai x 2 lần/ngày x 7 ngày\n3. Tái khám sau 7 ngày\n4. Tránh để nước vào tai khi tắm")
                        .notes("Lưu ý: Bé có tiền sử dị ứng Penicillin, đã tránh kê thuốc kháng sinh nhóm này.")
                        .weightKg(new java.math.BigDecimal("15.2"))
                        .temperatureC(new java.math.BigDecimal("39.2"))
                        .prescriptions(java.util.List.of(
                                Prescription.builder()
                                        .medicineName("Otomax")
                                        .dosage("5-7 giọt/tai")
                                        .frequency("2 lần/ngày")
                                        .durationDays(7)
                                        .instructions("Nhỏ vào tai sau khi vệ sinh, massage nhẹ chân tai")
                                        .build(),
                                Prescription.builder()
                                        .medicineName("Dung dịch vệ sinh tai EpiOtic")
                                        .dosage("Đủ để đầy ống tai")
                                        .frequency("2 lần/ngày")
                                        .durationDays(14)
                                        .instructions("Đổ vào tai, massage 30 giây, lau sạch bằng bông")
                                        .build()))
                        .images(java.util.List.of())
                        .examinationDate(now.minusDays(7))
                        .createdAt(now.minusDays(7))
                        .build();
                emrRecordRepository.save(emr1);
                log.info("   + Created EMR for pet 'Bella' - Viêm tai ngoài");

                // EMR 2 for Bella - Tái khám
                EmrRecord emr2 = EmrRecord.builder()
                        .petId(pet.getId())
                        .staffId(staff.getUserId())
                        .clinicId(clinic.getClinicId())
                        .clinicName(clinic.getName())
                        .staffName(staff.getFullName())
                        .subjective(
                                "Tái khám sau 7 ngày điều trị viêm tai. Chủ nuôi cho biết bé đã bớt gãi, không còn lắc đầu nhiều.")
                        .objective(
                                "Tai đã giảm viêm đáng kể, dịch tiết giảm. Không còn mùi hôi. Nhiệt độ 38.5°C bình thường. Cân nặng: 15.5kg.")
                        .assessment("Viêm tai ngoài đang hồi phục tốt. Tiếp tục điều trị thêm 5 ngày.")
                        .plan("1. Tiếp tục thuốc nhỏ tai thêm 5 ngày\n2. Giảm vệ sinh tai xuống 1 lần/ngày\n3. Tái khám sau 1 tuần nếu còn triệu chứng")
                        .notes("Đáp ứng điều trị tốt.")
                        .weightKg(new java.math.BigDecimal("15.5"))
                        .temperatureC(new java.math.BigDecimal("38.5"))
                        .prescriptions(java.util.List.of(
                                Prescription.builder()
                                        .medicineName("Otomax")
                                        .dosage("5-7 giọt/tai")
                                        .frequency("2 lần/ngày")
                                        .durationDays(5)
                                        .instructions("Tiếp tục như trước")
                                        .build()))
                        .images(java.util.List.of())
                        .examinationDate(now)
                        .createdAt(now)
                        .build();
                emrRecordRepository.save(emr2);
                log.info("   + Created EMR for pet 'Bella' - Tái khám");

            } else if (pet.getName().equals("Rocky")) {
                // EMR for Rocky - Tiêu chảy
                EmrRecord emr = EmrRecord.builder()
                        .petId(pet.getId())
                        .staffId(staff.getUserId())
                        .clinicId(clinic.getClinicId())
                        .clinicName(clinic.getName())
                        .staffName(staff.getFullName())
                        .subjective(
                                "Bé tiêu chảy 2 ngày nay, phân lỏng có nhầy. Ăn ít, uống nước bình thường. Không nôn.")
                        .objective(
                                "Bụng hơi chướng, có tiếng óc ách khi ấn. Niêm mạc hồng nhạt. Nhiệt độ 39.0°C. Không có dấu hiệu mất nước nghiêm trọng. Cân nặng 11.8kg.")
                        .assessment(
                                "Viêm ruột cấp tính, nghi do thay đổi thức ăn hoặc ăn phải thức ăn không phù hợp. Theo dõi thêm triệu chứng.")
                        .plan("1. Nhịn ăn 12 giờ, chỉ cho uống nước\n2. Sau đó cho ăn thức ăn dễ tiêu (cháo gà, cơm nát)\n3. Thuốc trị tiêu chảy và probiotics\n4. Tái khám nếu không cải thiện sau 48h hoặc có nôn")
                        .weightKg(new java.math.BigDecimal("11.8"))
                        .temperatureC(new java.math.BigDecimal("39.0"))
                        .prescriptions(java.util.List.of(
                                Prescription.builder()
                                        .medicineName("Smecta")
                                        .dosage("1/2 gói")
                                        .frequency("3 lần/ngày")
                                        .durationDays(3)
                                        .instructions("Pha với 10ml nước, cho uống trước ăn 30 phút")
                                        .build(),
                                Prescription.builder()
                                        .medicineName("FortiFlora Probiotic")
                                        .dosage("1 gói")
                                        .frequency("1 lần/ngày")
                                        .durationDays(7)
                                        .instructions("Rắc lên thức ăn")
                                        .build()))
                        .images(java.util.List.of())
                        .examinationDate(now.minusDays(3))
                        .createdAt(now.minusDays(3))
                        .build();
                emrRecordRepository.save(emr);
                log.info("   + Created EMR for pet 'Rocky' - Tiêu chảy");

            } else if (pet.getName().equals("Mimi")) {
                // EMR for Mimi - Khám sức khỏe định kỳ
                EmrRecord emr = EmrRecord.builder()
                        .petId(pet.getId())
                        .staffId(staff.getUserId())
                        .clinicId(clinic.getClinicId())
                        .clinicName(clinic.getName())
                        .staffName(staff.getFullName())
                        .subjective(
                                "Khám sức khỏe định kỳ. Chủ nuôi không có than phiền gì đặc biệt. Bé ăn uống bình thường, chơi đùa vui vẻ.")
                        .objective(
                                "Toàn trạng khỏe mạnh. Lông mượt, mắt sáng. Niêm mạc hồng. Răng sạch, không có cao răng. Tim phổi bình thường. Cân nặng 4.3kg, tăng 0.1kg so với lần khám trước.")
                        .assessment("Sức khỏe tổng quát tốt. Khuyến nghị tiêm phòng vaccine dại theo lịch.")
                        .plan("1. Tiêm vaccine dại (đã thực hiện)\n2. Tái khám định kỳ sau 6 tháng\n3. Tẩy giun định kỳ 3 tháng/lần")
                        .notes("Đã tiêm vaccine dại Nobivac. Bé phản ứng tốt sau tiêm, không có dấu hiệu bất thường.")
                        .weightKg(new java.math.BigDecimal("4.3"))
                        .temperatureC(new java.math.BigDecimal("38.8"))
                        .prescriptions(java.util.List.of())
                        .images(java.util.List.of())
                        .examinationDate(now.minusDays(14))
                        .createdAt(now.minusDays(14))
                        .build();
                emrRecordRepository.save(emr);
                log.info("   + Created EMR for pet 'Mimi' - Khám định kỳ");
            }
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
     * Helper method to initialize a STAFF user with specialty
     */
    private User initializeStaffUser(String username, String password, String email, String fullName,
            StaffSpecialty specialty) {
        // Check by username
        if (userRepository.existsByUsername(username)) {
            // Update existing staff's specialty if null
            User existingStaff = userRepository.findByUsername(username).orElse(null);
            if (existingStaff != null && existingStaff.getSpecialty() == null) {
                existingStaff.setSpecialty(specialty);
                existingStaff.setAvatar("https://ui-avatars.com/api/?name=" + fullName.replace(" ", "+")
                        + "&background=86EFAC&color=1c1917");
                userRepository.save(existingStaff);
                log.info("   + Updated staff specialty: {} -> {}", username, specialty);
            }
            return existingStaff;
        }

        // Check by email to prevent duplicate key error
        if (userRepository.existsByEmail(email)) {
            log.info("   - User with email '{}' (STAFF) already exists.", email);
            return userRepository.findByEmail(email).orElse(null);
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setEmail(email);
        user.setPhone("0" + (long) (Math.random() * 1000000000L));
        user.setFullName(fullName);
        user.setRole(Role.STAFF);
        user.setSpecialty(specialty);
        user.setAvatar(
                "https://ui-avatars.com/api/?name=" + fullName.replace(" ", "+") + "&background=86EFAC&color=1c1917");

        try {
            User savedUser = userRepository.save(user);
            log.info("   + Created STAFF user: {} with specialty {}", username, specialty);
            return savedUser;
        } catch (Exception e) {
            log.error("   x Failed to create staff user {}: {}", username, e.getMessage());
            return null;
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

    /**
     * Seed transaction test data for TransactionService (from Payment branch)
     */
    private void seedTransactionTestData(User petOwner, Clinic clinic, User clinicManager) {
        if (petOwner == null || clinic == null) {
            log.info("   - Skipping transaction test data (missing petOwner or clinic)");
            return;
        }

        try {
            // 1. Create test Pet
            Pet pet = Pet.builder()
                    .name("Test Dog")
                    .user(petOwner)
                    .species("Cho")
                    .breed("Corgi")
                    .gender("MALE")
                    .dateOfBirth(java.time.LocalDate.of(2022, 1, 15))
                    .weight(10.5)
                    .build();
            pet = petRepository.save(pet);
            log.info("   + Created test pet: {}", pet.getName());

            // 2. Create Booking
            Booking booking = Booking.builder()
                    .bookingCode("BK-TEST-001")
                    .pet(pet)
                    .petOwner(petOwner)
                    .clinic(clinic)
                    .assignedStaff(clinicManager)
                    .bookingDate(java.time.LocalDate.now().plusDays(1))
                    .bookingTime(java.time.LocalTime.of(10, 0))
                    .type(BookingType.IN_CLINIC)
                    .totalPrice(java.math.BigDecimal.valueOf(2000))
                    .status(BookingStatus.PENDING)
                    .notes("Test booking cho Transaction Service")
                    .build();

            booking = bookingRepository.save(booking);
            log.info("   + Created test booking: {} - Total: {} VND",
                    booking.getBookingCode(), booking.getTotalPrice());

            // 3. Create Payment with QR method
            Payment payment = Payment.builder()
                    .booking(booking)
                    .amount(java.math.BigDecimal.valueOf(2000))
                    .method(PaymentMethod.QR)
                    .status(PaymentStatus.PENDING)
                    .build();
            payment = paymentRepository.save(payment);
            booking.setPayment(payment);
            bookingRepository.save(booking);
            log.info("   + Created test payment: {} VND - Method: {}",
                    payment.getAmount(), payment.getMethod());

        } catch (Exception e) {
            log.error("   x Failed to seed transaction test data: {}", e.getMessage());
        }
    }
}
