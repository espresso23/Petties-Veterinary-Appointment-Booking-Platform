package com.petties.petties.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * WebSocket message payload for real-time chat.
 * Used for both sending and receiving messages via WebSocket.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatWebSocketMessage {

    /**
     * Message type: MESSAGE, TYPING, READ, ONLINE, OFFLINE
     */
    private MessageType type;

    /**
     * Chat Box ID
     */
    private String chatBoxId;

    /**
     * Message content (for MESSAGE type)
     */
    private MessageResponse message;

    /**
     * Sender ID (for TYPING, READ types)
     */
    private UUID senderId;

    /**
     * Sender type: PET_OWNER or CLINIC
     */
    private String senderType;

    /**
     * Timestamp
     */
    private LocalDateTime timestamp;

    /**
     * WebSocket message types
     */
    public enum MessageType {
        MESSAGE,      // New message
        TYPING,       // User is typing
        STOP_TYPING,  // User stopped typing
        READ,         // Messages marked as read
        ONLINE,       // User came online
        OFFLINE       // User went offline
    }
}
