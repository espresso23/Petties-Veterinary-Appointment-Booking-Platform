package com.petties.petties.repository;

import com.petties.petties.model.SystemNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SystemNotificationRepository extends JpaRepository<SystemNotification, UUID> {
    Page<SystemNotification> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
