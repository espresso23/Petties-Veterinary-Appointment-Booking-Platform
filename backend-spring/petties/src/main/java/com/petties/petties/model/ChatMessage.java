package com.petties.petties.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Chat Message Document - MongoDB
 * 
 * Represents a single message in a chat box.
 * 
 * Design Notes:
 * - chatBoxId: links to ChatBox
 * - senderId: UUID of the sender (Pet Owner or Clinic Staff)
 * - senderType: PET_OWNER or CLINIC (to differentiate)
 * - status: SENT -> DELIVERED -> SEEN
 */
@Document(collection = "chat_messages")
@CompoundIndexes({
    @CompoundIndex(name = "chatbox_time_idx", def = "{'chatBoxId': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "chatbox_unread_idx", def = "{'chatBoxId': 1, 'isRead': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    private String id;

    /**
     * Reference to the chat box
     */
    @Indexed
    private String chatBoxId;

    /**
     * Sender's User ID (from PostgreSQL)
     */
    private UUID senderId;

    /**
     * Sender type: PET_OWNER or CLINIC
     */
    private SenderType senderType;

    /**
     * Sender's display name (denormalized)
     */
    private String senderName;

    /**
     * Sender's avatar URL (denormalized)
     */
    private String senderAvatar;

    /**
     * Message content (text only for MVP)
     */
    private String content;

    /**
     * Message type: TEXT or IMAGE
     */
    @Builder.Default
    private MessageType messageType = MessageType.TEXT;

    /**
     * Image URL for image messages
     */
    private String imageUrl;

    /**
     * Message status: SENT, DELIVERED, SEEN
     */
    @Builder.Default
    private MessageStatus status = MessageStatus.SENT;

    /**
     * Whether the message has been read by recipient
     */
    @Builder.Default
    private boolean isRead = false;

    /**
     * Timestamp when message was read
     */
    private LocalDateTime readAt;

    @CreatedDate
    private LocalDateTime createdAt;

    /**
     * Sender type enum
     */
    public enum SenderType {
        PET_OWNER,
        CLINIC
    }

    /**
     * Message status enum
     */
    public enum MessageStatus {
        SENT,
        DELIVERED,
        SEEN
    }

    /**
     * Message type enum
     */
    public enum MessageType {
        TEXT,
        IMAGE,
        IMAGE_TEXT
    }
}
