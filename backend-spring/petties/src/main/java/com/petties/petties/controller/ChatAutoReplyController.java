package com.petties.petties.controller;

import com.petties.petties.dto.chat.ChatAutoReplySettingsResponse;
import com.petties.petties.dto.chat.UpdateChatAutoReplySettingsRequest;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ChatAutoReplyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller cho cấu hình tin nhắn tự động của phòng khám.
 * Full path: /api/chat/auto-reply
 */
@RestController
@RequestMapping("/chat/auto-reply")
@RequiredArgsConstructor
@Slf4j
public class ChatAutoReplyController {

    private final ChatAutoReplyService chatAutoReplyService;
    private final AuthService authService;

    @GetMapping("/settings")
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER','CLINIC_OWNER')")
    public ResponseEntity<ChatAutoReplySettingsResponse> getSettings() {
        User currentUser = authService.getCurrentUser();
        ChatAutoReplySettingsResponse response = chatAutoReplyService.getSettingsForUser(currentUser);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER','CLINIC_OWNER')")
    public ResponseEntity<ChatAutoReplySettingsResponse> updateSettings(
            @Valid @RequestBody UpdateChatAutoReplySettingsRequest request) {
        User currentUser = authService.getCurrentUser();
        ChatAutoReplySettingsResponse response = chatAutoReplyService.updateSettingsForUser(currentUser, request);
        return ResponseEntity.ok(response);
    }
}
