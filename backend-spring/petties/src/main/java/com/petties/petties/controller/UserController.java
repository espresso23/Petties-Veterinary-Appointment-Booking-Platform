package com.petties.petties.controller;

import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.user.ChangePasswordRequest;
import com.petties.petties.dto.user.UpdateProfileRequest;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Controller quản lý User Profile
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuthService authService;

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
     * Đổi mật khẩu
     */
    @PutMapping("/profile/password")
    public ResponseEntity<Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        User currentUser = authService.getCurrentUser();
        userService.changePassword(currentUser.getUserId(), request);
        return ResponseEntity.ok(Map.of("message", "Đổi mật khẩu thành công"));
    }
}
