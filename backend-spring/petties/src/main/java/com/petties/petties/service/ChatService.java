package com.petties.petties.service;

import com.petties.petties.dto.chat.*;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.ChatBox;
import com.petties.petties.model.ChatMessage;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ChatBoxRepository;
import com.petties.petties.repository.ChatMessageRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for Chat functionality.
 * 
 * Handles:
 * - Creating chat boxes between Pet Owner and Clinic
 * - Sending and receiving messages
 * - Real-time message delivery via WebSocket
 * - Read receipts and unread counts
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatBoxRepository chatBoxRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // ======================== CHAT BOX MANAGEMENT ========================

    /**
     * Create or get existing chat box between Pet Owner and Clinic.
     * Only Pet Owner can initiate a chat box.
     */
    @Transactional
    public ChatBoxResponse createOrGetChatBox(UUID petOwnerId, CreateChatBoxRequest request) {
        // Validate Pet Owner
        User petOwner = userRepository.findById(petOwnerId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        if (petOwner.getRole() != Role.PET_OWNER) {
            throw new ForbiddenException("Chi Pet Owner moi co the tao chat box");
        }

        // Validate Clinic
        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phong kham"));

        // Check if chat box already exists
        Optional<ChatBox> existingChatBox = chatBoxRepository
                .findByPetOwnerIdAndClinicId(petOwnerId, request.getClinicId());

        if (existingChatBox.isPresent()) {
            // Return existing chat box
            ChatBox chatBox = existingChatBox.get();
            
            // If initial message provided, send it
            if (request.getInitialMessage() != null && !request.getInitialMessage().isBlank()) {
                sendMessage(chatBox.getId(), petOwnerId, ChatMessage.SenderType.PET_OWNER, 
                        new SendMessageRequest(request.getInitialMessage()));
                // Refresh chat box
                chatBox = chatBoxRepository.findById(chatBox.getId()).orElse(chatBox);
            }
            
            return mapToChatBoxResponse(chatBox, petOwnerId);
        }

        // Create new chat box
        ChatBox chatBox = ChatBox.builder()
                .petOwnerId(petOwnerId)
                .petOwnerName(petOwner.getFullName())
                .petOwnerAvatar(petOwner.getAvatar())
                .clinicId(clinic.getClinicId())
                .clinicName(clinic.getName())
                .clinicLogo(clinic.getLogo())
                .createdAt(LocalDateTime.now())
                .build();

        chatBox = chatBoxRepository.save(chatBox);
        log.info("Created new chat box: {} between Pet Owner: {} and Clinic: {}", 
                chatBox.getId(), petOwnerId, clinic.getClinicId());

        // If initial message provided, send it
        if (request.getInitialMessage() != null && !request.getInitialMessage().isBlank()) {
            sendMessage(chatBox.getId(), petOwnerId, ChatMessage.SenderType.PET_OWNER,
                    new SendMessageRequest(request.getInitialMessage()));
            // Refresh chat box
            chatBox = chatBoxRepository.findById(chatBox.getId()).orElse(chatBox);
        }

        return mapToChatBoxResponse(chatBox, petOwnerId);
    }

    /**
     * Get all chat boxes for a user (Pet Owner or Clinic staff).
     */
    public Page<ChatBoxResponse> getChatBoxes(UUID userId, Role role, Pageable pageable) {
        Page<ChatBox> chatBoxes;

        if (role == Role.PET_OWNER) {
            chatBoxes = chatBoxRepository.findByPetOwnerIdOrderByLastMessageAtDesc(userId, pageable);
        } else if (role == Role.CLINIC_OWNER || role == Role.CLINIC_MANAGER || role == Role.VET) {
            // Get clinic ID from user
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));
            
            UUID clinicId = getClinicIdForUser(user);
            if (clinicId == null) {
                throw new BadRequestException("Nguoi dung khong thuoc phong kham nao");
            }
            
            chatBoxes = chatBoxRepository.findByClinicIdOrderByLastMessageAtDesc(clinicId, pageable);
        } else {
            throw new ForbiddenException("Role khong duoc phep truy cap chat");
        }

        return chatBoxes.map(chatBox -> mapToChatBoxResponse(chatBox, userId));
    }

    /**
     * Get a specific chat box by ID.
     */
    public ChatBoxResponse getChatBox(String chatBoxId, UUID userId) {
        ChatBox chatBox = chatBoxRepository.findById(chatBoxId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay chat box"));

        // Validate access
        validateChatBoxAccess(chatBox, userId);

        return mapToChatBoxResponse(chatBox, userId);
    }

    // ======================== MESSAGE MANAGEMENT ========================

    /**
     * Send a message in a chat box.
     */
    @Transactional
    public MessageResponse sendMessage(String chatBoxId, UUID senderId, 
            ChatMessage.SenderType senderType, SendMessageRequest request) {
        
        // Validate chat box
        ChatBox chatBox = chatBoxRepository.findById(chatBoxId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay chat box"));

        // Validate access
        validateChatBoxAccess(chatBox, senderId);

        // Get sender info
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        // Create message
        ChatMessage message = ChatMessage.builder()
                .chatBoxId(chatBoxId)
                .senderId(senderId)
                .senderType(senderType)
                .senderName(sender.getFullName())
                .senderAvatar(sender.getAvatar())
                .content(request.getContent())
                .status(ChatMessage.MessageStatus.SENT)
                .createdAt(LocalDateTime.now())
                .build();

        message = messageRepository.save(message);
        log.debug("Message saved: {} in chat box: {}", message.getId(), chatBoxId);

        // Update chat box
        chatBox.setLastMessage(truncateMessage(request.getContent(), 100));
        chatBox.setLastMessageSender(senderType.name());
        chatBox.setLastMessageAt(LocalDateTime.now());

        // Increment unread count for recipient
        if (senderType == ChatMessage.SenderType.PET_OWNER) {
            chatBox.setUnreadCountClinic(chatBox.getUnreadCountClinic() + 1);
        } else {
            chatBox.setUnreadCountPetOwner(chatBox.getUnreadCountPetOwner() + 1);
        }

        chatBoxRepository.save(chatBox);

        // Create response
        MessageResponse response = mapToMessageResponse(message, senderId);

        // Send via WebSocket
        sendWebSocketMessage(chatBoxId, ChatWebSocketMessage.MessageType.MESSAGE, response, senderId, senderType.name());

        return response;
    }

    /**
     * Get messages in a chat box with pagination.
     */
    public Page<MessageResponse> getMessages(String chatBoxId, UUID userId, Pageable pageable) {
        // Validate chat box
        ChatBox chatBox = chatBoxRepository.findById(chatBoxId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay chat box"));

        // Validate access
        validateChatBoxAccess(chatBox, userId);

        Page<ChatMessage> messages = messageRepository.findByChatBoxIdOrderByCreatedAtDesc(chatBoxId, pageable);

        return messages.map(msg -> mapToMessageResponse(msg, userId));
    }

    /**
     * Mark messages as read.
     */
    @Transactional
    public void markAsRead(String chatBoxId, UUID userId) {
        // Validate chat box
        ChatBox chatBox = chatBoxRepository.findById(chatBoxId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay chat box"));

        // Validate access
        validateChatBoxAccess(chatBox, userId);

        // Determine reader's type
        ChatMessage.SenderType readerType = chatBox.getPetOwnerId().equals(userId) 
                ? ChatMessage.SenderType.PET_OWNER 
                : ChatMessage.SenderType.CLINIC;

        // Find unread messages sent by the OTHER party
        List<ChatMessage> unreadMessages = messageRepository
                .findByChatBoxIdAndSenderTypeNotAndIsReadFalse(chatBoxId, readerType);

        if (!unreadMessages.isEmpty()) {
            LocalDateTime now = LocalDateTime.now();
            for (ChatMessage msg : unreadMessages) {
                msg.setRead(true);
                msg.setReadAt(now);
                msg.setStatus(ChatMessage.MessageStatus.SEEN);
            }
            messageRepository.saveAll(unreadMessages);

            // Reset unread count
            if (readerType == ChatMessage.SenderType.PET_OWNER) {
                chatBox.setUnreadCountPetOwner(0);
            } else {
                chatBox.setUnreadCountClinic(0);
            }
            chatBoxRepository.save(chatBox);

            // Send read receipt via WebSocket
            sendWebSocketMessage(chatBoxId, ChatWebSocketMessage.MessageType.READ, null, userId, readerType.name());
        }
    }

    /**
     * Get unread count for a user.
     */
    public UnreadCountResponse getUnreadCount(UUID userId, Role role) {
        long unreadChatBoxes;
        
        if (role == Role.PET_OWNER) {
            unreadChatBoxes = chatBoxRepository.countByPetOwnerIdAndUnreadCountPetOwnerGreaterThan(userId, 0);
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));
            UUID clinicId = getClinicIdForUser(user);
            if (clinicId == null) {
                return UnreadCountResponse.builder()
                        .totalUnreadChatBoxes(0)
                        .totalUnreadMessages(0)
                        .build();
            }
            unreadChatBoxes = chatBoxRepository.countByClinicIdAndUnreadCountClinicGreaterThan(clinicId, 0);
        }

        return UnreadCountResponse.builder()
                .totalUnreadChatBoxes(unreadChatBoxes)
                .totalUnreadMessages(unreadChatBoxes) // Simplified for now
                .build();
    }

    // ======================== ONLINE STATUS ========================

    /**
     * Update user online status in a chat box.
     */
    public void updateOnlineStatus(String chatBoxId, UUID userId, boolean online) {
        chatBoxRepository.findById(chatBoxId).ifPresent(chatBox -> {
            if (chatBox.getPetOwnerId().equals(userId)) {
                chatBox.setPetOwnerOnline(online);
            } else {
                chatBox.setClinicOnline(online);
            }
            chatBoxRepository.save(chatBox);

            // Notify via WebSocket
            ChatWebSocketMessage.MessageType type = online 
                    ? ChatWebSocketMessage.MessageType.ONLINE 
                    : ChatWebSocketMessage.MessageType.OFFLINE;
            
            String senderType = chatBox.getPetOwnerId().equals(userId) ? "PET_OWNER" : "CLINIC";
            sendWebSocketMessage(chatBoxId, type, null, userId, senderType);
        });
    }

    /**
     * Send typing indicator.
     */
    public void sendTypingIndicator(String chatBoxId, UUID userId, boolean typing) {
        chatBoxRepository.findById(chatBoxId).ifPresent(chatBox -> {
            String senderType = chatBox.getPetOwnerId().equals(userId) ? "PET_OWNER" : "CLINIC";
            ChatWebSocketMessage.MessageType type = typing 
                    ? ChatWebSocketMessage.MessageType.TYPING 
                    : ChatWebSocketMessage.MessageType.STOP_TYPING;
            
            sendWebSocketMessage(chatBoxId, type, null, userId, senderType);
        });
    }

    // ======================== HELPER METHODS ========================

    private void validateChatBoxAccess(ChatBox chatBox, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        boolean hasAccess = false;

        if (chatBox.getPetOwnerId().equals(userId)) {
            hasAccess = true;
        } else {
            // Check if user belongs to the clinic
            UUID clinicId = getClinicIdForUser(user);
            if (clinicId != null && clinicId.equals(chatBox.getClinicId())) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            throw new ForbiddenException("Ban khong co quyen truy cap chat box nay");
        }
    }

    private UUID getClinicIdForUser(User user) {
        if (user.getRole() == Role.CLINIC_OWNER) {
            // Query clinic by owner instead of using lazy-loaded collection
            return clinicRepository.findFirstByOwnerUserId(user.getUserId())
                    .map(clinic -> clinic.getClinicId())
                    .orElse(null);
        } else if (user.getWorkingClinic() != null) {
            return user.getWorkingClinic().getClinicId();
        }
        return null;
    }

    private ChatBoxResponse mapToChatBoxResponse(ChatBox chatBox, UUID currentUserId) {
        boolean isPetOwner = chatBox.getPetOwnerId().equals(currentUserId);
        
        return ChatBoxResponse.builder()
                .id(chatBox.getId())
                .petOwnerId(chatBox.getPetOwnerId())
                .petOwnerName(chatBox.getPetOwnerName())
                .petOwnerAvatar(chatBox.getPetOwnerAvatar())
                .clinicId(chatBox.getClinicId())
                .clinicName(chatBox.getClinicName())
                .clinicLogo(chatBox.getClinicLogo())
                .lastMessage(chatBox.getLastMessage())
                .lastMessageSender(chatBox.getLastMessageSender())
                .lastMessageAt(chatBox.getLastMessageAt())
                .unreadCount(isPetOwner ? chatBox.getUnreadCountPetOwner() : chatBox.getUnreadCountClinic())
                .partnerOnline(isPetOwner ? chatBox.isClinicOnline() : chatBox.isPetOwnerOnline())
                .createdAt(chatBox.getCreatedAt())
                .build();
    }

    private MessageResponse mapToMessageResponse(ChatMessage msg, UUID currentUserId) {
        return MessageResponse.builder()
                .id(msg.getId())
                .chatBoxId(msg.getChatBoxId())
                .senderId(msg.getSenderId())
                .senderType(msg.getSenderType().name())
                .senderName(msg.getSenderName())
                .senderAvatar(msg.getSenderAvatar())
                .content(msg.getContent())
                .status(msg.getStatus().name())
                .isRead(msg.isRead())
                .readAt(msg.getReadAt())
                .createdAt(msg.getCreatedAt())
                .isMe(msg.getSenderId().equals(currentUserId))
                .build();
    }

    private void sendWebSocketMessage(String chatBoxId, ChatWebSocketMessage.MessageType type,
            MessageResponse message, UUID senderId, String senderType) {
        
        ChatWebSocketMessage wsMessage = ChatWebSocketMessage.builder()
                .type(type)
                .chatBoxId(chatBoxId)
                .message(message)
                .senderId(senderId)
                .senderType(senderType)
                .timestamp(LocalDateTime.now())
                .build();

        // Send to chat box topic
        messagingTemplate.convertAndSend("/topic/chat/" + chatBoxId, wsMessage);
        log.debug("WebSocket message sent to /topic/chat/{}: type={}", chatBoxId, type);
    }

    private String truncateMessage(String message, int maxLength) {
        if (message == null) return null;
        if (message.length() <= maxLength) return message;
        return message.substring(0, maxLength - 3) + "...";
    }
}
