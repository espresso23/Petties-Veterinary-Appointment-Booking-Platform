package com.petties.petties.config;

import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
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
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        initializeAdminUser();
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
}
