package com.petties.petties.service;

import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.user.ChangePasswordRequest;
import com.petties.petties.dto.user.UpdateProfileRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.List;

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

        @Transactional
        public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                if (request.getFullName() != null) {
                        user.setFullName(request.getFullName());
                }
                if (request.getPhone() != null) {
                        user.setPhone(request.getPhone());
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
                                .createdAt(user.getCreatedAt())
                                .updatedAt(user.getUpdatedAt())
                                .build();
        }
}
