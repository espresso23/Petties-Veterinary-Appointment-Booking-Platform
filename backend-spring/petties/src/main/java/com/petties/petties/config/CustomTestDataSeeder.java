package com.petties.petties.config;

import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;

import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Order(3) // Run after BookingDataSeeder
@Slf4j
public class CustomTestDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final PetRepository petRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final ClinicServiceRepository clinicServiceRepository;
    private final PasswordEncoder passwordEncoder;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;

    @Override
    public void run(String... args) throws Exception {
        log.info("🚀 Seeding CUSTOM robust test data for clinicOwnerNew...");

        try {
            // 1. Create or Get User Accounts
            User owner = createOrGetUser("clinicOwnerNew", "123456", "owner_new@test.com", "Clinic Owner New",
                    Role.CLINIC_OWNER);
            User manager = createOrGetUser("clinicManagerNew", "123456", "manager_new@test.com", "Clinic Manager New",
                    Role.CLINIC_MANAGER);
            User petOwner = createOrGetUser("petOwnerNew", "123456", "pet_new@test.com", "Pet Owner New",
                    Role.PET_OWNER);
            User staff = createOrGetUser("staffNew", "123456", "staff_new@test.com", "Dr. Staff New", Role.STAFF);

            // 2. Create or Get Clinic
            User targetOwner = owner; // Default to clinicOwnerNew
            Optional<User> existingDirectOwner = userRepository.findByUsername("clinicOwner");
            if (existingDirectOwner.isPresent()) {
                targetOwner = existingDirectOwner.get();
                log.info("   + Found 'clinicOwner' account, seeding subscription for this user.");
            }

            final User finalOwner = targetOwner;
            Clinic clinic = clinicRepository
                    .findByOwnerUserId(finalOwner.getUserId(), org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst().orElse(null);

            if (clinic == null) {
                clinic = new Clinic();
                clinic.setName("Phòng Khám PetCare Mới");
                clinic.setOwner(owner);
                clinic.setAddress("444 Đường Mới, Quận 1, TP.HCM");
                clinic.setPhone("0987654321");
                clinic.setStatus(ClinicStatus.APPROVED);
                clinic = clinicRepository.save(clinic);
                log.info("   + Created new Clinic: {}", clinic.getName());
            }

            // Assign working clinic to manager and staff
            if (manager.getWorkingClinic() == null) {
                manager.setWorkingClinic(clinic);
                userRepository.save(manager);
            }
            if (staff.getWorkingClinic() == null) {
                staff.setWorkingClinic(clinic);
                userRepository.save(staff);
            }

            // 3. Ensure PetOwner has a Pet
            Pet pet = petRepository.findByUser_UserId(petOwner.getUserId()).stream().findFirst().orElse(null);
            if (pet == null) {
                pet = new Pet();
                pet.setUser(petOwner);
                pet.setName("Kiku");
                pet.setSpecies(PetSpecies.DOG);
                pet.setBreed("Shiba");
                pet.setGender("Đực");
                pet.setWeight(12.0);
                pet.setDateOfBirth(LocalDate.of(2022, 1, 1));
                pet = petRepository.save(pet);
            }

            // 4. Create some Services for the Clinic to calculate price
            ClinicService cs = clinicServiceRepository.findByClinic(clinic).stream().findFirst().orElse(null);
            if (cs == null) {
                cs = new ClinicService();
                cs.setClinic(clinic);
                cs.setName("Khám Tổng Quát Test");
                cs.setBasePrice(new BigDecimal("200000"));
                cs.setDurationTime(30);
                cs.setSlotsRequired(1);
                cs.setIsActive(true);
                cs = clinicServiceRepository.save(cs);
            }

            // 5. Generate multiple Bookings and Paid Payments ONLY IF missing
            boolean hasRecentBookings = !bookingRepository
                    .findByClinicIdAndDate(clinic.getClinicId(), LocalDate.now().minusDays(1)).isEmpty();
            if (!hasRecentBookings) {
                log.info("   + Generating 6 COMPLETED bookings with PAID payments...");
                for (int i = 1; i <= 6; i++) {
                    Booking b = new Booking();
                    b.setBookingCode("BN-" + System.currentTimeMillis() + "-" + i);
                    b.setPet(pet);
                    b.setPetOwner(petOwner);
                    b.setClinic(clinic);
                    b.setAssignedStaff(staff);
                    b.setStatus(BookingStatus.COMPLETED);
                    b.setType(BookingType.IN_CLINIC);
                    b.setBookingDate(LocalDate.now().minusDays(i));
                    b.setBookingTime(LocalTime.of(10, 0));

                    // Total Price ranges from 200,000 to 500,000
                    BigDecimal price = new BigDecimal(200000 + (i * 50000));
                    b.setTotalPrice(price);

                    b = bookingRepository.save(b);

                    // Create Payment
                    Payment p = new Payment();
                    p.setBooking(b);
                    p.setAmount(price);
                    // Mix QR and CASH
                    p.setMethod(i % 2 == 0 ? PaymentMethod.QR : PaymentMethod.CASH);
                    p.setStatus(PaymentStatus.PAID);
                    p.setPaidAt(LocalDateTime.now().minusDays(i));
                    paymentRepository.save(p);
                }
                log.info("   + Successfully injected new bookings and payments!");
            } else {
                log.info("   + Custom bookings already exist. Skipping generating duplicates.");
            }

            // 6. Clear and Seed Subscription Plans (WITHOUT forcing active subscription)
            log.info("🚀 Resetting SUBSCRIPTION data for clean testing...");
            userSubscriptionRepository.deleteAll();
            subscriptionPlanRepository.deleteAll();

            SubscriptionPlan nangCao = new SubscriptionPlan();
            nangCao.setName("Gói Nâng Cao");
            nangCao.setDescription("Các tính năng quản lý cơ bản cho phòng khám vừa và nhỏ.");
            nangCao.setPrice(new BigDecimal("500000"));
            nangCao.setDurationDays(30);
            nangCao.setFeatures("Quản lý hồ sơ, Lịch hẹn cơ bản, Hỗ trợ qua email");
            nangCao.setIsActive(true);
            subscriptionPlanRepository.save(nangCao);

            SubscriptionPlan chuyenNghiep = new SubscriptionPlan();
            chuyenNghiep.setName("Gói Chuyên Nghiệp");
            chuyenNghiep.setDescription("Đầy đủ sức mạnh AI và quản lý vắc xin chuyên sâu.");
            chuyenNghiep.setPrice(new BigDecimal("700000"));
            chuyenNghiep.setDurationDays(30);
            chuyenNghiep.setFeatures(
                    "Trợ lý AI Petties, Phân tích bệnh án điện tử, Tên miền tùy chỉnh, Không giới hạn dữ liệu");
            chuyenNghiep.setIsActive(true);
            subscriptionPlanRepository.save(chuyenNghiep);

            log.info("   + Cleaned all subscriptions. Only Plans are available for purchase.");

            // 7. Create a Non-VIP account for testing
            User ownerNoVip = createOrGetUser("ownerNoVip", "123456", "owner_novip@test.com", "Owner No VIP",
                    Role.CLINIC_OWNER);
            User staffNoVip = createOrGetUser("staffNoVip", "123456", "staff_novip@test.com", "Dr. Staff No VIP",
                    Role.STAFF);

            Clinic clinicNoVip = clinicRepository.findByName("Phòng Khám Không VIP").orElseGet(() -> {
                Clinic c = new Clinic();
                c.setName("Phòng Khám Không VIP");
                c.setOwner(ownerNoVip);
                c.setAddress("789 Đường Thử Nghiệm, Quận 3, TP.HCM");
                c.setPhone("0123123123");
                c.setStatus(ClinicStatus.APPROVED);
                return clinicRepository.save(c);
            });

            if (staffNoVip.getWorkingClinic() == null
                    || !staffNoVip.getWorkingClinic().getClinicId().equals(clinicNoVip.getClinicId())) {
                staffNoVip.setWorkingClinic(clinicNoVip);
                userRepository.save(staffNoVip);
            }
            log.info("   + Created Non-VIP Staff: staffNoVip / 123456 for Testing.");

            // 8. Create a CLEAN account (No Vip, No History)
            User ownerClean = createOrGetUser("ownerClean", "123456", "clean@test.com", "Clinic Owner Clean",
                    Role.CLINIC_OWNER);
            Clinic clinicClean = clinicRepository.findByName("Phòng Khám Sạch").orElseGet(() -> {
                Clinic c = new Clinic();
                c.setName("Phòng Khám Sạch");
                c.setOwner(ownerClean);
                c.setAddress("123 Phố Sạch, Quận 1, TP.HCM");
                c.setPhone("0777888999");
                c.setStatus(ClinicStatus.APPROVED);
                return clinicRepository.save(c);
            });
            log.info("   + Created CLEAN Clinic: ownerClean / 123456 - No History.");

        } catch (Exception e) {
            log.error("❌ Failed custom robust test data seeding: ", e);
        }
    }

    private User createOrGetUser(String username, String password, String email, String fullName, Role role) {
        return userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User();
            u.setUsername(username);
            u.setPassword(passwordEncoder.encode(password));
            u.setEmail(email);
            u.setFullName(fullName);
            u.setRole(role);
            return userRepository.save(u);
        });
    }
}
