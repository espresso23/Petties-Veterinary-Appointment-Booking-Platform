package com.petties.petties.service;

import com.petties.petties.dto.clinic.StaffResponse;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClinicStaffService {

    private final ClinicRepository clinicRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<StaffResponse> getClinicStaff(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        return clinic.getStaff().stream()
                .map(this::mapToStaffResponse)
                .collect(Collectors.toList());
    }

    /**
     * Check if clinic already has a manager
     */
    @Transactional(readOnly = true)
    public boolean hasManager(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        return clinic.getStaff().stream()
                .anyMatch(user -> user.getRole() == Role.CLINIC_MANAGER);
    }

    /**
     * Invite staff by email
     * - If user exists with this email: assign to clinic
     * - If not: create new user with email, waiting for Google OAuth login
     */
    @Transactional
    public void inviteByEmail(UUID clinicId, com.petties.petties.dto.clinic.InviteByEmailRequest request) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        // Authorization checks
        if (currentUser.getRole() == Role.CLINIC_OWNER) {
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (request.getRole() != Role.VET) {
                throw new ForbiddenException("Quản lý phòng khám chỉ có quyền thêm Bác sĩ");
            }
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        // Check if clinic already has manager
        if (request.getRole() == Role.CLINIC_MANAGER && hasManager(clinicId)) {
            throw new ResourceAlreadyExistsException("Phòng khám đã có Quản lý. Mỗi phòng khám chỉ được có 1 Quản lý.");
        }

        // Check if user already exists with this email
        User existingUser = userRepository.findByEmail(request.getEmail()).orElse(null);

        if (existingUser != null) {
            // User exists - check if already assigned to another clinic
            if (existingUser.getWorkingClinic() != null) {
                throw new ResourceAlreadyExistsException("Email này đã được gán cho phòng khám khác");
            }
            // Assign to this clinic
            existingUser.setRole(request.getRole());
            existingUser.setWorkingClinic(clinic);
            if (request.getRole() == Role.VET && request.getSpecialty() != null) {
                existingUser.setSpecialty(request.getSpecialty());
            }
            userRepository.save(existingUser);
        } else {
            // Create new user - waiting for Google OAuth login
            // FullName will be auto-filled when user logs in with Google
            User newUser = new User();
            newUser.setEmail(request.getEmail());
            newUser.setUsername(request.getEmail()); // Use email as username
            newUser.setRole(request.getRole());
            newUser.setWorkingClinic(clinic);
            if (request.getRole() == Role.VET && request.getSpecialty() != null) {
                newUser.setSpecialty(request.getSpecialty());
            }
            // Set random password - user must login via Google OAuth
            // This password cannot be used for login
            newUser.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
            userRepository.save(newUser);
        }
    }

    /**
     * Clinic Owner assigns an existing Clinic Manager
     */

    @Transactional
    public void assignManager(UUID clinicId, String usernameOrEmail) {
        // Check if clinic already has a manager
        if (hasManager(clinicId)) {
            throw new ResourceAlreadyExistsException("Phòng khám đã có Quản lý. Mỗi phòng khám chỉ được có 1 Quản lý.");
        }

        User user = findUserByUsernameOrEmail(usernameOrEmail);

        if (user.getRole() != Role.CLINIC_MANAGER) {
            throw new IllegalArgumentException("User must have CLINIC_MANAGER role");
        }

        assignToClinic(clinicId, user);
    }

    /**
     * Clinic Owner or Clinic Manager assigns a Vet
     */
    @Transactional
    public void assignVet(UUID clinicId, String usernameOrEmail) {
        User currentUser = authService.getCurrentUser();

        // Security Check: If current user is a MANAGER, they must belong to this clinic
        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        User user = findUserByUsernameOrEmail(usernameOrEmail);

        if (user.getRole() != Role.VET) {
            throw new IllegalArgumentException("User must have VET role");
        }

        assignToClinic(clinicId, user);
    }

    @Transactional
    public void removeStaff(UUID clinicId, UUID userId) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        User staffToRemove = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));

        // Check staff belongs to this clinic
        if (staffToRemove.getWorkingClinic() == null
                || !staffToRemove.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new IllegalArgumentException("User does not belong to this clinic");
        }

        // Authorization: CLINIC_OWNER must own the clinic
        if (currentUser.getRole() == Role.CLINIC_OWNER) {
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        // Authorization: CLINIC_MANAGER can only remove VETs, not other managers
        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            // Must belong to this clinic
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
            // Cannot remove another manager
            if (staffToRemove.getRole() == Role.CLINIC_MANAGER) {
                throw new ForbiddenException("Quản lý phòng khám không có quyền xóa Quản lý khác");
            }
        }

        staffToRemove.setWorkingClinic(null);
        userRepository.save(staffToRemove);
    }

    /**
     * Update staff specialty (VET only)
     */
    @Transactional
    public void updateStaffSpecialty(UUID clinicId, UUID userId, String specialty) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        User staff = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));

        // Check staff belongs to this clinic
        if (staff.getWorkingClinic() == null
                || !staff.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new IllegalArgumentException("User does not belong to this clinic");
        }

        // Only VETs have specialty
        if (staff.getRole() != Role.VET) {
            throw new IllegalArgumentException("Only VET staff can have specialty");
        }

        // Authorization: CLINIC_OWNER must own the clinic
        if (currentUser.getRole() == Role.CLINIC_OWNER) {
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        // Authorization: CLINIC_MANAGER must belong to this clinic
        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        // Update specialty
        staff.setSpecialty(StaffSpecialty.valueOf(specialty));
        userRepository.save(staff);
    }

    private User findUserByUsernameOrEmail(String usernameOrEmail) {
        return userRepository.findByUsername(usernameOrEmail)
                .orElseGet(() -> userRepository.findByEmail(usernameOrEmail)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found")));
    }

    private void assignToClinic(UUID clinicId, User user) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        user.setWorkingClinic(clinic);
        userRepository.save(user);
    }

    private StaffResponse mapToStaffResponse(User user) {
        return StaffResponse.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .phone(user.getPhone())
                .avatar(user.getAvatar())
                .specialty(user.getSpecialty())
                .build();
    }
}
