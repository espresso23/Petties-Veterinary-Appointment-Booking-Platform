package com.petties.petties.service;

import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.response.AdminUserSummaryResponse;
import com.petties.petties.dto.user.AdminRestrictUserRequest;
import com.petties.petties.dto.user.ChangePasswordRequest;
import com.petties.petties.dto.user.UpdateProfileRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.List;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.petties.petties.repository.ChatConversationRepository;
import com.petties.petties.model.ChatConversation;
import com.petties.petties.model.enums.Role;

@Service
@RequiredArgsConstructor
public class UserService {

        private final UserRepository userRepository;
        private final CloudinaryService cloudinaryService;
        private final PasswordEncoder passwordEncoder;
        private final ChatConversationRepository chatConversationRepository;
        private final UserStrikeService userStrikeService;

        @Transactional(readOnly = true)
        public UserResponse getUserById(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                return mapToResponse(user);
        }

        @Transactional(readOnly = true)
        public UserResponse getUserByUsername(String username) {
                User user = userRepository.findByUsernameAndDeletedAtIsNull(username)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                return mapToResponse(user);
        }

        @Transactional(readOnly = true)
        public Page<UserResponse> getStruckPetOwners(Pageable pageable) {
                return userRepository.findPetOwnersWithActiveStrike(pageable).map(this::mapToResponse);
        }

        @Transactional
        public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                if (request.getFullName() != null) {
                        user.setFullName(request.getFullName());
                }
                if (request.getPhone() != null) {
                        String phone = request.getPhone().trim();
                        user.setPhone(phone.isEmpty() ? null : phone);
                }

                user = userRepository.save(user);

