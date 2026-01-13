package com.petties.petties.repository;

import com.petties.petties.model.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for ChatMessage MongoDB documents.
 */
@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    /**
     * Find messages in a chat box, sorted by creation time (newest first)
     */
    Page<ChatMessage> findByChatBoxIdOrderByCreatedAtDesc(String chatBoxId, Pageable pageable);

    /**
     * Find messages in a chat box, sorted by creation time (oldest first)
     */
    Page<ChatMessage> findByChatBoxIdOrderByCreatedAtAsc(String chatBoxId, Pageable pageable);

    /**
     * Find unread messages in a chat box for a specific sender type
     */
    List<ChatMessage> findByChatBoxIdAndSenderTypeNotAndIsReadFalse(
            String chatBoxId, 
            ChatMessage.SenderType senderType
    );

    /**
     * Count unread messages in a chat box for recipient
     */
    long countByChatBoxIdAndSenderTypeNotAndIsReadFalse(
            String chatBoxId, 
            ChatMessage.SenderType senderType
    );

    /**
     * Find messages after a specific timestamp (for real-time sync)
     */
    List<ChatMessage> findByChatBoxIdAndCreatedAtAfterOrderByCreatedAtAsc(
            String chatBoxId, 
            LocalDateTime after
    );

    /**
     * Delete all messages in a chat box
     */
    void deleteByChatBoxId(String chatBoxId);

    /**
     * Count messages in a chat box
     */
    long countByChatBoxId(String chatBoxId);
}
