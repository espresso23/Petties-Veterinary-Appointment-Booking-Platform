package com.petties.petties.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Response DTO for chat conversation data.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationResponse {

    private String id;

    private UUID petOwnerId;
    private String petOwnerName;
    private String petOwnerAvatar;

    private UUID clinicId;
    private String clinicName;
    private String clinicLogo;

    private String lastMessage;
    private String lastMessageSender;
    private LocalDateTime lastMessageAt;

    private int unreadCount;

    private boolean partnerOnline;

    private LocalDateTime createdAt;
}