                return mapToResponse(user);
        }

        @Transactional
        public UserResponse uploadAvatar(UUID userId, MultipartFile file) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Delete old avatar on Cloudinary if exists
                if (user.getAvatarPublicId() != null) {
                        try {
                                cloudinaryService.deleteFile(user.getAvatarPublicId());
                        } catch (Exception e) {
                                // Log but continue if deletion fails
                        }
                }

                // Upload new avatar
                UploadResponse uploadResult = cloudinaryService.uploadAvatar(file);

                // Update user
                String newAvatarUrl = uploadResult.getUrl();
                user.setAvatar(newAvatarUrl);
                user.setAvatarPublicId(uploadResult.getPublicId());
                user = userRepository.save(user);

                // Sync avatar to Chat Conversations (MongoDB)
                // If user is PET_OWNER, update petOwnerAvatar in all their conversations
                if (user.getRole() == Role.PET_OWNER) {
                        try {
                                List<ChatConversation> conversations = chatConversationRepository
                                                .findByPetOwnerIdOrderByLastMessageAtDesc(
                                                                userId,
                                                                org.springframework.data.domain.Pageable.unpaged())
                                                .getContent();

                                conversations.forEach(conv -> {
                                        conv.setPetOwnerAvatar(newAvatarUrl);
                                        chatConversationRepository.save(conv);
                                });
                        } catch (Exception e) {
                                // Log error but don't fail the request
                                System.err.println("Failed to sync avatar to conversations: " + e.getMessage());
                        }
                }

                return mapToResponse(user);
        }

        @Transactional
        public UserResponse deleteAvatar(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                if (user.getAvatarPublicId() != null) {
                        cloudinaryService.deleteFile(user.getAvatarPublicId());
                }

                user.setAvatar(null);
                user.setAvatarPublicId(null);
                user = userRepository.save(user);

                // Sync avatar removal to Chat Conversations (MongoDB)
                if (user.getRole() == Role.PET_OWNER) {
                        try {
                                List<ChatConversation> conversations = chatConversationRepository
                                                .findByPetOwnerIdOrderByLastMessageAtDesc(
                                                                userId,
                                                                org.springframework.data.domain.Pageable.unpaged())
                                                .getContent();

                                conversations.forEach(conv -> {
                                        conv.setPetOwnerAvatar(null);
                                        chatConversationRepository.save(conv);
                                });
                        } catch (Exception e) {
                                System.err.println("Failed to sync avatar removal to conversations: " + e.getMessage());
                        }
                }

                return mapToResponse(user);
        }

        @Transactional
        public void changePassword(UUID userId, ChangePasswordRequest request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
                        throw new BadRequestException("Mật khẩu hiện tại không chính xác");
                }

                if (!request.getNewPassword().equals(request.getConfirmPassword())) {
                        throw new BadRequestException("Mật khẩu xác nhận không khớp");
                }

                user.setPassword(passwordEncoder.encode(request.getNewPassword()));
                userRepository.save(user);
        }

        @Transactional(readOnly = true)
        public Page<AdminUserSummaryResponse> searchUsersForAdmin(
                        Role role,
                        String search,
                        LocalDate createdFrom,
                        LocalDate createdTo,
                        String strikeStatus,
                        Pageable pageable) {

                Specification<User> spec = Specification.where(null);

                if (role != null) {
                        spec = spec.and((root, query, cb) -> cb.equal(root.get("role"), role));
                }

                if (search != null && !search.isBlank()) {
                        String keyword = "%" + search.trim().toLowerCase() + "%";
                        spec = spec.and((root, query, cb) -> cb.or(
                                        cb.like(cb.lower(root.get("username")), keyword),
                                        cb.like(cb.lower(root.get("fullName")), keyword),
                                        cb.like(cb.lower(root.get("email")), keyword)));
                }

                if (createdFrom != null) {
                        LocalDateTime startDateTime = createdFrom.atStartOfDay();
                        spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"),
                                        startDateTime));
                }

                if (createdTo != null) {
                        LocalDateTime endDateTime = createdTo.plusDays(1).atStartOfDay().minusNanos(1);
                        spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), endDateTime));
                }

                String normalizedStrikeStatus = strikeStatus == null ? "ALL" : strikeStatus.trim().toUpperCase();
                switch (normalizedStrikeStatus) {
                        case "ALL":
                                break;
                        case "ACTIVE":
                                spec = spec.and((root, query, cb) -> cb.and(
                                                cb.isNotNull(root.get("strikeUntil")),
                                                cb.greaterThan(root.get("strikeUntil"), LocalDateTime.now()),
                                                cb.notEqual(root.get("strikeUntil"), LocalDateTime.of(9999, 12, 31, 23, 59))));
                                break;
                        case "NONE":
                                spec = spec.and((root, query, cb) -> cb.or(
                                                cb.isNull(root.get("strikeUntil")),
                                                cb.lessThanOrEqualTo(root.get("strikeUntil"), LocalDateTime.now())));
                                break;
                        case "PERMANENT":
                                spec = spec.and((root, query, cb) -> cb.equal(root.get("strikeUntil"),
                                                LocalDateTime.of(9999, 12, 31, 23, 59)));
                                break;
                        default:
                                throw new BadRequestException("Trạng thái hạn chế không hợp lệ");
                }

                return userRepository.findAll(spec, pageable).map(AdminUserSummaryResponse::fromEntity);
        }

        @Transactional
        public AdminUserSummaryResponse restrictUserForAdmin(UUID userId, AdminRestrictUserRequest request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                boolean isPermanent = Boolean.TRUE.equals(request.getIsPermanent());
                if (!isPermanent && request.getDays() == null) {
                        throw new BadRequestException("Vui lòng cung cấp số ngày hạn chế");
                }

                if (userStrikeService.isPermanentStrike(user.getStrikeUntil())) {
                        throw new BadRequestException("Người dùng đã bị hạn chế vĩnh viễn, vui lòng gỡ hạn chế trước");
                }

                user.setStrikeUntil(userStrikeService.calculateManualStrikeUntil(isPermanent, request.getDays()));
                User updated = userRepository.save(user);
                return AdminUserSummaryResponse.fromEntity(updated);
        }

        @Transactional
        public AdminUserSummaryResponse liftUserStrikeForAdmin(UUID userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                if (user.getStrikeUntil() == null || !user.getStrikeUntil().isAfter(LocalDateTime.now())) {
                        throw new BadRequestException("Người dùng hiện không có hạn chế đang hiệu lực");
                }

                user.setStrikeUntil(null);
                User updated = userRepository.save(user);
                return AdminUserSummaryResponse.fromEntity(updated);
        }

        private UserResponse mapToResponse(User user) {
                return UserResponse.builder()
                                .userId(user.getUserId())
                                .username(user.getUsername())
                                .email(user.getEmail())
                                .fullName(user.getFullName())
                                .phone(user.getPhone())
                                .avatar(user.getAvatar())
                                .role(user.getRole())
                                .workingClinicId(user.getWorkingClinic() != null ? user.getWorkingClinic().getClinicId()
                                                : null)
                                .workingClinicName(user.getWorkingClinic() != null ? user.getWorkingClinic().getName()
                                                : null)
                                .specialty(user.getSpecialty() != null ? user.getSpecialty().name() : null)
                                .ratingAvg(user.getRatingAvg())
                                .ratingCount(user.getRatingCount())
                                .createdAt(user.getCreatedAt())
                                .updatedAt(user.getUpdatedAt())
                                .strikeUntil(user.getStrikeUntil())
                                .build();
        }
}
