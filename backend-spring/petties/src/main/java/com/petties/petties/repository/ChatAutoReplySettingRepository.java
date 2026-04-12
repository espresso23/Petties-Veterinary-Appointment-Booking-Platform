package com.petties.petties.repository;

import com.petties.petties.model.ChatAutoReplySetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatAutoReplySettingRepository extends JpaRepository<ChatAutoReplySetting, UUID> {

    Optional<ChatAutoReplySetting> findByClinicClinicId(UUID clinicId);
}

