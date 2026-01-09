package com.petties.petties.controller;

import com.petties.petties.dto.chat.*;
import com.petties.petties.model.User;
import com.petties.petties.model.ChatMessage;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller for Chat functionality.
 * Base path: /api/chat
 * 
 * Endpoints:
 * - POST /chat-boxes - Create or get chat box (Pet Owner)
 * - GET /chat-boxes - Get all chat boxes
 * - GET /chat-boxes/{id} - Get chat box details
 * - GET /chat-boxes/{id}/messages - Get messages in chat box
 * - POST /chat-boxes/{id}/messages - Send message
 * - PUT /chat-boxes/{id}/read - Mark messages as read
 * - GET /unread-count - Get unread count
 */
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final AuthService authService;

    // ======================== CHAT BOX ENDPOINTS ========================

    /**
     * POST /api/chat/chat-boxes
     * Create or get existing chat box with a clinic.
     * Only Pet Owner can create chat boxes.
     */
    @PostMapping("/chat-boxes")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<ChatBoxResponse> createOrGetChatBox(
            @Valid @RequestBody CreateChatBoxRequest request) {
        
        User currentUser = authService.getCurrentUser();
        ChatBoxResponse response = chatService.createOrGetChatBox(
                currentUser.getUserId(), request);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/chat/chat-boxes
     * Get all chat boxes for the current user.
     */
    @GetMapping("/chat-boxes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<ChatBoxResponse>> getChatBoxes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        Page<ChatBoxResponse> chatBoxes = chatService.getChatBoxes(
                currentUser.getUserId(), currentUser.getRole(), pageable);
        return ResponseEntity.ok(chatBoxes);
    }

    /**
     * GET /api/chat/chat-boxes/{id}
     * Get a specific chat box.
     */
    @GetMapping("/chat-boxes/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ChatBoxResponse> getChatBox(@PathVariable String id) {
        User currentUser = authService.getCurrentUser();
        ChatBoxResponse response = chatService.getChatBox(id, currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    // ======================== MESSAGE ENDPOINTS ========================

    /**
     * GET /api/chat/chat-boxes/{id}/messages
     * Get messages in a chat box with pagination.
     */
    @GetMapping("/chat-boxes/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<MessageResponse>> getMessages(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        
        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        Page<MessageResponse> messages = chatService.getMessages(id, currentUser.getUserId(), pageable);
        return ResponseEntity.ok(messages);
    }

    /**
     * POST /api/chat/chat-boxes/{id}/messages
     * Send a message in a chat box.
     */
    @PostMapping("/chat-boxes/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable String id,
            @Valid @RequestBody SendMessageRequest request) {
        
        User currentUser = authService.getCurrentUser();
        
        // Determine sender type based on role
        ChatMessage.SenderType senderType = switch (currentUser.getRole()) {
            case PET_OWNER -> ChatMessage.SenderType.PET_OWNER;
            default -> ChatMessage.SenderType.CLINIC;
        };
        
        MessageResponse response = chatService.sendMessage(
                id, currentUser.getUserId(), senderType, request);
        return ResponseEntity.ok(response);
    }

    /**
     * PUT /api/chat/chat-boxes/{id}/read
     * Mark all messages in a chat box as read.
     */
    @PutMapping("/chat-boxes/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable String id) {
        User currentUser = authService.getCurrentUser();
        chatService.markAsRead(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "Da danh dau da doc"));
    }

    // ======================== STATUS ENDPOINTS ========================

    /**
     * GET /api/chat/unread-count
     * Get total unread chat box count for the current user.
     */
    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UnreadCountResponse> getUnreadCount() {
        User currentUser = authService.getCurrentUser();
        UnreadCountResponse response = chatService.getUnreadCount(
                currentUser.getUserId(), currentUser.getRole());
        return ResponseEntity.ok(response);
    }
}
