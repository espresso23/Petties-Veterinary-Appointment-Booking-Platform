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
     * Find user by phone number.
     * Used for proxy booking to check if recipient already exists.
     */
    Optional<User> findByPhone(String phone);

    /**
     * Find user by ID with workingClinic eager loaded.
     * Used in login to return clinic info.
     */
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.workingClinic WHERE u.userId = :userId AND u.deletedAt IS NULL")
    Optional<User> findByIdWithWorkingClinic(@Param("userId") UUID userId);

    /**
     * Find user by email with workingClinic eager loaded.
     * Used in Google OAuth login to return clinic info.
     */
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.workingClinic WHERE u.email = :email")
    Optional<User> findByEmailWithWorkingClinic(@Param("email") String email);

    /**
     * Find all users by role (non-deleted)
     * Used to get all ADMINs for notifications
     */
    List<User> findByRoleAndDeletedAtIsNull(Role role);

    /**
     * Find staff by working clinic and role
     * Used for booking notifications (managers) and staff assignment
     */
    @Query("SELECT u FROM User u WHERE u.workingClinic.clinicId = :clinicId AND u.role = :role AND u.deletedAt IS NULL")
    List<User> findByWorkingClinicIdAndRole(@Param("clinicId") UUID clinicId, @Param("role") Role role);

    /**
     * Find users by working clinic and role.
     * Used to find clinic managers for chat push notifications.
     */
    List<User> findByWorkingClinicAndRole(com.petties.petties.model.Clinic workingClinic, Role role);
}
