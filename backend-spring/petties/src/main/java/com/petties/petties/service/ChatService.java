package com.petties.petties.service;

import com.petties.petties.dto.chat.*;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.ChatConversation;
import com.petties.petties.model.ChatMessage;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ChatConversationRepository;
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
 * - Creating chat conversations between Pet Owner and Clinic
 * - Sending and receiving messages
 * - Real-time message delivery via WebSocket
 * - Read receipts and unread counts
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // ======================== CONVERSATION MANAGEMENT ========================

    /**
     * Create or get existing conversation between Pet Owner and Clinic.
     * Only Pet Owner can initiate a conversation.
     */
    @Transactional
    public ConversationResponse createOrGetConversation(UUID petOwnerId, CreateConversationRequest request) {
        // Validate Pet Owner
        User petOwner = userRepository.findById(petOwnerId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        if (petOwner.getRole() != Role.PET_OWNER) {
            throw new ForbiddenException("Chi Pet Owner moi co the tao cuoc hoi thoai");
        }

        // Validate Clinic
        Clinic clinic = clinicRepository.findById(request.getClinicId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phong kham"));

        // Check if conversation already exists
        Optional<ChatConversation> existingConversation = conversationRepository
                .findByPetOwnerIdAndClinicId(petOwnerId, request.getClinicId());

        if (existingConversation.isPresent()) {
            // Return existing conversation
            ChatConversation conversation = existingConversation.get();

            // If initial message provided, send it
            if (request.getInitialMessage() != null && !request.getInitialMessage().isBlank()) {
                sendMessage(conversation.getId(), petOwnerId, ChatMessage.SenderType.PET_OWNER,
                        new SendMessageRequest(request.getInitialMessage(), null));
                // Refresh conversation
                conversation = conversationRepository.findById(conversation.getId()).orElse(conversation);
            }

            return mapToConversationResponse(conversation, petOwnerId);
        }

        // Create new conversation
        ChatConversation conversation = ChatConversation.builder()
                .petOwnerId(petOwnerId)
                .petOwnerName(petOwner.getFullName())
                .petOwnerAvatar(petOwner.getAvatar())
                .clinicId(clinic.getClinicId())
                .clinicName(clinic.getName())
                .clinicLogo(clinic.getLogo())
                .createdAt(LocalDateTime.now())
                .build();

        conversation = conversationRepository.save(conversation);
        log.info("Created new conversation: {} between Pet Owner: {} and Clinic: {}",
                conversation.getId(), petOwnerId, clinic.getClinicId());

        // If initial message provided, send it
        if (request.getInitialMessage() != null && !request.getInitialMessage().isBlank()) {
            sendMessage(conversation.getId(), petOwnerId, ChatMessage.SenderType.PET_OWNER,
                    new SendMessageRequest(request.getInitialMessage(), null));
            // Refresh conversation
            conversation = conversationRepository.findById(conversation.getId()).orElse(conversation);
        }

        return mapToConversationResponse(conversation, petOwnerId);
    }

    /**
     * Get all conversations for a user (Pet Owner or Clinic staff).
     */
    public Page<ConversationResponse> getConversations(UUID userId, Role role, Pageable pageable) {
        Page<ChatConversation> conversations;

        if (role == Role.PET_OWNER) {
            conversations = conversationRepository.findByPetOwnerIdOrderByLastMessageAtDesc(userId, pageable);
        } else if (role == Role.CLINIC_OWNER || role == Role.CLINIC_MANAGER || role == Role.VET) {
            // Get clinic ID from user
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

            UUID clinicId = getClinicIdForUser(user);
            if (clinicId == null) {
                throw new BadRequestException("Nguoi dung khong thuoc phong kham nao");
            }

            conversations = conversationRepository.findByClinicIdOrderByLastMessageAtDesc(clinicId, pageable);
        } else {
            throw new ForbiddenException("Role khong duoc phep truy cap chat");
        }

        return conversations.map(conversation -> mapToConversationResponse(conversation, userId));
    }

    /**
     * Get a specific conversation by ID.
     */
    public ConversationResponse getConversation(String conversationId, UUID userId) {
        ChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));

        // Validate access
        validateConversationAccess(conversation, userId);

        return mapToConversationResponse(conversation, userId);
    }

    // ======================== MESSAGE MANAGEMENT ========================

    /**
     * Send a message in a conversation.
     */
    @Transactional
    public MessageResponse sendMessage(String conversationId, UUID senderId,
            ChatMessage.SenderType senderType, SendMessageRequest request) {

        // Validate conversation
        ChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));

        // Validate access
        validateConversationAccess(conversation, senderId);

        // Get sender info
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        // Create message
        ChatMessage message = ChatMessage.builder()
                .chatBoxId(conversationId)
                .senderId(senderId)
                .senderType(senderType)
                .senderName(sender.getFullName())
                .senderAvatar(sender.getAvatar())
                .content(request.getContent())
                .messageType(determineMessageType(request.getContent(), request.getImageUrl()))
                .imageUrl(request.getImageUrl())
                .status(ChatMessage.MessageStatus.SENT)
                .createdAt(LocalDateTime.now())
                .build();

        message = messageRepository.save(message);
        log.debug("Message saved: {} in conversation: {}", message.getId(), conversationId);

        // Update conversation with appropriate last message preview
        String lastMessagePreview;
        if (message.getMessageType() == ChatMessage.MessageType.IMAGE) {
            lastMessagePreview = "[Hình ảnh]";
        } else if (message.getMessageType() == ChatMessage.MessageType.IMAGE_TEXT) {
            lastMessagePreview = truncateMessage(request.getContent(), 100);
        } else {
            lastMessagePreview = truncateMessage(request.getContent(), 100);
        }

        conversation.setLastMessage(lastMessagePreview);
        conversation.setLastMessageSender(senderType.name());
        conversation.setLastMessageAt(LocalDateTime.now());

        // Increment unread count for recipient
        if (senderType == ChatMessage.SenderType.PET_OWNER) {
            conversation.setUnreadCountClinic(conversation.getUnreadCountClinic() + 1);
        } else {
            conversation.setUnreadCountPetOwner(conversation.getUnreadCountPetOwner() + 1);
        }

        conversationRepository.save(conversation);

        // Create response
        MessageResponse response = mapToMessageResponse(message, senderId);

        // Send via WebSocket
        sendWebSocketMessage(conversationId, ChatWebSocketMessage.MessageType.MESSAGE, response, senderId,
                senderType.name());

        return response;
    }

    /**
     * Get messages in a conversation with pagination.
     */
    public Page<MessageResponse> getMessages(String conversationId, UUID userId, Pageable pageable) {
        // Validate conversation
        ChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));

        // Validate access
        validateConversationAccess(conversation, userId);

        Page<ChatMessage> messages = messageRepository.findByChatBoxIdOrderByCreatedAtDesc(conversationId, pageable);

        return messages.map(msg -> mapToMessageResponse(msg, userId));
    }

    /**
     * Mark messages as read.
     */
    @Transactional
    public void markAsRead(String conversationId, UUID userId) {
        // Validate conversation
        ChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));

        // Validate access
        validateConversationAccess(conversation, userId);

        // Determine reader's type
        ChatMessage.SenderType readerType = conversation.getPetOwnerId().equals(userId)
                ? ChatMessage.SenderType.PET_OWNER
                : ChatMessage.SenderType.CLINIC;

        // Find unread messages sent by the OTHER party
        List<ChatMessage> unreadMessages = messageRepository
                .findByChatBoxIdAndSenderTypeNotAndIsReadFalse(conversationId, readerType);

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
                conversation.setUnreadCountPetOwner(0);
            } else {
                conversation.setUnreadCountClinic(0);
            }
            conversationRepository.save(conversation);

            // Send read receipt via WebSocket
            sendWebSocketMessage(conversationId, ChatWebSocketMessage.MessageType.READ, null, userId,
                    readerType.name());
        }
    }

    /**
     * Get unread count for a user.
     */
    public UnreadCountResponse getUnreadCount(UUID userId, Role role) {
        long unreadConversations;

        if (role == Role.PET_OWNER) {
            unreadConversations = conversationRepository.countByPetOwnerIdAndUnreadCountPetOwnerGreaterThan(userId, 0);
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));
            UUID clinicId = getClinicIdForUser(user);
            if (clinicId == null) {
                return UnreadCountResponse.builder()
                        .totalUnreadConversations(0)
                        .totalUnreadMessages(0)
                        .build();
            }
            unreadConversations = conversationRepository.countByClinicIdAndUnreadCountClinicGreaterThan(clinicId, 0);
        }

        return UnreadCountResponse.builder()
                .totalUnreadConversations(unreadConversations)
                .totalUnreadMessages(unreadConversations) // Simplified for now
                .build();
    }

    // ======================== ONLINE STATUS ========================

    /**
     * Update user online status in a conversation.
     */
    public void updateOnlineStatus(String conversationId, UUID userId, boolean online) {
        conversationRepository.findById(conversationId).ifPresent(conversation -> {
            if (conversation.getPetOwnerId().equals(userId)) {
                conversation.setPetOwnerOnline(online);
            } else {
                conversation.setClinicOnline(online);
            }
            conversationRepository.save(conversation);

            // Notify via WebSocket
            ChatWebSocketMessage.MessageType type = online
                    ? ChatWebSocketMessage.MessageType.ONLINE
                    : ChatWebSocketMessage.MessageType.OFFLINE;

            String senderType = conversation.getPetOwnerId().equals(userId) ? "PET_OWNER" : "CLINIC";
            sendWebSocketMessage(conversationId, type, null, userId, senderType);
        });
    }

    /**
     * Send typing indicator.
     */
    public void sendTypingIndicator(String conversationId, UUID userId, boolean typing) {
        conversationRepository.findById(conversationId).ifPresent(conversation -> {
            String senderType = conversation.getPetOwnerId().equals(userId) ? "PET_OWNER" : "CLINIC";
            ChatWebSocketMessage.MessageType type = typing
                    ? ChatWebSocketMessage.MessageType.TYPING
                    : ChatWebSocketMessage.MessageType.STOP_TYPING;

            sendWebSocketMessage(conversationId, type, null, userId, senderType);
        });
    }

    // ======================== HELPER METHODS ========================

    public void validateConversationAccess(ChatConversation conversation, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        boolean hasAccess = false;

        if (conversation.getPetOwnerId().equals(userId)) {
            hasAccess = true;
        } else {
            // Check if user belongs to the clinic
            UUID clinicId = getClinicIdForUser(user);
            if (clinicId != null && clinicId.equals(conversation.getClinicId())) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            throw new ForbiddenException("Ban khong co quyen truy cap cuoc hoi thoai nay");
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

    private ConversationResponse mapToConversationResponse(ChatConversation conversation, UUID currentUserId) {
        boolean isPetOwner = conversation.getPetOwnerId().equals(currentUserId);

        return ConversationResponse.builder()
                .id(conversation.getId())
                .petOwnerId(conversation.getPetOwnerId())
                .petOwnerName(conversation.getPetOwnerName())
                .petOwnerAvatar(conversation.getPetOwnerAvatar())
                .clinicId(conversation.getClinicId())
                .clinicName(conversation.getClinicName())
                .clinicLogo(conversation.getClinicLogo())
                .lastMessage(conversation.getLastMessage())
                .lastMessageSender(conversation.getLastMessageSender())
                .lastMessageAt(conversation.getLastMessageAt())
                .unreadCount(isPetOwner ? conversation.getUnreadCountPetOwner() : conversation.getUnreadCountClinic())
                .partnerOnline(isPetOwner ? conversation.isClinicOnline() : conversation.isPetOwnerOnline())
                .createdAt(conversation.getCreatedAt())
                .build();
    }

    public ChatMessage saveMessage(ChatMessage message) {
        return messageRepository.save(message);
    }

    public MessageResponse mapToMessageResponse(ChatMessage msg, UUID currentUserId) {
        return MessageResponse.builder()
                .id(msg.getId())
                .chatBoxId(msg.getChatBoxId())
                .senderId(msg.getSenderId())
                .senderType(msg.getSenderType().name())
                .senderName(msg.getSenderName())
                .senderAvatar(msg.getSenderAvatar())
                .content(msg.getContent())
                .messageType(msg.getMessageType().name())
                .imageUrl(msg.getImageUrl())
                .status(msg.getStatus().name())
                .isRead(msg.isRead())
                .readAt(msg.getReadAt())
                .createdAt(msg.getCreatedAt())
                .isMe(msg.getSenderId().equals(currentUserId))
                .build();
    }

    public void sendWebSocketMessage(String conversationId, ChatWebSocketMessage.MessageType type,
            MessageResponse message, UUID senderId, String senderType) {

        ChatWebSocketMessage wsMessage = ChatWebSocketMessage.builder()
                .type(type)
                .conversationId(conversationId)
                .message(message)
                .senderId(senderId)
                .senderType(senderType)
                .timestamp(LocalDateTime.now())
                .build();

        // Send to conversation topic
        messagingTemplate.convertAndSend("/topic/chat/" + conversationId, wsMessage);
        log.debug("WebSocket message sent to /topic/chat/{}: type={}", conversationId, type);
    }

    private String truncateMessage(String message, int maxLength) {
        if (message == null)
            return null;
        if (message.length() <= maxLength)
            return message;
        return message.substring(0, maxLength - 3) + "...";
    }

    private ChatMessage.MessageType determineMessageType(String content, String imageUrl) {
        if (imageUrl != null && !imageUrl.trim().isEmpty()) {
            if (content != null && !content.trim().isEmpty()) {
                return ChatMessage.MessageType.IMAGE_TEXT; // Combined text + image
            }
            return ChatMessage.MessageType.IMAGE; // Image only
        }
        return ChatMessage.MessageType.TEXT; // Text only
    }

    /**
     * Get all images in a conversation.
     * Returns list of MessageResponse containing only image messages.
     */
    public List<MessageResponse> getConversationImages(String conversationId, UUID currentUserId) {
        // Validate conversation access
        ChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));
        validateConversationAccess(conversation, currentUserId);

        // Get all image messages in conversation, ordered by creation time (newest first)
        List<ChatMessage> imageMessages = messageRepository
                .findByChatBoxIdAndMessageTypeOrderByCreatedAtDesc(
                        conversationId, ChatMessage.MessageType.IMAGE);

        // Convert to MessageResponse
        List<MessageResponse> result = new java.util.ArrayList<>();
        for (ChatMessage msg : imageMessages) {
            result.add(MessageResponse.builder()
                    .id(msg.getId())
                    .chatBoxId(msg.getChatBoxId())
                    .senderId(msg.getSenderId())
                    .senderType(msg.getSenderType().name())
                    .senderName(msg.getSenderName())
                    .senderAvatar(msg.getSenderAvatar())
                    .content(msg.getContent())
                    .messageType(msg.getMessageType().name())
                    .imageUrl(msg.getImageUrl())
                    .status(msg.getStatus().name())
                    .isRead(msg.isRead())
                    .readAt(msg.getReadAt())
                    .createdAt(msg.getCreatedAt())
                    .isMe(msg.getSenderId().equals(currentUserId))
                    .build());
        }
        return result;
    }
}
