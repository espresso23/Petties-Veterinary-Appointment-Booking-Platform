package com.petties.petties.repository;

import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    Optional<User> findByUsernameAndDeletedAtIsNull(String username);

    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    /**
     * Kiem tra email da ton tai va thuoc ve user khac (khong phai userId hien tai).
     * Dung cho chuc nang thay doi email.
     *
     * @param email  Email can kiem tra
     * @param userId UUID cua user hien tai (se duoc loai tru khoi ket qua)
     * @return true neu email da duoc su dung boi user khac
     */
    boolean existsByEmailAndUserIdNot(String email, UUID userId);

    /**
     * Check phone exists (including soft-deleted users).
     * Phone is unique across entire system.
     */
    boolean existsByPhone(String phone);

    /**
     * Find user by ID with workingClinic eager loaded.
     * Used in login to return clinic info.
     */
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.workingClinic WHERE u.userId = :userId AND u.deletedAt IS NULL")
    Optional<User> findByIdWithWorkingClinic(@Param("userId") UUID userId);

    /**
     * Find all users by role (non-deleted)
     * Used to get all ADMINs for notifications
     */
    List<User> findByRoleAndDeletedAtIsNull(Role role);
}
