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
 * - POST /conversations - Create or get conversation (Pet Owner)
 * - GET /conversations - Get all conversations
 * - GET /conversations/{id} - Get conversation details
 * - GET /conversations/{id}/messages - Get messages in conversation
 * - POST /conversations/{id}/messages - Send message
 * - PUT /conversations/{id}/read - Mark messages as read
 * - GET /unread-count - Get unread count
 */
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final AuthService authService;

    // ======================== CONVERSATION ENDPOINTS ========================

    /**
     * POST /api/chat/conversations
     * Create or get existing conversation with a clinic.
     * Only Pet Owner can create conversations.
     */
    @PostMapping("/conversations")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<ConversationResponse> createOrGetConversation(
            @Valid @RequestBody CreateConversationRequest request) {

        User currentUser = authService.getCurrentUser();
        ConversationResponse response = chatService.createOrGetConversation(
                currentUser.getUserId(), request);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/chat/conversations
     * Get all conversations for the current user.
     */
    @GetMapping("/conversations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<ConversationResponse>> getConversations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        Page<ConversationResponse> conversations = chatService.getConversations(
                currentUser.getUserId(), currentUser.getRole(), pageable);
        return ResponseEntity.ok(conversations);
    }

    /**
     * GET /api/chat/conversations/{id}
     * Get a specific conversation.
     */
    @GetMapping("/conversations/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ConversationResponse> getConversation(@PathVariable String id) {
        User currentUser = authService.getCurrentUser();
        ConversationResponse response = chatService.getConversation(id, currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    // ======================== MESSAGE ENDPOINTS ========================

    /**
     * GET /api/chat/conversations/{id}/messages
     * Get messages in a conversation with pagination.
     */
    @GetMapping("/conversations/{id}/messages")
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
     * POST /api/chat/conversations/{id}/messages
     * Send a message in a conversation.
     */
    @PostMapping("/conversations/{id}/messages")
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
     * PUT /api/chat/conversations/{id}/read
     * Mark all messages in a conversation as read.
     */
    @PutMapping("/conversations/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable String id) {
        User currentUser = authService.getCurrentUser();
        chatService.markAsRead(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "Da danh dau da doc"));
    }

    // ======================== STATUS ENDPOINTS ========================

    /**
     * GET /api/chat/unread-count
     * Get total unread conversation count for the current user.
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
