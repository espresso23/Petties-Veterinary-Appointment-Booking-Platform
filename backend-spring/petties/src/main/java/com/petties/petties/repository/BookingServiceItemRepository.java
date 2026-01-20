package com.petties.petties.repository;

import com.petties.petties.model.BookingServiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository for BookingServiceItem entity
 */
@Repository
public interface BookingServiceItemRepository extends JpaRepository<BookingServiceItem, UUID> {

}
