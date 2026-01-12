package com.petties.petties.controller;

import com.petties.petties.dto.chat.ChatWebSocketMessage;
import com.petties.petties.dto.chat.MessageResponse;
import com.petties.petties.dto.chat.SendMessageRequest;
import com.petties.petties.model.User;
import com.petties.petties.model.ChatMessage;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * WebSocket Controller for real-time chat messaging.
 * 
 * Destinations:
 * - /app/chat/{chatBoxId}/send - Send message
 * - /app/chat/{chatBoxId}/typing - Typing indicator
 * - /app/chat/{chatBoxId}/read - Mark as read
 * - /app/chat/{chatBoxId}/online - Online status
 * 
 * Broadcasts to:
 * - /topic/chat/{chatBoxId} - All messages in chat box
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatService chatService;
    private final UserRepository userRepository;

    /**
     * Handle incoming message from WebSocket client.
     * Client sends to: /app/chat/{chatBoxId}/send
     * Broadcasts to: /topic/chat/{chatBoxId}
     */
    @MessageMapping("/chat/{chatBoxId}/send")
    public void sendMessage(
            @DestinationVariable String chatBoxId,
            @Payload SendMessageRequest request,
            Principal principal) {
        
        if (principal == null) {
            log.warn("Unauthorized WebSocket message attempt");
            return;
        }

        try {
            UUID userId = UUID.fromString(principal.getName());
            User user = userRepository.findById(userId).orElse(null);
            
            if (user == null) {
                log.warn("User not found for WebSocket message: {}", userId);
                return;
            }

            ChatMessage.SenderType senderType = switch (user.getRole()) {
                case PET_OWNER -> ChatMessage.SenderType.PET_OWNER;
                default -> ChatMessage.SenderType.CLINIC;
            };

            // Send message (will broadcast via ChatService)
            chatService.sendMessage(chatBoxId, userId, senderType, request);
            log.debug("WebSocket message processed for chat box: {}", chatBoxId);
            
        } catch (Exception e) {
            log.error("Error processing WebSocket message: {}", e.getMessage(), e);
        }
    }

    /**
     * Handle typing indicator.
     * Client sends to: /app/chat/{chatBoxId}/typing
     */
    @MessageMapping("/chat/{chatBoxId}/typing")
    public void handleTyping(
            @DestinationVariable String chatBoxId,
            @Payload TypingPayload payload,
            Principal principal) {
        
        if (principal == null) return;

        try {
            UUID userId = UUID.fromString(principal.getName());
            chatService.sendTypingIndicator(chatBoxId, userId, payload.isTyping());
        } catch (Exception e) {
            log.error("Error processing typing indicator: {}", e.getMessage());
        }
    }

    /**
     * Handle read receipt.
     * Client sends to: /app/chat/{chatBoxId}/read
     */
    @MessageMapping("/chat/{chatBoxId}/read")
    public void handleRead(
            @DestinationVariable String chatBoxId,
            Principal principal) {
        
        if (principal == null) return;

        try {
            UUID userId = UUID.fromString(principal.getName());
            chatService.markAsRead(chatBoxId, userId);
        } catch (Exception e) {
            log.error("Error processing read receipt: {}", e.getMessage());
        }
    }

    /**
     * Handle online/offline status.
     * Client sends to: /app/chat/{chatBoxId}/online
     */
    @MessageMapping("/chat/{chatBoxId}/online")
    public void handleOnlineStatus(
            @DestinationVariable String chatBoxId,
            @Payload OnlinePayload payload,
            Principal principal) {
        
        if (principal == null) return;

        try {
            UUID userId = UUID.fromString(principal.getName());
            chatService.updateOnlineStatus(chatBoxId, userId, payload.isOnline());
        } catch (Exception e) {
            log.error("Error processing online status: {}", e.getMessage());
        }
    }

    /**
     * Simple payload for typing indicator
     */
    public record TypingPayload(boolean typing) {
        public boolean isTyping() { return typing; }
    }

    /**
     * Simple payload for online status
     */
    public record OnlinePayload(boolean online) {
        public boolean isOnline() { return online; }
    }
}
