package com.petties.petties.service;

import com.petties.petties.dto.clinic.StaffResponse;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.dto.clinic.QuickAddStaffRequest;
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

    public List<StaffResponse> getClinicStaff(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        return clinic.getStaff().stream()
                .map(this::mapToStaffResponse)
                .collect(Collectors.toList());
    }

    /**
     * Create a new account and assign as Manager (For Clinic Owner)
     */
    @Transactional
    public void quickAddStaff(UUID clinicId, QuickAddStaffRequest request) {
        // 1. Check if phone already exists
        if (userRepository.existsByUsername(request.getPhone())) {
            throw new ResourceAlreadyExistsException("Số điện thoại này đã được đăng ký tài khoản");
        }

        // 2. Business Rules for Role Management (Phân quyền)
        User currentUser = authService.getCurrentUser();

        // Rule 1: No one can add an ADMIN via this endpoint
        if (request.getRole() == Role.ADMIN) {
            throw new ForbiddenException("Không thể tạo tài khoản ADMIN qua chức năng này");
        }

        // Rule 2: CLINIC_MANAGER can ONLY add VETs
        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (request.getRole() != Role.VET) {
                throw new ForbiddenException("Quản lý phòng khám chỉ có quyền thêm Bác sĩ");
            }
            // Ensure manager belongs to this clinic
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        // 3. Create new user account
        User newUser = new User();
        newUser.setUsername(request.getPhone());
        newUser.setFullName(request.getFullName());
        newUser.setPhone(request.getPhone());
        newUser.setRole(request.getRole());

        // Default password: last 6 digits of phone
        String defaultPass = request.getPhone().substring(Math.max(0, request.getPhone().length() - 6));
        newUser.setPassword(passwordEncoder.encode(defaultPass));

        // 4. Assign to clinic
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));
        newUser.setWorkingClinic(clinic);

        userRepository.save(newUser);
    }

    /**
     * Clinic Owner assigns an existing Clinic Manager
     */

    @Transactional
    public void assignManager(UUID clinicId, String usernameOrEmail) {
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
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));

        if (user.getWorkingClinic() == null || !user.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new IllegalArgumentException("User does not belong to this clinic");
        }

        user.setWorkingClinic(null);
        userRepository.save(user);
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
                .build();
    }
}
