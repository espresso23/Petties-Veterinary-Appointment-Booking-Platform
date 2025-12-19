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
 * Data Initializer - Tự động tạo admin user mặc định
 * 
 * Chức năng:
 * - Tự động chạy khi Spring Boot khởi động (cả dev và prod)
 * - Chỉ tạo admin user nếu chưa tồn tại trong database
 * - Không cần config hay bật/tắt thủ công
 * 
 * Default credentials:
 * - Username: admin
 * - Password: admin
 * - Email: admin@petties.world
 * 
 * ⚠️ Lưu ý: Nên đổi password ngay sau lần đăng nhập đầu tiên!
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        initializeAdminUser();
        initializeTestUsers();
        initializeTestClinic();
    }

    /**
     * Khởi tạo admin user mặc định
     * Chỉ tạo nếu chưa có admin user trong database
     */
    private void initializeAdminUser() {
        final String adminUsername = "admin";

        // Kiểm tra xem đã có admin user chưa
        if (userRepository.existsByUsername(adminUsername)) {
            log.info("✅ Admin user '{}' already exists. Skipping initialization.", adminUsername);
            return;
        }

        // Tạo admin user mới
        User admin = new User();
        admin.setUsername(adminUsername);
        admin.setPassword(passwordEncoder.encode("admin"));
        admin.setEmail("admin@petties.world");
        admin.setPhone("0000000000");
        admin.setFullName("Thuong em la dieu anh khong the ngo");
        admin.setRole(Role.ADMIN);

        try {
            User savedAdmin = userRepository.save(admin);
            log.info("✅ Default admin user created successfully!");
            log.info("   Username: {}", adminUsername);
            log.info("   Password: admin (⚠️ Please change after first login!)");
            log.info("   Email: admin@petties.world");
            log.info("   User ID: {}", savedAdmin.getUserId());
            log.warn("⚠️  IMPORTANT: Please change the default password after first login!");
        } catch (Exception e) {
            log.error("❌ Failed to create default admin user: {}", e.getMessage(), e);
        }
    }

    /**
     * Khởi tạo test users cho development
     */
    private void initializeTestUsers() {
        // CLINIC_OWNER user
        final String clinicOwnerUsername = "Kingofwar1123";
        if (!userRepository.existsByUsername(clinicOwnerUsername)) {
            User clinicOwner = new User();
            clinicOwner.setUsername(clinicOwnerUsername);
            clinicOwner.setPassword(passwordEncoder.encode("112003"));
            clinicOwner.setEmail("clinic@petties.world");
            clinicOwner.setPhone("0123456789");
            clinicOwner.setFullName("Clinic Owner Test");
            clinicOwner.setRole(Role.CLINIC_OWNER);

            try {
                userRepository.save(clinicOwner);
                log.info("✅ Test CLINIC_OWNER user created: {}", clinicOwnerUsername);
            } catch (Exception e) {
                log.error("❌ Failed to create clinic owner: {}", e.getMessage());
            }
        }

        // VET user
        final String vetUsername = "vet_test";
        if (!userRepository.existsByUsername(vetUsername)) {
            User vet = new User();
            vet.setUsername(vetUsername);
            vet.setPassword(passwordEncoder.encode("test123"));
            vet.setEmail("vet@petties.world");
            vet.setPhone("0987654321");
            vet.setFullName("Vet Test User");
            vet.setRole(Role.VET);

            try {
                userRepository.save(vet);
                log.info("✅ Test VET user created: {}", vetUsername);
            } catch (Exception e) {
                log.error("❌ Failed to create vet user: {}", e.getMessage());
            }
        }

        // PET_OWNER user
        final String petOwnerUsername = "customer_test";
        if (!userRepository.existsByUsername(petOwnerUsername)) {
            User petOwner = new User();
            petOwner.setUsername(petOwnerUsername);
            petOwner.setPassword(passwordEncoder.encode("test123"));
            petOwner.setEmail("customer@petties.world");
            petOwner.setPhone("0111222333");
            petOwner.setFullName("Customer Test User");
            petOwner.setRole(Role.PET_OWNER);

            try {
                userRepository.save(petOwner);
                log.info("✅ Test PET_OWNER user created: {}", petOwnerUsername);
            } catch (Exception e) {
                log.error("❌ Failed to create pet owner user: {}", e.getMessage());
            }
        }
    }

    /**
     * Khởi tạo test clinic cho CLINIC_OWNER
     */
    private void initializeTestClinic() {
        final String clinicOwnerUsername = "Kingofwar1123";
        
        User clinicOwner = userRepository.findByUsername(clinicOwnerUsername).orElse(null);
        if (clinicOwner == null) {
            log.warn("⚠️ Cannot create test clinic: CLINIC_OWNER user not found");
            return;
        }

        // Check if clinic already exists for this owner
        if (clinicRepository.findByOwnerUserId(clinicOwner.getUserId()).isPresent()) {
            log.info("✅ Test clinic already exists for user: {}", clinicOwnerUsername);
            return;
        }

        // Create test clinic
        Clinic clinic = new Clinic();
        clinic.setOwner(clinicOwner);
        clinic.setName("Petties Veterinary Clinic");
        clinic.setAddress("123 Nguyen Hue, District 1, Ho Chi Minh City");
        clinic.setPhone("0281234567");
        clinic.setLatitude(new java.math.BigDecimal("10.7769"));
        clinic.setLongitude(new java.math.BigDecimal("106.7009"));
        clinic.setOperatingHours(new java.util.HashMap<>());
        clinic.setStatus(ClinicStatus.APPROVED);
        clinic.setRatingAvg(new java.math.BigDecimal("0.00"));

        try {
            Clinic savedClinic = clinicRepository.save(clinic);
            log.info("✅ Test clinic created successfully!");
            log.info("   Clinic ID: {}", savedClinic.getId());
            log.info("   Name: {}", savedClinic.getName());
            log.info("   Owner: {}", clinicOwnerUsername);
        } catch (Exception e) {
            log.error("❌ Failed to create test clinic: {}", e.getMessage(), e);
        }
    }
}
