package com.petties.petties.controller;

import com.petties.petties.dto.chat.*;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.ChatConversation;
import com.petties.petties.model.User;
import com.petties.petties.model.ChatMessage;
import com.petties.petties.repository.ChatConversationRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ChatService;
import com.petties.petties.service.CloudinaryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

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
    private final CloudinaryService cloudinaryService;
    private final ChatConversationRepository conversationRepository;

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
     * GET /api/chat/conversations/{id}/images
     * Get all images in a conversation.
     */
    @GetMapping("/conversations/{id}/images")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<MessageResponse>> getConversationImages(@PathVariable String id) {
        User currentUser = authService.getCurrentUser();
        List<MessageResponse> images = chatService.getConversationImages(id, currentUser.getUserId());
        return ResponseEntity.ok(images);
    }

    /**
     * POST /api/chat/conversations/{id}/messages
     * Send a text message in a conversation.
     */
    @PostMapping(value = "/conversations/{id}/messages", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable String id,
            @Valid @RequestBody SendMessageRequest request) {

        log.info("sendMessage (JSON) called with content: '{}' imageUrl: '{}'", 
                request.getContent(), request.getImageUrl());

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
     * POST /api/chat/conversations/{id}/messages
     * Send a message with file in a conversation.
     */
    @PostMapping(value = "/conversations/{id}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> sendMessageWithFile(
            @PathVariable String id,
            @RequestPart(value = "content", required = false) String content,
            @RequestPart(value = "file", required = false) MultipartFile file) {

        log.info("sendMessageWithFile (multipart) called with content: '{}' file: {}", 
                content, file != null ? file.getOriginalFilename() : "null");

        User currentUser = authService.getCurrentUser();

        // Validate that at least content or file is provided
        if ((content == null || content.trim().isEmpty()) && (file == null || file.isEmpty())) {
            return ResponseEntity.badRequest().body(null);
        }

        // Handle file upload if present
        String imageUrl = null;
        if (file != null && !file.isEmpty()) {
            // Validate file size (max 10MB)
            if (file.getSize() > 10 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(null);
            }

            try {
                imageUrl = cloudinaryService.uploadFile(file, "chat-images").getUrl();
                log.info("Uploaded image for message, URL: {}", imageUrl);
            } catch (Exception e) {
                log.error("Failed to upload image", e);
                return ResponseEntity.internalServerError().body(null);
            }
        }

        // Create SendMessageRequest
        SendMessageRequest request = SendMessageRequest.builder()
                .content(content != null ? content.trim() : "")
                .imageUrl(imageUrl)
                .build();

        log.info("Sending message with content: '{}' and imageUrl: '{}'", request.getContent(), request.getImageUrl());

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
     * POST /api/chat/conversations/{id}/images
     * Upload an image for a conversation.
     */
    @PostMapping("/conversations/{id}/images")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> uploadImage(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file) {

        User currentUser = authService.getCurrentUser();

        // Get conversation and validate access
        ChatConversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));
        chatService.validateConversationAccess(conversation, currentUser.getUserId());

        // Validate file
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File khong duoc de trong"));
        }

        // Validate file type
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Chi chap nhan file hinh anh"));
        }

        // Validate file size (max 10MB)
        if (file.getSize() > 10 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File qua lon. Toi da 10MB"));
        }

        try {
            // Upload to Cloudinary
            String imageUrl = cloudinaryService.uploadFile(file, "chat-images").getUrl();

            // Determine sender type
            ChatMessage.SenderType senderType = switch (currentUser.getRole()) {
                case PET_OWNER -> ChatMessage.SenderType.PET_OWNER;
                default -> ChatMessage.SenderType.CLINIC;
            };

            // Create message
            ChatMessage message = ChatMessage.builder()
                    .chatBoxId(id)
                    .senderId(currentUser.getUserId())
                    .senderType(senderType)
                    .senderName(currentUser.getFullName())
                    .senderAvatar(currentUser.getAvatar())
                    .content("")
                    .messageType(ChatMessage.MessageType.IMAGE)
                    .imageUrl(imageUrl)
                    .status(ChatMessage.MessageStatus.SENT)
                    .createdAt(LocalDateTime.now())
                    .build();

            message = chatService.saveMessage(message);

            // Update conversation
            conversation.setLastMessage("[Hình ảnh]");
            conversation.setLastMessageSender(senderType.name());
            conversation.setLastMessageAt(LocalDateTime.now());

            if (senderType == ChatMessage.SenderType.PET_OWNER) {
                conversation.setUnreadCountClinic(conversation.getUnreadCountClinic() + 1);
            } else {
                conversation.setUnreadCountPetOwner(conversation.getUnreadCountPetOwner() + 1);
            }

            conversationRepository.save(conversation);

            // Create response
            MessageResponse response = chatService.mapToMessageResponse(message, currentUser.getUserId());

            // Send WebSocket
            chatService.sendWebSocketMessage(id, ChatWebSocketMessage.MessageType.MESSAGE, response, currentUser.getUserId(), senderType.name());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Failed to upload image", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload hinh anh that bai"));
        }
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
