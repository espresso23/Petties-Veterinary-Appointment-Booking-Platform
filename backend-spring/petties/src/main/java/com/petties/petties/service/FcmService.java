package com.petties.petties.service;

import com.google.firebase.messaging.*;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for sending push notifications via Firebase Cloud Messaging
 */
@Service
@Slf4j
public class FcmService {

    private final FirebaseMessaging firebaseMessaging;
    private final UserRepository userRepository;

    public FcmService(
            @org.springframework.lang.Nullable FirebaseMessaging firebaseMessaging,
            UserRepository userRepository) {
        this.firebaseMessaging = firebaseMessaging;
        this.userRepository = userRepository;

        if (firebaseMessaging == null) {
            log.warn("FirebaseMessaging not available. Push notifications will be disabled.");
        }
    }

    /**
     * Register FCM token for a user
     */
    @Transactional
    public void registerToken(UUID userId, String fcmToken) {
        if (!StringUtils.hasText(fcmToken)) {
            log.warn("Empty FCM token for user {}", userId);
            return;
        }

        userRepository.findById(userId).ifPresent(user -> {
            user.setFcmToken(fcmToken);
            userRepository.save(user);
            log.info("Registered FCM token for user {}", userId);
        });
    }

    /**
     * Remove FCM token for a user (on logout)
     */
    @Transactional
    public void removeToken(UUID userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setFcmToken(null);
            userRepository.save(user);
            log.info("Removed FCM token for user {}", userId);
        });
    }

    /**
     * Send push notification to a single user
     */
    public boolean sendToUser(User user, String title, String body, Map<String, String> data) {
        if (firebaseMessaging == null) {
            log.debug("FirebaseMessaging not initialized, skipping push notification");
            return false;
        }

        String fcmToken = user.getFcmToken();
        if (!StringUtils.hasText(fcmToken)) {
            log.debug("User {} has no FCM token, skipping push notification", user.getUserId());
            return false;
        }

        try {
            Message message = Message.builder()
                    .setToken(fcmToken)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .putAllData(data != null ? data : Map.of())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .setNotification(AndroidNotification.builder()
                                    .setChannelId("petties_notifications")
                                    .build())
                            .build())
                    .setApnsConfig(ApnsConfig.builder()
                            .setAps(Aps.builder()
                                    .setSound("default")
                                    .setBadge(1)
                                    .build())
                            .build())
                    .build();

            String response = firebaseMessaging.send(message);
            log.info("Push notification sent to user {}: {}", user.getUserId(), response);
            return true;
        } catch (FirebaseMessagingException e) {
            handleFcmError(user, e);
            return false;
        }
    }

    /**
     * Send push notification to multiple users
     */
    public int sendToUsers(List<User> users, String title, String body, Map<String, String> data) {
        if (firebaseMessaging == null) {
            log.debug("FirebaseMessaging not initialized, skipping push notifications");
            return 0;
        }

        List<String> tokens = users.stream()
                .filter(u -> StringUtils.hasText(u.getFcmToken()))
                .map(User::getFcmToken)
                .collect(Collectors.toList());

        if (tokens.isEmpty()) {
            log.debug("No FCM tokens available for batch notification");
            return 0;
        }

        try {
            MulticastMessage message = MulticastMessage.builder()
                    .addAllTokens(tokens)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .putAllData(data != null ? data : Map.of())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .setNotification(AndroidNotification.builder()
                                    .setChannelId("petties_notifications")
                                    .build())
                            .build())
                    .setApnsConfig(ApnsConfig.builder()
                            .setAps(Aps.builder()
                                    .setSound("default")
                                    .build())
                            .build())
                    .build();

            BatchResponse response = firebaseMessaging.sendEachForMulticast(message);
            log.info("Batch push notification sent: {}/{} successful",
                    response.getSuccessCount(), tokens.size());
            return response.getSuccessCount();
        } catch (FirebaseMessagingException e) {
            log.error("Error sending batch push notification: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Send push notification by user ID
     */
    public boolean sendToUser(UUID userId, String title, String body, Map<String, String> data) {
        return userRepository.findById(userId)
                .map(user -> sendToUser(user, title, body, data))
                .orElse(false);
    }

    private void handleFcmError(User user, FirebaseMessagingException e) {
        if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED ||
                e.getMessagingErrorCode() == MessagingErrorCode.INVALID_ARGUMENT) {
            // Token is invalid, remove it
            log.warn("Invalid FCM token for user {}, removing", user.getUserId());
            user.setFcmToken(null);
            userRepository.save(user);
        } else {
            log.error("FCM error for user {}: {} - {}",
                    user.getUserId(), e.getMessagingErrorCode(), e.getMessage());
        }
    }
}
