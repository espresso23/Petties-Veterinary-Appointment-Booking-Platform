package com.petties.petties.dto.chat;

import com.petties.petties.model.enums.AutoReplyCondition;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import com.petties.petties.model.ChatMessage.ActionButton;

/**
 * DTO cập nhật cấu hình tin nhắn tự động cho phòng khám.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateChatAutoReplySettingsRequest {

    @NotNull(message = "Trạng thái tin trả lời nhanh không được để trống")
    private Boolean quickReplyEnabled;

    @Size(max = 1000, message = "Tin trả lời nhanh không được vượt quá 1000 ký tự")
    private String quickReplyMessage;

    @NotNull(message = "Trạng thái tin nhắn vắng mặt không được để trống")
    private Boolean awayMessageEnabled;

    @NotNull(message = "Điều kiện gửi tin nhắn vắng mặt không được để trống")
    private AutoReplyCondition awayCondition;

    @Size(max = 1000, message = "Tin nhắn vắng mặt không được vượt quá 1000 ký tự")
    private String awayMessage;

    private List<ActionButton> actionButtons;
}

