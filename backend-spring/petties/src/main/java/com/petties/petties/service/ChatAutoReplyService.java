package com.petties.petties.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.chat.ChatAutoReplySettingsResponse;
import com.petties.petties.dto.chat.UpdateChatAutoReplySettingsRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.ChatAutoReplySetting;
import com.petties.petties.model.ChatMessage.ActionButton;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.AutoReplyCondition;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ChatAutoReplySettingRepository;
import com.petties.petties.repository.ClinicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatAutoReplyService {

    private final ChatAutoReplySettingRepository autoReplySettingRepository;
    private final ClinicRepository clinicRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ChatAutoReplySettingsResponse getSettingsForUser(User currentUser) {
        Clinic clinic = resolveClinicForUser(currentUser);

        ChatAutoReplySetting setting = autoReplySettingRepository.findByClinicClinicId(clinic.getClinicId())
                .orElseGet(() -> buildDefaultSettings(clinic));

        return mapToResponse(setting);
    }

    @Transactional
    public ChatAutoReplySettingsResponse updateSettingsForUser(User currentUser,
                                                               UpdateChatAutoReplySettingsRequest request) {
        Clinic clinic = resolveClinicForUser(currentUser);

        ChatAutoReplySetting setting = autoReplySettingRepository.findByClinicClinicId(clinic.getClinicId())
                .orElseGet(() -> buildDefaultSettings(clinic));

        String quickReplyMessage = request.getQuickReplyMessage() != null
                ? request.getQuickReplyMessage().trim()
                : setting.getQuickReplyMessage();

        String awayMessage = request.getAwayMessage() != null
                ? request.getAwayMessage().trim()
                : setting.getAwayMessage();

        if (Boolean.TRUE.equals(request.getQuickReplyEnabled()) &&
                (quickReplyMessage == null || quickReplyMessage.isBlank())) {
            throw new BadRequestException("Nội dung tin trả lời nhanh không được để trống khi bật chế độ này");
        }

        if (Boolean.TRUE.equals(request.getAwayMessageEnabled()) &&
                (awayMessage == null || awayMessage.isBlank())) {
            throw new BadRequestException("Nội dung tin nhắn vắng mặt không được để trống khi bật chế độ này");
        }

        setting.setQuickReplyEnabled(Boolean.TRUE.equals(request.getQuickReplyEnabled()));
        setting.setQuickReplyMessage(quickReplyMessage);

        setting.setAwayMessageEnabled(Boolean.TRUE.equals(request.getAwayMessageEnabled()));
        setting.setAwayCondition(request.getAwayCondition() != null
                ? request.getAwayCondition()
                : AutoReplyCondition.OFF_HOURS);
        setting.setAwayMessage(awayMessage);

        try {
            if (request.getActionButtons() != null) {
                setting.setActionButtonsJson(objectMapper.writeValueAsString(request.getActionButtons()));
            } else {
                setting.setActionButtonsJson(null);
            }
        } catch (Exception e) {
            log.warn("Failed to serialize actionButtons: {}", e.getMessage());
        }

        ChatAutoReplySetting saved = autoReplySettingRepository.save(setting);
        log.info("Updated chat auto-reply settings for clinic {}", clinic.getClinicId());
        return mapToResponse(saved);
    }

    private Clinic resolveClinicForUser(User user) {
        UUID clinicId = null;

        if (user.getRole() == Role.CLINIC_OWNER) {
            clinicId = clinicRepository.findFirstByOwnerUserId(user.getUserId())
                    .map(Clinic::getClinicId)
                    .orElse(null);
        } else if (user.getRole() == Role.CLINIC_MANAGER) {
            if (user.getWorkingClinic() != null) {
                clinicId = user.getWorkingClinic().getClinicId();
            }
        } else {
            throw new ForbiddenException("Chỉ chủ phòng khám hoặc quản lý phòng khám mới có thể cấu hình tin nhắn tự động");
        }

        if (clinicId == null) {
            throw new BadRequestException("Bạn chưa được gán vào phòng khám nào");
        }

        Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy phòng khám để cấu hình tin nhắn tự động"));

        return clinic;
    }

    private ChatAutoReplySetting buildDefaultSettings(Clinic clinic) {
        String defaultQuickReply = "Xin chào! Cảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi đã nhận được tin nhắn và sẽ phản hồi trong thời gian sớm nhất.";
        String defaultAwayMessage = "Hiện tại chúng tôi không có mặt tại phòng khám. Vui lòng để lại lời nhắn hoặc liên hệ hotline để được hỗ trợ khẩn cấp.";

        List<ActionButton> defaultButtons = List.of(
                ActionButton.builder().id("btn-services").label("Xem dịch vụ").type("MENU").build(),
                ActionButton.builder().id("btn-booking").label("Đặt lịch ngay").type("BOOKING").build(),
                ActionButton.builder().id("btn-offers").label("Khám phá ưu đãi").type("OFFER").build()
        );

        String buttonsJson = null;
        try {
            buttonsJson = objectMapper.writeValueAsString(defaultButtons);
        } catch (Exception e) {
            log.warn("Failed to serialize default action buttons", e);
        }

        ChatAutoReplySetting setting = ChatAutoReplySetting.builder()
                .clinic(clinic)
                .quickReplyEnabled(true)
                .quickReplyMessage(defaultQuickReply)
                .awayMessageEnabled(false)
                .awayCondition(AutoReplyCondition.OFF_HOURS)
                .awayMessage(defaultAwayMessage)
                .actionButtonsJson(buttonsJson)
                .build();

        return autoReplySettingRepository.save(setting);
    }

    private ChatAutoReplySettingsResponse mapToResponse(ChatAutoReplySetting setting) {
        List<ActionButton> actionButtons = null;
        try {
            if (setting.getActionButtonsJson() != null && !setting.getActionButtonsJson().isBlank()) {
                actionButtons = objectMapper.readValue(setting.getActionButtonsJson(), new TypeReference<List<ActionButton>>() {});
            }
        } catch (Exception e) {
            log.warn("Failed to parse actionButtons: {}", e.getMessage());
        }

        return ChatAutoReplySettingsResponse.builder()
                .clinicId(setting.getClinic().getClinicId())
                .quickReplyEnabled(setting.isQuickReplyEnabled())
                .quickReplyMessage(setting.getQuickReplyMessage())
                .awayMessageEnabled(setting.isAwayMessageEnabled())
                .awayCondition(setting.getAwayCondition())
                .awayMessage(setting.getAwayMessage())
                .actionButtons(actionButtons)
                .build();
    }
}
