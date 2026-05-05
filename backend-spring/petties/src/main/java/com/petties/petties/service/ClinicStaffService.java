package com.petties.petties.service;

import com.petties.petties.dto.clinic.PublicStaffResponse;
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
import com.petties.petties.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClinicStaffService {

    private final ClinicRepository clinicRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final BackendAuditLogService backendAuditLogService;

    @Transactional(readOnly = true)
    public List<StaffResponse> getClinicStaff(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        return clinic.getStaff().stream()
                .map(this::mapToStaffResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get public staff list for Pet Owners (no sensitive data)
     * Only returns STAFF role (staff members), excludes CLINIC_MANAGER
     */
    @Transactional(readOnly = true)
    public List<PublicStaffResponse> getPublicClinicStaff(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        return clinic.getStaff().stream()
                .filter(user -> user.getRole() != Role.CLINIC_MANAGER && user.getRole() != Role.CLINIC_OWNER) // Exclude
                                                                                                              // Manager
                                                                                                              // & Owner
                .map(this::mapToPublicStaffResponse)
                .collect(Collectors.toList());
    }

    /**
     * Check if clinic already has a manager
     */
    @Transactional(readOnly = true)
    public boolean hasManager(UUID clinicId) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

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
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        // Authorization checks
        if (currentUser.getRole() == Role.CLINIC_OWNER) {
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (request.getRole() != Role.STAFF) {
                throw new ForbiddenException("Quản lý phòng khám chỉ có quyền thêm Nhân viên");
            }
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        // Prevent owner from inviting themselves
        if (currentUser.getEmail().equalsIgnoreCase(request.getEmail())) {
            throw new BadRequestException("Bạn không thể tự mời chính mình");
        }

        // Check if clinic already has manager
        if (request.getRole() == Role.CLINIC_MANAGER && hasManager(clinicId)) {
            throw new ResourceAlreadyExistsException("Phòng khám đã có Quản lý. Mỗi phòng khám chỉ được có 1 Quản lý.");
        }

        // Check if user already exists with this email
        User existingUser = userRepository.findByEmail(request.getEmail()).orElse(null);

        if (existingUser != null) {
            Role oldRole = existingUser.getRole();
            // User exists - check if already assigned to another clinic
            if (existingUser.getWorkingClinic() != null) {
                throw new ResourceAlreadyExistsException("Email này đã được gán cho phòng khám khác");
            }
            // Assign to this clinic
            existingUser.setRole(request.getRole());
            existingUser.setWorkingClinic(clinic);
            if (request.getRole() == Role.STAFF && request.getSpecialty() != null) {
                existingUser.setSpecialty(request.getSpecialty());
            }
            userRepository.save(existingUser);

            if (oldRole != request.getRole()) {
                backendAuditLogService.writeBusinessAuditEvent(
                        currentUser.getUserId().toString(),
                        currentUser.getRole().name(),
                        "CHANGE_USER_ROLE",
                        "user",
                        existingUser.getUserId().toString(),
                        Map.of("role", oldRole.name()),
                        Map.of("role", request.getRole().name()),
                        Map.of(
                                "clinic_id", clinicId.toString(),
                                "target_email", existingUser.getEmail()
                        )
                );
            }
        } else {
            // Create new user - waiting for Google OAuth login
            // FullName will be auto-filled when user logs in with Google
            User newUser = new User();
            newUser.setEmail(request.getEmail());
            // Use unique username to avoid conflict when user updates profile later
            newUser.setUsername("staff_" + java.util.UUID.randomUUID().toString().substring(0, 8));
            newUser.setRole(request.getRole());
            newUser.setWorkingClinic(clinic);
            if (request.getRole() == Role.STAFF && request.getSpecialty() != null) {
                newUser.setSpecialty(request.getSpecialty());
            }
            // Set random password - user must login via Google OAuth
            // This password cannot be used for login
            newUser.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
            userRepository.save(newUser);

                backendAuditLogService.writeBusinessAuditEvent(
                    currentUser.getUserId().toString(),
                    currentUser.getRole().name(),
                    "CREATE_USER_WITH_ROLE",
                    "user",
                    newUser.getUserId().toString(),
                    null,
                    Map.of("role", request.getRole().name()),
                    Map.of(
                        "clinic_id", clinicId.toString(),
                        "target_email", newUser.getEmail()
                    )
                );
        }
    }

    /**
     * Clinic Owner assigns an existing Clinic Manager
     */

    @Transactional
    public void assignManager(UUID clinicId, String usernameOrEmail) {
        User currentUser = authService.getCurrentUser();

        // Prevent owner from assigning themselves as manager
        if (currentUser.getEmail().equalsIgnoreCase(usernameOrEmail)
                || currentUser.getUsername().equalsIgnoreCase(usernameOrEmail)) {
            throw new BadRequestException("Bạn không thể tự gán chính mình làm Quản lý");
        }

        // Check if clinic already has a manager
        if (hasManager(clinicId)) {
            throw new ResourceAlreadyExistsException("Phòng khám đã có Quản lý. Mỗi phòng khám chỉ được có 1 Quản lý.");
        }

        User user = findUserByUsernameOrEmail(usernameOrEmail);

        if (user.getRole() != Role.CLINIC_MANAGER) {
            throw new BadRequestException("Người dùng phải có vai trò Quản lý phòng khám");
        }

        // Check if user already assigned to another clinic
        if (user.getWorkingClinic() != null
                && !user.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new ResourceAlreadyExistsException(
                    "Quản lý này đã được gán cho phòng khám khác. Vui lòng xóa liên kết trước khi gán lại.");
        }

        assignToClinic(clinicId, user);
    }

    /**
     * Clinic Owner or Clinic Manager assigns a Staff member
     */
    @Transactional
    public void assignStaff(UUID clinicId, String usernameOrEmail) {
        User currentUser = authService.getCurrentUser();

        // Prevent owner/manager from assigning themselves
        if (currentUser.getEmail().equalsIgnoreCase(usernameOrEmail)
                || currentUser.getUsername().equalsIgnoreCase(usernameOrEmail)) {
            throw new BadRequestException("Bạn không thể tự gán chính mình");
        }

        // Security Check: If current user is a MANAGER, they must belong to this clinic
        if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinicId)) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }

        User user = findUserByUsernameOrEmail(usernameOrEmail);

        if (user.getRole() != Role.STAFF) {
            throw new BadRequestException("Người dùng phải có vai trò Nhân viên");
        }

        // Check if user already assigned to another clinic
        if (user.getWorkingClinic() != null
                && !user.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new ResourceAlreadyExistsException(
                    "Nhân viên này đã được gán cho phòng khám khác. Vui lòng xóa liên kết trước khi gán lại.");
        }

        assignToClinic(clinicId, user);
    }

    @Transactional
    public void removeStaff(UUID clinicId, UUID userId) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        User staffToRemove = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên"));

        // Check staff belongs to this clinic
        if (staffToRemove.getWorkingClinic() == null
                || !staffToRemove.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new BadRequestException("Người dùng không thuộc phòng khám này");
        }

        validateClinicAccess(currentUser, clinic);

        // Authorization: CLINIC_MANAGER can only remove Staff, not other managers
        if (currentUser.getRole() == Role.CLINIC_MANAGER && staffToRemove.getRole() == Role.CLINIC_MANAGER) {
            throw new ForbiddenException("Quản lý phòng khám không có quyền xóa Quản lý khác");
        }

        staffToRemove.setWorkingClinic(null);
        userRepository.save(staffToRemove);
    }

    /**
     * Update staff specialty (STAFF only)
     */
    @Transactional
    public void updateStaffSpecialty(UUID clinicId, UUID userId, String specialty) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        User staff = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found"));

        // Check staff belongs to this clinic
        if (staff.getWorkingClinic() == null
                || !staff.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new BadRequestException("Người dùng không thuộc phòng khám này");
        }

        // Only STAFFs have specialty
        if (staff.getRole() != Role.STAFF) {
            throw new BadRequestException("Chỉ Nhân viên mới có chuyên môn");
        }

        validateClinicAccess(currentUser, clinic);

        // Update specialty
        staff.setSpecialty(StaffSpecialty.valueOf(specialty));
        userRepository.save(staff);
    }

    private void validateClinicAccess(User currentUser, Clinic clinic) {
        if (currentUser.getRole() == Role.CLINIC_OWNER) {
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        } else if (currentUser.getRole() == Role.CLINIC_MANAGER) {
            if (currentUser.getWorkingClinic() == null
                    || !currentUser.getWorkingClinic().getClinicId().equals(clinic.getClinicId())) {
                throw new ForbiddenException("Bạn không có quyền quản lý nhân sự cho phòng khám này");
            }
        }
    }

    private User findUserByUsernameOrEmail(String usernameOrEmail) {
        return userRepository.findByUsername(usernameOrEmail)
                .orElseGet(() -> userRepository.findByEmail(usernameOrEmail)
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng")));
    }

    private void assignToClinic(UUID clinicId, User user) {
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

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

    private PublicStaffResponse mapToPublicStaffResponse(User user) {
        String specialtyLabel = user.getSpecialty() != null
                ? user.getSpecialty().getVietnameseLabel()
                : "Nhân viên";

        return PublicStaffResponse.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .avatar(user.getAvatar())
                .specialty(user.getSpecialty())
                .specialtyLabel(specialtyLabel)
                .role(user.getRole())
                .build();
    }
}
