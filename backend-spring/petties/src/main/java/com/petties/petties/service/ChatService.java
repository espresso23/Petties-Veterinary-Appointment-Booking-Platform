package com.petties.petties.service;

import com.petties.petties.dto.chat.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.ChatAutoReplySetting;
import com.petties.petties.model.ChatConversation;
import com.petties.petties.model.ChatMessage;
import com.petties.petties.model.ChatMessage.ActionButton;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.OperatingHours;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.AutoReplyCondition;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ChatAutoReplySettingRepository;
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
import java.util.Map;

/**
 * Service for Chat functionality.
 * 
 * Handles:
 * - Creating chat conversations between Pet Owner and Clinic
 * - Sending and receiving messages
 * - Real-time message delivery via WebSocket
 * - Push notifications via FCM for offline users
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
    private final ChatAutoReplySettingRepository autoReplySettingRepository;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private final FcmService fcmService;

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

            // Sync data
            syncConversationData(conversation);

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
    @Transactional
    public Page<ConversationResponse> getConversations(UUID userId, Role role, Pageable pageable) {
        Page<ChatConversation> conversations;

        if (role == Role.PET_OWNER) {
            conversations = conversationRepository.findByPetOwnerIdOrderByLastMessageAtDesc(userId, pageable);
        } else if (role == Role.CLINIC_OWNER || role == Role.CLINIC_MANAGER || role == Role.STAFF) {
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

        // Sync denormalized data to ensure avatars and names are up to date
        conversations.forEach(this::syncConversationData);

        return conversations.map(conversation -> mapToConversationResponse(conversation, userId));
    }

    /**
     * Get a specific conversation by ID.
     */
    @Transactional
    public ConversationResponse getConversation(String conversationId, UUID userId) {
        ChatConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay cuoc hoi thoai"));

        // Validate access
        validateConversationAccess(conversation, userId);

        // Sync data before returning
        syncConversationData(conversation);

        return mapToConversationResponse(conversation, userId);
    }

    /**
     * Sync denormalized data (avatars, names) from source entities.
     */
    private void syncConversationData(ChatConversation conv) {
        boolean needsSave = false;

        // Sync Pet Owner data
        if (conv.getPetOwnerId() != null) {
            Optional<User> userOpt = userRepository.findById(conv.getPetOwnerId());
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                // Check avatar
                if (!java.util.Objects.equals(conv.getPetOwnerAvatar(), user.getAvatar())) {
                    conv.setPetOwnerAvatar(user.getAvatar());
                    needsSave = true;
                }
                // Check name (only if missing or if forced sync logic is desired, but let's
                // prioritize avatar)
                if (conv.getPetOwnerName() == null || !conv.getPetOwnerName().equals(user.getFullName())) {
                    conv.setPetOwnerName(user.getFullName());
                    needsSave = true;
                }
            }
        }

        // Sync Clinic data
        if (conv.getClinicId() != null) {
            Optional<Clinic> clinicOpt = clinicRepository.findById(conv.getClinicId());
            if (clinicOpt.isPresent()) {
                Clinic clinic = clinicOpt.get();
                // Check logo
                if (!java.util.Objects.equals(conv.getClinicLogo(), clinic.getLogo())) {
                    log.info("Syncing Clinic Logo for convo {}: old='{}', new='{}'",
                            conv.getId(), conv.getClinicLogo(), clinic.getLogo());
                    conv.setClinicLogo(clinic.getLogo());
                    needsSave = true;
                }
                // Check name
                if (conv.getClinicName() == null || !conv.getClinicName().equals(clinic.getName())) {
                    conv.setClinicName(clinic.getName());
                    needsSave = true;
                }
            } else {
                log.warn("Clinic not found for sync: {}", conv.getClinicId());
            }
        }

        if (needsSave) {
            conversationRepository.save(conv);
            log.info("Saved synced conversation: {}", conv.getId());
        }
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
                .senderAvatar(senderType == ChatMessage.SenderType.CLINIC
                        ? clinicRepository.findById(conversation.getClinicId()).map(Clinic::getLogo).orElse(null)
                        : sender.getAvatar())
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

        // Send push notification to recipient via FCM
        try {
            final UUID recipientId = senderType == ChatMessage.SenderType.PET_OWNER
                    ? getClinicManagerId(conversation)
                    : conversation.getPetOwnerId();

            // Capture values before lambda to ensure they are effectively final
            final ChatMessage.MessageType msgType = message.getMessageType();
            final String msgContent = message.getContent();
            final String convId = conversationId;

            if (recipientId != null) {
                userRepository.findById(recipientId).ifPresent(recipient -> {
                    String notificationBody = msgType == ChatMessage.MessageType.IMAGE
                            ? "[Hình ảnh]"
                            : truncateMessage(msgContent, 100);

                    String notificationTitle = senderType == ChatMessage.SenderType.CLINIC
                            ? conversation.getClinicName()
                            : conversation.getPetOwnerName();

                    if (notificationTitle == null || notificationTitle.isEmpty()) {
                        notificationTitle = "Tin nhắn mới";
                    }

                    fcmService.sendToUser(
                            recipient,
                            notificationTitle,
                            notificationBody,
                            java.util.Map.of(
                                    "type", "chat_message",
                                    "conversationId", convId));
                    log.debug("FCM push sent to recipient: {}", recipientId);
                });
            }
        } catch (Exception e) {
            log.warn("Failed to send FCM push notification for chat message: {}", e.getMessage());
            // Don't fail the message sending if FCM fails
        }

        // After user message is processed, optionally send clinic auto-reply
        if (senderType == ChatMessage.SenderType.PET_OWNER) {
            try {
                maybeSendAutoReply(conversation, message);
            } catch (Exception e) {
                log.warn("Failed to send chat auto-reply for conversation {}: {}", conversationId, e.getMessage());
            }
        }

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
                .clinicLogo(resolveClinicLogo(conversation))
                .lastMessage(conversation.getLastMessage())
                .lastMessageSender(conversation.getLastMessageSender())
                .lastMessageAt(conversation.getLastMessageAt())
                .unreadCount(isPetOwner ? conversation.getUnreadCountPetOwner() : conversation.getUnreadCountClinic())
                .partnerOnline(isPetOwner ? conversation.isClinicOnline() : conversation.isPetOwnerOnline())
                .createdAt(conversation.getCreatedAt())
                .build();
    }

    private String resolveClinicLogo(ChatConversation conversation) {
        // FORCE FETCH: Always get latest logo from Clinic table to avoid stale MongoDB
        // data
        String logo = clinicRepository.findById(conversation.getClinicId())
                .map(c -> {
                    log.info("DEBUG: FORCE_RESOLVE found logo for clinic {}: {}", c.getClinicId(), c.getLogo());
                    return c.getLogo();
                })
                .orElse(null);

        log.info("DEBUG: Final Clinic Logo for conv " + conversation.getId() + ": " + logo);
        return logo;
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
                .actionButtons(msg.getActionButtons())
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
     * Gửi tin nhắn tự động từ phía phòng khám nếu cấu hình cho phép.
     * QUICK_REPLY: gửi một lần cho mỗi cuộc hội thoại khi phòng khám đang mở cửa.
     * AWAY_MESSAGE: gửi tối đa một lần mỗi ngày khi phòng khám đang đóng cửa.
     */
    private void maybeSendAutoReply(ChatConversation conversation, ChatMessage lastUserMessage) {
        Clinic clinic = clinicRepository.findById(conversation.getClinicId()).orElse(null);
        if (clinic == null) {
            log.debug("Clinic not found for conversation {}, skip auto-reply", conversation.getId());
            return;
        }

        ChatAutoReplySetting settings = autoReplySettingRepository
                .findByClinicClinicId(clinic.getClinicId())
                .orElse(null);
        if (settings == null) {
            log.debug("No auto-reply settings for clinic {}, skip auto-reply", clinic.getClinicId());
            return;
        }

        java.time.ZoneId vietnamZone = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
        java.time.ZonedDateTime nowVietnam = java.time.ZonedDateTime.now(vietnamZone);
        java.time.LocalDate today = nowVietnam.toLocalDate();

        boolean isOpen = isClinicOpenForNow(clinic.getOperatingHours(), nowVietnam);

        boolean quickReplyEnabled = settings.isQuickReplyEnabled();
        boolean awayEnabled = settings.isAwayMessageEnabled();
        AutoReplyCondition awayCondition = settings.getAwayCondition() != null
                ? settings.getAwayCondition()
                : AutoReplyCondition.OFF_HOURS;

        LocalDateTime lastAutoReplyAt = conversation.getLastAutoReplyAt();
        String lastAutoReplyType = conversation.getLastAutoReplyType();

        boolean shouldSendAway = awayEnabled
                && (awayCondition == AutoReplyCondition.ALWAYS || !isOpen);
        boolean shouldSendQuick = quickReplyEnabled && isOpen;

        if (shouldSendAway) {
            if ("AWAY_MESSAGE".equals(lastAutoReplyType)
                    && lastAutoReplyAt != null
                    && lastAutoReplyAt.toLocalDate().equals(today)) {
                log.debug("Away auto-reply already sent today for conversation {}, skip", conversation.getId());
                return;
            }
            String content = settings.getAwayMessage();
            if (content == null || content.isBlank()) {
                log.debug("Away message content is empty for clinic {}, skip", clinic.getClinicId());
                return;
            }
            List<ActionButton> actionButtons = parseActionButtons(settings.getActionButtonsJson());
            sendClinicAutoReply(conversation, clinic, content.trim(), "AWAY_MESSAGE", nowVietnam.toLocalDateTime(), actionButtons);
            return;
        }

        if (shouldSendQuick) {
            if ("QUICK_REPLY".equals(lastAutoReplyType)
                    && lastAutoReplyAt != null
                    && lastAutoReplyAt.toLocalDate().equals(today)) {
                log.debug("Quick auto-reply already sent today for conversation {}, skip", conversation.getId());
                return;
            }
            String content = settings.getQuickReplyMessage();
            if (content == null || content.isBlank()) {
                log.debug("Quick reply message content is empty for clinic {}, skip", clinic.getClinicId());
                return;
            }
            List<ActionButton> actionButtons = parseActionButtons(settings.getActionButtonsJson());
            sendClinicAutoReply(conversation, clinic, content.trim(), "QUICK_REPLY", nowVietnam.toLocalDateTime(), actionButtons);
        }
    }

    private List<ActionButton> parseActionButtons(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<List<ActionButton>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse action buttons for auto-reply: {}", e.getMessage());
            return null;
        }
    }

    private boolean isClinicOpenForNow(Map<String, OperatingHours> hoursMap, java.time.ZonedDateTime nowVietnam) {
        if (hoursMap == null || hoursMap.isEmpty()) return false;
        java.time.LocalDateTime now = nowVietnam.toLocalDateTime();
        String day = now.getDayOfWeek().name().toLowerCase();
        OperatingHours hours = hoursMap.entrySet().stream()
                .filter(e -> e.getKey().equalsIgnoreCase(day))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
        if (hours == null || Boolean.TRUE.equals(hours.getIsClosed())) return false;
        java.time.LocalTime currentTime = now.toLocalTime();
        if (hours.getOpenTime() == null || hours.getCloseTime() == null) return false;
        if (currentTime.isBefore(hours.getOpenTime()) || currentTime.isAfter(hours.getCloseTime())) return false;
        if (hours.getBreakStart() != null && hours.getBreakEnd() != null) {
            if (currentTime.isAfter(hours.getBreakStart()) && currentTime.isBefore(hours.getBreakEnd())) return false;
        }
        return true;
    }

    private void sendClinicAutoReply(ChatConversation conversation, Clinic clinic, String content,
            String autoReplyType, LocalDateTime createdAt, List<ActionButton> actionButtons) {
        try {
            UUID clinicSenderId = getClinicManagerId(conversation);
            if (clinicSenderId == null) {
                log.debug("No clinic manager/owner found for conversation {}, skip auto-reply", conversation.getId());
                return;
            }
            User sender = userRepository.findById(clinicSenderId).orElse(null);
            if (sender == null) {
                log.debug("Sender user not found for auto-reply {}, skip", clinicSenderId);
                return;
            }
            ChatMessage autoMessage = ChatMessage.builder()
                    .chatBoxId(conversation.getId())
                    .senderId(clinicSenderId)
                    .senderType(ChatMessage.SenderType.CLINIC)
                    .senderName(sender.getFullName())
                    .senderAvatar(clinic.getLogo())
                    .content(content)
                    .messageType(ChatMessage.MessageType.TEXT)
                    .status(ChatMessage.MessageStatus.SENT)
                    .createdAt(createdAt)
                    .actionButtons(actionButtons)
                    .build();
            autoMessage = messageRepository.save(autoMessage);
            log.debug("Auto-reply message saved: {} in conversation: {}", autoMessage.getId(), conversation.getId());

            conversation.setLastMessage(truncateMessage(content, 100));
            conversation.setLastMessageSender(ChatMessage.SenderType.CLINIC.name());
            conversation.setLastMessageAt(createdAt);
            conversation.setUnreadCountPetOwner(conversation.getUnreadCountPetOwner() + 1);
            conversation.setLastAutoReplyAt(createdAt);
            conversation.setLastAutoReplyType(autoReplyType);
            conversationRepository.save(conversation);

            MessageResponse autoResponse = mapToMessageResponse(autoMessage, clinicSenderId);
            sendWebSocketMessage(conversation.getId(), ChatWebSocketMessage.MessageType.MESSAGE, autoResponse,
                    clinicSenderId, ChatMessage.SenderType.CLINIC.name());
        } catch (Exception e) {
            log.warn("Failed to send clinic auto-reply for conversation {}: {}", conversation.getId(), e.getMessage());
        }
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

        // Get all image messages in conversation, ordered by creation time (newest
        // first)
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

    /**
     * Get the clinic manager or owner ID for a conversation.
     * Used to send push notifications to the clinic side.
     */
    private UUID getClinicManagerId(ChatConversation conversation) {
        try {
            // Try to find clinic manager first
            Optional<Clinic> clinicOpt = clinicRepository.findById(conversation.getClinicId());
            if (clinicOpt.isEmpty()) {
                return null;
            }

            Clinic clinic = clinicOpt.get();

            // Try to find a clinic manager working at this clinic
            List<User> managers = userRepository.findByWorkingClinicAndRole(clinic, Role.CLINIC_MANAGER);
            if (!managers.isEmpty()) {
                return managers.get(0).getUserId();
            }

            // Fallback to clinic owner
            if (clinic.getOwner() != null) {
                return clinic.getOwner().getUserId();
            }

            return null;
        } catch (Exception e) {
            log.warn("Failed to get clinic manager ID for conversation {}: {}",
                    conversation.getId(), e.getMessage());
            return null;
        }
    }
}
