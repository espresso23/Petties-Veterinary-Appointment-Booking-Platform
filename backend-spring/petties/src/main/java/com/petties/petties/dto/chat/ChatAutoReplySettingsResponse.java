package com.petties.petties.dto.chat;

import com.petties.petties.model.enums.AutoReplyCondition;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;
import java.util.List;
import com.petties.petties.model.ChatMessage.ActionButton;

/**
 * DTO trả về cấu hình tin nhắn tự động cho phòng khám.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatAutoReplySettingsResponse {

    private UUID clinicId;

    private boolean quickReplyEnabled;
    private String quickReplyMessage;

    private boolean awayMessageEnabled;
    private AutoReplyCondition awayCondition;
    private String awayMessage;

    private List<ActionButton> actionButtons;
}

