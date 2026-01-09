package com.petties.petties.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ChatBox Document - MongoDB
 * 
 * Represents a 1-1 chat box between Pet Owner and Clinic.
 * 
 * Design Notes:
 * - petOwnerId: UUID of the Pet Owner (from PostgreSQL users table)
 * - clinicId: UUID of the Clinic (from PostgreSQL clinics table)
 * - One chat box per (petOwner, clinic) pair
 * - lastMessageAt: for sorting chat boxes by recent activity
 * - unreadCountPetOwner/unreadCountClinic: track unread messages for each party
 */
@Document(collection = "chat_boxes")
@CompoundIndexes({
    @CompoundIndex(name = "pet_owner_clinic_idx", def = "{'petOwnerId': 1, 'clinicId': 1}", unique = true),
    @CompoundIndex(name = "last_message_idx", def = "{'lastMessageAt': -1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatBox {

    @Id
    private String id;

    /**
     * Pet Owner's User ID (from PostgreSQL)
     */
    @Indexed
    private UUID petOwnerId;

    /**
     * Clinic ID (from PostgreSQL)
     */
    @Indexed
    private UUID clinicId;

    /**
     * Clinic name for display (denormalized for performance)
     */
    private String clinicName;

    /**
     * Clinic logo URL (denormalized for display)
     */
    private String clinicLogo;

    /**
     * Pet Owner's full name (denormalized for display)
     */
    private String petOwnerName;

    /**
     * Pet Owner's avatar URL (denormalized for display)
     */
    private String petOwnerAvatar;

    /**
     * Preview of the last message
     */
    private String lastMessage;

    /**
     * Sender of the last message (PET_OWNER or CLINIC)
     */
    private String lastMessageSender;

    /**
     * Timestamp of the last message (for sorting)
     */
    private LocalDateTime lastMessageAt;

    /**
     * Unread message count for Pet Owner
     */
    @Builder.Default
    private int unreadCountPetOwner = 0;

    /**
     * Unread message count for Clinic
     */
    @Builder.Default
    private int unreadCountClinic = 0;

    /**
     * Whether Pet Owner is currently online in this chat box
     */
    @Builder.Default
    private boolean petOwnerOnline = false;

    /**
     * Whether Clinic staff is currently online in this chat box
     */
    @Builder.Default
    private boolean clinicOnline = false;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
