package com.petties.petties.controller;

import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.user.ChangePasswordRequest;
import com.petties.petties.dto.user.EmailChangeRequest;
import com.petties.petties.dto.user.EmailChangeVerifyRequest;
import com.petties.petties.dto.user.UpdateProfileRequest;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.EmailChangeService;
import com.petties.petties.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Controller quan ly User Profile.
 * Cung cap cac API de xem, cap nhat thong tin ca nhan, avatar, mat khau va
 * email.
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuthService authService;
    private final EmailChangeService emailChangeService;

    /**
     * Lấy profile của user hiện tại
     */
    @GetMapping("/profile")
    public ResponseEntity<UserResponse> getProfile() {
        User currentUser = authService.getCurrentUser();
        UserResponse response = userService.getUserById(currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    /**
     * Cập nhật profile của user hiện tại
     */
    @PutMapping("/profile")
    public ResponseEntity<UserResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        User currentUser = authService.getCurrentUser();
        UserResponse response = userService.updateProfile(currentUser.getUserId(), request);
        return ResponseEntity.ok(response);
    }

    /**
     * Upload avatar mới
     */
    @PostMapping(value = "/profile/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserResponse> uploadAvatar(
            @RequestParam("file") MultipartFile file) {
        User currentUser = authService.getCurrentUser();
        UserResponse response = userService.uploadAvatar(currentUser.getUserId(), file);
        return ResponseEntity.ok(response);
    }

    /**
     * Xóa avatar hiện tại
     */
    @DeleteMapping("/profile/avatar")
    public ResponseEntity<UserResponse> deleteAvatar() {
        User currentUser = authService.getCurrentUser();
        UserResponse response = userService.deleteAvatar(currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    /**
     * Doi mat khau
     */
    @PutMapping("/profile/password")
    public ResponseEntity<Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        User currentUser = authService.getCurrentUser();
        userService.changePassword(currentUser.getUserId(), request);
        return ResponseEntity.ok(Map.of("message", "Doi mat khau thanh cong"));
    }

    // ============================================
    // EMAIL CHANGE ENDPOINTS
    // ============================================

    /**
     * Yeu cau thay doi email.
     * He thong se gui OTP den email moi de xac nhan.
     * OTP co hieu luc trong 5 phut.
     */
    @PostMapping("/profile/email/request-change")
    public ResponseEntity<Map<String, String>> requestEmailChange(
            @Valid @RequestBody EmailChangeRequest request) {
        User currentUser = authService.getCurrentUser();
        String message = emailChangeService.requestEmailChange(currentUser.getUserId(), request.getNewEmail());
        return ResponseEntity.ok(Map.of("message", message));
    }

    /**
     * Xac nhan thay doi email bang OTP.
     * User nhap email moi va ma OTP da nhan duoc qua email.
     * Neu thanh cong, email cua user se duoc cap nhat.
     */
    @PostMapping("/profile/email/verify-change")
    public ResponseEntity<UserResponse> verifyEmailChange(
            @Valid @RequestBody EmailChangeVerifyRequest request) {
        User currentUser = authService.getCurrentUser();
        UserResponse response = emailChangeService.verifyAndChangeEmail(
                currentUser.getUserId(),
                request.getNewEmail(),
                request.getOtp());
        return ResponseEntity.ok(response);
    }

    /**
     * Gui lai OTP thay doi email.
     * Chi hoat dong neu co yeu cau thay doi email dang pending.
     * Cooldown 60 giay giua cac lan gui.
     */
    @PostMapping("/profile/email/resend-otp")
    public ResponseEntity<Map<String, String>> resendEmailChangeOtp() {
        User currentUser = authService.getCurrentUser();
        String message = emailChangeService.resendEmailChangeOtp(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", message));
    }

    /**
     * Huy yeu cau thay doi email.
     * Xoa OTP record trong Redis de cho phep user nhap email moi khong can doi
     * cooldown.
     */
    @DeleteMapping("/profile/email/cancel-change")
    public ResponseEntity<Map<String, String>> cancelEmailChange() {
        User currentUser = authService.getCurrentUser();
        String message = emailChangeService.cancelEmailChange(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", message));
    }
}
