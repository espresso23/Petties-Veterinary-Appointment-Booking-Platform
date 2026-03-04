package com.petties.petties.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;
import com.petties.petties.model.ChatMessage.ActionButton;

/**
 * Response DTO for message data.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {

    private String id;

    private String chatBoxId;

    private UUID senderId;
    private String senderType;
    private String senderName;
    private String senderAvatar;

    private String content;

    private String messageType;
    private String imageUrl;

    private String status;

    private boolean isRead;
    private LocalDateTime readAt;

    private LocalDateTime createdAt;

    /**
     * Whether this message was sent by the current user (for UI rendering)
     */
    private boolean isMe;

    /**
     * List of interactive action buttons for this message
     */
    private List<ActionButton> actionButtons;
}
