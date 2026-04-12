package com.petties.petties.service;

import com.petties.petties.model.Notification;
import com.petties.petties.model.Report;
import com.petties.petties.model.User;
import com.petties.petties.model.UserStrikeConfig;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.repository.ReportRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.UserStrikeConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service xử lý logic strike cho pet owner.
 * Khi pet owner nhận đủ report APPROVED (từ clinic) trong cửa sổ thời gian → áp dụng strike.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserStrikeService {

    private static final String KEY_THRESHOLD = "user_strike_threshold";
    private static final String KEY_PERMANENT_THRESHOLD = "user_strike_permanent_threshold";
    private static final String KEY_DURATION_DAYS = "user_strike_duration_days";
    private static final String KEY_WINDOW_DAYS = "user_strike_window_days";

    /** Ngày dùng cho block vĩnh viễn (scheduler không bao giờ clear) */
    private static final java.time.LocalDateTime PERMANENT_BLOCK_UNTIL = java.time.LocalDateTime.of(9999, 12, 31, 23, 59);

    private final UserStrikeConfigRepository configRepository;
    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /**
     * Kiểm tra và áp dụng strike khi Admin approve report về pet owner.
     * Gọi sau khi ReportService.resolveReport với status APPROVED và reportedUser != null.
     */
    @Transactional
    public void checkAndApplyStrike(Report approvedReport) {
        if (approvedReport.getReportedUser() == null) return;

        UUID userId = approvedReport.getReportedUser().getUserId();
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        int threshold = getConfigInt(KEY_THRESHOLD, 3);
        int permanentThreshold = getConfigInt(KEY_PERMANENT_THRESHOLD, 7);
        int windowDays = getConfigInt(KEY_WINDOW_DAYS, 90);
        int durationDays = getConfigInt(KEY_DURATION_DAYS, 7);

        LocalDateTime fromDate = LocalDateTime.now().minusDays(windowDays);
        long count = reportRepository.countApprovedReportsByUserInWindow(userId, fromDate, ReportStatus.APPROVED);

        if (count >= threshold) {
            LocalDateTime strikeUntil;
            if (permanentThreshold > 0 && count >= permanentThreshold) {
                strikeUntil = PERMANENT_BLOCK_UNTIL;
                log.info("User {} permanently blocked ({} approved reports >= permanent threshold {})", userId, count, permanentThreshold);
            } else {
                strikeUntil = LocalDateTime.now().plusDays(durationDays);
            }
            user.setStrikeUntil(strikeUntil);
            userRepository.save(user);
            log.info("User {} struck until {} ({} approved reports in window)", userId, strikeUntil, count);

            try {
                String message = strikeUntil.equals(PERMANENT_BLOCK_UNTIL)
                        ? "Bạn nhận " + count + " báo cáo đã được duyệt trong " + windowDays + " ngày qua. Tài khoản bị hạn chế vĩnh viễn (block không thời hạn)."
                        : "Bạn nhận " + count + " báo cáo đã được duyệt trong " + windowDays + " ngày qua. Tài khoản bị hạn chế đặt lịch đến " + strikeUntil.toLocalDate() + ".";
                Notification notification = Notification.builder()
                        .user(user)
                        .type(NotificationType.PET_OWNER_STRIKE)
                        .message(message)
                        .reason("Pet owner strike")
                        .read(false)
                        .build();
                notificationService.saveAndPushNotification(notification);
            } catch (Exception e) {
                log.error("Failed to send strike notification for user {}", userId, e);
            }
        }
    }

    /**
     * Scheduler: Xóa strike_until khi đã hết hạn.
     */
    @Transactional
    public int clearExpiredStrikes() {
        List<User> struck = userRepository.findUsersWithExpiredStrike();
        for (User u : struck) {
            u.setStrikeUntil(null);
            userRepository.save(u);
            log.info("Cleared expired strike for user {}", u.getUserId());
        }
        return struck.size();
    }

    private int getConfigInt(String key, int defaultValue) {
        return configRepository.findById(key)
                .map(c -> {
                    try {
                        return Integer.parseInt(c.getConfigValue());
                    } catch (NumberFormatException e) {
                        return defaultValue;
                    }
                })
                .orElse(defaultValue);
    }

    public boolean isPermanentStrike(LocalDateTime strikeUntil) {
        return strikeUntil != null && strikeUntil.equals(PERMANENT_BLOCK_UNTIL);
    }

    public LocalDateTime calculateManualStrikeUntil(boolean isPermanent, Integer days) {
        if (isPermanent) {
            return PERMANENT_BLOCK_UNTIL;
        }

        if (days == null || days < 1 || days > 3650) {
            throw new com.petties.petties.exception.BadRequestException("Số ngày hạn chế phải từ 1 đến 3650");
        }
        return LocalDateTime.now().plusDays(days);
    }

    @Transactional(readOnly = true)
    public Map<String, String> getAllConfig() {
        Map<String, String> configs = new HashMap<>();
        configRepository.findAll().forEach(c -> configs.put(c.getConfigKey(), c.getConfigValue()));
        return configs;
    }

    @Transactional
    public void updateConfig(String key, String value, UUID adminId) {
        UserStrikeConfig config = configRepository.findById(key)
                .orElse(new UserStrikeConfig());
        config.setConfigKey(key);
        config.setConfigValue(value);
        config.setUpdatedAt(LocalDateTime.now());
        configRepository.save(config);
        log.info("Admin {} updated user strike config {} = {}", adminId, key, value);
    }
}
