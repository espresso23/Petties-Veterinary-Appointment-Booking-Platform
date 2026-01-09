package com.petties.petties.repository;

import com.petties.petties.model.ChatBox;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for ChatBox MongoDB documents.
 */
@Repository
public interface ChatBoxRepository extends MongoRepository<ChatBox, String> {

    /**
     * Find chat box by Pet Owner and Clinic
     */
    Optional<ChatBox> findByPetOwnerIdAndClinicId(UUID petOwnerId, UUID clinicId);

    /**
     * Find all chat boxes for a Pet Owner, sorted by last message time
     */
    Page<ChatBox> findByPetOwnerIdOrderByLastMessageAtDesc(UUID petOwnerId, Pageable pageable);

    /**
     * Find all chat boxes for a Clinic, sorted by last message time
     */
    Page<ChatBox> findByClinicIdOrderByLastMessageAtDesc(UUID clinicId, Pageable pageable);

    /**
     * Count unread chat boxes for Pet Owner
     */
    long countByPetOwnerIdAndUnreadCountPetOwnerGreaterThan(UUID petOwnerId, int count);

    /**
     * Count unread chat boxes for Clinic
     */
    long countByClinicIdAndUnreadCountClinicGreaterThan(UUID clinicId, int count);

    /**
     * Check if chat box exists between Pet Owner and Clinic
     */
    boolean existsByPetOwnerIdAndClinicId(UUID petOwnerId, UUID clinicId);

    /**
     * Find chat boxes with unread messages for Clinic
     */
    @Query("{'clinicId': ?0, 'unreadCountClinic': {$gt: 0}}")
    Page<ChatBox> findUnreadChatBoxesForClinic(UUID clinicId, Pageable pageable);

    /**
     * Find chat boxes with unread messages for Pet Owner
     */
    @Query("{'petOwnerId': ?0, 'unreadCountPetOwner': {$gt: 0}}")
    Page<ChatBox> findUnreadChatBoxesForPetOwner(UUID petOwnerId, Pageable pageable);
}
