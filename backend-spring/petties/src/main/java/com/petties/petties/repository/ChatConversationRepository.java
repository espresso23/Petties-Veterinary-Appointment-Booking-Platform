package com.petties.petties.repository;

import com.petties.petties.model.ChatConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for ChatConversation MongoDB documents.
 */
@Repository
public interface ChatConversationRepository extends MongoRepository<ChatConversation, String> {

    /**
     * Find conversation by Pet Owner and Clinic
     */
    Optional<ChatConversation> findByPetOwnerIdAndClinicId(UUID petOwnerId, UUID clinicId);

    /**
     * Find all conversations for a Pet Owner, sorted by last message time
     */
    Page<ChatConversation> findByPetOwnerIdOrderByLastMessageAtDesc(UUID petOwnerId, Pageable pageable);

    /**
     * Find all conversations for a Clinic, sorted by last message time
     */
    Page<ChatConversation> findByClinicIdOrderByLastMessageAtDesc(UUID clinicId, Pageable pageable);

    /**
     * Count unread conversations for Pet Owner
     */
    long countByPetOwnerIdAndUnreadCountPetOwnerGreaterThan(UUID petOwnerId, int count);

    /**
     * Count unread conversations for Clinic
     */
    long countByClinicIdAndUnreadCountClinicGreaterThan(UUID clinicId, int count);

    /**
     * Check if conversation exists between Pet Owner and Clinic
     */
    boolean existsByPetOwnerIdAndClinicId(UUID petOwnerId, UUID clinicId);

    /**
     * Find conversations with unread messages for Clinic
     */
    @Query("{'clinicId': ?0, 'unreadCountClinic': {$gt: 0}}")
    Page<ChatConversation> findUnreadConversationsForClinic(UUID clinicId, Pageable pageable);

    /**
     * Find conversations with unread messages for Pet Owner
     */
    @Query("{'petOwnerId': ?0, 'unreadCountPetOwner': {$gt: 0}}")
    Page<ChatConversation> findUnreadConversationsForPetOwner(UUID petOwnerId, Pageable pageable);
}
