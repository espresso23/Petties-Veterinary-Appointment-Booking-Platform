package com.petties.petties.service;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicStrikeConfig;
import com.petties.petties.model.Report;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicStrikeConfigRepository;
import com.petties.petties.repository.ReportRepository;
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
 * Service xử lý logic strike cho clinic.
 * Khi clinic nhận đủ report APPROVED trong cửa sổ thời gian → áp dụng strike.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicStrikeService {

    private static final String KEY_THRESHOLD = "strike_threshold";
    private static final String KEY_PERMANENT_THRESHOLD = "strike_permanent_threshold";
    private static final String KEY_DURATION_DAYS = "strike_duration_days";
    private static final String KEY_WINDOW_DAYS = "strike_window_days";

    /** Ngày dùng cho block vĩnh viễn (scheduler không bao giờ clear) */
    private static final java.time.LocalDateTime PERMANENT_BLOCK_UNTIL = java.time.LocalDateTime.of(9999, 12, 31, 23, 59);

    private final ClinicStrikeConfigRepository configRepository;
    private final ReportRepository reportRepository;
    private final ClinicRepository clinicRepository;
    private final NotificationService notificationService;

    /**
     * Kiểm tra và áp dụng strike khi Admin approve report về clinic.
     * Gọi sau khi ReportService.resolveReport với status APPROVED.
     */
    @Transactional
    public void checkAndApplyStrike(Report approvedReport) {
        if (approvedReport.getReportedClinic() == null) return;

        UUID clinicId = approvedReport.getReportedClinic().getClinicId();
        Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId).orElse(null);
        if (clinic == null) return;

        int threshold = getConfigInt(KEY_THRESHOLD, 3);
        int permanentThreshold = getConfigInt(KEY_PERMANENT_THRESHOLD, 7);
        int windowDays = getConfigInt(KEY_WINDOW_DAYS, 90);
        int durationDays = getConfigInt(KEY_DURATION_DAYS, 7);

        LocalDateTime fromDate = LocalDateTime.now().minusDays(windowDays);
        long count = reportRepository.countApprovedReportsByClinicInWindow(clinicId, fromDate, ReportStatus.APPROVED);

        if (count >= threshold) {
            LocalDateTime strikeUntil;
            if (permanentThreshold > 0 && count >= permanentThreshold) {
                strikeUntil = PERMANENT_BLOCK_UNTIL;
                log.info("Clinic {} permanently blocked ({} approved reports >= permanent threshold {})", clinicId, count, permanentThreshold);
            } else {
                strikeUntil = LocalDateTime.now().plusDays(durationDays);
            }
            clinic.setStrikeUntil(strikeUntil);
            clinicRepository.save(clinic);
            log.info("Clinic {} struck until {} ({} approved reports in window)", clinicId, strikeUntil, count);

            try {
                String message = strikeUntil.equals(PERMANENT_BLOCK_UNTIL)
                        ? "Phòng khám nhận " + count + " báo cáo đã được duyệt trong " + windowDays + " ngày qua. Phòng khám bị hạn chế vĩnh viễn (block không thời hạn)."
                        : "Phòng khám nhận " + count + " báo cáo đã được duyệt trong " + windowDays + " ngày qua. Phòng khám bị hạn chế nhận đặt lịch và tìm kiếm đến " + strikeUntil.toLocalDate() + ".";
                notificationService.createClinicNotification(clinic,
                        com.petties.petties.model.enums.NotificationType.CLINIC_STRIKE,
                        message);
            } catch (Exception e) {
                log.error("Failed to send strike notification for clinic {}", clinicId, e);
            }
        }
    }

    /**
     * Scheduler: Xóa strike_until khi đã hết hạn.
     */
    @Transactional
    public int clearExpiredStrikes() {
        List<Clinic> struck = clinicRepository.findClinicsWithExpiredStrike();
        for (Clinic c : struck) {
            c.setStrikeUntil(null);
            clinicRepository.save(c);
            log.info("Cleared expired strike for clinic {}", c.getClinicId());
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

    @Transactional(readOnly = true)
    public Map<String, String> getAllConfig() {
        Map<String, String> configs = new HashMap<>();
        configRepository.findAll().forEach(c -> configs.put(c.getConfigKey(), c.getConfigValue()));
        return configs;
    }

    @Transactional
    public void updateConfig(String key, String value, UUID adminId) {
        ClinicStrikeConfig config = configRepository.findById(key)
                .orElse(new ClinicStrikeConfig());
        config.setConfigKey(key);
        config.setConfigValue(value);
        config.setUpdatedAt(LocalDateTime.now());
        configRepository.save(config);
        log.info("Admin {} updated strike config {} = {}", adminId, key, value);
    }
}
